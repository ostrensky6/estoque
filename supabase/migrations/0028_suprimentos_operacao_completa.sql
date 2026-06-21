-- =====================================================================
-- Suprimentos: ajustes manuais, validade efetiva e alertas operacionais.
--
-- Aditiva/idempotente: preserva histórico, RLS, auditoria e migrations
-- antigas. Centraliza mutações físicas em RPCs transacionais.
-- =====================================================================

create or replace function menor_validade(p_fabricante date, p_abertura date)
returns date
language sql
immutable
as $$
  select case
    when p_fabricante is null then p_abertura
    when p_abertura is null then p_fabricante
    when p_fabricante <= p_abertura then p_fabricante
    else p_abertura
  end;
$$;

grant execute on function menor_validade(date,date) to authenticated, anon, service_role;

-- Baixa manual parcial: consumo extra, perda, quebra, uso fora de plano.
create or replace function baixa_manual_lote(
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
  if v_lote.status not in ('aceito','em_uso') then
    raise exception 'Só é possível baixar lote aceito ou em uso.' using errcode = '22023';
  end if;
  if v_lote.validade is not null and v_lote.validade < current_date then
    raise exception 'Lote vencido não pode ser baixado para uso.' using errcode = '22023';
  end if;
  if p_quantidade > v_lote.quantidade_atual then
    raise exception 'Quantidade maior que o saldo atual do lote.' using errcode = '22023';
  end if;

  v_validade_apos_abertura :=
    case
      when v_lote.validade_apos_abertura is not null then v_lote.validade_apos_abertura
      when v_lote.validade_apos_abertura_dias is not null and v_lote.validade_apos_abertura_dias > 0
        then current_date + v_lote.validade_apos_abertura_dias
      else null
    end;

  update lotes_estoque
     set quantidade_atual = quantidade_atual - p_quantidade,
         status = case when quantidade_atual - p_quantidade <= 0 then 'consumido' else 'em_uso' end,
         data_abertura = coalesce(data_abertura, current_date),
         validade_apos_abertura = coalesce(validade_apos_abertura, v_validade_apos_abertura)
   where id = p_lote_id;

  insert into estoque_movimentacoes(insumo_id, tipo, quantidade, custo_unitario, motivo, referencia, lote_id)
  values (
    v_lote.insumo_id,
    'saida',
    p_quantidade,
    v_lote.custo_unitario,
    'baixa manual: ' || btrim(p_motivo),
    'lote ' || p_lote_id,
    p_lote_id
  );
end $$;

-- Correção de inventário por lote: ajusta para um saldo contado.
create or replace function ajustar_saldo_lote(
  p_lote_id bigint,
  p_quantidade_nova numeric,
  p_motivo text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lote record;
  v_delta numeric;
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

  v_delta := p_quantidade_nova - v_lote.quantidade_atual;
  if v_delta = 0 then
    return;
  end if;

  update lotes_estoque
     set quantidade_atual = p_quantidade_nova,
         status = case
           when p_quantidade_nova = 0 then 'consumido'
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
end $$;

-- Reforça baixa automática: validade após abertura e validade efetiva.
create or replace function dar_baixa_plano(p_planejamento_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  l record;
  v_rem numeric;
  v_take numeric;
  v_short jsonb := '[]'::jsonb;
  v_validade_apos_abertura date;
begin
  perform fn_exige_papel('tecnico');

  for r in select * from reservas_estoque
           where planejamento_id = p_planejamento_id and status = 'reservado' loop
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
      values (r.insumo_id, 'saida', v_take, l.custo_unitario,
              'baixa análise', 'plano ' || p_planejamento_id, l.id);
      v_rem := v_rem - v_take;
    end loop;

    update reservas_estoque set status = 'consumido' where id = r.id;

    if v_rem > 0 then
      v_short := v_short || jsonb_build_object('insumo_id', r.insumo_id, 'falta', v_rem);
    end if;
  end loop;

  return jsonb_build_object('shortfalls', v_short);
end $$;

drop view if exists v_previsao_suprimentos;
drop view if exists v_alertas_estoque;
drop view if exists v_estoque_saldo;

create view v_estoque_saldo as
select
  i.id as insumo_id,
  i.nome_item,
  i.especificacao,
  i.unidade,
  coalesce(sum(l.quantidade_atual) filter (where l.status in ('aceito','em_uso')), 0) as em_maos,
  coalesce(sum(l.quantidade_atual) filter (where l.status = 'quarentena'), 0) as em_quarentena,
  coalesce(sum(l.quantidade_atual) filter (where l.status = 'bloqueado'), 0) as bloqueado,
  coalesce(sum(l.quantidade_atual) filter (
    where l.status in ('aceito','em_uso')
      and menor_validade(l.validade, l.validade_apos_abertura) < current_date
  ), 0) as vencido,
  (select coalesce(sum(r.quantidade), 0) from reservas_estoque r
     where r.insumo_id = i.id and r.status = 'reservado') as reservado,
  coalesce(sum(l.quantidade_atual) filter (
    where l.status in ('aceito','em_uso')
      and (menor_validade(l.validade, l.validade_apos_abertura) is null
           or menor_validade(l.validade, l.validade_apos_abertura) >= current_date)
  ), 0)
    - (select coalesce(sum(r.quantidade), 0) from reservas_estoque r
         where r.insumo_id = i.id and r.status = 'reservado') as disponivel,
  i.ponto_reposicao,
  i.estoque_seguranca,
  i.lead_time_dias,
  i.categoria_compra
from insumos i
left join lotes_estoque l on l.insumo_id = i.id
group by i.id;

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

grant select on v_estoque_saldo to authenticated, anon, service_role;
grant select on v_alertas_estoque to authenticated, anon, service_role;

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

grant select on v_previsao_suprimentos to authenticated, anon, service_role;
grant execute on function baixa_manual_lote(bigint,numeric,text) to authenticated, service_role;
grant execute on function ajustar_saldo_lote(bigint,numeric,text) to authenticated, service_role;
grant execute on function dar_baixa_plano(bigint) to authenticated, service_role;
