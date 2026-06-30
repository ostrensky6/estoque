-- =====================================================================
-- Triagem: resolver codigo desconhecido criando insumo minimo.
--
-- A funcao encapsula em uma unica transacao Postgres:
-- 1. criacao do insumo;
-- 2. criacao do identificador ativo;
-- 3. marcacao da triagem como resolvida.
--
-- Se qualquer etapa falhar, a chamada inteira falha e nada fica parcial.
-- =====================================================================

alter table public.insumos
  add column if not exists unidade_consumo text;

comment on column public.insumos.unidade is
  'Unidade fisica de estoque/compra do insumo.';

comment on column public.insumos.unidade_consumo is
  'Unidade usada nas receitas das analises para consumo planejado.';

comment on column public.insumos.fator_conversao is
  'Quantidade de unidades de consumo contidas em 1 unidade de estoque.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'insumos_quantidade_embalagem_positive'
  ) then
    alter table public.insumos
      add constraint insumos_quantidade_embalagem_positive
      check (quantidade_embalagem is null or quantidade_embalagem > 0)
      not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'insumos_fator_conversao_positive'
  ) then
    alter table public.insumos
      add constraint insumos_fator_conversao_positive
      check (fator_conversao is null or fator_conversao > 0)
      not valid;
  end if;
end $$;

create or replace function public.resolver_triagem_criando_insumo(
  p_triagem_id bigint,
  p_especificacao text,
  p_unidade text,
  p_unidade_consumo text,
  p_fator_conversao numeric,
  p_quantidade_embalagem numeric,
  p_custo_total_embalagem numeric default null,
  p_criado_por text default null
)
returns table (
  triagem_id bigint,
  insumo_id bigint,
  identificador_id bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_triagem public.cadastros_triagem%rowtype;
  v_codigo text;
  v_codigo_normalizado text;
  v_insumo_id bigint;
  v_identificador_id bigint;
begin
  select *
    into v_triagem
    from public.cadastros_triagem
   where id = p_triagem_id
   for update;

  if not found then
    raise exception 'Triagem nao encontrada.';
  end if;

  if v_triagem.status not in ('pendente', 'em_analise') then
    raise exception 'Triagem ja resolvida ou descartada.';
  end if;

  v_codigo := nullif(btrim(v_triagem.codigo), '');
  v_codigo_normalizado := nullif(btrim(v_triagem.codigo_normalizado), '');

  if v_codigo is null then
    raise exception 'Codigo da triagem invalido.';
  end if;

  if v_codigo_normalizado is null then
    v_codigo_normalizado := upper(regexp_replace(v_codigo, '\s+', ' ', 'g'));
  end if;

  if nullif(btrim(p_especificacao), '') is null then
    raise exception 'Especificacao obrigatoria.';
  end if;

  if nullif(btrim(p_unidade), '') is null then
    raise exception 'Unidade de estoque obrigatoria.';
  end if;

  if nullif(btrim(p_unidade_consumo), '') is null then
    raise exception 'Unidade de consumo obrigatoria.';
  end if;

  if p_fator_conversao is null or p_fator_conversao <= 0 then
    raise exception 'Fator de conversao deve ser maior que zero.';
  end if;

  if p_quantidade_embalagem is null or p_quantidade_embalagem <= 0 then
    raise exception 'Quantidade da embalagem deve ser maior que zero.';
  end if;

  if p_custo_total_embalagem is not null and p_custo_total_embalagem < 0 then
    raise exception 'Custo total da embalagem nao pode ser negativo.';
  end if;

  if exists (
    select 1
      from public.identificadores
     where codigo_normalizado = v_codigo_normalizado
       and ativo = true
  ) then
    raise exception 'Este codigo ja esta vinculado a outra entidade ativa.';
  end if;

  insert into public.insumos (
    especificacao,
    unidade,
    unidade_consumo,
    fator_conversao,
    quantidade_embalagem,
    custo_total_embalagem,
    custo_unitario,
    ponto_reposicao,
    estoque_seguranca,
    codigo_interno
  )
  values (
    btrim(p_especificacao),
    btrim(p_unidade),
    btrim(p_unidade_consumo),
    p_fator_conversao,
    p_quantidade_embalagem,
    p_custo_total_embalagem,
    case
      when p_custo_total_embalagem is null then null
      else p_custo_total_embalagem / p_quantidade_embalagem
    end,
    0,
    0,
    v_codigo
  )
  returning id into v_insumo_id;

  insert into public.identificadores (
    codigo,
    codigo_normalizado,
    formato,
    entidade_tipo,
    entidade_id,
    origem,
    metadata,
    ativo,
    criado_por
  )
  values (
    v_codigo,
    v_codigo_normalizado,
    coalesce(v_triagem.formato, 'manual'),
    'insumo',
    v_insumo_id,
    'manual',
    jsonb_build_object('triagem_id', v_triagem.id),
    true,
    p_criado_por
  )
  returning id into v_identificador_id;

  update public.cadastros_triagem
     set status = 'resolvido',
         entidade_tipo = 'insumo',
         entidade_id = v_insumo_id,
         resolvido_em = now()
   where id = v_triagem.id
     and status in ('pendente', 'em_analise');

  if not found then
    raise exception 'Triagem nao pode mais ser resolvida.';
  end if;

  triagem_id := v_triagem.id;
  insumo_id := v_insumo_id;
  identificador_id := v_identificador_id;
  return next;
end;
$$;

grant execute on function public.resolver_triagem_criando_insumo(
  bigint,
  text,
  text,
  text,
  numeric,
  numeric,
  numeric,
  text
) to authenticated, service_role;
