-- =====================================================================
-- Estorno transacional de recebimentos de pedidos internos.
--
-- Mantém o lote como histórico descartado, registra a movimentação de
-- estorno e recalcula os resumos do item/pedido sob lock. Nenhum cliente
-- precisa excluir diretamente estoque, movimentações ou recebimentos.
-- =====================================================================

create or replace function public.estornar_recebimento_item_pedido_interno(
  p_pedido_id bigint,
  p_item_id bigint,
  p_recebimento_id bigint default null,
  p_motivo text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_recebimento record;
  v_estornados integer := 0;
  v_total_recebido numeric := 0;
  v_ultimo_lote_id bigint;
  v_ultimo_responsavel text;
  v_item_completo boolean := false;
  v_pedido_completo boolean := false;
  v_email text := current_setting('request.jwt.claims', true)::jsonb->>'email';
  v_motivo text := coalesce(nullif(btrim(p_motivo), ''), 'estorno de recebimento de pedido interno');
begin
  perform fn_exige_papel('coordenador');

  select pii.id, pii.quantidade, pi.status
    into v_item
  from pedidos_internos_itens pii
  join pedidos_internos pi on pi.id = pii.pedido_interno_id
  where pii.id = p_item_id
    and pii.pedido_interno_id = p_pedido_id
  for update of pii, pi;

  if not found then
    raise exception 'Item do pedido interno nao encontrado.' using errcode = 'P0002';
  end if;

  for v_recebimento in
    select id, lote_id, quantidade
    from pedidos_internos_item_recebimentos
    where pedido_interno_id = p_pedido_id
      and pedido_interno_item_id = p_item_id
      and (p_recebimento_id is null or id = p_recebimento_id)
    order by recebido_em desc, id desc
    for update
  loop
    perform estornar_recebimento_lote(
      v_recebimento.lote_id,
      v_motivo || '; pedido ' || p_pedido_id || '; item ' || p_item_id
    );

    delete from pedidos_internos_item_recebimentos
     where id = v_recebimento.id;
    v_estornados := v_estornados + 1;
  end loop;

  if v_estornados = 0 then
    raise exception 'Recebimento ativo nao encontrado para estorno.' using errcode = 'P0002';
  end if;

  select coalesce(sum(quantidade), 0)
    into v_total_recebido
  from pedidos_internos_item_recebimentos
  where pedido_interno_id = p_pedido_id
    and pedido_interno_item_id = p_item_id;

  select lote_id, responsavel
    into v_ultimo_lote_id, v_ultimo_responsavel
  from pedidos_internos_item_recebimentos
  where pedido_interno_id = p_pedido_id
    and pedido_interno_item_id = p_item_id
  order by recebido_em desc, id desc
  limit 1;

  v_item_completo := v_total_recebido >= v_item.quantidade and v_item.quantidade > 0;

  update pedidos_internos_itens
     set lote_id = v_ultimo_lote_id,
         quantidade_recebida = case when v_total_recebido > 0 then v_total_recebido else null end,
         divergencia_recebimento = case
           when v_total_recebido > 0 and not v_item_completo
             then 'Pedido: ' || v_item.quantidade || '; recebido acumulado: ' || v_total_recebido
           else null
         end,
         recebido_em = case when v_item_completo then now() else null end,
         recebido_por = case when v_item_completo then v_ultimo_responsavel else null end
   where id = p_item_id
     and pedido_interno_id = p_pedido_id;

  select not exists (
    select 1
    from pedidos_internos_itens
    where pedido_interno_id = p_pedido_id
      and tipo in ('material', 'equipamento')
      and recebido_em is null
  ) into v_pedido_completo;

  update pedidos_internos
     set recebido_em = case when v_pedido_completo then coalesce(recebido_em, now()) else null end,
         recebido_por = case when v_pedido_completo then coalesce(recebido_por, v_ultimo_responsavel) else null end
   where id = p_pedido_id;

  insert into eventos_status(entidade, entidade_id, de_status, para_status, usuario, observacao)
  values (
    'pedido_interno',
    p_pedido_id,
    v_item.status,
    v_item.status,
    v_email,
    'Estorno transacional de ' || v_estornados || ' recebimento(s) do item ' || p_item_id || '.'
  );
end $$;

revoke execute on function public.estornar_recebimento_item_pedido_interno(bigint, bigint, bigint, text)
  from public, anon;
grant execute on function public.estornar_recebimento_item_pedido_interno(bigint, bigint, bigint, text)
  to authenticated, service_role;
