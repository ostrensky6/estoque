-- =====================================================================
-- Recebimentos idempotentes e estorno bilateral.
--
-- Preserva os livros existentes, fecha as assinaturas sem operacao_id e
-- adiciona somente estado suficiente para retry e estorno sem duplicacao.
-- =====================================================================

alter table public.pedidos_compra_item_recebimentos
  add column if not exists operacao_id uuid,
  add column if not exists estornado_em timestamptz,
  add column if not exists estornado_por text;

alter table public.pedidos_internos_item_recebimentos
  add column if not exists operacao_id uuid,
  add column if not exists estornado_em timestamptz,
  add column if not exists estornado_por text;

create unique index if not exists pedidos_compra_item_recebimentos_operacao_id_uidx
  on public.pedidos_compra_item_recebimentos(operacao_id)
  where operacao_id is not null;

create unique index if not exists pedidos_internos_item_recebimentos_operacao_id_uidx
  on public.pedidos_internos_item_recebimentos(operacao_id)
  where operacao_id is not null;

revoke all on table public.pedidos_compra_item_recebimentos from public, anon, authenticated, service_role;
revoke all on table public.pedidos_internos_item_recebimentos from public, anon, authenticated, service_role;
revoke all on sequence public.pedidos_compra_item_recebimentos_id_seq from public, anon, authenticated, service_role;
revoke all on sequence public.pedidos_internos_item_recebimentos_id_seq from public, anon, authenticated, service_role;
grant select on table public.pedidos_compra_item_recebimentos to authenticated, service_role;
grant select on table public.pedidos_internos_item_recebimentos to authenticated, service_role;

-- As rotas antigas continuam disponíveis somente ao owner para reuso interno
-- pelos wrappers abaixo. Nenhum cliente pode criar recebimento sem UUID.
revoke execute on function public.receber_item_pedido_interno(
  bigint, bigint, bigint, numeric, date, numeric, text, text, text, text
) from public, anon, authenticated, service_role;
revoke execute on function public.receber_item_pedido_compra(
  bigint, bigint, numeric, date, text
) from public, anon, authenticated, service_role;
revoke execute on function public.receber_item_pedido_compra(
  bigint, bigint, numeric, date, text, text
) from public, anon, authenticated, service_role;

