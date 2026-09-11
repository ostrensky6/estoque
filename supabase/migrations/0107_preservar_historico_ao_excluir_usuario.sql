-- Preserva registros históricos quando uma conta Auth é excluída.
-- As sete colunas registram o ator original, mas não são a identidade forte da
-- linha de negócio; por isso permanecem anuláveis e passam a ON DELETE SET NULL.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create index if not exists orcamento_final_versoes_classificado_por_idx
  on public.orcamento_final_versoes (classificado_por);
create index if not exists orcamento_final_versoes_criado_por_idx
  on public.orcamento_final_versoes (criado_por);
create index if not exists orcamento_fundos_acompanhamento_atualizado_por_idx
  on public.orcamento_fundos_acompanhamento (atualizado_por);
create index if not exists orcamento_parametros_aplicados_criado_por_idx
  on public.orcamento_parametros_aplicados (criado_por);
create index if not exists orcamento_projeto_anexos_criado_por_idx
  on public.orcamento_projeto_anexos (criado_por);
create index if not exists orcamento_projeto_links_criado_por_idx
  on public.orcamento_projeto_links (criado_por);
create index if not exists parametros_economicos_versoes_criado_por_idx
  on public.parametros_economicos_versoes (criado_por);

-- A imutabilidade econômica permanece integral. A única exceção é a ação
-- referencial interna da FK ao remover uma conta Auth: ela pode apenas anular
-- criado_por, sem alterar qualquer outro atributo da versão emitida.
create or replace function public.proteger_orcamento_final_emitido()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  desvinculo_referencial_de_autoria boolean;
begin
  desvinculo_referencial_de_autoria :=
    pg_trigger_depth() > 1
    and old.criado_por is not null
    and new.criado_por is null
    and (to_jsonb(new) - 'criado_por') is not distinct from (to_jsonb(old) - 'criado_por');

  if new.demanda_id is distinct from old.demanda_id
     or new.versao is distinct from old.versao
     or new.numero is distinct from old.numero
     or new.validade_dias is distinct from old.validade_dias
     or new.valido_ate is distinct from old.valido_ate
     or new.total_laboratorio_custo is distinct from old.total_laboratorio_custo
     or new.total_laboratorio_preco is distinct from old.total_laboratorio_preco
     or new.total_projeto_custo is distinct from old.total_projeto_custo
     or new.total_projeto_final is distinct from old.total_projeto_final
     or new.total_final is distinct from old.total_final
     or new.snapshot is distinct from old.snapshot
     or (
       new.criado_por is distinct from old.criado_por
       and not desvinculo_referencial_de_autoria
     )
     or new.criado_em is distinct from old.criado_em then
    raise exception 'Conteudo economico de versao final emitida e imutavel.' using errcode = '42501';
  end if;

  if new.status is distinct from old.status
     and (
       not public.fn_marcador_transacional_autorizado(array[
         'public.aprovar_orcamento_publico(text,text)'::regprocedure,
         'public.transicionar_orcamento_final(bigint,text,text)'::regprocedure,
         'public.duplicar_orcamento_final_transacional(bigint,integer,uuid)'::regprocedure,
         'public.emitir_orcamento_final_transacional(bigint,integer,numeric,numeric,numeric,numeric,numeric,jsonb,jsonb,uuid,text)'::regprocedure,
         'public.emitir_orcamento_final_transacional(bigint,integer,numeric,numeric,numeric,numeric,numeric,jsonb,jsonb,uuid,text,uuid)'::regprocedure
       ])
       or current_setting('app.orcamento_final_transicao', true) is distinct from 'permitida'
     ) then
    raise exception 'Status da versao final exige transicao transacional.' using errcode = '42501';
  end if;

  return new;
end
$$;

revoke all on function public.proteger_orcamento_final_emitido()
  from public, anon, authenticated, service_role;

do $guard_validation$
declare
  guard_function oid := to_regprocedure('public.proteger_orcamento_final_emitido()');
  guard record;
  trigger_count integer;
