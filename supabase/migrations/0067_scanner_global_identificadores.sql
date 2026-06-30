create table if not exists identificadores (
  id bigserial primary key,
  tipo text not null,
  valor text not null,
  entidade_tipo text not null,
  entidade_id bigint not null,
  principal boolean not null default false,
  ativo boolean not null default true,
  origem text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint identificadores_tipo_check
    check (tipo in ('qr_interno','codigo_barras','patrimonio','codigo_lote','manual')),
  constraint identificadores_entidade_tipo_check
    check (entidade_tipo in ('lote','insumo','equipamento','local')),
  constraint identificadores_valor_not_blank
    check (length(btrim(valor)) > 0)
);

create unique index if not exists identificadores_valor_ativo_idx
  on identificadores (lower(btrim(valor)))
  where ativo = true;

create unique index if not exists identificadores_principal_entidade_idx
  on identificadores (entidade_tipo, entidade_id)
  where principal = true and ativo = true;

create index if not exists identificadores_entidade_idx
  on identificadores (entidade_tipo, entidade_id);

create table if not exists scan_eventos (
  id bigserial primary key,
  identificador_id bigint references identificadores(id) on delete set null,
  valor_lido text not null,
  entidade_tipo text,
  entidade_id bigint,
  origem text not null default 'global',
  resultado text not null default 'resolvido',
  usuario_id uuid,
  criado_em timestamptz not null default now(),
  constraint scan_eventos_entidade_tipo_check
    check (entidade_tipo is null or entidade_tipo in ('lote','insumo','equipamento','local')),
  constraint scan_eventos_resultado_check
    check (resultado in ('resolvido','nao_encontrado','tipo_invalido'))
);

create index if not exists scan_eventos_criado_em_idx
  on scan_eventos (criado_em desc);

create index if not exists scan_eventos_entidade_idx
  on scan_eventos (entidade_tipo, entidade_id);

alter table identificadores enable row level security;
alter table scan_eventos enable row level security;

drop policy if exists identificadores_select_authenticated on identificadores;
create policy identificadores_select_authenticated on identificadores
  for select to authenticated using (true);

drop policy if exists identificadores_write_coordenador on identificadores;
create policy identificadores_write_coordenador on identificadores
  for all to authenticated
  using (papel_minimo('coordenador'))
  with check (papel_minimo('coordenador'));

drop policy if exists scan_eventos_select_authenticated on scan_eventos;
create policy scan_eventos_select_authenticated on scan_eventos
  for select to authenticated using (true);

drop policy if exists scan_eventos_insert_authenticated on scan_eventos;
create policy scan_eventos_insert_authenticated on scan_eventos
  for insert to authenticated with check (true);

grant select, insert, update, delete on identificadores to authenticated, service_role;
grant select, insert on scan_eventos to authenticated, service_role;
grant usage, select on sequence identificadores_id_seq to authenticated, service_role;
grant usage, select on sequence scan_eventos_id_seq to authenticated, service_role;
