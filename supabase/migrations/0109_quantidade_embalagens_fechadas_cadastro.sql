-- Quantidade fisica inteira de embalagens fechadas no cadastro de insumos.
--
-- Escopo desta migration: permitir informar, no proprio cadastro do insumo,
-- quantas embalagens fechadas (frascos, pacotes, kits) existem em estoque,
-- com entrada direta (sem quarentena) e auditavel, sem controlar o conteudo
-- de embalagens abertas. Nao mexe em reservar_plano/dar_baixa_plano nem em
-- v_custo_estoque_vigente: ambos ja funcionam para o novo modelo assim que a
-- coluna modelo_quantidade existe (o custo por lote continua sendo
-- quantidade_atual * custo_unitario, e nenhuma reserva sera criada contra
-- lotes deste modelo nesta etapa).

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
begin
  if to_regclass('public.insumos') is null
    or to_regclass('public.lotes_estoque') is null
    or to_regclass('public.reservas_estoque') is null
    or to_regclass('public.estoque_movimentacoes') is null
    or to_regclass('public.eventos_status') is null
    or to_regprocedure('public.fn_exige_papel(text)') is null
    or to_regprocedure('kontrol_private.pode_editar_cadastro(text)') is null then
    raise exception '0109: dependencias fisicas ausentes';
  end if;
end $$;

-- 1) Modelo de quantidade por lote --------------------------------------

alter table public.lotes_estoque
  add column if not exists modelo_quantidade text not null default 'LEGADO',
  add column if not exists unidade_fisica_snapshot text,
  add column if not exists conteudo_embalagem_snapshot numeric,
  add column if not exists unidade_consumo_snapshot text,
  add column if not exists fator_conversao_snapshot numeric;

alter table public.lotes_estoque
  drop constraint if exists lotes_estoque_modelo_quantidade_check,
  add constraint lotes_estoque_modelo_quantidade_check
    check (modelo_quantidade in ('LEGADO', 'EMBALAGEM_FECHADA'));

alter table public.lotes_estoque
  drop constraint if exists lotes_estoque_embalagem_fechada_check,
  add constraint lotes_estoque_embalagem_fechada_check
    check (
      modelo_quantidade = 'LEGADO'
      or (
        modelo_quantidade = 'EMBALAGEM_FECHADA'
        and nullif(btrim(unidade_fisica_snapshot), '') is not null
        and conteudo_embalagem_snapshot > 0
        and nullif(btrim(unidade_consumo_snapshot), '') is not null
        and fator_conversao_snapshot > 0
        and quantidade_inicial >= 0
        and quantidade_atual >= 0
        and quantidade_inicial = trunc(quantidade_inicial)
        and quantidade_atual = trunc(quantidade_atual)
      )
    );

create index if not exists lotes_estoque_embalagem_fechada_fefo_idx
  on public.lotes_estoque (insumo_id, validade, id)
  where modelo_quantidade = 'EMBALAGEM_FECHADA'
    and status = 'aceito'
    and quantidade_atual > 0;

-- 2) v_estoque_saldo passa a enxergar embalagens fechadas ----------------
-- Mudanca minima: os filtros por status 'aceito'/'em_uso' restritos ao
-- modelo LEGADO continuam identicos (saldo legado preservado byte a byte);
-- some apenas uma condicao "ou" para o modelo EMBALAGEM_FECHADA (sempre
-- 'aceito', nunca quarentena/bloqueado/em_uso). A CTE de reservas nao muda:
-- nenhuma reserva referencia lotes deste modelo nesta etapa.

