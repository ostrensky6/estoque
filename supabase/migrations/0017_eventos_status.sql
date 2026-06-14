-- =====================================================================
-- Fase 3.4 — Workflow de aprovação com estado e datas.
-- Linha do tempo de transições de status (quem/quando) para orçamentos e
-- pedidos de compra. Aditiva.
-- =====================================================================

create table eventos_status (
  id          bigint generated always as identity primary key,
  entidade    text not null,            -- 'orcamento' | 'orcamento_projeto' | 'pedido_compra'
  entidade_id bigint not null,
  de_status   text,
  para_status text not null,
  usuario     text,
  observacao  text,
  criado_em   timestamptz not null default now()
);
create index on eventos_status (entidade, entidade_id, criado_em);

alter table eventos_status enable row level security;
create policy authenticated_all_eventos_status on eventos_status
  for all to authenticated using (true) with check (true);
create policy anon_read_eventos_status on eventos_status
  for select to anon using (true);

grant all on eventos_status to service_role;
