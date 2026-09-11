-- =====================================================================
-- 0104 — Autorizacao e trilha do planejamento + persistencia dos grupos
--        de amostras da demanda.
--
-- Migration ADITIVA e idempotente. Nao remove tabelas, colunas nem dados.
--
-- Trata quatro achados da auditoria funcional:
--
--   P1  DELETE direto em planejamento apagava, por cascade, reservas de
--       insumo e de equipamento. Desfazer reserva e operacao de
--       coordenador (liberar_plano / cancelar_planejamento_operacional),
--       mas o DELETE estava liberado em papel_minimo('tecnico') e nao era
--       interceptado por nenhum gatilho.
--
--   P3  planejamento e planejamento_itens nao tinham trilha de auditoria,
--       entao a exclusao do plano nao deixava registro algum — apenas as
--       reservas filhas, que ja possuem gatilho.
--
--   P4  RETIRADO. A auditoria afirmou que 0081 deixara
--       equipamento_reservas gravavel diretamente. Verificacao posterior
--       mostrou que 0085 ja revogou insert/update/delete de authenticated
--       e ja substituiu a policy ampla por rls_read_equipamento_reservas.
--       Nao havia brecha: o privilegio de tabela e a policy sao portoes
--       independentes e o primeiro ja estava fechado. Esta migration nao
--       altera essa tabela.
--
--   C1  Os grupos de amostras digitados na demanda nao eram gravados em
--       lugar nenhum. demanda_grupos_amostras (0056) nunca recebia linha.
--
-- REGRA DE EXCLUSAO ADOTADA (sujeita a confirmacao do responsavel):
--   exclusao fisica de planejamento so e admissivel quando o plano esta
--   em 'rascunho' e nao possui reserva de insumo, reserva de equipamento,
--   conferencia de lote nem pedido interno vinculado. Nos demais casos o
--   caminho correto e cancelar_planejamento_operacional, que preserva
--   historico. Planos que hoje tenham vinculos deixam de ser excluiveis.
--
-- ---------------------------------------------------------------------
-- ROLLBACK (manual, documentado):
--   drop trigger if exists trg_bloquear_exclusao_direta_planejamento on public.planejamento;
--   drop function if exists public.bloquear_exclusao_direta_planejamento();
--   drop function if exists public.excluir_planejamento_rascunho(bigint);
--   drop function if exists public.sincronizar_demanda_grupos(bigint, jsonb);
--   drop trigger if exists aud_planejamento on public.planejamento;
--   drop trigger if exists aud_planejamento_itens on public.planejamento_itens;
-- =====================================================================


-- ---------------------------------------------------------------------
-- P3 — Trilha de auditoria do planejamento.
--
-- fn_auditoria usa (new|old).id::text como registro_id e e security
-- definer, portanto insere em auditoria mesmo com o INSERT revogado para
-- authenticated (0006). Ambas as tabelas possuem coluna id.
-- ---------------------------------------------------------------------
drop trigger if exists aud_planejamento on public.planejamento;
create trigger aud_planejamento
  after insert or update or delete on public.planejamento
  for each row execute function public.fn_auditoria();

drop trigger if exists aud_planejamento_itens on public.planejamento_itens;
create trigger aud_planejamento_itens
  after insert or update or delete on public.planejamento_itens
  for each row execute function public.fn_auditoria();


