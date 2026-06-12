-- =====================================================================
-- Autenticação e perfis (papéis). Base para autorização, fluxo de
-- compras (aprovação) e auditoria com identidade do usuário.
-- =====================================================================

create table perfis (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  nome       text,
  papel      text not null default 'tecnico'
             check (papel in ('tecnico','coordenador','gestor','admin')),
  criado_em  timestamptz not null default now()
);

alter table perfis enable row level security;
-- todos autenticados leem perfis (para exibir nomes/papéis)
create policy perfis_read on perfis for select to authenticated using (true);
-- cada um edita o próprio; admin edita todos (checado na app por ora)
create policy perfis_write on perfis for all to authenticated using (true) with check (true);

grant select, insert, update, delete on perfis to authenticated, service_role;

-- cria perfil automaticamente quando um usuário é criado no Auth
create or replace function fn_novo_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into perfis(id, email, nome)
  values (new.id, new.email, new.raw_user_meta_data->>'nome')
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function fn_novo_perfil();

-- papel do usuário corrente
create or replace function current_papel()
returns text language sql stable security definer set search_path = public as $$
  select papel from perfis where id = auth.uid();
$$;
grant execute on function current_papel() to authenticated, service_role;

-- auditoria passa a capturar o usuário do JWT (email) quando disponível
create or replace function fn_auditoria()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_user text;
begin
  begin
    v_user := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email';
  exception when others then
    v_user := null;
  end;
  v_user := coalesce(v_user, current_setting('app.usuario', true));

  insert into auditoria(tabela, registro_id, acao, valor_anterior, valor_novo, usuario)
  values (
    tg_table_name,
    (case when tg_op = 'DELETE' then old.id else new.id end)::text,
    lower(tg_op),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('UPDATE','INSERT') then to_jsonb(new) else null end,
    v_user
  );
  return case when tg_op = 'DELETE' then old else new end;
end $$;
