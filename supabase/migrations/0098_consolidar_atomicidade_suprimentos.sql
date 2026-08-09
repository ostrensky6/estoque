-- =====================================================================
-- Consolidação operacional de suprimentos.
--
-- Corrige ambientes que já tenham aplicado as migrations anteriores:
-- - fecha leitura anônima das views operacionais;
-- - considera apenas o saldo pendente de compras formais;
-- - inclui pedidos automáticos internos no abastecimento em aberto;
-- - cria pedidos de reposição de forma atômica e idempotente por insumo;
-- - torna a baixa do planejamento integral (tudo ou nada).
-- =====================================================================

alter table public.pedidos_internos
  add column if not exists origem text not null default 'manual';

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.pedidos_internos'::regclass
       and conname = 'pedidos_internos_origem_check'
  ) then
    alter table public.pedidos_internos
      add constraint pedidos_internos_origem_check
      check (origem in ('manual', 'reposicao_estoque')) not valid;
  end if;
end $$;

create index if not exists pedidos_internos_origem_status_idx
  on public.pedidos_internos(origem, status);

create or replace view public.v_previsao_suprimentos
with (security_invoker = true)
as
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
compras_abertas as (
  select
    pi.insumo_id,
    sum(greatest(
      pi.quantidade
        - coalesce(pi.quantidade_recebida, case when pi.lote_id is not null then pi.quantidade else 0 end),
      0
    )) filter (
      where p.status in ('solicitado','aprovado','enviado','em_transito')
    ) as quantidade
  from pedidos_compra_itens pi
  join pedidos_compra p on p.id = pi.pedido_id
  group by pi.insumo_id
),
reposicoes_internas_abertas as (
  select
    pii.insumo_id,
    sum(greatest(pii.quantidade - coalesce(pii.quantidade_recebida, 0), 0)) as quantidade
  from pedidos_internos_itens pii
  join pedidos_internos p on p.id = pii.pedido_interno_id
  where p.origem = 'reposicao_estoque'
    and p.status in ('rascunho','em_validacao','ajuste_solicitante','validado')
    and pii.insumo_id is not null
  group by pii.insumo_id
),
abertos as (
  select
    insumo_id,
    sum(quantidade) as qtd_pedida_aberta
  from (
    select insumo_id, quantidade from compras_abertas
    union all
    select insumo_id, quantidade from reposicoes_internas_abertas
  ) fontes
  group by insumo_id
),
base as (
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
  cross join cfg
)
select
  insumo_id,
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
  case
    when consumo_janela > 0 then disponivel / consumo_medio_diario
    else null
  end as dias_cobertura,
  greatest(
    ponto_reposicao_configurado,
    consumo_medio_diario * lead_time_dias + estoque_seguranca
  ) as ponto_reposicao_sugerido,
  greatest(
    0,
    consumo_medio_diario * lead_time_dias
      + estoque_seguranca
      - disponivel
      - qtd_pedida_aberta
  ) as qtd_sugerida_compra,
  qtd_pedida_aberta,
  fornecedor_id,
  fornecedor_nome,
  custo_unitario,
  categoria_compra
from base;

alter view public.v_planejamento_compromissos_estoque set (security_invoker = true);
revoke all on public.v_planejamento_compromissos_estoque from public, anon;
revoke all on public.v_previsao_suprimentos from public, anon;
grant select on public.v_planejamento_compromissos_estoque to authenticated, service_role;
grant select on public.v_previsao_suprimentos to authenticated, service_role;

revoke execute on function public.validar_planejamento_executivo(bigint) from public, anon;
revoke execute on function public.aceitar_lote(bigint, text, text) from public, anon;

