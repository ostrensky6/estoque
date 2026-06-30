-- =====================================================================
-- Defaults editaveis de permissoes por categoria.
-- =====================================================================

create table if not exists permissoes_categorias (
  papel text primary key check (papel in ('tecnico','coordenador','gestor','admin')),
  permissoes jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now()
);

alter table permissoes_categorias enable row level security;

drop policy if exists permissoes_categorias_admin_all on permissoes_categorias;
create policy permissoes_categorias_admin_all on permissoes_categorias
  for all to authenticated
  using (papel_minimo('admin'))
  with check (papel_minimo('admin'));

grant select, insert, update, delete on permissoes_categorias to authenticated, service_role;

insert into permissoes_categorias (papel, permissoes)
values
  ('tecnico', '{
    "orcamentos.visualizar": true,
    "orcamentos.criar_editar": true,
    "orcamentos.emitir": false,
    "orcamentos.cancelar": false,
    "compras.solicitar": true,
    "compras.aprovar": false,
    "estoque.movimentar": true,
    "estoque.descartar_bloquear": false,
    "cadastros.editar": false,
    "usuarios.gerenciar": false,
    "auditoria.visualizar": false
  }'::jsonb),
  ('coordenador', '{
    "orcamentos.visualizar": true,
    "orcamentos.criar_editar": true,
    "orcamentos.emitir": true,
    "orcamentos.cancelar": false,
    "compras.solicitar": true,
    "compras.aprovar": true,
    "estoque.movimentar": true,
    "estoque.descartar_bloquear": false,
    "cadastros.editar": true,
    "usuarios.gerenciar": false,
    "auditoria.visualizar": false
  }'::jsonb),
  ('gestor', '{
    "orcamentos.visualizar": true,
    "orcamentos.criar_editar": true,
    "orcamentos.emitir": true,
    "orcamentos.cancelar": true,
    "compras.solicitar": true,
    "compras.aprovar": true,
    "estoque.movimentar": true,
    "estoque.descartar_bloquear": true,
    "cadastros.editar": true,
    "usuarios.gerenciar": false,
    "auditoria.visualizar": true
  }'::jsonb),
  ('admin', '{
    "orcamentos.visualizar": true,
    "orcamentos.criar_editar": true,
    "orcamentos.emitir": true,
    "orcamentos.cancelar": true,
    "compras.solicitar": true,
    "compras.aprovar": true,
    "estoque.movimentar": true,
    "estoque.descartar_bloquear": true,
    "cadastros.editar": true,
    "usuarios.gerenciar": true,
    "auditoria.visualizar": true
  }'::jsonb)
on conflict (papel) do nothing;
