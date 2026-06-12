-- =====================================================================
-- Módulo de Estoque: lotes (FEFO), reservas, saldo, alertas e RPCs.
-- Ciclo: demanda -> reserva -> baixa (FEFO) -> reposição.
-- Decisões: rastreio por lote/validade; lógica em funções Postgres
-- (atômicas); plano sem estoque é permitido + alertado; janela de
-- vencimento parametrizável (120 dias por padrão).
-- =====================================================================

insert into parametros (chave, valor, unidade, descricao)
values ('janela_vencimento_dias', 120, 'dias', 'Antecedência do alerta de vencimento de lote')
on conflict (chave) do nothing;

-- política de estoque por reagente
alter table insumos
  add column ponto_reposicao   numeric not null default 0,
  add column estoque_seguranca numeric not null default 0,
  add column lead_time_dias    int;

-- substitui o saldo simples do 0001 (que somava movimentações) e o config
drop view  if exists v_estoque_saldo;
drop table if exists estoque_config;

-- ---- lotes (cada recebimento físico, com validade e custo) ----------
create table lotes_estoque (
  id                 bigint generated always as identity primary key,
  insumo_id          bigint not null references insumos(id) on delete cascade,
  codigo_lote        text,
  validade           date,
  quantidade_inicial numeric not null,
  quantidade_atual   numeric not null,
  custo_unitario     numeric,
  fornecedor         text,
  data_entrada       date not null default current_date,
  criado_em          timestamptz not null default now()
);
create index on lotes_estoque (insumo_id);
create index on lotes_estoque (validade);

-- movimentações passam a referenciar o lote consumido/abastecido
alter table estoque_movimentacoes
  add column lote_id bigint references lotes_estoque(id) on delete set null;

-- ---- reservas (compromisso de um plano com um insumo) ---------------
create table reservas_estoque (
  id              bigint generated always as identity primary key,
  planejamento_id bigint references planejamento(id) on delete cascade,
  insumo_id       bigint not null references insumos(id) on delete cascade,
  quantidade      numeric not null,
  status          text not null default 'reservado'
                  check (status in ('reservado','consumido','liberado')),
  criado_em       timestamptz not null default now()
);
create index on reservas_estoque (insumo_id);
create index on reservas_estoque (planejamento_id);

-- RLS nas tabelas novas (privilégios já herdados das default privileges do 0002)
alter table lotes_estoque    enable row level security;
alter table reservas_estoque enable row level security;
create policy authenticated_all_lotes on lotes_estoque
  for all to authenticated using (true) with check (true);
create policy anon_read_lotes on lotes_estoque
  for select to anon using (true);
create policy authenticated_all_reservas on reservas_estoque
  for all to authenticated using (true) with check (true);
create policy anon_read_reservas on reservas_estoque
  for select to anon using (true);

-- ---- saldo por insumo: em mãos, reservado, disponível ---------------
create view v_estoque_saldo as
select
  i.id  as insumo_id,
  i.nome_item,
  i.especificacao,
  i.unidade,
  coalesce((select sum(l.quantidade_atual) from lotes_estoque l
            where l.insumo_id = i.id), 0)                                  as em_maos,
  coalesce((select sum(r.quantidade) from reservas_estoque r
            where r.insumo_id = i.id and r.status = 'reservado'), 0)       as reservado,
  coalesce((select sum(l.quantidade_atual) from lotes_estoque l
            where l.insumo_id = i.id), 0)
  - coalesce((select sum(r.quantidade) from reservas_estoque r
            where r.insumo_id = i.id and r.status = 'reservado'), 0)       as disponivel,
  i.ponto_reposicao,
  i.estoque_seguranca,
  i.lead_time_dias
from insumos i;

-- ---- alertas derivados ----------------------------------------------
create view v_alertas_estoque as
-- reposição
select 'reposicao'::text as tipo, s.insumo_id, s.especificacao,
       null::date as validade, s.disponivel as valor, s.ponto_reposicao as referencia
from v_estoque_saldo s
where s.ponto_reposicao > 0 and s.disponivel <= s.ponto_reposicao
union all
-- vencimento / vencido (lotes com saldo)
select case when l.validade < current_date then 'vencido' else 'vencimento' end,
       l.insumo_id, i.especificacao, l.validade, l.quantidade_atual, null
