-- =====================================================================
-- Planejamento executivo de estoque
--
-- Separa o planejamento operacional do orçamento: o orçamento pode ser
-- origem auditavel, mas reservas, compras e baixa passam pelo planejamento.
-- Migration aditiva/idempotente, sem remover historico.
-- =====================================================================

alter table public.planejamento
  add column if not exists data_inicio_prevista date,
  add column if not exists data_fim_prevista date,
  add column if not exists prioridade text not null default 'normal',
  add column if not exists origem_planejamento text not null default 'manual',
  add column if not exists orcamento_id bigint references public.orcamentos(id) on delete set null,
  add column if not exists orcamento_projeto_id bigint references public.orcamento_projetos(id) on delete set null,
  add column if not exists planejado_por text,
  add column if not exists reservado_por text,
  add column if not exists validado_em timestamptz,
  add column if not exists validado_por text;

alter table public.planejamento
  drop constraint if exists planejamento_periodo_previsto_check,
  add constraint planejamento_periodo_previsto_check
  check (
    data_inicio_prevista is null
    or data_fim_prevista is null
    or data_fim_prevista >= data_inicio_prevista
  );

alter table public.planejamento
  drop constraint if exists planejamento_prioridade_check,
  add constraint planejamento_prioridade_check
  check (prioridade in ('baixa','normal','alta','urgente'));

alter table public.planejamento
  drop constraint if exists planejamento_origem_check,
  add constraint planejamento_origem_check
  check (origem_planejamento in ('manual','orcamento','orcamento_projeto','demanda_interna','replanejamento'));

create index if not exists planejamento_execucao_periodo_idx
  on public.planejamento (data_inicio_prevista, data_fim_prevista)
  where status_operacional in ('rascunho','reservado','em_execucao');

create index if not exists planejamento_projeto_periodo_idx
  on public.planejamento (projeto_id, data_inicio_prevista, data_fim_prevista);

create index if not exists planejamento_origem_orcamento_idx
  on public.planejamento (orcamento_id)
  where orcamento_id is not null;

create index if not exists planejamento_origem_orcamento_projeto_idx
  on public.planejamento (orcamento_projeto_id)
  where orcamento_projeto_id is not null;

create or replace view public.v_planejamento_compromissos_estoque as
select
  p.id as planejamento_id,
  p.nome as planejamento_nome,
  p.projeto_id,
  pr.nome as projeto_nome,
  p.data_inicio_prevista,
  p.data_fim_prevista,
  p.data_alvo,
  p.prioridade,
  p.status_operacional,
  r.insumo_id,
  i.especificacao,
  i.unidade,
  r.lote_id,
  sum(r.quantidade - coalesce(r.quantidade_consumida, 0)) as quantidade_comprometida
from public.reservas_estoque r
join public.planejamento p on p.id = r.planejamento_id
left join public.projetos pr on pr.id = p.projeto_id
left join public.insumos i on i.id = r.insumo_id
where r.status in ('reservado','parcial')
group by
  p.id,
  p.nome,
  p.projeto_id,
  pr.nome,
  p.data_inicio_prevista,
  p.data_fim_prevista,
  p.data_alvo,
  p.prioridade,
  p.status_operacional,
  r.insumo_id,
  i.especificacao,
  i.unidade,
  r.lote_id;

create or replace function public.validar_planejamento_executivo(p_planejamento_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plano record;
  v_email text := current_setting('request.jwt.claims', true)::jsonb->>'email';
begin
  perform fn_exige_papel('tecnico');

  select id, projeto_id, data_inicio_prevista, data_fim_prevista, status_operacional
    into v_plano
  from planejamento
  where id = p_planejamento_id
  for update;

  if not found then
    raise exception 'Planejamento nao encontrado.' using errcode = 'P0002';
  end if;
  if v_plano.status_operacional not in ('rascunho','reservado') then
    raise exception 'Status do planejamento nao permite validacao operacional.' using errcode = '22023';
  end if;
  if v_plano.projeto_id is null then
    raise exception 'Informe o projeto do planejamento antes de reservar.' using errcode = '22023';
  end if;
  if v_plano.data_inicio_prevista is null or v_plano.data_fim_prevista is null then
    raise exception 'Informe o periodo previsto de execucao antes de reservar.' using errcode = '22023';
  end if;

  update planejamento
     set validado_em = coalesce(validado_em, now()),
         validado_por = coalesce(validado_por, v_email)
   where id = p_planejamento_id;
end $$;

alter view public.v_planejamento_compromissos_estoque set (security_invoker = true);
revoke all on public.v_planejamento_compromissos_estoque from public, anon;
grant select on public.v_planejamento_compromissos_estoque to authenticated, service_role;
revoke execute on function public.validar_planejamento_executivo(bigint) from public, anon;
grant execute on function public.validar_planejamento_executivo(bigint) to authenticated, service_role;
