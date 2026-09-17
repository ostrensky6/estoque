-- Recuperacao da 0108, ensaiada somente em clone descartavel.
-- Em producao, copiar para a PROXIMA migration livre (0109 se ainda livre),
-- revisar e aplicar pelo fluxo normal. Nunca executar SQL avulso, apagar o
-- ledger 0108, reaplicar migrations antigas ou restaurar backup sobre dados vivos.
-- Restaura a regra anterior coordenador+, reintroduzindo o bloqueio conhecido
-- para tecnico com concessao individual. Usar apenas diante de regressao confirmada.
-- Nao altera linhas, papeis, perfis, SELECT, triggers, auditoria ou RLS habilitado.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
declare t text; op text; chave text; p record;
begin
  if to_regprocedure('kontrol_private.pode_editar_cadastro(text)') is null then
    raise exception 'Rollback 0108: helper ausente';
  end if;
  if (select count(*) from pg_proc where pronamespace = 'kontrol_private'::regnamespace) <> 1
    or exists(select 1 from pg_class where relnamespace = 'kontrol_private'::regnamespace)
    or exists(select 1 from pg_type where typnamespace = 'kontrol_private'::regnamespace) then
    raise exception 'Rollback 0108: schema privado possui outros objetos';
  end if;
  foreach t in array array['projetos','insumos','equipamentos','tecnicos',
    'overhead','clientes','fornecedores','locais'] loop
    chave := case t when 'projetos' then 'projetos.editar'
      when 'insumos' then 'insumos.editar' else 'cadastros.editar' end;
    if not (select relrowsecurity from pg_class where oid = to_regclass('public.' || t))
      or (select count(*) from pg_policies where schemaname='public' and tablename=t
        and cmd in ('ALL','INSERT','UPDATE','DELETE')) <> 3 then
      raise exception 'Rollback 0108: catalogo divergente em %',t;
    end if;
    foreach op in array array['insert','update','delete'] loop
      select * into p from pg_policies where schemaname='public' and tablename=t
        and policyname='rls_permissao_' || op || '_' || t and cmd=upper(op);
      if not found or p.permissive <> 'PERMISSIVE'
        or p.roles <> array['authenticated']::name[]
        or (op <> 'insert' and p.qual is distinct from
          format('kontrol_private.pode_editar_cadastro(%L::text)',chave))
        or (op <> 'delete' and p.with_check is distinct from
          format('kontrol_private.pode_editar_cadastro(%L::text)',chave)) then
        raise exception 'Rollback 0108: policy divergente em %/%',t,op;
      end if;
    end loop;
  end loop;
end $$;

do $$
declare t text;
begin
  foreach t in array array['projetos','insumos','equipamentos','tecnicos',
    'overhead','clientes','fornecedores','locais'] loop
    execute format('drop policy %I on public.%I','rls_permissao_insert_'||t,t);
    execute format('drop policy %I on public.%I','rls_permissao_update_'||t,t);
    execute format('drop policy %I on public.%I','rls_permissao_delete_'||t,t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.papel_minimo(''coordenador''))','rls_coordenador_insert_'||t,t);
    execute format('create policy %I on public.%I for update to authenticated using (public.papel_minimo(''coordenador'')) with check (public.papel_minimo(''coordenador''))','rls_coordenador_update_'||t,t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.papel_minimo(''coordenador''))','rls_coordenador_delete_'||t,t);
  end loop;
end $$;

revoke all on function kontrol_private.pode_editar_cadastro(text) from public,anon,authenticated,service_role;
-- RESTRICT aborta e reverte toda a transacao se houver dependencia nao prevista.
drop function kontrol_private.pode_editar_cadastro(text) restrict;
drop schema kontrol_private restrict;
commit;