begin
  if guard_function is null then
    raise exception '0107: função proteger_orcamento_final_emitido ausente';
  end if;

  select p.prosecdef,
         p.proconfig @> array['search_path=pg_catalog, public']::text[] as safe_search_path,
         pg_get_functiondef(p.oid) as definition,
         exists (
           select 1
             from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
            where acl.grantee = 0
              and acl.privilege_type = 'EXECUTE'
         ) as public_execute
    into guard
    from pg_proc p
   where p.oid = guard_function;

  if not found
     or guard.prosecdef
     or not coalesce(guard.safe_search_path, false)
     or guard.public_execute
     or position('pg_trigger_depth() > 1' in guard.definition) = 0
     or position('to_jsonb(new) - ''criado_por''' in guard.definition) = 0
     or position('not desvinculo_referencial_de_autoria' in guard.definition) = 0 then
    raise exception '0107: guarda de imutabilidade divergente ou insegura';
  end if;

  select count(*)
    into trigger_count
    from pg_trigger t
   where t.tgrelid = 'public.orcamento_final_versoes'::regclass
     and t.tgname = 'trg_proteger_orcamento_final_emitido'
     and not t.tgisinternal
     and t.tgenabled = 'O'
     and t.tgfoid = guard_function
     and (t.tgtype & 1) = 1
     and (t.tgtype & 2) = 2
     and (t.tgtype & 16) = 16;

  if trigger_count <> 1 then
    raise exception '0107: trigger de imutabilidade ausente ou divergente';
  end if;
end
$guard_validation$;

do $migration$
declare
  expected record;
  source_relation oid;
  auth_users_relation oid := to_regclass('auth.users');
  source_attnum smallint;
  target_attnum smallint;
  source_not_null boolean;
  fk record;
begin
  if auth_users_relation is null then
    raise exception '0107: tabela auth.users ausente';
  end if;

  select attnum
    into target_attnum
    from pg_attribute
   where attrelid = auth_users_relation
     and attname = 'id'
     and attnum > 0
     and not attisdropped;

  if not found then
    raise exception '0107: coluna auth.users.id ausente';
  end if;

  for expected in
    select * from (values
      ('orcamento_final_versoes', 'classificado_por', 'orcamento_final_versoes_classificado_por_fkey'),
      ('orcamento_final_versoes', 'criado_por', 'orcamento_final_versoes_criado_por_fkey'),
      ('orcamento_fundos_acompanhamento', 'atualizado_por', 'orcamento_fundos_acompanhamento_atualizado_por_fkey'),
      ('orcamento_parametros_aplicados', 'criado_por', 'orcamento_parametros_aplicados_criado_por_fkey'),
      ('orcamento_projeto_anexos', 'criado_por', 'orcamento_projeto_anexos_criado_por_fkey'),
      ('orcamento_projeto_links', 'criado_por', 'orcamento_projeto_links_criado_por_fkey'),
      ('parametros_economicos_versoes', 'criado_por', 'parametros_economicos_versoes_criado_por_fkey')
    ) as definitions(table_name, column_name, constraint_name)
  loop
    source_relation := to_regclass(format('public.%I', expected.table_name));
    if source_relation is null then
      raise exception '0107: tabela public.% ausente', expected.table_name;
    end if;

    select attnum, attnotnull
      into source_attnum, source_not_null
      from pg_attribute
     where attrelid = source_relation
       and attname = expected.column_name
       and attnum > 0
       and not attisdropped;

    if not found then
      raise exception '0107: coluna public.%.% ausente', expected.table_name, expected.column_name;
    end if;
    if source_not_null then
      raise exception '0107: coluna public.%.% deixou de ser anulável', expected.table_name, expected.column_name;
    end if;

    select c.confrelid, c.conkey, c.confkey, c.confdeltype, c.confupdtype,
           c.confmatchtype, c.condeferrable, c.condeferred, c.convalidated
      into fk
      from pg_constraint c
     where c.conrelid = source_relation
       and c.conname = expected.constraint_name
       and c.contype = 'f';

    if not found then
      raise exception '0107: constraint % ausente', expected.constraint_name;
    end if;
    if fk.confrelid is distinct from auth_users_relation
       or fk.conkey is distinct from array[source_attnum]::smallint[]
       or fk.confkey is distinct from array[target_attnum]::smallint[]
       or fk.confupdtype is distinct from 'a'
       or fk.confmatchtype is distinct from 's'
       or fk.condeferrable
       or fk.condeferred then
      raise exception '0107: definição divergente da constraint %', expected.constraint_name;
    end if;
    if fk.confdeltype not in ('a', 'n') then
      raise exception '0107: ação ON DELETE inesperada na constraint %', expected.constraint_name;
    end if;

    if fk.confdeltype = 'a' then
      execute format(
        'alter table public.%I drop constraint %I',
        expected.table_name,
        expected.constraint_name
      );
      execute format(
        'alter table public.%I add constraint %I foreign key (%I) references auth.users(id) on delete set null not valid',
        expected.table_name,
        expected.constraint_name,
        expected.column_name
      );
      execute format(
        'alter table public.%I validate constraint %I',
        expected.table_name,
        expected.constraint_name
      );
    elsif not fk.convalidated then
      execute format(
        'alter table public.%I validate constraint %I',
        expected.table_name,
        expected.constraint_name
      );
    end if;
  end loop;
