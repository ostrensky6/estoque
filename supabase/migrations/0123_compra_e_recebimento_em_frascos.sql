-- Decisão do dono em 2026-09-26: a unidade oficial do estoque é o FRASCO
-- (embalagem), com o volume de cada frasco registrado no cadastro e ajustável
-- na chegada quando a embalagem vier diferente.
--
-- Até aqui a compra formal e o pedido interno sempre criavam lote "por volume"
-- (LEGADO), mesmo para insumo contado em frascos: o saldo somava frascos com
-- mL (2 frascos + 100 mL = "102") e a entrada por frascos passava a ser
-- recusada.
--
-- Regra desta migration:
--  * Cada item de compra/pedido interno diz em que unidade está a quantidade:
--    'embalagem' (frascos) ou 'unidade' (a unidade física do cadastro, ex.
--    mL), e o volume de cada frasco (conteudo_embalagem).
--  * Itens já existentes ficam como 'unidade' (comportamento anterior, sem
--    alterar nenhum número). Item novo sem unidade informada segue o modelo do
--    insumo: 'embalagem' se o insumo é contado em frascos, 'unidade' se ainda
--    tem lote antigo por volume (assim a reposição automática continua certa).
--  * O recebimento converte para o modelo do insumo: contado em frascos → lote
--    de frascos fechados (EMBALAGEM_FECHADA); com lote antigo por volume →
--    lote por volume (frascos × volume). Nunca mistura os dois.
--  * A previsão de compras converte o que está em aberto para a unidade de
--    estoque de cada insumo.
--
-- Insumos com lote antigo por volume continuam por volume até esse saldo
-- zerar. Converter lotes antigos em frascos altera saldo registrado e exige
-- relatório de impacto e aprovação próprios (protocolo de migração); não é
-- feito aqui.
--
-- Aditiva: colunas novas (as existentes recebem o valor padrão 'unidade'),
-- funções e gatilho novos, create or replace de duas funções de recebimento
-- (mesmas assinaturas) e da view v_previsao_suprimentos (mesmas colunas).
-- Rollback: reaplicar receber_item_pedido_compra(6 args) da 0092,
-- receber_item_pedido_interno(10 args) da 0083 e v_previsao_suprimentos da
-- 0098; dropar o gatilho kontrol_item_compra_unidade, as funções
-- kontrol_private.* desta migration e as colunas quantidade_em e
-- conteudo_embalagem.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- ---- Modelo de quantidade do insumo -----------------------------------------
create or replace function kontrol_private.modelo_quantidade_insumo(p_insumo_id bigint)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1 from public.lotes_estoque l
      where l.insumo_id = p_insumo_id and l.modelo_quantidade <> 'EMBALAGEM_FECHADA'
        and l.quantidade_atual > 0
    ) then 'LEGADO'
    when exists (
      select 1 from public.insumos i
      where i.id = p_insumo_id and i.quantidade_embalagem > 0
        and nullif(btrim(i.unidade), '') is not null
    ) then 'EMBALAGEM_FECHADA'
    else 'LEGADO'
  end;
$$;

-- Fator para levar uma quantidade de item (na unidade do item) à unidade de
-- estoque do insumo: frascos para insumo contado em frascos; unidade física
-- para insumo por volume.
create or replace function kontrol_private.fator_item_para_estoque(
  p_insumo_id bigint,
  p_quantidade_em text,
  p_conteudo numeric
) returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_conteudo is null or p_conteudo <= 0 then 1
    when p_quantidade_em = 'embalagem'
      and kontrol_private.modelo_quantidade_insumo(p_insumo_id) = 'LEGADO' then p_conteudo
    when p_quantidade_em = 'unidade'
      and kontrol_private.modelo_quantidade_insumo(p_insumo_id) = 'EMBALAGEM_FECHADA' then 1 / p_conteudo
    else 1
  end;
$$;

revoke all on function kontrol_private.modelo_quantidade_insumo(bigint) from public, anon;
revoke all on function kontrol_private.fator_item_para_estoque(bigint, text, numeric) from public, anon;
grant execute on function kontrol_private.modelo_quantidade_insumo(bigint) to authenticated, service_role;
grant execute on function kontrol_private.fator_item_para_estoque(bigint, text, numeric) to authenticated, service_role;