create or replace function public.receber_item_pedido_interno(
  p_pedido_id bigint,
  p_item_id bigint,
  p_insumo_id bigint,
  p_quantidade numeric,
  p_operacao_id uuid,
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
  v_existente record;
  v_lote_id bigint;
  v_claims jsonb;
  v_ator text;
begin
  perform fn_exige_papel('tecnico');

  if p_operacao_id is null then
    raise exception 'operacao_id e obrigatorio para receber o item.' using errcode = '22023';
  end if;

  v_claims := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  v_ator := coalesce(nullif(v_claims->>'email', ''), nullif(v_claims->>'sub', ''));
  if v_ator is null then
    raise exception 'Contexto JWT do ator e obrigatorio para receber o item.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_operacao_id::text, 0));

  select r.*, l.projeto as lote_projeto
    into v_existente
  from public.pedidos_internos_item_recebimentos r
  join public.lotes_estoque l on l.id = r.lote_id
  where r.operacao_id = p_operacao_id
  for update of r;

  if found then
    if v_existente.pedido_interno_id = p_pedido_id
       and v_existente.pedido_interno_item_id = p_item_id
       and v_existente.pedido_compra_item_id is null
       and v_existente.insumo_id = p_insumo_id
       and v_existente.quantidade = p_quantidade
       and v_existente.custo_unitario is not distinct from p_custo
       and v_existente.codigo_lote is not distinct from nullif(btrim(p_codigo), '')
       and v_existente.fornecedor is not distinct from nullif(btrim(p_fornecedor), '')
       and v_existente.validade is not distinct from p_validade
       and v_existente.lote_projeto is not distinct from nullif(btrim(p_projeto), '') then
      return v_existente.lote_id;
    end if;
    raise exception 'operacao_id ja utilizado com payload diferente.' using errcode = '23505';
  end if;

  if exists (
    select 1 from public.pedidos_compra_item_recebimentos
    where operacao_id = p_operacao_id
  ) then
    raise exception 'operacao_id ja utilizado em outro recebimento.' using errcode = '23505';
  end if;

  -- insert into lotes_estoque ocorre dentro da rota legada privada somente
  -- depois da verificacao idempotente acima.
  v_lote_id := public.receber_item_pedido_interno(
    p_pedido_id, p_item_id, p_insumo_id, p_quantidade, p_validade, p_custo,
    p_codigo, p_fornecedor, p_projeto, v_ator
  );

  update public.pedidos_internos_item_recebimentos
     set operacao_id = p_operacao_id,
         responsavel = v_ator
   where lote_id = v_lote_id
     and pedido_interno_item_id = p_item_id
     and operacao_id is null;

  if not found then
    raise exception 'Livro do recebimento interno nao foi registrado.' using errcode = 'P0001';
  end if;

  insert into public.eventos_status(
    entidade, entidade_id, de_status, para_status, usuario, observacao
  )
  select
    'pedido_interno',
    p_pedido_id,
    p.status,
    p.status,
    v_ator,
    'Item recebido e lançado em estoque: ' || i.especificacao ||
      '. Quantidade: ' || p_quantidade || '.'
  from public.pedidos_internos p
  join public.pedidos_internos_itens i
    on i.pedido_interno_id = p.id
   and i.id = p_item_id
  where p.id = p_pedido_id;

  if not found then
    raise exception 'Pedido interno do recebimento nao foi encontrado para auditoria.' using errcode = 'P0001';
  end if;

  return v_lote_id;
end $$;

create or replace function public.receber_item_pedido_compra(
  p_pedido_id bigint,
  p_item_id bigint,
  p_operacao_id uuid,
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
  v_existente record;
  v_lote_id bigint;
  v_claims jsonb;
  v_ator text;
begin
  perform fn_exige_papel('coordenador');

  if p_operacao_id is null then
    raise exception 'operacao_id e obrigatorio para receber o item.' using errcode = '22023';
  end if;

  v_claims := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  v_ator := coalesce(nullif(v_claims->>'email', ''), nullif(v_claims->>'sub', ''));
  if v_ator is null then
    raise exception 'Contexto JWT do ator e obrigatorio para receber o item.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_operacao_id::text, 0));

  select r.*
    into v_existente
  from public.pedidos_compra_item_recebimentos r
  where r.operacao_id = p_operacao_id
  for update;

  if found then
    if v_existente.pedido_compra_id = p_pedido_id
       and v_existente.pedido_compra_item_id = p_item_id
       and (p_quantidade is null or v_existente.quantidade = p_quantidade)
       and v_existente.codigo_lote is not distinct from nullif(btrim(p_codigo), '')
       and v_existente.validade is not distinct from p_validade then
      return v_existente.lote_id;
    end if;
    raise exception 'operacao_id ja utilizado com payload diferente.' using errcode = '23505';
  end if;

  if exists (
    select 1 from public.pedidos_internos_item_recebimentos
    where operacao_id = p_operacao_id
  ) then
    raise exception 'operacao_id ja utilizado em outro recebimento.' using errcode = '23505';
  end if;

  -- insert into lotes_estoque ocorre dentro da rota legada privada somente
  -- depois da verificacao idempotente acima.
  v_lote_id := public.receber_item_pedido_compra(
    p_pedido_id, p_item_id, p_quantidade, p_validade, p_codigo, v_ator
  );

  update public.pedidos_compra_item_recebimentos
     set operacao_id = p_operacao_id,
         responsavel = v_ator
   where lote_id = v_lote_id
     and pedido_compra_item_id = p_item_id
     and operacao_id is null;

  if not found then
    raise exception 'Livro do recebimento formal nao foi registrado.' using errcode = 'P0001';
  end if;

  update public.pedidos_internos_item_recebimentos
     set operacao_id = p_operacao_id,
         responsavel = v_ator
   where lote_id = v_lote_id
     and pedido_compra_item_id = p_item_id
     and operacao_id is null;

  return v_lote_id;
end $$;

revoke execute on function public.receber_item_pedido_interno(
  bigint, bigint, bigint, numeric, uuid, date, numeric, text, text, text, text
) from public, anon;
revoke execute on function public.receber_item_pedido_compra(
  bigint, bigint, uuid, numeric, date, text, text
) from public, anon;
grant execute on function public.receber_item_pedido_interno(
  bigint, bigint, bigint, numeric, uuid, date, numeric, text, text, text, text
) to authenticated, service_role;
grant execute on function public.receber_item_pedido_compra(
  bigint, bigint, uuid, numeric, date, text, text
) to authenticated, service_role;

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
  v_claims jsonb;
  v_ator text;
begin
  perform fn_exige_papel('coordenador');

  v_claims := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  v_ator := coalesce(nullif(v_claims->>'email', ''), nullif(v_claims->>'sub', ''));
  if v_ator is null then
    raise exception 'Contexto JWT do ator e obrigatorio para transicionar a compra.' using errcode = '42501';
  end if;

  select id, status
    into v_pedido
  from public.pedidos_compra
  where id = p_pedido_id
  for update;

  if not found then
    raise exception 'Pedido de compra nao encontrado.' using errcode = 'P0002';
  end if;

  if not (
    (v_pedido.status = 'solicitado' and p_status_destino = 'aprovado') or
    (v_pedido.status = 'aprovado' and p_status_destino = 'enviado') or
    (v_pedido.status = 'enviado' and p_status_destino = 'em_transito') or
    (v_pedido.status in ('solicitado', 'aprovado', 'enviado', 'em_transito') and p_status_destino = 'cancelado')
  ) then
    raise exception 'Transicao de status nao permitida: % -> %.', v_pedido.status, p_status_destino
      using errcode = '22023';
  end if;

  if p_status_destino = 'cancelado' and (
    exists (
      select 1
      from public.pedidos_compra_item_recebimentos r
      where r.pedido_compra_id = p_pedido_id
        and r.estornado_em is null
        and r.quantidade > 0
    ) or exists (
      select 1
      from public.pedidos_internos_item_recebimentos r
      join public.pedidos_compra_itens i on i.id = r.pedido_compra_item_id
      where i.pedido_id = p_pedido_id
        and r.estornado_em is null
        and r.quantidade > 0
    ) or exists (
      select 1 from public.pedidos_compra_itens
      where pedido_id = p_pedido_id and lote_id is not null
    )
  ) then
    raise exception 'Pedido com recebimento parcial ou total nao pode ser cancelado.' using errcode = '22023';
  end if;

  perform set_config('app.pedido_compra_transicao', 'permitida', true);
  update public.pedidos_compra
     set status = p_status_destino,
         aprovador = case when p_status_destino = 'aprovado' then v_ator else aprovador end,
         data_aprovacao = case when p_status_destino = 'aprovado' then current_date else data_aprovacao end,
         data_prevista_entrega = case
           when p_status_destino = 'aprovado' then p_data_prevista_entrega
           else data_prevista_entrega
         end
   where id = p_pedido_id;

  insert into public.eventos_status(entidade, entidade_id, de_status, para_status, usuario, observacao)
  values ('pedido_compra', p_pedido_id, v_pedido.status, p_status_destino, v_ator, p_observacao);

  return jsonb_build_object(
    'status_origem', v_pedido.status,
    'status_destino', p_status_destino,
    'data_prevista_entrega', p_data_prevista_entrega
  );
end $$;

create or replace function public.cancelar_pedido_interno_operacional(
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
  v_claims jsonb;
  v_ator text;
begin
  perform fn_exige_papel('coordenador');

  v_claims := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  v_ator := coalesce(nullif(v_claims->>'email', ''), nullif(v_claims->>'sub', ''));
  if v_ator is null then
    raise exception 'Contexto JWT do ator e obrigatorio para cancelar o pedido.' using errcode = '42501';
  end if;

  select id, status, pedido_compra_id, recebido_em
    into v_pedido
  from public.pedidos_internos
  where id = p_pedido_id
  for update;

  if not found then
    raise exception 'Pedido interno nao encontrado.' using errcode = 'P0002';
  end if;
  if v_pedido.status in ('cancelado', 'compra_concluida') then
    raise exception 'Status do pedido interno nao permite cancelamento.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.pedidos_internos_item_recebimentos r
    where r.pedido_interno_id = p_pedido_id
      and r.estornado_em is null
      and r.quantidade > 0
  ) or exists (
    select 1
    from public.pedidos_compra_item_recebimentos r
    join public.pedidos_internos_itens i on i.id = r.pedido_interno_item_id
    where i.pedido_interno_id = p_pedido_id
      and r.estornado_em is null
      and r.quantidade > 0
  ) then
    raise exception 'Pedido interno com recebimento parcial ou total nao pode ser cancelado.' using errcode = '22023';
  end if;

  if v_pedido.recebido_em is not null or exists (
    select 1 from public.pedidos_internos_itens
    where pedido_interno_id = p_pedido_id and recebido_em is not null
  ) then
    raise exception 'Pedido interno com item recebido nao pode ser cancelado por este fluxo.' using errcode = '22023';
  end if;

  if v_pedido.pedido_compra_id is not null then
    select id, status
      into v_compra
    from public.pedidos_compra
    where id = v_pedido.pedido_compra_id
    for update;

    if found then
      if v_compra.status = 'recebido' or exists (
        select 1 from public.pedidos_compra_itens
        where pedido_id = v_compra.id and lote_id is not null
      ) then
        raise exception 'Compra formal com item recebido impede cancelamento do pedido interno.' using errcode = '22023';
      end if;
      if v_compra.status <> 'cancelado' then
        if v_compra.status not in ('solicitado', 'aprovado', 'enviado', 'em_transito') then
          raise exception 'Status da compra formal nao permite cancelamento sincronizado.' using errcode = '22023';
        end if;
        perform set_config('app.pedido_compra_transicao', 'permitida', true);
        update public.pedidos_compra set status = 'cancelado' where id = v_compra.id;
      end if;
    end if;
  end if;

  perform set_config('app.pedido_interno_transicao', 'permitida', true);
  update public.pedidos_internos set status = 'cancelado' where id = p_pedido_id;

  insert into public.pedidos_internos_aprovacoes(
    pedido_interno_id, etapa, decisao, responsavel, papel, comentario, status_origem, status_destino
  ) values (
    p_pedido_id, 'Cancelamento', 'reprovado', v_ator,
    current_papel(), p_observacao, v_pedido.status, 'cancelado'
  );

  insert into public.eventos_status(entidade, entidade_id, de_status, para_status, usuario, observacao)
  values ('pedido_interno', p_pedido_id, v_pedido.status, 'cancelado', v_ator, p_observacao);

  return jsonb_build_object('status_origem', v_pedido.status, 'pedido_compra_id', v_pedido.pedido_compra_id);
end $$;

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
  v_compra record;
  v_compra_item record;
  v_estornados integer := 0;
  v_total_recebido numeric := 0;
  v_total_compra numeric := 0;
  v_ultimo_lote_id bigint;
  v_ultimo_responsavel text;
  v_item_completo boolean := false;
  v_pedido_completo boolean := false;
  v_compra_completa boolean := false;
  v_status_destino text;
  v_claims jsonb;
  v_ator text;
  v_motivo text := coalesce(nullif(btrim(p_motivo), ''), 'estorno de recebimento de pedido interno');
begin
  perform fn_exige_papel('coordenador');

  v_claims := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  v_ator := coalesce(nullif(v_claims->>'email', ''), nullif(v_claims->>'sub', ''));
  if v_ator is null then
    raise exception 'Contexto JWT do ator e obrigatorio para estornar o recebimento.' using errcode = '42501';
  end if;

  select i.id, i.quantidade, p.status
    into v_item
  from public.pedidos_internos_itens i
  join public.pedidos_internos p on p.id = i.pedido_interno_id
  where i.id = p_item_id
    and i.pedido_interno_id = p_pedido_id
  for update of i, p;

  if not found then
    raise exception 'Item do pedido interno nao encontrado.' using errcode = 'P0002';
  end if;

  for v_recebimento in
    select r.id, r.lote_id, r.quantidade, r.pedido_compra_item_id
    from public.pedidos_internos_item_recebimentos r
    where r.pedido_interno_id = p_pedido_id
      and r.pedido_interno_item_id = p_item_id
      and r.estornado_em is null
      and (p_recebimento_id is null or r.id = p_recebimento_id)
    order by r.recebido_em desc, r.id desc
    for update
  loop
    perform 1
    from public.pedidos_compra_item_recebimentos r
    where r.lote_id = v_recebimento.lote_id
      and r.estornado_em is null
    for update;

    perform public.estornar_recebimento_lote(
      v_recebimento.lote_id,
      v_motivo || '; pedido ' || p_pedido_id || '; item ' || p_item_id
    );

    update public.pedidos_internos_item_recebimentos
       set estornado_em = now(),
           estornado_por = v_ator
     where id = v_recebimento.id
       and estornado_em is null;

    update public.pedidos_compra_item_recebimentos
       set estornado_em = now(),
           estornado_por = v_ator
     where lote_id = v_recebimento.lote_id
       and estornado_em is null;

    v_estornados := v_estornados + 1;
  end loop;

  if v_estornados = 0 then
    if exists (
      select 1
      from public.pedidos_internos_item_recebimentos
      where pedido_interno_id = p_pedido_id
        and pedido_interno_item_id = p_item_id
        and estornado_em is not null
        and (p_recebimento_id is null or id = p_recebimento_id)
    ) then
      return;
    end if;
    raise exception 'Recebimento ativo nao encontrado para estorno.' using errcode = 'P0002';
  end if;

  select coalesce(sum(quantidade), 0)
    into v_total_recebido
  from public.pedidos_internos_item_recebimentos
  where pedido_interno_id = p_pedido_id
    and pedido_interno_item_id = p_item_id
    and estornado_em is null;

  select lote_id, responsavel
    into v_ultimo_lote_id, v_ultimo_responsavel
  from public.pedidos_internos_item_recebimentos
  where pedido_interno_id = p_pedido_id
    and pedido_interno_item_id = p_item_id
    and estornado_em is null
  order by recebido_em desc, id desc
  limit 1;

  v_item_completo := v_total_recebido >= v_item.quantidade and v_item.quantidade > 0;

  update public.pedidos_internos_itens
     set lote_id = v_ultimo_lote_id,
         quantidade_recebida = case when v_total_recebido > 0 then v_total_recebido else null end,
         divergencia_recebimento = case
           when v_total_recebido > 0 and not v_item_completo
             then 'Pedido: ' || v_item.quantidade || '; recebido acumulado: ' || v_total_recebido
           else null
         end,
         recebido_em = case when v_item_completo then coalesce(recebido_em, now()) else null end,
         recebido_por = case when v_item_completo then v_ultimo_responsavel else null end
   where id = p_item_id
     and pedido_interno_id = p_pedido_id;

  select not exists (
    select 1
    from public.pedidos_internos_itens
    where pedido_interno_id = p_pedido_id
      and tipo in ('material', 'equipamento')
      and recebido_em is null
  ) into v_pedido_completo;

  update public.pedidos_internos
     set recebido_em = case when v_pedido_completo then coalesce(recebido_em, now()) else null end,
         recebido_por = case when v_pedido_completo then coalesce(recebido_por, v_ultimo_responsavel) else null end
   where id = p_pedido_id;

  for v_compra in
    select p.id, p.status
    from public.pedidos_compra p
    where exists (
      select 1
      from public.pedidos_compra_item_recebimentos r
      where r.pedido_compra_id = p.id
        and r.pedido_interno_item_id = p_item_id
    )
    for update
  loop
    for v_compra_item in
      select i.id, i.quantidade
      from public.pedidos_compra_itens i
      where i.pedido_id = v_compra.id
      for update
    loop
      select coalesce(sum(r.quantidade), 0)
        into v_total_compra
      from public.pedidos_compra_item_recebimentos r
      where r.pedido_compra_item_id = v_compra_item.id
        and r.estornado_em is null;

      select r.lote_id
        into v_ultimo_lote_id
      from public.pedidos_compra_item_recebimentos r
      where r.pedido_compra_item_id = v_compra_item.id
        and r.estornado_em is null
      order by r.recebido_em desc, r.id desc
      limit 1;

      update pedidos_compra_itens
         set quantidade_recebida = v_total_compra,
             lote_id = case when v_total_compra >= v_compra_item.quantidade then v_ultimo_lote_id else null end,
             divergencia_recebimento = case
               when v_total_compra > 0 and v_total_compra <> v_compra_item.quantidade
                 then 'Pedido: ' || v_compra_item.quantidade || '; recebido acumulado: ' || v_total_compra
               else null
             end
       where id = v_compra_item.id;
    end loop;

    select not exists (
      select 1
      from public.pedidos_compra_itens i
      where i.pedido_id = v_compra.id
        and coalesce(i.quantidade_recebida, 0) < i.quantidade
    ) into v_compra_completa;

    v_status_destino := v_compra.status;
    if v_compra.status = 'recebido' and not v_compra_completa then
      select e.de_status
        into v_status_destino
      from public.eventos_status e
      where e.entidade = 'pedido_compra'
        and e.entidade_id = v_compra.id
        and e.para_status = 'recebido'
      order by e.criado_em desc, e.id desc
      limit 1;

      v_status_destino := coalesce(nullif(v_status_destino, 'recebido'), 'em_transito');
      perform set_config('app.pedido_compra_transicao', 'permitida', true);
      update pedidos_compra
         set status = v_status_destino
       where id = v_compra.id;
    end if;

    insert into public.eventos_status(entidade, entidade_id, de_status, para_status, usuario, observacao)
    values (
      'pedido_compra', v_compra.id, v_compra.status, v_status_destino, v_ator,
      'Estorno bilateral de recebimento vinculado ao item interno #' || p_item_id || '.'
    );
  end loop;

  insert into public.eventos_status(entidade, entidade_id, de_status, para_status, usuario, observacao)
  values (
    'pedido_interno', p_pedido_id, v_item.status, v_item.status, v_ator,
    'Estorno transacional de ' || v_estornados || ' recebimento(s) do item ' || p_item_id || '.'
  );
end $$;

revoke execute on function public.transicionar_pedido_compra(bigint, text, text, date) from public, anon;
revoke execute on function public.cancelar_pedido_interno_operacional(bigint, text, text) from public, anon;
revoke execute on function public.estornar_recebimento_item_pedido_interno(bigint, bigint, bigint, text) from public, anon;
grant execute on function public.transicionar_pedido_compra(bigint, text, text, date) to authenticated, service_role;
grant execute on function public.cancelar_pedido_interno_operacional(bigint, text, text) to authenticated, service_role;
grant execute on function public.estornar_recebimento_item_pedido_interno(bigint, bigint, bigint, text) to authenticated, service_role;
