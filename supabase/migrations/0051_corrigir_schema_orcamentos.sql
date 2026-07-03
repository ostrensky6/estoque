-- Tabela demanda_analises (exigida pelo fluxo de propostas comerciais)
create table if not exists demanda_analises (
  id bigint generated always as identity primary key,
  demanda_id bigint references demandas_propostas(id) on delete cascade not null,
  codigo_analise text references analises(codigo) not null,
  quantidade_amostras integer not null default 1 check (quantidade_amostras > 0),
  origem_quantidade text not null default 'manual',
  status_custeio text not null default 'pendente',
  observacao text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table demanda_analises enable row level security;
drop policy if exists authenticated_all_demanda_analises on demanda_analises;
create policy authenticated_all_demanda_analises on demanda_analises
  for all to authenticated using (true) with check (true);

grant all on demanda_analises to authenticated, service_role;
grant usage, select on sequence demanda_analises_id_seq to authenticated, service_role;

-- Colunas valor_snapshot ausentes nos itens de orçamento
alter table orcamento_itens add column if not exists valor_snapshot jsonb not null default '{}'::jsonb;
alter table orcamento_projeto_analises add column if not exists valor_snapshot jsonb not null default '{}'::jsonb;
alter table orcamento_projeto_custos add column if not exists valor_snapshot jsonb not null default '{}'::jsonb;

-- Correção de schema drift na tabela projetos
alter table projetos add column if not exists coordenador text;
