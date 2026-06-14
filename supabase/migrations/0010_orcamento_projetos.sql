-- =====================================================================
-- Orçamento de projetos: camada comercial acima do orçamento laboratorial.
-- Usa custos calculados do laboratório quando necessário e permite adicionar
-- custos próprios do projeto (mão de obra, deslocamento, equipamentos,
-- terceiros, materiais e outros).
-- =====================================================================

create table orcamento_projetos (
  id                bigint generated always as identity primary key,
  projeto_id        bigint references projetos(id) on delete set null,
  cliente_id        bigint references clientes(id) on delete set null,
  titulo            text not null,
  cliente_nome      text,
  cliente_cnpj      text,
  cliente_contato   text,
  data_orcamento    date not null default current_date,
  validade_dias     integer not null default 30,
  responsavel       text,
  status            text not null default 'rascunho'
                    check (status in ('rascunho','enviado','aprovado','recusado')),
  escopo            text,
  cronograma        text,
  observacoes       text,
  margem_lucro      numeric not null default 0,
  impostos          numeric not null default 0,
  criado_em         timestamptz not null default now()
);

create table orcamento_projeto_analises (
  id                    bigint generated always as identity primary key,
  orcamento_projeto_id   bigint not null references orcamento_projetos(id) on delete cascade,
  codigo_analise         text not null references analises(codigo),
  n_amostras             numeric not null default 1 check (n_amostras > 0),
  custo_unitario         numeric not null default 0,
  preco_unitario         numeric not null default 0
);
create index on orcamento_projeto_analises (orcamento_projeto_id);

create table orcamento_projeto_custos (
  id                    bigint generated always as identity primary key,
  orcamento_projeto_id   bigint not null references orcamento_projetos(id) on delete cascade,
  categoria              text not null
                        check (categoria in (
                          'mao_obra',
                          'deslocamento',
                          'equipamentos',
                          'terceiros',
                          'materiais',
                          'outros'
                        )),
  descricao              text not null,
  quantidade             numeric not null default 1 check (quantidade > 0),
  unidade                text,
  custo_unitario         numeric not null default 0,
  preco_unitario         numeric not null default 0
);
create index on orcamento_projeto_custos (orcamento_projeto_id);

alter table orcamento_projetos enable row level security;
alter table orcamento_projeto_analises enable row level security;
alter table orcamento_projeto_custos enable row level security;

create policy authenticated_all_orcamento_projetos on orcamento_projetos
  for all to authenticated using (true) with check (true);
create policy authenticated_all_orcamento_projeto_analises on orcamento_projeto_analises
  for all to authenticated using (true) with check (true);
create policy authenticated_all_orcamento_projeto_custos on orcamento_projeto_custos
  for all to authenticated using (true) with check (true);

grant all on all tables in schema public to service_role;

create trigger aud_orcamento_projetos after insert or update or delete on orcamento_projetos
  for each row execute function fn_auditoria();
