-- Concilia o orçamento laboratorial com as baixas reais de insumos do plano.
-- A margem realizada abaixo é deliberadamente marcada como parcial: mão de
-- obra, equipamentos e overhead não são baixados por lote neste modelo.

create or replace view public.v_margem_real_planejamento as
select
  p.id as planejamento_id,
  p.orcamento_id,
  coalesce(orc.custo_orcado, 0) as custo_orcado,
  coalesce(orc.receita_orcada, 0) as receita_orcada,
  coalesce(consumo.custo_real_insumos, 0) as custo_real_insumos,
  coalesce(consumo.quantidade_movimentacoes, 0) as quantidade_movimentacoes,
  coalesce(orc.receita_orcada, 0) - coalesce(orc.custo_orcado, 0) as margem_prevista,
  coalesce(orc.receita_orcada, 0) - coalesce(consumo.custo_real_insumos, 0) as margem_real_parcial,
  case
    when coalesce(orc.receita_orcada, 0) > 0
      then ((coalesce(orc.receita_orcada, 0) - coalesce(consumo.custo_real_insumos, 0))
        / orc.receita_orcada) * 100
    else null
  end as margem_real_parcial_percentual
from public.planejamento p
left join lateral (
  select
    sum(oi.custo_unitario * oi.n_amostras) as custo_orcado,
    sum(oi.preco_unitario * oi.n_amostras) as receita_orcada
  from public.orcamento_itens oi
  where oi.orcamento_id = p.orcamento_id
) orc on true
left join lateral (
  select
    sum(m.quantidade * coalesce(m.custo_unitario, 0)) as custo_real_insumos,
    count(*)::bigint as quantidade_movimentacoes
  from public.estoque_movimentacoes m
  where m.tipo = 'saida'
    and m.referencia = 'plano ' || p.id::text
) consumo on true
where p.orcamento_id is not null;

comment on view public.v_margem_real_planejamento is
  'Confronta receita e custo orçados com o custo real de insumos baixados por plano. A margem real é parcial até que custos de pessoal, equipamento e overhead tenham apontamento operacional.';

grant select on public.v_margem_real_planejamento to authenticated, service_role;
