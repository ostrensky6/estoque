-- =====================================================================
-- Reservas de planejamento e equipamentos com shortfall explicito.
--
-- Reutiliza as tabelas, a view e os RPCs existentes. Reservas sem lote
-- representam somente falta; nunca comprometem nem movimentam saldo fisico.
-- =====================================================================

create or replace view public.v_estoque_saldo as
with reservas as (
  select
    insumo_id,
    coalesce(sum(quantidade - coalesce(quantidade_consumida, 0)), 0) as reservado
  from public.reservas_estoque
  where status in ('reservado', 'parcial')
    and lote_id is not null
  group by insumo_id
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
    coalesce(sum(l.quantidade_atual) filter (where l.status in ('aceito', 'em_uso')), 0) as em_maos,
    coalesce(sum(l.quantidade_atual) filter (where l.status = 'quarentena'), 0) as em_quarentena,
    coalesce(sum(l.quantidade_atual) filter (where l.status = 'bloqueado'), 0) as bloqueado,
    coalesce(sum(l.quantidade_atual) filter (
      where l.status in ('aceito', 'em_uso')
        and public.menor_validade(l.validade, l.validade_apos_abertura) < current_date
    ), 0) as vencido,
    coalesce(r.reservado, 0) as reservado,
    coalesce(sum(l.quantidade_atual) filter (
      where l.status in ('aceito', 'em_uso')
        and (
          public.menor_validade(l.validade, l.validade_apos_abertura) is null
          or public.menor_validade(l.validade, l.validade_apos_abertura) >= current_date
        )
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

create or replace function public.reservar_plano(
  p_planejamento_id bigint,
  p_itens jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  d record;
  l record;
  v_status text;
  v_restante numeric;
  v_take numeric;
  v_disponivel numeric;
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
        and le.status in ('aceito', 'em_uso')
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

      v_take := least(v_restante, v_disponivel);
      if v_take <= 0 then
        continue;
      end if;

      insert into public.reservas_estoque(
        planejamento_id,
        insumo_id,
        lote_id,
        quantidade,
        quantidade_consumida,
        status,
        origem,
        criado_por
      ) values (
        p_planejamento_id,
        d.insumo_id,
        l.id,
        v_take,
        0,
        'reservado',
        'planejamento',
        v_ator
      );

      v_restante := v_restante - v_take;
    end loop;

    if v_restante > 0 then
      insert into public.reservas_estoque(
        planejamento_id,
        insumo_id,
        lote_id,
        quantidade,
        quantidade_consumida,
        status,
        origem,
        criado_por,
        observacao
      ) values (
        p_planejamento_id,
        d.insumo_id,
        null,
        v_restante,
        0,
        'parcial',
        'planejamento',
        v_ator,
        'Shortfall sem saldo fisico reservado'
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

create or replace function public.reservar_equipamento_planejamento(
  p_equipamento_unidade_id bigint,
  p_planejamento_id bigint,
  p_data_inicio timestamptz,
  p_data_fim timestamptz,
  p_responsavel text default null,
  p_observacao text default null
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plano record;
  v_unidade record;
  v_reserva_id bigint;
  v_claims jsonb;
  v_ator text;
begin
  perform fn_exige_papel('tecnico');

  if p_data_inicio is null or p_data_fim is null or p_data_fim <= p_data_inicio then
    raise exception 'Periodo de reserva invalido.' using errcode = '22023';
  end if;

  select id, projeto_id, status_operacional, data_inicio_prevista, data_fim_prevista
    into v_plano
  from public.planejamento
  where id = p_planejamento_id
  for update;

  if not found then
    raise exception 'Planejamento nao encontrado.' using errcode = 'P0002';
  end if;
  if v_plano.status_operacional not in ('rascunho', 'reservado') then
    raise exception 'Status do planejamento nao permite reservar equipamento.' using errcode = '22023';
  end if;
  if v_plano.data_inicio_prevista is null or v_plano.data_fim_prevista is null then
    raise exception 'Defina o periodo previsto do planejamento antes de reservar equipamento.' using errcode = '22023';
  end if;
  if p_data_inicio::date > v_plano.data_inicio_prevista
     or p_data_fim::date < v_plano.data_fim_prevista then
    raise exception 'A reserva deve cobrir todo o periodo previsto do planejamento.' using errcode = '22023';
  end if;

  select id, equipamento_id, ativo, status_operacional
    into v_unidade
  from public.equipamento_unidades
  where id = p_equipamento_unidade_id
  for update;

  if not found then
    raise exception 'Equipamento nao encontrado.' using errcode = 'P0002';
  end if;
  if not v_unidade.ativo or v_unidade.status_operacional not in ('operacional', 'reservado') then
    raise exception 'Equipamento indisponivel para reserva.' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.planejamento_itens pi
    join public.equipamento_analise ea on ea.codigo_analise = pi.codigo_analise
    where pi.planejamento_id = p_planejamento_id
      and ea.equipamento_id = v_unidade.equipamento_id
  ) then
    raise exception 'Equipamento nao esta vinculado as analises do planejamento.' using errcode = '22023';
  end if;
  if exists (
    select 1
    from public.equipamento_reservas er
    where er.equipamento_unidade_id = p_equipamento_unidade_id
      and er.status in ('reservado', 'em_uso')
      and tstzrange(er.data_inicio, er.data_fim, '[)')
          && tstzrange(p_data_inicio, p_data_fim, '[)')
  ) then
    raise exception 'Equipamento ja possui reserva no periodo.' using errcode = '22023';
  end if;

  v_claims := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  v_ator := coalesce(nullif(v_claims->>'email', ''), nullif(v_claims->>'sub', ''));

  insert into public.equipamento_reservas(
    equipamento_unidade_id,
    planejamento_id,
    projeto_id,
    data_inicio,
    data_fim,
    status,
    responsavel,
    observacao,
    criado_por
  ) values (
    p_equipamento_unidade_id,
    p_planejamento_id,
    v_plano.projeto_id,
    p_data_inicio,
    p_data_fim,
    'reservado',
    coalesce(nullif(btrim(p_responsavel), ''), v_ator),
    nullif(btrim(p_observacao), ''),
    v_ator
  )
  returning id into v_reserva_id;

  update public.equipamento_unidades
     set status_operacional = 'reservado'
   where id = p_equipamento_unidade_id
     and status_operacional = 'operacional';

  return v_reserva_id;
end $$;

create or replace function public.dar_baixa_plano(
  p_planejamento_id bigint
) returns jsonb
language plpgsql
security definer
set search_path = public
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

    v_validade_apos_abertura := case
      when l.validade_apos_abertura is not null then l.validade_apos_abertura
      when l.validade_apos_abertura_dias is not null and l.validade_apos_abertura_dias > 0
        then current_date + l.validade_apos_abertura_dias
      else null
    end;

    update public.lotes_estoque
       set quantidade_atual = quantidade_atual - (
             r.quantidade - coalesce(r.quantidade_consumida, 0)
           ),
           status = case
             when quantidade_atual - (
               r.quantidade - coalesce(r.quantidade_consumida, 0)
             ) <= 0 then 'consumido'
             else 'em_uso'
           end,
           data_abertura = coalesce(data_abertura, current_date),
           validade_apos_abertura = coalesce(validade_apos_abertura, v_validade_apos_abertura)
     where id = r.lote_id;

    -- O trigger fn_validar_equipamentos_na_baixa_plano revalida cada saida.
    insert into public.estoque_movimentacoes(
      insumo_id, tipo, quantidade, custo_unitario, motivo, referencia, lote_id
    ) values (
      r.insumo_id,
      'saida',
      r.quantidade - coalesce(r.quantidade_consumida, 0),
      l.custo_unitario,
      'baixa analise lote reservado',
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

create or replace function public.marcar_planejamento_em_execucao(
  p_planejamento_id bigint
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform fn_exige_papel('tecnico');
  perform public.dar_baixa_plano(p_planejamento_id);
end $$;

create or replace function public.liberar_plano(
  p_planejamento_id bigint
) returns void
language plpgsql
security definer
set search_path = public
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

  perform set_config('app.planejamento_transicao', 'permitida', true);
  update public.planejamento
     set status_operacional = 'cancelado'
   where id = p_planejamento_id;
end $$;

create or replace function public.cancelar_planejamento_operacional(
  p_planejamento_id bigint
) returns void
language plpgsql
security definer
set search_path = public
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
  if v_status = 'concluido' then
    raise exception 'Planejamento concluido nao pode ser cancelado.' using errcode = '22023';
  end if;

  update public.reservas_estoque
     set status = 'cancelado',
         liberado_em = coalesce(liberado_em, now())
   where planejamento_id = p_planejamento_id
     and status in ('reservado', 'parcial');

  update public.equipamento_reservas
     set status = 'cancelado',
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

  perform set_config('app.planejamento_transicao', 'permitida', true);
  update public.planejamento
     set status_operacional = 'cancelado'
   where id = p_planejamento_id;
end $$;

create or replace function public.concluir_planejamento(
  p_planejamento_id bigint
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  perform fn_exige_papel('tecnico');

  select status_operacional
    into v_status
  from public.planejamento
  where id = p_planejamento_id
  for update;

  if not found then
    raise exception 'Planejamento nao encontrado.' using errcode = 'P0002';
  end if;
  if v_status <> 'em_execucao' then
    raise exception 'Apenas planejamentos em execucao podem ser concluidos.' using errcode = '22023';
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

  perform set_config('app.planejamento_transicao', 'permitida', true);
  update public.planejamento
     set status_operacional = 'concluido',
         concluido_em = coalesce(concluido_em, now())
   where id = p_planejamento_id;
end $$;

revoke execute on function public.reservar_plano(bigint, jsonb) from public, anon;
revoke execute on function public.reservar_equipamento_planejamento(
  bigint, bigint, timestamptz, timestamptz, text, text
) from public, anon;
revoke execute on function public.dar_baixa_plano(bigint) from public, anon;
revoke execute on function public.marcar_planejamento_em_execucao(bigint) from public, anon;
revoke execute on function public.liberar_plano(bigint) from public, anon;
revoke execute on function public.cancelar_planejamento_operacional(bigint) from public, anon;
revoke execute on function public.concluir_planejamento(bigint) from public, anon;

grant execute on function public.reservar_plano(bigint, jsonb) to authenticated, service_role;
grant execute on function public.reservar_equipamento_planejamento(
  bigint, bigint, timestamptz, timestamptz, text, text
) to authenticated, service_role;
grant execute on function public.dar_baixa_plano(bigint) to authenticated, service_role;
grant execute on function public.marcar_planejamento_em_execucao(bigint) to authenticated, service_role;
grant execute on function public.liberar_plano(bigint) to authenticated, service_role;
grant execute on function public.cancelar_planejamento_operacional(bigint) to authenticated, service_role;
grant execute on function public.concluir_planejamento(bigint) to authenticated, service_role;
