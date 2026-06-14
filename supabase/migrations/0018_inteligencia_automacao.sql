-- =====================================================================
-- Fase 4 — Inteligencia & automacao
-- 4.1 previsao de suprimentos, 4.2 reposicao automatica, 4.3 notificacoes
-- in-app e 4.4 dashboard executivo. Tudo aditivo e idempotente.
-- =====================================================================

insert into parametros (chave, valor, unidade, descricao)
values
  ('janela_consumo_previsao_dias', 90, 'dias', 'Janela historica para consumo medio diario de insumos'),
  ('janela_dashboard_vencimento_dias', 60, 'dias', 'Horizonte de vencimentos exibido no dashboard executivo')
on conflict (chave) do nothing;

create table if not exists notificacoes (
  id bigint generated always as identity primary key,
  tipo text not null check (tipo in ('reposicao','vencimento','falta_plano','aprovacao_pendente','sistema')),
  titulo text not null,
  corpo text,
  entidade_tipo text,
  entidade_id bigint,
  papel_destino text,
  usuario_destino uuid,
  status text not null default 'nao_lida' check (status in ('nao_lida','lida','arquivada')),
  canal text not null default 'in_app' check (canal in ('in_app','email')),
  dedupe_key text,
  criado_em timestamptz not null default now(),
  lida_em timestamptz
);

create unique index if not exists notificacoes_dedupe_key_uidx
  on notificacoes (dedupe_key)
  where dedupe_key is not null;
create index if not exists notificacoes_status_idx on notificacoes (status, criado_em desc);
create index if not exists notificacoes_entidade_idx on notificacoes (entidade_tipo, entidade_id);

alter table notificacoes enable row level security;
drop policy if exists authenticated_all_notificacoes on notificacoes;
create policy authenticated_all_notificacoes on notificacoes
  for all to authenticated using (true) with check (true);

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
  coalesce(s.lead_time_dias, i.lead_time_dias, f.prazo_medio_dias, i.prazo_entrega_max_dias, 0) as lead_time_dias,
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
      * coalesce(s.lead_time_dias, i.lead_time_dias, f.prazo_medio_dias, i.prazo_entrega_max_dias, 0)
      + s.estoque_seguranca
  ) as ponto_reposicao_sugerido,
  greatest(
    0,
    (case when cfg.janela > 0 then coalesce(c.consumo_janela, 0) / cfg.janela else 0 end)
      * coalesce(s.lead_time_dias, i.lead_time_dias, f.prazo_medio_dias, i.prazo_entrega_max_dias, 0)
      + s.estoque_seguranca
      - s.disponivel
  ) as qtd_sugerida_compra,
  coalesce(a.qtd_pedida_aberta, 0) as qtd_pedida_aberta,
  i.fornecedor_id,
  f.nome as fornecedor_nome,
  i.custo_unitario,
  i.categoria_compra
from v_estoque_saldo s
join insumos i on i.id = s.insumo_id
left join fornecedores f on f.id = i.fornecedor_id
left join consumo c on c.insumo_id = s.insumo_id
left join abertos a on a.insumo_id = s.insumo_id
cross join cfg;

