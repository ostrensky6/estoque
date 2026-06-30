-- Normalizacao cadastral de materiais/insumos.
-- Separa o tipo tecnico generico, usado para calculo e analise, do item
-- especifico/SKU, usado para compra, estoque, lote e rastreabilidade.

create table if not exists tipo_insumos (
  id bigint generated always as identity primary key,
  nome text not null unique,
  classe text not null default 'insumo'
    check (classe in ('reagente','consumivel','material','equipamento_consumivel','servico','insumo')),
  unidade_referencia text,
  finalidade text,
  observacoes text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

comment on table tipo_insumos is
  'Tipos tecnicos genericos para calculo, analise e padronizacao cadastral. Itens especificos/SKUs permanecem em insumos.';
comment on column tipo_insumos.nome is
  'Nome tecnico normalizado, ex.: Alcool etilico 70%, Ponteira 200 uL, Kit Illumina.';
comment on column tipo_insumos.classe is
  'Classificacao conceitual do tipo: reagente, consumivel, material, equipamento_consumivel, servico ou insumo.';
comment on column tipo_insumos.unidade_referencia is
  'Unidade preferencial para analise de consumo deste tipo tecnico.';

alter table tipo_insumos enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'tipo_insumos'
       and policyname = 'authenticated_all_tipo_insumos'
  ) then
    create policy authenticated_all_tipo_insumos on tipo_insumos
      for all to authenticated using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'tipo_insumos'
       and policyname = 'anon_read_tipo_insumos'
  ) then
    create policy anon_read_tipo_insumos on tipo_insumos
      for select to anon using (true);
  end if;
end $$;

alter table insumos
  add column if not exists tipo_insumo_id bigint references tipo_insumos(id) on delete set null;

comment on column insumos.tipo_insumo_id is
  'Tipo tecnico generico usado para calculo, analise e padronizacao. O registro em insumos continua sendo o item especifico/SKU operacional.';
comment on column insumos.nome_item is
  'Categoria curta legada. Preferir tipo_insumo_id para normalizacao tecnica.';

insert into tipo_insumos (nome, classe, unidade_referencia)
select distinct btrim(nome_item), 'insumo', max(unidade)
from insumos
where nullif(btrim(coalesce(nome_item, '')), '') is not null
group by btrim(nome_item)
on conflict (nome) do nothing;

update insumos i
   set tipo_insumo_id = t.id
  from tipo_insumos t
 where i.tipo_insumo_id is null
   and nullif(btrim(coalesce(i.nome_item, '')), '') is not null
   and t.nome = btrim(i.nome_item);

create index if not exists idx_insumos_tipo_insumo_id on insumos (tipo_insumo_id);
create index if not exists idx_tipo_insumos_classe on tipo_insumos (classe);

drop view if exists v_previsao_suprimentos;
drop view if exists v_alertas_estoque;
drop view if exists v_estoque_saldo_tipo;
drop view if exists v_estoque_saldo;

create view v_estoque_saldo as
select
  i.id as insumo_id,
  i.tipo_insumo_id,
  ti.nome as tipo_insumo,
  ti.classe as classe_tipo_insumo,
  i.nome_item,
  i.especificacao,
  i.unidade,
  coalesce(sum(l.quantidade_atual) filter (where l.status in ('aceito','em_uso')), 0)            as em_maos,
  coalesce(sum(l.quantidade_atual) filter (where l.status = 'quarentena'), 0)                    as em_quarentena,
  coalesce(sum(l.quantidade_atual) filter (where l.status = 'bloqueado'), 0)                     as bloqueado,
  coalesce(sum(l.quantidade_atual) filter (where l.status in ('aceito','em_uso')
            and menor_validade(l.validade, l.validade_apos_abertura) < current_date), 0)        as vencido,
  (select coalesce(sum(r.quantidade), 0) from reservas_estoque r
     where r.insumo_id = i.id and r.status = 'reservado')                                        as reservado,
  coalesce(sum(l.quantidade_atual) filter (where l.status in ('aceito','em_uso')
            and (menor_validade(l.validade, l.validade_apos_abertura) is null
                 or menor_validade(l.validade, l.validade_apos_abertura) >= current_date)), 0)
    - (select coalesce(sum(r.quantidade), 0) from reservas_estoque r
         where r.insumo_id = i.id and r.status = 'reservado')                                    as disponivel,
  i.ponto_reposicao,
  i.estoque_seguranca,
  i.lead_time_dias,
  i.categoria_compra
from insumos i
left join tipo_insumos ti on ti.id = i.tipo_insumo_id
left join lotes_estoque l on l.insumo_id = i.id
group by i.id, ti.id;

create view v_estoque_saldo_tipo as
select
  tipo_insumo_id,
  coalesce(tipo_insumo, nome_item, 'Sem tipo tecnico') as tipo_insumo,
  classe_tipo_insumo,
  unidade,
  count(*) as itens_especificos,
  sum(em_maos) as em_maos,
  sum(em_quarentena) as em_quarentena,
  sum(bloqueado) as bloqueado,
  sum(vencido) as vencido,
  sum(reservado) as reservado,
  sum(disponivel) as disponivel,
  sum(ponto_reposicao) as ponto_reposicao_total
from v_estoque_saldo
group by tipo_insumo_id, coalesce(tipo_insumo, nome_item, 'Sem tipo tecnico'), classe_tipo_insumo, unidade;

create view v_alertas_estoque as
select 'reposicao'::text as tipo, s.insumo_id, s.especificacao,
       null::date as validade, s.disponivel as valor, s.ponto_reposicao as referencia
from v_estoque_saldo s
where s.ponto_reposicao > 0 and s.disponivel <= s.ponto_reposicao
union all
select 'quarentena', s.insumo_id, s.especificacao, null, s.em_quarentena, null
from v_estoque_saldo s
where s.em_quarentena > 0
union all
select 'sem_validade', l.insumo_id, i.especificacao, null, l.quantidade_atual, null
from lotes_estoque l
join insumos i on i.id = l.insumo_id
where l.quantidade_atual > 0
  and l.status in ('aceito','em_uso')
  and l.validade is null
  and i.categoria_compra = 'critico'
union all
select case when menor_validade(l.validade, l.validade_apos_abertura) < current_date then 'vencido' else 'vencimento' end,
       l.insumo_id, i.especificacao, menor_validade(l.validade, l.validade_apos_abertura), l.quantidade_atual, null
from lotes_estoque l
join insumos i on i.id = l.insumo_id
where l.quantidade_atual > 0
  and l.status in ('aceito','em_uso')
  and menor_validade(l.validade, l.validade_apos_abertura) is not null
  and menor_validade(l.validade, l.validade_apos_abertura) <= current_date
      + ((select valor from parametros where chave = 'janela_vencimento_dias')::int);

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

do $$
begin
  if exists (select 1 from pg_proc where proname = 'fn_auditoria')
     and not exists (
       select 1 from pg_trigger
        where tgname = 'aud_tipo_insumos'
     ) then
    create trigger aud_tipo_insumos
      after insert or update or delete on tipo_insumos
      for each row execute function fn_auditoria();
  end if;
end $$;

grant all on tipo_insumos to authenticated, service_role;
grant select on tipo_insumos to anon;
grant select on v_estoque_saldo, v_estoque_saldo_tipo, v_alertas_estoque, v_previsao_suprimentos to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
