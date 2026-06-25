-- Analises solicitadas na demanda, antes da composicao financeira.
-- Estrutura aditiva: preserva demandas e orcamentos existentes.

create table if not exists demanda_analises (
  id bigint generated always as identity primary key,
  demanda_id bigint not null references demandas_propostas(id) on delete cascade,
  codigo_analise text not null references analises(codigo) on update cascade,
  quantidade_amostras integer not null check (quantidade_amostras > 0),
  observacao text,
  status_custeio text not null default 'pendente'
    check (status_custeio in ('disponivel','pendente')),
  origem_quantidade text not null default 'padrao'
    check (origem_quantidade in ('padrao','manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (demanda_id, codigo_analise)
);

alter table orcamento_itens
  add column if not exists valor_snapshot jsonb not null default '{}'::jsonb;

alter table orcamento_projeto_analises
  add column if not exists valor_snapshot jsonb not null default '{}'::jsonb;

alter table orcamento_projeto_custos
  add column if not exists valor_snapshot jsonb not null default '{}'::jsonb;

create index if not exists demanda_analises_demanda_idx
  on demanda_analises (demanda_id);

create index if not exists demanda_analises_codigo_idx
  on demanda_analises (codigo_analise);

alter table demanda_analises enable row level security;

do $$
begin
  if not exists (
    select 1
      from pg_policies
     where schemaname = 'public'
       and tablename = 'demanda_analises'
       and policyname = 'authenticated_all_demanda_analises'
  ) then
    create policy authenticated_all_demanda_analises
      on demanda_analises
      for all to authenticated
      using (true)
      with check (true);
  end if;
end $$;

grant all on demanda_analises to authenticated;
grant all on demanda_analises to service_role;
grant usage, select on sequence demanda_analises_id_seq to authenticated;
grant usage, select on sequence demanda_analises_id_seq to service_role;

create or replace function fn_touch_demanda_analises()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_touch_demanda_analises on demanda_analises;
create trigger trg_touch_demanda_analises
  before update on demanda_analises
  for each row execute function fn_touch_demanda_analises();

drop trigger if exists aud_demanda_analises on demanda_analises;
create trigger aud_demanda_analises
  after insert or update or delete on demanda_analises
  for each row execute function fn_auditoria();

create or replace function sincronizar_demanda_analises(
  p_demanda_id bigint,
  p_itens jsonb,
  p_exige_laboratorio boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_demanda demandas_propostas%rowtype;
  v_orcamento_id bigint;
  v_item jsonb;
  v_codigos text[];
  v_pendentes int := 0;
  v_registradas int := 0;
begin
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' then
    raise exception 'p_itens deve ser um array JSON';
  end if;

  select *
    into v_demanda
    from demandas_propostas
   where id = p_demanda_id
   for update;

  if not found then
    raise exception 'Demanda % nao encontrada', p_demanda_id;
  end if;

  with itens as (
    select
      nullif(btrim(item->>'codigo_analise'), '') as codigo_analise,
      coalesce((item->>'quantidade_amostras')::numeric, 0) as quantidade_amostras
      from jsonb_array_elements(p_itens) item
  )
  select array_agg(codigo_analise)
    into v_codigos
    from itens
   where codigo_analise is not null;

  if exists (
    select 1
      from jsonb_array_elements(p_itens) item
     where nullif(btrim(item->>'codigo_analise'), '') is null
        or coalesce((item->>'quantidade_amostras')::numeric, 0) <= 0
  ) then
    raise exception 'Itens de analise exigem codigo_analise e quantidade_amostras positiva';
  end if;

  if exists (
    select codigo_analise
      from unnest(coalesce(v_codigos, array[]::text[])) codigo_analise
     group by codigo_analise
    having count(*) > 1
  ) then
    raise exception 'A mesma analise nao pode ser sincronizada mais de uma vez';
  end if;

  if exists (
    select 1
      from unnest(coalesce(v_codigos, array[]::text[])) codigo_analise
      left join analises a on a.codigo = codigo_analise
     where a.codigo is null
  ) then
    raise exception 'Ha analise inexistente no catalogo oficial';
  end if;

  if p_exige_laboratorio then
    select id
      into v_orcamento_id
      from orcamentos
     where demanda_id = p_demanda_id
       and status <> 'cancelado'
     order by id
     limit 1
     for update;

    if v_orcamento_id is not null and exists (
      select 1
        from orcamentos
       where id = v_orcamento_id
         and status <> 'rascunho'
    ) then
      raise exception 'Somente orcamento laboratorial em rascunho pode ser sincronizado pela demanda';
    end if;

    if v_orcamento_id is null then
      insert into orcamentos (
        demanda_id,
        cliente_id,
        projeto_id,
        cliente_nome,
        cliente_cnpj,
        cliente_contato,
        responsavel,
        observacoes,
        tipo
      )
      values (
        p_demanda_id,
        v_demanda.cliente_id,
        v_demanda.projeto_id,
        coalesce(v_demanda.cliente_nome, v_demanda.titulo),
        v_demanda.cliente_cnpj,
        v_demanda.cliente_contato,
        v_demanda.responsavel_interno,
        coalesce(v_demanda.escopo_preliminar, v_demanda.descricao, v_demanda.observacoes),
        'analises'
      )
      returning id into v_orcamento_id;
    end if;
  end if;

  delete from demanda_analises
   where demanda_id = p_demanda_id;

  for v_item in select * from jsonb_array_elements(p_itens)
  loop
    insert into demanda_analises (
      demanda_id,
      codigo_analise,
      quantidade_amostras,
      observacao,
      status_custeio,
      origem_quantidade
    )
    values (
      p_demanda_id,
      btrim(v_item->>'codigo_analise'),
      (v_item->>'quantidade_amostras')::numeric,
      nullif(v_item->>'observacao', ''),
      case when v_item->>'status_custeio' = 'disponivel' then 'disponivel' else 'pendente' end,
      case when v_item->>'origem_quantidade' = 'manual' then 'manual' else 'padrao' end
    );

    v_registradas := v_registradas + 1;
    if coalesce(v_item->>'status_custeio', 'pendente') <> 'disponivel' then
      v_pendentes := v_pendentes + 1;
    end if;
  end loop;

  if p_exige_laboratorio and v_orcamento_id is not null then
    delete from orcamento_itens
     where orcamento_id = v_orcamento_id
       and codigo_analise <> all(coalesce(v_codigos, array[]::text[]));

    for v_item in select * from jsonb_array_elements(p_itens)
    loop
      update orcamento_itens
         set n_amostras = (v_item->>'quantidade_amostras')::numeric,
             custo_unitario = coalesce((v_item->>'custo_unitario')::numeric, 0),
             preco_unitario = coalesce((v_item->>'preco_unitario')::numeric, 0),
             valor_snapshot = coalesce(v_item->'valor_snapshot', '{}'::jsonb)
       where orcamento_id = v_orcamento_id
         and codigo_analise = btrim(v_item->>'codigo_analise');

      if not found then
        insert into orcamento_itens (
          orcamento_id,
          codigo_analise,
          n_amostras,
          custo_unitario,
          preco_unitario,
          valor_snapshot
        )
        values (
          v_orcamento_id,
          btrim(v_item->>'codigo_analise'),
          (v_item->>'quantidade_amostras')::numeric,
          coalesce((v_item->>'custo_unitario')::numeric, 0),
          coalesce((v_item->>'preco_unitario')::numeric, 0),
          coalesce(v_item->'valor_snapshot', '{}'::jsonb)
        );
      end if;
    end loop;

    update orcamentos
       set status_operacional = case when v_registradas > 0 then 'preenchido' else 'pendente' end,
           status_operacional_atualizado_em = now()
     where id = v_orcamento_id;
  end if;

  return jsonb_build_object(
    'orcamento_id', v_orcamento_id,
    'registradas', v_registradas,
    'pendentes', v_pendentes
  );
end;
$$;

grant execute on function sincronizar_demanda_analises(bigint, jsonb, boolean) to authenticated;
grant execute on function sincronizar_demanda_analises(bigint, jsonb, boolean) to service_role;
