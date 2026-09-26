-- Auditoria de processos de 2026-09-26 (docs/auditoria-processos-2026-09-26.md), Onda 1.
--
-- Corrige defeitos comprovados por simulação no banco local, sem mudar regra
-- de negócio que dependa de decisão do dono:
--
--  A. Acesso anônimo. Views sem security_invoker rodam como dono e ignoram o
--     RLS: com a chave pública era possível ler o painel executivo e as
--     receitas das análises sem login. eventos_status tinha leitura anônima
--     (e-mails e motivos). Revoga o acesso de anon a todas as views de public
--     e remove as duas policies de leitura anônima (a aprovação pública usa
--     RPCs SECURITY DEFINER, que continuam funcionando).
--  B. Planejamento x embalagens fechadas. reservar_plano e dar_baixa_plano
--     tratavam a contagem de embalagens como se fosse a unidade física: um
--     plano de 2 mL tirava 2 frascos de 100 mL, o frasco restante sumia do
--     saldo ("em_uso") e uma demanda fracionária violava a constraint. Agora
--     a reserva e a baixa usam embalagens inteiras (arredondando para cima),
--     como a abertura de embalagem já faz. Lotes deixados em "em_uso" pelo
--     defeito voltam para "aceito".
--  C. Reservas-fantasma. Descartar, bloquear, estornar ou reduzir um lote
--     não liberava as reservas dele: o disponível do insumo era descontado
--     duas vezes e o plano não iniciava. Agora as reservas do lote são
--     liberadas e o plano fica com "reserva desatualizada" (o início já exige
--     nova reserva nesse caso).
--  D. Desbloquear lote em quarentena liberava o lote sem aceitação. Agora o
--     lote volta ao status que tinha antes do bloqueio.
--  E. Inventário aplicava a contagem como saldo absoluto mesmo que o lote
--     tivesse mudado depois da contagem ("ressuscitava" consumo). Agora exige
--     que o saldo atual seja o registrado na contagem.
--  F. Custo médio ponderado misturava preço por embalagem com preço por
--     unidade (até 100x maior). Lotes de embalagens fechadas são normalizados
--     pelo conteúdo da embalagem.
--  G. Margem real do plano procurava a referência "plano N", mas a baixa grava
--     "plano N; analise ...": o custo real era sempre zero.
--  H. "Liberar reservas" cancelava o plano. Agora devolve o plano ao rascunho.
--  I. Compra recebida em parte não tinha como ser encerrada. Nova transição
--     "recebido" com motivo obrigatório, que registra a pendência nos itens.
--  J. Exclusão de insumo ou equipamento apagava em cascata lotes,
--     movimentações, reservas, receitas e histórico de manutenção. Agora a
--     exclusão é recusada quando há vínculo (código 23503, a tela já traduz).
--
-- Aditiva: create or replace de funções e views (mesmas assinaturas e
-- colunas), uma view e gatilhos novos e um UPDATE de reparo auditado. Não
-- remove tabelas, colunas, dados nem RLS; só remove as policies de leitura
-- anônima.
-- Rollback: reaplicar as definições anteriores (0100, 0014, 0115, 0048, 0028,
-- 0071, 0101, 0096, 0099), dropar a view v_estoque_disponivel_unidade e os
-- gatilhos kontrol_bloquear_exclusao_*; recriar anon_read_eventos_status e
-- anon_read_tipo_insumos e os grants de anon nas views.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $$
begin
  if to_regprocedure('public.baixa_manual_embalagens(bigint, integer, integer, uuid, text)') is null
    or to_regnamespace('kontrol_private') is null
    or not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'lotes_estoque'
        and column_name = 'conteudo_embalagem_snapshot'
    ) then
    raise exception '0120: requer as migrations 0109, 0110 e 0112';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- A. Acesso anônimo
-- ---------------------------------------------------------------------------
do $$
declare
  v record;
begin
  for v in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('v', 'm')
  loop
    execute format('revoke all on public.%I from anon', v.relname);
  end loop;
end $$;

drop policy if exists anon_read_eventos_status on public.eventos_status;
drop policy if exists anon_read_tipo_insumos on public.tipo_insumos;

