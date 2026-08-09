-- =====================================================================
-- Blindagem do ciclo operacional do planejamento.
--
-- As transições legítimas já são realizadas por RPCs security definer
-- (reserva, baixa/início, liberação/cancelamento e conclusão). Este
-- gatilho fecha a brecha de UPDATE direto da coluna de status pela API.
-- =====================================================================

create or replace function public.bloquear_status_operacional_direto_planejamento()
returns trigger
language plpgsql
as $$
begin
  if new.status_operacional is not distinct from old.status_operacional then
    return new;
  end if;

  if current_setting('app.planejamento_transicao', true) = 'permitida' then
    return new;
  end if;

  -- As RPCs operacionais existentes são security definer, pertencem ao
  -- proprietário postgres e usam search_path fixo. Usuários autenticados
  -- e service_role não recebem esse salvo-conduto para UPDATE direto.
  if current_user = 'postgres' then
    return new;
  end if;

  raise exception 'O status operacional do planejamento só pode ser alterado por RPC transacional.'
    using errcode = '42501';
end $$;

drop trigger if exists trg_bloquear_status_operacional_direto_planejamento on public.planejamento;
create trigger trg_bloquear_status_operacional_direto_planejamento
  before update of status_operacional on public.planejamento
  for each row execute function public.bloquear_status_operacional_direto_planejamento();

revoke execute on function public.marcar_planejamento_reservado(bigint) from public, anon;
revoke execute on function public.marcar_planejamento_em_execucao(bigint) from public, anon;
revoke execute on function public.cancelar_planejamento_operacional(bigint) from public, anon;
revoke execute on function public.concluir_planejamento(bigint) from public, anon;
revoke execute on function public.reservar_plano(bigint, jsonb) from public, anon;
revoke execute on function public.dar_baixa_plano(bigint) from public, anon;
revoke execute on function public.liberar_plano(bigint) from public, anon;

grant execute on function public.marcar_planejamento_reservado(bigint) to authenticated, service_role;
grant execute on function public.marcar_planejamento_em_execucao(bigint) to authenticated, service_role;
grant execute on function public.cancelar_planejamento_operacional(bigint) to authenticated, service_role;
grant execute on function public.concluir_planejamento(bigint) to authenticated, service_role;
grant execute on function public.reservar_plano(bigint, jsonb) to authenticated, service_role;
grant execute on function public.dar_baixa_plano(bigint) to authenticated, service_role;
grant execute on function public.liberar_plano(bigint) to authenticated, service_role;