end
$migration$;

do $validation$
declare
  expected record;
  source_relation oid;
  auth_users_relation oid := to_regclass('auth.users');
  source_attnum smallint;
  target_attnum smallint;
  fk record;
  idx record;
begin
  select attnum
    into target_attnum
    from pg_attribute
   where attrelid = auth_users_relation
     and attname = 'id'
     and attnum > 0
     and not attisdropped;

  for expected in
    select * from (values
      ('orcamento_final_versoes', 'classificado_por', 'orcamento_final_versoes_classificado_por_fkey', 'orcamento_final_versoes_classificado_por_idx'),
      ('orcamento_final_versoes', 'criado_por', 'orcamento_final_versoes_criado_por_fkey', 'orcamento_final_versoes_criado_por_idx'),
      ('orcamento_fundos_acompanhamento', 'atualizado_por', 'orcamento_fundos_acompanhamento_atualizado_por_fkey', 'orcamento_fundos_acompanhamento_atualizado_por_idx'),
      ('orcamento_parametros_aplicados', 'criado_por', 'orcamento_parametros_aplicados_criado_por_fkey', 'orcamento_parametros_aplicados_criado_por_idx'),
      ('orcamento_projeto_anexos', 'criado_por', 'orcamento_projeto_anexos_criado_por_fkey', 'orcamento_projeto_anexos_criado_por_idx'),
      ('orcamento_projeto_links', 'criado_por', 'orcamento_projeto_links_criado_por_fkey', 'orcamento_projeto_links_criado_por_idx'),
      ('parametros_economicos_versoes', 'criado_por', 'parametros_economicos_versoes_criado_por_fkey', 'parametros_economicos_versoes_criado_por_idx')
    ) as definitions(table_name, column_name, constraint_name, index_name)
  loop
    source_relation := to_regclass(format('public.%I', expected.table_name));
    select attnum
      into source_attnum
      from pg_attribute
     where attrelid = source_relation
       and attname = expected.column_name
       and attnum > 0
       and not attisdropped;

    select c.confrelid, c.conkey, c.confkey, c.confdeltype, c.confupdtype,
           c.confmatchtype, c.condeferrable, c.condeferred, c.convalidated
      into fk
      from pg_constraint c
     where c.conrelid = source_relation
       and c.conname = expected.constraint_name
       and c.contype = 'f';

    if not found
       or fk.confrelid is distinct from auth_users_relation
       or fk.conkey is distinct from array[source_attnum]::smallint[]
       or fk.confkey is distinct from array[target_attnum]::smallint[]
       or fk.confdeltype is distinct from 'n'
       or fk.confupdtype is distinct from 'a'
       or fk.confmatchtype is distinct from 's'
       or fk.condeferrable
       or fk.condeferred
       or not fk.convalidated then
      raise exception '0107: validação final falhou para %', expected.constraint_name;
    end if;

    select i.indisvalid, i.indisready, i.indpred is null as unfiltered,
           i.indexprs is null as plain_columns, i.indnkeyatts,
           array(
             select index_key.attnum
               from unnest(i.indkey) with ordinality as index_key(attnum, position)
              order by index_key.position
           )::smallint[] as indexed_columns
      into idx
      from pg_class index_class
      join pg_namespace index_namespace on index_namespace.oid = index_class.relnamespace
      join pg_index i on i.indexrelid = index_class.oid
     where index_namespace.nspname = 'public'
       and index_class.relname = expected.index_name
       and i.indrelid = source_relation;

    if not found
       or not idx.indisvalid
       or not idx.indisready
       or not idx.unfiltered
       or not idx.plain_columns
       or idx.indnkeyatts <> 1
       or idx.indexed_columns is distinct from array[source_attnum]::smallint[] then
      raise exception '0107: índice focal inválido ou divergente: %', expected.index_name;
    end if;
  end loop;
end
$validation$;

commit;