create or replace view public.v_estoque_saldo as
with reservas as (
  select
    r.insumo_id,
    coalesce(sum(r.quantidade - coalesce(r.quantidade_consumida, 0)), 0) as reservado
  from public.reservas_estoque r
  where r.status in ('reservado', 'parcial')
    and r.lote_id is not null
  group by r.insumo_id
),
saldos as (
  select
    i.id as insumo_id,
    i.tipo_insumo_id,
    ti.nome as tipo_insumo,
    ti.classe as classe_tipo_insumo,
    i.nome_item,
    i.especificacao,
    i.unidade,
    coalesce(sum(l.quantidade_atual) filter (
      where (l.modelo_quantidade = 'LEGADO' and l.status in ('aceito', 'em_uso'))
         or (l.modelo_quantidade = 'EMBALAGEM_FECHADA' and l.status = 'aceito')
    ), 0) as em_maos,
    coalesce(sum(l.quantidade_atual) filter (where l.status = 'quarentena'), 0) as em_quarentena,
    coalesce(sum(l.quantidade_atual) filter (where l.status = 'bloqueado'), 0) as bloqueado,
    coalesce(sum(l.quantidade_atual) filter (
      where (l.modelo_quantidade = 'LEGADO' and l.status in ('aceito', 'em_uso')
        and public.menor_validade(l.validade, l.validade_apos_abertura) < current_date)
         or (l.modelo_quantidade = 'EMBALAGEM_FECHADA' and l.status = 'aceito'
        and l.validade < current_date)
    ), 0) as vencido,
    coalesce(r.reservado, 0) as reservado,
    coalesce(sum(l.quantidade_atual) filter (
      where (l.modelo_quantidade = 'LEGADO' and l.status in ('aceito', 'em_uso')
        and (public.menor_validade(l.validade, l.validade_apos_abertura) is null
          or public.menor_validade(l.validade, l.validade_apos_abertura) >= current_date))
         or (l.modelo_quantidade = 'EMBALAGEM_FECHADA' and l.status = 'aceito'
        and (l.validade is null or l.validade >= current_date))
    ), 0) as disponivel_bruto,
    i.ponto_reposicao,
    i.estoque_seguranca,
    i.lead_time_dias,
    i.categoria_compra
  from public.insumos i
  left join public.tipo_insumos ti on ti.id = i.tipo_insumo_id
  left join public.lotes_estoque l on l.insumo_id = i.id
  left join reservas r on r.insumo_id = i.id
  group by i.id, ti.id, r.reservado
)
select
  insumo_id,
  tipo_insumo_id,
  tipo_insumo,
  classe_tipo_insumo,
  nome_item,
  especificacao,
  unidade,
  em_maos,
  em_quarentena,
  bloqueado,
  vencido,
  reservado,
  greatest(0, disponivel_bruto - reservado) as disponivel,
  ponto_reposicao,
  estoque_seguranca,
  lead_time_dias,
  categoria_compra
from saldos;

alter view public.v_estoque_saldo set (security_invoker = true);

-- 3) Cadastro de insumo com quantidade fisica (entrada direta) -----------
-- Autorizacao igual a criacao normal de insumo (kontrol_private.pode_editar_
-- cadastro('insumos.editar')), nao o papel tecnico/coordenador isolado: quem
-- ja pode cadastrar insumos pelo formulario generico continua podendo,
-- agora tambem informando a quantidade inicial no mesmo passo.

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
      'validade_apos_abertura_dias', 'validade_dias'
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
      v_insumo.id, 'CAD-' || left(p_operacao_id::text, 8), v_insumo.data_validade,
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

-- 4) Entrada manual direta (sem quarentena) para insumo existente --------
-- Mesma autorizacao da porta avulsa de estoque hoje (entrada_inventario):
-- papel tecnico. Bloqueia mistura com lotes legados (por volume) do mesmo
-- insumo para nao reinterpretar saldo antigo como contagem de embalagens.

