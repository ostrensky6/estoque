-- Fonte de custo dos insumos aplicada a cada orçamento laboratorial.
-- Mantém o padrão histórico para documentos existentes e permite que a
-- simulação operacional use o custo médio ponderado de lotes liberados.
-- Não recalcula nem altera versões finais já emitidas.

alter table public.orcamentos
  add column if not exists fonte_custo_insumos text not null default 'custo_padrao';

alter table public.orcamentos
  drop constraint if exists orcamentos_fonte_custo_insumos_check;

alter table public.orcamentos
  add constraint orcamentos_fonte_custo_insumos_check
  check (fonte_custo_insumos in ('custo_padrao', 'custo_medio_ponderado'));

comment on column public.orcamentos.fonte_custo_insumos is
  'Base dos insumos do orçamento: custo padrão cadastrado ou média ponderada dos lotes liberados no momento do recálculo.';
