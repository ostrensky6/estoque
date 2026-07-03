-- =====================================================================
-- Suprimentos: recebimentos e planejamento em fluxos transacionais.
--
-- Centraliza lote + vinculo do item + status do pedido/plano em uma unica
-- transacao no banco. As server actions continuam validando entrada, mas a
-- integridade operacional fica protegida contra POST direto.
-- =====================================================================

create or replace function receber_item_pedido_compra(
  p_pedido_id bigint,
  p_item_id bigint,
  p_quantidade numeric default null,
  p_validade date default null,
  p_codigo text default null
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_quantidade numeric;
  v_lote_id bigint;
begin
  perform fn_exige_papel('coordenador');

  select
    pi.id,
    pi.pedido_id,
    pi.insumo_id,
    pi.quantidade,
    pi.custo_unitario_estimado,
    pi.lote_id,
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
    pi.status as pedido_status
  into v_item
  from pedidos_internos_itens pii
  join pedidos_internos pi on pi.id = pii.pedido_interno_id
  where pii.id = p_item_id
    and pii.pedido_interno_id = p_pedido_id
  for update of pii, pi;

  if not found then
    raise exception 'Item do pedido interno nao encontrado.' using errcode = 'P0002';
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
      and recebido_em is null
  ) into v_tudo_recebido;

  update pedidos_internos
     set recebido_em = case when v_tudo_recebido then coalesce(recebido_em, now()) else null end,
         recebido_por = case when v_tudo_recebido then p_responsavel else null end
   where id = p_pedido_id;

  return v_lote_id;
end $$;

create or replace function reservar_plano(p_planejamento_id bigint, p_itens jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  perform fn_exige_papel('tecnico');

  select status_operacional
    into v_status
  from planejamento
  where id = p_planejamento_id
  for update;

  if not found then
    raise exception 'Planejamento nao encontrado.' using errcode = 'P0002';
  end if;
  if v_status not in ('rascunho','reservado') then
    raise exception 'Status do planejamento nao permite reservar insumos.' using errcode = '22023';
  end if;

  delete from reservas_estoque
  where planejamento_id = p_planejamento_id
    and status = 'reservado';

  insert into reservas_estoque(planejamento_id, insumo_id, quantidade)
  select p_planejamento_id, (x->>'insumo_id')::bigint, (x->>'quantidade')::numeric
  from jsonb_array_elements(p_itens) x
  where (x->>'quantidade')::numeric > 0;

  update planejamento
     set status_operacional = 'reservado',
         reservado_em = coalesce(reservado_em, now())
   where id = p_planejamento_id;
end $$;

create or replace function dar_baixa_plano(p_planejamento_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  l record;
  v_status text;
  v_rem numeric;
  v_take numeric;
  v_short jsonb := '[]'::jsonb;
  v_validade_apos_abertura date;
begin
  perform fn_exige_papel('tecnico');

  select status_operacional
    into v_status
  from planejamento
  where id = p_planejamento_id
  for update;

  if not found then
    raise exception 'Planejamento nao encontrado.' using errcode = 'P0002';
  end if;
  if v_status <> 'reservado' then
    raise exception 'Reserve os insumos antes de iniciar o planejamento.' using errcode = '22023';
  end if;

  for r in select * from reservas_estoque
           where planejamento_id = p_planejamento_id and status = 'reservado'
           for update loop
    v_rem := r.quantidade;
    for l in
      select le.*, i.validade_apos_abertura_dias
      from lotes_estoque le
      join insumos i on i.id = le.insumo_id
      where le.insumo_id = r.insumo_id
        and le.quantidade_atual > 0
        and le.status in ('aceito','em_uso')
        and (menor_validade(le.validade, le.validade_apos_abertura) is null
             or menor_validade(le.validade, le.validade_apos_abertura) >= current_date)
      order by menor_validade(le.validade, le.validade_apos_abertura) nulls last, le.id
      for update of le
    loop
      exit when v_rem <= 0;
      v_take := least(v_rem, l.quantidade_atual);
      v_validade_apos_abertura :=
        case
          when l.validade_apos_abertura is not null then l.validade_apos_abertura
          when l.validade_apos_abertura_dias is not null and l.validade_apos_abertura_dias > 0
            then current_date + l.validade_apos_abertura_dias
          else null
        end;

      update lotes_estoque
         set quantidade_atual = quantidade_atual - v_take,
             status = case when quantidade_atual - v_take <= 0 then 'consumido' else 'em_uso' end,
             data_abertura = coalesce(data_abertura, current_date),
             validade_apos_abertura = coalesce(validade_apos_abertura, v_validade_apos_abertura)
       where id = l.id;

      insert into estoque_movimentacoes(insumo_id, tipo, quantidade, custo_unitario, motivo, referencia, lote_id)
      values (r.insumo_id, 'saida', v_take, l.custo_unitario,
              'baixa analise', 'plano ' || p_planejamento_id, l.id);
      v_rem := v_rem - v_take;
    end loop;

    update reservas_estoque set status = 'consumido' where id = r.id;

    if v_rem > 0 then
      v_short := v_short || jsonb_build_object('insumo_id', r.insumo_id, 'falta', v_rem);
    end if;
  end loop;

  update planejamento
     set status_operacional = 'em_execucao',
         iniciado_em = coalesce(iniciado_em, now())
   where id = p_planejamento_id;

  return jsonb_build_object('shortfalls', v_short);
end $$;

create or replace function liberar_plano(p_planejamento_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  perform fn_exige_papel('coordenador');

  select status_operacional
    into v_status
  from planejamento
  where id = p_planejamento_id
  for update;

  if not found then
    raise exception 'Planejamento nao encontrado.' using errcode = 'P0002';
  end if;
  if v_status not in ('reservado','cancelado') then
    raise exception 'Apenas planejamentos reservados podem liberar reservas.' using errcode = '22023';
  end if;

  update reservas_estoque
     set status = 'liberado'
   where planejamento_id = p_planejamento_id
     and status = 'reservado';

  update planejamento
     set status_operacional = 'cancelado'
   where id = p_planejamento_id;
end $$;

create or replace function concluir_planejamento(p_planejamento_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  perform fn_exige_papel('tecnico');

  select status_operacional
    into v_status
  from planejamento
  where id = p_planejamento_id
  for update;

  if not found then
    raise exception 'Planejamento nao encontrado.' using errcode = 'P0002';
  end if;
  if v_status <> 'em_execucao' then
    raise exception 'Apenas planejamentos em execucao podem ser concluidos.' using errcode = '22023';
  end if;

  update planejamento
     set status_operacional = 'concluido',
         concluido_em = coalesce(concluido_em, now())
   where id = p_planejamento_id;
end $$;

grant execute on function receber_item_pedido_compra(bigint,bigint,numeric,date,text) to authenticated, service_role;
grant execute on function receber_item_pedido_interno(bigint,bigint,bigint,numeric,date,numeric,text,text,text,text) to authenticated, service_role;
grant execute on function reservar_plano(bigint,jsonb) to authenticated, service_role;
grant execute on function dar_baixa_plano(bigint) to authenticated, service_role;
grant execute on function liberar_plano(bigint) to authenticated, service_role;
grant execute on function concluir_planejamento(bigint) to authenticated, service_role;