create or replace function public.registrar_entrada_manual_embalagens(
  p_insumo_id bigint,
  p_quantidade_embalagens integer,
  p_operacao_id uuid,
  p_validade date,
  p_custo_total_embalagem numeric,
  p_codigo_lote text,
  p_fornecedor text,
  p_motivo text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ator_id uuid := auth.uid();
  v_claims jsonb;
  v_ator text;
  v_insumo public.insumos%rowtype;
  v_lote_id bigint;
  v_requisicao jsonb;
  v_resultado jsonb;
  v_evento public.eventos_status%rowtype;
begin
  perform public.fn_exige_papel('tecnico');
  if v_ator_id is null then
    raise exception 'Sessão inválida.' using errcode = '28000';
  end if;
  if p_insumo_id is null or p_quantidade_embalagens is null
    or p_quantidade_embalagens <= 0 or p_operacao_id is null
    or p_custo_total_embalagem is null or p_custo_total_embalagem < 0
    or nullif(btrim(p_motivo), '') is null then
    raise exception 'Verifique insumo, quantidade, custo e motivo.' using errcode = '22023';
  end if;

  v_requisicao := jsonb_build_object(
    'acao', 'registrar_entrada_manual_embalagens', 'insumo_id', p_insumo_id,
    'quantidade_embalagens', p_quantidade_embalagens, 'validade', p_validade,
    'custo_total_embalagem', p_custo_total_embalagem,
    'codigo_lote', nullif(btrim(p_codigo_lote), ''),
    'fornecedor', nullif(btrim(p_fornecedor), ''), 'motivo', btrim(p_motivo)
  );
  perform pg_advisory_xact_lock(hashtextextended(p_operacao_id::text, 0));
  select * into v_evento
  from public.eventos_status e
  where e.entidade = 'lote_embalagem_fechada'
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

  select * into v_insumo
  from public.insumos i
  where i.id = p_insumo_id
  for update;
  if not found then
    raise exception 'Insumo não encontrado.' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.lotes_estoque l
    where l.insumo_id = p_insumo_id and l.modelo_quantidade = 'LEGADO' and l.quantidade_atual > 0
  ) then
    raise exception 'Este insumo usa controle por volume (modelo legado); use o fluxo de recebimento existente.' using errcode = '22023';
  end if;
  if nullif(btrim(v_insumo.unidade), '') is null
    or v_insumo.quantidade_embalagem is null or v_insumo.quantidade_embalagem <= 0
    or nullif(btrim(coalesce(v_insumo.unidade_consumo, v_insumo.unidade)), '') is null
    or v_insumo.fator_conversao is null or v_insumo.fator_conversao <= 0 then
    raise exception 'Cadastro da embalagem incompleto; complete unidade, quantidade da embalagem e fator de conversão.' using errcode = '22023';
  end if;
  if v_insumo.categoria_compra = 'critico' and p_validade is null then
    raise exception 'Insumo crítico exige data de validade.' using errcode = '22023';
  end if;

  v_claims := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  v_ator := coalesce(nullif(v_claims->>'email', ''), v_ator_id::text);
  insert into public.lotes_estoque (
    insumo_id, codigo_lote, validade, quantidade_inicial, quantidade_atual,
    custo_unitario, fornecedor, status, responsavel_recebimento,
    modelo_quantidade, unidade_fisica_snapshot, conteudo_embalagem_snapshot,
    unidade_consumo_snapshot, fator_conversao_snapshot
  ) values (
    p_insumo_id, coalesce(nullif(btrim(p_codigo_lote), ''), 'MANUAL-' || left(p_operacao_id::text, 8)),
    p_validade, p_quantidade_embalagens, p_quantidade_embalagens,
    p_custo_total_embalagem, nullif(btrim(p_fornecedor), ''), 'aceito', v_ator,
    'EMBALAGEM_FECHADA', btrim(v_insumo.unidade), v_insumo.quantidade_embalagem,
    btrim(coalesce(v_insumo.unidade_consumo, v_insumo.unidade)),
    v_insumo.fator_conversao
  ) returning id into v_lote_id;

  insert into public.estoque_movimentacoes (
    insumo_id, tipo, quantidade, custo_unitario, motivo, referencia, lote_id
  ) values (
    p_insumo_id, 'entrada', p_quantidade_embalagens, p_custo_total_embalagem,
    'entrada manual de embalagens fechadas: ' || btrim(p_motivo),
    p_operacao_id::text, v_lote_id
  );

  v_resultado := jsonb_build_object(
    'insumo_id', p_insumo_id, 'lote_id', v_lote_id,
    'quantidade_embalagens', p_quantidade_embalagens, 'repetido', false
  );
  insert into public.eventos_status (
    entidade, entidade_id, de_status, para_status, usuario, observacao,
    operacao_id, operacao_payload
  ) values (
    'lote_embalagem_fechada', v_lote_id, null, 'ENTRADA_MANUAL', v_ator,
    btrim(p_motivo), p_operacao_id,
    jsonb_build_object('requisicao', v_requisicao, 'resultado', v_resultado)
  );
  return v_resultado;
end;
$$;

-- 5) Abertura de embalagem: baixa de exatamente 1 unidade inteira --------
-- Nao registra conteudo restante (nao ha controle de "aberta"): o lote so
-- perde 1 unidade fechada. Checagem de estado esperado evita corrida entre
-- duas aberturas simultaneas do mesmo lote.

