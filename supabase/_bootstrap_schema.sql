-- Bootstrap de produção: schema completo (migrations 0001–0009)
-- Rode ESTE primeiro; depois rode o conteúdo de seed/seed.sql.
begin;

-- ===== 0001_init.sql =====
-- =====================================================================
-- Lab Custos & Estoque — schema inicial
-- Baseado em Laboratorio1.xlsm (8 abas). Guarda INPUTS crus;
-- cálculos de custo/preço são feitos na aplicação a partir de `parametros`
-- para permitir simulação de cenários em tempo real.
-- =====================================================================

-- ---------- Parâmetros globais ajustáveis (cenários) ------------------
create table parametros (
  chave        text primary key,
  valor        numeric not null,
  unidade      text,
  descricao    text,
  atualizado_em timestamptz not null default now()
);

comment on table parametros is 'Constantes ajustáveis usadas no custeio (dias úteis/ano, horas-base, margem, impostos, fundos etc.)';

-- ---------- Catálogo de análises -------------------------------------
create table analises (
  codigo       text primary key,          -- ex.: Illumina_Sh, qPCR_F, Sanger
  nome         text,
  descricao    text,
  ativo        boolean not null default true
);

-- ---------- Etapas/atividades por análise (aba Tempo) ----------------
create table etapas (
  id                        bigint generated always as identity primary key,
  codigo_analise            text not null references analises(codigo) on update cascade,
  nome_etapa                text not null,
  nome_atividade            text not null,
  execucoes_por_dia         numeric,
  amostras_por_execucao     numeric,
  tempo_maquina_h           numeric,       -- por execução
  tempo_bancada_h           numeric,       -- por execução
  atividade_opcional        boolean not null default false,
  tipo_limitacao            text,          -- recurso gargalo: Pessoal, Termobloco, Sequenciador...
  dia_inicio                text,          -- mantido como texto (há faixas tipo "2-3")
  dia_fim_max               numeric,
  ordem                     int
  -- Obs.: (codigo_analise, nome_etapa, nome_atividade) NÃO é único na planilha
  -- (ex.: Illumina_Sh tem duas Eletroforeses na Montagem de biblioteca). A
  -- ordem/dia_inicio desambigua. O VLOOKUP da MCA no .xlsm pega só a 1ª ocorrência.
);
create index on etapas (codigo_analise);

-- ---------- Equipamentos (inventário) --------------------------------
create table equipamentos (
  id                          bigint generated always as identity primary key,
  nome                        text not null unique,
  quantidade                  numeric not null default 1,
  custo_unitario              numeric not null default 0,
  data_aquisicao              date,
  possui                      boolean not null default true,
  vida_util_anos              numeric,                    -- usado p/ depreciação linear
  percentual_manutencao_anual numeric not null default 0, -- fração (0.05 = 5%)
  manutencao_anual_fixa       numeric                     -- override quando há valor de contrato (ex.: MiSeq)
);

comment on column equipamentos.manutencao_anual_fixa is 'Quando preenchido, substitui custo*%manutencao (contratos de manutenção)';

-- ---------- Alocação equipamento -> análise (aba Equipamento_Analise)-
create table equipamento_analise (
  id              bigint generated always as identity primary key,
  equipamento_id  bigint not null references equipamentos(id) on delete cascade,
  codigo_analise  text   not null references analises(codigo) on update cascade,
  peso_alocacao   numeric not null default 0,
  unique (equipamento_id, codigo_analise)
);

-- ---------- Técnicos / pessoal (aba Tecnicos) ------------------------
create table tecnicos (
  id                  bigint generated always as identity primary key,
  nome                text not null,
  processo            text,                 -- Laboratório / Bioinformática
  valor_mes           numeric not null default 0,
  horas_mes_base      numeric not null default 170,
  percentual_dedicado numeric not null default 0  -- 0-100
);

