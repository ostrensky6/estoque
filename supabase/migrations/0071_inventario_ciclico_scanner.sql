-- =====================================================================
-- Inventario ciclico por scanner: campanhas e contagens controladas.
--
-- Aditiva e idempotente. A contagem nao ajusta estoque automaticamente;
-- quando houver ajuste, a RPC wrapper abaixo chama ajustar_saldo_lote,
-- preservando a rotina auditada existente de estoque.
-- =====================================================================

create table if not exists public.inventario_ciclos (
  id bigint generated always as identity primary key,
  nome text,
  status text not null default 'aberto',
  local_id bigint references public.locais(id) on delete set null,
  criado_por text,
  criado_em timestamptz not null default now(),
  fechado_em timestamptz
);

alter table public.inventario_ciclos
  add column if not exists nome text,
  add column if not exists status text not null default 'aberto',
  add column if not exists local_id bigint references public.locais(id) on delete set null,
  add column if not exists criado_por text,
  add column if not exists criado_em timestamptz not null default now(),
  add column if not exists fechado_em timestamptz;

update public.inventario_ciclos
   set status = coalesce(status, 'aberto'),
       criado_em = coalesce(criado_em, now());

alter table public.inventario_ciclos
  alter column status set not null,
  alter column criado_em set not null,
  alter column status set default 'aberto',
  alter column criado_em set default now();

alter table public.inventario_ciclos
  drop constraint if exists inventario_ciclos_status_check;

alter table public.inventario_ciclos
  add constraint inventario_ciclos_status_check
  check (status in ('aberto', 'fechado', 'cancelado'));

create index if not exists ix_inventario_ciclos_status
  on public.inventario_ciclos (status, criado_em desc);

create index if not exists ix_inventario_ciclos_local
  on public.inventario_ciclos (local_id);

create table if not exists public.inventario_contagens (
  id bigint generated always as identity primary key,
  ciclo_id bigint not null references public.inventario_ciclos(id) on delete cascade,
  local_id bigint references public.locais(id) on delete set null,
  lote_id bigint not null references public.lotes_estoque(id) on delete restrict,
  quantidade_sistema numeric not null,
  quantidade_contada numeric not null,
  divergencia numeric not null default 0,
  justificativa text,
  ajuste_aplicado boolean not null default false,
  ajustado_em timestamptz,
  ajustado_por text,
  contado_por text,
  contado_em timestamptz not null default now()
);

alter table public.inventario_contagens
  add column if not exists ciclo_id bigint references public.inventario_ciclos(id) on delete cascade,
  add column if not exists local_id bigint references public.locais(id) on delete set null,
  add column if not exists lote_id bigint references public.lotes_estoque(id) on delete restrict,
  add column if not exists quantidade_sistema numeric,
  add column if not exists quantidade_contada numeric,
  add column if not exists divergencia numeric not null default 0,
  add column if not exists justificativa text,
  add column if not exists ajuste_aplicado boolean not null default false,
  add column if not exists ajustado_em timestamptz,
  add column if not exists ajustado_por text,
  add column if not exists contado_por text,
  add column if not exists contado_em timestamptz not null default now();

update public.inventario_contagens
   set divergencia = coalesce(divergencia, coalesce(quantidade_contada, 0) - coalesce(quantidade_sistema, 0)),
       ajuste_aplicado = coalesce(ajuste_aplicado, false),
       contado_em = coalesce(contado_em, now());

alter table public.inventario_contagens
  alter column ciclo_id set not null,
  alter column lote_id set not null,
  alter column quantidade_sistema set not null,
  alter column quantidade_contada set not null,
  alter column divergencia set not null,
  alter column ajuste_aplicado set not null,
  alter column contado_em set not null,
  alter column divergencia set default 0,
  alter column ajuste_aplicado set default false,
  alter column contado_em set default now();

alter table public.inventario_contagens
  drop constraint if exists inventario_contagens_quantidades_check;