create or replace function public.criar_pedido_reposicao_estoque(
  p_titulo text,
  p_justificativa text,
  p_urgencia text,
  p_data_necessidade date,
  p_itens jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := current_setting('request.jwt.claims', true)::jsonb->>'email';
  v_insumo_id bigint;
  v_pedido_id bigint;
  v_quantidade_itens integer;
begin
  perform fn_exige_papel('tecnico');

  if nullif(btrim(coalesce(p_titulo, '')), '') is null
     or nullif(btrim(coalesce(p_justificativa, '')), '') is null then
    raise exception 'Título e justificativa são obrigatórios para a reposição.'
      using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_itens, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_itens, '[]'::jsonb)) = 0 then
    raise exception 'Informe ao menos um insumo para reposição.'
      using errcode = '22023';
  end if;

  -- Serializa pedidos concorrentes dos mesmos insumos. A view é consultada
  -- novamente depois dos locks, impedindo dois rascunhos para a mesma falta.
  for v_insumo_id in
    select distinct (item->>'insumo_id')::bigint
      from jsonb_array_elements(p_itens) item
     where nullif(item->>'insumo_id', '') is not null
     order by 1
  loop
    perform pg_advisory_xact_lock(8100000000000000 + v_insumo_id);
  end loop;

  insert into pedidos_internos(
    titulo,
    status,
    solicitante,
    tipo_demanda,
    origem,
    urgencia,
    data_necessidade,
    fonte_recurso,
    justificativa
  ) values (
    btrim(p_titulo),
    'rascunho',
    v_email,
    'laboratorio',
    'reposicao_estoque',
    case when p_urgencia = 'alta' then 'alta' else 'normal' end,
    p_data_necessidade,
    'A definir pelo projeto',
    btrim(p_justificativa)
  )
  returning id into v_pedido_id;

  insert into pedidos_internos_itens(
    pedido_interno_id,
    tipo,
    insumo_id,
    especificacao,
    quantidade,
    unidade,
    orcamento_previo,
    fornecedor_sugerido,
    observacao
  )
  select
    v_pedido_id,
    'material',
    previsao.insumo_id,
    coalesce(previsao.especificacao, 'Insumo #' || previsao.insumo_id),
    least((item->>'quantidade')::numeric, previsao.qtd_sugerida_compra),
    previsao.unidade,
    previsao.custo_unitario,
    previsao.fornecedor_nome,
    'Reposição sugerida pelo Controle de Estoque. Disponível: '
      || coalesce(previsao.disponivel, 0) || ' ' || coalesce(previsao.unidade, '')
      || '; ponto sugerido: ' || coalesce(previsao.ponto_reposicao_sugerido, 0)
      || ' ' || coalesce(previsao.unidade, '') || '.'
  from jsonb_array_elements(p_itens) item
  join public.v_previsao_suprimentos previsao
    on previsao.insumo_id = (item->>'insumo_id')::bigint
  where (item->>'quantidade')::numeric > 0
    and previsao.qtd_sugerida_compra > 0;
  get diagnostics v_quantidade_itens = row_count;

  if v_quantidade_itens = 0 then
    raise exception 'A necessidade já foi coberta por estoque ou pedido em aberto.'
      using errcode = '22023';
  end if;

  insert into eventos_status(entidade, entidade_id, de_status, para_status, usuario, observacao)
  values (
    'pedido_interno',
    v_pedido_id,
    null,
    'rascunho',
    v_email,
    'Pedido de reposição gerado pelo Controle de Estoque.'
  );

  return jsonb_build_object('pedido_id', v_pedido_id, 'itens', v_quantidade_itens);
end $$;

revoke execute on function public.criar_pedido_reposicao_estoque(text, text, text, date, jsonb)
  from public, anon;
grant execute on function public.criar_pedido_reposicao_estoque(text, text, text, date, jsonb)
  to authenticated, service_role;

create or replace function public.preencher_reservado_por_planejamento()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status_operacional = 'reservado'
     and new.status_operacional is distinct from old.status_operacional then
    new.reservado_por := coalesce(
      new.reservado_por,
      current_setting('request.jwt.claims', true)::jsonb->>'email'
    );
  end if;
  return new;
end $$;

drop trigger if exists trg_a_preencher_reservado_por_planejamento on public.planejamento;
create trigger trg_a_preencher_reservado_por_planejamento
  before update of status_operacional on public.planejamento
  for each row execute function public.preencher_reservado_por_planejamento();

revoke execute on function public.preencher_reservado_por_planejamento() from public, anon;

