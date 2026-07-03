-- =====================================================================
-- Emissão TRANSACIONAL da proposta final (Fase 9).
--
-- Migration ADITIVA: cria APENAS a função RPC `emitir_orcamento_final_transacional`.
-- NÃO altera dados existentes, NÃO limpa dados, NÃO aplica constraints
-- dependentes de deduplicação, NÃO recalcula históricos.
--
-- Estratégia híbrida (DEC-ORC-001): o cálculo econômico e as validações ocorrem
-- em TypeScript (engine autoritativa `engine-economica.ts`); esta RPC recebe o
-- payload JÁ calculado/validado e faz somente a PERSISTÊNCIA ATÔMICA, em uma
-- única transação PostgreSQL, com lock por demanda (FOR UPDATE).
--
-- A transação:
--   1. bloqueia a demanda (FOR UPDATE) e confere existência;
--   2. confere ausência de duplicidade ATIVA de módulos (integridade);
--   3. calcula a próxima versão SOB LOCK;
--   4. marca a versão vigente anterior como 'substituido';
--   5. insere a nova versão final;
--   6. insere os parâmetros aplicados (se houver);
--   7. atualiza a demanda para 'orcada' (apenas de nova/em_analise);
--   8. registra o evento de auditoria em eventos_status;
--   9. retorna { id, numero, versao }.
-- Qualquer falha aborta TUDO (nada fica parcialmente gravado).
--
-- ORDEM DE ROLLOUT: aplicar esta migration ANTES de implantar o código novo da
-- action `emitirOrcamentoFinalDaDemanda` (que chama esta RPC). Sem a função, a
-- emissão nova falharia.
--
-- ---------------------------------------------------------------------
-- ROLLBACK (manual, documentado — sem arquivo `down` por convenção do repo):
--   drop function if exists emitir_orcamento_final_transacional(
--     bigint, integer, numeric, numeric, numeric, numeric, numeric,
--     jsonb, jsonb, uuid, text);
--   (Remover a função NÃO apaga nenhuma versão/proposta já emitida.)
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

grant execute on function emitir_orcamento_final_transacional(
  bigint, integer, numeric, numeric, numeric, numeric, numeric, jsonb, jsonb, uuid, text
) to authenticated;