create or replace function public.abrir_embalagem(
  p_lote_id bigint,
  p_quantidade_esperada integer,
  p_operacao_id uuid,
  p_motivo text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ator_id uuid := auth.uid();
  v_claims jsonb;
  v_ator text;
  v_lote public.lotes_estoque%rowtype;
  v_reservado numeric;
  v_requisicao jsonb;
  v_resultado jsonb;
  v_evento public.eventos_status%rowtype;
begin
  perform public.fn_exige_papel('tecnico');
  if v_ator_id is null then
    raise exception 'Sessão inválida.' using errcode = '28000';
  end if;
  if p_lote_id is null or p_quantidade_esperada is null
    or p_quantidade_esperada <= 0 or p_operacao_id is null
    or nullif(btrim(p_motivo), '') is null then
    raise exception 'Verifique lote, quantidade esperada e motivo.' using errcode = '22023';
  end if;

  v_requisicao := jsonb_build_object(
    'acao', 'abrir_embalagem', 'lote_id', p_lote_id,
    'quantidade_esperada', p_quantidade_esperada, 'motivo', btrim(p_motivo)
  );
  perform pg_advisory_xact_lock(hashtextextended(p_operacao_id::text, 0));
  select * into v_evento
  from public.eventos_status e
  where e.entidade = 'lote_embalagem_fechada'
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

  select * into v_lote
  from public.lotes_estoque l
  where l.id = p_lote_id
  for update;
  if not found then
    raise exception 'Lote não encontrado.' using errcode = 'P0002';
  end if;
  if v_lote.modelo_quantidade <> 'EMBALAGEM_FECHADA' then
    raise exception 'Este lote não usa o modelo de embalagens fechadas.' using errcode = '22023';
  end if;
  if v_lote.status <> 'aceito' then
    raise exception 'Lote indisponível para abertura.' using errcode = '55000';
  end if;
  if v_lote.validade is not null and v_lote.validade < current_date then
    raise exception 'Lote vencido.' using errcode = '22023';
  end if;
  if v_lote.quantidade_atual <> p_quantidade_esperada then
    raise exception 'A quantidade do lote mudou; recarregue e tente novamente.' using errcode = '40001';
  end if;
  if v_lote.quantidade_atual < 1 then
    raise exception 'Saldo insuficiente para abrir uma embalagem.' using errcode = '22023';
  end if;

  perform r.id
  from public.reservas_estoque r
  where r.lote_id = p_lote_id and r.status in ('reservado', 'parcial')
  order by r.id
  for update;
  select coalesce(sum(r.quantidade - coalesce(r.quantidade_consumida, 0)), 0)
    into v_reservado
  from public.reservas_estoque r
  where r.lote_id = p_lote_id and r.status in ('reservado', 'parcial');
  if v_reservado > v_lote.quantidade_atual - 1 then
    raise exception 'Há reserva ativa incompatível com a abertura desta embalagem.' using errcode = '55000';
  end if;

  update public.lotes_estoque
     set quantidade_atual = quantidade_atual - 1,
         status = case when quantidade_atual - 1 = 0 then 'consumido' else 'aceito' end
   where id = p_lote_id;
  insert into public.estoque_movimentacoes (
    insumo_id, tipo, quantidade, custo_unitario, motivo, referencia, lote_id
  ) values (
    v_lote.insumo_id, 'saida', 1, v_lote.custo_unitario,
    'abertura de embalagem fechada: ' || btrim(p_motivo),
    p_operacao_id::text, p_lote_id
  );

  v_claims := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  v_ator := coalesce(nullif(v_claims->>'email', ''), v_ator_id::text);
  v_resultado := jsonb_build_object(
    'lote_id', p_lote_id,
    'quantidade_embalagens', v_lote.quantidade_atual - 1,
    'repetido', false
  );
  insert into public.eventos_status (
    entidade, entidade_id, de_status, para_status, usuario, observacao,
    operacao_id, operacao_payload
  ) values (
    'lote_embalagem_fechada', p_lote_id,
    v_lote.quantidade_atual::text, (v_lote.quantidade_atual - 1)::text,
    v_ator, btrim(p_motivo), p_operacao_id,
    jsonb_build_object('requisicao', v_requisicao, 'resultado', v_resultado)
  );
  return v_resultado;
end;
$$;

-- 6) Correcao autorizada e auditavel da quantidade (edicao) --------------
-- Papel coordenador (mesma exigencia de ajustar_saldo_lote). Nunca faz
-- UPDATE cego do saldo: aumento cria um novo lote de ajuste auditavel;
-- reducao baixa dos lotes existentes (FEFO), respeitando reservas. Recusa
-- operar sobre insumo com saldo legado por volume.

