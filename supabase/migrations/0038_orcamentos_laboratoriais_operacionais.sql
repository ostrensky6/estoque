-- =====================================================================
-- Status operacional e snapshot de custos laboratoriais.
-- Migration aditiva: preserva documentos, itens, auditoria e RLS existentes.
-- =====================================================================

alter table orcamentos
  add column if not exists status_operacional text not null default 'pendente',
  add column if not exists status_operacional_atualizado_em timestamptz,
  add column if not exists custo_snapshot jsonb not null default '{}'::jsonb;

alter table orcamentos
  drop constraint if exists orcamentos_status_operacional_check,
  add constraint orcamentos_status_operacional_check
    check (status_operacional in ('pendente','preenchido','revisado','cancelado'));

update orcamentos o
   set status_operacional = case
       when o.status = 'cancelado' then 'cancelado'
       when o.status in ('enviado','aprovado') then 'revisado'
       when exists (select 1 from orcamento_itens i where i.orcamento_id = o.id) then 'preenchido'
       else 'pendente'
     end,
       status_operacional_atualizado_em = coalesce(status_operacional_atualizado_em, now())
 where status_operacional_atualizado_em is null
    or status_operacional = 'pendente';

create index if not exists idx_orcamentos_status_operacional
  on orcamentos (status_operacional, status_operacional_atualizado_em desc);
