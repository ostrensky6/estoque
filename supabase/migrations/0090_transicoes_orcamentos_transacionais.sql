-- =====================================================================
-- Transições de status dos orçamentos laboratorial e de projeto.
--
-- Status é um marco de governança: alterações diretas por REST/UI são
-- bloqueadas e toda transição válida deixa evento na mesma transação.
-- =====================================================================

create or replace function public.bloquear_status_direto_orcamento()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status
    and current_setting('app.orcamento_transicao', true) is distinct from 'permitida' then
    raise exception 'O status do orçamento só pode ser alterado por transição transacional.'
      using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function public.bloquear_status_direto_orcamento_projeto()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status
    and current_setting('app.orcamento_projeto_transicao', true) is distinct from 'permitida' then
    raise exception 'O status do orçamento de projeto só pode ser alterado por transição transacional.'
      using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function public.transicionar_orcamento(
  p_orcamento_id bigint,
  p_status_destino text,
  p_observacao text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_atual text;
  v_email text := current_setting('request.jwt.claims', true)::jsonb->>'email';
begin
  perform fn_exige_papel('coordenador');

  select status into v_atual from orcamentos where id = p_orcamento_id for update;
  if not found then
    raise exception 'Orçamento não encontrado.' using errcode = 'P0002';
  end if;
  if v_atual = p_status_destino then
    return jsonb_build_object('status_origem', v_atual, 'status_destino', p_status_destino, 'alterado', false);
  end if;
  if not (
    (v_atual = 'rascunho' and p_status_destino in ('enviado', 'cancelado')) or
    (v_atual = 'enviado' and p_status_destino in ('aprovado', 'recusado', 'cancelado')) or
    (v_atual = 'recusado' and p_status_destino in ('rascunho', 'cancelado')) or
    (v_atual = 'aprovado' and p_status_destino = 'cancelado')
  ) then
    raise exception 'Transição de status não permitida: % -> %.', v_atual, p_status_destino
      using errcode = '22023';
  end if;

  perform set_config('app.orcamento_transicao', 'permitida', true);
  update orcamentos set status = p_status_destino where id = p_orcamento_id;
  insert into eventos_status(entidade, entidade_id, de_status, para_status, usuario, observacao)
  values ('orcamento', p_orcamento_id, v_atual, p_status_destino, v_email, p_observacao);

  return jsonb_build_object('status_origem', v_atual, 'status_destino', p_status_destino, 'alterado', true);
end $$;

create or replace function public.transicionar_orcamento_projeto(
  p_orcamento_projeto_id bigint,
  p_status_destino text,
  p_observacao text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_atual text;
  v_email text := current_setting('request.jwt.claims', true)::jsonb->>'email';
begin
  perform fn_exige_papel('coordenador');

  select status into v_atual from orcamento_projetos where id = p_orcamento_projeto_id for update;
  if not found then
    raise exception 'Orçamento de projeto não encontrado.' using errcode = 'P0002';
  end if;
  if v_atual = p_status_destino then
    return jsonb_build_object('status_origem', v_atual, 'status_destino', p_status_destino, 'alterado', false);
  end if;
  if not (
    (v_atual = 'rascunho' and p_status_destino in ('enviado', 'cancelado')) or
    (v_atual = 'enviado' and p_status_destino in ('aprovado', 'recusado', 'cancelado')) or
    (v_atual = 'recusado' and p_status_destino in ('rascunho', 'cancelado')) or
    (v_atual = 'aprovado' and p_status_destino = 'cancelado')
  ) then
    raise exception 'Transição de status não permitida: % -> %.', v_atual, p_status_destino
      using errcode = '22023';
  end if;

  perform set_config('app.orcamento_projeto_transicao', 'permitida', true);
  update orcamento_projetos set status = p_status_destino where id = p_orcamento_projeto_id;
  insert into eventos_status(entidade, entidade_id, de_status, para_status, usuario, observacao)
  values ('orcamento_projeto', p_orcamento_projeto_id, v_atual, p_status_destino, v_email, p_observacao);

  return jsonb_build_object('status_origem', v_atual, 'status_destino', p_status_destino, 'alterado', true);
end $$;

drop trigger if exists trg_bloquear_status_direto_orcamento on public.orcamentos;
create trigger trg_bloquear_status_direto_orcamento
  before update of status on public.orcamentos
  for each row execute function public.bloquear_status_direto_orcamento();

drop trigger if exists trg_bloquear_status_direto_orcamento_projeto on public.orcamento_projetos;
create trigger trg_bloquear_status_direto_orcamento_projeto
  before update of status on public.orcamento_projetos
  for each row execute function public.bloquear_status_direto_orcamento_projeto();

revoke execute on function public.transicionar_orcamento(bigint, text, text) from public, anon;
revoke execute on function public.transicionar_orcamento_projeto(bigint, text, text) from public, anon;
grant execute on function public.transicionar_orcamento(bigint, text, text) to authenticated, service_role;
grant execute on function public.transicionar_orcamento_projeto(bigint, text, text) to authenticated, service_role;