-- ---------------------------------------------------------------------
-- P1 — Exclusao de planejamento por RPC controlada.
-- ---------------------------------------------------------------------
create or replace function public.excluir_planejamento_rascunho(
  p_planejamento_id bigint
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_plano record;
  v_reservas integer := 0;
  v_equipamentos integer := 0;
  v_conferencias integer := 0;
  v_pedidos integer := 0;
  v_itens integer := 0;
begin
  perform public.fn_exige_papel('coordenador');

  select id, nome, status_operacional
    into v_plano
    from public.planejamento
   where id = p_planejamento_id
     for update;

  if not found then
    raise exception 'Planejamento % nao encontrado.', p_planejamento_id
      using errcode = 'P0002';
  end if;

  if v_plano.status_operacional is distinct from 'rascunho' then
    raise exception 'Somente planejamento em rascunho pode ser excluido. Status atual: %. Use o cancelamento operacional para preservar o historico.',
      v_plano.status_operacional
      using errcode = '22023';
  end if;

  select count(*) into v_reservas
    from public.reservas_estoque
   where planejamento_id = p_planejamento_id;

  select count(*) into v_equipamentos
    from public.equipamento_reservas
   where planejamento_id = p_planejamento_id;

  if to_regclass('public.planejamento_lote_conferencias') is not null then
    execute 'select count(*) from public.planejamento_lote_conferencias where planejamento_id = $1'
      into v_conferencias using p_planejamento_id;
  end if;

  select count(*) into v_pedidos
    from public.pedidos_internos
   where planejamento_id = p_planejamento_id;

  if v_reservas > 0 or v_equipamentos > 0 or v_conferencias > 0 or v_pedidos > 0 then
    raise exception 'Planejamento % possui vinculos e nao pode ser excluido fisicamente (reservas: %, equipamentos: %, conferencias: %, pedidos internos: %). Use o cancelamento operacional.',
      p_planejamento_id, v_reservas, v_equipamentos, v_conferencias, v_pedidos
      using errcode = '23503';
  end if;

  select count(*) into v_itens
    from public.planejamento_itens
   where planejamento_id = p_planejamento_id;

  perform set_config('app.planejamento_exclusao', 'permitida', true);
  delete from public.planejamento where id = p_planejamento_id;
  perform set_config('app.planejamento_exclusao', '', true);

  return jsonb_build_object(
    'planejamento_id', p_planejamento_id,
    'nome', v_plano.nome,
    'itens_removidos', v_itens
  );
end $$;

revoke execute on function public.excluir_planejamento_rascunho(bigint) from public, anon;
grant execute on function public.excluir_planejamento_rascunho(bigint) to authenticated, service_role;


-- Bloqueia DELETE direto. Segue o padrao de 0103: o marcador so vale
-- dentro da RPC controlada, cujo owner nao e papel de API.
create or replace function public.bloquear_exclusao_direta_planejamento()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if not public.fn_marcador_transacional_autorizado(array[
       'public.excluir_planejamento_rascunho(bigint)'::regprocedure
     ])
     or current_setting('app.planejamento_exclusao', true) is distinct from 'permitida' then
    raise exception 'Planejamento so pode ser excluido por excluir_planejamento_rascunho.'
      using errcode = '42501';
  end if;
  return old;
end $$;

drop trigger if exists trg_bloquear_exclusao_direta_planejamento on public.planejamento;
create trigger trg_bloquear_exclusao_direta_planejamento
  before delete on public.planejamento
  for each row execute function public.bloquear_exclusao_direta_planejamento();


-- P4 nao gera alteracao: 0085 ja fechou equipamento_reservas.


-- ---------------------------------------------------------------------
-- C1 — Persistencia atomica dos grupos de amostras da demanda.
--
-- Substitui o conjunto de grupos da demanda em uma unica transacao.
-- Grupos existentes que reaparecem por id sao atualizados; os ausentes
-- sao removidos; demanda_analises.grupo_amostra_id dos removidos volta a
-- null por conta do "on delete set null" de 0056.
-- ---------------------------------------------------------------------
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
  if p_grupos is null or jsonb_typeof(p_grupos) is distinct from 'array' then
    raise exception 'p_grupos deve ser um array jsonb.' using errcode = '22023';
  end if;

  perform 1 from public.demandas_propostas where id = p_demanda_id;
  if not found then
    raise exception 'Demanda % nao encontrada.', p_demanda_id using errcode = 'P0002';
  end if;

  for g in select * from jsonb_array_elements(p_grupos) loop
    v_ordem := v_ordem + 1;

    if coalesce(btrim(g->>'identificacao'), '') = '' then
      raise exception 'Grupo na posicao % esta sem identificacao.', v_ordem
        using errcode = '22023';
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
    'grupos', array_length(v_preservados, 1),
    'chaves', v_chaves
  );
end $$;

revoke execute on function public.sincronizar_demanda_grupos(bigint, jsonb) from public, anon;
grant execute on function public.sincronizar_demanda_grupos(bigint, jsonb) to authenticated, service_role;

comment on function public.sincronizar_demanda_grupos(bigint, jsonb) is
  'Substitui atomicamente os grupos de amostras de uma demanda. SECURITY INVOKER: a RLS de demanda_grupos_amostras (0075) continua valendo.';
