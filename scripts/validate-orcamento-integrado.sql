-- Validacao pos-migration do fluxo integrado de orcamentos.
-- Deve retornar zero linhas nas consultas de duplicidade.

select 'orcamento_itens_duplicados' as check_name, orcamento_id, codigo_analise, count(*) as total
  from orcamento_itens
 group by orcamento_id, codigo_analise
having count(*) > 1;

select 'orcamento_projeto_analises_duplicadas' as check_name, orcamento_projeto_id, codigo_analise, count(*) as total
  from orcamento_projeto_analises
 group by orcamento_projeto_id, codigo_analise
having count(*) > 1;

select 'orcamento_projeto_catalogo_duplicado' as check_name, orcamento_projeto_id, catalogo_item_id, count(*) as total
  from orcamento_projeto_custos
 where catalogo_item_id is not null
 group by orcamento_projeto_id, catalogo_item_id
having count(*) > 1;

select 'orcamentos_laboratorio_ativos_duplicados' as check_name, demanda_id, count(*) as total
  from orcamentos
 where demanda_id is not null
   and coalesce(tipo, 'analises') = 'analises'
   and status <> 'cancelado'
 group by demanda_id
having count(*) > 1;

select 'orcamento_projetos_ativos_duplicados' as check_name, demanda_id, count(*) as total
  from orcamento_projetos
 where demanda_id is not null
   and status <> 'cancelado'
 group by demanda_id
having count(*) > 1;

select 'snapshot_columns' as check_name, table_name, column_name
  from information_schema.columns
 where table_schema = 'public'
   and table_name in ('orcamento_itens', 'orcamento_projeto_analises', 'orcamento_projeto_custos')
   and column_name = 'valor_snapshot'
 order by table_name;

select 'modalidades_fora_do_mapa' as check_name, modalidade, count(*) as total
  from demandas_propostas
 where modalidade not in ('analises','projeto','analises_projeto','projeto_analises_custos','projeto_com_analises')
 group by modalidade;