-- ---------- Overhead / custos fixos (aba Overhead) -------------------
create table overhead (
  id                    bigint generated always as identity primary key,
  item                  text not null,
  custo_mensal          numeric not null default 0,
  percentual_compensada numeric not null default 100, -- 0-100
  horas_bancada_mes     numeric not null default 450
);

-- ---------- Insumos / catálogo de consumo (aba MC) ------------------
create table insumos (
  id                     bigint generated always as identity primary key,
  nome_item              text,                  -- categoria curta (Ladder, Beads...)
  especificacao          text not null unique,  -- chave usada pela MCA (texto completo)
  custo_total_embalagem  numeric,
  quantidade_embalagem   numeric,
  unidade                text,
  custo_unitario         numeric,               -- = custo_total_embalagem / quantidade_embalagem
  data_aquisicao         date
);

-- ---------- Insumo por etapa de análise (aba MCA) -------------------
create table insumo_analise (
  id                    bigint generated always as identity primary key,
  codigo_analise        text not null references analises(codigo) on update cascade,
  nome_etapa            text not null,
  nome_atividade        text not null,
  especificacao_insumo  text,                   -- liga a insumos.especificacao (pode não existir ainda)
  unidade               text,
  grupo_escolha         text,                   -- alternativas mutuamente exclusivas (ex.: kits Set A/B/C/D)
  quantidade_por_amostra numeric,
  modo_cobranca         text,                   -- por_amostra | por_execucao
  insumo_id             bigint references insumos(id) on delete set null
);

create index on insumo_analise (codigo_analise);
create index on insumo_analise (insumo_id);

-- =====================================================================
-- MÓDULO DE ESTOQUE
-- =====================================================================

-- Movimentações (saldo é derivado pela soma). entrada (+), saida (-), ajuste (=)
create table estoque_movimentacoes (
  id          bigint generated always as identity primary key,
  insumo_id   bigint not null references insumos(id) on delete cascade,
  tipo        text not null check (tipo in ('entrada','saida','ajuste')),
  quantidade  numeric not null,           -- na unidade do insumo
  custo_unitario numeric,                 -- registrado na entrada (histórico de preço)
  data        date not null default current_date,
  motivo      text,                       -- compra, consumo análise, perda, inventário...
  referencia  text,                       -- nº NF, id de plano de análise etc.
  criado_em   timestamptz not null default now()
);

create index on estoque_movimentacoes (insumo_id);

-- Estoque mínimo / alertas por insumo
create table estoque_config (
  insumo_id      bigint primary key references insumos(id) on delete cascade,
  estoque_minimo numeric not null default 0,
  lead_time_dias int
);

-- Saldo atual derivado
create view v_estoque_saldo as
select i.id as insumo_id,
       i.nome_item,
       i.especificacao,
       i.unidade,
       coalesce(sum(case m.tipo when 'entrada' then m.quantidade
                                when 'saida'   then -m.quantidade
                                else 0 end), 0) as saldo,
       c.estoque_minimo
from insumos i
left join estoque_movimentacoes m on m.insumo_id = i.id
left join estoque_config c on c.insumo_id = i.id
group by i.id, i.nome_item, i.especificacao, i.unidade, c.estoque_minimo;

-- =====================================================================
-- PLANEJAMENTO -> projeção de consumo (ponte custeio <-> estoque)
-- =====================================================================
create table planejamento (
  id          bigint generated always as identity primary key,
  nome        text,                        -- nome do cenário/lote
  data_alvo   date,
  observacao  text,
  criado_em   timestamptz not null default now()
);

create table planejamento_itens (
  id              bigint generated always as identity primary key,
  planejamento_id bigint not null references planejamento(id) on delete cascade,
  codigo_analise  text not null references analises(codigo) on update cascade,
  n_amostras      numeric not null default 0
);

