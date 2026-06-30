-- Migration: 0063_supabase_heartbeat.sql
-- Cria a tabela técnica de heartbeat para manutenção legítima operacional do projeto Supabase Free.

create table if not exists public.system_heartbeat (
  id text primary key,
  app text not null,
  updated_at timestamptz not null default now(),
  environment text,
  deployment_url text,
  status text not null default 'ok',
  details jsonb not null default '{}'::jsonb
);

alter table public.system_heartbeat enable row level security;

-- Revoga acessos públicos e autenticados de leitura/escrita por padrão
revoke all on table public.system_heartbeat from anon;
revoke all on table public.system_heartbeat from authenticated;

-- Garante acesso total para service_role (usado no backend)
grant all on table public.system_heartbeat to service_role;

-- Insere o registro inicial de forma idempotente
insert into public.system_heartbeat (id, app, status)
values ('kontrol-prod', 'Kontrol', 'ok')
on conflict (id) do nothing;

-- Recarrega o cache do PostgREST conforme o protocolo anti-reset
notify pgrst, 'reload schema';
