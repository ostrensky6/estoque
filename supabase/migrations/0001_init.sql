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
