-- =====================================================================
-- Pedido interno: status somente por transições transacionais.
--
-- Fecha a alteração direta de status por REST e centraliza validação de
-- origem, papel, aprovação e evento de auditoria em uma única RPC.
-- =====================================================================

create or replace function public.transicionar_pedido_interno(
  p_pedido_id bigint,
  p_status_destino text,
  p_etapa text,
  p_decisao text,
  p_observacao text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status_origem text;
  v_email text := current_setting('request.jwt.claims', true)::jsonb->>'email';
begin
  if p_status_destino = 'em_validacao' then
    perform fn_exige_papel('tecnico');
  else
    perform fn_exige_papel('coordenador');
  end if;

  if p_decisao not in ('aprovado', 'reprovado', 'devolvido', 'registrado') then
    raise exception 'Decisao de aprovacao invalida.' using errcode = '22023';
  end if;

  select status
    into v_status_origem
  from pedidos_internos
  where id = p_pedido_id
  for update;

  if not found then
    raise exception 'Pedido interno nao encontrado.' using errcode = 'P0002';
  end if;

  if not (
    (v_status_origem in ('rascunho', 'ajuste_solicitante', 'ajuste_compras') and p_status_destino = 'em_validacao')
    or (v_status_origem = 'em_validacao' and p_status_destino in ('validado', 'ajuste_solicitante'))
    or (v_status_origem = 'validado' and p_status_destino = 'formalizado')
    or (v_status_origem = 'formalizado' and p_status_destino = 'analise_administrativa')
    or (v_status_origem = 'analise_administrativa' and p_status_destino in ('aprovado_compra', 'ajuste_compras'))
    or (v_status_origem = 'aprovado_compra' and p_status_destino = 'orcamentos')
    or (v_status_origem = 'orcamentos' and p_status_destino = 'orcamentos_recebidos')
    or (v_status_origem = 'orcamentos_recebidos' and p_status_destino = 'aguardando_aprovacao_final')
    or (v_status_origem = 'aguardando_aprovacao_final' and p_status_destino = 'aprovado_para_compra')
    or (v_status_origem = 'aprovado_para_compra' and p_status_destino in ('compra_fechada', 'encaminhado_instituicao'))
    or (v_status_origem in ('compra_fechada', 'encaminhado_instituicao') and p_status_destino = 'aguardando_pagamento_nf')
    or (v_status_origem = 'aguardando_pagamento_nf' and p_status_destino = 'compra_concluida')
  ) then
    raise exception 'Transicao de status nao permitida: % -> %.', v_status_origem, p_status_destino
      using errcode = '22023';
  end if;

  perform set_config('app.pedido_interno_transicao', 'permitida', true);

  update pedidos_internos
     set status = p_status_destino
   where id = p_pedido_id;

  insert into pedidos_internos_aprovacoes(
    pedido_interno_id, etapa, decisao, responsavel, papel, comentario, status_origem, status_destino
  )
  values (
    p_pedido_id,
    coalesce(nullif(btrim(p_etapa), ''), p_status_destino),
    p_decisao,
    v_email,
    current_papel(),
    nullif(btrim(p_observacao), ''),
    v_status_origem,
    p_status_destino
  );

  insert into eventos_status(entidade, entidade_id, de_status, para_status, usuario, observacao)
  values ('pedido_interno', p_pedido_id, v_status_origem, p_status_destino, v_email, nullif(btrim(p_observacao), ''));

  return jsonb_build_object('status_origem', v_status_origem, 'status_destino', p_status_destino);
end $$;

create or replace function public.bloquear_status_direto_pedido_interno()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status
     and current_setting('app.pedido_interno_transicao', true) is distinct from 'permitida' then
    raise exception 'Status do pedido interno só pode ser alterado por transição transacional.'
      using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists trg_bloquear_status_direto_pedido_interno on public.pedidos_internos;
create trigger trg_bloquear_status_direto_pedido_interno
  before update of status on public.pedidos_internos
  for each row execute function public.bloquear_status_direto_pedido_interno();

-- O cancelamento já possui validações próprias de recebimento e compra
-- vinculada; ele recebe o mesmo salvo-conduto transacional antes do UPDATE.
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
    select 1 from pedidos_internos_itens
    where pedido_interno_id = p_pedido_id and recebido_em is not null
  ) then
    raise exception 'Pedido interno com item recebido nao pode ser cancelado por este fluxo.' using errcode = '22023';
  end if;

  if v_pedido.pedido_compra_id is not null then
    select id, status into v_compra from pedidos_compra
    where id = v_pedido.pedido_compra_id for update;

    if found then
      if v_compra.status = 'recebido' or exists (
        select 1 from pedidos_compra_itens
        where pedido_id = v_compra.id and lote_id is not null
      ) then
        raise exception 'Compra formal com item recebido impede cancelamento do pedido interno.' using errcode = '22023';
      end if;
      if v_compra.status <> 'cancelado' then
        if v_compra.status not in ('solicitado','aprovado','enviado','em_transito') then
          raise exception 'Status da compra formal nao permite cancelamento sincronizado.' using errcode = '22023';
        end if;
        update pedidos_compra set status = 'cancelado' where id = v_compra.id;
      end if;
    end if;
  end if;

  perform set_config('app.pedido_interno_transicao', 'permitida', true);
  update pedidos_internos set status = 'cancelado' where id = p_pedido_id;

  insert into pedidos_internos_aprovacoes(
    pedido_interno_id, etapa, decisao, responsavel, papel, comentario, status_origem, status_destino
  ) values (
    p_pedido_id, 'Cancelamento', 'reprovado', coalesce(p_responsavel, current_setting('request.jwt.claims', true)::jsonb->>'email'),
    current_papel(), p_observacao, v_pedido.status, 'cancelado'
  );

  insert into eventos_status(entidade, entidade_id, de_status, para_status, usuario, observacao)
  values (
    'pedido_interno', p_pedido_id, v_pedido.status, 'cancelado',
    coalesce(p_responsavel, current_setting('request.jwt.claims', true)::jsonb->>'email'), p_observacao
  );

  return jsonb_build_object('status_origem', v_pedido.status, 'pedido_compra_id', v_pedido.pedido_compra_id);
end $$;

revoke execute on function public.transicionar_pedido_interno(bigint, text, text, text, text) from public, anon;
revoke execute on function public.cancelar_pedido_interno_operacional(bigint, text, text) from public, anon;
grant execute on function public.transicionar_pedido_interno(bigint, text, text, text, text) to authenticated, service_role;
grant execute on function public.cancelar_pedido_interno_operacional(bigint, text, text) to authenticated, service_role;
