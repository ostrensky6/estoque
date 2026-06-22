-- Fluxo integrado de orcamento: modalidades canonicas, snapshots de catalogo
-- e protecoes contra duplicidade de selecao.
--
-- Migration incremental: nao remove tabelas, dados, RLS ou triggers. As
-- constraints de modalidade sao recriadas apenas para ampliar valores aceitos
-- e preservar legados ja existentes.

alter table demandas_propostas
  drop constraint if exists demandas_propostas_modalidade_check,
  add constraint demandas_propostas_modalidade_check
    check (modalidade in (
      'analises',
      'projeto',
      'analises_projeto',
      'projeto_analises_custos',
      'projeto_com_analises'
    ));

alter table orcamentos
  drop constraint if exists orcamentos_tipo_check,
  add constraint orcamentos_tipo_check
    check (tipo in ('analises','projeto','analises_projeto','projeto_com_analises'));

alter table orcamento_itens
  add column if not exists valor_snapshot jsonb not null default '{}'::jsonb;

alter table orcamento_projeto_analises
  add column if not exists valor_snapshot jsonb not null default '{}'::jsonb;

alter table orcamento_projeto_custos
  add column if not exists valor_snapshot jsonb not null default '{}'::jsonb;

create index if not exists idx_orcamento_itens_orcamento_codigo_lookup
  on orcamento_itens (orcamento_id, codigo_analise);

create index if not exists idx_orcamento_projeto_analises_codigo_lookup
  on orcamento_projeto_analises (orcamento_projeto_id, codigo_analise);

create index if not exists idx_orcamento_projeto_custos_catalogo_lookup
  on orcamento_projeto_custos (orcamento_projeto_id, catalogo_item_id)
  where catalogo_item_id is not null;

create index if not exists idx_orcamentos_demanda_laboratorio_ativo_lookup
  on orcamentos (demanda_id)
  where demanda_id is not null and coalesce(tipo, 'analises') = 'analises' and status <> 'cancelado';

create index if not exists idx_orcamento_projetos_demanda_ativo_lookup
  on orcamento_projetos (demanda_id)
  where demanda_id is not null and status <> 'cancelado';

do $$
begin
  if not exists (
    select 1
      from orcamento_itens
     group by orcamento_id, codigo_analise
    having count(*) > 1
  ) then
    create unique index if not exists idx_orcamento_itens_orcamento_codigo_unique
      on orcamento_itens (orcamento_id, codigo_analise);
  else
    raise notice 'idx_orcamento_itens_orcamento_codigo_unique nao criado: ha duplicidades historicas.';
  end if;

  if not exists (
    select 1
      from orcamento_projeto_analises
     group by orcamento_projeto_id, codigo_analise
    having count(*) > 1
  ) then
    create unique index if not exists idx_orcamento_projeto_analises_codigo_unique
      on orcamento_projeto_analises (orcamento_projeto_id, codigo_analise);
  else
    raise notice 'idx_orcamento_projeto_analises_codigo_unique nao criado: ha duplicidades historicas.';
  end if;

  if not exists (
    select 1
      from orcamento_projeto_custos
     where catalogo_item_id is not null
     group by orcamento_projeto_id, catalogo_item_id
    having count(*) > 1
  ) then
    create unique index if not exists idx_orcamento_projeto_custos_catalogo_unique
      on orcamento_projeto_custos (orcamento_projeto_id, catalogo_item_id)
      where catalogo_item_id is not null;
  else
    raise notice 'idx_orcamento_projeto_custos_catalogo_unique nao criado: ha duplicidades historicas.';
  end if;

  if not exists (
    select 1
      from orcamentos
     where demanda_id is not null
       and coalesce(tipo, 'analises') = 'analises'
       and status <> 'cancelado'
     group by demanda_id
    having count(*) > 1
  ) then
    create unique index if not exists idx_orcamentos_demanda_laboratorio_ativo_unique
      on orcamentos (demanda_id)
      where demanda_id is not null and coalesce(tipo, 'analises') = 'analises' and status <> 'cancelado';
  else
    raise notice 'idx_orcamentos_demanda_laboratorio_ativo_unique nao criado: ha modulos laboratoriais ativos duplicados.';
  end if;

  if not exists (
    select 1
      from orcamento_projetos
     where demanda_id is not null
       and status <> 'cancelado'
     group by demanda_id
    having count(*) > 1
  ) then
    create unique index if not exists idx_orcamento_projetos_demanda_ativo_unique
      on orcamento_projetos (demanda_id)
      where demanda_id is not null and status <> 'cancelado';
  else
    raise notice 'idx_orcamento_projetos_demanda_ativo_unique nao criado: ha modulos de projeto ativos duplicados.';
  end if;
end $$;
