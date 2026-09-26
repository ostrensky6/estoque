-- Relatorio de bugs v5 (itens 7 e 8): numero do lote no cadastro do insumo.
--
-- criar_insumo_com_quantidade passa a aceitar 'codigo_lote' em
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
    raise exception '0113: requer a migration 0109 (criar_insumo_com_quantidade)';
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


commit;
