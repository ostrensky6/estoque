-- =====================================================================
-- Recebimento: quantidade recebida e divergência operacional.
-- =====================================================================

alter table pedidos_compra_itens
  add column if not exists quantidade_recebida numeric,
  add column if not exists divergencia_recebimento text;

alter table pedidos_internos_itens
  add column if not exists quantidade_recebida numeric,
  add column if not exists divergencia_recebimento text;