-- ---- Colunas dos itens ------------------------------------------------------
alter table public.pedidos_compra_itens
  add column if not exists quantidade_em text not null default 'unidade',
  add column if not exists conteudo_embalagem numeric;
alter table public.pedidos_compra_itens alter column quantidade_em drop default;
alter table public.pedidos_compra_itens
  drop constraint if exists pedidos_compra_itens_quantidade_em_check,
  add constraint pedidos_compra_itens_quantidade_em_check
    check (quantidade_em in ('embalagem', 'unidade')),
  drop constraint if exists pedidos_compra_itens_conteudo_check,
  add constraint pedidos_compra_itens_conteudo_check
    check (conteudo_embalagem is null or conteudo_embalagem > 0);

alter table public.pedidos_internos_itens
  add column if not exists quantidade_em text,
  add column if not exists conteudo_embalagem numeric;
update public.pedidos_internos_itens set quantidade_em = 'unidade' where quantidade_em is null;
alter table public.pedidos_internos_itens
  drop constraint if exists pedidos_internos_itens_quantidade_em_check,
  add constraint pedidos_internos_itens_quantidade_em_check
    check (quantidade_em is null or quantidade_em in ('embalagem', 'unidade')),
  drop constraint if exists pedidos_internos_itens_conteudo_check,
  add constraint pedidos_internos_itens_conteudo_check
    check (conteudo_embalagem is null or conteudo_embalagem > 0);

comment on column public.pedidos_compra_itens.quantidade_em is
  'Unidade da quantidade: embalagem (frascos) ou unidade (unidade física do cadastro). 0123.';
comment on column public.pedidos_compra_itens.conteudo_embalagem is
  'Volume de cada frasco deste item (padrão: quantidade_embalagem do insumo). 0123.';

create or replace function kontrol_private.preencher_unidade_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_origem record;
begin
  if new.insumo_id is null then
    return new;
  end if;
  if new.quantidade_em is null and tg_table_name = 'pedidos_compra_itens'
     and new.pedido_interno_item_id is not null then
    select quantidade_em, conteudo_embalagem into v_origem
    from public.pedidos_internos_itens where id = new.pedido_interno_item_id;
    new.quantidade_em := v_origem.quantidade_em;
    new.conteudo_embalagem := coalesce(new.conteudo_embalagem, v_origem.conteudo_embalagem);
  end if;
  if new.quantidade_em is null then
    new.quantidade_em := case
      when kontrol_private.modelo_quantidade_insumo(new.insumo_id) = 'EMBALAGEM_FECHADA' then 'embalagem'
      else 'unidade'
    end;
  end if;
  if new.conteudo_embalagem is null then
    select nullif(quantidade_embalagem, 0) into new.conteudo_embalagem
    from public.insumos where id = new.insumo_id;
  end if;
  return new;
end $$;

revoke all on function kontrol_private.preencher_unidade_item() from public, anon, authenticated, service_role;

drop trigger if exists kontrol_item_compra_unidade on public.pedidos_compra_itens;
create trigger kontrol_item_compra_unidade
  before insert on public.pedidos_compra_itens
  for each row execute function kontrol_private.preencher_unidade_item();

drop trigger if exists kontrol_item_pedido_interno_unidade on public.pedidos_internos_itens;
create trigger kontrol_item_pedido_interno_unidade
  before insert or update of insumo_id on public.pedidos_internos_itens
  for each row execute function kontrol_private.preencher_unidade_item();