alter table public.inventario_contagens
  add constraint inventario_contagens_quantidades_check
  check (quantidade_sistema >= 0 and quantidade_contada >= 0);

alter table public.inventario_contagens
  drop constraint if exists inventario_contagens_justificativa_divergencia_check;

alter table public.inventario_contagens
  add constraint inventario_contagens_justificativa_divergencia_check
  check (
    abs(divergencia) <= 0.000001
    or length(btrim(coalesce(justificativa, ''))) >= 3
  );

create index if not exists ix_inventario_contagens_ciclo
  on public.inventario_contagens (ciclo_id, contado_em desc);

create index if not exists ix_inventario_contagens_lote
  on public.inventario_contagens (lote_id);

create index if not exists ix_inventario_contagens_local
  on public.inventario_contagens (local_id);

create or replace function public.aplicar_ajuste_inventario_contagem(
  p_contagem_id bigint
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contagem public.inventario_contagens%rowtype;
  v_ciclo_status text;
  v_responsavel text;
begin
  select *
    into v_contagem
    from public.inventario_contagens
   where id = p_contagem_id
   for update;

  if not found then
    raise exception 'Contagem de inventario nao encontrada.' using errcode = '22023';
  end if;

  select status
    into v_ciclo_status
    from public.inventario_ciclos
   where id = v_contagem.ciclo_id
   for update;

  if v_ciclo_status is distinct from 'aberto' then
    raise exception 'Campanha de inventario nao esta aberta.' using errcode = '22023';
  end if;

  if v_contagem.ajuste_aplicado then
    raise exception 'Ajuste ja aplicado para esta contagem.' using errcode = '22023';
  end if;

  if abs(v_contagem.divergencia) <= 0.000001 then
    raise exception 'Contagem sem divergencia nao exige ajuste.' using errcode = '22023';
  end if;

  if nullif(btrim(coalesce(v_contagem.justificativa, '')), '') is null then
    raise exception 'Justificativa obrigatoria para ajuste de inventario.' using errcode = '22023';
  end if;

  v_responsavel := coalesce(
    nullif(auth.jwt() ->> 'email', ''),
    nullif(auth.uid()::text, ''),
    current_user
  );

  perform public.ajustar_saldo_lote(
    v_contagem.lote_id,
    v_contagem.quantidade_contada,
    'inventario ciclo #' || v_contagem.ciclo_id || ': ' || btrim(v_contagem.justificativa)
      || coalesce(' (ajustado por ' || v_responsavel || ')', '')
  );

  update public.inventario_contagens
     set ajuste_aplicado = true,
         ajustado_em = now(),
         ajustado_por = v_responsavel
   where id = v_contagem.id;

  return jsonb_build_object(
    'contagem_id', v_contagem.id,
    'ciclo_id', v_contagem.ciclo_id,
    'lote_id', v_contagem.lote_id,
    'quantidade_contada', v_contagem.quantidade_contada
  );
end;
$$;

alter table public.inventario_ciclos enable row level security;
alter table public.inventario_contagens enable row level security;

drop policy if exists authenticated_all_inventario_ciclos on public.inventario_ciclos;
create policy authenticated_all_inventario_ciclos on public.inventario_ciclos
  for all to authenticated
  using (true)
  with check (true);

drop policy if exists authenticated_all_inventario_contagens on public.inventario_contagens;
create policy authenticated_all_inventario_contagens on public.inventario_contagens
  for all to authenticated
  using (true)
  with check (true);

grant all on public.inventario_ciclos to authenticated, service_role;
grant all on public.inventario_contagens to authenticated, service_role;
grant usage, select on sequence public.inventario_ciclos_id_seq to authenticated, service_role;
grant usage, select on sequence public.inventario_contagens_id_seq to authenticated, service_role;
grant execute on function public.aplicar_ajuste_inventario_contagem(bigint) to authenticated, service_role;
