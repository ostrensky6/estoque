create or replace view v_previsao_suprimentos as
with cfg as (
  select coalesce((select valor::int from parametros where chave = 'janela_consumo_previsao_dias'), 90) as janela
),
consumo as (
  select
    m.insumo_id,
    sum(case when m.tipo = 'saida' then m.quantidade else 0 end) as consumo_janela
  from estoque_movimentacoes m
  cross join cfg
  where m.data >= current_date - cfg.janela
  group by m.insumo_id
),
abertos as (
  select
    pi.insumo_id,
    sum(pi.quantidade) filter (where p.status in ('solicitado','aprovado','enviado','em_transito') and pi.lote_id is null) as qtd_pedida_aberta
  from pedidos_compra_itens pi
  join pedidos_compra p on p.id = pi.pedido_id
  group by pi.insumo_id
),
prazos as (
  select
    i.id as insumo_id,
    coalesce(nullif(i.lead_time_dias, 0), f.prazo_medio_dias) as lead_time_efetivo,
    case
      when nullif(i.lead_time_dias, 0) is not null then 'insumo'
      when f.prazo_medio_dias is not null then 'fornecedor'
      else 'indefinido'
    end as lead_time_origem
  from insumos i
  left join fornecedores f on f.id = i.fornecedor_id
)
select
  s.insumo_id,
  s.especificacao,
  s.unidade,
  s.disponivel,
  s.em_maos,
  s.reservado,
  s.ponto_reposicao as ponto_reposicao_configurado,
  s.estoque_seguranca,
  coalesce(p.lead_time_efetivo, 0) as lead_time_dias,
  cfg.janela as janela_dias,
  coalesce(c.consumo_janela, 0) as consumo_janela,
  case when cfg.janela > 0 then coalesce(c.consumo_janela, 0) / cfg.janela else 0 end as consumo_medio_diario,
  case
    when coalesce(c.consumo_janela, 0) > 0
      then s.disponivel / (coalesce(c.consumo_janela, 0) / cfg.janela)
    else null
  end as dias_cobertura,
  greatest(
    s.ponto_reposicao,
    (case when cfg.janela > 0 then coalesce(c.consumo_janela, 0) / cfg.janela else 0 end)
      * coalesce(p.lead_time_efetivo, 0)
      + s.estoque_seguranca
  ) as ponto_reposicao_sugerido,
  greatest(
    0,
    (case when cfg.janela > 0 then coalesce(c.consumo_janela, 0) / cfg.janela else 0 end)
      * coalesce(p.lead_time_efetivo, 0)
      + s.estoque_seguranca
      - s.disponivel
  ) as qtd_sugerida_compra,
  coalesce(a.qtd_pedida_aberta, 0) as qtd_pedida_aberta,
  i.fornecedor_id,
  f.nome as fornecedor_nome,
  i.custo_unitario,
  i.categoria_compra,
  p.lead_time_origem
from v_estoque_saldo s
join insumos i on i.id = s.insumo_id
left join fornecedores f on f.id = i.fornecedor_id
left join prazos p on p.insumo_id = i.id
left join consumo c on c.insumo_id = s.insumo_id
left join abertos a on a.insumo_id = s.insumo_id
cross join cfg;

grant select on v_previsao_suprimentos to anon, authenticated, service_role;