-- ---- Criação do lote conforme o modelo do insumo ----------------------------
-- Devolve os dados do lote a criar para uma quantidade recebida na unidade do
-- item. Recusa quantidade que não fecha em frascos inteiros.
create or replace function kontrol_private.lote_do_recebimento(
  p_insumo_id bigint,
  p_quantidade numeric,
  p_quantidade_em text,
  p_conteudo numeric,
  p_custo numeric
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_insumo public.insumos%rowtype;
  v_modelo text := kontrol_private.modelo_quantidade_insumo(p_insumo_id);
  v_conteudo numeric;
  v_frascos numeric;
begin
  select * into v_insumo from public.insumos where id = p_insumo_id;
  v_conteudo := coalesce(nullif(p_conteudo, 0), nullif(v_insumo.quantidade_embalagem, 0));

  if v_modelo = 'EMBALAGEM_FECHADA' and v_conteudo is not null then
    v_frascos := case when p_quantidade_em = 'unidade' then p_quantidade / v_conteudo else p_quantidade end;
    if v_frascos <> trunc(v_frascos) then
      raise exception 'Este insumo é contado em frascos de % %. Receba um número inteiro de frascos.',
        to_char(v_conteudo, 'FM999999990.######'), coalesce(v_insumo.unidade, '')
        using errcode = '22023';
    end if;
    return jsonb_build_object(
      'modelo', 'EMBALAGEM_FECHADA',
      'quantidade', v_frascos,
      'custo_unitario', case
        when p_custo is null then null
        when p_quantidade_em = 'unidade' then p_custo * v_conteudo
        else p_custo
      end,
      'unidade_fisica', btrim(v_insumo.unidade),
      'conteudo', v_conteudo,
      'unidade_consumo', btrim(coalesce(nullif(v_insumo.unidade_consumo, ''), v_insumo.unidade)),
      'fator', coalesce(nullif(v_insumo.fator_conversao, 0), 1)
    );
  end if;

  -- Insumo ainda por volume (lote antigo com saldo) ou sem dados de embalagem.
  return jsonb_build_object(
    'modelo', 'LEGADO',
    'quantidade', case
      when p_quantidade_em = 'embalagem' and v_conteudo is not null then p_quantidade * v_conteudo
      else p_quantidade
    end,
    'custo_unitario', case
      when p_custo is null then null
      when p_quantidade_em = 'embalagem' and v_conteudo is not null then p_custo / v_conteudo
      else p_custo
    end
  );
end $$;

revoke all on function kontrol_private.lote_do_recebimento(bigint, numeric, text, numeric, numeric)
  from public, anon, authenticated, service_role;

create or replace function kontrol_private.criar_lote_recebido(
  p_insumo_id bigint,
  p_lote jsonb,
  p_codigo text,
  p_validade date,
  p_fornecedor text,
  p_projeto text,
  p_responsavel text
) returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  if p_lote->>'modelo' = 'EMBALAGEM_FECHADA' then
    insert into public.lotes_estoque (
      insumo_id, codigo_lote, validade, quantidade_inicial, quantidade_atual,
      custo_unitario, fornecedor, projeto, status, responsavel_recebimento,
      modelo_quantidade, unidade_fisica_snapshot, conteudo_embalagem_snapshot,
      unidade_consumo_snapshot, fator_conversao_snapshot
    ) values (
      p_insumo_id, nullif(btrim(p_codigo), ''), p_validade,
      (p_lote->>'quantidade')::numeric, (p_lote->>'quantidade')::numeric,
      (p_lote->>'custo_unitario')::numeric, nullif(btrim(p_fornecedor), ''),
      nullif(btrim(p_projeto), ''), 'quarentena', p_responsavel,
      'EMBALAGEM_FECHADA', p_lote->>'unidade_fisica', (p_lote->>'conteudo')::numeric,
      p_lote->>'unidade_consumo', (p_lote->>'fator')::numeric
    ) returning id into v_id;
  else
    insert into public.lotes_estoque (
      insumo_id, codigo_lote, validade, quantidade_inicial, quantidade_atual,
      custo_unitario, fornecedor, projeto, status, responsavel_recebimento
    ) values (
      p_insumo_id, nullif(btrim(p_codigo), ''), p_validade,
      (p_lote->>'quantidade')::numeric, (p_lote->>'quantidade')::numeric,
      (p_lote->>'custo_unitario')::numeric, nullif(btrim(p_fornecedor), ''),
      nullif(btrim(p_projeto), ''), 'quarentena', p_responsavel
    ) returning id into v_id;
  end if;
  return v_id;
end $$;

revoke all on function kontrol_private.criar_lote_recebido(bigint, jsonb, text, date, text, text, text)
  from public, anon, authenticated, service_role;

-- ---- Recebimento de compra formal (rota privada, mesma assinatura da 0092) --
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
set search_path = 'public'
as $$
declare
  v_item record;
  v_quantidade numeric;
  v_total_recebido numeric;
  v_lote jsonb;
  v_lote_id bigint;
  v_pedido_interno_id bigint;
  v_tudo_recebido boolean;
  v_compra_concluida boolean;
begin
  perform fn_exige_papel('coordenador');
  select
    pi.id, pi.pedido_id, pi.insumo_id, pi.quantidade,
    coalesce(pi.quantidade_recebida, case when pi.lote_id is not null then pi.quantidade else 0 end) as quantidade_recebida,
    pi.custo_unitario_estimado, pi.pedido_interno_item_id, pi.quantidade_em, pi.conteudo_embalagem,
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

  v_lote := kontrol_private.lote_do_recebimento(
    v_item.insumo_id, v_quantidade, v_item.quantidade_em, v_item.conteudo_embalagem,
    v_item.custo_unitario_estimado
  );
  v_lote_id := kontrol_private.criar_lote_recebido(
    v_item.insumo_id, v_lote, p_codigo, p_validade, v_item.fornecedor, v_item.projeto, p_responsavel
  );
  insert into estoque_movimentacoes(insumo_id, tipo, quantidade, custo_unitario, motivo, referencia, lote_id)
  values (
    v_item.insumo_id, 'entrada', (v_lote->>'quantidade')::numeric, (v_lote->>'custo_unitario')::numeric,
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
      case when v_item.quantidade_em = 'embalagem' then ' frasco(s)' else '' end ||
      ', acumulado ' || v_total_recebido || ' de ' || v_item.quantidade || '.'
  );
  return v_lote_id;
end $$;

-- ---- Recebimento de pedido interno sem compra formal (mesma assinatura) -----
create or replace function public.receber_item_pedido_interno(
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
set search_path = 'public'
as $$
declare
  v_item record;
  v_insumo record;
  v_lote jsonb;
  v_lote_id bigint;
  v_total_recebido numeric;
  v_tudo_recebido boolean;
  v_quantidade_em text;
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
    pii.quantidade_em,
    pii.conteudo_embalagem,
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

  v_quantidade_em := coalesce(
    v_item.quantidade_em,
    case when kontrol_private.modelo_quantidade_insumo(p_insumo_id) = 'EMBALAGEM_FECHADA'
      then 'embalagem' else 'unidade' end
  );
  v_lote := kontrol_private.lote_do_recebimento(
    p_insumo_id, p_quantidade, v_quantidade_em, v_item.conteudo_embalagem, p_custo
  );
  v_lote_id := kontrol_private.criar_lote_recebido(
    p_insumo_id, v_lote, p_codigo, p_validade, p_fornecedor, p_projeto, p_responsavel
  );

  insert into estoque_movimentacoes(insumo_id, tipo, quantidade, custo_unitario, motivo, lote_id)
  values (
    p_insumo_id, 'entrada', (v_lote->>'quantidade')::numeric, (v_lote->>'custo_unitario')::numeric,
    'pedido interno/recebimento', v_lote_id
  );

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
         quantidade_em = v_quantidade_em,
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

-- ---- Previsão de compras na unidade de estoque de cada insumo ---------------
create or replace view public.v_previsao_suprimentos
with (security_invoker = true) as
 WITH cfg AS (
         SELECT COALESCE(( SELECT parametros.valor::integer AS valor
                   FROM parametros
                  WHERE parametros.chave = 'janela_consumo_previsao_dias'::text), 90) AS janela
        ), consumo AS (
         SELECT m.insumo_id,
            sum(
                CASE
                    WHEN m.tipo = 'saida'::text THEN m.quantidade
                    ELSE 0::numeric
                END) AS consumo_janela
           FROM estoque_movimentacoes m
             CROSS JOIN cfg
          WHERE m.data >= (CURRENT_DATE - cfg.janela)
          GROUP BY m.insumo_id
        ), compras_abertas AS (
         SELECT pi.insumo_id,
            sum(GREATEST(pi.quantidade - COALESCE(pi.quantidade_recebida,
                CASE
                    WHEN pi.lote_id IS NOT NULL THEN pi.quantidade
                    ELSE 0::numeric
                END), 0::numeric)
                * kontrol_private.fator_item_para_estoque(pi.insumo_id, pi.quantidade_em, pi.conteudo_embalagem))
              FILTER (WHERE p.status = ANY (ARRAY['solicitado'::text, 'aprovado'::text, 'enviado'::text, 'em_transito'::text])) AS quantidade
           FROM pedidos_compra_itens pi
             JOIN pedidos_compra p ON p.id = pi.pedido_id
          GROUP BY pi.insumo_id
        ), reposicoes_internas_abertas AS (
         SELECT pii.insumo_id,
            sum(GREATEST(pii.quantidade - COALESCE(pii.quantidade_recebida, 0::numeric), 0::numeric)
                * kontrol_private.fator_item_para_estoque(pii.insumo_id, COALESCE(pii.quantidade_em, 'unidade'), pii.conteudo_embalagem)) AS quantidade
           FROM pedidos_internos_itens pii
             JOIN pedidos_internos p ON p.id = pii.pedido_interno_id
          WHERE p.origem = 'reposicao_estoque'::text AND (p.status = ANY (ARRAY['rascunho'::text, 'em_validacao'::text, 'ajuste_solicitante'::text, 'validado'::text])) AND pii.insumo_id IS NOT NULL
          GROUP BY pii.insumo_id
        ), abertos AS (
         SELECT fontes.insumo_id,
            sum(fontes.quantidade) AS qtd_pedida_aberta
           FROM ( SELECT compras_abertas.insumo_id,
                    compras_abertas.quantidade
                   FROM compras_abertas
                UNION ALL
                 SELECT reposicoes_internas_abertas.insumo_id,
                    reposicoes_internas_abertas.quantidade
                   FROM reposicoes_internas_abertas) fontes
          GROUP BY fontes.insumo_id
        ), base AS (
         SELECT s.insumo_id,
            s.especificacao,
            s.unidade,
            s.disponivel,
            s.em_maos,
            s.reservado,
            s.ponto_reposicao AS ponto_reposicao_configurado,
            s.estoque_seguranca,
            COALESCE(s.lead_time_dias, i.lead_time_dias, f.prazo_medio_dias, i.prazo_entrega_max_dias, 0) AS lead_time_dias,
            cfg.janela AS janela_dias,
            COALESCE(c.consumo_janela, 0::numeric) AS consumo_janela,
                CASE
                    WHEN cfg.janela > 0 THEN COALESCE(c.consumo_janela, 0::numeric) / cfg.janela::numeric
                    ELSE 0::numeric
                END AS consumo_medio_diario,
            COALESCE(a.qtd_pedida_aberta, 0::numeric) AS qtd_pedida_aberta,
            i.fornecedor_id,
            f.nome AS fornecedor_nome,
            i.custo_unitario,
            i.categoria_compra
           FROM v_estoque_saldo s
             JOIN insumos i ON i.id = s.insumo_id
             LEFT JOIN fornecedores f ON f.id = i.fornecedor_id
             LEFT JOIN consumo c ON c.insumo_id = s.insumo_id
             LEFT JOIN abertos a ON a.insumo_id = s.insumo_id
             CROSS JOIN cfg
        )
 SELECT insumo_id,
    especificacao,
    unidade,
    disponivel,
    em_maos,
    reservado,
    ponto_reposicao_configurado,
    estoque_seguranca,
    lead_time_dias,
    janela_dias,
    consumo_janela,
    consumo_medio_diario,
        CASE
            WHEN consumo_janela > 0::numeric THEN disponivel / consumo_medio_diario
            ELSE NULL::numeric
        END AS dias_cobertura,
    GREATEST(ponto_reposicao_configurado, consumo_medio_diario * lead_time_dias::numeric + estoque_seguranca) AS ponto_reposicao_sugerido,
    GREATEST(0::numeric, consumo_medio_diario * lead_time_dias::numeric + estoque_seguranca - disponivel - qtd_pedida_aberta) AS qtd_sugerida_compra,
    qtd_pedida_aberta,
    fornecedor_id,
    fornecedor_nome,
    custo_unitario,
    categoria_compra
   FROM base;

revoke all on public.v_previsao_suprimentos from anon;
grant select on public.v_previsao_suprimentos to authenticated, service_role;

commit;
