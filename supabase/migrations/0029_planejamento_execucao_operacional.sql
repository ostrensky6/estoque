-- =====================================================================
-- Planejamento: status operacional explícito para ligar execução e baixa.
--
-- Mantém a compatibilidade com reservas_estoque, mas deixa o ciclo visível:
-- rascunho -> reservado -> em_execucao -> concluido/cancelado.
-- =====================================================================

alter table planejamento
  add column if not exists status_operacional text not null default 'rascunho'
    check (status_operacional in ('rascunho','reservado','em_execucao','concluido','cancelado')),
  add column if not exists reservado_em timestamptz,
  add column if not exists iniciado_em timestamptz,
  add column if not exists concluido_em timestamptz;

create or replace function marcar_planejamento_reservado(p_planejamento_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform fn_exige_papel('tecnico');
  update planejamento
     set status_operacional = 'reservado',
         reservado_em = coalesce(reservado_em, now())
   where id = p_planejamento_id
     and status_operacional in ('rascunho','reservado');
end $$;

create or replace function marcar_planejamento_em_execucao(p_planejamento_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform fn_exige_papel('tecnico');
  update planejamento
     set status_operacional = 'em_execucao',
         iniciado_em = coalesce(iniciado_em, now())
   where id = p_planejamento_id
     and status_operacional in ('rascunho','reservado','em_execucao');
end $$;

create or replace function concluir_planejamento(p_planejamento_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform fn_exige_papel('tecnico');
  update planejamento
     set status_operacional = 'concluido',
         concluido_em = coalesce(concluido_em, now())
   where id = p_planejamento_id
     and status_operacional = 'em_execucao';
end $$;

create or replace function cancelar_planejamento_operacional(p_planejamento_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform fn_exige_papel('coordenador');
  update planejamento
     set status_operacional = 'cancelado'
   where id = p_planejamento_id
     and status_operacional <> 'concluido';
end $$;

grant execute on function marcar_planejamento_reservado(bigint) to authenticated, service_role;
grant execute on function marcar_planejamento_em_execucao(bigint) to authenticated, service_role;
grant execute on function concluir_planejamento(bigint) to authenticated, service_role;
grant execute on function cancelar_planejamento_operacional(bigint) to authenticated, service_role;
