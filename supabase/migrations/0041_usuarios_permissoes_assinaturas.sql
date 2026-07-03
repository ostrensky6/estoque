-- =====================================================================
-- Usuarios: pre-aprovacao, assinaturas e permissoes granulares.
-- Mantem o papel hierarquico existente e adiciona dados complementares
-- usados pelo modulo administrativo e pela emissao de propostas.
-- =====================================================================

alter table perfis
  add column if not exists assinatura_path text,
  add column if not exists assinatura_url text,
  add column if not exists permissoes jsonb not null default '{}'::jsonb;

comment on column perfis.assinatura_path is
  'Caminho da assinatura PNG sem fundo no bucket privado user-signatures.';
comment on column perfis.assinatura_url is
  'Data URL/cache da assinatura PNG processada, para uso em preview/exportacao de documentos.';
comment on column perfis.permissoes is
  'Permissoes efetivas do usuario, agrupadas por modulo/acao. O papel segue como categoria base.';

insert into storage.buckets (id, name, public)
values ('user-signatures', 'user-signatures', false)
on conflict (id) do nothing;

drop policy if exists user_signatures_auth_read on storage.objects;
create policy user_signatures_auth_read on storage.objects
  for select to authenticated
  using (bucket_id = 'user-signatures');

drop policy if exists user_signatures_admin_write on storage.objects;
create policy user_signatures_admin_write on storage.objects
  for all to authenticated
  using (bucket_id = 'user-signatures' and papel_minimo('admin'))
  with check (bucket_id = 'user-signatures' and papel_minimo('admin'));

create table if not exists usuarios_pre_aprovados (
  id bigint generated always as identity primary key,
  nome text not null,
  email text not null unique,
  papel text not null default 'tecnico'
    check (papel in ('tecnico','coordenador','gestor','admin')),
  permissoes jsonb not null default '{}'::jsonb,
  observacao text,
  criado_em timestamptz not null default now()
);

alter table usuarios_pre_aprovados enable row level security;

drop policy if exists usuarios_pre_aprovados_read on usuarios_pre_aprovados;
create policy usuarios_pre_aprovados_read on usuarios_pre_aprovados
  for select to authenticated
  using (papel_minimo('admin'));

drop policy if exists usuarios_pre_aprovados_admin_write on usuarios_pre_aprovados;
create policy usuarios_pre_aprovados_admin_write on usuarios_pre_aprovados
  for all to authenticated
  using (papel_minimo('admin'))
  with check (papel_minimo('admin'));

grant select, insert, update, delete on usuarios_pre_aprovados to authenticated, service_role;

insert into usuarios_pre_aprovados (nome, email, papel, observacao)
values
  ('Vilmar Biernaski', 'vilmarbiernaski@gmail.com', 'tecnico', 'Equipe pre-aprovada a partir dos anexos do modulo de usuarios.'),
  ('Aline Horodesky', 'aline.horo@yahoo.com.br', 'tecnico', 'Equipe pre-aprovada a partir dos anexos do modulo de usuarios.'),
  ('Ana Helena Ferreira Rohling Mader', 'anarohling@gmail.com', 'tecnico', 'Equipe pre-aprovada a partir dos anexos do modulo de usuarios.'),
  ('Ana Silvia Pedrazzani', 'anasilviap@yahoo.com.br', 'tecnico', 'Equipe pre-aprovada a partir dos anexos do modulo de usuarios.'),
  ('Annelise Schneider Mercer', 'mercer@ufpr.br', 'tecnico', 'Equipe pre-aprovada a partir dos anexos do modulo de usuarios.'),
  ('Antonio Ostrensky Neto', 'ostrensky@ufpr.br', 'admin', 'Equipe pre-aprovada a partir dos anexos do modulo de usuarios.'),
  ('Camila Prestes dos Santos Tavares', 'camilapstavares@gmail.com', 'tecnico', 'Equipe pre-aprovada a partir dos anexos do modulo de usuarios.'),
  ('Dany Alberto Mesa Fiaga', 'dmesaf7@gmail.com', 'tecnico', 'Equipe pre-aprovada a partir dos anexos do modulo de usuarios.'),
  ('Giorgi Dal Pont', 'giorgidalpont@gmail.com', 'tecnico', 'Equipe pre-aprovada a partir dos anexos do modulo de usuarios.'),
  ('João Antônio Galiotto Miranda', 'joao.galiotto@ufpr.br', 'tecnico', 'Equipe pre-aprovada a partir dos anexos do modulo de usuarios.'),
  ('Juliana Beltramin De Biasi', 'jubbiasi@gmail.com', 'tecnico', 'Equipe pre-aprovada a partir dos anexos do modulo de usuarios.'),
  ('Marcio Roberto Pie', 'marcio.pie@gmail.com', 'tecnico', 'Equipe pre-aprovada a partir dos anexos do modulo de usuarios.'),
  ('Maria Cristina Santana Borges', 'sb.mariacristina@gmail.com', 'tecnico', 'Equipe pre-aprovada a partir dos anexos do modulo de usuarios.'),
  ('Nathieli Cozer', 'nathielicozer@gmail.com', 'tecnico', 'Equipe pre-aprovada a partir dos anexos do modulo de usuarios.'),
  ('Otto Samuel Mädder Neto', 'ottomader@gmail.com', 'tecnico', 'Equipe pre-aprovada a partir dos anexos do modulo de usuarios.'),
  ('Paula Valeska Stica', 'paula.vska@gmail.com', 'tecnico', 'Equipe pre-aprovada a partir dos anexos do modulo de usuarios.'),
  ('Raphael Orélis Ribeiro', 'raphael.orelis@gmail.com', 'tecnico', 'Equipe pre-aprovada a partir dos anexos do modulo de usuarios.'),
  ('Sandra Ludwig', 'sand.ludwig@gmail.com', 'tecnico', 'Equipe pre-aprovada a partir dos anexos do modulo de usuarios.'),
  ('Ubiratã de Assis Teixeira da Silva', 'ubiratansilva@gmail.com', 'tecnico', 'Equipe pre-aprovada a partir dos anexos do modulo de usuarios.'),
  ('Victória Casanho de Souza', 'victoria.casanho@ufpr.br', 'tecnico', 'Equipe pre-aprovada a partir dos anexos do modulo de usuarios.')
on conflict (email) do update
set nome = excluded.nome,
    papel = excluded.papel,
    observacao = excluded.observacao;