create or replace function public.dar_baixa_plano(p_planejamento_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  l record;
  v_status text;
  v_short jsonb := '[]'::jsonb;
  v_validade_apos_abertura date;
  v_analises text;
  v_responsavel text := current_setting('request.jwt.claims', true)::jsonb->>'email';
begin
  perform fn_exige_papel('tecnico');

  select status_operacional
    into v_status
  from planejamento
  where id = p_planejamento_id
  for update;

  if not found then
    raise exception 'Planejamento não encontrado.' using errcode = 'P0002';
  end if;
  if v_status <> 'reservado' then
    raise exception 'Reserve os insumos antes de iniciar o planejamento.' using errcode = '22023';
  end if;
  if not exists (
    select 1
      from reservas_estoque
     where planejamento_id = p_planejamento_id
       and status in ('reservado','parcial')
  ) then
    raise exception 'O planejamento não possui reservas ativas para a baixa.'
      using errcode = '22023';
  end if;

  -- Bloqueia as reservas e valida a necessidade agregada por lote antes de
  -- qualquer movimento. Se houver uma única falta, nada será consumido.
  perform id
    from reservas_estoque
   where planejamento_id = p_planejamento_id
     and status in ('reservado','parcial')
   order by id
   for update;

  for r in
    select
      lote_id,
      min(insumo_id) as insumo_id,
      sum(quantidade - coalesce(quantidade_consumida, 0)) as quantidade_pendente
    from reservas_estoque
    where planejamento_id = p_planejamento_id
      and status in ('reservado','parcial')
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
    from lotes_estoque le
    where le.id = r.lote_id
    for update;

    if not found
       or l.status not in ('aceito','em_uso')
       or l.quantidade_atual < r.quantidade_pendente
       or (menor_validade(l.validade, l.validade_apos_abertura) is not null
           and menor_validade(l.validade, l.validade_apos_abertura) < current_date) then
      v_short := v_short || jsonb_build_object(
        'insumo_id', r.insumo_id,
        'lote_id', r.lote_id,
        'falta', case
          when l.id is null or l.status not in ('aceito','em_uso') then r.quantidade_pendente
          else greatest(0, r.quantidade_pendente - l.quantidade_atual)
        end
      );
    end if;
  end loop;

  if jsonb_array_length(v_short) > 0 then
    raise exception 'Não é possível iniciar: existem reservas sem estoque válido suficiente.'
      using errcode = '22023', detail = v_short::text;
  end if;

  select string_agg(distinct codigo_analise, ', ' order by codigo_analise)
    into v_analises
  from planejamento_itens
  where planejamento_id = p_planejamento_id;

  for r in
    select *
    from reservas_estoque
    where planejamento_id = p_planejamento_id
      and status in ('reservado','parcial')
    order by insumo_id, id
  loop
    select le.*, i.validade_apos_abertura_dias
      into l
    from lotes_estoque le
    join insumos i on i.id = le.insumo_id
    where le.id = r.lote_id;

    v_validade_apos_abertura :=
      case
        when l.validade_apos_abertura is not null then l.validade_apos_abertura
        when l.validade_apos_abertura_dias is not null and l.validade_apos_abertura_dias > 0
          then current_date + l.validade_apos_abertura_dias
        else null
      end;

    update lotes_estoque
       set quantidade_atual = quantidade_atual - (r.quantidade - coalesce(r.quantidade_consumida, 0)),
           status = case
             when quantidade_atual - (r.quantidade - coalesce(r.quantidade_consumida, 0)) <= 0 then 'consumido'
             else 'em_uso'
           end,
           data_abertura = coalesce(data_abertura, current_date),
           validade_apos_abertura = coalesce(validade_apos_abertura, v_validade_apos_abertura)
     where id = r.lote_id;

    insert into estoque_movimentacoes(
      insumo_id, tipo, quantidade, custo_unitario, motivo, referencia, lote_id
    ) values (
      r.insumo_id,
      'saida',
      r.quantidade - coalesce(r.quantidade_consumida, 0),
      l.custo_unitario,
      'baixa analise lote reservado',
      'plano ' || p_planejamento_id || '; analise ' || coalesce(v_analises, '-') || '; reserva ' || r.id,
      r.lote_id
    );

    update reservas_estoque
       set quantidade_consumida = quantidade,
           status = 'consumido',
           consumido_em = now(),
           observacao = coalesce(observacao, 'Consumida por início do planejamento')
     where id = r.id;
  end loop;

  update planejamento
     set status_operacional = 'em_execucao',
         iniciado_em = coalesce(iniciado_em, now()),
         responsavel = coalesce(responsavel, v_responsavel)
   where id = p_planejamento_id;

  return jsonb_build_object('shortfalls', '[]'::jsonb);
end $$;

revoke execute on function public.dar_baixa_plano(bigint) from public, anon;
grant execute on function public.dar_baixa_plano(bigint) to authenticated, service_role;

-- As versões históricas usavam digest() sem qualificar o schema enquanto o
-- search_path SECURITY DEFINER continha apenas public. Em instalações Supabase,
-- pgcrypto vive em extensions; a qualificação evita falha em tempo de execução.
create or replace function public.ler_orcamento_publico(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link orcamento_projeto_links;
  v_orc jsonb;
begin
  select *
    into v_link
    from orcamento_projeto_links
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
     and not revogado
     and (expira_em is null or expira_em > now());

  if not found then
    return null;
  end if;

  select to_jsonb(o)
    into v_orc
    from orcamento_projetos o
   where id = v_link.orcamento_projeto_id;

  return jsonb_build_object(
    'orcamento', v_orc,
    'analises', (
      select coalesce(jsonb_agg(to_jsonb(a) order by a.id), '[]'::jsonb)
        from orcamento_projeto_analises a
       where a.orcamento_projeto_id = v_link.orcamento_projeto_id
    ),
    'custos', (
      select coalesce(jsonb_agg(to_jsonb(c) order by c.rubrica, c.id), '[]'::jsonb)
        from orcamento_projeto_custos c
       where c.orcamento_projeto_id = v_link.orcamento_projeto_id
    ),
    'aprovado_em', v_link.aprovado_em,
    'aprovado_por', v_link.aprovado_por
  );
end $$;

create or replace function public.aprovar_orcamento_publico(p_token text, p_nome text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  update orcamento_projeto_links
     set aprovado_em = now(),
         aprovado_por = coalesce(nullif(btrim(p_nome), ''), 'Cliente')
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
     and not revogado
     and (expira_em is null or expira_em > now())
     and aprovado_em is null
  returning orcamento_projeto_id into v_id;

  if v_id is null then
    return false;
  end if;

  update orcamento_projetos
     set status = 'aprovado'
   where id = v_id;
  return true;
end $$;

revoke execute on function public.ler_orcamento_publico(text) from public;
revoke execute on function public.aprovar_orcamento_publico(text, text) from public;
grant execute on function public.ler_orcamento_publico(text) to anon, authenticated;
grant execute on function public.aprovar_orcamento_publico(text, text) to anon, authenticated;
