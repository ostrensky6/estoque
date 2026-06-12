-- =====================================================================
-- Privilégios e RLS
-- O Supabase expõe o schema public via PostgREST usando os papéis
-- anon / authenticated. As tabelas criadas pela migração precisam de
-- GRANT explícito; sem isso o PostgREST retorna "permission denied".
-- =====================================================================

grant usage on schema public to anon, authenticated, service_role;

grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

-- Tabelas futuras herdam os mesmos privilégios
alter default privileges in schema public
  grant select on tables to anon, authenticated;
alter default privileges in schema public
  grant insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;

-- ---- RLS: liga em todas as tabelas e define políticas ----------------
-- authenticated: acesso total (app interno, ~15 usuários do laboratório).
-- anon: somente leitura dos catálogos (temporário, p/ dev antes da auth).
do $$
declare
  t text;
  catalogos text[] := array[
    'parametros','analises','etapas','equipamentos','equipamento_analise',
    'tecnicos','overhead','insumos','insumo_analise'
  ];
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security;', t);

    execute format($f$
      create policy "authenticated_all_%1$s" on public.%1$I
        for all to authenticated using (true) with check (true);
    $f$, t);

    if t = any(catalogos) then
      execute format($f$
        create policy "anon_read_%1$s" on public.%1$I
          for select to anon using (true);
      $f$, t);
    end if;
  end loop;
end $$;