from lotes_estoque l
join insumos i on i.id = l.insumo_id
where l.quantidade_atual > 0 and l.validade is not null
  and l.validade <= current_date
      + ((select valor from parametros where chave = 'janela_vencimento_dias')::int);

-- =====================================================================
-- RPCs transacionais
-- =====================================================================

-- Recebimento de lote (reposição = entrada)
create or replace function receber_lote(
  p_insumo_id  bigint,
  p_quantidade numeric,
  p_validade   date    default null,
  p_custo      numeric default null,
  p_codigo     text    default null,
  p_fornecedor text    default null
) returns bigint language plpgsql security definer set search_path = public as $$
declare v_lote bigint;
begin
  insert into lotes_estoque(insumo_id, codigo_lote, validade,
                            quantidade_inicial, quantidade_atual, custo_unitario, fornecedor)
  values (p_insumo_id, p_codigo, p_validade, p_quantidade, p_quantidade, p_custo, p_fornecedor)
  returning id into v_lote;

  insert into estoque_movimentacoes(insumo_id, tipo, quantidade, custo_unitario, motivo, lote_id)
  values (p_insumo_id, 'entrada', p_quantidade, p_custo, 'compra/recebimento', v_lote);

  return v_lote;
end $$;

-- Reserva: recebe a demanda já calculada pelo app (coerente com o custeio).
-- p_itens = [{ "insumo_id": <id>, "quantidade": <num> }, ...]
create or replace function reservar_plano(p_planejamento_id bigint, p_itens jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from reservas_estoque
   where planejamento_id = p_planejamento_id and status = 'reservado';

  insert into reservas_estoque(planejamento_id, insumo_id, quantidade, status)
  select p_planejamento_id, (e->>'insumo_id')::bigint, (e->>'quantidade')::numeric, 'reservado'
  from jsonb_array_elements(p_itens) e
  where (e->>'insumo_id') is not null and (e->>'quantidade')::numeric > 0;
end $$;

-- Baixa definitiva: consome as reservas do plano por FEFO. Permite iniciar
-- mesmo sem estoque suficiente (política), retornando as faltas.
create or replace function dar_baixa_plano(p_planejamento_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r record; l record; v_rem numeric; v_take numeric;
  v_short jsonb := '[]'::jsonb;
begin
  for r in select * from reservas_estoque
           where planejamento_id = p_planejamento_id and status = 'reservado' loop
    v_rem := r.quantidade;
    for l in select * from lotes_estoque
             where insumo_id = r.insumo_id and quantidade_atual > 0
             order by validade nulls last, id loop
      exit when v_rem <= 0;
      v_take := least(v_rem, l.quantidade_atual);
      update lotes_estoque set quantidade_atual = quantidade_atual - v_take where id = l.id;
      insert into estoque_movimentacoes(insumo_id, tipo, quantidade, custo_unitario, motivo, referencia, lote_id)
      values (r.insumo_id, 'saida', v_take, l.custo_unitario,
              'baixa análise', 'plano ' || p_planejamento_id, l.id);
      v_rem := v_rem - v_take;
    end loop;

    update reservas_estoque set status = 'consumido' where id = r.id;

    if v_rem > 0 then
      v_short := v_short || jsonb_build_object('insumo_id', r.insumo_id, 'falta', v_rem);
    end if;
  end loop;

  return jsonb_build_object('shortfalls', v_short);
end $$;

-- Liberação (plano cancelado): solta as reservas.
create or replace function liberar_plano(p_planejamento_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  update reservas_estoque set status = 'liberado'
   where planejamento_id = p_planejamento_id and status = 'reservado';
end $$;

grant execute on function receber_lote(bigint,numeric,date,numeric,text,text)  to authenticated, service_role;
grant execute on function reservar_plano(bigint,jsonb)                          to authenticated, service_role;
grant execute on function dar_baixa_plano(bigint)                               to authenticated, service_role;
grant execute on function liberar_plano(bigint)                                 to authenticated, service_role;