-- ===== 0002_grants_rls.sql =====
-- =====================================================================
-- Privilégios e RLS
-- O Supabase expõe o schema public via PostgREST usando os papéis
-- anon / authenticated. As tabelas criadas pela migração precisam de
-- GRANT explícito; sem isso o PostgREST retorna "permission denied".
-- =====================================================================

grant usage on schema public to anon, authenticated, service_role;

grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

-- Tabelas futuras herdam os mesmos privilégios
alter default privileges in schema public
  grant select on tables to anon, authenticated;
alter default privileges in schema public
  grant insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;

-- ---- RLS: liga em todas as tabelas e define políticas ----------------
-- authenticated: acesso total (app interno, ~15 usuários do laboratório).
-- anon: somente leitura dos catálogos (temporário, p/ dev antes da auth).
do $$
declare
  t text;
  catalogos text[] := array[
    'parametros','analises','etapas','equipamentos','equipamento_analise',
    'tecnicos','overhead','insumos','insumo_analise'
  ];
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security;', t);

    execute format($f$
      create policy "authenticated_all_%1$s" on public.%1$I
        for all to authenticated using (true) with check (true);
    $f$, t);

    if t = any(catalogos) then
      execute format($f$
        create policy "anon_read_%1$s" on public.%1$I
          for select to anon using (true);
      $f$, t);
    end if;
  end loop;
end $$;

-- ===== 0003_estoque.sql =====
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

-- ===== 0004_lims.sql =====
-- =====================================================================
-- Evolução para arquitetura LIMS (Benchling/Labguru/ISO 15189):
-- 3 níveis (produto-mestre · lote · localização), estados do material,
-- validade dupla, compras, auditoria, protocolo de consumo refinado.
-- A implementação de UI é gradual; o MODELO nasce preparado.
-- =====================================================================

-- ---- Fornecedores ----------------------------------------------------
create table fornecedores (
  id              bigint generated always as identity primary key,
  nome            text not null,
  contato         text,
  catalogo_padrao text,
  prazo_medio_dias int,
  prazo_max_dias   int,
  ativo           boolean not null default true
);

-- ---- Localização (hierárquica: prédio>sala>freezer>gaveta>caixa) -----
create table locais (
  id          bigint generated always as identity primary key,
  nome        text not null,
  tipo        text,   -- predio, sala, freezer, geladeira, armario, gaveta, caixa, rack, posicao
  parent_id   bigint references locais(id) on delete set null,
  condicao_armazenamento text  -- ex.: -20°C, 4°C, ambiente
);

-- ---- Produto-mestre: campos de identificação/compra/segurança --------
alter table insumos
  add column codigo_interno          text,
  add column codigo_fabricante       text,
  add column fabricante              text,
  add column categoria_compra        text default 'operacional'
       check (categoria_compra in ('critico','operacional','eventual')),
  add column fornecedor_id           bigint references fornecedores(id) on delete set null,
  add column fornecedor_alt_id       bigint references fornecedores(id) on delete set null,
  add column sds_url                 text,            -- FISPQ / SDS
  add column condicao_armazenamento  text,
  add column validade_apos_abertura_dias int,         -- validade dupla
  add column quantidade_minima_compra numeric,
  add column prazo_entrega_max_dias  int;

-- ---- Lote: estados, localização, qualidade, validade dupla -----------
alter table lotes_estoque
  add column status            text not null default 'quarentena'
       check (status in ('quarentena','aceito','em_uso','bloqueado','consumido','descartado')),
  add column local_id          bigint references locais(id) on delete set null,
  add column nota_fiscal        text,
  add column certificado_analise text,
  add column projeto            text,
  add column data_abertura      date,
  add column validade_apos_abertura date,             -- calculada na abertura
  add column responsavel_recebimento text,
  add column responsavel_liberacao   text,
  add column criterio_aceitacao text,
  add column motivo_bloqueio    text,
  add column condicao_recebimento text;

