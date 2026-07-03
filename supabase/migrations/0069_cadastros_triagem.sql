-- =====================================================================
-- Cadastros: triagem controlada para codigos desconhecidos.
--
-- Aditiva e idempotente. Mantem codigos desconhecidos em fila segura
-- para analise posterior, sem criar insumo/lote/equipamento/local parcial.
-- =====================================================================

create table if not exists public.cadastros_triagem (
  id bigint generated always as identity primary key,
  codigo text,
  codigo_normalizado text,
  formato text,
  tipo_sugerido text,
  dados_extraidos jsonb not null default '{}'::jsonb,
  status text not null default 'pendente',
  entidade_tipo text,
  entidade_id bigint,
  criado_por text,
  criado_em timestamptz not null default now(),
  resolvido_em timestamptz
);

alter table public.cadastros_triagem
  add column if not exists codigo text,
  add column if not exists codigo_normalizado text,
  add column if not exists formato text,
  add column if not exists tipo_sugerido text,
  add column if not exists dados_extraidos jsonb not null default '{}'::jsonb,
  add column if not exists status text not null default 'pendente',
  add column if not exists entidade_tipo text,
  add column if not exists entidade_id bigint,
  add column if not exists criado_por text,
  add column if not exists criado_em timestamptz not null default now(),
  add column if not exists resolvido_em timestamptz;

update public.cadastros_triagem
   set dados_extraidos = coalesce(dados_extraidos, '{}'::jsonb),
       status = coalesce(status, 'pendente'),
       criado_em = coalesce(criado_em, now());

update public.cadastros_triagem
   set codigo = coalesce(nullif(btrim(codigo), ''), 'TRIAGEM:' || id::text)
 where codigo is null
    or length(btrim(codigo)) = 0;

update public.cadastros_triagem
   set codigo_normalizado = coalesce(
         nullif(btrim(codigo_normalizado), ''),
         upper(btrim(codigo))
       )
 where codigo_normalizado is null
    or length(btrim(codigo_normalizado)) = 0;

alter table public.cadastros_triagem
  alter column codigo set not null,
  alter column codigo_normalizado set not null,
  alter column dados_extraidos set not null,
  alter column status set not null,
  alter column criado_em set not null;

alter table public.cadastros_triagem
  alter column dados_extraidos set default '{}'::jsonb,
  alter column status set default 'pendente',
  alter column criado_em set default now();

alter table public.cadastros_triagem
  drop constraint if exists cadastros_triagem_codigo_not_blank;

alter table public.cadastros_triagem
  add constraint cadastros_triagem_codigo_not_blank
  check (length(btrim(codigo)) > 0 and length(btrim(codigo_normalizado)) > 0);

alter table public.cadastros_triagem
  drop constraint if exists cadastros_triagem_status_check;

alter table public.cadastros_triagem
  add constraint cadastros_triagem_status_check
  check (status in ('pendente', 'em_analise', 'resolvido', 'descartado'));

alter table public.cadastros_triagem
  drop constraint if exists cadastros_triagem_tipo_sugerido_check;

alter table public.cadastros_triagem
  add constraint cadastros_triagem_tipo_sugerido_check
  check (
    tipo_sugerido is null
    or tipo_sugerido in (
      'insumo',
      'insumo_produto',
      'lote',
      'equipamento',
      'equipamento_unidade',
      'local',
      'pedido_compra',
      'pedido_interno',
      'planejamento'
    )
  );

alter table public.cadastros_triagem
  drop constraint if exists cadastros_triagem_entidade_tipo_check;

alter table public.cadastros_triagem
  add constraint cadastros_triagem_entidade_tipo_check
  check (
    entidade_tipo is null
    or entidade_tipo in (
      'insumo',
      'insumo_produto',
      'lote',
      'equipamento',
      'equipamento_unidade',
      'local',
      'pedido_compra',
      'pedido_interno',
      'planejamento'
    )
  );

create unique index if not exists ux_cadastros_triagem_codigo_pendente
  on public.cadastros_triagem (codigo_normalizado)
  where status in ('pendente', 'em_analise');

create index if not exists ix_cadastros_triagem_status
  on public.cadastros_triagem (status, criado_em desc);

create index if not exists ix_cadastros_triagem_entidade
  on public.cadastros_triagem (entidade_tipo, entidade_id);

alter table public.cadastros_triagem enable row level security;

drop policy if exists authenticated_all_cadastros_triagem on public.cadastros_triagem;
create policy authenticated_all_cadastros_triagem on public.cadastros_triagem
  for all to authenticated
  using (true)
  with check (true);

grant all on public.cadastros_triagem to authenticated, service_role;
grant usage, select on sequence public.cadastros_triagem_id_seq to authenticated, service_role;
