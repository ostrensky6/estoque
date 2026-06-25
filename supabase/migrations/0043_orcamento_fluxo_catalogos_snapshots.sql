-- Fluxo integrado de orcamento: modalidades canonicas, snapshots de catalogo
-- e protecoes contra duplicidade de selecao.
--
-- Migration aditiva: nao remove dados, nao remove RLS, nao remove triggers e
-- preserva valores legados de modalidade.

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

create unique index if not exists idx_orcamento_itens_orcamento_codigo_unique
  on orcamento_itens (orcamento_id, codigo_analise);

create unique index if not exists idx_orcamento_projeto_analises_codigo_unique
  on orcamento_projeto_analises (orcamento_projeto_id, codigo_analise);

create unique index if not exists idx_orcamento_projeto_custos_catalogo_unique
  on orcamento_projeto_custos (orcamento_projeto_id, catalogo_item_id)
  where catalogo_item_id is not null;

create unique index if not exists idx_orcamentos_demanda_laboratorio_ativo_unique
  on orcamentos (demanda_id)
  where demanda_id is not null and coalesce(tipo, 'analises') = 'analises' and status <> 'cancelado';

create unique index if not exists idx_orcamento_projetos_demanda_ativo_unique
  on orcamento_projetos (demanda_id)
  where demanda_id is not null and status <> 'cancelado';
