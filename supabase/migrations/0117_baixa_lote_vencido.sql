-- Baixa de lote vencido com motivo "Vencimento" (relatorio de bugs v5, item 10).
--
-- Na 0110, lote vencido nao aceitava baixa e a unica saida era o descarte,
-- restrito a gestor: o tecnico nao conseguia tirar do saldo o material que
-- venceu na prateleira. Esta migration recria baixa_manual_embalagens e
-- baixa_manual_lote (mesmas assinaturas, permissoes e guardas de reserva)
-- com duas mudancas:
--   * lote vencido aceita baixa quando o motivo e "Vencimento";
--   * perdas ("Vencimento", "Perda/quebra") sao gravadas como 'ajuste',
--     com categoria_saida, para nao inflar a previsao de consumo (que soma
--     so 'saida'), e nao marcam o lote legado como aberto.
--
-- Aditiva: create or replace; nao remove dados, colunas, politicas nem gatilhos.
-- Rollback: reaplicar as duas funcoes da 0110.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
begin
  if to_regprocedure('public.baixa_manual_embalagens(bigint, integer, integer, uuid, text)') is null
    or not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'estoque_movimentacoes'
        and column_name = 'categoria_saida'
    ) then
    raise exception '0117: requer as migrations 0110 e 0115';
  end if;
end $$;

create or replace function public.baixa_manual_embalagens(
  p_lote_id bigint,
  p_quantidade integer,
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
  v_restante integer;
  v_requisicao jsonb;
  v_resultado jsonb;
  v_evento public.eventos_status%rowtype;
  v_vencimento boolean := lower(btrim(coalesce(p_motivo, ''))) like 'vencimento%';
  v_perda boolean := lower(btrim(coalesce(p_motivo, ''))) like 'vencimento%'
    or lower(btrim(coalesce(p_motivo, ''))) like 'perda%';
begin
  perform public.fn_exige_papel('tecnico');
  if v_ator_id is null then
    raise exception 'Sessão inválida.' using errcode = '28000';
  end if;
  if p_lote_id is null or p_operacao_id is null
    or p_quantidade is null or p_quantidade <= 0
    or p_quantidade_esperada is null or p_quantidade_esperada <= 0 then
    raise exception 'Informe o lote e uma quantidade inteira de embalagens maior que zero.' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_motivo, '')), '') is null then
    raise exception 'Informe o motivo da baixa.' using errcode = '22023';
  end if;

  v_requisicao := jsonb_build_object(
    'acao', 'baixa_manual_embalagens', 'lote_id', p_lote_id,
    'quantidade', p_quantidade, 'quantidade_esperada', p_quantidade_esperada,
    'motivo', btrim(p_motivo)
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
    raise exception 'Este lote é controlado por volume (modelo legado); use a baixa manual do lote.' using errcode = '22023';
  end if;
  if v_lote.status <> 'aceito' then
    raise exception 'Só é possível dar baixa em lote aceito.' using errcode = '55000';
  end if;
  if v_lote.validade is not null and v_lote.validade < current_date and not v_vencimento then
    raise exception 'Lote vencido: registre a baixa com o motivo Vencimento.' using errcode = '22023';
  end if;
  if v_lote.quantidade_atual <> p_quantidade_esperada then
    raise exception 'A quantidade do lote mudou; recarregue e tente novamente.' using errcode = '40001';
  end if;
  if p_quantidade > v_lote.quantidade_atual then
    raise exception 'Quantidade maior que o saldo do lote (% embalagens).', v_lote.quantidade_atual::integer
      using errcode = '22023';
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
  if v_reservado > v_lote.quantidade_atual - p_quantidade then
    raise exception 'Há reserva ativa neste lote: é possível baixar no máximo % embalagem(ns).',
      greatest(0, floor(v_lote.quantidade_atual - v_reservado))::integer
      using errcode = '55000';
  end if;

  v_restante := (v_lote.quantidade_atual - p_quantidade)::integer;
  update public.lotes_estoque
     set quantidade_atual = v_restante,
         status = case when v_restante = 0 then 'consumido' else 'aceito' end
   where id = p_lote_id;

  -- perdas (vencimento, perda/quebra) ficam fora da previsão de consumo, que soma só 'saida'
  insert into public.estoque_movimentacoes (
    insumo_id, tipo, quantidade, custo_unitario, motivo, referencia, lote_id, categoria_saida
  ) values (
    v_lote.insumo_id, case when v_perda then 'ajuste' else 'saida' end, p_quantidade, v_lote.custo_unitario,
    'baixa manual: ' || btrim(p_motivo), p_operacao_id::text, p_lote_id,
    case when v_vencimento then 'vencido' when v_perda then 'perda' end
  );

  v_claims := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  v_ator := coalesce(nullif(v_claims->>'email', ''), v_ator_id::text);
  v_resultado := jsonb_build_object(
    'lote_id', p_lote_id,
    'insumo_id', v_lote.insumo_id,
    'quantidade_baixada', p_quantidade,
    'quantidade_embalagens', v_restante,
    'repetido', false
  );
  insert into public.eventos_status (
    entidade, entidade_id, de_status, para_status, usuario, observacao,
    operacao_id, operacao_payload
  ) values (
    'lote_embalagem_fechada', p_lote_id,
    v_lote.quantidade_atual::integer::text, v_restante::text,
    v_ator, 'baixa manual: ' || btrim(p_motivo), p_operacao_id,
    jsonb_build_object('requisicao', v_requisicao, 'resultado', v_resultado)
  );
  return v_resultado;
end;
$$;

comment on function public.baixa_manual_embalagens(bigint, integer, integer, uuid, text) is
  'Baixa manual de N embalagens fechadas de um lote EMBALAGEM_FECHADA (idempotente por operacao_id).';

revoke all on function public.baixa_manual_embalagens(bigint, integer, integer, uuid, text)
  from public, anon;
grant execute on function public.baixa_manual_embalagens(bigint, integer, integer, uuid, text)
  to authenticated;

-- 2) baixa_manual_lote: guardas de modelo e reserva -------------------------
-- Copia da definicao de 0028 (unica versao ate aqui), com duas guardas novas.
-- Assinatura, search_path, papel exigido, mensagens e efeitos para lotes
-- LEGADO permanecem os mesmos.

