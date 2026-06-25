-- =====================================================================
-- Fase 11 — Endurecimento de RLS e permissões do módulo Orçamentos.
--
-- Migration ADITIVA e idempotente.
-- Substitui policies amplas "authenticated_all" por regras explícitas
-- baseadas em papel_minimo(...) nas tabelas do fluxo de orçamentos final.
--
-- Adicionalmente, endurece a RPC `emitir_orcamento_final_transacional`
-- inserindo a verificação de papel no banco de dados (fn_exige_papel)
-- e ajustando privilégios de execução.
--
-- ---------------------------------------------------------------------
-- ROLLBACK (manual, documentado):
--   Para reverter e voltar ao estado de acesso amplo para authenticated:
--
--   drop policy if exists rls_read_orcamento_final_versoes on orcamento_final_versoes;
--   ...
--   (Veja o histórico do repositório para os comandos drop policy/create policy originais)
-- =====================================================================

do $$
declare
  t text;
begin
  -- 1. Garantir RLS habilitado para todas as tabelas acessórias/finais do módulo
  foreach t in array array[
    'orcamento_final_versoes',
    'orcamento_parametros_aplicados',
    'demanda_analises',
    'demanda_grupos_amostras',
    'eventos_status',
    'orcamento_projeto_anexos',
    'orcamento_projeto_links'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security;', t);
    end if;
  end loop;
end $$;

-- 2. Remover as policies genéricas de acesso irrestrito
drop policy if exists authenticated_all_orcamento_final_versoes on public.orcamento_final_versoes;
drop policy if exists authenticated_all_orcamento_parametros_aplicados on public.orcamento_parametros_aplicados;
drop policy if exists authenticated_all_demanda_analises on public.demanda_analises;
drop policy if exists authenticated_all_demanda_grupos_amostras on public.demanda_grupos_amostras;
drop policy if exists authenticated_all_eventos_status on public.eventos_status;
drop policy if exists authenticated_all_orcamento_projeto_anexos on public.orcamento_projeto_anexos;
drop policy if exists authenticated_all_orcamento_projeto_links on public.orcamento_projeto_links;

-- =====================================================================
-- 3. Criar Políticas Restritivas baseadas em Papéis
-- =====================================================================

-- --- ORCAMENTO FINAL VERSOES ---
create policy rls_read_orcamento_final_versoes on public.orcamento_final_versoes
  for select to authenticated using (true);

create policy rls_coordenador_insert_orcamento_final_versoes on public.orcamento_final_versoes
  for insert to authenticated with check (papel_minimo('coordenador'));

create policy rls_coordenador_update_orcamento_final_versoes on public.orcamento_final_versoes
  for update to authenticated using (papel_minimo('coordenador')) with check (papel_minimo('coordenador'));

create policy rls_coordenador_delete_orcamento_final_versoes on public.orcamento_final_versoes
  for delete to authenticated using (papel_minimo('coordenador'));


-- --- ORCAMENTO PARAMETROS APLICADOS ---
create policy rls_read_orcamento_parametros_aplicados on public.orcamento_parametros_aplicados
  for select to authenticated using (true);

create policy rls_coordenador_insert_orcamento_parametros_aplicados on public.orcamento_parametros_aplicados
  for insert to authenticated with check (papel_minimo('coordenador'));

create policy rls_coordenador_update_orcamento_parametros_aplicados on public.orcamento_parametros_aplicados
  for update to authenticated using (papel_minimo('coordenador')) with check (papel_minimo('coordenador'));

create policy rls_coordenador_delete_orcamento_parametros_aplicados on public.orcamento_parametros_aplicados
  for delete to authenticated using (papel_minimo('coordenador'));


-- --- DEMANDA ANALISES ---
create policy rls_read_demanda_analises on public.demanda_analises
  for select to authenticated using (true);

create policy rls_tecnico_insert_demanda_analises on public.demanda_analises
  for insert to authenticated with check (papel_minimo('tecnico'));

create policy rls_tecnico_update_demanda_analises on public.demanda_analises
  for update to authenticated using (papel_minimo('tecnico')) with check (papel_minimo('tecnico'));

create policy rls_tecnico_delete_demanda_analises on public.demanda_analises
  for delete to authenticated using (papel_minimo('tecnico'));


-- --- DEMANDA GRUPOS AMOSTRAS ---
create policy rls_read_demanda_grupos_amostras on public.demanda_grupos_amostras
  for select to authenticated using (true);

create policy rls_tecnico_insert_demanda_grupos_amostras on public.demanda_grupos_amostras
  for insert to authenticated with check (papel_minimo('tecnico'));

create policy rls_tecnico_update_demanda_grupos_amostras on public.demanda_grupos_amostras
  for update to authenticated using (papel_minimo('tecnico')) with check (papel_minimo('tecnico'));

create policy rls_tecnico_delete_demanda_grupos_amostras on public.demanda_grupos_amostras
  for delete to authenticated using (papel_minimo('tecnico'));


-- --- EVENTOS STATUS (AUDITORIA) ---
create policy rls_read_eventos_status on public.eventos_status
  for select to authenticated using (true);

create policy rls_tecnico_insert_eventos_status on public.eventos_status
  for insert to authenticated with check (papel_minimo('tecnico'));


-- --- ORCAMENTO PROJETO ANEXOS ---
create policy rls_read_orcamento_projeto_anexos on public.orcamento_projeto_anexos
  for select to authenticated using (true);

create policy rls_tecnico_insert_orcamento_projeto_anexos on public.orcamento_projeto_anexos
  for insert to authenticated with check (papel_minimo('tecnico'));

create policy rls_tecnico_update_orcamento_projeto_anexos on public.orcamento_projeto_anexos
  for update to authenticated using (papel_minimo('tecnico')) with check (papel_minimo('tecnico'));

create policy rls_tecnico_delete_orcamento_projeto_anexos on public.orcamento_projeto_anexos
  for delete to authenticated using (papel_minimo('tecnico'));


-- --- ORCAMENTO PROJETO LINKS ---
create policy rls_read_orcamento_projeto_links on public.orcamento_projeto_links
  for select to authenticated using (true);

create policy rls_tecnico_insert_orcamento_projeto_links on public.orcamento_projeto_links
  for insert to authenticated with check (papel_minimo('tecnico'));

create policy rls_tecnico_update_orcamento_projeto_links on public.orcamento_projeto_links
  for update to authenticated using (papel_minimo('tecnico')) with check (papel_minimo('tecnico'));

create policy rls_tecnico_delete_orcamento_projeto_links on public.orcamento_projeto_links
  for delete to authenticated using (papel_minimo('tecnico'));


-- =====================================================================
-- 4. Re-declaração Endurecida da RPC de Emissão Final
-- =====================================================================

create or replace function emitir_orcamento_final_transacional(
  p_demanda_id              bigint,
  p_validade_dias           integer,
  p_total_laboratorio_custo numeric,
  p_total_laboratorio_preco numeric,
  p_total_projeto_custo     numeric,
  p_total_projeto_final     numeric,
  p_total_final             numeric,
  p_snapshot                jsonb,
  p_parametros              jsonb,   -- null quando não há parâmetros a gravar
  p_criado_por              uuid,
  p_usuario_email           text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status      text;
  v_versao      integer;
  v_numero      text;
  v_valido_ate  date;
  v_versao_id   bigint;
  v_de_status   text;
  v_lab_ativos  integer;
  v_proj_ativos integer;
begin
  -- EXIGÊNCIA DE SEGURANÇA: Exige papel de coordenador ou superior no nível de banco de dados
  perform fn_exige_papel('coordenador');

  -- 1. Lock da demanda + existência.
  select status into v_status
    from demandas_propostas
   where id = p_demanda_id
   for update;
  if not found then
    raise exception 'Demanda % nao encontrada.', p_demanda_id using errcode = 'no_data_found';
  end if;

  -- 2. Integridade: não emitir com duplicidade ativa inesperada.
  select count(*) into v_lab_ativos
    from orcamentos
   where demanda_id = p_demanda_id
     and coalesce(status, '') <> 'cancelado'
     and coalesce(status_operacional, '') <> 'cancelado';
  select count(*) into v_proj_ativos
    from orcamento_projetos
   where demanda_id = p_demanda_id
     and coalesce(status, '') <> 'cancelado';
  if v_lab_ativos > 1 or v_proj_ativos > 1 then
    raise exception 'Duplicidade ativa de modulos na demanda % (lab=%, projeto=%); saneamento necessario antes de emitir.',
      p_demanda_id, v_lab_ativos, v_proj_ativos using errcode = 'raise_exception';
  end if;

  -- 3. Próxima versão SOB LOCK (serializa emissões concorrentes da mesma demanda).
  select coalesce(max(versao), 0) + 1 into v_versao
    from orcamento_final_versoes
   where demanda_id = p_demanda_id;
  v_numero := 'OF-' || extract(year from now())::int || '-' || lpad(p_demanda_id::text, 4, '0') || '-v' || v_versao;
  v_valido_ate := current_date + (coalesce(p_validade_dias, 30))::int;

  -- de_status do evento = versão vigente anterior, se houver.
  select 'v' || versao into v_de_status
    from orcamento_final_versoes
   where demanda_id = p_demanda_id and status = 'emitido'
   order by versao desc
   limit 1;

  -- 4. Substitui a versão vigente anterior.
  update orcamento_final_versoes
     set status = 'substituido'
   where demanda_id = p_demanda_id and status = 'emitido';

  -- 5. Insere a nova versão.
  insert into orcamento_final_versoes (
    demanda_id, versao, numero, validade_dias, valido_ate,
    total_laboratorio_custo, total_laboratorio_preco, total_projeto_custo,
    total_projeto_final, total_final, snapshot, criado_por
  ) values (
    p_demanda_id, v_versao, v_numero, coalesce(p_validade_dias, 30), v_valido_ate,
    coalesce(p_total_laboratorio_custo, 0), coalesce(p_total_laboratorio_preco, 0),
    coalesce(p_total_projeto_custo, 0), coalesce(p_total_projeto_final, 0),
    coalesce(p_total_final, 0), coalesce(p_snapshot, '{}'::jsonb), p_criado_por
  ) returning id into v_versao_id;

  -- 6. Parâmetros aplicados (quando a engine produziu um snapshot válido).
  if p_parametros is not null and p_parametros <> 'null'::jsonb then
    insert into orcamento_parametros_aplicados (
      demanda_id, orcamento_laboratorial_id, orcamento_projeto_id, orcamento_final_versao_id, versao,
      metodo_calculo, laboratorio_modo, subtotal_laboratorio, subtotal_projeto, subtotal_custos,
      total_parametros, total_final, parametros_snapshot, formula_snapshot, alertas_snapshot, criado_por
    ) values (
      p_demanda_id,
      nullif(p_parametros->>'orcamento_laboratorial_id', '')::bigint,
      nullif(p_parametros->>'orcamento_projeto_id', '')::bigint,
      v_versao_id, v_versao,
      coalesce(p_parametros->>'metodo_calculo', 'GROSS_UP'),
      coalesce(p_parametros->>'laboratorio_modo', 'CUSTO_TECNICO'),
      coalesce((p_parametros->>'subtotal_laboratorio')::numeric, 0),
      coalesce((p_parametros->>'subtotal_projeto')::numeric, 0),
      coalesce((p_parametros->>'subtotal_custos')::numeric, 0),
      coalesce((p_parametros->>'total_parametros')::numeric, 0),
      coalesce((p_parametros->>'total_final')::numeric, 0),
      coalesce(p_parametros->'parametros_snapshot', '[]'::jsonb),
      coalesce(p_parametros->'formula_snapshot', '{}'::jsonb),
      coalesce(p_parametros->'alertas_snapshot', '[]'::jsonb),
      p_criado_por
    );
  end if;

  -- 7. Status da demanda → 'orcada' apenas a partir de nova/em_analise.
  if v_status in ('nova', 'em_analise') then
    update demandas_propostas set status = 'orcada' where id = p_demanda_id;
  end if;

  -- 8. Evento/auditoria DENTRO da transação.
  insert into eventos_status (entidade, entidade_id, de_status, para_status, usuario, observacao)
  values (
    'orcamento_final', p_demanda_id, v_de_status, 'v' || v_versao, p_usuario_email,
    'Orcamento final ' || v_numero || ' emitido para demanda #' || p_demanda_id || '.'
  );

  return jsonb_build_object('id', v_versao_id, 'numero', v_numero, 'versao', v_versao);
end
$$;

-- Revogar qualquer execução implícita de público/anon
revoke execute on function emitir_orcamento_final_transacional(
  bigint, integer, numeric, numeric, numeric, numeric, numeric, jsonb, jsonb, uuid, text
) from public, anon;

-- Conceder execução apenas para usuários autenticados e service role
grant execute on function emitir_orcamento_final_transacional(
  bigint, integer, numeric, numeric, numeric, numeric, numeric, jsonb, jsonb, uuid, text
) to authenticated, service_role;
