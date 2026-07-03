-- =====================================================================
-- Suprimentos: amarra sequencial entre pedido interno, compra formal e
-- recebimento.
-- =====================================================================

alter table pedidos_compra_itens
  add column if not exists pedido_interno_item_id bigint references pedidos_internos_itens(id) on delete set null;

create index if not exists pedidos_compra_itens_pedido_interno_item_idx
  on pedidos_compra_itens(pedido_interno_item_id);

create or replace function receber_item_pedido_compra(
  p_pedido_id bigint,
  p_item_id bigint,
  p_quantidade numeric default null,
  p_validade date default null,
  p_codigo text default null,
  p_responsavel text default null
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_quantidade numeric;
  v_lote_id bigint;
  v_pedido_interno_id bigint;
  v_tudo_recebido boolean;
begin
  perform fn_exige_papel('coordenador');

  select
    pi.id,
    pi.pedido_id,
    pi.insumo_id,
    pi.quantidade,
    pi.custo_unitario_estimado,
    pi.lote_id,
    pi.pedido_interno_item_id,
    p.status as pedido_status,
    p.projeto,
    f.nome as fornecedor,
    i.categoria_compra
  into v_item
  from pedidos_compra_itens pi
  join pedidos_compra p on p.id = pi.pedido_id
  join insumos i on i.id = pi.insumo_id
  left join fornecedores f on f.id = p.fornecedor_id
  where pi.id = p_item_id
    and pi.pedido_id = p_pedido_id
  for update of pi, p;

  if not found then
    raise exception 'Item do pedido de compra nao encontrado.' using errcode = 'P0002';
  end if;
  if v_item.lote_id is not null then
    raise exception 'Item ja recebido.' using errcode = '22023';
  end if;
  if v_item.pedido_status not in ('aprovado','enviado','em_transito') then
    raise exception 'Status do pedido nao permite recebimento.' using errcode = '22023';
  end if;

  v_quantidade := coalesce(p_quantidade, v_item.quantidade);
  if v_quantidade is null or v_quantidade <= 0 then
    raise exception 'Quantidade recebida deve ser maior que zero.' using errcode = '22023';
  end if;
  if v_quantidade < v_item.quantidade then
    raise exception 'Recebimento parcial ainda nao e suportado para este fluxo.' using errcode = '22023';
  end if;
  if v_item.categoria_compra = 'critico' and p_validade is null then
    raise exception 'Validade e obrigatoria para receber insumo critico.' using errcode = '22023';
  end if;

  insert into lotes_estoque(
    insumo_id,
    codigo_lote,
    validade,
    quantidade_inicial,
    quantidade_atual,
    custo_unitario,
    fornecedor,
    projeto,
    status
  )
  values (
    v_item.insumo_id,
    nullif(btrim(p_codigo), ''),
    p_validade,
    v_quantidade,
    v_quantidade,
    v_item.custo_unitario_estimado,
    v_item.fornecedor,
    v_item.projeto,
    'quarentena'
  )
  returning id into v_lote_id;

  insert into estoque_movimentacoes(insumo_id, tipo, quantidade, custo_unitario, motivo, lote_id)
  values (v_item.insumo_id, 'entrada', v_quantidade, v_item.custo_unitario_estimado, 'compra/recebimento', v_lote_id);

  update pedidos_compra_itens
     set lote_id = v_lote_id,
         quantidade_recebida = v_quantidade,
         divergencia_recebimento = case
           when v_quantidade <> v_item.quantidade
             then 'Pedido: ' || v_item.quantidade || '; recebido: ' || v_quantidade
           else null
         end
   where id = p_item_id
     and pedido_id = p_pedido_id;

  if v_item.pedido_interno_item_id is not null then
    update pedidos_internos_itens
       set insumo_id = v_item.insumo_id,
           lote_id = v_lote_id,
           quantidade_recebida = v_quantidade,
           divergencia_recebimento = case
             when v_quantidade <> quantidade
               then 'Pedido: ' || quantidade || '; recebido: ' || v_quantidade
             else null
           end,
           recebido_em = now(),
           recebido_por = p_responsavel
     where id = v_item.pedido_interno_item_id
     returning pedido_interno_id into v_pedido_interno_id;

    if v_pedido_interno_id is not null then
      select not exists (
        select 1
        from pedidos_internos_itens
        where pedido_interno_id = v_pedido_interno_id
          and tipo = 'material'
          and recebido_em is null
      ) into v_tudo_recebido;

      update pedidos_internos
         set recebido_em = case when v_tudo_recebido then coalesce(recebido_em, now()) else null end,
             recebido_por = case when v_tudo_recebido then p_responsavel else null end
       where id = v_pedido_interno_id;
    end if;
  end if;

  if not exists (
    select 1
    from pedidos_compra_itens
    where pedido_id = p_pedido_id
      and lote_id is null
  ) then
    update pedidos_compra
       set status = 'recebido'
     where id = p_pedido_id;
  end if;

  return v_lote_id;
end $$;

create or replace function receber_item_pedido_interno(
  p_pedido_id bigint,
  p_item_id bigint,
  p_insumo_id bigint,
  p_quantidade numeric,
  p_validade date default null,
  p_custo numeric default null,
  p_codigo text default null,
  p_fornecedor text default null,
  p_projeto text default null,
  p_responsavel text default null
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_insumo record;
  v_lote_id bigint;
  v_tudo_recebido boolean;
begin
  perform fn_exige_papel('tecnico');

  if p_insumo_id is null then
    raise exception 'Insumo e obrigatorio para receber o item.' using errcode = '22023';
  end if;
  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'Quantidade recebida deve ser maior que zero.' using errcode = '22023';
  end if;
  if p_custo is not null and p_custo < 0 then
    raise exception 'Custo unitario nao pode ser negativo.' using errcode = '22023';
  end if;

  select
    pii.id,
    pii.pedido_interno_id,
    pii.quantidade,
    pii.recebido_em,
    pii.lote_id,
    pi.status as pedido_status,
    exists (
      select 1
      from pedidos_compra_itens pci
      where pci.pedido_interno_item_id = pii.id
        and pci.lote_id is null
    ) as compra_formal_pendente
  into v_item
  from pedidos_internos_itens pii
  join pedidos_internos pi on pi.id = pii.pedido_interno_id
  where pii.id = p_item_id
    and pii.pedido_interno_id = p_pedido_id
  for update of pii, pi;

  if not found then
    raise exception 'Item do pedido interno nao encontrado.' using errcode = 'P0002';
  end if;
  if v_item.compra_formal_pendente then
    raise exception 'Item vinculado a compra formal deve ser recebido pelo pedido de compra.' using errcode = '22023';
  end if;
  if v_item.recebido_em is not null or v_item.lote_id is not null then
    raise exception 'Item ja recebido.' using errcode = '22023';
  end if;
  if v_item.pedido_status not in (
    'aprovado_para_compra',
    'compra_fechada',
    'encaminhado_instituicao',
    'aguardando_pagamento_nf',
    'compra_concluida'
  ) then
    raise exception 'Status do pedido interno nao permite recebimento.' using errcode = '22023';
  end if;
  if p_quantidade < v_item.quantidade then
    raise exception 'Recebimento parcial ainda nao e suportado para este fluxo.' using errcode = '22023';
  end if;

  select categoria_compra
    into v_insumo
  from insumos
  where id = p_insumo_id;

  if not found then
    raise exception 'Insumo nao encontrado.' using errcode = 'P0002';
  end if;
  if v_insumo.categoria_compra = 'critico' and p_validade is null then
    raise exception 'Validade e obrigatoria para receber insumo critico.' using errcode = '22023';
  end if;

  insert into lotes_estoque(
    insumo_id,
    codigo_lote,
    validade,
    quantidade_inicial,
    quantidade_atual,
    custo_unitario,
    fornecedor,
    projeto,
    status
  )
  values (
    p_insumo_id,
    nullif(btrim(p_codigo), ''),
    p_validade,
    p_quantidade,
    p_quantidade,
    p_custo,
    nullif(btrim(p_fornecedor), ''),
    nullif(btrim(p_projeto), ''),
    'quarentena'
  )
  returning id into v_lote_id;

  insert into estoque_movimentacoes(insumo_id, tipo, quantidade, custo_unitario, motivo, lote_id)
  values (p_insumo_id, 'entrada', p_quantidade, p_custo, 'pedido interno/recebimento', v_lote_id);

  update pedidos_internos_itens
     set insumo_id = p_insumo_id,
         lote_id = v_lote_id,
         quantidade_recebida = p_quantidade,
         divergencia_recebimento = case
           when p_quantidade <> v_item.quantidade
             then 'Pedido: ' || v_item.quantidade || '; recebido: ' || p_quantidade
           else null
         end,
         recebido_em = now(),
         recebido_por = p_responsavel
   where id = p_item_id
     and pedido_interno_id = p_pedido_id;

  select not exists (
    select 1
    from pedidos_internos_itens
    where pedido_interno_id = p_pedido_id
      and tipo = 'material'
      and recebido_em is null
  ) into v_tudo_recebido;

  update pedidos_internos
     set recebido_em = case when v_tudo_recebido then coalesce(recebido_em, now()) else null end,
         recebido_por = case when v_tudo_recebido then p_responsavel else null end
   where id = p_pedido_id;

  return v_lote_id;
end $$;

create or replace function cancelar_pedido_interno_operacional(
  p_pedido_id bigint,
  p_responsavel text default null,
  p_observacao text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido record;
  v_compra record;
begin
  perform fn_exige_papel('coordenador');

  select id, status, pedido_compra_id, recebido_em
    into v_pedido
  from pedidos_internos
  where id = p_pedido_id
  for update;

  if not found then
    raise exception 'Pedido interno nao encontrado.' using errcode = 'P0002';
  end if;
  if v_pedido.status in ('cancelado','compra_concluida') then
    raise exception 'Status do pedido interno nao permite cancelamento.' using errcode = '22023';
  end if;
  if v_pedido.recebido_em is not null or exists (
    select 1
    from pedidos_internos_itens
    where pedido_interno_id = p_pedido_id
      and recebido_em is not null
  ) then
    raise exception 'Pedido interno com item recebido nao pode ser cancelado por este fluxo.' using errcode = '22023';
  end if;

  if v_pedido.pedido_compra_id is not null then
    select id, status
      into v_compra
    from pedidos_compra
    where id = v_pedido.pedido_compra_id
    for update;

    if found then
      if v_compra.status = 'recebido' or exists (
        select 1
        from pedidos_compra_itens
        where pedido_id = v_compra.id
          and lote_id is not null
      ) then
        raise exception 'Compra formal com item recebido impede cancelamento do pedido interno.' using errcode = '22023';
      end if;

      if v_compra.status <> 'cancelado' then
        if v_compra.status not in ('solicitado','aprovado','enviado','em_transito') then
          raise exception 'Status da compra formal nao permite cancelamento sincronizado.' using errcode = '22023';
        end if;

        update pedidos_compra
           set status = 'cancelado'
         where id = v_compra.id;
      end if;
    end if;
  end if;

  update pedidos_internos
     set status = 'cancelado'
   where id = p_pedido_id;

  insert into pedidos_internos_aprovacoes(
    pedido_interno_id,
    etapa,
    decisao,
    responsavel,
    papel,
    comentario,
    status_origem,
    status_destino
  )
  values (
    p_pedido_id,
    'Cancelamento',
    'reprovado',
    p_responsavel,
    current_papel(),
    p_observacao,
    v_pedido.status,
    'cancelado'
  );

  return jsonb_build_object(
    'status_origem', v_pedido.status,
    'pedido_compra_id', v_pedido.pedido_compra_id
  );
end $$;

grant execute on function receber_item_pedido_compra(bigint,bigint,numeric,date,text,text) to authenticated, service_role;
grant execute on function receber_item_pedido_interno(bigint,bigint,bigint,numeric,date,numeric,text,text,text,text) to authenticated, service_role;
grant execute on function cancelar_pedido_interno_operacional(bigint,text,text) to authenticated, service_role;
