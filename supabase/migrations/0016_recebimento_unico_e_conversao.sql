-- =====================================================================
-- Fase 2.4 — Recebimento único: o recebimento "normal" é sempre via item de
--   pedido de compra (receber_lote, motivo 'compra/recebimento'). A entrada
--   avulsa passa a ser uma ENTRADA DE INVENTÁRIO / AJUSTE explícita, com motivo
--   próprio na trilha — porta separada, não concorrente.
-- Fase 2.5 — Ponte de unidades: fator de conversão consumo↔estoque por insumo.
-- Migration aditiva e retrocompatível (coluna com default; função nova).
-- =====================================================================

-- ---- 2.5: fator de conversão -----------------------------------------
-- Quantas unidades de CONSUMO (quantidade_por_amostra) cabem em 1 unidade de
-- ESTOQUE (lote). Ex.: 1 frasco = 1000 µL → fator = 1000. Default 1 = sem
-- conversão (preserva exatamente o comportamento atual).
alter table insumos
  add column if not exists fator_conversao numeric not null default 1
    check (fator_conversao > 0);

comment on column insumos.fator_conversao is
  'Unidades de consumo por 1 unidade de estoque. demanda_estoque = demanda_consumo / fator_conversao.';

-- ---- 2.4: entrada de inventário / ajuste (avulsa, explícita) ----------
create or replace function entrada_inventario(
  p_insumo_id  bigint,
  p_quantidade numeric,
  p_validade   date    default null,
  p_custo      numeric default null,
  p_codigo     text    default null,
  p_fornecedor text    default null,
  p_motivo     text    default null
) returns bigint language plpgsql security definer set search_path = public as $$
declare v_lote bigint;
begin
  insert into lotes_estoque(insumo_id, codigo_lote, validade,
                            quantidade_inicial, quantidade_atual, custo_unitario, fornecedor)
  values (p_insumo_id, p_codigo, p_validade, p_quantidade, p_quantidade, p_custo, p_fornecedor)
  returning id into v_lote;

  insert into estoque_movimentacoes(insumo_id, tipo, quantidade, custo_unitario, motivo, lote_id)
  values (p_insumo_id, 'entrada', p_quantidade, p_custo,
          coalesce(nullif(btrim(p_motivo), ''), 'ajuste de inventário'), v_lote);

  return v_lote;
end $$;

grant execute on function entrada_inventario(bigint,numeric,date,numeric,text,text,text)
  to authenticated, service_role;