-- ---------------------------------------------------------------------------
-- C. Liberação das reservas de um lote que perdeu saldo ou disponibilidade
-- ---------------------------------------------------------------------------
create or replace function kontrol_private.liberar_reservas_do_lote(
  p_lote_id bigint,
  p_motivo text
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_planos bigint[];
  v_qtd integer;
begin
  with liberadas as (
    update public.reservas_estoque
       set status = 'liberado',
           liberado_em = coalesce(liberado_em, now()),
           observacao = left(coalesce(observacao || ' | ', '') || p_motivo, 500)
     where lote_id = p_lote_id
       and status in ('reservado', 'parcial')
    returning planejamento_id
  )
  select array_agg(distinct planejamento_id) filter (where planejamento_id is not null), count(*)
    into v_planos, v_qtd
  from liberadas;

  if v_planos is not null then
    update public.planejamento
       set reserva_desatualizada = true
     where id = any(v_planos)
       and status_operacional = 'reservado'
       and not reserva_desatualizada;
  end if;
  return v_qtd;
end $$;

revoke all on function kontrol_private.liberar_reservas_do_lote(bigint, text)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- B. Reserva e baixa do plano em embalagens inteiras para EMBALAGEM_FECHADA
-- ---------------------------------------------------------------------------
create or replace function public.reservar_plano(p_planejamento_id bigint, p_itens jsonb)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  d record;
  l record;
  v_status text;
  v_restante numeric;
  v_take numeric;
  v_disponivel numeric;
  v_conteudo numeric;
  v_short jsonb := '[]'::jsonb;
  v_claims jsonb;
  v_ator text;
begin
  perform fn_exige_papel('tecnico');

  v_claims := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  v_ator := coalesce(nullif(v_claims->>'email', ''), nullif(v_claims->>'sub', ''));

  select status_operacional
    into v_status
  from public.planejamento
  where id = p_planejamento_id
  for update;

  if not found then
    raise exception 'Planejamento nao encontrado.' using errcode = 'P0002';
  end if;
  if v_status not in ('rascunho', 'reservado') then
    raise exception 'Status do planejamento nao permite reservar insumos.' using errcode = '22023';
  end if;

  update public.reservas_estoque
     set status = 'liberado',
         liberado_em = coalesce(liberado_em, now()),
         observacao = coalesce(observacao, 'Substituida por nova reserva do plano')
   where planejamento_id = p_planejamento_id
     and status in ('reservado', 'parcial');

  -- A demanda chega na unidade física do insumo (consumo / fator_conversao).
  for d in
    select insumo_id, sum(quantidade) as demanda
    from (
      select
        (x->>'insumo_id')::bigint as insumo_id,
        greatest(0, (x->>'quantidade')::numeric) as quantidade
      from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) x
      where nullif(x->>'insumo_id', '') is not null
        and nullif(x->>'quantidade', '') is not null
    ) q
    where quantidade > 0
    group by insumo_id
  loop
    v_restante := d.demanda;

    for l in
      select le.*
      from public.lotes_estoque le
      where le.insumo_id = d.insumo_id
        and le.quantidade_atual > 0
        and (
          (le.modelo_quantidade = 'EMBALAGEM_FECHADA' and le.status = 'aceito')
          or (le.modelo_quantidade <> 'EMBALAGEM_FECHADA' and le.status in ('aceito', 'em_uso'))
        )
        and (
          public.menor_validade(le.validade, le.validade_apos_abertura) is null
          or public.menor_validade(le.validade, le.validade_apos_abertura) >= current_date
        )
      order by public.menor_validade(le.validade, le.validade_apos_abertura) nulls last, le.id
      for update
    loop
      exit when v_restante <= 0;

      select greatest(
        0,
        l.quantidade_atual - coalesce(sum(
          r.quantidade - coalesce(r.quantidade_consumida, 0)
        ), 0)
      )
        into v_disponivel
      from public.reservas_estoque r
      where r.lote_id = l.id
        and r.status in ('reservado', 'parcial')
        and r.lote_id is not null;

      if l.modelo_quantidade = 'EMBALAGEM_FECHADA' then
        -- Lote contado em embalagens: reserva embalagens inteiras. Abrir uma
        -- embalagem tira a embalagem inteira do saldo (abrir_embalagem).
        v_conteudo := coalesce(nullif(l.conteudo_embalagem_snapshot, 0), 1);
        v_take := least(ceil(v_restante / v_conteudo), floor(v_disponivel));
        if v_take <= 0 then
          continue;
        end if;
        insert into public.reservas_estoque(
          planejamento_id, insumo_id, lote_id, quantidade, quantidade_consumida,
          status, origem, criado_por, observacao
        ) values (
          p_planejamento_id, d.insumo_id, l.id, v_take, 0,
          'reservado', 'planejamento', v_ator,
          'Embalagens fechadas (' || to_char(v_conteudo, 'FM999999990.######') || ' '
            || coalesce(l.unidade_fisica_snapshot, '') || ' cada)'
        );
        v_restante := greatest(0, v_restante - v_take * v_conteudo);
      else
        v_take := least(v_restante, v_disponivel);
        if v_take <= 0 then
          continue;
        end if;
        insert into public.reservas_estoque(
          planejamento_id, insumo_id, lote_id, quantidade, quantidade_consumida,
          status, origem, criado_por
        ) values (
          p_planejamento_id, d.insumo_id, l.id, v_take, 0,
          'reservado', 'planejamento', v_ator
        );
        v_restante := v_restante - v_take;
      end if;
    end loop;

    if v_restante > 0 then
      insert into public.reservas_estoque(
        planejamento_id, insumo_id, lote_id, quantidade, quantidade_consumida,
        status, origem, criado_por, observacao
      ) values (
        p_planejamento_id, d.insumo_id, null, v_restante, 0,
        'parcial', 'planejamento', v_ator, 'Shortfall sem saldo fisico reservado'
      );

      v_short := v_short || jsonb_build_object(
        'insumo_id', d.insumo_id,
        'falta', v_restante
      );
    end if;
  end loop;

  perform set_config('app.planejamento_transicao', 'permitida', true);
  update public.planejamento
     set status_operacional = 'reservado',
         reservado_em = coalesce(reservado_em, now()),
         reservado_por = coalesce(reservado_por, v_ator)
   where id = p_planejamento_id;

  return jsonb_build_object('shortfalls', v_short);
end $$;