-- ---- Compras (solicitação → aprovação → pedido → recebimento) --------
create table pedidos_compra (
  id            bigint generated always as identity primary key,
  fornecedor_id bigint references fornecedores(id) on delete set null,
  status        text not null default 'solicitado'
                check (status in ('solicitado','aprovado','enviado','em_transito','recebido','cancelado')),
  solicitante   text,
  aprovador     text,
  projeto       text,
  data_solicitacao  date not null default current_date,
  data_aprovacao    date,
  data_prevista_entrega date,
  observacao    text,
  criado_em     timestamptz not null default now()
);

create table pedidos_compra_itens (
  id            bigint generated always as identity primary key,
  pedido_id     bigint not null references pedidos_compra(id) on delete cascade,
  insumo_id     bigint not null references insumos(id) on delete cascade,
  quantidade    numeric not null,
  custo_unitario_estimado numeric,
  lote_id       bigint references lotes_estoque(id) on delete set null  -- preenchido no recebimento
);

-- ---- Planejamento: controles, repetições, perdas, projeto ------------
alter table planejamento
  add column projeto    text,
  add column responsavel text;

alter table planejamento_itens
  add column n_controles numeric not null default 0,
  add column repeticoes  numeric not null default 1,
  add column perda_percentual numeric not null default 0;

-- ---- Protocolo: base de cálculo do consumo ---------------------------
alter table insumo_analise
  add column base_calculo text;  -- por_amostra, por_reacao, por_placa, por_batelada, por_controle

-- ---- Auditoria (trilha) ----------------------------------------------
create table auditoria (
  id             bigint generated always as identity primary key,
  tabela         text not null,
  registro_id    text,
  acao           text not null,           -- insert/update/delete
  valor_anterior jsonb,
  valor_novo     jsonb,
  usuario        text,                    -- preenchido via set_config('app.usuario',...) quando houver auth
  justificativa  text,
  criado_em      timestamptz not null default now()
);
create index on auditoria (tabela, registro_id);

create or replace function fn_auditoria()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into auditoria(tabela, registro_id, acao, valor_anterior, valor_novo, usuario)
  values (
    tg_table_name,
    (case when tg_op = 'DELETE' then old.id else new.id end)::text,
    lower(tg_op),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('UPDATE','INSERT') then to_jsonb(new) else null end,
    current_setting('app.usuario', true)
  );
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create trigger aud_lotes    after insert or update or delete on lotes_estoque    for each row execute function fn_auditoria();
create trigger aud_insumos  after insert or update or delete on insumos          for each row execute function fn_auditoria();
create trigger aud_reservas after insert or update or delete on reservas_estoque for each row execute function fn_auditoria();
create trigger aud_pedidos  after insert or update or delete on pedidos_compra   for each row execute function fn_auditoria();

-- =====================================================================
-- Views status-aware (disponível real considera só lotes ACEITOS e não vencidos)
-- =====================================================================
drop view if exists v_alertas_estoque;
drop view if exists v_estoque_saldo;

create view v_estoque_saldo as
select
  i.id as insumo_id,
  i.nome_item,
  i.especificacao,
  i.unidade,
  coalesce(sum(l.quantidade_atual) filter (where l.status in ('aceito','em_uso')), 0)            as em_maos,
  coalesce(sum(l.quantidade_atual) filter (where l.status = 'quarentena'), 0)                    as em_quarentena,
  coalesce(sum(l.quantidade_atual) filter (where l.status = 'bloqueado'), 0)                     as bloqueado,
  coalesce(sum(l.quantidade_atual) filter (where l.status in ('aceito','em_uso')
            and l.validade < current_date), 0)                                                  as vencido,
  (select coalesce(sum(r.quantidade), 0) from reservas_estoque r
     where r.insumo_id = i.id and r.status = 'reservado')                                        as reservado,
  coalesce(sum(l.quantidade_atual) filter (where l.status in ('aceito','em_uso')
            and (l.validade is null or l.validade >= current_date)), 0)
    - (select coalesce(sum(r.quantidade), 0) from reservas_estoque r
         where r.insumo_id = i.id and r.status = 'reservado')                                    as disponivel,
  i.ponto_reposicao,
  i.estoque_seguranca,
  i.lead_time_dias,
  i.categoria_compra
