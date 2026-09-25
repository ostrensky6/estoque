-- Relatorio de bugs v5 (itens 7, 8 e 10).
--
-- 1) criar_insumo_com_quantidade passa a aceitar 'codigo_lote' em
--    p_dados_insumo: o numero do lote informado no cadastro nomeia o lote
--    inicial (antes era sempre 'CAD-xxxxxxxx'). Assinatura inalterada.
--    A lista fechada de chaves continua valendo (qualquer outra chave e
--    recusada); o app deixou de enviar custo_unitario, que e calculado aqui.
--
-- Nao remove dados, colunas, politicas nem gatilhos.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
begin
  if to_regprocedure('public.criar_insumo_com_quantidade(jsonb, integer, uuid)') is null then
    raise exception '0111: requer a migration 0109 (criar_insumo_com_quantidade)';
  end if;
end $$;

create or replace function public.criar_insumo_com_quantidade(
  p_dados_insumo jsonb,
  p_quantidade_embalagens integer,
  p_operacao_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ator_id uuid := auth.uid();
  v_claims jsonb;
  v_ator text;
  v_entrada public.insumos%rowtype;
  v_insumo public.insumos%rowtype;
  v_lote_id bigint;
  v_requisicao jsonb;
  v_resultado jsonb;
  v_evento public.eventos_status%rowtype;
  v_codigo_lote text := nullif(left(btrim(coalesce(p_dados_insumo->>'codigo_lote', '')), 80), '');
begin
  if not kontrol_private.pode_editar_cadastro('insumos.editar') then
    raise exception 'Sem permissão para cadastrar insumos.' using errcode = '42501';
  end if;
  if v_ator_id is null then
    raise exception 'Sessão inválida.' using errcode = '28000';
  end if;
  if p_operacao_id is null or p_dados_insumo is null
    or jsonb_typeof(p_dados_insumo) <> 'object'
    or p_quantidade_embalagens is null or p_quantidade_embalagens < 0 then
    raise exception 'Dados do insumo ou quantidade inválidos.' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_object_keys(p_dados_insumo) k
    where k not in (
      'categoria_compra', 'codigo_fabricante', 'codigo_interno',
      'condicao_armazenamento', 'custo_total_embalagem', 'data_aquisicao',
      'data_fabricacao', 'data_validade', 'especificacao', 'estoque_seguranca',
      'fabricante', 'fator_conversao', 'fornecedor_alt_id', 'fornecedor_id',
      'lead_time_dias', 'nome_item', 'ponto_reposicao', 'prazo_entrega_max_dias',
      'quantidade_embalagem', 'quantidade_minima_compra', 'sds_url',
      'tipo_insumo_id', 'unidade', 'unidade_consumo',
      'validade_apos_abertura_dias', 'validade_dias', 'codigo_lote'
    )
  ) then
    raise exception 'Campo não reconhecido no cadastro do insumo.' using errcode = '22023';
  end if;

  v_entrada := jsonb_populate_record(null::public.insumos, p_dados_insumo);
  if nullif(btrim(v_entrada.especificacao), '') is null then
    raise exception 'Item específico / SKU é obrigatório.' using errcode = '22023';
  end if;
  if p_quantidade_embalagens > 0 and (
    nullif(btrim(v_entrada.unidade), '') is null
    or v_entrada.quantidade_embalagem is null or v_entrada.quantidade_embalagem <= 0
    or nullif(btrim(coalesce(v_entrada.unidade_consumo, v_entrada.unidade)), '') is null
    or v_entrada.fator_conversao is null or v_entrada.fator_conversao <= 0
  ) then
    raise exception 'Informe unidade, quantidade da embalagem e fator de conversão antes de lançar quantidade.' using errcode = '22023';
  end if;
  if p_quantidade_embalagens > 0
    and v_entrada.categoria_compra = 'critico'
    and v_entrada.data_validade is null then
    raise exception 'Insumo crítico exige data de validade para lançar quantidade.' using errcode = '22023';
  end if;

  v_requisicao := jsonb_build_object(
    'acao', 'criar_insumo_com_quantidade',
    'dados', p_dados_insumo,
    'quantidade_embalagens', p_quantidade_embalagens
  );
  perform pg_advisory_xact_lock(hashtextextended(p_operacao_id::text, 0));
  select * into v_evento
  from public.eventos_status e
  where e.entidade = 'insumo_embalagem_fechada'
    and e.operacao_id = p_operacao_id
  for update;
  if found then
    if v_evento.operacao_payload->'requisicao' is distinct from v_requisicao then
      raise exception 'Esta operação já foi registrada com dados diferentes.' using errcode = '23505';
    end if;
    return jsonb_set(
      v_evento.operacao_payload->'resultado', '{repetido}', 'true'::jsonb, true
    );
  end if;

  v_claims := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  v_ator := coalesce(nullif(v_claims->>'email', ''), v_ator_id::text);

  insert into public.insumos (
    categoria_compra, codigo_fabricante, codigo_interno, condicao_armazenamento,
    custo_total_embalagem, custo_unitario, data_aquisicao, data_fabricacao,
    data_validade, especificacao, estoque_seguranca, fabricante, fator_conversao,
    fornecedor_alt_id, fornecedor_id, lead_time_dias, nome_item, ponto_reposicao,
    prazo_entrega_max_dias, quantidade_embalagem, quantidade_minima_compra,
    sds_url, tipo_insumo_id, unidade, unidade_consumo,
    validade_apos_abertura_dias, validade_dias
  ) values (
    coalesce(v_entrada.categoria_compra, 'operacional'), v_entrada.codigo_fabricante,
    v_entrada.codigo_interno, v_entrada.condicao_armazenamento,
    v_entrada.custo_total_embalagem,
    case when v_entrada.quantidade_embalagem > 0
      then v_entrada.custo_total_embalagem / v_entrada.quantidade_embalagem end,
    v_entrada.data_aquisicao, v_entrada.data_fabricacao, v_entrada.data_validade,
    btrim(v_entrada.especificacao), coalesce(v_entrada.estoque_seguranca, 0),
    v_entrada.fabricante, coalesce(v_entrada.fator_conversao, 1),
    v_entrada.fornecedor_alt_id, v_entrada.fornecedor_id, v_entrada.lead_time_dias,
    v_entrada.nome_item, coalesce(v_entrada.ponto_reposicao, 0),
    v_entrada.prazo_entrega_max_dias, v_entrada.quantidade_embalagem,
    v_entrada.quantidade_minima_compra, v_entrada.sds_url, v_entrada.tipo_insumo_id,
    v_entrada.unidade, coalesce(v_entrada.unidade_consumo, v_entrada.unidade),
    v_entrada.validade_apos_abertura_dias, v_entrada.validade_dias
  ) returning * into v_insumo;

  if p_quantidade_embalagens > 0 then
    insert into public.lotes_estoque (
      insumo_id, codigo_lote, validade, quantidade_inicial, quantidade_atual,
      custo_unitario, fornecedor, status, responsavel_recebimento,
      modelo_quantidade, unidade_fisica_snapshot, conteudo_embalagem_snapshot,
      unidade_consumo_snapshot, fator_conversao_snapshot
    ) values (
      v_insumo.id, coalesce(v_codigo_lote, 'CAD-' || left(p_operacao_id::text, 8)), v_insumo.data_validade,
      p_quantidade_embalagens, p_quantidade_embalagens,
      v_insumo.custo_total_embalagem, null, 'aceito', v_ator,
      'EMBALAGEM_FECHADA', btrim(v_insumo.unidade), v_insumo.quantidade_embalagem,
      btrim(coalesce(v_insumo.unidade_consumo, v_insumo.unidade)),
      v_insumo.fator_conversao
    ) returning id into v_lote_id;

    insert into public.estoque_movimentacoes (
      insumo_id, tipo, quantidade, custo_unitario, motivo, referencia, lote_id
    ) values (
      v_insumo.id, 'entrada', p_quantidade_embalagens,
      v_insumo.custo_total_embalagem, 'cadastro inicial de embalagens fechadas',
      p_operacao_id::text, v_lote_id
    );
  end if;

  v_resultado := jsonb_build_object(
    'insumo_id', v_insumo.id,
    'lote_id', v_lote_id,
    'quantidade_embalagens', p_quantidade_embalagens,
    'repetido', false
  );
  insert into public.eventos_status (
    entidade, entidade_id, de_status, para_status, usuario, observacao,
    operacao_id, operacao_payload
  ) values (
    'insumo_embalagem_fechada', v_insumo.id, null, 'CRIADO', v_ator,
    'Cadastro de insumo com quantidade física de embalagens fechadas.',
    p_operacao_id, jsonb_build_object('requisicao', v_requisicao, 'resultado', v_resultado)
  );
  return v_resultado;