create or replace function public.dar_baixa_plano(p_planejamento_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  r record;
  l record;
  v_plano record;
  v_short jsonb := '[]'::jsonb;
  v_validade_apos_abertura date;
  v_analises text;
  v_equipamento_id bigint;
  v_claims jsonb;
  v_ator text;
  v_qtd numeric;
begin
  perform fn_exige_papel('tecnico');

  v_claims := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  v_ator := coalesce(nullif(v_claims->>'email', ''), nullif(v_claims->>'sub', ''));

  select status_operacional, data_inicio_prevista, data_fim_prevista
    into v_plano
  from public.planejamento
  where id = p_planejamento_id
  for update;

  if not found then
    raise exception 'Planejamento nao encontrado.' using errcode = 'P0002';
  end if;
  if v_plano.status_operacional <> 'reservado' then
    raise exception 'Reserve os insumos antes de iniciar o planejamento.' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.reservas_estoque
    where planejamento_id = p_planejamento_id
      and status in ('reservado', 'parcial')
  ) then
    raise exception 'O planejamento nao possui reservas ativas para a baixa.' using errcode = '22023';
  end if;

  perform id
  from public.reservas_estoque
  where planejamento_id = p_planejamento_id
    and status in ('reservado', 'parcial')
  order by id
  for update;

  for r in
    select
      lote_id,
      min(insumo_id) as insumo_id,
      sum(quantidade - coalesce(quantidade_consumida, 0)) as quantidade_pendente
    from public.reservas_estoque
    where planejamento_id = p_planejamento_id
      and status in ('reservado', 'parcial')
    group by lote_id
    order by lote_id nulls first
  loop
    if r.lote_id is null then
      v_short := v_short || jsonb_build_object(
        'insumo_id', r.insumo_id,
        'falta', r.quantidade_pendente
      );
      continue;
    end if;

    select le.*
      into l
    from public.lotes_estoque le
    where le.id = r.lote_id
    for update;

    if not found then
      v_short := v_short || jsonb_build_object(
        'insumo_id', r.insumo_id,
        'lote_id', r.lote_id,
        'falta', r.quantidade_pendente
      );
      continue;
    end if;
    if l.status not in ('aceito', 'em_uso')
       or (l.modelo_quantidade = 'EMBALAGEM_FECHADA' and l.status <> 'aceito')
       or l.quantidade_atual < r.quantidade_pendente
       or (
         public.menor_validade(l.validade, l.validade_apos_abertura) is not null
         and public.menor_validade(l.validade, l.validade_apos_abertura) < current_date
       ) then
      v_short := v_short || jsonb_build_object(
        'insumo_id', r.insumo_id,
        'lote_id', r.lote_id,
        'falta', case
          when l.status not in ('aceito', 'em_uso') then r.quantidade_pendente
          else greatest(0, r.quantidade_pendente - l.quantidade_atual)
        end
      );
    end if;
  end loop;

  if jsonb_array_length(v_short) > 0 then
    raise exception 'Nao e possivel iniciar: existem reservas sem estoque valido suficiente.'
      using errcode = '22023', detail = v_short::text;
  end if;

  for v_equipamento_id in
    select distinct ea.equipamento_id
    from public.planejamento_itens pi
    join public.equipamento_analise ea on ea.codigo_analise = pi.codigo_analise
    where pi.planejamento_id = p_planejamento_id
  loop
    if not exists (
      select 1
      from public.equipamento_reservas er
      join public.equipamento_unidades eu on eu.id = er.equipamento_unidade_id
      where er.planejamento_id = p_planejamento_id
        and er.status in ('reservado', 'em_uso')
        and eu.equipamento_id = v_equipamento_id
        and eu.ativo
        and eu.status_operacional in ('operacional', 'reservado')
        and er.data_inicio::date <= v_plano.data_inicio_prevista
        and er.data_fim::date >= v_plano.data_fim_prevista
    ) then
      raise exception 'Equipamento exigido pela analise nao possui reserva operacional valida.'
        using errcode = '23514';
    end if;
  end loop;

  select string_agg(distinct codigo_analise, ', ' order by codigo_analise)
    into v_analises
  from public.planejamento_itens
  where planejamento_id = p_planejamento_id;

  for r in
    select *
    from public.reservas_estoque
    where planejamento_id = p_planejamento_id
      and status in ('reservado', 'parcial')
      and lote_id is not null
    order by insumo_id, id
  loop
    select le.*, i.validade_apos_abertura_dias
      into l
    from public.lotes_estoque le
    join public.insumos i on i.id = le.insumo_id
    where le.id = r.lote_id;

    v_qtd := r.quantidade - coalesce(r.quantidade_consumida, 0);

    if l.modelo_quantidade = 'EMBALAGEM_FECHADA' then
      -- Embalagens fechadas saem inteiras; as que ficam continuam fechadas.
      update public.lotes_estoque
         set quantidade_atual = quantidade_atual - v_qtd,
             status = case when quantidade_atual - v_qtd <= 0 then 'consumido' else 'aceito' end
       where id = r.lote_id;
    else
      v_validade_apos_abertura := case
        when l.validade_apos_abertura is not null then l.validade_apos_abertura
        when l.validade_apos_abertura_dias is not null and l.validade_apos_abertura_dias > 0
          then current_date + l.validade_apos_abertura_dias
        else null
      end;

      update public.lotes_estoque
         set quantidade_atual = quantidade_atual - v_qtd,
             status = case
               when quantidade_atual - v_qtd <= 0 then 'consumido'
               else 'em_uso'
             end,
             data_abertura = coalesce(data_abertura, current_date),
             validade_apos_abertura = coalesce(validade_apos_abertura, v_validade_apos_abertura)
       where id = r.lote_id;
    end if;

    -- O trigger fn_validar_equipamentos_na_baixa_plano revalida cada saida.
    insert into public.estoque_movimentacoes(
      insumo_id, tipo, quantidade, custo_unitario, motivo, referencia, lote_id
    ) values (
      r.insumo_id,
      'saida',
      v_qtd,
      l.custo_unitario,
      case when l.modelo_quantidade = 'EMBALAGEM_FECHADA'
        then 'baixa analise lote reservado (embalagens fechadas)'
        else 'baixa analise lote reservado'
      end,
      'plano ' || p_planejamento_id || '; analise ' || coalesce(v_analises, '-') ||
        '; reserva ' || r.id,
      r.lote_id
    );

    update public.reservas_estoque
       set quantidade_consumida = quantidade,
           status = 'consumido',
           consumido_em = now(),
           observacao = coalesce(observacao, 'Consumida por inicio do planejamento')
     where id = r.id;
  end loop;

  update public.equipamento_reservas
     set status = 'em_uso'
   where planejamento_id = p_planejamento_id
     and status = 'reservado';

  perform set_config('app.planejamento_transicao', 'permitida', true);
  update public.planejamento
     set status_operacional = 'em_execucao',
         iniciado_em = coalesce(iniciado_em, now()),
         responsavel = coalesce(responsavel, v_ator)
   where id = p_planejamento_id;

  return jsonb_build_object('shortfalls', '[]'::jsonb);
