-- =====================================================================
-- Anexos de orçamento de projeto: arquivos em bucket privado do Storage,
-- com metadados em tabela própria. RLS para authenticated (app interno).
-- =====================================================================

-- Bucket privado.
insert into storage.buckets (id, name, public)
values ('orcamento-anexos', 'orcamento-anexos', false)
on conflict (id) do nothing;

-- Metadados dos anexos.
create table if not exists orcamento_projeto_anexos (
  id                    bigint generated always as identity primary key,
  orcamento_projeto_id  bigint not null references orcamento_projetos(id) on delete cascade,
  path                  text not null,
  nome_arquivo          text not null,
  content_type          text,
  tamanho               bigint,
  criado_por            uuid references auth.users(id),
  criado_em             timestamptz not null default now()
);
create index if not exists orcamento_projeto_anexos_orc_idx
  on orcamento_projeto_anexos (orcamento_projeto_id);

alter table orcamento_projeto_anexos enable row level security;
drop policy if exists authenticated_all_orcamento_projeto_anexos on orcamento_projeto_anexos;
create policy authenticated_all_orcamento_projeto_anexos on orcamento_projeto_anexos
  for all to authenticated using (true) with check (true);

grant all on all tables in schema public to service_role;

drop trigger if exists aud_orcamento_projeto_anexos on orcamento_projeto_anexos;
create trigger aud_orcamento_projeto_anexos
  after insert or update or delete on orcamento_projeto_anexos
  for each row execute function fn_auditoria();

-- RLS no Storage para o bucket (app interno: authenticated total).
drop policy if exists orcamento_anexos_auth_all on storage.objects;
create policy orcamento_anexos_auth_all on storage.objects
  for all to authenticated
  using (bucket_id = 'orcamento-anexos')
  with check (bucket_id = 'orcamento-anexos');
