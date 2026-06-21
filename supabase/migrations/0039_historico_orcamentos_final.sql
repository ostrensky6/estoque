-- =====================================================================
-- Historico de orcamentos finais: vencimento, duplicacao e cancelamento.
-- Migration aditiva: preserva versoes emitidas, snapshots e auditoria.
-- =====================================================================

alter table orcamento_final_versoes
  add column if not exists duplicada_de_id bigint references orcamento_final_versoes(id) on delete set null,
  add column if not exists cancelado_em timestamptz,
  add column if not exists cancelado_motivo text;

alter table orcamento_final_versoes
  drop constraint if exists orcamento_final_versoes_status_check,
  add constraint orcamento_final_versoes_status_check
    check (status in ('emitido','substituido','cancelado','vencido'));

update orcamento_final_versoes
   set status = 'vencido'
 where status = 'emitido'
   and valido_ate is not null
   and valido_ate < current_date;

create index if not exists orcamento_final_versoes_validade_idx
  on orcamento_final_versoes (valido_ate, status);

create index if not exists orcamento_final_versoes_duplicada_de_idx
  on orcamento_final_versoes (duplicada_de_id);
