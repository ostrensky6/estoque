-- =====================================================================
-- Camada de custos de estoque.
-- Regra oficial: custo padrão (catálogo), custo médio ponderado (previsão)
-- e custo real por lote/movimentação (histórico realizado).
-- =====================================================================

create or replace view public.v_custo_estoque_vigente as
with lotes_liberados as (
  select
    l.insumo_id,
    l.quantidade_atual,
    l.custo_unitario
  from public.lotes_estoque l
  where l.quantidade_atual > 0
    and l.status in ('aceito', 'em_uso')
    and (
      public.menor_validade(l.validade, l.validade_apos_abertura) is null
      or public.menor_validade(l.validade, l.validade_apos_abertura) >= current_date
    )
), agregados as (
  select
    insumo_id,
    sum(quantidade_atual) as quantidade_liberada,
    sum(quantidade_atual * coalesce(custo_unitario, 0)) as valor_liberado,
    sum(quantidade_atual * coalesce(custo_unitario, 0)) / nullif(sum(quantidade_atual), 0) as custo_medio_ponderado
  from lotes_liberados
  group by insumo_id
)
select
  i.id as insumo_id,
  i.especificacao,
  i.unidade,
  i.custo_unitario as custo_padrao,
  coalesce(a.quantidade_liberada, 0) as quantidade_liberada,
  coalesce(a.valor_liberado, 0) as valor_liberado,
  a.custo_medio_ponderado,
  case
    when a.custo_medio_ponderado is null then null
    else a.custo_medio_ponderado - coalesce(i.custo_unitario, 0)
  end as divergencia_absoluta,
  case
    when a.custo_medio_ponderado is null or coalesce(i.custo_unitario, 0) = 0 then null
    else ((a.custo_medio_ponderado - i.custo_unitario) / i.custo_unitario) * 100
  end as divergencia_percentual,
  case
    when a.custo_medio_ponderado is null then 'sem_lote_liberado'
    when coalesce(i.custo_unitario, 0) = 0 then 'sem_custo_padrao'
    when abs(a.custo_medio_ponderado - i.custo_unitario) / i.custo_unitario >= 0.1 then 'divergente'
    else 'alinhado'
  end as situacao
from public.insumos i
left join agregados a on a.insumo_id = i.id;

create or replace view public.v_custo_real_consumo as
select
  m.id as movimentacao_id,
  m.data,
  m.insumo_id,
  i.especificacao,
  i.unidade,
  m.lote_id,
  m.quantidade,
  m.custo_unitario as custo_real_unitario,
  m.quantidade * coalesce(m.custo_unitario, 0) as custo_real_total,
  m.motivo,
  m.referencia
from public.estoque_movimentacoes m
join public.insumos i on i.id = m.insumo_id
where m.tipo = 'saida';

grant select on public.v_custo_estoque_vigente, public.v_custo_real_consumo
  to authenticated, service_role;