from insumos i
left join lotes_estoque l on l.insumo_id = i.id
group by i.id;

create view v_alertas_estoque as
-- reposição (sobre o disponível real)
select 'reposicao'::text as tipo, s.insumo_id, s.especificacao,
       null::date as validade, s.disponivel as valor, s.ponto_reposicao as referencia
from v_estoque_saldo s
where s.ponto_reposicao > 0 and s.disponivel <= s.ponto_reposicao
union all
-- quarentena pendente
select 'quarentena', s.insumo_id, s.especificacao, null, s.em_quarentena, null
from v_estoque_saldo s
where s.em_quarentena > 0
union all
-- vencimento / vencido (lotes aceitos com saldo)
select case when l.validade < current_date then 'vencido' else 'vencimento' end,
       l.insumo_id, i.especificacao, l.validade, l.quantidade_atual, null
from lotes_estoque l
join insumos i on i.id = l.insumo_id
where l.quantidade_atual > 0 and l.validade is not null
  and l.status in ('aceito','em_uso')
  and l.validade <= current_date
      + ((select valor from parametros where chave = 'janela_vencimento_dias')::int);

-- =====================================================================
-- RPCs (estados do material)
-- =====================================================================

-- recebimento → entra em QUARENTENA (precisa aceitação para uso)
drop function if exists receber_lote(bigint,numeric,date,numeric,text,text);
create function receber_lote(
  p_insumo_id  bigint,
  p_quantidade numeric,
  p_validade   date    default null,
  p_custo      numeric default null,
  p_codigo     text    default null,
  p_fornecedor text    default null,
  p_local_id   bigint  default null,
  p_nota_fiscal text   default null,
  p_projeto    text    default null
) returns bigint language plpgsql security definer set search_path = public as $$
declare v_lote bigint;
begin
  insert into lotes_estoque(insumo_id, codigo_lote, validade, quantidade_inicial,
                            quantidade_atual, custo_unitario, fornecedor, status,
                            local_id, nota_fiscal, projeto)
  values (p_insumo_id, p_codigo, p_validade, p_quantidade, p_quantidade, p_custo,
          p_fornecedor, 'quarentena', p_local_id, p_nota_fiscal, p_projeto)
  returning id into v_lote;

  insert into estoque_movimentacoes(insumo_id, tipo, quantidade, custo_unitario, motivo, lote_id)
  values (p_insumo_id, 'entrada', p_quantidade, p_custo, 'recebimento (quarentena)', v_lote);

  return v_lote;
end $$;

