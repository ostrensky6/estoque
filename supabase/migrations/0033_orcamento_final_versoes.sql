-- =====================================================================
-- Orcamento final: versoes emitidas por demanda.
--
-- Migration aditiva e nao destrutiva. Nao altera tabelas antigas, nao remove
-- dados e preserva os modulos atuais de laboratorio/projeto como origem.
-- Rollback seguro: remover a tabela `orcamento_final_versoes` apos exportar
-- seus dados, se necessario.
-- =====================================================================

create table if not exists orcamento_final_versoes (
  id                        bigint generated always as identity primary key,
  demanda_id                bigint not null references demandas_propostas(id) on delete restrict,
  versao                    integer not null,
  numero                    text not null,
  status                    text not null default 'emitido'
                            check (status in ('emitido','substituido','cancelado')),
  validade_dias             integer not null default 30,
  valido_ate                date,
  total_laboratorio_custo   numeric not null default 0,
  total_laboratorio_preco   numeric not null default 0,
  total_projeto_custo       numeric not null default 0,
  total_projeto_final       numeric not null default 0,
  total_final               numeric not null default 0,
  snapshot                  jsonb not null default '{}'::jsonb,
  criado_por                uuid references auth.users(id),
  criado_em                 timestamptz not null default now(),
  constraint orcamento_final_versoes_demanda_versao_unique unique (demanda_id, versao),
  constraint orcamento_final_versoes_numero_unique unique (numero)
);

create index if not exists orcamento_final_versoes_demanda_idx
  on orcamento_final_versoes (demanda_id, versao desc);
create index if not exists orcamento_final_versoes_status_idx
  on orcamento_final_versoes (status, criado_em desc);

alter table orcamento_final_versoes enable row level security;
create policy authenticated_all_orcamento_final_versoes on orcamento_final_versoes
  for all to authenticated using (true) with check (true);

grant all on orcamento_final_versoes to service_role;

create trigger aud_orcamento_final_versoes after insert or update or delete on orcamento_final_versoes
  for each row execute function fn_auditoria();