end;
$$;

-- 2) Saida avulsa de insumo (item 10) -------------------------------------
-- Perda, quebra, vencimento, descarte ou consumo fora de plano, por insumo.
-- Sem lote informado, baixa pelos lotes que vencem primeiro (FEFO); com
-- motivo "vencido", comeca pelos lotes ja vencidos. Nunca consome
-- quantidade reservada para planos. Lotes de embalagem fechada so aceitam
-- numero inteiro e continuam 'aceito' (nao passam a 'em_uso', o que os
-- tiraria do saldo). Perdas sao registradas como 'ajuste' para nao inflar
-- a previsao de consumo; consumo avulso e 'saida'. Idempotente por operacao.

alter table public.estoque_movimentacoes
  add column if not exists categoria_saida text;

alter table public.estoque_movimentacoes
  drop constraint if exists estoque_movimentacoes_categoria_saida_check,
  add constraint estoque_movimentacoes_categoria_saida_check
    check (categoria_saida is null or categoria_saida in (
      'consumo_avulso', 'perda', 'quebra', 'vencido', 'descarte', 'outro'
    ));

create or replace function public.registrar_saida_avulsa(
  p_insumo_id bigint,
  p_quantidade numeric,
  p_categoria text,
  p_observacao text,
  p_lote_id bigint,
  p_operacao_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ator_id uuid := auth.uid();
  v_claims jsonb;
  v_ator text;
  v_requisicao jsonb;
  v_resultado jsonb;
  v_evento public.eventos_status%rowtype;
  v_lote record;
  v_reservado numeric;
  v_livre numeric;
  v_take numeric;
  v_restante numeric;
  v_tipo text;
  v_motivo text;
  v_rotulo text;
  v_lotes jsonb := '[]'::jsonb;
begin
  perform public.fn_exige_papel('tecnico');
  if v_ator_id is null then
    raise exception 'Sessão inválida.' using errcode = '28000';
  end if;
  if p_insumo_id is null or p_operacao_id is null
    or p_quantidade is null or p_quantidade <= 0 then
    raise exception 'Informe o insumo e uma quantidade maior que zero.' using errcode = '22023';
  end if;
  if p_categoria is null or p_categoria not in (
    'consumo_avulso', 'perda', 'quebra', 'vencido', 'descarte', 'outro'
  ) then
    raise exception 'Escolha o motivo da saída.' using errcode = '22023';
  end if;
  if p_categoria = 'outro' and nullif(btrim(coalesce(p_observacao, '')), '') is null then
    raise exception 'Descreva o motivo quando escolher "Outro".' using errcode = '22023';
  end if;

  v_rotulo := case p_categoria
    when 'consumo_avulso' then 'consumo fora de plano'
    when 'perda' then 'perda'
    when 'quebra' then 'quebra'
    when 'vencido' then 'vencido'
    when 'descarte' then 'descarte'
    else 'outro'
  end;
  v_tipo := case when p_categoria = 'consumo_avulso' then 'saida' else 'ajuste' end;
  v_motivo := 'saída avulsa (' || v_rotulo || ')'
    || coalesce(': ' || nullif(btrim(p_observacao), ''), '');

  v_requisicao := jsonb_build_object(
    'acao', 'registrar_saida_avulsa', 'insumo_id', p_insumo_id,
    'quantidade', p_quantidade, 'categoria', p_categoria,
    'observacao', nullif(btrim(coalesce(p_observacao, '')), ''), 'lote_id', p_lote_id
  );
  perform pg_advisory_xact_lock(hashtextextended(p_operacao_id::text, 0));
  select * into v_evento
  from public.eventos_status e
  where e.entidade = 'saida_avulsa_insumo'
    and e.operacao_id = p_operacao_id
  for update;
  if found then
    if v_evento.operacao_payload->'requisicao' is distinct from v_requisicao then
      raise exception 'Esta operação já foi registrada com dados diferentes.' using errcode = '23505';
    end if;
    return jsonb_set(v_evento.operacao_payload->'resultado', '{repetido}', 'true'::jsonb, true);
  end if;

  perform 1 from public.insumos i where i.id = p_insumo_id for update;
  if not found then
    raise exception 'Insumo não encontrado.' using errcode = 'P0002';
  end if;

  v_restante := p_quantidade;
  for v_lote in
    select l.*
    from public.lotes_estoque l
    where l.insumo_id = p_insumo_id
      and (p_lote_id is null or l.id = p_lote_id)
      and l.quantidade_atual > 0
      and (
        (l.modelo_quantidade = 'EMBALAGEM_FECHADA' and l.status = 'aceito')
        or (l.modelo_quantidade <> 'EMBALAGEM_FECHADA' and l.status in ('aceito', 'em_uso'))
        -- perda, quebra, vencido e descarte tambem retiram material bloqueado ou em quarentena
        or (p_categoria <> 'consumo_avulso' and l.status in ('bloqueado', 'quarentena'))
      )
    order by
      case when p_categoria = 'vencido'
        and public.menor_validade(l.validade, l.validade_apos_abertura) < current_date then 0 else 1 end,
      public.menor_validade(l.validade, l.validade_apos_abertura) nulls last,
      l.id
    for update
  loop
    exit when v_restante <= 0;

    -- consumo avulso nunca usa material vencido
    if p_categoria = 'consumo_avulso'
      and public.menor_validade(v_lote.validade, v_lote.validade_apos_abertura) < current_date then
      continue;
    end if;

    select coalesce(sum(r.quantidade - coalesce(r.quantidade_consumida, 0)), 0)
      into v_reservado
    from public.reservas_estoque r
    where r.lote_id = v_lote.id and r.status in ('reservado', 'parcial');
    v_livre := greatest(v_lote.quantidade_atual - v_reservado, 0);
    if v_lote.modelo_quantidade = 'EMBALAGEM_FECHADA' then
      v_livre := floor(v_livre);
    end if;
    v_take := least(v_restante, v_livre);
    if v_take <= 0 then
      continue;
    end if;
    if v_lote.modelo_quantidade = 'EMBALAGEM_FECHADA' and v_take <> trunc(v_take) then
      raise exception 'Este insumo é contado em embalagens fechadas: informe um número inteiro.' using errcode = '22023';
    end if;

    update public.lotes_estoque
       set quantidade_atual = quantidade_atual - v_take,
           status = case
             when quantidade_atual - v_take <= 0 then 'consumido'
             when modelo_quantidade = 'EMBALAGEM_FECHADA' then status
             when status = 'aceito' and p_categoria = 'consumo_avulso' then 'em_uso'
             else status
           end,
           data_abertura = case
             when modelo_quantidade <> 'EMBALAGEM_FECHADA' and p_categoria = 'consumo_avulso'
               then coalesce(data_abertura, current_date)
             else data_abertura
           end
     where id = v_lote.id;

    insert into public.estoque_movimentacoes (
      insumo_id, tipo, quantidade, custo_unitario, motivo, referencia, lote_id, categoria_saida
    ) values (
      p_insumo_id, v_tipo, v_take, v_lote.custo_unitario, v_motivo,
      p_operacao_id::text, v_lote.id, p_categoria
    );

    v_lotes := v_lotes || jsonb_build_object(
      'lote_id', v_lote.id, 'codigo_lote', v_lote.codigo_lote, 'quantidade', v_take
    );
    v_restante := v_restante - v_take;
  end loop;

  if v_restante > 0 then
    raise exception 'Saldo livre insuficiente: faltam % (parte pode estar reservada para planos, vencida ou em quarentena).',
      trim(to_char(v_restante, 'FM999999990.######')) using errcode = '22023';
  end if;

  v_claims := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  v_ator := coalesce(nullif(v_claims->>'email', ''), v_ator_id::text);
  v_resultado := jsonb_build_object(
    'insumo_id', p_insumo_id, 'quantidade', p_quantidade,
    'categoria', p_categoria, 'lotes', v_lotes, 'repetido', false
  );
  insert into public.eventos_status (
    entidade, entidade_id, de_status, para_status, usuario, observacao,
    operacao_id, operacao_payload
  ) values (
    'saida_avulsa_insumo', p_insumo_id, null, 'SAIDA_' || upper(p_categoria), v_ator,
    v_motivo, p_operacao_id,
    jsonb_build_object('requisicao', v_requisicao, 'resultado', v_resultado)
  );
  return v_resultado;
end;
$$;

revoke all on function public.registrar_saida_avulsa(bigint, numeric, text, text, bigint, uuid)
  from public, anon;
grant execute on function public.registrar_saida_avulsa(bigint, numeric, text, text, bigint, uuid)
  to authenticated;

commit;
