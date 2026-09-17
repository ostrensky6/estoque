-- Permissoes individuais dos oito cadastros; substitui apenas suas policies de escrita.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
declare
  t text;
  op text;
  p record;
  rel regclass;
begin
  if to_regnamespace('kontrol_private') is not null then
    raise exception '0108: schema privado ja existe; inspecionar antes de aplicar';
  end if;

  -- Falha antes de qualquer DDL se o contrato de perfis/defaults mudou.
  perform papel, permissoes, suspenso from public.perfis where false;
  perform papel, permissoes from public.permissoes_categorias where false;

  foreach t in array array[
    'projetos', 'insumos', 'equipamentos', 'tecnicos',
    'overhead', 'clientes', 'fornecedores', 'locais'
  ] loop
    rel := to_regclass(format('public.%I', t));
    if rel is null or not (select relrowsecurity from pg_catalog.pg_class where oid = rel) then
      raise exception '0108: tabela % ausente ou sem RLS', t;
    end if;
    if not has_table_privilege('authenticated', rel, 'INSERT')
      or not has_table_privilege('authenticated', rel, 'UPDATE')
      or not has_table_privilege('authenticated', rel, 'DELETE') then
      raise exception '0108: grants de escrita divergentes em %', t;
    end if;
    if (select count(*) from pg_catalog.pg_policies
        where schemaname = 'public' and tablename = t
          and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')) <> 3 then
      raise exception '0108: policies de escrita divergentes em %', t;
    end if;
    foreach op in array array['insert', 'update', 'delete'] loop
      select * into p from pg_catalog.pg_policies
      where schemaname = 'public' and tablename = t
        and policyname = format('rls_coordenador_%s_%s', op, t)
        and cmd = upper(op);
      if not found or p.permissive <> 'PERMISSIVE'
        or p.roles <> array['authenticated']::name[]
        or position('papel_minimo' in coalesce(p.qual, '') || coalesce(p.with_check, '')) = 0 then
        raise exception '0108: policy anterior divergente em %/%', t, op;
      end if;
    end loop;
  end loop;
end $$;

create schema kontrol_private;
revoke all on schema kontrol_private from public, anon, authenticated, service_role;
grant usage on schema kontrol_private to authenticated;

create function kontrol_private.pode_editar_cadastro(p_chave text)
returns boolean
language plpgsql stable security definer
set search_path = pg_catalog
as $$
declare
  v_papel text;
  v_permissoes jsonb;
  v_valor jsonb;
begin
  if p_chave is null
    or p_chave not in ('projetos.editar', 'insumos.editar', 'cadastros.editar')
    or auth.uid() is null then
    return false;
  end if;

  select papel, permissoes into v_papel, v_permissoes
  from public.perfis
  where id = auth.uid() and not suspenso;
  if not found then
    return false;
  end if;
  if v_papel = 'admin' then
    return true;
  end if;
  if v_papel not in ('tecnico', 'coordenador', 'gestor') then
    return false;
  end if;

  if v_permissoes ? p_chave then
    v_valor := v_permissoes -> p_chave;
  else
    select permissoes -> p_chave into v_valor
    from public.permissoes_categorias where papel = v_papel;
  end if;
  if jsonb_typeof(v_valor) = 'boolean' then
    return v_valor = 'true'::jsonb;
  end if;
  return false;
end $$;

revoke all on function kontrol_private.pode_editar_cadastro(text)
  from public, anon, authenticated, service_role;
grant execute on function kontrol_private.pode_editar_cadastro(text) to authenticated;

do $$
declare
  t text;
  chave text;
begin
  foreach t in array array[
    'projetos', 'insumos', 'equipamentos', 'tecnicos',
    'overhead', 'clientes', 'fornecedores', 'locais'
  ] loop
    chave := case t
      when 'projetos' then 'projetos.editar'
      when 'insumos' then 'insumos.editar'
      else 'cadastros.editar'
    end;

    execute format('drop policy if exists %I on public.%I', 'rls_coordenador_insert_' || t, t);
    execute format('drop policy if exists %I on public.%I', 'rls_coordenador_update_' || t, t);
    execute format('drop policy if exists %I on public.%I', 'rls_coordenador_delete_' || t, t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (kontrol_private.pode_editar_cadastro(%L))',
      'rls_permissao_insert_' || t, t, chave
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (kontrol_private.pode_editar_cadastro(%L)) with check (kontrol_private.pode_editar_cadastro(%L))',
      'rls_permissao_update_' || t, t, chave, chave
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (kontrol_private.pode_editar_cadastro(%L))',
      'rls_permissao_delete_' || t, t, chave
    );
  end loop;
end $$;

commit;