end $$;

-- Reparo: lotes de embalagens fechadas que o defeito deixou em "em_uso"
-- sumiam do saldo e da baixa por embalagens. O UPDATE fica na auditoria.
do $$
declare
  v_qtd integer;
begin
  update public.lotes_estoque
     set status = 'aceito'
   where modelo_quantidade = 'EMBALAGEM_FECHADA'
     and status = 'em_uso'
     and quantidade_atual > 0;
  get diagnostics v_qtd = row_count;
  raise notice '0120: % lote(s) de embalagens fechadas voltaram de em_uso para aceito.', v_qtd;
end $$;

-- ---------------------------------------------------------------------------
-- H. "Liberar reservas" devolve o plano ao rascunho em vez de cancelar
-- ---------------------------------------------------------------------------
create or replace function public.liberar_plano(p_planejamento_id bigint)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_status text;
begin
  perform fn_exige_papel('coordenador');

  select status_operacional
    into v_status
  from public.planejamento
  where id = p_planejamento_id
  for update;

  if not found then
    raise exception 'Planejamento nao encontrado.' using errcode = 'P0002';
  end if;
  if v_status not in ('rascunho', 'reservado', 'cancelado') then
    raise exception 'Status do planejamento nao permite liberar reservas.' using errcode = '22023';
  end if;

  update public.reservas_estoque
     set status = 'liberado',
         liberado_em = coalesce(liberado_em, now())
   where planejamento_id = p_planejamento_id
     and status in ('reservado', 'parcial');

  update public.equipamento_reservas
     set status = 'liberado',
         liberado_em = coalesce(liberado_em, now())
   where planejamento_id = p_planejamento_id
     and status in ('reservado', 'em_uso');

  update public.equipamento_unidades eu
     set status_operacional = 'operacional'
   where eu.status_operacional = 'reservado'
     and exists (
       select 1
       from public.equipamento_reservas er
       where er.planejamento_id = p_planejamento_id
         and er.equipamento_unidade_id = eu.id
     )
     and not exists (
       select 1
       from public.equipamento_reservas er
       where er.equipamento_unidade_id = eu.id
         and er.status in ('reservado', 'em_uso')
     );

  -- Plano cancelado continua cancelado; os demais voltam a ser editáveis.
  if v_status <> 'cancelado' then
    perform set_config('app.planejamento_transicao', 'permitida', true);
    update public.planejamento
       set status_operacional = 'rascunho',
           reserva_desatualizada = false
     where id = p_planejamento_id;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- C/D. Bloqueio, desbloqueio, descarte, estorno e ajuste de lote
-- ---------------------------------------------------------------------------
create or replace function public.bloquear_lote(p_lote_id bigint, p_motivo text)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_status text;
begin
  perform fn_exige_papel('gestor');

  select status into v_status
  from public.lotes_estoque
  where id = p_lote_id
  for update;
  if not found then
    raise exception 'Lote não encontrado.' using errcode = 'P0002';
  end if;
  if v_status not in ('quarentena', 'aceito', 'em_uso') then
    raise exception 'Só é possível bloquear lote em quarentena, aceito ou em uso.' using errcode = '22023';
  end if;

  update public.lotes_estoque
     set status = 'bloqueado', motivo_bloqueio = p_motivo
   where id = p_lote_id;

  perform kontrol_private.liberar_reservas_do_lote(p_lote_id, 'Lote bloqueado');
end $$;

create or replace function public.desbloquear_lote(p_lote_id bigint)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_lote public.lotes_estoque%rowtype;
  v_anterior text;
begin
  perform fn_exige_papel('gestor');

  select * into v_lote
  from public.lotes_estoque
  where id = p_lote_id
  for update;
  if not found then
    raise exception 'Lote não encontrado.' using errcode = 'P0002';
  end if;
  if v_lote.status <> 'bloqueado' then
    return;
  end if;

  -- Volta ao status anterior ao bloqueio (trilha da auditoria). Sem trilha,
  -- lote por volume nunca aceito volta à quarentena.
  select a.valor_anterior->>'status'
    into v_anterior
  from public.auditoria a
  where a.tabela = 'lotes_estoque'
    and a.registro_id = p_lote_id::text
    and a.acao = 'update'
    and a.valor_novo->>'status' = 'bloqueado'
    and a.valor_anterior->>'status' is distinct from 'bloqueado'
  order by a.id desc
  limit 1;

  if v_anterior is null or v_anterior not in ('quarentena', 'aceito', 'em_uso') then
    v_anterior := case
      when v_lote.responsavel_liberacao is null and v_lote.criterio_aceitacao is null
        and v_lote.modelo_quantidade <> 'EMBALAGEM_FECHADA'
        then 'quarentena'
      else 'aceito'
    end;
  end if;
  if v_lote.modelo_quantidade = 'EMBALAGEM_FECHADA' and v_anterior = 'em_uso' then
    v_anterior := 'aceito';
  end if;

  update public.lotes_estoque
     set status = v_anterior, motivo_bloqueio = null
   where id = p_lote_id;
end $$;

