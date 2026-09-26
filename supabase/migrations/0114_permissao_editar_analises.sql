-- Relatorio de bugs v5 (item 9): a permissao "Editar analises" passa a valer.
--
-- A escrita no catalogo de analises (analises, etapas, insumo_analise,
-- equipamento_analise) aceitava apenas papel coordenador+; a chave
-- 'analises.editar' da matriz de privilegios nao tinha efeito. Agora vale
-- coordenador+ OU a permissao efetiva 'analises.editar' (regra da 0112:
-- perfil individual antes da categoria; admin sempre). Nenhum acesso
-- existente e retirado.
--
-- Aditiva: nao remove tabelas, colunas, dados, RLS nem gatilhos.
-- Rollback: recriar as policies rls_coordenador_{insert,update,delete}_<tabela>
-- com papel_minimo('coordenador') (como na 0014) e remover as rls_analises_*.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
begin
  if to_regprocedure('kontrol_private.tem_permissao_efetiva(text)') is null
    or to_regclass('public.permissoes_categorias') is null
    or to_regprocedure('public.papel_minimo(text)') is null then
    raise exception '0114: requer as migrations 0014, 0042 e 0112';
  end if;
end $$;

-- Padrao por papel (nao sobrescreve valor definido pelo administrador).
update public.permissoes_categorias
   set permissoes = permissoes || jsonb_build_object('analises.editar', papel in ('coordenador', 'gestor', 'admin')),
       atualizado_em = now()
 where not (permissoes ? 'analises.editar');

create or replace function kontrol_private.pode_editar_analises()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.papel_minimo('coordenador') or kontrol_private.tem_permissao_efetiva('analises.editar');
$$;

revoke all on function kontrol_private.pode_editar_analises() from public, anon, authenticated, service_role;
grant execute on function kontrol_private.pode_editar_analises() to authenticated;

do $$
declare
  t text;
  op text;
  pol record;
begin
  foreach t in array array['analises', 'etapas', 'insumo_analise', 'equipamento_analise'] loop
    if to_regclass(format('public.%I', t)) is null then
      continue;
    end if;
    foreach op in array array['insert', 'update', 'delete'] loop
      select * into pol from pg_catalog.pg_policies
      where schemaname = 'public' and tablename = t
        and policyname = format('rls_coordenador_%s_%s', op, t);
      if not found then
        continue;
      end if;
      execute format('drop policy %I on public.%I', pol.policyname, t);
      if op = 'insert' then
        execute format(
          'create policy %I on public.%I for insert to authenticated with check (kontrol_private.pode_editar_analises())',
          format('rls_analises_insert_%s', t), t);
      elsif op = 'update' then
        execute format(
          'create policy %I on public.%I for update to authenticated using (kontrol_private.pode_editar_analises()) with check (kontrol_private.pode_editar_analises())',
          format('rls_analises_update_%s', t), t);
      else
        execute format(
          'create policy %I on public.%I for delete to authenticated using (kontrol_private.pode_editar_analises())',
          format('rls_analises_delete_%s', t), t);
      end if;
    end loop;
  end loop;
end $$;

commit;
