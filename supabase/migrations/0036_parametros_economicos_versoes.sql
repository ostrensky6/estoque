-- =====================================================================
-- Versionamento de parametros economicos.
--
-- Migration aditiva: preserva snapshots de parametros globais laboratoriais e
-- parametros economicos de projetos sem alterar registros historicos.
-- Rollback seguro: exportar a tabela antes de remove-la, se necessario.
-- =====================================================================

create table if not exists parametros_economicos_versoes (
  id                    bigint generated always as identity primary key,
  escopo                text not null check (escopo in ('laboratorio_global','projeto')),
  orcamento_projeto_id   bigint references orcamento_projetos(id) on delete set null,
  versao                integer not null,
  parametros            jsonb not null,
  origem                text not null default 'kontrol',
  criado_por            uuid references auth.users(id),
  criado_em             timestamptz not null default now()
);

create index if not exists parametros_economicos_versoes_escopo_idx
  on parametros_economicos_versoes (escopo, criado_em desc);
create index if not exists parametros_economicos_versoes_projeto_idx
  on parametros_economicos_versoes (orcamento_projeto_id, versao desc);

alter table parametros_economicos_versoes enable row level security;
create policy authenticated_all_parametros_economicos_versoes on parametros_economicos_versoes
  for all to authenticated using (true) with check (true);

grant all on parametros_economicos_versoes to service_role;

create trigger aud_parametros_economicos_versoes after insert or update or delete on parametros_economicos_versoes
  for each row execute function fn_auditoria();