create or replace function public.descartar_lote(p_lote_id bigint, p_justificativa text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lote public.lotes_estoque%rowtype;
  v_justificativa text := nullif(btrim(coalesce(p_justificativa, '')), '');
begin
  perform public.fn_exige_papel('gestor');

  select * into v_lote
  from public.lotes_estoque l
  where l.id = p_lote_id
  for update;
  if not found then
    raise exception 'Lote não encontrado.' using errcode = 'P0002';
  end if;
  if v_lote.status = 'descartado' then
    raise exception 'Este lote já foi descartado.' using errcode = '22023';
  end if;
  if v_lote.status = 'consumido' then
    raise exception 'Este lote já foi consumido; não há saldo para descartar.' using errcode = '22023';
  end if;

  update public.lotes_estoque
     set status = 'descartado',
         quantidade_atual = 0
   where id = p_lote_id;

  if coalesce(v_lote.quantidade_atual, 0) > 0 then
    insert into public.estoque_movimentacoes (
      insumo_id, tipo, quantidade, custo_unitario, motivo, lote_id, categoria_saida
    ) values (
      v_lote.insumo_id, 'ajuste', v_lote.quantidade_atual, v_lote.custo_unitario,
      'descarte: ' || coalesce(v_justificativa, '—'), p_lote_id, 'descarte'
    );
  end if;

  perform kontrol_private.liberar_reservas_do_lote(p_lote_id, 'Lote descartado');
end;
$$;

create or replace function public.estornar_recebimento_lote(p_lote_id bigint, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = 'public'
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

  perform kontrol_private.liberar_reservas_do_lote(p_lote_id, 'Recebimento estornado');
end $$;

create or replace function public.ajustar_saldo_lote(p_lote_id bigint, p_quantidade_nova numeric, p_motivo text)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_lote record;
  v_delta numeric;
  v_reservado numeric;
begin
  perform fn_exige_papel('coordenador');

  if p_quantidade_nova is null or p_quantidade_nova < 0 then
    raise exception 'Saldo contado deve ser maior ou igual a zero.' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_motivo, '')), '') is null then
    raise exception 'Informe o motivo do ajuste.' using errcode = '22023';
  end if;

  select *
    into v_lote
  from lotes_estoque
  where id = p_lote_id
  for update;

  if not found then
    raise exception 'Lote não encontrado.' using errcode = 'P0002';
  end if;
  if v_lote.status in ('descartado','consumido') and p_quantidade_nova > 0 then
    raise exception 'Não reabra lote consumido ou descartado por ajuste direto.' using errcode = '22023';
  end if;
  if v_lote.modelo_quantidade = 'EMBALAGEM_FECHADA' and p_quantidade_nova <> trunc(p_quantidade_nova) then
    raise exception 'Este lote é contado em embalagens fechadas: informe um número inteiro.' using errcode = '22023';
  end if;

  v_delta := p_quantidade_nova - v_lote.quantidade_atual;
  if v_delta = 0 then
    return;
  end if;

  update lotes_estoque
     set quantidade_atual = p_quantidade_nova,
         status = case
           when p_quantidade_nova = 0 then 'consumido'
           when modelo_quantidade = 'EMBALAGEM_FECHADA' and status in ('consumido', 'em_uso') then 'aceito'
           when status = 'consumido' then 'em_uso'
           else status
         end
   where id = p_lote_id;

  insert into estoque_movimentacoes(insumo_id, tipo, quantidade, custo_unitario, motivo, referencia, lote_id)
  values (
    v_lote.insumo_id,
    'ajuste',
    abs(v_delta),
    v_lote.custo_unitario,
    case when v_delta < 0 then 'ajuste negativo: ' else 'ajuste positivo: ' end || btrim(p_motivo),
    'saldo anterior ' || v_lote.quantidade_atual || '; saldo contado ' || p_quantidade_nova,
    p_lote_id
  );

  if v_delta < 0 then
    select coalesce(sum(r.quantidade - coalesce(r.quantidade_consumida, 0)), 0)
      into v_reservado
    from reservas_estoque r
    where r.lote_id = p_lote_id and r.status in ('reservado', 'parcial');
    if v_reservado > p_quantidade_nova then
      perform kontrol_private.liberar_reservas_do_lote(p_lote_id, 'Saldo do lote reduzido por ajuste');
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- E. Inventário só aplica a contagem se o lote não mudou desde a contagem
-- ---------------------------------------------------------------------------
create or replace function public.aplicar_ajuste_inventario_contagem(p_contagem_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_contagem public.inventario_contagens%rowtype;
  v_ciclo_status text;
  v_responsavel text;
  v_saldo_atual numeric;
begin
  select *
    into v_contagem
    from public.inventario_contagens
   where id = p_contagem_id
   for update;

  if not found then
    raise exception 'Contagem de inventario nao encontrada.' using errcode = '22023';
  end if;

  select status
    into v_ciclo_status
    from public.inventario_ciclos
   where id = v_contagem.ciclo_id
   for update;

  if v_ciclo_status is distinct from 'aberto' then
    raise exception 'Campanha de inventario nao esta aberta.' using errcode = '22023';
  end if;

  if v_contagem.ajuste_aplicado then
    raise exception 'Ajuste ja aplicado para esta contagem.' using errcode = '22023';
  end if;

  if abs(v_contagem.divergencia) <= 0.000001 then
    raise exception 'Contagem sem divergencia nao exige ajuste.' using errcode = '22023';
  end if;

  if nullif(btrim(coalesce(v_contagem.justificativa, '')), '') is null then
    raise exception 'Justificativa obrigatoria para ajuste de inventario.' using errcode = '22023';
  end if;

  select quantidade_atual into v_saldo_atual
  from public.lotes_estoque
  where id = v_contagem.lote_id
  for update;
  if v_saldo_atual is distinct from v_contagem.quantidade_sistema then
    raise exception 'O saldo do lote mudou depois da contagem (era %, agora %). Conte de novo antes de ajustar.',
      v_contagem.quantidade_sistema, v_saldo_atual
      using errcode = '40001';
  end if;

  v_responsavel := coalesce(
    nullif(auth.jwt() ->> 'email', ''),
    nullif(auth.uid()::text, ''),
    current_user
  );

  perform public.ajustar_saldo_lote(
    v_contagem.lote_id,
    v_contagem.quantidade_contada,
    'inventario ciclo #' || v_contagem.ciclo_id || ': ' || btrim(v_contagem.justificativa)
      || coalesce(' (ajustado por ' || v_responsavel || ')', '')
  );

  update public.inventario_contagens
     set ajuste_aplicado = true,
         ajustado_em = now(),
         ajustado_por = v_responsavel
   where id = v_contagem.id;

  return jsonb_build_object(
    'contagem_id', v_contagem.id,
    'ciclo_id', v_contagem.ciclo_id,
    'lote_id', v_contagem.lote_id,
    'quantidade_contada', v_contagem.quantidade_contada
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- F. Custo médio ponderado com lotes de embalagens fechadas normalizados
-- ---------------------------------------------------------------------------
create or replace view public.v_custo_estoque_vigente as
 WITH lotes_liberados AS (
         SELECT l.insumo_id,
            CASE
                WHEN l.modelo_quantidade = 'EMBALAGEM_FECHADA'::text
                  THEN l.quantidade_atual * COALESCE(NULLIF(l.conteudo_embalagem_snapshot, 0::numeric), 1::numeric)
                ELSE l.quantidade_atual
            END AS quantidade_atual,
            CASE
                WHEN l.modelo_quantidade = 'EMBALAGEM_FECHADA'::text
                  THEN l.custo_unitario / COALESCE(NULLIF(l.conteudo_embalagem_snapshot, 0::numeric), 1::numeric)
                ELSE l.custo_unitario
            END AS custo_unitario
           FROM lotes_estoque l
          WHERE l.quantidade_atual > 0::numeric
            AND ((l.modelo_quantidade = 'EMBALAGEM_FECHADA'::text AND l.status = 'aceito'::text)
              OR (l.modelo_quantidade <> 'EMBALAGEM_FECHADA'::text AND (l.status = ANY (ARRAY['aceito'::text, 'em_uso'::text]))))
            AND (menor_validade(l.validade, l.validade_apos_abertura) IS NULL OR menor_validade(l.validade, l.validade_apos_abertura) >= CURRENT_DATE)
        ), agregados AS (
         SELECT lotes_liberados.insumo_id,
            sum(lotes_liberados.quantidade_atual) AS quantidade_liberada,
            sum(lotes_liberados.quantidade_atual * lotes_liberados.custo_unitario) FILTER (WHERE lotes_liberados.custo_unitario > 0::numeric) AS valor_liberado,
            sum(lotes_liberados.quantidade_atual * lotes_liberados.custo_unitario) FILTER (WHERE lotes_liberados.custo_unitario > 0::numeric) / NULLIF(sum(lotes_liberados.quantidade_atual) FILTER (WHERE lotes_liberados.custo_unitario > 0::numeric), 0::numeric) AS custo_medio_ponderado
           FROM lotes_liberados
          GROUP BY lotes_liberados.insumo_id
        )
 SELECT i.id AS insumo_id,
    i.especificacao,
    i.unidade,
    i.custo_unitario AS custo_padrao,
    COALESCE(a.quantidade_liberada, 0::numeric) AS quantidade_liberada,
    COALESCE(a.valor_liberado, 0::numeric) AS valor_liberado,
    a.custo_medio_ponderado,
        CASE
            WHEN a.custo_medio_ponderado IS NULL THEN NULL::numeric
            ELSE a.custo_medio_ponderado - COALESCE(i.custo_unitario, 0::numeric)
        END AS divergencia_absoluta,
        CASE
            WHEN a.custo_medio_ponderado IS NULL OR COALESCE(i.custo_unitario, 0::numeric) = 0::numeric THEN NULL::numeric
            ELSE (a.custo_medio_ponderado - i.custo_unitario) / i.custo_unitario * 100::numeric
        END AS divergencia_percentual,
        CASE
            WHEN a.custo_medio_ponderado IS NULL AND NOT COALESCE(i.custo_unitario, 0::numeric) > 0::numeric THEN 'sem_custo_disponivel'::text
            WHEN a.custo_medio_ponderado IS NULL THEN 'fallback_custo_padrao'::text
            WHEN COALESCE(i.custo_unitario, 0::numeric) = 0::numeric THEN 'sem_custo_padrao'::text
            WHEN (abs(a.custo_medio_ponderado - i.custo_unitario) / i.custo_unitario) >= 0.1 THEN 'divergente'::text
            ELSE 'alinhado'::text
        END AS situacao,
    i.unidade AS unidade_estoque,
    COALESCE(NULLIF(i.unidade_consumo, ''::text), i.unidade) AS unidade_consumo,
        CASE
            WHEN i.fator_conversao > 0::numeric THEN i.fator_conversao
            ELSE NULL::numeric
        END AS fator_conversao,
    COALESCE(a.custo_medio_ponderado,
        CASE
            WHEN i.custo_unitario > 0::numeric THEN i.custo_unitario
            ELSE NULL::numeric
        END) AS custo_origem,
    COALESCE(a.custo_medio_ponderado,
        CASE
            WHEN i.custo_unitario > 0::numeric THEN i.custo_unitario
            ELSE NULL::numeric
        END) /
        CASE
            WHEN i.fator_conversao > 0::numeric THEN i.fator_conversao
            ELSE NULL::numeric
        END AS custo_normalizado,
        CASE
            WHEN a.custo_medio_ponderado IS NOT NULL THEN 'custo_medio_ponderado'::text
            WHEN i.custo_unitario > 0::numeric THEN 'custo_padrao_fallback'::text
            ELSE 'indisponivel'::text
        END AS fonte_custo,
        CASE
            WHEN a.custo_medio_ponderado IS NOT NULL THEN 'lotes_estoque_liberados'::text
            WHEN i.custo_unitario > 0::numeric THEN 'insumos:'::text || i.id
            ELSE NULL::text
        END AS referencia_custo
   FROM insumos i
     LEFT JOIN agregados a ON a.insumo_id = i.id;

revoke all on public.v_custo_estoque_vigente from anon;
grant select on public.v_custo_estoque_vigente to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- G. Margem real: casar o formato da referência gravada pela baixa do plano
-- ---------------------------------------------------------------------------
create or replace view public.v_margem_real_planejamento as
 SELECT p.id AS planejamento_id,
    p.orcamento_id,
    COALESCE(orc.custo_orcado, 0::numeric) AS custo_orcado,
    COALESCE(orc.receita_orcada, 0::numeric) AS receita_orcada,
    COALESCE(consumo.custo_real_insumos, 0::numeric) AS custo_real_insumos,
    COALESCE(consumo.quantidade_movimentacoes, 0::bigint) AS quantidade_movimentacoes,
    COALESCE(orc.receita_orcada, 0::numeric) - COALESCE(orc.custo_orcado, 0::numeric) AS margem_prevista,
    COALESCE(orc.receita_orcada, 0::numeric) - COALESCE(consumo.custo_real_insumos, 0::numeric) AS margem_real_parcial,
        CASE
            WHEN COALESCE(orc.receita_orcada, 0::numeric) > 0::numeric THEN (COALESCE(orc.receita_orcada, 0::numeric) - COALESCE(consumo.custo_real_insumos, 0::numeric)) / orc.receita_orcada * 100::numeric
            ELSE NULL::numeric
        END AS margem_real_parcial_percentual
   FROM planejamento p
     LEFT JOIN LATERAL ( SELECT sum(oi.custo_unitario * oi.n_amostras) AS custo_orcado,
            sum(oi.preco_unitario * oi.n_amostras) AS receita_orcada
           FROM orcamento_itens oi
          WHERE oi.orcamento_id = p.orcamento_id) orc ON true
     LEFT JOIN LATERAL ( SELECT sum(m.quantidade * COALESCE(m.custo_unitario, 0::numeric)) AS custo_real_insumos,
            count(*) AS quantidade_movimentacoes
           FROM estoque_movimentacoes m
          WHERE m.tipo = 'saida'::text
            AND (m.referencia = ('plano '::text || p.id::text)
              OR m.referencia LIKE ('plano '::text || p.id::text || ';%'::text))) consumo ON true
  WHERE p.orcamento_id IS NOT NULL;

revoke all on public.v_margem_real_planejamento from anon;
grant select on public.v_margem_real_planejamento to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- B. Disponível na unidade física, somando lotes dos dois modelos
-- ---------------------------------------------------------------------------
create or replace view public.v_estoque_disponivel_unidade
with (security_invoker = true) as
with lotes as (
  select
    l.id,
    l.insumo_id,
    l.quantidade_atual,
    case
      when l.modelo_quantidade = 'EMBALAGEM_FECHADA'
        then coalesce(nullif(l.conteudo_embalagem_snapshot, 0), 1)
      else 1
    end as conteudo,
    (
      (l.modelo_quantidade = 'EMBALAGEM_FECHADA' and l.status = 'aceito'
        and (l.validade is null or l.validade >= current_date))
      or (l.modelo_quantidade <> 'EMBALAGEM_FECHADA' and l.status in ('aceito', 'em_uso')
        and (public.menor_validade(l.validade, l.validade_apos_abertura) is null
          or public.menor_validade(l.validade, l.validade_apos_abertura) >= current_date))
    ) as utilizavel
  from public.lotes_estoque l
  where l.quantidade_atual > 0
), reservas as (
  select r.lote_id, sum(r.quantidade - coalesce(r.quantidade_consumida, 0)) as quantidade
  from public.reservas_estoque r
  where r.status in ('reservado', 'parcial') and r.lote_id is not null
  group by r.lote_id
)
select
  lotes.insumo_id,
  sum(case when lotes.utilizavel then lotes.quantidade_atual * lotes.conteudo else 0 end) as em_maos_unidade,
  sum(coalesce(reservas.quantidade, 0) * lotes.conteudo) as reservado_unidade,
  sum(case
    when lotes.utilizavel
      then greatest(0, lotes.quantidade_atual - coalesce(reservas.quantidade, 0)) * lotes.conteudo
    else 0
  end) as disponivel_unidade
from lotes
left join reservas on reservas.lote_id = lotes.id
group by lotes.insumo_id;

comment on view public.v_estoque_disponivel_unidade is
  'Saldo por insumo na unidade física (lotes de embalagens fechadas multiplicados pelo conteúdo), descontando só as reservas do próprio lote. Usado pelo planejamento (0120).';

revoke all on public.v_estoque_disponivel_unidade from anon;
grant select on public.v_estoque_disponivel_unidade to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- I. Encerrar compra recebida em parte
-- ---------------------------------------------------------------------------
create or replace function public.transicionar_pedido_compra(
  p_pedido_id bigint,
  p_status_destino text,
  p_observacao text default null,
  p_data_prevista_entrega date default null
) returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_pedido record;
  v_claims jsonb;
  v_ator text;
  v_tem_recebimento boolean;
begin
  perform fn_exige_papel('coordenador');

  v_claims := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  v_ator := coalesce(nullif(v_claims->>'email', ''), nullif(v_claims->>'sub', ''));
  if v_ator is null then
    raise exception 'Contexto JWT do ator e obrigatorio para transicionar a compra.' using errcode = '42501';
  end if;

  select id, status
    into v_pedido
  from public.pedidos_compra
  where id = p_pedido_id
  for update;

  if not found then
    raise exception 'Pedido de compra nao encontrado.' using errcode = 'P0002';
  end if;

  if not (
    (v_pedido.status = 'solicitado' and p_status_destino = 'aprovado') or
    (v_pedido.status = 'aprovado' and p_status_destino = 'enviado') or
    (v_pedido.status = 'enviado' and p_status_destino = 'em_transito') or
    (v_pedido.status in ('solicitado', 'aprovado', 'enviado', 'em_transito') and p_status_destino = 'cancelado') or
    (v_pedido.status in ('aprovado', 'enviado', 'em_transito') and p_status_destino = 'recebido')
  ) then
    raise exception 'Transicao de status nao permitida: % -> %.', v_pedido.status, p_status_destino
      using errcode = '22023';
  end if;

  select exists (
      select 1
      from public.pedidos_compra_item_recebimentos r
      where r.pedido_compra_id = p_pedido_id
        and r.estornado_em is null
        and r.quantidade > 0
    ) or exists (
      select 1
      from public.pedidos_internos_item_recebimentos r
      join public.pedidos_compra_itens i on i.id = r.pedido_compra_item_id
      where i.pedido_id = p_pedido_id
        and r.estornado_em is null
        and r.quantidade > 0
    ) or exists (
      select 1 from public.pedidos_compra_itens
      where pedido_id = p_pedido_id and lote_id is not null
    )
    into v_tem_recebimento;

  if p_status_destino = 'cancelado' and v_tem_recebimento then
    raise exception 'Pedido com recebimento parcial ou total nao pode ser cancelado. Use "Encerrar com pendência".' using errcode = '22023';
  end if;

  if p_status_destino = 'recebido' then
    if not v_tem_recebimento then
      raise exception 'Nada foi recebido nesta compra; para desistir dela, cancele.' using errcode = '22023';
    end if;
    if nullif(btrim(coalesce(p_observacao, '')), '') is null then
      raise exception 'Informe por que a compra será encerrada com itens pendentes.' using errcode = '22023';
    end if;
    update public.pedidos_compra_itens
       set divergencia_recebimento = left(
             'Encerrado com pendência: recebido '
               || coalesce(quantidade_recebida, 0) || ' de ' || quantidade
               || '. Motivo: ' || btrim(p_observacao), 500)
     where pedido_id = p_pedido_id
       and coalesce(quantidade_recebida, case when lote_id is not null then quantidade else 0 end) < quantidade;
  end if;

  perform set_config('app.pedido_compra_transicao', 'permitida', true);
  update public.pedidos_compra
     set status = p_status_destino,
         aprovador = case when p_status_destino = 'aprovado' then v_ator else aprovador end,
         data_aprovacao = case when p_status_destino = 'aprovado' then current_date else data_aprovacao end,
         data_prevista_entrega = case
           when p_status_destino = 'aprovado' then p_data_prevista_entrega
           else data_prevista_entrega
         end
   where id = p_pedido_id;

  insert into public.eventos_status(entidade, entidade_id, de_status, para_status, usuario, observacao)
  values (
    'pedido_compra', p_pedido_id, v_pedido.status, p_status_destino, v_ator,
    case when p_status_destino = 'recebido'
      then 'Encerrada com pendência: ' || btrim(p_observacao)
      else p_observacao
    end
  );

  return jsonb_build_object(
    'status_origem', v_pedido.status,
    'status_destino', p_status_destino,
    'data_prevista_entrega', p_data_prevista_entrega
  );
end $$;

-- ---------------------------------------------------------------------------
-- J. Exclusão de cadastro com histórico
-- ---------------------------------------------------------------------------
create or replace function kontrol_private.bloquear_exclusao_insumo_com_historico()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.lotes_estoque where insumo_id = old.id)
    or exists (select 1 from public.estoque_movimentacoes where insumo_id = old.id)
    or exists (select 1 from public.reservas_estoque where insumo_id = old.id)
    or exists (select 1 from public.pedidos_compra_itens where insumo_id = old.id)
    or exists (select 1 from public.pedidos_internos_itens where insumo_id = old.id)
    or exists (select 1 from public.insumo_analise where insumo_id = old.id) then
    raise exception 'Não é possível excluir: o insumo tem lotes, movimentações, pedidos ou está em uma análise.'
      using errcode = '23503';
  end if;
  return old;
end $$;

create or replace function kontrol_private.bloquear_exclusao_equipamento_com_historico()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.equipamento_analise where equipamento_id = old.id)
    or exists (select 1 from public.equipamento_planos_manutencao where equipamento_id = old.id)
    or exists (
      select 1
      from public.equipamento_unidades u
      where u.equipamento_id = old.id
        and (
          exists (select 1 from public.equipamento_manutencoes m where m.equipamento_unidade_id = u.id)
          or exists (select 1 from public.equipamento_status_log s where s.equipamento_unidade_id = u.id)
          or exists (select 1 from public.equipamento_reservas r where r.equipamento_unidade_id = u.id)
        )
    ) then
    raise exception 'Não é possível excluir: o equipamento está em uma análise ou tem histórico de uso e manutenção.'
      using errcode = '23503';
  end if;
  return old;
end $$;

revoke all on function kontrol_private.bloquear_exclusao_insumo_com_historico() from public, anon, authenticated;
revoke all on function kontrol_private.bloquear_exclusao_equipamento_com_historico() from public, anon, authenticated;

drop trigger if exists kontrol_bloquear_exclusao_insumo on public.insumos;
create trigger kontrol_bloquear_exclusao_insumo
  before delete on public.insumos
  for each row execute function kontrol_private.bloquear_exclusao_insumo_com_historico();

drop trigger if exists kontrol_bloquear_exclusao_equipamento on public.equipamentos;
create trigger kontrol_bloquear_exclusao_equipamento
  before delete on public.equipamentos
  for each row execute function kontrol_private.bloquear_exclusao_equipamento_com_historico();

commit;
