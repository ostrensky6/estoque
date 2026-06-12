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
