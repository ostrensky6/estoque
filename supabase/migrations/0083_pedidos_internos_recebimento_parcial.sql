-- =====================================================================
-- Pedidos internos: recebimento parcial rastreavel por item.
-- Cada chegada gera um lote proprio e um registro de recebimento. O item
-- mantem campos-resumo para compatibilidade com telas e relatorios atuais.
-- Migration aditiva, sem remocao de dados.
-- =====================================================================

create table if not exists pedidos_internos_item_recebimentos (
  id bigint generated always as identity primary key,
  pedido_interno_id bigint not null references pedidos_internos(id) on delete cascade,
  pedido_interno_item_id bigint not null references pedidos_internos_itens(id) on delete cascade,
  lote_id bigint not null references lotes_estoque(id) on delete restrict,
  insumo_id bigint not null references insumos(id) on delete restrict,
  quantidade numeric not null check (quantidade > 0),
  custo_unitario numeric,
  codigo_lote text,
  fornecedor text,
  validade date,
  responsavel text,
  observacao text,
  recebido_em timestamptz not null default now()
);

create index if not exists pedidos_internos_item_recebimentos_item_idx
  on pedidos_internos_item_recebimentos(pedido_interno_item_id, recebido_em);
create index if not exists pedidos_internos_item_recebimentos_pedido_idx
  on pedidos_internos_item_recebimentos(pedido_interno_id, recebido_em);
create index if not exists pedidos_internos_item_recebimentos_lote_idx
  on pedidos_internos_item_recebimentos(lote_id);

alter table pedidos_internos_item_recebimentos enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'pedidos_internos_item_recebimentos'
      and policyname = 'rls_read_pedidos_internos_item_recebimentos'
  ) then
    create policy rls_read_pedidos_internos_item_recebimentos
      on pedidos_internos_item_recebimentos
      for select to authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'pedidos_internos_item_recebimentos'
      and policyname = 'rls_tecnico_insert_pedidos_internos_item_recebimentos'
  ) then
    create policy rls_tecnico_insert_pedidos_internos_item_recebimentos
      on pedidos_internos_item_recebimentos
      for insert to authenticated with check (papel_minimo('tecnico'));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'pedidos_internos_item_recebimentos'
      and policyname = 'rls_coordenador_delete_pedidos_internos_item_recebimentos'
  ) then
    create policy rls_coordenador_delete_pedidos_internos_item_recebimentos
      on pedidos_internos_item_recebimentos
      for delete to authenticated using (papel_minimo('coordenador'));
  end if;
end $$;

grant all on pedidos_internos_item_recebimentos to authenticated, service_role;
grant usage, select on sequence pedidos_internos_item_recebimentos_id_seq to authenticated, service_role;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'aud_pedidos_internos_item_recebimentos'
  ) then
    create trigger aud_pedidos_internos_item_recebimentos
      after insert or update or delete on pedidos_internos_item_recebimentos
      for each row execute function fn_auditoria();
  end if;
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
  v_total_recebido numeric;
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
    coalesce(pii.quantidade_recebida, 0) as quantidade_recebida,
    pii.recebido_em,
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
  if v_item.recebido_em is not null or v_item.quantidade_recebida >= v_item.quantidade then
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

  v_total_recebido := v_item.quantidade_recebida + p_quantidade;
  if v_total_recebido > v_item.quantidade then
    raise exception 'Quantidade recebida excede o saldo pendente do item.' using errcode = '22023';
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

  insert into pedidos_internos_item_recebimentos(
    pedido_interno_id,
    pedido_interno_item_id,
    lote_id,
    insumo_id,
    quantidade,
    custo_unitario,
    codigo_lote,
    fornecedor,
    validade,
    responsavel
  )
  values (
    p_pedido_id,
    p_item_id,
    v_lote_id,
    p_insumo_id,
    p_quantidade,
    p_custo,
    nullif(btrim(p_codigo), ''),
    nullif(btrim(p_fornecedor), ''),
    p_validade,
    p_responsavel
  );

  update pedidos_internos_itens
     set insumo_id = p_insumo_id,
         lote_id = v_lote_id,
         quantidade_recebida = v_total_recebido,
         divergencia_recebimento = case
           when v_total_recebido <> v_item.quantidade
             then 'Pedido: ' || v_item.quantidade || '; recebido acumulado: ' || v_total_recebido
           else null
         end,
         recebido_em = case when v_total_recebido >= v_item.quantidade then now() else null end,
         recebido_por = case when v_total_recebido >= v_item.quantidade then p_responsavel else null end
   where id = p_item_id
     and pedido_interno_id = p_pedido_id;

  select not exists (
    select 1
     from pedidos_internos_itens
     where pedido_interno_id = p_pedido_id
       and tipo in ('material', 'equipamento')
       and recebido_em is null
  ) into v_tudo_recebido;

  update pedidos_internos
     set recebido_em = case when v_tudo_recebido then coalesce(recebido_em, now()) else null end,
         recebido_por = case when v_tudo_recebido then p_responsavel else null end
   where id = p_pedido_id;

  return v_lote_id;
end $$;

grant execute on function receber_item_pedido_interno(bigint,bigint,bigint,numeric,date,numeric,text,text,text,text)
  to authenticated, service_role;

do $$
begin
  alter table pedidos_internos
    drop constraint if exists pedidos_internos_status_check;

  alter table pedidos_internos
    add constraint pedidos_internos_status_check
    check (status in (
      'rascunho',
      'em_validacao',
      'ajuste_solicitante',
      'validado',
      'formalizado',
      'analise_administrativa',
      'ajuste_compras',
      'aprovado_compra',
      'orcamentos',
      'orcamentos_recebidos',
      'aguardando_aprovacao_final',
      'aprovado_para_compra',
      'compra_fechada',
      'encaminhado_instituicao',
      'aguardando_pagamento_nf',
      'compra_concluida',
      'cancelado'
    )) not valid;
end $$;