-- aceitar lote (libera para uso)
create or replace function aceitar_lote(p_lote_id bigint, p_responsavel text default null, p_criterio text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  update lotes_estoque
     set status = 'aceito', responsavel_liberacao = p_responsavel, criterio_aceitacao = p_criterio
   where id = p_lote_id and status = 'quarentena';
end $$;

-- bloquear / desbloquear
create or replace function bloquear_lote(p_lote_id bigint, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update lotes_estoque set status = 'bloqueado', motivo_bloqueio = p_motivo where id = p_lote_id;
end $$;

create or replace function desbloquear_lote(p_lote_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  update lotes_estoque set status = 'aceito', motivo_bloqueio = null where id = p_lote_id and status = 'bloqueado';
end $$;

-- descartar lote (com justificativa) → zera saldo + movimentação de ajuste
create or replace function descartar_lote(p_lote_id bigint, p_justificativa text)
returns void language plpgsql security definer set search_path = public as $$
declare v_insumo bigint; v_qtd numeric;
begin
  update lotes_estoque set status = 'descartado', quantidade_atual = 0 where id = p_lote_id
  returning insumo_id, quantidade_inicial into v_insumo, v_qtd;
  insert into estoque_movimentacoes(insumo_id, tipo, quantidade, motivo, lote_id)
  values (v_insumo, 'ajuste', v_qtd, 'descarte: ' || p_justificativa, p_lote_id);
end $$;

-- baixa definitiva: FEFO entre lotes ACEITOS e não vencidos; abre/consome lote.
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
               and status in ('aceito','em_uso')
               and (validade is null or validade >= current_date)
             order by validade nulls last, id loop
      exit when v_rem <= 0;
      v_take := least(v_rem, l.quantidade_atual);
      update lotes_estoque
         set quantidade_atual = quantidade_atual - v_take,
             status = case when quantidade_atual - v_take <= 0 then 'consumido' else 'em_uso' end,
             data_abertura = coalesce(data_abertura, current_date)
       where id = l.id;
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

-- =====================================================================
-- RLS + grants nas tabelas novas
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['fornecedores','locais','pedidos_compra','pedidos_compra_itens','auditoria'] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('create policy authenticated_all_%1$s on public.%1$I for all to authenticated using (true) with check (true);', t);
    execute format('create policy anon_read_%1$s on public.%1$I for select to anon using (true);', t);
  end loop;
end $$;

-- service_role precisa de privilégios diretos nas tabelas (RPCs são definer,
-- mas o app também escreve direto via service_role). Re-concede tudo.
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

grant execute on function receber_lote(bigint,numeric,date,numeric,text,text,bigint,text,text) to authenticated, service_role;
grant execute on function aceitar_lote(bigint,text,text)    to authenticated, service_role;
grant execute on function bloquear_lote(bigint,text)        to authenticated, service_role;
grant execute on function desbloquear_lote(bigint)          to authenticated, service_role;
grant execute on function descartar_lote(bigint,text)       to authenticated, service_role;

-- ===== 0005_auth.sql =====
-- =====================================================================
-- Autenticação e perfis (papéis). Base para autorização, fluxo de
-- compras (aprovação) e auditoria com identidade do usuário.
-- =====================================================================

create table perfis (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  nome       text,
  papel      text not null default 'tecnico'
             check (papel in ('tecnico','coordenador','gestor','admin')),
  criado_em  timestamptz not null default now()
);

alter table perfis enable row level security;
-- todos autenticados leem perfis (para exibir nomes/papéis)
create policy perfis_read on perfis for select to authenticated using (true);
-- cada um edita o próprio; admin edita todos (checado na app por ora)
create policy perfis_write on perfis for all to authenticated using (true) with check (true);

grant select, insert, update, delete on perfis to authenticated, service_role;

-- cria perfil automaticamente quando um usuário é criado no Auth
create or replace function fn_novo_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into perfis(id, email, nome)
  values (new.id, new.email, new.raw_user_meta_data->>'nome')
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function fn_novo_perfil();

-- papel do usuário corrente
create or replace function current_papel()
returns text language sql stable security definer set search_path = public as $$
  select papel from perfis where id = auth.uid();
$$;
grant execute on function current_papel() to authenticated, service_role;

-- auditoria passa a capturar o usuário do JWT (email) quando disponível
create or replace function fn_auditoria()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_user text;
begin
  begin
    v_user := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email';
  exception when others then
    v_user := null;
  end;
  v_user := coalesce(v_user, current_setting('app.usuario', true));

  insert into auditoria(tabela, registro_id, acao, valor_anterior, valor_novo, usuario)
  values (
    tg_table_name,
    (case when tg_op = 'DELETE' then old.id else new.id end)::text,
    lower(tg_op),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('UPDATE','INSERT') then to_jsonb(new) else null end,
    v_user
  );
  return case when tg_op = 'DELETE' then old else new end;
end $$;

-- ===== 0006_governanca.sql =====
-- =====================================================================
-- Governança: papéis no RLS, auditoria imutável e restrita.
-- =====================================================================

-- ---- perfis: só admin altera papéis (evita auto-promoção) -----------
drop policy if exists perfis_write on perfis;
create policy perfis_admin_write on perfis
  for all to authenticated
  using (current_papel() = 'admin')
  with check (current_papel() = 'admin');
-- leitura permanece para todos os autenticados (perfis_read, do 0005)

-- ---- auditoria: imutável (só o trigger definer insere) + leitura gestor+ ----
revoke insert, update, delete on auditoria from authenticated, anon;

drop policy if exists authenticated_all_auditoria on auditoria;
drop policy if exists anon_read_auditoria on auditoria;
create policy auditoria_read on auditoria
  for select to authenticated
  using (current_papel() in ('gestor', 'admin'));

-- =====================================================================
-- Autorização por papel nas RPCs de ciclo de vida do lote.
-- Aceitação (liberação p/ uso) = coordenador+; bloqueio/descarte = gestor+.
-- =====================================================================
create or replace function fn_exige_papel(p_min text)
returns void language plpgsql security definer set search_path = public as $$
declare ordem text[] := array['tecnico','coordenador','gestor','admin']; p text;
begin
  select papel into p from perfis where id = auth.uid();
  p := coalesce(p, 'tecnico');
  if array_position(ordem, p) < array_position(ordem, p_min) then
    raise exception 'Sem permissão: requer papel % ou superior (atual: %).', p_min, p
      using errcode = '42501';
  end if;
end $$;

create or replace function aceitar_lote(p_lote_id bigint, p_responsavel text default null, p_criterio text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform fn_exige_papel('coordenador');
  update lotes_estoque
     set status = 'aceito', responsavel_liberacao = coalesce(p_responsavel, current_setting('request.jwt.claims', true)::jsonb->>'email'), criterio_aceitacao = p_criterio
   where id = p_lote_id and status = 'quarentena';
end $$;

create or replace function bloquear_lote(p_lote_id bigint, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform fn_exige_papel('gestor');
  update lotes_estoque set status = 'bloqueado', motivo_bloqueio = p_motivo where id = p_lote_id;
end $$;

create or replace function desbloquear_lote(p_lote_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform fn_exige_papel('gestor');
  update lotes_estoque set status = 'aceito', motivo_bloqueio = null where id = p_lote_id and status = 'bloqueado';
end $$;

create or replace function descartar_lote(p_lote_id bigint, p_justificativa text)
returns void language plpgsql security definer set search_path = public as $$
declare v_insumo bigint; v_qtd numeric;
begin
  perform fn_exige_papel('gestor');
  update lotes_estoque set status = 'descartado', quantidade_atual = 0 where id = p_lote_id
  returning insumo_id, quantidade_inicial into v_insumo, v_qtd;
  insert into estoque_movimentacoes(insumo_id, tipo, quantidade, motivo, lote_id)
  values (v_insumo, 'ajuste', v_qtd, 'descarte: ' || p_justificativa, p_lote_id);
end $$;

grant execute on function fn_exige_papel(text) to authenticated, service_role;

-- ===== 0007_orcamentos.sql =====
-- =====================================================================
-- Orçamentos: documento comercial por cliente, com histórico.
-- Cabeçalho (cliente/CNPJ/endereço/data) + itens (análise × nº amostras)
-- com SNAPSHOT do custo e preço no momento do orçamento, para que
-- alterações futuras de parâmetros não mudem orçamentos já emitidos.
-- =====================================================================

create table orcamentos (
  id              bigint generated always as identity primary key,
  cliente_nome    text not null,
  cliente_cnpj    text,
  cliente_endereco text,
  cliente_contato text,                       -- e-mail / telefone / responsável
  data_orcamento  date not null default current_date,
  validade_dias   integer not null default 30,
  responsavel     text,                        -- quem do laboratório emitiu
  observacoes     text,
  status          text not null default 'rascunho'
                  check (status in ('rascunho','enviado','aprovado','recusado')),
  criado_em       timestamptz not null default now()
);

create table orcamento_itens (
  id              bigint generated always as identity primary key,
  orcamento_id    bigint not null references orcamentos(id) on delete cascade,
  codigo_analise  text not null references analises(codigo),
  n_amostras      numeric not null default 1 check (n_amostras > 0),
  -- snapshot no momento do orçamento (preço/custo por amostra):
  custo_unitario  numeric not null default 0,
  preco_unitario  numeric not null default 0
);
create index on orcamento_itens (orcamento_id);

-- RLS: app interno; authenticated tem acesso total (default privileges do 0002
-- já concederam insert/update/delete + uso de sequência às tabelas novas).
alter table orcamentos      enable row level security;
alter table orcamento_itens enable row level security;
create policy authenticated_all_orcamentos      on orcamentos      for all to authenticated using (true) with check (true);
create policy authenticated_all_orcamento_itens on orcamento_itens for all to authenticated using (true) with check (true);

grant all on all tables in schema public to service_role;

-- Trilha de auditoria (mesma fn_auditoria dos demais).
create trigger aud_orcamentos after insert or update or delete on orcamentos
  for each row execute function fn_auditoria();

-- ===== 0008_fornecedores_detalhe.sql =====
-- =====================================================================
-- Fornecedores: cadastro completo (identificação fiscal, contato, endereço).
-- =====================================================================
alter table fornecedores
  add column if not exists cnpj        text,
  add column if not exists endereco    text,
  add column if not exists telefone    text,
  add column if not exists email       text,
  add column if not exists site        text,
  add column if not exists observacoes text;

-- Trilha de auditoria (mesma fn_auditoria dos demais cadastros sensíveis).
drop trigger if exists aud_fornecedores on fornecedores;
create trigger aud_fornecedores after insert or update or delete on fornecedores
  for each row execute function fn_auditoria();

grant all on all tables in schema public to service_role;

-- ===== 0009_projetos.sql =====
-- =====================================================================
-- Clientes e Projetos: identificação do trabalho que amarra orçamentos,
-- planejamentos e compras a um mesmo projeto/cliente.
-- =====================================================================

create table clientes (
  id          bigint generated always as identity primary key,
  nome        text not null,
  cnpj        text,
  endereco    text,
  contato     text,                 -- responsável / comprador
  email       text,
  telefone    text,
  observacoes text,
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);

create table projetos (
  id          bigint generated always as identity primary key,
  nome        text not null,
  cliente_id  bigint references clientes(id) on delete set null,
  responsavel text,                 -- responsável interno do laboratório
  status      text not null default 'proposto'
              check (status in ('proposto','ativo','concluido','cancelado')),
  data_inicio date,
  data_fim    date,
  descricao   text,
  criado_em   timestamptz not null default now()
);
create index on projetos (cliente_id);

-- ---- Vínculos: cada documento aponta para o projeto (e cliente) -------
alter table orcamentos
  add column cliente_id bigint references clientes(id) on delete set null,
  add column projeto_id bigint references projetos(id) on delete set null;
alter table planejamento
  add column projeto_id bigint references projetos(id) on delete set null;
alter table pedidos_compra
  add column projeto_id bigint references projetos(id) on delete set null;

-- RLS (app interno; authenticated total — default privileges do 0002 cobrem grants).
alter table clientes enable row level security;
alter table projetos enable row level security;
create policy authenticated_all_clientes on clientes for all to authenticated using (true) with check (true);
create policy authenticated_all_projetos on projetos for all to authenticated using (true) with check (true);

grant all on all tables in schema public to service_role;

-- Auditoria.
create trigger aud_clientes after insert or update or delete on clientes
  for each row execute function fn_auditoria();
create trigger aud_projetos after insert or update or delete on projetos
  for each row execute function fn_auditoria();

commit;
