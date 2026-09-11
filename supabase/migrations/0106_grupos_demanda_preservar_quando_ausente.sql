-- =====================================================================
-- 0106 — Distinguir "grupos não enviados" de "nenhum grupo".
--
-- Migration ADITIVA: apenas substitui o corpo de duas funções.
--
-- Regressão encontrada ao exercitar o formulário contra o banco local:
-- a tela de detalhe da demanda (/orcamento/demandas/[id]) salva a demanda
-- sem qualquer campo de grupo, porque o editor de grupos só existe na
-- tela de criação. Com p_grupos = '[]', sincronizar_demanda_grupos
-- apagava todos os grupos da demanda e, por "on delete set null",
-- zerava demanda_analises.grupo_amostra_id.
--
-- Contrato novo:
--   p_grupos IS NULL  -> preserva os grupos existentes (não sincroniza)
--   p_grupos = '[]'   -> remove explicitamente todos os grupos
--
-- ---------------------------------------------------------------------
-- ROLLBACK (manual): reaplicar os corpos definidos em 0104 e 0105.
-- =====================================================================

create or replace function public.sincronizar_demanda_grupos(
  p_demanda_id bigint,
  p_grupos jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  g jsonb;
  v_ordem integer := 0;
  v_id bigint;
  v_preservados bigint[] := array[]::bigint[];
  v_chaves jsonb := '{}'::jsonb;
begin
  perform 1 from public.demandas_propostas where id = p_demanda_id;
  if not found then
    raise exception 'Demanda % nao encontrada.', p_demanda_id using errcode = 'P0002';
  end if;

  -- Ausência de grupos no payload NAO significa "apagar tudo".
  if p_grupos is null then
    select coalesce(jsonb_object_agg(identificacao, id), '{}'::jsonb)
      into v_chaves
      from public.demanda_grupos_amostras
     where demanda_id = p_demanda_id;
    return jsonb_build_object(
      'demanda_id', p_demanda_id,
      'grupos', (select count(*) from public.demanda_grupos_amostras where demanda_id = p_demanda_id),
      'chaves', v_chaves,
      'preservado', true
    );
  end if;

  if jsonb_typeof(p_grupos) is distinct from 'array' then
    raise exception 'p_grupos deve ser um array jsonb ou NULL.' using errcode = '22023';
  end if;

  for g in select * from jsonb_array_elements(p_grupos) loop
    v_ordem := v_ordem + 1;

    if coalesce(btrim(g->>'identificacao'), '') = '' then
      raise exception 'Grupo na posicao % esta sem identificacao.', v_ordem using errcode = '22023';
    end if;

    if coalesce((g->>'quantidade_amostras')::numeric, 0) <= 0 then
      raise exception 'Grupo "%" precisa de quantidade de amostras maior que zero.',
        g->>'identificacao' using errcode = '22023';
    end if;

    v_id := nullif(g->>'id', '')::bigint;

    if v_id is not null then
      update public.demanda_grupos_amostras
         set identificacao = btrim(g->>'identificacao'),
             tipo_matriz = nullif(btrim(coalesce(g->>'tipo_matriz', '')), ''),
             quantidade_amostras = (g->>'quantidade_amostras')::integer,
             unidade = coalesce(nullif(btrim(coalesce(g->>'unidade', '')), ''), 'amostras'),
             observacao = nullif(btrim(coalesce(g->>'observacao', '')), ''),
             ordem = v_ordem,
             updated_at = now()
       where id = v_id
         and demanda_id = p_demanda_id
      returning id into v_id;

      if v_id is null then
        raise exception 'Grupo % nao pertence a demanda %.', g->>'id', p_demanda_id
          using errcode = '23503';
      end if;
    else
      insert into public.demanda_grupos_amostras
        (demanda_id, identificacao, tipo_matriz, quantidade_amostras, unidade, observacao, ordem)
      values (
        p_demanda_id,
        btrim(g->>'identificacao'),
        nullif(btrim(coalesce(g->>'tipo_matriz', '')), ''),
        (g->>'quantidade_amostras')::integer,
        coalesce(nullif(btrim(coalesce(g->>'unidade', '')), ''), 'amostras'),
        nullif(btrim(coalesce(g->>'observacao', '')), ''),
        v_ordem
      )
      returning id into v_id;
    end if;

    v_preservados := v_preservados || v_id;
    if coalesce(g->>'chave', '') <> '' then
      v_chaves := jsonb_set(v_chaves, array[g->>'chave'], to_jsonb(v_id));
    end if;
  end loop;

  delete from public.demanda_grupos_amostras
   where demanda_id = p_demanda_id
     and not (id = any(v_preservados));

  return jsonb_build_object(
    'demanda_id', p_demanda_id,
    'grupos', coalesce(array_length(v_preservados, 1), 0),
    'chaves', v_chaves,
    'preservado', false
  );
end $$;

comment on function public.sincronizar_demanda_grupos(bigint, jsonb) is
  'Sincroniza os grupos de amostras de uma demanda. p_grupos NULL preserva os grupos existentes; ''[]'' remove todos. SECURITY INVOKER.';


-- salvar_demanda_com_grupos deixa de converter NULL em array vazio.
create or replace function public.salvar_demanda_com_grupos(
  p_demanda_id bigint,
  p_demanda jsonb,
  p_grupos jsonb,
  p_analises jsonb default null
) returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_id bigint;
  v_criada boolean := false;
  v_grupos jsonb;
  v_chaves jsonb;
  v_analises_gravadas integer := 0;
  a jsonb;
  v_grupo_id bigint;
begin
  if p_demanda is null or jsonb_typeof(p_demanda) is distinct from 'object' then
    raise exception 'p_demanda deve ser um objeto jsonb.' using errcode = '22023';
  end if;

  if p_demanda_id is null then
    insert into public.demandas_propostas (
      cliente_id, projeto_id, titulo, cliente_nome, cliente_cnpj, cliente_contato,
      instituicao, responsavel_interno, data_solicitacao, prazo_esperado,
      modalidade, status, origem, prioridade, descricao, escopo_preliminar,
      matriz_amostra, quantidade_amostras_estimada, prazo_tecnico_dias, observacoes,
      completude_snapshot, completude_atualizada_em
    )
    select
      (p_demanda->>'cliente_id')::bigint,
      (p_demanda->>'projeto_id')::bigint,
      coalesce(p_demanda->>'titulo', 'Nova demanda'),
      p_demanda->>'cliente_nome',
      p_demanda->>'cliente_cnpj',
      p_demanda->>'cliente_contato',
      p_demanda->>'instituicao',
      p_demanda->>'responsavel_interno',
      coalesce((p_demanda->>'data_solicitacao')::date, current_date),
      (p_demanda->>'prazo_esperado')::date,
      coalesce(p_demanda->>'modalidade', 'analises'),
      coalesce(p_demanda->>'status', 'nova'),
      p_demanda->>'origem',
      coalesce(p_demanda->>'prioridade', 'normal'),
      p_demanda->>'descricao',
      p_demanda->>'escopo_preliminar',
      p_demanda->>'matriz_amostra',
      (p_demanda->>'quantidade_amostras_estimada')::integer,
      (p_demanda->>'prazo_tecnico_dias')::integer,
      p_demanda->>'observacoes',
      coalesce(p_demanda->'completude_snapshot', '{}'::jsonb),
      coalesce((p_demanda->>'completude_atualizada_em')::timestamptz, now())
    returning id into v_id;
    v_criada := true;
  else
    v_id := p_demanda_id;
    update public.demandas_propostas set
      cliente_id                   = case when p_demanda ? 'cliente_id' then (p_demanda->>'cliente_id')::bigint else cliente_id end,
      projeto_id                   = case when p_demanda ? 'projeto_id' then (p_demanda->>'projeto_id')::bigint else projeto_id end,
      titulo                       = coalesce(nullif(p_demanda->>'titulo', ''), titulo),
      cliente_nome                 = case when p_demanda ? 'cliente_nome' then p_demanda->>'cliente_nome' else cliente_nome end,
      cliente_cnpj                 = case when p_demanda ? 'cliente_cnpj' then p_demanda->>'cliente_cnpj' else cliente_cnpj end,
      cliente_contato              = case when p_demanda ? 'cliente_contato' then p_demanda->>'cliente_contato' else cliente_contato end,
      instituicao                  = case when p_demanda ? 'instituicao' then p_demanda->>'instituicao' else instituicao end,
      responsavel_interno          = case when p_demanda ? 'responsavel_interno' then p_demanda->>'responsavel_interno' else responsavel_interno end,
      data_solicitacao             = coalesce((p_demanda->>'data_solicitacao')::date, data_solicitacao),
      prazo_esperado               = case when p_demanda ? 'prazo_esperado' then (p_demanda->>'prazo_esperado')::date else prazo_esperado end,
      modalidade                   = coalesce(nullif(p_demanda->>'modalidade', ''), modalidade),
      status                       = coalesce(nullif(p_demanda->>'status', ''), status),
      origem                       = case when p_demanda ? 'origem' then p_demanda->>'origem' else origem end,
      prioridade                   = coalesce(nullif(p_demanda->>'prioridade', ''), prioridade),
      descricao                    = case when p_demanda ? 'descricao' then p_demanda->>'descricao' else descricao end,
      escopo_preliminar            = case when p_demanda ? 'escopo_preliminar' then p_demanda->>'escopo_preliminar' else escopo_preliminar end,
      matriz_amostra               = case when p_demanda ? 'matriz_amostra' then p_demanda->>'matriz_amostra' else matriz_amostra end,
      quantidade_amostras_estimada = case when p_demanda ? 'quantidade_amostras_estimada' then (p_demanda->>'quantidade_amostras_estimada')::integer else quantidade_amostras_estimada end,
      prazo_tecnico_dias           = case when p_demanda ? 'prazo_tecnico_dias' then (p_demanda->>'prazo_tecnico_dias')::integer else prazo_tecnico_dias end,
      observacoes                  = case when p_demanda ? 'observacoes' then p_demanda->>'observacoes' else observacoes end,
      completude_snapshot          = coalesce(p_demanda->'completude_snapshot', completude_snapshot),
      completude_atualizada_em     = coalesce((p_demanda->>'completude_atualizada_em')::timestamptz, now())
    where id = v_id;

    if not found then
      raise exception 'Demanda % nao encontrada ou sem permissao de escrita.', v_id using errcode = 'P0002';
    end if;
  end if;

  -- NULL segue como NULL: preserva os grupos existentes.
  v_grupos := public.sincronizar_demanda_grupos(v_id, p_grupos);
  v_chaves := coalesce(v_grupos->'chaves', '{}'::jsonb);

  if p_analises is not null then
    if jsonb_typeof(p_analises) is distinct from 'array' then
      raise exception 'p_analises deve ser um array jsonb ou NULL.' using errcode = '22023';
    end if;

    delete from public.demanda_analises where demanda_id = v_id;

    for a in select * from jsonb_array_elements(p_analises) loop
      if coalesce(btrim(a->>'codigo_analise'), '') = '' then
        raise exception 'Item de analise sem codigo.' using errcode = '22023';
      end if;

      v_grupo_id := null;
      if coalesce(a->>'grupo_chave', '') <> '' then
        v_grupo_id := nullif(v_chaves->>(a->>'grupo_chave'), '')::bigint;
        if v_grupo_id is null then
          raise exception 'Analise % referencia o grupo "%", que nao existe nesta demanda.',
            a->>'codigo_analise', a->>'grupo_chave' using errcode = '23503';
        end if;
      end if;

      insert into public.demanda_analises
        (demanda_id, codigo_analise, quantidade_amostras, origem_quantidade, status_custeio, grupo_amostra_id)
      values (
        v_id,
        btrim(a->>'codigo_analise'),
        greatest(coalesce((a->>'quantidade_amostras')::integer, 1), 1),
        coalesce(nullif(a->>'origem_quantidade', ''), 'manual'),
        coalesce(nullif(a->>'status_custeio', ''), 'pendente'),
        v_grupo_id
      );
      v_analises_gravadas := v_analises_gravadas + 1;
    end loop;
  end if;

  return jsonb_build_object(
    'demanda_id', v_id,
    'criada', v_criada,
    'grupos', coalesce(v_grupos->'grupos', to_jsonb(0)),
    'grupos_preservados', coalesce(v_grupos->'preservado', to_jsonb(false)),
    'chaves', v_chaves,
    'analises', v_analises_gravadas
  );
end $$;
