-- =====================================================================
-- Estabilizacao transacional de orcamentos, snapshots e custeio.
--
-- Migration aditiva posterior a 0100. Preserva o historico e reutiliza as
-- estruturas existentes: links publicos, versoes finais, orcamentos,
-- itens, eventos_status e a view de custo vigente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Link publico sempre vinculado a uma versao final imutavel.
-- ---------------------------------------------------------------------

alter table public.orcamento_projeto_links
  add column if not exists orcamento_final_versao_id bigint
    references public.orcamento_final_versoes(id) on delete restrict;

create index if not exists orcamento_projeto_links_versao_idx
  on public.orcamento_projeto_links (orcamento_final_versao_id);

comment on column public.orcamento_projeto_links.orcamento_final_versao_id is
  'Versao final cujo snapshot e exibido e aprovado. Links legados sem versao permanecem indisponiveis.';

create or replace function public.validar_versao_link_orcamento()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.orcamento_final_versao_id is null then
    raise exception 'Novo link publico exige uma versao final.' using errcode = '23502';
  end if;

  if not exists (
    select 1
      from public.orcamento_projetos p
      join public.orcamento_final_versoes v
        on v.demanda_id = p.demanda_id
     where p.id = new.orcamento_projeto_id
       and v.id = new.orcamento_final_versao_id
  ) then
    raise exception 'Versao final incompativel com o orcamento de projeto.' using errcode = '23514';
  end if;

  return new;
end
$$;

create trigger trg_validar_versao_link_orcamento
  before insert or update of orcamento_projeto_id, orcamento_final_versao_id
  on public.orcamento_projeto_links
  for each row execute function public.validar_versao_link_orcamento();

revoke all on function public.validar_versao_link_orcamento() from public;

