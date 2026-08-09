-- =====================================================================
-- Autorizacao explicita das transicoes operacionais protegidas.
--
-- Remove a dependencia do owner da funcao. Somente RPCs controladas
-- habilitam a transicao na transacao corrente; UPDATE direto permanece
-- bloqueado para qualquer papel.
-- =====================================================================

create or replace function public.bloquear_status_direto_pedido_compra()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if current_setting('app.pedido_compra_transicao', true) = 'permitida' then
    return new;
  end if;

  raise exception 'O status do pedido de compra so pode ser alterado por transicao transacional.'
    using errcode = '42501';
end $$;

create or replace function public.bloquear_status_operacional_direto_planejamento()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.status_operacional is not distinct from old.status_operacional then
    return new;
  end if;

  if current_setting('app.planejamento_transicao', true) = 'permitida' then
    return new;
  end if;

  raise exception 'O status operacional do planejamento so pode ser alterado por RPC transacional.'
    using errcode = '42501';
end $$;

-- O wrapper idempotente e o unico entrypoint publico do recebimento formal.
-- A implementacao legada de seis argumentos permanece privada e recebe como
-- responsavel somente o ator forte derivado do JWT.
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
set search_path = pg_catalog, public
as $$
declare
  v_existente record;
  v_lote_id bigint;
  v_claims jsonb;
  v_ator text;
begin
  perform public.fn_exige_papel('coordenador');

  if p_operacao_id is null then
    raise exception 'operacao_id e obrigatorio para receber o item.' using errcode = '22023';
  end if;

  v_claims := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  v_ator := coalesce(nullif(v_claims->>'email', ''), nullif(v_claims->>'sub', ''));
  if v_ator is null then
    raise exception 'Contexto JWT do ator e obrigatorio para receber o item.' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_operacao_id::text, 0));

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
    select 1
    from public.pedidos_internos_item_recebimentos
    where operacao_id = p_operacao_id
  ) then
    raise exception 'operacao_id ja utilizado em outro recebimento.' using errcode = '23505';
  end if;

  -- insert into lotes_estoque ocorre na rota legada privada somente depois
  -- da verificacao idempotente acima.
  perform set_config('app.pedido_compra_transicao', 'permitida', true);
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

-- Caller legado preservado com a mesma regra de papel e ator forte explicito.
create or replace function public.marcar_planejamento_reservado(
  p_planejamento_id bigint
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_claims jsonb;
  v_ator text;
begin
  perform public.fn_exige_papel('tecnico');

  v_claims := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  v_ator := coalesce(nullif(v_claims->>'email', ''), nullif(v_claims->>'sub', ''));
  if v_ator is null then
    raise exception 'Contexto JWT do ator e obrigatorio para reservar o planejamento.' using errcode = '42501';
  end if;

  perform set_config('app.planejamento_transicao', 'permitida', true);
  update public.planejamento
     set status_operacional = 'reservado',
         reservado_em = coalesce(reservado_em, now()),
         reservado_por = coalesce(reservado_por, v_ator)
   where id = p_planejamento_id
     and status_operacional in ('rascunho', 'reservado');
end $$;

revoke execute on function public.bloquear_status_direto_pedido_compra()
  from public, anon, authenticated, service_role;
revoke execute on function public.bloquear_status_operacional_direto_planejamento()
  from public, anon, authenticated, service_role;
revoke execute on function public.receber_item_pedido_compra(
  bigint, bigint, uuid, numeric, date, text, text
) from public, anon;
revoke execute on function public.marcar_planejamento_reservado(bigint)
  from public, anon;

grant execute on function public.receber_item_pedido_compra(
  bigint, bigint, uuid, numeric, date, text, text
) to authenticated, service_role;
grant execute on function public.marcar_planejamento_reservado(bigint)
  to authenticated, service_role;
