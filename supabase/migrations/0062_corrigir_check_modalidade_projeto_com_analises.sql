-- Garante que a modalidade canonica usada pela UI seja aceita pelo banco.
alter table demandas_propostas
  drop constraint if exists demandas_propostas_modalidade_check;

alter table demandas_propostas
  add constraint demandas_propostas_modalidade_check
  check (modalidade in (
    'analises',
    'projeto',
    'projeto_com_analises',
    'analises_projeto',
    'projeto_analises_custos'
  ));

update demandas_propostas
   set modalidade = 'projeto_com_analises'
 where modalidade in ('analises_projeto', 'projeto_analises_custos');
