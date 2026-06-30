-- =====================================================================
-- Planejamento: conferencia de lotes fisicos antes da baixa.
--
-- Registra separacao/conferencia por scanner sem alterar saldo. A baixa
-- definitiva continua exclusivamente em dar_baixa_plano(p_planejamento_id).
-- =====================================================================

create table if not exists public.planejamento_lote_conferencias (
  id bigint generated always as identity primary key,
  planejamento_id bigint references public.planejamento(id) on delete cascade,
  insumo_id bigint references public.insumos(id) on delete restrict,
  lote_id bigint references public.lotes_estoque(id) on delete restrict,
  quantidade_prevista numeric not null,
  quantidade_conferida numeric not null,
  status text not null default 'conferido',
  justificativa text,
  conferido_por text,
  conferido_em timestamptz not null default now()
);

alter table public.planejamento_lote_conferencias
  add column if not exists planejamento_id bigint references public.planejamento(id) on delete cascade,
  add column if not exists insumo_id bigint references public.insumos(id) on delete restrict,
  add column if not exists lote_id bigint references public.lotes_estoque(id) on delete restrict,
  add column if not exists quantidade_prevista numeric,
  add column if not exists quantidade_conferida numeric,
  add column if not exists status text not null default 'conferido',
  add column if not exists justificativa text,
  add column if not exists conferido_por text,
  add column if not exists conferido_em timestamptz not null default now();

update public.planejamento_lote_conferencias
   set quantidade_prevista = coalesce(quantidade_prevista, 0),
       quantidade_conferida = coalesce(quantidade_conferida, 0),
       status = coalesce(status, 'conferido'),
       conferido_em = coalesce(conferido_em, now());

alter table public.planejamento_lote_conferencias
  alter column planejamento_id set not null,
  alter column insumo_id set not null,
  alter column lote_id set not null,
  alter column quantidade_prevista set not null,
  alter column quantidade_conferida set not null,
  alter column status set not null,
  alter column conferido_em set not null,
  alter column status set default 'conferido',
  alter column conferido_em set default now();

alter table public.planejamento_lote_conferencias
  drop constraint if exists planejamento_lote_conferencias_status_check;

alter table public.planejamento_lote_conferencias
  add constraint planejamento_lote_conferencias_status_check
  check (status in ('conferido', 'excecao_fefo'));

alter table public.planejamento_lote_conferencias
  drop constraint if exists planejamento_lote_conferencias_quantidades_check;

alter table public.planejamento_lote_conferencias
  add constraint planejamento_lote_conferencias_quantidades_check
  check (quantidade_prevista >= 0 and quantidade_conferida >= 0);

alter table public.planejamento_lote_conferencias
  drop constraint if exists planejamento_lote_conferencias_excecao_justificativa_check;

alter table public.planejamento_lote_conferencias
  add constraint planejamento_lote_conferencias_excecao_justificativa_check
  check (status <> 'excecao_fefo' or length(btrim(coalesce(justificativa, ''))) >= 3);

create index if not exists ix_planejamento_lote_conferencias_plano
  on public.planejamento_lote_conferencias (planejamento_id, conferido_em desc);

create index if not exists ix_planejamento_lote_conferencias_insumo
  on public.planejamento_lote_conferencias (planejamento_id, insumo_id);

create index if not exists ix_planejamento_lote_conferencias_lote
  on public.planejamento_lote_conferencias (lote_id);

alter table public.planejamento_lote_conferencias enable row level security;

drop policy if exists authenticated_all_planejamento_lote_conferencias on public.planejamento_lote_conferencias;
create policy authenticated_all_planejamento_lote_conferencias on public.planejamento_lote_conferencias
  for all to authenticated
  using (true)
  with check (true);

grant all on public.planejamento_lote_conferencias to authenticated, service_role;
grant usage, select on sequence public.planejamento_lote_conferencias_id_seq to authenticated, service_role;
