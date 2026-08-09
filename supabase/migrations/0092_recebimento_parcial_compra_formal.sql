-- =====================================================================
-- Recebimento parcial rastreável de compra formal.
-- =====================================================================

create table if not exists public.pedidos_compra_item_recebimentos (
  id bigint generated always as identity primary key,
  pedido_compra_id bigint not null references public.pedidos_compra(id) on delete cascade,
  pedido_compra_item_id bigint not null references public.pedidos_compra_itens(id) on delete cascade,
  pedido_interno_item_id bigint references public.pedidos_internos_itens(id) on delete set null,
  lote_id bigint not null unique references public.lotes_estoque(id) on delete restrict,
  insumo_id bigint not null references public.insumos(id) on delete restrict,
  quantidade numeric not null check (quantidade > 0),
  custo_unitario numeric,
  codigo_lote text,
  fornecedor text,
  validade date,
  responsavel text,
  observacao text,
  recebido_em timestamptz not null default now()
);

create index if not exists pedidos_compra_item_recebimentos_item_idx
  on public.pedidos_compra_item_recebimentos(pedido_compra_item_id, recebido_em);
create index if not exists pedidos_compra_item_recebimentos_pedido_idx
  on public.pedidos_compra_item_recebimentos(pedido_compra_id, recebido_em);

alter table public.pedidos_compra_item_recebimentos enable row level security;
revoke all on table public.pedidos_compra_item_recebimentos from anon, public;
revoke insert, update, delete on table public.pedidos_compra_item_recebimentos from authenticated;
grant select on table public.pedidos_compra_item_recebimentos to authenticated, service_role;
grant all on table public.pedidos_compra_item_recebimentos to service_role;
grant usage, select on sequence public.pedidos_compra_item_recebimentos_id_seq to authenticated, service_role;

drop policy if exists rls_tecnico_insert_pedidos_compra_item_recebimentos on public.pedidos_compra_item_recebimentos;
drop policy if exists rls_coordenador_delete_pedidos_compra_item_recebimentos on public.pedidos_compra_item_recebimentos;
create policy rls_read_pedidos_compra_item_recebimentos
  on public.pedidos_compra_item_recebimentos for select to authenticated using (true);

drop trigger if exists aud_pedidos_compra_item_recebimentos on public.pedidos_compra_item_recebimentos;
create trigger aud_pedidos_compra_item_recebimentos
  after insert or update or delete on public.pedidos_compra_item_recebimentos
  for each row execute function public.fn_auditoria();

alter table public.pedidos_internos_item_recebimentos
  add column if not exists pedido_compra_item_id bigint references public.pedidos_compra_itens(id) on delete set null;
create index if not exists pedidos_internos_item_recebimentos_compra_item_idx
  on public.pedidos_internos_item_recebimentos(pedido_compra_item_id)
  where pedido_compra_item_id is not null;

