-- Decisões do dono em 2026-09-26 (docs/auditoria-processos-2026-09-26.md, §6):
--
--  1. Proposta aprovada gera o planejamento sozinha. Quando uma versão final
--     passa a "aprovado" (link público do cliente ou classificação pela
--     equipe), o banco cria um plano em RASCUNHO com as análises e amostras da
--     versão e avisa o coordenador. Datas, equipamentos e reserva continuam
--     com a equipe. Um plano por proposta: se outra versão da mesma proposta já
--     gerou plano ativo, só avisa.
--  2. A baixa acontece na retirada e registra quem retirou. Toda movimentação
--     de estoque passa a guardar o usuário (e-mail do JWT) que a executou.
--
-- Aditiva: colunas novas (nullable), índice único parcial, função e gatilhos
-- novos. Não altera dados existentes.
-- Rollback: dropar os gatilhos kontrol_plano_da_proposta_aprovada e
-- kontrol_movimentacao_usuario, as funções correspondentes, o índice
-- planejamento_versao_final_uidx e as colunas planejamento.orcamento_final_versao_id
-- e estoque_movimentacoes.usuario.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- ---- 1. Plano da proposta aprovada -----------------------------------------
alter table public.planejamento
  add column if not exists orcamento_final_versao_id bigint
    references public.orcamento_final_versoes(id) on delete set null;

create unique index if not exists planejamento_versao_final_uidx
  on public.planejamento (orcamento_final_versao_id)
  where orcamento_final_versao_id is not null;

comment on column public.planejamento.orcamento_final_versao_id is
  'Versão final aprovada que gerou este plano automaticamente (0122).';

create or replace function kontrol_private.gerar_plano_da_versao_aprovada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_demanda jsonb := new.snapshot -> 'demanda';
  v_plano_existente bigint;
  v_plano bigint;
  v_orcamento_id bigint;
  v_orcamento_projeto_id bigint;
  v_itens jsonb;