create or replace view v_dashboard_executivo as
with horizonte as (
  select coalesce((select valor::int from parametros where chave = 'janela_dashboard_vencimento_dias'), 60) as dias
),
estoque as (
  select
    coalesce(sum(l.quantidade_atual * coalesce(l.custo_unitario, i.custo_unitario, 0))
      filter (where l.status in ('aceito','em_uso') and (l.validade is null or l.validade >= current_date)), 0) as valor_estoque_ativo,
    coalesce(sum(l.quantidade_atual * coalesce(l.custo_unitario, i.custo_unitario, 0))
      filter (where l.status in ('aceito','em_uso') and l.validade is not null and l.validade <= current_date + horizonte.dias), 0) as valor_vencendo_horizonte,
    count(*) filter (where l.status in ('aceito','em_uso') and l.validade is not null and l.validade <= current_date + horizonte.dias and l.quantidade_atual > 0) as lotes_vencendo_horizonte
  from lotes_estoque l
  join insumos i on i.id = l.insumo_id
  cross join horizonte
),
orc as (
  select
    count(*) filter (where o.status = 'rascunho') as orcamentos_rascunho,
    count(*) filter (where o.status = 'enviado') as orcamentos_enviados,
    count(*) filter (where o.status = 'aprovado') as orcamentos_aprovados,
    count(*) filter (where o.status = 'recusado') as orcamentos_perdidos,
    coalesce(
      avg((tot.preco - tot.custo) / nullif(tot.preco, 0)) filter (where tot.preco > 0),
      0
    ) * 100 as margem_media_pct
  from orcamentos o
  left join (
    select
      orcamento_id,
      sum(n_amostras * preco_unitario) as preco,
      sum(n_amostras * custo_unitario) as custo
    from orcamento_itens
    group by orcamento_id
  ) tot on tot.orcamento_id = o.id
),
compras as (
  select coalesce(sum(pi.quantidade * coalesce(pi.custo_unitario_estimado, i.custo_unitario, 0)), 0) as compras_abertas_valor
  from pedidos_compra p
  join pedidos_compra_itens pi on pi.pedido_id = p.id
  join insumos i on i.id = pi.insumo_id
  where p.status in ('solicitado','aprovado','enviado','em_transito')
),
projetos_mes as (
  select
    date_trunc('month', p.data_solicitacao)::date as mes,
    coalesce(pr.nome, p.projeto, 'Sem projeto') as projeto,
    sum(pi.quantidade * coalesce(pi.custo_unitario_estimado, i.custo_unitario, 0)) as gasto
  from pedidos_compra p
  join pedidos_compra_itens pi on pi.pedido_id = p.id
  join insumos i on i.id = pi.insumo_id
  left join projetos pr on pr.id = p.projeto_id
  where p.data_solicitacao >= date_trunc('month', current_date) - interval '5 months'
  group by 1, 2
)
select
  estoque.valor_estoque_ativo,
  estoque.valor_vencendo_horizonte,
  estoque.lotes_vencendo_horizonte,
  orc.orcamentos_rascunho,
  orc.orcamentos_enviados,
  orc.orcamentos_aprovados,
  orc.orcamentos_perdidos,
  orc.margem_media_pct,
  compras.compras_abertas_valor,
  coalesce((select jsonb_agg(jsonb_build_object('mes', mes, 'projeto', projeto, 'gasto', gasto) order by mes, projeto) from projetos_mes), '[]'::jsonb) as gasto_por_projeto_mes
from estoque, orc, compras;

create or replace function gerar_reposicao_automatica()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_pedido_id bigint;
  v_criados int := 0;
  v_itens int := 0;
begin
  for r in
    select *
    from v_previsao_suprimentos
    where qtd_sugerida_compra > 0
      and qtd_pedida_aberta <= 0
      and disponivel <= ponto_reposicao_sugerido
    order by fornecedor_id nulls last, categoria_compra, especificacao
  loop
    select p.id into v_pedido_id
    from pedidos_compra p
    where p.status = 'solicitado'
      and p.fornecedor_id is not distinct from r.fornecedor_id
      and p.observacao = 'Rascunho automatico de reposicao'
    order by p.id desc
    limit 1;

    if v_pedido_id is null then
      insert into pedidos_compra(fornecedor_id, status, solicitante, observacao)
      values (r.fornecedor_id, 'solicitado', 'automacao', 'Rascunho automatico de reposicao')
      returning id into v_pedido_id;
      v_criados := v_criados + 1;
    end if;

    insert into pedidos_compra_itens(pedido_id, insumo_id, quantidade, custo_unitario_estimado)
    values (v_pedido_id, r.insumo_id, r.qtd_sugerida_compra, r.custo_unitario);
    v_itens := v_itens + 1;

    insert into notificacoes(tipo, titulo, corpo, entidade_tipo, entidade_id, papel_destino, dedupe_key)
    values (
      'reposicao',
      'Reposicao sugerida',
      r.especificacao || ' esta abaixo do ponto sugerido. Rascunho de compra #' || v_pedido_id || ' criado.',
      'pedido_compra',
      v_pedido_id,
      'coordenador',
      'reposicao:' || r.insumo_id || ':' || current_date
    )
    on conflict (dedupe_key) do nothing;

    v_pedido_id := null;
  end loop;

  insert into notificacoes(tipo, titulo, corpo, papel_destino, dedupe_key)
  select
    'vencimento',
    'Lotes vencendo',
    count(*) || ' lote(s) aceitos entram no horizonte de vencimento.',
    'gestor',
    'vencimentos:' || current_date
  from v_alertas_estoque
  where tipo in ('vencimento','vencido')
  having count(*) > 0
  on conflict (dedupe_key) do nothing;

  return jsonb_build_object('pedidos_criados', v_criados, 'itens_criados', v_itens);
end $$;

grant select on v_previsao_suprimentos to authenticated, anon, service_role;
grant select on v_dashboard_executivo to authenticated, anon, service_role;
grant all on notificacoes to authenticated, service_role;
grant usage, select on sequence notificacoes_id_seq to authenticated, service_role;
grant execute on function gerar_reposicao_automatica() to authenticated, service_role;
