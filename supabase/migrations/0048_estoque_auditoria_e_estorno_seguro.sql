-- =====================================================================
-- Estoque: reforcos de validacao, estorno transacional e auditoria.
--
-- Aditiva/idempotente: preserva historico e centraliza mutacoes fisicas
-- em RPCs security definer com validacao de papel e de dados.
-- =====================================================================

create or replace function entrada_inventario(
  p_insumo_id  bigint,
  p_quantidade numeric,
  p_validade   date    default null,
  p_custo      numeric default null,
  p_codigo     text    default null,
  p_fornecedor text    default null,
  p_motivo     text    default null
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lote bigint;
begin
  perform fn_exige_papel('tecnico');

  if p_insumo_id is null then
    raise exception 'Insumo invalido.' using errcode = '22023';
  end if;
  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'Quantidade deve ser maior que zero.' using errcode = '22023';
  end if;
  if p_custo is not null and p_custo < 0 then
    raise exception 'Custo unitario deve ser maior ou igual a zero.' using errcode = '22023';
  end if;

  insert into lotes_estoque(insumo_id, codigo_lote, validade,
                            quantidade_inicial, quantidade_atual, custo_unitario, fornecedor)
  values (p_insumo_id, nullif(btrim(p_codigo), ''), p_validade, p_quantidade, p_quantidade,
          p_custo, nullif(btrim(p_fornecedor), ''))
  returning id into v_lote;

  insert into estoque_movimentacoes(insumo_id, tipo, quantidade, custo_unitario, motivo, lote_id)
  values (p_insumo_id, 'entrada', p_quantidade, p_custo,
          coalesce(nullif(btrim(p_motivo), ''), 'ajuste de inventario'), v_lote);

  return v_lote;
end $$;

create or replace function receber_lote(
  p_insumo_id  bigint,
  p_quantidade numeric,
  p_validade   date    default null,
  p_custo      numeric default null,
  p_codigo     text    default null,
  p_fornecedor text    default null,
  p_local_id   bigint  default null,
  p_nota_fiscal text   default null,
  p_projeto    text    default null
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lote bigint;
begin
  perform fn_exige_papel('tecnico');

  if p_insumo_id is null then
    raise exception 'Insumo invalido.' using errcode = '22023';
  end if;
  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'Quantidade deve ser maior que zero.' using errcode = '22023';
  end if;
  if p_custo is not null and p_custo < 0 then
    raise exception 'Custo unitario deve ser maior ou igual a zero.' using errcode = '22023';
  end if;

  insert into lotes_estoque(insumo_id, codigo_lote, validade, quantidade_inicial,
                            quantidade_atual, custo_unitario, fornecedor, status,
                            local_id, nota_fiscal, projeto)
  values (p_insumo_id, nullif(btrim(p_codigo), ''), p_validade, p_quantidade, p_quantidade,
          p_custo, nullif(btrim(p_fornecedor), ''), 'quarentena',
          p_local_id, nullif(btrim(p_nota_fiscal), ''), nullif(btrim(p_projeto), ''))
  returning id into v_lote;

  insert into estoque_movimentacoes(insumo_id, tipo, quantidade, custo_unitario, motivo, lote_id)
  values (p_insumo_id, 'entrada', p_quantidade, p_custo, 'recebimento (quarentena)', v_lote);

  return v_lote;
end $$;

create or replace function estornar_recebimento_lote(
  p_lote_id bigint,
  p_motivo text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lote record;
begin
  perform fn_exige_papel('coordenador');

  select *
    into v_lote
  from lotes_estoque
  where id = p_lote_id
  for update;

  if not found then
    raise exception 'Lote nao encontrado.' using errcode = 'P0002';
  end if;
  if v_lote.status in ('consumido','descartado') then
    raise exception 'Lote ja esta consumido ou descartado.' using errcode = '22023';
  end if;
  if v_lote.quantidade_atual <> v_lote.quantidade_inicial then
    raise exception 'O lote ja teve consumo em estoque; nao e possivel estornar.' using errcode = '22023';
  end if;

  update lotes_estoque
     set quantidade_atual = 0,
         status = 'descartado',
         motivo_bloqueio = coalesce(nullif(btrim(p_motivo), ''), 'estorno de recebimento')
   where id = p_lote_id;

  insert into estoque_movimentacoes(insumo_id, tipo, quantidade, custo_unitario, motivo, referencia, lote_id)
  values (
    v_lote.insumo_id,
    'ajuste',
    v_lote.quantidade_atual,
    v_lote.custo_unitario,
    'estorno de recebimento: ' || coalesce(nullif(btrim(p_motivo), ''), 'item de pedido interno'),
    'lote ' || p_lote_id,
    p_lote_id
  );
end $$;

grant execute on function entrada_inventario(bigint,numeric,date,numeric,text,text,text) to authenticated, service_role;
grant execute on function receber_lote(bigint,numeric,date,numeric,text,text,bigint,text,text) to authenticated, service_role;
grant execute on function estornar_recebimento_lote(bigint,text) to authenticated, service_role;
