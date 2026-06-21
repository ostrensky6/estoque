-- =====================================================================
-- Cancelamento persistido de orcamentos.
--
-- Migration aditiva: amplia os checks de status para aceitar `cancelado`.
-- Nao remove dados, nao altera historico e preserva auditoria existente.
-- Rollback seguro: antes de remover `cancelado` do check, converter ou exportar
-- registros nesse status.
-- =====================================================================

alter table orcamentos
  drop constraint if exists orcamentos_status_check;

alter table orcamentos
  add constraint orcamentos_status_check
  check (status in ('rascunho','enviado','aprovado','recusado','cancelado'));

alter table orcamento_projetos
  drop constraint if exists orcamento_projetos_status_check;

alter table orcamento_projetos
  add constraint orcamento_projetos_status_check
  check (status in ('rascunho','enviado','aprovado','recusado','cancelado'));