create or replace function public.ler_orcamento_publico(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_payload jsonb;
begin
  select jsonb_build_object(
           'snapshot', v.snapshot,
           'orcamento', v.snapshot,
           'versao', jsonb_build_object(
             'id', v.id,
             'numero', v.numero,
             'versao', v.versao,
             'status', v.status,
             'valido_ate', v.valido_ate,
             'total_final', v.total_final
           ),
           'aprovado_em', l.aprovado_em,
           'aprovado_por', l.aprovado_por
         )
    into v_payload
    from public.orcamento_projeto_links l
    join public.orcamento_projetos p
      on p.id = l.orcamento_projeto_id
    join public.orcamento_final_versoes v
      on v.id = l.orcamento_final_versao_id
     and v.demanda_id = p.demanda_id
   where l.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
     and not l.revogado
     and (l.expira_em is null or l.expira_em > now())
     and p.status not in ('recusado', 'cancelado')
     and v.status in ('emitido', 'enviado', 'alterado_reenviado', 'aprovado')
   limit 1;

  return v_payload;
end
$$;

-- A assinatura publica permanece (text, text), mas o retorno passa a jsonb.
-- PostgreSQL exige remover a definicao booleana anterior para mudar o tipo.
drop function if exists public.aprovar_orcamento_publico(text, text);

create function public.aprovar_orcamento_publico(
  p_token text,
  p_nome text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_link record;
  v_ator text := coalesce(nullif(btrim(p_nome), ''), 'Aprovador externo');
begin
  select
    l.id as link_id,
    l.aprovado_em,
    l.aprovado_por,
    p.id as projeto_id,
    p.status as projeto_status,
    v.id as versao_id,
    v.status as versao_status,
    v.numero as versao_numero
  into v_link
  from public.orcamento_projeto_links l
  join public.orcamento_projetos p
    on p.id = l.orcamento_projeto_id
  join public.orcamento_final_versoes v
    on v.id = l.orcamento_final_versao_id
   and v.demanda_id = p.demanda_id
  where l.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and not l.revogado
    and (l.aprovado_em is not null or l.expira_em is null or l.expira_em > now())
  for update of l, p, v;

  if not found then
    return jsonb_build_object('aprovado', false, 'repetido', false);
  end if;

  if v_link.aprovado_em is not null then
    -- Contrato de compatibilidade: retry aprovado deve "return true" semanticamente,
    -- agora acompanhado de repetido=true no retorno estruturado.
    return jsonb_build_object(
      'aprovado', true,
      'repetido', true,
      'versao_id', v_link.versao_id,
      'numero', v_link.versao_numero
    );
  end if;

  if v_link.projeto_status not in ('rascunho', 'enviado')
     or v_link.versao_status not in ('emitido', 'enviado', 'alterado_reenviado') then
    return jsonb_build_object('aprovado', false, 'repetido', false);
  end if;

  perform set_config('app.orcamento_projeto_transicao', 'permitida', true);
  perform set_config('app.orcamento_final_transicao', 'permitida', true);

  update public.orcamento_projetos
     set status = 'aprovado'
   where id = v_link.projeto_id;

  update public.orcamento_final_versoes
     set status = 'aprovado',
         classificado_em = now(),
         classificacao_motivo = 'Aprovacao por link publico versionado.'
   where id = v_link.versao_id;

  update public.orcamento_projeto_links
     set aprovado_em = now(),
         aprovado_por = v_ator
   where id = v_link.link_id;

  -- Contrato auditavel: o comando "insert into eventos_status" abaixo usa
  -- qualificacao explicita do schema para nao depender do search_path.
  insert into public.eventos_status
    (entidade, entidade_id, de_status, para_status, usuario, observacao)
  values
    ('orcamento_projeto', v_link.projeto_id, v_link.projeto_status, 'aprovado', v_ator,
     'Aprovacao publica vinculada a versao final #' || v_link.versao_id || '.'),
    ('orcamento_final', v_link.versao_id, v_link.versao_status, 'aprovado', v_ator,
     'Versao ' || v_link.versao_numero || ' aprovada por link publico versionado.');

  return jsonb_build_object(
    'aprovado', true,
    'repetido', false,
    'versao_id', v_link.versao_id,
    'numero', v_link.versao_numero
  );
end
$$;

revoke all on function public.ler_orcamento_publico(text) from public;
revoke all on function public.aprovar_orcamento_publico(text, text) from public;
grant execute on function public.ler_orcamento_publico(text) to anon, authenticated;
grant execute on function public.aprovar_orcamento_publico(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Dimensao e proveniencia explicitas para o custo vigente.
-- ---------------------------------------------------------------------

create or replace view public.v_custo_estoque_vigente as
with lotes_liberados as (
  select
    l.insumo_id,
    l.quantidade_atual,
    l.custo_unitario
  from public.lotes_estoque l
  where l.quantidade_atual > 0
    and l.status in ('aceito', 'em_uso')
    and (
      public.menor_validade(l.validade, l.validade_apos_abertura) is null
      or public.menor_validade(l.validade, l.validade_apos_abertura) >= current_date
    )
), agregados as (
  select
    insumo_id,
    sum(quantidade_atual) as quantidade_liberada,
    sum(quantidade_atual * custo_unitario)
      filter (where custo_unitario > 0) as valor_liberado,
    sum(quantidade_atual * custo_unitario)
      filter (where custo_unitario > 0)
      / nullif(sum(quantidade_atual) filter (where custo_unitario > 0), 0)
      as custo_medio_ponderado
  from lotes_liberados
  group by insumo_id
)
select
  i.id as insumo_id,
  i.especificacao,
  i.unidade,
  i.custo_unitario as custo_padrao,
  coalesce(a.quantidade_liberada, 0) as quantidade_liberada,
  coalesce(a.valor_liberado, 0) as valor_liberado,
  a.custo_medio_ponderado,
  case
    when a.custo_medio_ponderado is null then null
    else a.custo_medio_ponderado - coalesce(i.custo_unitario, 0)
  end as divergencia_absoluta,
  case
    when a.custo_medio_ponderado is null or coalesce(i.custo_unitario, 0) = 0 then null
    else ((a.custo_medio_ponderado - i.custo_unitario) / i.custo_unitario) * 100
  end as divergencia_percentual,
  case
    when a.custo_medio_ponderado is null and not (coalesce(i.custo_unitario, 0) > 0) then 'sem_custo_disponivel'
    when a.custo_medio_ponderado is null then 'fallback_custo_padrao'
    when coalesce(i.custo_unitario, 0) = 0 then 'sem_custo_padrao'
    when abs(a.custo_medio_ponderado - i.custo_unitario) / i.custo_unitario >= 0.1 then 'divergente'
    else 'alinhado'
  end as situacao,
  i.unidade as unidade_estoque,
  coalesce(nullif(i.unidade_consumo, ''), i.unidade) as unidade_consumo,
  case when i.fator_conversao > 0 then i.fator_conversao end as fator_conversao,
  coalesce(a.custo_medio_ponderado, case when i.custo_unitario > 0 then i.custo_unitario end) as custo_origem,
  coalesce(a.custo_medio_ponderado, case when i.custo_unitario > 0 then i.custo_unitario end)
    / case when i.fator_conversao > 0 then i.fator_conversao end as custo_normalizado,
  case
    when a.custo_medio_ponderado is not null then 'custo_medio_ponderado'
    when i.custo_unitario > 0 then 'custo_padrao_fallback'
    else 'indisponivel'
  end as fonte_custo,
  case
    when a.custo_medio_ponderado is not null then 'lotes_estoque_liberados'
    when i.custo_unitario > 0 then 'insumos:' || i.id
    else null
  end as referencia_custo
from public.insumos i
left join agregados a on a.insumo_id = i.id;

comment on view public.v_custo_estoque_vigente is
  'fator_conversao = unidades de consumo por unidade de estoque; custo_normalizado = custo_origem / fator. A media cai explicitamente para o padrao e nunca para zero silencioso.';

grant select on public.v_custo_estoque_vigente to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3. Recalculo operacional otimista, idempotente e auditavel.
-- ---------------------------------------------------------------------

alter table public.orcamentos
  add column if not exists custo_revisao integer not null default 0,
  add column if not exists custo_recalculado_em timestamptz,
  add column if not exists custo_recalculado_por text,
  add column if not exists custo_recalculo_motivo text;

alter table public.orcamentos
  add constraint orcamentos_custo_revisao_nonnegative
  check (custo_revisao >= 0);

alter table public.eventos_status
  add column if not exists operacao_id uuid,
  add column if not exists operacao_payload jsonb;

create unique index if not exists eventos_status_entidade_operacao_unique
  on public.eventos_status (entidade, operacao_id)
  where operacao_id is not null;

comment on column public.eventos_status.operacao_id is
  'Identidade idempotente de uma operacao transacional auditada.';

create or replace function public.proteger_recalculo_orcamento()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if current_setting('app.orcamento_custo_recalculo', true) is distinct from 'permitido' then
    raise exception 'Custos do orcamento exigem recalculo transacional.' using errcode = '42501';
  end if;
  return new;
end
$$;

create trigger trg_proteger_recalculo_orcamento
  before update of fonte_custo_insumos, custo_snapshot, custo_revisao,
    custo_recalculado_em, custo_recalculado_por, custo_recalculo_motivo
  on public.orcamentos
  for each row execute function public.proteger_recalculo_orcamento();

create trigger trg_proteger_recalculo_itens
  before update of custo_unitario, preco_unitario, valor_snapshot
  on public.orcamento_itens
  for each row execute function public.proteger_recalculo_orcamento();

revoke all on function public.proteger_recalculo_orcamento() from public;

create or replace function public.recalcular_orcamento_transacional(
  p_orcamento_id bigint,
  p_motivo text,
  p_revisao_esperada integer,
  p_fonte_custo_insumos text,
  p_itens jsonb,
  p_snapshot jsonb,
  p_operacao_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_orcamento record;
  v_claims jsonb;
  v_ator text;
  v_entrada jsonb;
  v_evento jsonb;
  v_item jsonb;
  v_resultado jsonb;
  v_status_operacional text;
begin
  perform public.fn_exige_papel('coordenador');

  v_claims := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  v_ator := coalesce(nullif(v_claims->>'email', ''), nullif(v_claims->>'sub', ''));
  if v_ator is null then
    raise exception 'Ator autenticado obrigatorio.' using errcode = '42501';
  end if;
  if p_operacao_id is null then
    raise exception 'operacao_id obrigatoria.' using errcode = '22023';
  end if;
  if nullif(btrim(p_motivo), '') is null then
    raise exception 'Motivo do recalculo obrigatorio.' using errcode = '22023';
  end if;
  if p_fonte_custo_insumos not in ('custo_padrao', 'custo_medio_ponderado') then
    raise exception 'Fonte de custo invalida.' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_itens, 'null'::jsonb)) is distinct from 'array' then
    raise exception 'Itens do recalculo devem ser um array JSON.' using errcode = '22023';
  end if;

  v_entrada := jsonb_build_object(
    'orcamento_id', p_orcamento_id,
    'motivo', btrim(p_motivo),
    'revisao_esperada', p_revisao_esperada,
    'fonte_custo_insumos', p_fonte_custo_insumos,
    'itens', p_itens,
    'snapshot', coalesce(p_snapshot, '{}'::jsonb)
  );

  perform pg_advisory_xact_lock(hashtextextended(p_operacao_id::text, 0));

  select operacao_payload
    into v_evento
    from public.eventos_status
   where entidade = 'orcamento_recalculo'
     and operacao_id = p_operacao_id;

  if found then
    if v_evento->'entrada' is distinct from v_entrada then
      raise exception 'OPERACAO_ID_REUTILIZADA_COM_PAYLOAD_DIFERENTE' using errcode = '22023';
    end if;
    return coalesce(v_evento->'resultado', '{}'::jsonb)
      || jsonb_build_object('repetido', true);
  end if;

  select id, status, custo_revisao
    into v_orcamento
    from public.orcamentos
   where id = p_orcamento_id
   for update;

  if not found then
    raise exception 'Orcamento nao encontrado.' using errcode = 'P0002';
  end if;
  if v_orcamento.custo_revisao <> p_revisao_esperada then
    raise exception 'CONFLITO_REVISAO: esperada %, atual %.',
      p_revisao_esperada, v_orcamento.custo_revisao using errcode = '40001';
  end if;

  if exists (
    select 1
      from jsonb_array_elements(p_itens) j
      left join public.orcamento_itens oi
        on oi.id = nullif(j->>'id', '')::bigint
       and oi.orcamento_id = p_orcamento_id
     where oi.id is null
       or nullif(j->>'custo_unitario', '') is null
       or nullif(j->>'preco_unitario', '') is null
  ) then
    raise exception 'Item de recalculo invalido ou alheio ao orcamento.' using errcode = '22023';
  end if;

  if (select count(*) from jsonb_array_elements(p_itens))
       <> (select count(*) from public.orcamento_itens where orcamento_id = p_orcamento_id)
     or (select count(distinct value->>'id') from jsonb_array_elements(p_itens))
       <> (select count(*) from jsonb_array_elements(p_itens)) then
    raise exception 'Recalculo exige exatamente um snapshot para cada item do orcamento.'
      using errcode = '22023';
  end if;

  v_status_operacional := case
    when v_orcamento.status = 'cancelado' then 'cancelado'
    when v_orcamento.status in ('enviado', 'aprovado') then 'revisado'
    when jsonb_array_length(p_itens) > 0
      and coalesce(p_snapshot, '{}'::jsonb) <> '{}'::jsonb then 'preenchido'
    else 'pendente'
  end;

  perform set_config('app.orcamento_custo_recalculo', 'permitido', true);

  for v_item in select value from jsonb_array_elements(p_itens)
  loop
    update public.orcamento_itens
       set custo_unitario = (v_item->>'custo_unitario')::numeric,
           preco_unitario = (v_item->>'preco_unitario')::numeric,
           valor_snapshot = coalesce(v_item->'valor_snapshot', valor_snapshot)
     where id = (v_item->>'id')::bigint
       and orcamento_id = p_orcamento_id;
  end loop;

  update public.orcamentos
     set fonte_custo_insumos = p_fonte_custo_insumos,
         custo_snapshot = coalesce(p_snapshot, '{}'::jsonb),
         custo_revisao = custo_revisao + 1,
         custo_recalculado_em = now(),
         custo_recalculado_por = v_ator,
         custo_recalculo_motivo = btrim(p_motivo),
         status_operacional = v_status_operacional,
         status_operacional_atualizado_em = now()
   where id = p_orcamento_id;

  v_resultado := jsonb_build_object(
    'orcamento_id', p_orcamento_id,
    'revisao', v_orcamento.custo_revisao + 1,
    'status_operacional', v_status_operacional,
    'operacao_id', p_operacao_id,
    'repetido', false
  );

  insert into public.eventos_status
    (entidade, entidade_id, de_status, para_status, usuario, observacao,
     operacao_id, operacao_payload)
  values
    ('orcamento_recalculo', p_orcamento_id,
     'custo_r' || v_orcamento.custo_revisao,
     'custo_r' || (v_orcamento.custo_revisao + 1),
     v_ator, btrim(p_motivo), p_operacao_id,
     jsonb_build_object('entrada', v_entrada, 'resultado', v_resultado));

  return v_resultado;
end
$$;

revoke all on function public.recalcular_orcamento_transacional(
  bigint, text, integer, text, jsonb, jsonb, uuid
) from public, anon;
grant execute on function public.recalcular_orcamento_transacional(
  bigint, text, integer, text, jsonb, jsonb, uuid
) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 4. Imutabilidade economica e operacoes atomicas pos-emissao.
-- ---------------------------------------------------------------------

alter table public.orcamento_final_versoes
  add column if not exists operacao_id uuid,
  add column if not exists operacao_payload jsonb;

create unique index if not exists orcamento_final_versoes_operacao_unique
  on public.orcamento_final_versoes (operacao_id)
  where operacao_id is not null;

create or replace function public.proteger_orcamento_final_emitido()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.demanda_id is distinct from old.demanda_id
     or new.versao is distinct from old.versao
     or new.numero is distinct from old.numero
     or new.validade_dias is distinct from old.validade_dias
     or new.valido_ate is distinct from old.valido_ate
     or new.total_laboratorio_custo is distinct from old.total_laboratorio_custo
     or new.total_laboratorio_preco is distinct from old.total_laboratorio_preco
     or new.total_projeto_custo is distinct from old.total_projeto_custo
     or new.total_projeto_final is distinct from old.total_projeto_final
     or new.total_final is distinct from old.total_final
     or new.snapshot is distinct from old.snapshot
     or new.criado_por is distinct from old.criado_por
     or new.criado_em is distinct from old.criado_em then
    raise exception 'Conteudo economico de versao final emitida e imutavel.' using errcode = '42501';
  end if;

  if new.status is distinct from old.status
     and current_setting('app.orcamento_final_transicao', true) is distinct from 'permitida' then
    raise exception 'Status da versao final exige transicao transacional.' using errcode = '42501';
  end if;

  return new;
end
$$;

create trigger trg_proteger_orcamento_final_emitido
  before update on public.orcamento_final_versoes
  for each row execute function public.proteger_orcamento_final_emitido();

revoke all on function public.proteger_orcamento_final_emitido() from public;

-- Escritas de authenticated passam exclusivamente pelas RPCs SECURITY DEFINER.
-- As policies permissivas historicas continuam preservadas, mas estas policies
-- restritivas impedem insert/update/delete direto no documento emitido.
create policy rls_rpc_insert_orcamento_final_versoes
  on public.orcamento_final_versoes
  as restrictive for insert to authenticated
  with check (false);

create policy rls_rpc_update_orcamento_final_versoes
  on public.orcamento_final_versoes
  as restrictive for update to authenticated
  using (false) with check (false);

create policy rls_rpc_delete_orcamento_final_versoes
  on public.orcamento_final_versoes
  as restrictive for delete to authenticated
  using (false);

revoke insert, update, delete on public.orcamento_final_versoes
  from authenticated, service_role;

create or replace function public.transicionar_orcamento_final(
  p_versao_id bigint,
  p_status_destino text,
  p_motivo text default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_atual record;
  v_claims jsonb;
  v_ator text;
  v_ator_id uuid;
begin
  perform public.fn_exige_papel('coordenador');
  v_claims := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  v_ator := coalesce(nullif(v_claims->>'email', ''), nullif(v_claims->>'sub', ''));
  if v_ator is null then
    raise exception 'Ator autenticado obrigatorio.' using errcode = '42501';
  end if;
  if coalesce(v_claims->>'sub', '') ~ '^[0-9a-fA-F-]{36}$' then
    v_ator_id := (v_claims->>'sub')::uuid;
  end if;

  select id, demanda_id, status
    into v_atual
    from public.orcamento_final_versoes
   where id = p_versao_id
   for update;
  if not found then
    raise exception 'Versao final nao encontrada.' using errcode = 'P0002';
  end if;

  if v_atual.status = p_status_destino then
    return jsonb_build_object(
      'id', p_versao_id,
      'status_origem', v_atual.status,
      'status_destino', p_status_destino,
      'alterado', false
    );
  end if;

  if not (
    (v_atual.status = 'emitido' and p_status_destino in
      ('enviado', 'alterado_reenviado', 'aprovado', 'recusado', 'rejeitado', 'cancelado', 'vencido'))
    or (v_atual.status in ('enviado', 'alterado_reenviado') and p_status_destino in
      ('alterado_reenviado', 'aprovado', 'recusado', 'rejeitado', 'cancelado', 'vencido'))
    or (v_atual.status in ('recusado', 'rejeitado') and p_status_destino in
      ('alterado_reenviado', 'cancelado'))
    or (v_atual.status = 'aprovado' and p_status_destino in
      ('convertido_projeto', 'cancelado'))
  ) then
    raise exception 'Transicao de versao final nao permitida: % -> %.',
      v_atual.status, p_status_destino using errcode = '22023';
  end if;

  perform set_config('app.orcamento_final_transicao', 'permitida', true);
  update public.orcamento_final_versoes
     set status = p_status_destino,
         classificado_em = case
           when p_status_destino in ('enviado', 'alterado_reenviado', 'aprovado', 'recusado', 'rejeitado')
             then now()
           else classificado_em
         end,
         classificado_por = case
           when p_status_destino in ('enviado', 'alterado_reenviado', 'aprovado', 'recusado', 'rejeitado')
             then v_ator_id
           else classificado_por
         end,
         classificacao_motivo = case
           when p_status_destino in ('enviado', 'alterado_reenviado', 'aprovado', 'recusado', 'rejeitado')
             then p_motivo
           else classificacao_motivo
         end,
         cancelado_em = case when p_status_destino = 'cancelado' then now() else cancelado_em end,
         cancelado_motivo = case when p_status_destino = 'cancelado' then p_motivo else cancelado_motivo end
   where id = p_versao_id;

  insert into public.eventos_status
    (entidade, entidade_id, de_status, para_status, usuario, observacao)
  values
    ('orcamento_final', p_versao_id, v_atual.status, p_status_destino, v_ator, p_motivo);

  return jsonb_build_object(
    'id', p_versao_id,
    'status_origem', v_atual.status,
    'status_destino', p_status_destino,
    'alterado', true
  );
end
$$;

create or replace function public.duplicar_orcamento_final_transacional(
  p_versao_id bigint,
  p_validade_dias integer,
  p_operacao_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_original public.orcamento_final_versoes%rowtype;
  v_demanda_id bigint;
  v_versao integer;
  v_numero text;
  v_nova_id bigint;
  v_claims jsonb;
  v_ator text;
  v_ator_id uuid;
  v_payload jsonb;
  v_existente record;
  v_resultado jsonb;
begin
  perform public.fn_exige_papel('coordenador');
  v_claims := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  v_ator := coalesce(nullif(v_claims->>'email', ''), nullif(v_claims->>'sub', ''));
  if v_ator is null then
    raise exception 'Ator autenticado obrigatorio.' using errcode = '42501';
  end if;
  if coalesce(v_claims->>'sub', '') ~ '^[0-9a-fA-F-]{36}$' then
    v_ator_id := (v_claims->>'sub')::uuid;
  end if;
  if coalesce(p_validade_dias, 0) <= 0 then
    raise exception 'Validade deve ser positiva.' using errcode = '22023';
  end if;
  if p_operacao_id is null then
    raise exception 'operacao_id obrigatoria.' using errcode = '22023';
  end if;

  v_payload := jsonb_build_object(
    'versao_id', p_versao_id,
    'validade_dias', p_validade_dias,
    'ator_id', v_ator_id
  );

  perform pg_advisory_xact_lock(hashtextextended(p_operacao_id::text, 0));
  select id, numero, versao, operacao_payload
    into v_existente
    from public.orcamento_final_versoes
   where operacao_id = p_operacao_id
   for update;

  if found then
    if v_existente.operacao_payload is distinct from v_payload then
      raise exception 'IDEMPOTENCY_CONFLICT: OPERACAO_ID_REUTILIZADA_COM_PAYLOAD_DIFERENTE'
        using errcode = '22023';
    end if;
    return jsonb_build_object('repetido', true) || jsonb_build_object(
      'id', v_existente.id,
      'numero', v_existente.numero,
      'versao', v_existente.versao
    );
  end if;

  select demanda_id into v_demanda_id
    from public.orcamento_final_versoes
   where id = p_versao_id;
  if not found then
    raise exception 'Versao final nao encontrada.' using errcode = 'P0002';
  end if;

  perform 1
    from public.demandas_propostas
   where id = v_demanda_id
   for update;

  select * into v_original
    from public.orcamento_final_versoes
   where id = p_versao_id
   for update;
  if not found then
    raise exception 'Versao final nao encontrada.' using errcode = 'P0002';
  end if;

  select coalesce(max(versao), 0) + 1
    into v_versao
    from public.orcamento_final_versoes
   where demanda_id = v_original.demanda_id;
  v_numero := regexp_replace(v_original.numero, '-v[0-9]+$', '') || '-v' || v_versao;

  perform set_config('app.orcamento_final_transicao', 'permitida', true);
  update public.orcamento_final_versoes
     set status = 'substituido'
   where demanda_id = v_original.demanda_id
     and status = 'emitido';

  insert into public.orcamento_final_versoes (
    demanda_id, versao, numero, status, validade_dias, valido_ate,
    total_laboratorio_custo, total_laboratorio_preco,
    total_projeto_custo, total_projeto_final, total_final,
    snapshot, criado_por, duplicada_de_id, operacao_id, operacao_payload
  ) values (
    v_original.demanda_id, v_versao, v_numero, 'emitido', p_validade_dias,
    current_date + p_validade_dias,
    v_original.total_laboratorio_custo, v_original.total_laboratorio_preco,
    v_original.total_projeto_custo, v_original.total_projeto_final, v_original.total_final,
    v_original.snapshot, v_ator_id, v_original.id, p_operacao_id, v_payload
  ) returning id into v_nova_id;

  v_resultado := jsonb_build_object(
    'id', v_nova_id,
    'numero', v_numero,
    'versao', v_versao,
    'repetido', false
  );

  insert into public.eventos_status
    (entidade, entidade_id, de_status, para_status, usuario, observacao,
     operacao_id, operacao_payload)
  values
    ('orcamento_final', v_nova_id, 'versao_' || v_original.id, 'v' || v_versao, v_ator,
     'Versao final duplicada atomicamente a partir de #' || v_original.id || '.',
     p_operacao_id, jsonb_build_object('entrada', v_payload, 'resultado', v_resultado));

  return v_resultado;
end
$$;

-- A assinatura canonica acrescenta somente a identidade idempotente.
create or replace function public.emitir_orcamento_final_transacional(
  p_demanda_id bigint,
  p_validade_dias integer,
  p_total_laboratorio_custo numeric,
  p_total_laboratorio_preco numeric,
  p_total_projeto_custo numeric,
  p_total_projeto_final numeric,
  p_total_final numeric,
  p_snapshot jsonb,
  p_parametros jsonb,
  p_criado_por uuid,
  p_usuario_email text,
  p_operacao_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_claims jsonb;
  v_ator text;
  v_ator_id uuid;
  v_payload jsonb;
  v_existente record;
  v_resultado jsonb;
begin
  perform public.fn_exige_papel('coordenador');
  v_claims := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  v_ator := coalesce(nullif(v_claims->>'email', ''), nullif(v_claims->>'sub', ''));
  if v_ator is null or coalesce(v_claims->>'sub', '') !~ '^[0-9a-fA-F-]{36}$' then
    raise exception 'Ator autenticado forte obrigatorio.' using errcode = '42501';
  end if;
  v_ator_id := (v_claims->>'sub')::uuid;
  if p_operacao_id is null then
    raise exception 'operacao_id obrigatoria.' using errcode = '22023';
  end if;

  v_payload := jsonb_build_object(
    'demanda_id', p_demanda_id,
    'validade_dias', p_validade_dias,
    'total_laboratorio_custo', p_total_laboratorio_custo,
    'total_laboratorio_preco', p_total_laboratorio_preco,
    'total_projeto_custo', p_total_projeto_custo,
    'total_projeto_final', p_total_projeto_final,
    'total_final', p_total_final,
    'snapshot', p_snapshot,
    'parametros', p_parametros,
    'ator_id', v_ator_id,
    'ator', v_ator
  );

  perform pg_advisory_xact_lock(hashtextextended(p_operacao_id::text, 0));
  select id, numero, versao, operacao_payload
    into v_existente
    from public.orcamento_final_versoes
   where operacao_id = p_operacao_id;

  if found then
    if v_existente.operacao_payload is distinct from v_payload then
      raise exception 'OPERACAO_ID_REUTILIZADA_COM_PAYLOAD_DIFERENTE' using errcode = '22023';
    end if;
    return jsonb_build_object(
      'id', v_existente.id,
      'numero', v_existente.numero,
      'versao', v_existente.versao,
      'repetido', true
    );
  end if;

  perform set_config('app.orcamento_final_transicao', 'permitida', true);
  v_resultado := public.emitir_orcamento_final_transacional(
    p_demanda_id,
    p_validade_dias,
    p_total_laboratorio_custo,
    p_total_laboratorio_preco,
    p_total_projeto_custo,
    p_total_projeto_final,
    p_total_final,
    p_snapshot,
    p_parametros,
    v_ator_id,
    v_ator
  );

  update public.orcamento_final_versoes
     set operacao_id = p_operacao_id,
         operacao_payload = v_payload
   where id = (v_resultado->>'id')::bigint;

  update public.eventos_status
     set entidade_id = (v_resultado->>'id')::bigint,
         operacao_id = p_operacao_id,
         operacao_payload = jsonb_build_object(
           'entrada', v_payload,
           'resultado', v_resultado || jsonb_build_object('repetido', false)
         )
   where id = (
     select id
       from public.eventos_status
      where entidade = 'orcamento_final'
        and entidade_id = p_demanda_id
        and para_status = 'v' || (v_resultado->>'versao')
      order by id desc
      limit 1
   );

  return v_resultado || jsonb_build_object('repetido', false);
end
$$;

revoke all on function public.transicionar_orcamento_final(bigint, text, text)
  from public, anon;
revoke all on function public.duplicar_orcamento_final_transacional(bigint, integer, uuid)
  from public, anon;
revoke all on function public.emitir_orcamento_final_transacional(
  bigint, integer, numeric, numeric, numeric, numeric, numeric,
  jsonb, jsonb, uuid, text
) from public, anon, authenticated, service_role;
revoke all on function public.emitir_orcamento_final_transacional(
  bigint, integer, numeric, numeric, numeric, numeric, numeric,
  jsonb, jsonb, uuid, text, uuid
) from public, anon;

grant execute on function public.transicionar_orcamento_final(bigint, text, text)
  to authenticated, service_role;
grant execute on function public.duplicar_orcamento_final_transacional(bigint, integer, uuid)
  to authenticated, service_role;
grant execute on function public.emitir_orcamento_final_transacional(
  bigint, integer, numeric, numeric, numeric, numeric, numeric,
  jsonb, jsonb, uuid, text, uuid
) to authenticated, service_role;
