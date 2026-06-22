-- Rollback funcional da migration 0044.
--
-- Nao remove colunas `valor_snapshot` nem dados historicos. Em caso de
-- necessidade, este rollback retira apenas protecoes/indices adicionados pela
-- 0044 e restaura a aceitacao dos valores legados/canonicos de modalidade.

drop index if exists idx_orcamento_itens_orcamento_codigo_unique;
drop index if exists idx_orcamento_projeto_analises_codigo_unique;
drop index if exists idx_orcamento_projeto_custos_catalogo_unique;
drop index if exists idx_orcamentos_demanda_laboratorio_ativo_unique;
drop index if exists idx_orcamento_projetos_demanda_ativo_unique;

drop index if exists idx_orcamento_itens_orcamento_codigo_lookup;
drop index if exists idx_orcamento_projeto_analises_codigo_lookup;
drop index if exists idx_orcamento_projeto_custos_catalogo_lookup;
drop index if exists idx_orcamentos_demanda_laboratorio_ativo_lookup;
drop index if exists idx_orcamento_projetos_demanda_ativo_lookup;

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
