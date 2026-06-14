-- =====================================================================
-- Demandas/Propostas: etapa anterior aos orcamentos formais.
-- Centraliza dados comuns do cliente/projeto para evitar redigitacao entre
-- orcamento de analises e orcamento de projetos.
-- =====================================================================

create table demandas_propostas (
  id                  bigint generated always as identity primary key,
  cliente_id          bigint references clientes(id) on delete set null,
  projeto_id          bigint references projetos(id) on delete set null,
  titulo              text not null,
  cliente_nome        text,
  cliente_cnpj        text,
  cliente_contato     text,
  instituicao         text,
  responsavel_interno text,
  data_solicitacao    date not null default current_date,
  prazo_esperado      date,
  modalidade          text not null default 'analises'
                      check (modalidade in (
                        'analises',
                        'projeto',
                        'analises_projeto',
                        'projeto_analises_custos'
                      )),
  status              text not null default 'nova'
                      check (status in (
                        'nova',
                        'em_analise',
                        'orcada',
                        'aprovada',
                        'recusada',
                        'cancelada'
                      )),
  origem              text,
  prioridade          text not null default 'normal'
                      check (prioridade in ('baixa','normal','alta','urgente')),
  descricao           text,
  escopo_preliminar   text,
  observacoes         text,
  criado_em           timestamptz not null default now()
);
create index on demandas_propostas (cliente_id);
create index on demandas_propostas (projeto_id);
create index on demandas_propostas (status);

alter table orcamentos
  add column demanda_id bigint references demandas_propostas(id) on delete set null;

alter table orcamento_projetos
  add column demanda_id bigint references demandas_propostas(id) on delete set null;

alter table demandas_propostas enable row level security;
create policy authenticated_all_demandas_propostas on demandas_propostas
  for all to authenticated using (true) with check (true);

grant all on all tables in schema public to service_role;

create trigger aud_demandas_propostas after insert or update or delete on demandas_propostas
  for each row execute function fn_auditoria();
