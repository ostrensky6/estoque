-- =====================================================================
-- Identificacao escaneavel: base tecnica para codigos internos/externos.
--
-- Aditiva e idempotente. Usa referencia polimorfica controlada por
-- entidade_tipo + entidade_id para cobrir entidades operacionais diferentes
-- sem criar estruturas paralelas ou multiplas FKs opcionais.
-- =====================================================================

create table if not exists public.identificadores (
  id bigint generated always as identity primary key,
  codigo text,
  codigo_normalizado text,
  formato text,
  entidade_tipo text,
  entidade_id bigint,
  origem text not null default 'kontrol',
  metadata jsonb not null default '{}'::jsonb,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  criado_por text
);

alter table public.identificadores
  add column if not exists codigo text,
  add column if not exists codigo_normalizado text,
  add column if not exists formato text,
  add column if not exists entidade_tipo text,
  add column if not exists entidade_id bigint,
  add column if not exists origem text not null default 'kontrol',
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists ativo boolean not null default true,
  add column if not exists criado_em timestamptz not null default now(),
  add column if not exists criado_por text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'identificadores'
      and column_name = 'valor'
  ) then
    update public.identificadores
       set codigo = coalesce(codigo, valor),
           codigo_normalizado = coalesce(codigo_normalizado, upper(btrim(valor)))
     where codigo is null
        or codigo_normalizado is null;
  end if;
end $$;

update public.identificadores
   set origem = coalesce(origem, 'kontrol'),
       metadata = coalesce(metadata, '{}'::jsonb);

alter table public.identificadores
  alter column codigo set not null,
  alter column codigo_normalizado set not null,
  alter column entidade_tipo set not null,
  alter column entidade_id set not null,
  alter column origem set not null,
  alter column metadata set not null,
  alter column ativo set not null,
  alter column criado_em set not null;

alter table public.identificadores
  alter column origem set default 'kontrol',
  alter column metadata set default '{}'::jsonb,
  alter column ativo set default true,
  alter column criado_em set default now();

alter table public.identificadores
  drop constraint if exists identificadores_entidade_tipo_check;

alter table public.identificadores
  add constraint identificadores_entidade_tipo_check
  check (
    entidade_tipo in (
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

alter table public.identificadores
  drop constraint if exists identificadores_origem_check;

alter table public.identificadores
  add constraint identificadores_origem_check
  check (origem in ('kontrol', 'fabricante', 'fornecedor', 'gs1', 'manual'));

alter table public.identificadores
  drop constraint if exists identificadores_codigo_not_blank;

alter table public.identificadores
  add constraint identificadores_codigo_not_blank
  check (length(btrim(codigo)) > 0 and length(btrim(codigo_normalizado)) > 0);

create unique index if not exists ux_identificadores_codigo_ativo
  on public.identificadores (codigo_normalizado)
  where ativo = true;

create index if not exists ix_identificadores_entidade
  on public.identificadores (entidade_tipo, entidade_id);

create table if not exists public.scan_eventos (
  id bigint generated always as identity primary key,
  codigo text,
  formato text,
  entidade_tipo text,
  entidade_id bigint,
  acao text not null default 'buscar',
  resultado text not null default 'nao_encontrado',
  contexto jsonb not null default '{}'::jsonb,
  usuario text,
  criado_em timestamptz not null default now()
);

alter table public.scan_eventos
  add column if not exists codigo text,
  add column if not exists formato text,
  add column if not exists entidade_tipo text,
  add column if not exists entidade_id bigint,
  add column if not exists acao text not null default 'buscar',
  add column if not exists resultado text not null default 'nao_encontrado',
  add column if not exists contexto jsonb not null default '{}'::jsonb,
  add column if not exists usuario text,
  add column if not exists criado_em timestamptz not null default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'scan_eventos'
      and column_name = 'valor_lido'
  ) then
    update public.scan_eventos
       set codigo = coalesce(codigo, valor_lido)
     where codigo is null;
  end if;
end $$;

update public.scan_eventos
   set acao = coalesce(acao, 'buscar'),
       resultado = coalesce(resultado, 'nao_encontrado'),
       contexto = coalesce(contexto, '{}'::jsonb),
       criado_em = coalesce(criado_em, now());

alter table public.scan_eventos
  alter column codigo set not null,
  alter column acao set not null,
  alter column resultado set not null,
  alter column contexto set not null,
  alter column criado_em set not null;

alter table public.scan_eventos
  alter column acao set default 'buscar',
  alter column resultado set default 'nao_encontrado',
  alter column contexto set default '{}'::jsonb,
  alter column criado_em set default now();

alter table public.scan_eventos
  drop constraint if exists scan_eventos_entidade_tipo_check;

alter table public.scan_eventos
  add constraint scan_eventos_entidade_tipo_check
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

alter table public.scan_eventos
  drop constraint if exists scan_eventos_resultado_check;

alter table public.scan_eventos
  add constraint scan_eventos_resultado_check
  check (resultado in ('encontrado', 'nao_encontrado', 'erro', 'criado', 'atualizado', 'resolvido', 'tipo_invalido'));

alter table public.scan_eventos
  drop constraint if exists scan_eventos_codigo_not_blank;

alter table public.scan_eventos
  add constraint scan_eventos_codigo_not_blank
  check (length(btrim(codigo)) > 0);

create index if not exists ix_scan_eventos_codigo
  on public.scan_eventos (codigo);

create index if not exists ix_scan_eventos_entidade
  on public.scan_eventos (entidade_tipo, entidade_id);

create index if not exists ix_scan_eventos_criado_em
  on public.scan_eventos (criado_em desc);

alter table public.identificadores enable row level security;
alter table public.scan_eventos enable row level security;

drop policy if exists authenticated_all_identificadores on public.identificadores;
create policy authenticated_all_identificadores on public.identificadores
  for all to authenticated
  using (true)
  with check (true);

drop policy if exists authenticated_all_scan_eventos on public.scan_eventos;
create policy authenticated_all_scan_eventos on public.scan_eventos
  for all to authenticated
  using (true)
  with check (true);

grant all on public.identificadores to authenticated, service_role;
grant all on public.scan_eventos to authenticated, service_role;
grant usage, select on sequence public.identificadores_id_seq to authenticated, service_role;
grant usage, select on sequence public.scan_eventos_id_seq to authenticated, service_role;