create or replace function public.baixa_manual_lote(
  p_lote_id bigint,
  p_quantidade numeric,
  p_motivo text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lote record;
  v_validade_apos_abertura date;
  v_reservado numeric;
  v_vencimento boolean := lower(btrim(coalesce(p_motivo, ''))) like 'vencimento%';
  v_perda boolean := lower(btrim(coalesce(p_motivo, ''))) like 'vencimento%'
    or lower(btrim(coalesce(p_motivo, ''))) like 'perda%';
begin
  perform fn_exige_papel('tecnico');

  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'Quantidade deve ser maior que zero.' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_motivo, '')), '') is null then
    raise exception 'Informe o motivo da baixa manual.' using errcode = '22023';
  end if;

  select l.*, i.validade_apos_abertura_dias
    into v_lote
  from lotes_estoque l
  join insumos i on i.id = l.insumo_id
  where l.id = p_lote_id
  for update;

  if not found then
    raise exception 'Lote não encontrado.' using errcode = 'P0002';
  end if;
  -- Guarda 0110: embalagens fechadas tem RPC propria (mantem status
  -- 'aceito', exige inteiro e idempotencia).
  if coalesce(v_lote.modelo_quantidade, 'LEGADO') = 'EMBALAGEM_FECHADA' then
    raise exception 'Lote de embalagens fechadas: use a baixa por embalagens (baixa_manual_embalagens).' using errcode = '22023';
  end if;
  if v_lote.status not in ('aceito','em_uso') then
    raise exception 'Só é possível baixar lote aceito ou em uso.' using errcode = '22023';
  end if;
  if v_lote.validade is not null and v_lote.validade < current_date and not v_vencimento then
    raise exception 'Lote vencido: registre a baixa com o motivo Vencimento.' using errcode = '22023';
  end if;
  if p_quantidade > v_lote.quantidade_atual then
    raise exception 'Quantidade maior que o saldo atual do lote.' using errcode = '22023';
  end if;

  -- Guarda 0110: a baixa manual nao pode consumir saldo reservado a planos.
  perform r.id
  from reservas_estoque r
  where r.lote_id = p_lote_id and r.status in ('reservado', 'parcial')
  order by r.id
  for update;
  select coalesce(sum(r.quantidade - coalesce(r.quantidade_consumida, 0)), 0)
    into v_reservado
  from reservas_estoque r
  where r.lote_id = p_lote_id and r.status in ('reservado', 'parcial');
  if v_reservado > v_lote.quantidade_atual - p_quantidade then
    raise exception 'Há reserva ativa neste lote: é possível baixar no máximo % sem afetar planos reservados.',
      greatest(0, v_lote.quantidade_atual - v_reservado)
      using errcode = '55000';
  end if;

  v_validade_apos_abertura :=
    case
      when v_lote.validade_apos_abertura is not null then v_lote.validade_apos_abertura
      when v_lote.validade_apos_abertura_dias is not null and v_lote.validade_apos_abertura_dias > 0
        then current_date + v_lote.validade_apos_abertura_dias
      else null
    end;

  -- perda não abre o frasco: status e datas de abertura só mudam no uso
  update lotes_estoque
     set quantidade_atual = quantidade_atual - p_quantidade,
         status = case
           when quantidade_atual - p_quantidade <= 0 then 'consumido'
           when v_perda then status
           else 'em_uso'
         end,
         data_abertura = case when v_perda then data_abertura else coalesce(data_abertura, current_date) end,
         validade_apos_abertura = case
           when v_perda then validade_apos_abertura
           else coalesce(validade_apos_abertura, v_validade_apos_abertura)
         end
   where id = p_lote_id;

  insert into estoque_movimentacoes(insumo_id, tipo, quantidade, custo_unitario, motivo, referencia, lote_id, categoria_saida)
  values (
    v_lote.insumo_id,
    case when v_perda then 'ajuste' else 'saida' end,
    p_quantidade,
    v_lote.custo_unitario,
    'baixa manual: ' || btrim(p_motivo),
    'lote ' || p_lote_id,
    p_lote_id,
    case when v_vencimento then 'vencido' when v_perda then 'perda' end
  );
end $$;

-- Mesmas permissoes de 0085.
revoke execute on function public.baixa_manual_lote(bigint, numeric, text) from public, anon;
grant execute on function public.baixa_manual_lote(bigint, numeric, text) to authenticated, service_role;

commit;
