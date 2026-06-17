-- =====================================================================
-- Recebimento por ITEM do pedido interno. Cada item pode ser marcado como
-- recebido individualmente; ao receber, gera-se um lote em estoque para o
-- insumo correspondente (lote_id). A "Etapa 11 — Compra recebida" do pedido
-- passa a ser derivada: o pedido está recebido quando todos os seus itens
-- estão recebidos.
-- Migration aditiva, sem remoção de dados.
-- =====================================================================

alter table pedidos_internos_itens
  add column if not exists recebido_em  timestamptz,
  add column if not exists recebido_por text,
  add column if not exists lote_id      bigint references lotes_estoque(id) on delete set null;

create index if not exists pedidos_internos_itens_recebido_idx
  on pedidos_internos_itens(recebido_em);
