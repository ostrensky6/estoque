-- =====================================================================
-- Formalização atômica: pedido interno -> compra formal.
--
-- A compra, seus itens, o vínculo, o status e a auditoria são gravados
-- juntos. Qualquer falha impede a criação parcial de uma compra formal.
-- =====================================================================

create or replace function public.formalizar_pedido_interno(p_pedido_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido record;
  v_compra_id bigint;
  v_email text := current_setting('request.jwt.claims', true)::jsonb->>'email';
  v_itens_compra integer := 0;
begin
  perform fn_exige_papel('coordenador');

  select id, titulo, status, solicitante, projeto_id, pedido_compra_id
    into v_pedido
  from pedidos_internos
  where id = p_pedido_id
  for update;

  if not found then
    raise exception 'Pedido interno nao encontrado.' using errcode = 'P0002';
  end if;
  if v_pedido.status <> 'validado' then
    raise exception 'Valide as informacoes antes de formalizar.' using errcode = '22023';
  end if;
  if v_pedido.pedido_compra_id is not null then
    raise exception 'Este pedido interno ja possui compra formal.' using errcode = '22023';
  end if;
  if exists (
    select 1
    from pedidos_internos_itens
    where pedido_interno_id = p_pedido_id
      and tipo in ('material', 'equipamento')
      and insumo_id is null
  ) then
    raise exception 'Vincule cada material ou equipamento a um insumo antes de formalizar.' using errcode = '22023';
  end if;

  insert into pedidos_compra(projeto_id, solicitante, status, observacao)
  values (
    v_pedido.projeto_id,
    coalesce(v_pedido.solicitante, v_email),
    'solicitado',
    'Formalizado a partir do pedido interno #' || v_pedido.id || ': ' || v_pedido.titulo
  )
  returning id into v_compra_id;

  insert into pedidos_compra_itens(
    pedido_id, insumo_id, pedido_interno_item_id, quantidade, custo_unitario_estimado
  )
  select
    v_compra_id,
    pii.insumo_id,
    pii.id,
    pii.quantidade,
    pii.orcamento_previo
  from pedidos_internos_itens pii
  where pii.pedido_interno_id = p_pedido_id
    and pii.insumo_id is not null;
  get diagnostics v_itens_compra = row_count;

  perform set_config('app.pedido_interno_transicao', 'permitida', true);
  update pedidos_internos
     set pedido_compra_id = v_compra_id,
         status = 'formalizado',
         formalizado_em = now()
   where id = p_pedido_id;

  insert into pedidos_internos_aprovacoes(
    pedido_interno_id, etapa, decisao, responsavel, papel, comentario, status_origem, status_destino
  ) values (
    p_pedido_id,
    'Formalização do pedido',
    'aprovado',
    v_email,
    current_papel(),
    'Compra formal #' || v_compra_id || ' criada com ' || v_itens_compra || ' item(ns) rastreável(is).',
    'validado',
    'formalizado'
  );

  insert into eventos_status(entidade, entidade_id, de_status, para_status, usuario, observacao)
  values
    ('pedido_interno', p_pedido_id, 'validado', 'formalizado', v_email, 'Compra formal #' || v_compra_id || ' criada.'),
    ('pedido_compra', v_compra_id, null, 'solicitado', v_email, 'Criado pelo pedido interno #' || p_pedido_id || '.');

  return jsonb_build_object('pedido_compra_id', v_compra_id, 'itens_compra', v_itens_compra);
end $$;

revoke execute on function public.formalizar_pedido_interno(bigint) from public, anon;
grant execute on function public.formalizar_pedido_interno(bigint) to authenticated, service_role;