create or replace function public.receber_item_pedido_compra(
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
  v_total_recebido numeric;
  v_lote_id bigint;
  v_pedido_interno_id bigint;
  v_tudo_recebido boolean;
  v_compra_concluida boolean;
begin
  perform fn_exige_papel('coordenador');

  select
    pi.id, pi.pedido_id, pi.insumo_id, pi.quantidade,
    coalesce(pi.quantidade_recebida, case when pi.lote_id is not null then pi.quantidade else 0 end) as quantidade_recebida,
    pi.custo_unitario_estimado, pi.pedido_interno_item_id,
    p.status as pedido_status, p.projeto, f.nome as fornecedor, i.categoria_compra
  into v_item
  from pedidos_compra_itens pi
  join pedidos_compra p on p.id = pi.pedido_id
  join insumos i on i.id = pi.insumo_id
  left join fornecedores f on f.id = p.fornecedor_id
  where pi.id = p_item_id and pi.pedido_id = p_pedido_id
  for update of pi, p;

  if not found then
    raise exception 'Item do pedido de compra nao encontrado.' using errcode = 'P0002';
  end if;
  if v_item.quantidade_recebida >= v_item.quantidade then
    raise exception 'Item ja foi recebido integralmente.' using errcode = '22023';
  end if;
  if v_item.pedido_status not in ('aprovado','enviado','em_transito') then
    raise exception 'Status do pedido nao permite recebimento.' using errcode = '22023';
  end if;

  v_quantidade := coalesce(p_quantidade, v_item.quantidade - v_item.quantidade_recebida);
  if v_quantidade <= 0 then
    raise exception 'Quantidade recebida deve ser maior que zero.' using errcode = '22023';
  end if;
  v_total_recebido := v_item.quantidade_recebida + v_quantidade;
  if v_total_recebido > v_item.quantidade then
    raise exception 'Quantidade recebida excede o saldo pendente do item.' using errcode = '22023';
  end if;
  if v_item.categoria_compra = 'critico' and p_validade is null then
    raise exception 'Validade e obrigatoria para receber insumo critico.' using errcode = '22023';
  end if;

  insert into lotes_estoque(
    insumo_id, codigo_lote, validade, quantidade_inicial, quantidade_atual,
    custo_unitario, fornecedor, projeto, status, responsavel_recebimento
  ) values (
    v_item.insumo_id, nullif(btrim(p_codigo), ''), p_validade, v_quantidade, v_quantidade,
    v_item.custo_unitario_estimado, v_item.fornecedor, v_item.projeto, 'quarentena', p_responsavel
  ) returning id into v_lote_id;

  insert into estoque_movimentacoes(insumo_id, tipo, quantidade, custo_unitario, motivo, referencia, lote_id)
  values (
    v_item.insumo_id, 'entrada', v_quantidade, v_item.custo_unitario_estimado,
    'compra/recebimento', 'pedido_compra ' || p_pedido_id || '; item ' || p_item_id, v_lote_id
  );

  insert into pedidos_compra_item_recebimentos(
    pedido_compra_id, pedido_compra_item_id, pedido_interno_item_id, lote_id, insumo_id,
    quantidade, custo_unitario, codigo_lote, fornecedor, validade, responsavel
  ) values (
    p_pedido_id, p_item_id, v_item.pedido_interno_item_id, v_lote_id, v_item.insumo_id,
    v_quantidade, v_item.custo_unitario_estimado, nullif(btrim(p_codigo), ''),
    v_item.fornecedor, p_validade, p_responsavel
  );

  update pedidos_compra_itens
     set lote_id = case when v_total_recebido >= v_item.quantidade then v_lote_id else lote_id end,
         quantidade_recebida = v_total_recebido,
         divergencia_recebimento = case
           when v_total_recebido <> v_item.quantidade
             then 'Pedido: ' || v_item.quantidade || '; recebido acumulado: ' || v_total_recebido
           else null
         end
   where id = p_item_id and pedido_id = p_pedido_id;

  if v_item.pedido_interno_item_id is not null then
    update pedidos_internos_itens
       set insumo_id = v_item.insumo_id,
           lote_id = v_lote_id,
           quantidade_recebida = v_total_recebido,
           divergencia_recebimento = case
             when v_total_recebido <> quantidade
               then 'Pedido: ' || quantidade || '; recebido acumulado: ' || v_total_recebido
             else null
           end,
           recebido_em = case when v_total_recebido >= quantidade then now() else null end,
           recebido_por = case when v_total_recebido >= quantidade then p_responsavel else null end
     where id = v_item.pedido_interno_item_id
     returning pedido_interno_id into v_pedido_interno_id;

    insert into pedidos_internos_item_recebimentos(
      pedido_interno_id, pedido_interno_item_id, pedido_compra_item_id, lote_id, insumo_id,
      quantidade, custo_unitario, codigo_lote, fornecedor, validade, responsavel, observacao
    ) values (
      v_pedido_interno_id, v_item.pedido_interno_item_id, p_item_id, v_lote_id, v_item.insumo_id,
      v_quantidade, v_item.custo_unitario_estimado, nullif(btrim(p_codigo), ''), v_item.fornecedor,
      p_validade, p_responsavel, 'Recebimento pela compra formal #' || p_pedido_id
    );

    select not exists (
      select 1 from pedidos_internos_itens
      where pedido_interno_id = v_pedido_interno_id
        and tipo = 'material' and recebido_em is null
    ) into v_tudo_recebido;

    update pedidos_internos
       set recebido_em = case when v_tudo_recebido then coalesce(recebido_em, now()) else null end,
           recebido_por = case when v_tudo_recebido then p_responsavel else null end
     where id = v_pedido_interno_id;
  end if;

  select not exists (
    select 1 from pedidos_compra_itens
    where pedido_id = p_pedido_id
      and coalesce(quantidade_recebida, case when lote_id is not null then quantidade else 0 end) < quantidade
  ) into v_compra_concluida;

  if v_compra_concluida then
    update pedidos_compra set status = 'recebido' where id = p_pedido_id;
  end if;

  insert into eventos_status(entidade, entidade_id, de_status, para_status, usuario, observacao)
  values (
    'pedido_compra', p_pedido_id, v_item.pedido_status,
    case when v_compra_concluida then 'recebido' else v_item.pedido_status end,
    p_responsavel,
    'Recebimento ' || case when v_compra_concluida then 'concluído' else 'parcial' end ||
      ': item #' || p_item_id || ', quantidade ' || v_quantidade ||
      ', acumulado ' || v_total_recebido || ' de ' || v_item.quantidade || '.'
  );

  return v_lote_id;
end $$;

-- Compatibilidade para consumidores antigos de cinco parâmetros.
create or replace function public.receber_item_pedido_compra(
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
begin
  return public.receber_item_pedido_compra(
    p_pedido_id, p_item_id, p_quantidade, p_validade, p_codigo, null
  );
end $$;

revoke execute on function public.receber_item_pedido_compra(bigint, bigint, numeric, date, text) from public, anon;
revoke execute on function public.receber_item_pedido_compra(bigint, bigint, numeric, date, text, text) from public, anon;
grant execute on function public.receber_item_pedido_compra(bigint, bigint, numeric, date, text) to authenticated, service_role;
grant execute on function public.receber_item_pedido_compra(bigint, bigint, numeric, date, text, text) to authenticated, service_role;
