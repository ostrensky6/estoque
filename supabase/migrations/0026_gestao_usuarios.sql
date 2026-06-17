-- =====================================================================
-- Gestão de usuários pelo administrador.
-- Reflete na tabela perfis o estado de suspensão (espelho do ban do
-- GoTrue, para exibição na tela) e a flag de senha provisória (força a
-- troca de senha no próximo acesso). A aplicação real do bloqueio de
-- login é feita no Auth (ban_duration) via service_role; a flag de
-- senha provisória é lida do user_metadata pelo proxy/middleware.
-- =====================================================================

alter table perfis
  add column if not exists suspenso boolean not null default false,
  add column if not exists senha_provisoria boolean not null default false;

comment on column perfis.suspenso is
  'Espelho do estado de banimento no Auth (login bloqueado). Fonte da verdade no GoTrue; aqui só para exibição.';
comment on column perfis.senha_provisoria is
  'Quando true, o usuário entrou com senha provisória e precisa definir uma senha definitiva antes de usar o app.';

-- O perfil é criado automaticamente pelo trigger on_auth_user_created
-- (fn_novo_perfil). Ao criar usuário com senha provisória, o admin grava
-- também user_metadata.senha_provisoria = true; sincronizamos a coluna
-- no trigger para a tela já refletir o estado sem chamada extra ao Auth.
create or replace function fn_novo_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into perfis(id, email, nome, senha_provisoria)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'nome',
    coalesce((new.raw_user_meta_data->>'senha_provisoria')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end $$;
