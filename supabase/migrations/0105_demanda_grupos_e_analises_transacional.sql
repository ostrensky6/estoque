-- =====================================================================
-- 0105 — Demanda, grupos de amostras e associações análise↔grupo em uma
--        única transação (C1).
--
-- Migration ADITIVA. Não remove tabelas, colunas nem dados.
--
-- 0104 tornou atômico apenas o conjunto de grupos. A criação/edição da
-- demanda continuava em chamada separada: se a segunda falhasse, a
-- demanda existia sem grupos. Esta função fecha a operação inteira.
--
-- Preservação de histórico: p_analises NULL significa "não mexer em
-- demanda_analises". Nenhuma associação análise↔grupo é inventada para
-- linhas já existentes — grupo_amostra_id só é preenchido quando o
-- chamador informa explicitamente a que grupo a análise pertence.
--
-- ---------------------------------------------------------------------
-- ROLLBACK (manual, documentado):
--   drop function if exists public.salvar_demanda_com_grupos(bigint, jsonb, jsonb, jsonb);
-- =====================================================================

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

  -- ---- 1. Demanda -------------------------------------------------
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
      -- data_solicitacao é NOT NULL com default CURRENT_DATE
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
    -- Só sobrescreve a coluna quando a chave vem no payload. Chave ausente
    -- preserva o valor atual; isso evita que um formulário parcial apague
    -- campos que ele nem exibe, e respeita as colunas NOT NULL.
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
      raise exception 'Demanda % nao encontrada ou sem permissao de escrita.', v_id
        using errcode = 'P0002';
    end if;
  end if;

  -- ---- 2. Grupos (reaproveita a função de 0104) --------------------
  v_grupos := public.sincronizar_demanda_grupos(v_id, coalesce(p_grupos, '[]'::jsonb));
  v_chaves := coalesce(v_grupos->'chaves', '{}'::jsonb);

  -- ---- 3. Associações análise↔grupo --------------------------------
  -- p_analises NULL preserva demanda_analises como está.
  if p_analises is not null then
    if jsonb_typeof(p_analises) is distinct from 'array' then
      raise exception 'p_analises deve ser um array jsonb ou NULL.' using errcode = '22023';
    end if;

    delete from public.demanda_analises where demanda_id = v_id;

    for a in select * from jsonb_array_elements(p_analises) loop
      if coalesce(btrim(a->>'codigo_analise'), '') = '' then
        raise exception 'Item de analise sem codigo.' using errcode = '22023';
      end if;

      -- só associa quando o chamador informou a chave do grupo e ela foi
      -- resolvida nesta mesma transação; caso contrário fica null.
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
    'chaves', v_chaves,
    'analises', v_analises_gravadas
  );
end $$;

revoke execute on function public.salvar_demanda_com_grupos(bigint, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.salvar_demanda_com_grupos(bigint, jsonb, jsonb, jsonb) to authenticated, service_role;

comment on function public.salvar_demanda_com_grupos(bigint, jsonb, jsonb, jsonb) is
  'Grava demanda, grupos de amostras e associacoes analise-grupo em uma unica transacao. SECURITY INVOKER: a RLS de cada tabela continua valendo. p_analises NULL preserva demanda_analises.';
