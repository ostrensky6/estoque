-- =====================================================================
-- Etapa 11 "Compra recebida": marca paralela de recebimento físico do
-- produto/serviço contratado. É independente do fluxo de pagamento/NF —
-- pode ser registrada a qualquer momento após a aprovação da compra.
-- Migration aditiva, sem remoção de dados.
-- =====================================================================

alter table pedidos_internos
  add column if not exists recebido_em  timestamptz,
  add column if not exists recebido_por text;