create or replace function public.corrigir_quantidade_embalagens_fechadas(
  p_insumo_id bigint,
  p_quantidade_alvo integer,
  p_operacao_id uuid,
  p_motivo text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ator_id uuid := auth.uid();
  v_claims jsonb;
  v_ator text;
  v_insumo public.insumos%rowtype;
  v_atual integer;
  v_delta integer;
  v_restante integer;
  v_take integer;
  v_reservado numeric;
  v_lote record;
  v_novo_lote_id bigint;
  v_requisicao jsonb;
  v_resultado jsonb;
  v_evento public.eventos_status%rowtype;
begin
  perform public.fn_exige_papel('coordenador');
  if v_ator_id is null then
    raise exception 'Sessão inválida.' using errcode = '28000';
  end if;
  if p_insumo_id is null or p_operacao_id is null
    or p_quantidade_alvo is null or p_quantidade_alvo < 0 then
    raise exception 'Informe insumo e quantidade alvo válida (maior ou igual a zero).' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_motivo, '')), '') is null then
    raise exception 'Informe o motivo da correção.' using errcode = '22023';
  end if;

  v_claims := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  v_ator := coalesce(nullif(v_claims->>'email', ''), v_ator_id::text);

  v_requisicao := jsonb_build_object(
    'acao', 'corrigir_quantidade_embalagens_fechadas', 'insumo_id', p_insumo_id,
    'quantidade_alvo', p_quantidade_alvo, 'motivo', btrim(p_motivo)
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

  select * into v_insumo from public.insumos i where i.id = p_insumo_id for update;
  if not found then
    raise exception 'Insumo não encontrado.' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.lotes_estoque l
    where l.insumo_id = p_insumo_id and l.modelo_quantidade = 'LEGADO' and l.quantidade_atual > 0
  ) then
    raise exception 'Este insumo usa controle por volume (modelo legado); não é possível corrigir como embalagens fechadas.' using errcode = '22023';
  end if;

  perform l.id
  from public.lotes_estoque l
  where l.insumo_id = p_insumo_id and l.modelo_quantidade = 'EMBALAGEM_FECHADA' and l.status = 'aceito'
  order by l.id
  for update;
  select coalesce(sum(l.quantidade_atual), 0)::integer into v_atual
  from public.lotes_estoque l
  where l.insumo_id = p_insumo_id and l.modelo_quantidade = 'EMBALAGEM_FECHADA' and l.status = 'aceito';

  v_delta := p_quantidade_alvo - v_atual;

  if v_delta = 0 then
    v_resultado := jsonb_build_object(
      'insumo_id', p_insumo_id, 'quantidade_embalagens', v_atual, 'repetido', false
    );
  elsif v_delta > 0 then
    if nullif(btrim(v_insumo.unidade), '') is null
      or v_insumo.quantidade_embalagem is null or v_insumo.quantidade_embalagem <= 0
      or nullif(btrim(coalesce(v_insumo.unidade_consumo, v_insumo.unidade)), '') is null
      or v_insumo.fator_conversao is null or v_insumo.fator_conversao <= 0 then
      raise exception 'Cadastro da embalagem incompleto; complete unidade, quantidade da embalagem e fator de conversão.' using errcode = '22023';
    end if;
    if v_insumo.categoria_compra = 'critico' and v_insumo.data_validade is null then
      raise exception 'Insumo crítico exige data de validade cadastrada antes de aumentar a quantidade.' using errcode = '22023';
    end if;

    insert into public.lotes_estoque (
      insumo_id, codigo_lote, validade, quantidade_inicial, quantidade_atual,
      custo_unitario, fornecedor, status, responsavel_recebimento,
      modelo_quantidade, unidade_fisica_snapshot, conteudo_embalagem_snapshot,
      unidade_consumo_snapshot, fator_conversao_snapshot
    ) values (
      p_insumo_id, 'AJUSTE-' || left(p_operacao_id::text, 8), v_insumo.data_validade,
      v_delta, v_delta, v_insumo.custo_total_embalagem, null, 'aceito', v_ator,
      'EMBALAGEM_FECHADA', btrim(v_insumo.unidade), v_insumo.quantidade_embalagem,
      btrim(coalesce(v_insumo.unidade_consumo, v_insumo.unidade)), v_insumo.fator_conversao
    ) returning id into v_novo_lote_id;

    insert into public.estoque_movimentacoes (
      insumo_id, tipo, quantidade, custo_unitario, motivo, referencia, lote_id
    ) values (
      p_insumo_id, 'ajuste', v_delta, v_insumo.custo_total_embalagem,
      'ajuste positivo (correção de cadastro): ' || btrim(p_motivo), p_operacao_id::text, v_novo_lote_id
    );

    v_resultado := jsonb_build_object(
      'insumo_id', p_insumo_id, 'lote_id', v_novo_lote_id,
      'quantidade_embalagens', v_atual + v_delta, 'repetido', false
    );
  else
    v_restante := abs(v_delta);
    for v_lote in
      select l.* from public.lotes_estoque l
      where l.insumo_id = p_insumo_id and l.modelo_quantidade = 'EMBALAGEM_FECHADA'
        and l.status = 'aceito' and l.quantidade_atual > 0
      order by l.validade nulls last, l.id
      for update
    loop
      exit when v_restante <= 0;
      select coalesce(sum(r.quantidade - coalesce(r.quantidade_consumida, 0)), 0)
        into v_reservado
      from public.reservas_estoque r
      where r.lote_id = v_lote.id and r.status in ('reservado', 'parcial');
      v_take := least(v_restante, floor(v_lote.quantidade_atual - v_reservado)::integer);
      if v_take <= 0 then
        continue;
      end if;

      update public.lotes_estoque
         set quantidade_atual = quantidade_atual - v_take,
             status = case when quantidade_atual - v_take <= 0 then 'consumido' else 'aceito' end
       where id = v_lote.id;
      insert into public.estoque_movimentacoes (
        insumo_id, tipo, quantidade, custo_unitario, motivo, referencia, lote_id
      ) values (
        p_insumo_id, 'ajuste', v_take, v_lote.custo_unitario,
        'ajuste negativo (correção de cadastro): ' || btrim(p_motivo), p_operacao_id::text, v_lote.id
      );
      v_restante := v_restante - v_take;
    end loop;

    if v_restante > 0 then
      raise exception 'Saldo disponível insuficiente para reduzir a quantidade (parte está reservada ou indisponível).' using errcode = '22023';
    end if;

    v_resultado := jsonb_build_object(
      'insumo_id', p_insumo_id, 'quantidade_embalagens', p_quantidade_alvo, 'repetido', false
    );
  end if;

  insert into public.eventos_status (
    entidade, entidade_id, de_status, para_status, usuario, observacao,
    operacao_id, operacao_payload
  ) values (
    'insumo_embalagem_fechada', p_insumo_id, v_atual::text, p_quantidade_alvo::text,
    v_ator, btrim(p_motivo), p_operacao_id,
    jsonb_build_object('requisicao', v_requisicao, 'resultado', v_resultado)
  );
  return v_resultado;
end;
$$;

-- 7) Permissoes de execucao das novas RPCs --------------------------------

revoke all on function public.criar_insumo_com_quantidade(jsonb, integer, uuid)
  from public, anon;
revoke all on function public.registrar_entrada_manual_embalagens(bigint, integer, uuid, date, numeric, text, text, text)
  from public, anon;
revoke all on function public.abrir_embalagem(bigint, integer, uuid, text)
  from public, anon;
revoke all on function public.corrigir_quantidade_embalagens_fechadas(bigint, integer, uuid, text)
  from public, anon;

grant execute on function public.criar_insumo_com_quantidade(jsonb, integer, uuid)
  to authenticated;
grant execute on function public.registrar_entrada_manual_embalagens(bigint, integer, uuid, date, numeric, text, text, text)
  to authenticated;
grant execute on function public.abrir_embalagem(bigint, integer, uuid, text)
  to authenticated;
grant execute on function public.corrigir_quantidade_embalagens_fechadas(bigint, integer, uuid, text)
  to authenticated;

commit;
