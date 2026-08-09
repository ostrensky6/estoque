-- =====================================================================
-- Suprimentos: orquestracao, modalidade de compra, documentos e reserva
-- por lote especifico.
--
-- Migration aditiva/idempotente. Mantem rotas e tabelas existentes, mas
-- acrescenta campos e funcoes para rastreabilidade operacional.
-- =====================================================================

alter table projetos
  add column if not exists coordenador_email text,
  add column if not exists coordenador_nome text;

update projetos
   set coordenador_nome = coalesce(coordenador_nome, coordenador)
 where coordenador_nome is null
   and coordenador is not null;

create index if not exists projetos_coordenador_email_idx
  on projetos (lower(coordenador_email));

alter table pedidos_internos
  add column if not exists tipo_demanda text not null default 'laboratorio',
  add column if not exists coordenador_projeto_email text,
  add column if not exists coordenador_projeto_nome text,
  add column if not exists aprovador_coordenador text,
  add column if not exists aprovado_coordenador_em timestamptz,
  add column if not exists aprovador_coordenador_diferente boolean not null default false,
  add column if not exists modalidade_compra text,
  add column if not exists modalidade_definida_em timestamptz,
  add column if not exists modalidade_definida_por text,
  add column if not exists instituicao_destino text,
  add column if not exists protocolo_externo text,
  add column if not exists data_envio_instituicao date,
  add column if not exists data_retorno_instituicao date,
  add column if not exists observacao_administrativa text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'pedidos_internos_tipo_demanda_check'
      and conrelid = 'public.pedidos_internos'::regclass
  ) then
    alter table pedidos_internos
      add constraint pedidos_internos_tipo_demanda_check
      check (tipo_demanda in ('laboratorio','campo','laboratorio_campo','administrativo','outro'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'pedidos_internos_modalidade_compra_check'
      and conrelid = 'public.pedidos_internos'::regclass
  ) then
    alter table pedidos_internos
      add constraint pedidos_internos_modalidade_compra_check
      check (modalidade_compra is null or modalidade_compra in ('compra_direta','fundacao','universidade','outra'));
  end if;
end $$;

create index if not exists pedidos_internos_tipo_demanda_idx
  on pedidos_internos (tipo_demanda);
create index if not exists pedidos_internos_modalidade_compra_idx
  on pedidos_internos (modalidade_compra);
create index if not exists pedidos_internos_coordenador_email_idx
  on pedidos_internos (lower(coordenador_projeto_email));

alter table pedidos_internos_anexos
  add column if not exists arquivo_nome text,
  add column if not exists storage_bucket text,
  add column if not exists storage_path text,
  add column if not exists mime_type text,
  add column if not exists tamanho_bytes bigint,
  add column if not exists hash_sha256 text;

create index if not exists pedidos_internos_anexos_storage_idx
  on pedidos_internos_anexos (storage_bucket, storage_path)
  where storage_path is not null;

alter table reservas_estoque
  add column if not exists lote_id bigint references lotes_estoque(id) on delete set null,
  add column if not exists quantidade_consumida numeric not null default 0,
  add column if not exists origem text not null default 'planejamento',
  add column if not exists criado_por text,
  add column if not exists consumido_em timestamptz,
  add column if not exists liberado_em timestamptz,
  add column if not exists observacao text;

alter table reservas_estoque
  drop constraint if exists reservas_estoque_status_check;

alter table reservas_estoque
  add constraint reservas_estoque_status_check
  check (status in ('reservado','consumido','liberado','cancelado','parcial'));

create index if not exists reservas_estoque_lote_idx
  on reservas_estoque (lote_id);
create index if not exists reservas_estoque_planejamento_lote_status_idx
  on reservas_estoque (planejamento_id, lote_id, status);

create table if not exists equipamento_reservas (
  id bigint generated always as identity primary key,
  equipamento_unidade_id bigint not null references equipamento_unidades(id) on delete cascade,
  planejamento_id bigint references planejamento(id) on delete cascade,
  projeto_id bigint references projetos(id) on delete set null,
  data_inicio timestamptz not null,
  data_fim timestamptz not null,
  status text not null default 'reservado'
    check (status in ('reservado','em_uso','liberado','cancelado')),
  responsavel text,
  local_id bigint references locais(id) on delete set null,
  observacao text,
  criado_por text,
  criado_em timestamptz not null default now(),
  liberado_em timestamptz,
  constraint equipamento_reservas_periodo_check check (data_fim > data_inicio)
);

create index if not exists equipamento_reservas_unidade_periodo_idx
  on equipamento_reservas (equipamento_unidade_id, data_inicio, data_fim)
  where status in ('reservado','em_uso');
create index if not exists equipamento_reservas_planejamento_idx
  on equipamento_reservas (planejamento_id, status);
create index if not exists equipamento_reservas_projeto_idx
  on equipamento_reservas (projeto_id, status);

alter table equipamento_reservas enable row level security;
drop policy if exists authenticated_all_equipamento_reservas on equipamento_reservas;
create policy authenticated_all_equipamento_reservas on equipamento_reservas
  for all to authenticated using (true) with check (true);

grant all on equipamento_reservas to authenticated, service_role;
grant usage, select on sequence equipamento_reservas_id_seq to authenticated, service_role;

drop trigger if exists aud_equipamento_reservas on equipamento_reservas;
create trigger aud_equipamento_reservas
  after insert or update or delete on equipamento_reservas
  for each row execute function fn_auditoria();

create or replace function registrar_modalidade_pedido_interno(
  p_pedido_id bigint,
  p_modalidade text,
  p_instituicao_destino text default null,
  p_protocolo_externo text default null,
  p_observacao text default null,
  p_responsavel text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  perform fn_exige_papel('coordenador');

  if p_modalidade not in ('compra_direta','fundacao','universidade','outra') then
    raise exception 'Modalidade de compra invalida.' using errcode = '22023';
  end if;
  if p_modalidade in ('fundacao','universidade','outra')
     and nullif(btrim(coalesce(p_instituicao_destino, '')), '') is null then
    raise exception 'Informe a instituicao de destino.' using errcode = '22023';
  end if;

  select status
    into v_status
  from pedidos_internos
  where id = p_pedido_id
  for update;

  if not found then
    raise exception 'Pedido interno nao encontrado.' using errcode = 'P0002';
  end if;
  if v_status not in ('aprovado_para_compra','compra_fechada','encaminhado_instituicao','aguardando_pagamento_nf') then
    raise exception 'Status do pedido interno nao permite definir modalidade.' using errcode = '22023';
  end if;

  update pedidos_internos
     set modalidade_compra = p_modalidade,
         modalidade_definida_em = now(),
         modalidade_definida_por = p_responsavel,
         instituicao_destino = nullif(btrim(coalesce(p_instituicao_destino, '')), ''),
         protocolo_externo = nullif(btrim(coalesce(p_protocolo_externo, '')), ''),
         observacao_administrativa = coalesce(nullif(btrim(coalesce(p_observacao, '')), ''), observacao_administrativa),
         data_envio_instituicao = case
           when p_modalidade in ('fundacao','universidade','outra') then coalesce(data_envio_instituicao, current_date)
           else data_envio_instituicao
         end
   where id = p_pedido_id;
end $$;

-- A versão anterior retornava void. PostgreSQL não permite alterar o
-- retorno com CREATE OR REPLACE, então a assinatura é recriada em seguida.
drop function if exists reservar_plano(bigint, jsonb);

create function reservar_plano(p_planejamento_id bigint, p_itens jsonb)
returns jsonb
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
  v_short jsonb := '[]'::jsonb;
  v_responsavel text := current_setting('request.jwt.claims', true)::jsonb->>'email';
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

  update reservas_estoque
     set status = 'liberado',
         liberado_em = coalesce(liberado_em, now()),
         observacao = coalesce(observacao, 'Substituida por nova reserva do plano')
   where planejamento_id = p_planejamento_id
     and status = 'reservado';

  for d in
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
  loop
    v_restante := d.demanda;

    for l in
      select
        le.id,
        le.insumo_id,
        le.quantidade_atual,
        greatest(
          0,
          le.quantidade_atual - coalesce((
            select sum(r.quantidade - coalesce(r.quantidade_consumida, 0))
            from reservas_estoque r
            where r.lote_id = le.id
              and r.status in ('reservado','parcial')
          ), 0)
        ) as disponivel_lote
      from lotes_estoque le
      where le.insumo_id = d.insumo_id
        and le.quantidade_atual > 0
        and le.status in ('aceito','em_uso')
        and (menor_validade(le.validade, le.validade_apos_abertura) is null
             or menor_validade(le.validade, le.validade_apos_abertura) >= current_date)
      order by menor_validade(le.validade, le.validade_apos_abertura) nulls last, le.id
      for update of le
    loop
      exit when v_restante <= 0;
      v_take := least(v_restante, l.disponivel_lote);
      if v_take <= 0 then
        continue;
      end if;

      insert into reservas_estoque(
        planejamento_id,
        insumo_id,
        lote_id,
        quantidade,
        quantidade_consumida,
        status,
        origem,
        criado_por
      )
      values (
        p_planejamento_id,
        d.insumo_id,
        l.id,
        v_take,
        0,
        'reservado',
        'planejamento',
        v_responsavel
      );

      v_restante := v_restante - v_take;
    end loop;

    if v_restante > 0 then
      v_short := v_short || jsonb_build_object('insumo_id', d.insumo_id, 'falta', v_restante);
    end if;
  end loop;

  update planejamento
     set status_operacional = 'reservado',
         reservado_em = coalesce(reservado_em, now())
   where id = p_planejamento_id;

  return jsonb_build_object('shortfalls', v_short);
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
    raise exception 'Planejamento nao encontrado.' using errcode = 'P0002';
  end if;
  if v_status <> 'reservado' then
    raise exception 'Reserve os insumos antes de iniciar o planejamento.' using errcode = '22023';
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
    for update
  loop
    if r.lote_id is null then
      v_short := v_short || jsonb_build_object('insumo_id', r.insumo_id, 'falta', r.quantidade);
      update reservas_estoque
         set status = 'cancelado',
             observacao = coalesce(observacao, 'Reserva sem lote especifico nao consumida')
       where id = r.id;
      continue;
    end if;

    select le.*, i.validade_apos_abertura_dias
      into l
    from lotes_estoque le
    join insumos i on i.id = le.insumo_id
    where le.id = r.lote_id
    for update of le;

    if not found
       or l.status not in ('aceito','em_uso')
       or l.quantidade_atual < (r.quantidade - coalesce(r.quantidade_consumida, 0))
       or (menor_validade(l.validade, l.validade_apos_abertura) is not null
           and menor_validade(l.validade, l.validade_apos_abertura) < current_date) then
      v_short := v_short || jsonb_build_object(
        'insumo_id', r.insumo_id,
        'lote_id', r.lote_id,
        'falta', greatest(0, r.quantidade - coalesce(r.quantidade_consumida, 0))
      );
      update reservas_estoque
         set status = 'parcial',
             observacao = coalesce(observacao, 'Lote reservado indisponivel na baixa')
       where id = r.id;
      continue;
    end if;

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

    insert into estoque_movimentacoes(insumo_id, tipo, quantidade, custo_unitario, motivo, referencia, lote_id)
    values (
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
           observacao = coalesce(observacao, 'Consumida por inicio do planejamento')
     where id = r.id;
  end loop;

  update planejamento
     set status_operacional = 'em_execucao',
         iniciado_em = coalesce(iniciado_em, now()),
         responsavel = coalesce(responsavel, v_responsavel)
   where id = p_planejamento_id;

  return jsonb_build_object('shortfalls', v_short);
end $$;

create or replace function liberar_plano(p_planejamento_id bigint)
returns void
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
  from planejamento
  where id = p_planejamento_id
  for update;

  if not found then
    raise exception 'Planejamento nao encontrado.' using errcode = 'P0002';
  end if;
  if v_status not in ('reservado','cancelado') then
    raise exception 'Apenas planejamentos reservados podem liberar reservas.' using errcode = '22023';
  end if;

  update reservas_estoque
     set status = 'liberado',
         liberado_em = coalesce(liberado_em, now())
   where planejamento_id = p_planejamento_id
     and status in ('reservado','parcial');

  update planejamento
     set status_operacional = 'cancelado'
   where id = p_planejamento_id;
end $$;

create or replace function reservar_equipamento_planejamento(
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
  v_unidade record;
  v_plano record;
  v_reserva_id bigint;
  v_email text := current_setting('request.jwt.claims', true)::jsonb->>'email';
begin
  perform fn_exige_papel('tecnico');

  if p_data_inicio is null or p_data_fim is null or p_data_fim <= p_data_inicio then
    raise exception 'Periodo de reserva invalido.' using errcode = '22023';
  end if;

  select id, status_operacional, ativo
    into v_unidade
  from equipamento_unidades
  where id = p_equipamento_unidade_id
  for update;

  if not found then
    raise exception 'Equipamento nao encontrado.' using errcode = 'P0002';
  end if;
  if not v_unidade.ativo or v_unidade.status_operacional in ('em_manutencao','calibracao_vencida','inativo','descartado') then
    raise exception 'Equipamento indisponivel para reserva.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from equipamento_reservas er
    where er.equipamento_unidade_id = p_equipamento_unidade_id
      and er.status in ('reservado','em_uso')
      and tstzrange(er.data_inicio, er.data_fim, '[)') && tstzrange(p_data_inicio, p_data_fim, '[)')
  ) then
    raise exception 'Equipamento ja possui reserva no periodo.' using errcode = '22023';
  end if;

  select id, projeto_id
    into v_plano
  from planejamento
  where id = p_planejamento_id;

  insert into equipamento_reservas(
    equipamento_unidade_id,
    planejamento_id,
    projeto_id,
    data_inicio,
    data_fim,
    responsavel,
    observacao,
    criado_por
  )
  values (
    p_equipamento_unidade_id,
    p_planejamento_id,
    v_plano.projeto_id,
    p_data_inicio,
    p_data_fim,
    nullif(btrim(coalesce(p_responsavel, v_email)), ''),
    nullif(btrim(coalesce(p_observacao, '')), ''),
    v_email
  )
  returning id into v_reserva_id;

  update equipamento_unidades
     set status_operacional = case when status_operacional = 'operacional' then 'reservado' else status_operacional end
   where id = p_equipamento_unidade_id;

  return v_reserva_id;
end $$;

grant execute on function registrar_modalidade_pedido_interno(bigint,text,text,text,text,text)
  to authenticated, service_role;
grant execute on function reservar_plano(bigint,jsonb) to authenticated, service_role;
grant execute on function dar_baixa_plano(bigint) to authenticated, service_role;
grant execute on function liberar_plano(bigint) to authenticated, service_role;
grant execute on function reservar_equipamento_planejamento(bigint,bigint,timestamptz,timestamptz,text,text)
  to authenticated, service_role;