begin
  -- Já existe plano ativo desta proposta (outra versão aprovada antes)?
  select p.id into v_plano_existente
  from public.planejamento p
  join public.orcamento_final_versoes v on v.id = p.orcamento_final_versao_id
  where v.demanda_id = new.demanda_id
    and p.status_operacional <> 'cancelado'
  order by p.id desc
  limit 1;

  if v_plano_existente is not null then
    begin
      insert into public.notificacoes (
        tipo, titulo, corpo, entidade_tipo, entidade_id, papel_destino, dedupe_key
      ) values (
        'sistema',
        'Nova versão aprovada: confira o planejamento #' || v_plano_existente,
        'A proposta ' || coalesce(new.numero, '#' || new.id) || ' foi aprovada, mas já tem o planejamento #'
          || v_plano_existente || '. Ajuste análises e amostras do plano se a nova versão mudou algo.',
        'planejamento', v_plano_existente, 'coordenador', 'plano_versao_' || new.id
      )
      on conflict do nothing;
    exception when others then
      raise warning '0122: aviso do plano nao registrado: %', sqlerrm;
    end;
    return new;
  end if;

  -- Análises e amostras congeladas na versão. Os ids do snapshot apontam para
  -- linhas cujo código de análise não muda depois da revisão do módulo.
  with itens as (
    select oi.codigo_analise, (item ->> 'n_amostras')::numeric as n_amostras
    from jsonb_array_elements(coalesce(new.snapshot -> 'orcamentos_analises', '[]'::jsonb)) orc
    cross join lateral jsonb_array_elements(coalesce(orc -> 'orcamento_itens', '[]'::jsonb)) item
    join public.orcamento_itens oi on oi.id = (item ->> 'id')::bigint
    union all
    select opa.codigo_analise, (item ->> 'n_amostras')::numeric
    from jsonb_array_elements(coalesce(new.snapshot -> 'orcamentos_projeto', '[]'::jsonb)) orc
    cross join lateral jsonb_array_elements(coalesce(orc -> 'orcamento_projeto_analises', '[]'::jsonb)) item
    join public.orcamento_projeto_analises opa on opa.id = (item ->> 'id')::bigint
  )
  select jsonb_agg(jsonb_build_object('codigo_analise', codigo_analise, 'n_amostras', total))
    into v_itens
  from (
    select codigo_analise, sum(n_amostras) as total
    from itens
    where codigo_analise is not null and n_amostras > 0
    group by codigo_analise
  ) agregados;

  if v_itens is null then
    return new; -- proposta só com custos de projeto: não há análise para planejar
  end if;

  select max((orc ->> 'id')::bigint) into v_orcamento_id
  from jsonb_array_elements(coalesce(new.snapshot -> 'orcamentos_analises', '[]'::jsonb)) orc;
  select max((orc ->> 'id')::bigint) into v_orcamento_projeto_id
  from jsonb_array_elements(coalesce(new.snapshot -> 'orcamentos_projeto', '[]'::jsonb)) orc;

  insert into public.planejamento (
    nome, projeto_id, origem_planejamento, orcamento_id, orcamento_projeto_id,
    orcamento_final_versao_id, planejado_por, status_operacional
  ) values (
    left('Proposta ' || coalesce(new.numero, '#' || new.id) || ' — '
      || coalesce(nullif(v_demanda ->> 'cliente_nome', ''), nullif(v_demanda ->> 'titulo', ''), 'sem cliente'), 200),
    nullif(v_demanda ->> 'projeto_id', '')::bigint,
    case when v_orcamento_id is null then 'orcamento_projeto' else 'orcamento' end,
    v_orcamento_id,
    v_orcamento_projeto_id,
    new.id,
    'Automático (proposta aprovada)',
    'rascunho'
  )
  on conflict do nothing
  returning id into v_plano;

  if v_plano is null then
    return new; -- corrida: outra transação já gerou o plano desta versão
  end if;

  insert into public.planejamento_itens (planejamento_id, codigo_analise, n_amostras)
  select v_plano, x ->> 'codigo_analise', (x ->> 'n_amostras')::numeric
  from jsonb_array_elements(v_itens) x;

  -- O aviso não pode desfazer a aprovação nem o plano.
  begin
    insert into public.notificacoes (
      tipo, titulo, corpo, entidade_tipo, entidade_id, papel_destino, dedupe_key
    ) values (
      'sistema',
      'Planejamento #' || v_plano || ' criado da proposta aprovada',
      'A proposta ' || coalesce(new.numero, '#' || new.id) || ' foi aprovada. O plano está em rascunho: defina datas e equipamentos e reserve os insumos.',
      'planejamento', v_plano, 'coordenador', 'plano_versao_' || new.id
    )
    on conflict do nothing;
  exception when others then
    raise warning '0122: aviso do plano nao registrado: %', sqlerrm;
  end;

  return new;
end $$;

revoke all on function kontrol_private.gerar_plano_da_versao_aprovada()
  from public, anon, authenticated, service_role;

drop trigger if exists kontrol_plano_da_proposta_aprovada on public.orcamento_final_versoes;
create trigger kontrol_plano_da_proposta_aprovada
  after update of status on public.orcamento_final_versoes
  for each row
  when (new.status = 'aprovado' and old.status is distinct from 'aprovado')
  execute function kontrol_private.gerar_plano_da_versao_aprovada();

-- ---- 2. Quem retirou / movimentou ------------------------------------------
alter table public.estoque_movimentacoes
  add column if not exists usuario text;

comment on column public.estoque_movimentacoes.usuario is
  'Quem executou a movimentação (e-mail da sessão). Na saída, é quem retirou o material (0122).';

create or replace function kontrol_private.preencher_usuario_movimentacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claims jsonb;
begin
  if new.usuario is null then
    begin
      v_claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
    exception when others then
      v_claims := null;
    end;
    new.usuario := coalesce(
      nullif(v_claims ->> 'email', ''),
      nullif(v_claims ->> 'sub', ''),
      nullif(current_setting('app.usuario', true), '')
    );
  end if;
  return new;
end $$;

revoke all on function kontrol_private.preencher_usuario_movimentacao()
  from public, anon, authenticated, service_role;

drop trigger if exists kontrol_movimentacao_usuario on public.estoque_movimentacoes;
create trigger kontrol_movimentacao_usuario
  before insert on public.estoque_movimentacoes
  for each row execute function kontrol_private.preencher_usuario_movimentacao();

commit;
