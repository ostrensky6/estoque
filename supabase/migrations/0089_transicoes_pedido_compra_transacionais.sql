-- =====================================================================
-- Transições administrativas de compras formais.
--
-- Impede que clientes atualizem status diretamente e concentra a
-- validação, atualização e histórico em uma única transação.
-- =====================================================================

create or replace function public.bloquear_status_direto_pedido_compra()
returns trigger
language plpgsql
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if current_setting('app.pedido_compra_transicao', true) = 'permitida' then
    return new;
  end if;

  -- As funções operacionais existentes são security definer e fazem a
  -- conclusão por recebimento e o cancelamento sincronizado do pedido interno.
  -- Clientes autenticados não executam como o proprietário postgres.
  if current_user = 'postgres' and new.status in ('recebido', 'cancelado') then
    return new;
  end if;

  raise exception 'O status do pedido de compra só pode ser alterado por transição transacional.'
    using errcode = '42501';
end $$;

create or replace function public.transicionar_pedido_compra(
  p_pedido_id bigint,
  p_status_destino text,
  p_observacao text default null,
  p_data_prevista_entrega date default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido record;
  v_email text := current_setting('request.jwt.claims', true)::jsonb->>'email';
  v_hoje date := current_date;
begin
  perform fn_exige_papel('coordenador');

  select id, status
    into v_pedido
  from pedidos_compra
  where id = p_pedido_id
  for update;

  if not found then
    raise exception 'Pedido de compra não encontrado.' using errcode = 'P0002';
  end if;

  if not (
    (v_pedido.status = 'solicitado' and p_status_destino = 'aprovado') or
    (v_pedido.status = 'aprovado' and p_status_destino = 'enviado') or
    (v_pedido.status = 'enviado' and p_status_destino = 'em_transito') or
    (v_pedido.status in ('solicitado', 'aprovado', 'enviado', 'em_transito') and p_status_destino = 'cancelado')
  ) then
    raise exception 'Transição de status não permitida: % -> %.', v_pedido.status, p_status_destino
      using errcode = '22023';
  end if;

  if p_status_destino = 'cancelado' and exists (
    select 1 from pedidos_compra_itens
    where pedido_id = p_pedido_id and lote_id is not null
  ) then
    raise exception 'Pedido com item recebido não pode ser cancelado.' using errcode = '22023';
  end if;

  perform set_config('app.pedido_compra_transicao', 'permitida', true);
  update pedidos_compra
     set status = p_status_destino,
         aprovador = case when p_status_destino = 'aprovado' then v_email else aprovador end,
         data_aprovacao = case when p_status_destino = 'aprovado' then v_hoje else data_aprovacao end,
         data_prevista_entrega = case
           when p_status_destino = 'aprovado' then p_data_prevista_entrega
           else data_prevista_entrega
         end
   where id = p_pedido_id;

  insert into eventos_status(entidade, entidade_id, de_status, para_status, usuario, observacao)
  values ('pedido_compra', p_pedido_id, v_pedido.status, p_status_destino, v_email, p_observacao);

  return jsonb_build_object(
    'status_origem', v_pedido.status,
    'status_destino', p_status_destino,
    'data_prevista_entrega', p_data_prevista_entrega
  );
end $$;

drop trigger if exists trg_bloquear_status_direto_pedido_compra on public.pedidos_compra;
create trigger trg_bloquear_status_direto_pedido_compra
  before update of status on public.pedidos_compra
  for each row execute function public.bloquear_status_direto_pedido_compra();

revoke execute on function public.transicionar_pedido_compra(bigint, text, text, date) from public, anon;
grant execute on function public.transicionar_pedido_compra(bigint, text, text, date) to authenticated, service_role;
