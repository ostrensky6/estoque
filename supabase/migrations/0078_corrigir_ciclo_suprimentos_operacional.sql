-- Corrige o ciclo operacional Estoque/Suprimentos:
-- reserva parcial sem saldo negativo, falta real, baixa FEFO e auditoria.

drop view if exists v_previsao_suprimentos;
drop view if exists v_alertas_estoque;
drop view if exists v_estoque_saldo_tipo;
drop view if exists v_estoque_saldo;

create view v_estoque_saldo as
with reservas as (
  select insumo_id, coalesce(sum(quantidade), 0) as reservado
  from reservas_estoque
  where status = 'reservado'
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
    coalesce(sum(l.quantidade_atual) filter (where l.status in ('aceito','em_uso')), 0) as em_maos,
    coalesce(sum(l.quantidade_atual) filter (where l.status = 'quarentena'), 0) as em_quarentena,
    coalesce(sum(l.quantidade_atual) filter (where l.status = 'bloqueado'), 0) as bloqueado,
    coalesce(sum(l.quantidade_atual) filter (where l.status in ('aceito','em_uso')
      and menor_validade(l.validade, l.validade_apos_abertura) < current_date), 0) as vencido,
    coalesce(r.reservado, 0) as reservado,
    coalesce(sum(l.quantidade_atual) filter (where l.status in ('aceito','em_uso')
      and (menor_validade(l.validade, l.validade_apos_abertura) is null
        or menor_validade(l.validade, l.validade_apos_abertura) >= current_date)), 0) as disponivel_bruto,
    i.ponto_reposicao,
    i.estoque_seguranca,
    i.lead_time_dias,
    i.categoria_compra
  from insumos i
  left join tipo_insumos ti on ti.id = i.tipo_insumo_id
  left join lotes_estoque l on l.insumo_id = i.id
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

create view v_estoque_saldo_tipo as
select
  tipo_insumo_id,
  coalesce(tipo_insumo, nome_item, 'Sem tipo tecnico') as tipo_insumo,
  classe_tipo_insumo,
  unidade,
  count(*) as itens_especificos,
  sum(em_maos) as em_maos,
  sum(em_quarentena) as em_quarentena,
  sum(bloqueado) as bloqueado,
  sum(vencido) as vencido,
  sum(reservado) as reservado,
  sum(disponivel) as disponivel,
  sum(ponto_reposicao) as ponto_reposicao_total
from v_estoque_saldo
group by tipo_insumo_id, coalesce(tipo_insumo, nome_item, 'Sem tipo tecnico'), classe_tipo_insumo, unidade;

create view v_alertas_estoque as
select 'reposicao'::text as tipo, s.insumo_id, s.especificacao,
       null::date as validade, s.disponivel as valor, s.ponto_reposicao as referencia
from v_estoque_saldo s
where s.ponto_reposicao > 0 and s.disponivel <= s.ponto_reposicao
union all
select 'quarentena', s.insumo_id, s.especificacao, null, s.em_quarentena, null
from v_estoque_saldo s
where s.em_quarentena > 0
union all
select 'sem_validade', l.insumo_id, i.especificacao, null, l.quantidade_atual, null
from lotes_estoque l
join insumos i on i.id = l.insumo_id
where l.quantidade_atual > 0
  and l.status in ('aceito','em_uso')
  and l.validade is null
  and i.categoria_compra = 'critico'
union all
select case when menor_validade(l.validade, l.validade_apos_abertura) < current_date then 'vencido' else 'vencimento' end,
       l.insumo_id, i.especificacao, menor_validade(l.validade, l.validade_apos_abertura), l.quantidade_atual, null
from lotes_estoque l
join insumos i on i.id = l.insumo_id
where l.quantidade_atual > 0
  and l.status in ('aceito','em_uso')
  and menor_validade(l.validade, l.validade_apos_abertura) is not null
  and menor_validade(l.validade, l.validade_apos_abertura) <= current_date
      + ((select valor from parametros where chave = 'janela_vencimento_dias')::int);

create or replace view v_previsao_suprimentos as
with cfg as (
  select coalesce((select valor::int from parametros where chave = 'janela_consumo_previsao_dias'), 90) as janela
),
consumo as (
  select
    m.insumo_id,
    sum(case when m.tipo = 'saida' then m.quantidade else 0 end) as consumo_janela
  from estoque_movimentacoes m
  cross join cfg
  where m.data >= current_date - cfg.janela
  group by m.insumo_id
),
abertos as (
  select
    pi.insumo_id,
    sum(pi.quantidade) filter (where p.status in ('solicitado','aprovado','enviado','em_transito') and pi.lote_id is null) as qtd_pedida_aberta
  from pedidos_compra_itens pi
  join pedidos_compra p on p.id = pi.pedido_id
  group by pi.insumo_id
)
select
  s.insumo_id,
  s.especificacao,
  s.unidade,
  s.disponivel,
  s.em_maos,
  s.reservado,
  s.ponto_reposicao as ponto_reposicao_configurado,
  s.estoque_seguranca,
  coalesce(s.lead_time_dias, i.lead_time_dias, f.prazo_medio_dias, i.prazo_entrega_max_dias, 0) as lead_time_dias,
  cfg.janela as janela_dias,
  coalesce(c.consumo_janela, 0) as consumo_janela,
  case when cfg.janela > 0 then coalesce(c.consumo_janela, 0) / cfg.janela else 0 end as consumo_medio_diario,
  case
    when coalesce(c.consumo_janela, 0) > 0
      then s.disponivel / (coalesce(c.consumo_janela, 0) / cfg.janela)
    else null
  end as dias_cobertura,
  greatest(
    s.ponto_reposicao,
    (case when cfg.janela > 0 then coalesce(c.consumo_janela, 0) / cfg.janela else 0 end)
      * coalesce(s.lead_time_dias, i.lead_time_dias, f.prazo_medio_dias, i.prazo_entrega_max_dias, 0)
      + s.estoque_seguranca
  ) as ponto_reposicao_sugerido,
  greatest(
    0,
    (case when cfg.janela > 0 then coalesce(c.consumo_janela, 0) / cfg.janela else 0 end)
      * coalesce(s.lead_time_dias, i.lead_time_dias, f.prazo_medio_dias, i.prazo_entrega_max_dias, 0)
      + s.estoque_seguranca
      - s.disponivel
  ) as qtd_sugerida_compra,
  coalesce(a.qtd_pedida_aberta, 0) as qtd_pedida_aberta,
  i.fornecedor_id,
  f.nome as fornecedor_nome,
  i.custo_unitario,
  i.categoria_compra
from v_estoque_saldo s
join insumos i on i.id = s.insumo_id
left join fornecedores f on f.id = i.fornecedor_id
left join consumo c on c.insumo_id = s.insumo_id
left join abertos a on a.insumo_id = s.insumo_id
cross join cfg;

create or replace function reservar_plano(p_planejamento_id bigint, p_itens jsonb)
returns void
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
  from planejamento
  where id = p_planejamento_id
  for update;

  if not found then
    raise exception 'Planejamento nao encontrado.' using errcode = 'P0002';
  end if;
  if v_status not in ('rascunho','reservado') then
    raise exception 'Status do planejamento nao permite reservar insumos.' using errcode = '22023';
  end if;

  delete from reservas_estoque
  where planejamento_id = p_planejamento_id
    and status = 'reservado';

  with demanda as (
    select insumo_id, sum(quantidade) as demanda
    from (
      select
        (x->>'insumo_id')::bigint as insumo_id,
        greatest(0, (x->>'quantidade')::numeric) as quantidade
      from jsonb_array_elements(p_itens) x
      where nullif(x->>'insumo_id', '') is not null
        and nullif(x->>'quantidade', '') is not null
    ) q
    where quantidade > 0
    group by insumo_id
  ),
  saldo as (
    select
      d.insumo_id,
      d.demanda,
      greatest(0, coalesce(s.disponivel, 0)) as disponivel
    from demanda d
    left join v_estoque_saldo s on s.insumo_id = d.insumo_id
  )
  insert into reservas_estoque(planejamento_id, insumo_id, quantidade, status)
  select p_planejamento_id, insumo_id, least(demanda, disponivel), 'reservado'
  from saldo
  where least(demanda, disponivel) > 0;

  update planejamento
     set status_operacional = 'reservado',
         reservado_em = coalesce(reservado_em, now())
   where id = p_planejamento_id;
end $$;

create or replace function dar_baixa_plano(p_planejamento_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  l record;
  v_status text;
  v_rem numeric;
  v_take numeric;
  v_short jsonb := '[]'::jsonb;
  v_validade_apos_abertura date;
  v_analises text;
begin
  perform fn_exige_papel('tecnico');

  select status_operacional
    into v_status
  from planejamento
  where id = p_planejamento_id
  for update;

  if not found then
    raise exception 'Planejamento nao encontrado.' using errcode = 'P0002';
  end if;
  if v_status <> 'reservado' then
    raise exception 'Reserve os insumos antes de iniciar o planejamento.' using errcode = '22023';
  end if;

  select string_agg(distinct codigo_analise, ', ' order by codigo_analise)
    into v_analises
  from planejamento_itens
  where planejamento_id = p_planejamento_id;

  for r in select * from reservas_estoque
           where planejamento_id = p_planejamento_id and status = 'reservado'
           for update loop
    v_rem := r.quantidade;
    for l in
      select le.*, i.validade_apos_abertura_dias
      from lotes_estoque le
      join insumos i on i.id = le.insumo_id
      where le.insumo_id = r.insumo_id
        and le.quantidade_atual > 0
        and le.status in ('aceito','em_uso')
        and (menor_validade(le.validade, le.validade_apos_abertura) is null
             or menor_validade(le.validade, le.validade_apos_abertura) >= current_date)
      order by menor_validade(le.validade, le.validade_apos_abertura) nulls last, le.id
      for update of le
    loop
      exit when v_rem <= 0;
      v_take := least(v_rem, l.quantidade_atual);
      v_validade_apos_abertura :=
        case
          when l.validade_apos_abertura is not null then l.validade_apos_abertura
          when l.validade_apos_abertura_dias is not null and l.validade_apos_abertura_dias > 0
            then current_date + l.validade_apos_abertura_dias
          else null
        end;

      update lotes_estoque
         set quantidade_atual = quantidade_atual - v_take,
             status = case when quantidade_atual - v_take <= 0 then 'consumido' else 'em_uso' end,
             data_abertura = coalesce(data_abertura, current_date),
             validade_apos_abertura = coalesce(validade_apos_abertura, v_validade_apos_abertura)
       where id = l.id;

      insert into estoque_movimentacoes(insumo_id, tipo, quantidade, custo_unitario, motivo, referencia, lote_id)
      values (
        r.insumo_id,
        'saida',
        v_take,
        l.custo_unitario,
        'baixa analise FEFO',
        'plano ' || p_planejamento_id || '; analise ' || coalesce(v_analises, '-'),
        l.id
      );
      v_rem := v_rem - v_take;
    end loop;

    update reservas_estoque set status = 'consumido' where id = r.id;

    if v_rem > 0 then
      v_short := v_short || jsonb_build_object('insumo_id', r.insumo_id, 'falta', v_rem);
    end if;
  end loop;

  update planejamento
     set status_operacional = 'em_execucao',
         iniciado_em = coalesce(iniciado_em, now())
   where id = p_planejamento_id;

  return jsonb_build_object('shortfalls', v_short);
end $$;

create or replace function receber_item_pedido_compra(
  p_pedido_id bigint,
  p_item_id bigint,
  p_quantidade numeric default null,
  p_validade date default null,
  p_codigo text default null,
  p_responsavel text default null
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_quantidade numeric;
  v_lote_id bigint;
  v_pedido_interno_id bigint;
  v_tudo_recebido boolean;
begin
  perform fn_exige_papel('coordenador');

  select
    pi.id,
    pi.pedido_id,
    pi.insumo_id,
    pi.quantidade,
    pi.custo_unitario_estimado,
    pi.lote_id,
    pi.pedido_interno_item_id,
    p.status as pedido_status,
    p.projeto,
    f.nome as fornecedor,
    i.categoria_compra
  into v_item
  from pedidos_compra_itens pi
  join pedidos_compra p on p.id = pi.pedido_id
  join insumos i on i.id = pi.insumo_id
  left join fornecedores f on f.id = p.fornecedor_id
  where pi.id = p_item_id
    and pi.pedido_id = p_pedido_id
  for update of pi, p;

  if not found then
    raise exception 'Item do pedido de compra nao encontrado.' using errcode = 'P0002';
  end if;
  if v_item.lote_id is not null then
    raise exception 'Item ja recebido.' using errcode = '22023';
  end if;
  if v_item.pedido_status not in ('aprovado','enviado','em_transito') then
    raise exception 'Status do pedido nao permite recebimento.' using errcode = '22023';
  end if;

  v_quantidade := coalesce(p_quantidade, v_item.quantidade);
  if v_quantidade is null or v_quantidade <= 0 then
    raise exception 'Quantidade recebida deve ser maior que zero.' using errcode = '22023';
  end if;
  if v_quantidade < v_item.quantidade then
    raise exception 'Recebimento parcial ainda nao e suportado para este fluxo.' using errcode = '22023';
  end if;
  if v_item.categoria_compra = 'critico' and p_validade is null then
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
    status,
    responsavel_recebimento
  )
  values (
    v_item.insumo_id,
    nullif(btrim(p_codigo), ''),
    p_validade,
    v_quantidade,
    v_quantidade,
    v_item.custo_unitario_estimado,
    v_item.fornecedor,
    v_item.projeto,
    'quarentena',
    p_responsavel
  )
  returning id into v_lote_id;

  insert into estoque_movimentacoes(insumo_id, tipo, quantidade, custo_unitario, motivo, referencia, lote_id)
  values (
    v_item.insumo_id,
    'entrada',
    v_quantidade,
    v_item.custo_unitario_estimado,
    'compra/recebimento',
    'pedido_compra ' || p_pedido_id || '; item ' || p_item_id,
    v_lote_id
  );

  update pedidos_compra_itens
     set lote_id = v_lote_id,
         quantidade_recebida = v_quantidade,
         divergencia_recebimento = case
           when v_quantidade <> v_item.quantidade
             then 'Pedido: ' || v_item.quantidade || '; recebido: ' || v_quantidade
           else null
         end
   where id = p_item_id
     and pedido_id = p_pedido_id;

  if v_item.pedido_interno_item_id is not null then
    update pedidos_internos_itens
       set insumo_id = v_item.insumo_id,
           lote_id = v_lote_id,
           quantidade_recebida = v_quantidade,
           divergencia_recebimento = case
             when v_quantidade <> quantidade
               then 'Pedido: ' || quantidade || '; recebido: ' || v_quantidade
             else null
           end,
           recebido_em = now(),
           recebido_por = p_responsavel
     where id = v_item.pedido_interno_item_id
     returning pedido_interno_id into v_pedido_interno_id;

    if v_pedido_interno_id is not null then
      select not exists (
        select 1
        from pedidos_internos_itens
        where pedido_interno_id = v_pedido_interno_id
          and tipo = 'material'
          and recebido_em is null
      ) into v_tudo_recebido;

      update pedidos_internos
         set recebido_em = case when v_tudo_recebido then coalesce(recebido_em, now()) else null end,
             recebido_por = case when v_tudo_recebido then p_responsavel else null end
       where id = v_pedido_interno_id;
    end if;
  end if;

  if not exists (
    select 1
    from pedidos_compra_itens
    where pedido_id = p_pedido_id
      and lote_id is null
  ) then
    update pedidos_compra
       set status = 'recebido'
     where id = p_pedido_id;
  end if;

  return v_lote_id;
end $$;

grant select on v_estoque_saldo, v_estoque_saldo_tipo, v_alertas_estoque, v_previsao_suprimentos to anon, authenticated, service_role;
grant execute on function reservar_plano(bigint,jsonb) to authenticated, service_role;
grant execute on function dar_baixa_plano(bigint) to authenticated, service_role;
grant execute on function receber_item_pedido_compra(bigint,bigint,numeric,date,text,text) to authenticated, service_role;
