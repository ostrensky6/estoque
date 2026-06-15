-- =====================================================================
-- Links públicos de aprovação: o cliente abre um link read-only (token) e
-- aprova o orçamento de projeto sem login. O token é guardado como hash
-- SHA-256; a leitura e a aprovação passam por RPCs SECURITY DEFINER que
-- validam o token e contornam a RLS de forma controlada.
-- =====================================================================

create extension if not exists pgcrypto;

create table if not exists orcamento_projeto_links (
  id                    bigint generated always as identity primary key,
  orcamento_projeto_id  bigint not null references orcamento_projetos(id) on delete cascade,
  token_hash            text not null unique,
  criado_por            uuid references auth.users(id),
  criado_em             timestamptz not null default now(),
  expira_em             timestamptz,
  revogado              boolean not null default false,
  aprovado_em           timestamptz,
  aprovado_por          text
);
create index if not exists orcamento_projeto_links_orc_idx
  on orcamento_projeto_links (orcamento_projeto_id);

alter table orcamento_projeto_links enable row level security;
create policy authenticated_all_orcamento_projeto_links on orcamento_projeto_links
  for all to authenticated using (true) with check (true);

grant all on all tables in schema public to service_role;

create trigger aud_orcamento_projeto_links
  after insert or update or delete on orcamento_projeto_links
  for each row execute function fn_auditoria();

-- ---- Leitura pública (read-only) por token ---------------------------
create or replace function ler_orcamento_publico(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_link orcamento_projeto_links; v_orc jsonb;
begin
  select * into v_link from orcamento_projeto_links
   where token_hash = encode(digest(p_token, 'sha256'), 'hex')
     and not revogado
     and (expira_em is null or expira_em > now());
  if not found then return null; end if;

  select to_jsonb(o) into v_orc from orcamento_projetos o
   where id = v_link.orcamento_projeto_id;

  return jsonb_build_object(
    'orcamento', v_orc,
    'analises', (
      select coalesce(jsonb_agg(to_jsonb(a) order by a.id), '[]'::jsonb)
      from orcamento_projeto_analises a
      where a.orcamento_projeto_id = v_link.orcamento_projeto_id
    ),
    'custos', (
      select coalesce(jsonb_agg(to_jsonb(c) order by c.rubrica, c.id), '[]'::jsonb)
      from orcamento_projeto_custos c
      where c.orcamento_projeto_id = v_link.orcamento_projeto_id
    ),
    'aprovado_em', v_link.aprovado_em,
    'aprovado_por', v_link.aprovado_por
  );
end $$;
grant execute on function ler_orcamento_publico(text) to anon, authenticated;

-- ---- Aprovação pública por token -------------------------------------
create or replace function aprovar_orcamento_publico(p_token text, p_nome text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  update orcamento_projeto_links
     set aprovado_em = now(),
         aprovado_por = coalesce(nullif(btrim(p_nome), ''), 'Cliente')
   where token_hash = encode(digest(p_token, 'sha256'), 'hex')
     and not revogado
     and (expira_em is null or expira_em > now())
     and aprovado_em is null
  returning orcamento_projeto_id into v_id;

  if v_id is null then return false; end if;

  update orcamento_projetos set status = 'aprovado' where id = v_id;
  return true;
end $$;
grant execute on function aprovar_orcamento_publico(text, text) to anon, authenticated;
