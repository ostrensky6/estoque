-- =====================================================================
-- Fase 1 (permissões) — matriz papel x capacidade (fonte da verdade do app).
-- Seed reproduz exatamente o comportamento atual (ver plano, Task 2).
-- 'administrador' é forçado no código (sempre true) e não é semeado.
-- =====================================================================
create table if not exists permissoes_papel (
  papel     text not null
            check (papel in ('usuário','coordenador','administrativo','gerente')),
  chave     text not null,
  permitido boolean not null default false,
  primary key (papel, chave)
);

alter table permissoes_papel enable row level security;

drop policy if exists permissoes_read on permissoes_papel;
create policy permissoes_read on permissoes_papel
  for select to authenticated using (true);

drop policy if exists permissoes_admin_write on permissoes_papel;
create policy permissoes_admin_write on permissoes_papel
  for all to authenticated
  using (papel_minimo('administrador'))
  with check (papel_minimo('administrador'));

-- Seed: insere TRUE explicitamente; ausência = negado (default false na leitura).
insert into permissoes_papel (papel, chave, permitido) values
  ('usuário','analises.ver',true),('coordenador','analises.ver',true),('administrativo','analises.ver',true),('gerente','analises.ver',true),
  ('coordenador','analises.editar',true),('gerente','analises.editar',true),
  ('usuário','insumos.ver',true),('coordenador','insumos.ver',true),('administrativo','insumos.ver',true),('gerente','insumos.ver',true),
  ('coordenador','insumos.editar',true),('gerente','insumos.editar',true),
  ('usuário','custeio.ver',true),('coordenador','custeio.ver',true),('administrativo','custeio.ver',true),('gerente','custeio.ver',true),
  ('usuário','estoque.ver',true),('coordenador','estoque.ver',true),('administrativo','estoque.ver',true),('gerente','estoque.ver',true),
  ('coordenador','estoque.lote.aceitar',true),('gerente','estoque.lote.aceitar',true),
  ('gerente','estoque.lote.gerir',true),
  ('usuário','planejamento.ver',true),('coordenador','planejamento.ver',true),('administrativo','planejamento.ver',true),('gerente','planejamento.ver',true),
  ('usuário','planejamento.editar',true),('coordenador','planejamento.editar',true),('gerente','planejamento.editar',true),
  ('usuário','pedido.ver',true),('coordenador','pedido.ver',true),('administrativo','pedido.ver',true),('gerente','pedido.ver',true),
  ('usuário','pedido.criar',true),('coordenador','pedido.criar',true),('gerente','pedido.criar',true),
  ('coordenador','pedido.aprovar',true),('gerente','pedido.aprovar',true),
  ('usuário','compras.ver',true),('coordenador','compras.ver',true),('administrativo','compras.ver',true),('gerente','compras.ver',true),
  ('coordenador','compras.aprovar',true),('gerente','compras.aprovar',true),
  ('coordenador','compras.receber',true),('gerente','compras.receber',true),
  ('coordenador','compras.cancelar',true),('gerente','compras.cancelar',true),
  ('usuário','recebimento.ver',true),('coordenador','recebimento.ver',true),('administrativo','recebimento.ver',true),('gerente','recebimento.ver',true),
  ('coordenador','recebimento.registrar',true),('gerente','recebimento.registrar',true),
  ('usuário','orcamento.ver',true),('coordenador','orcamento.ver',true),('administrativo','orcamento.ver',true),('gerente','orcamento.ver',true),
  ('usuário','orcamento.editar',true),('coordenador','orcamento.editar',true),('gerente','orcamento.editar',true),
  ('gerente','orcamento.parametros.editar',true),
  ('usuário','projetos.ver',true),('coordenador','projetos.ver',true),('administrativo','projetos.ver',true),('gerente','projetos.ver',true),
  ('coordenador','projetos.editar',true),('gerente','projetos.editar',true),
  ('usuário','cadastros.ver',true),('coordenador','cadastros.ver',true),('administrativo','cadastros.ver',true),('gerente','cadastros.ver',true),
  ('coordenador','cadastros.editar',true),('gerente','cadastros.editar',true),
  ('gerente','auditoria.ver',true)
on conflict (papel, chave) do nothing;
-- usuarios.gerir / backups.gerir / privilegios.gerir / configuracoes.ver:
-- nenhum papel <administrador> recebe; ficam negados por ausência.
