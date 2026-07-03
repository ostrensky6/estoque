-- Protecao ampla para restores/importacoes do modulo Orcamentos.
-- Depois de importar linhas com ids explicitos, sequences/identities podem ficar
-- atrasadas e causar duplicate key em inserts normais do app.
select setval(
  pg_get_serial_sequence('demandas_propostas', 'id'),
  greatest((select coalesce(max(id), 0) from demandas_propostas), 1),
  true
);

select setval(
  pg_get_serial_sequence('demanda_grupos_amostras', 'id'),
  greatest((select coalesce(max(id), 0) from demanda_grupos_amostras), 1),
  true
);

select setval(
  pg_get_serial_sequence('demanda_analises', 'id'),
  greatest((select coalesce(max(id), 0) from demanda_analises), 1),
  true
);

select setval(
  pg_get_serial_sequence('orcamentos', 'id'),
  greatest((select coalesce(max(id), 0) from orcamentos), 1),
  true
);

select setval(
  pg_get_serial_sequence('orcamento_itens', 'id'),
  greatest((select coalesce(max(id), 0) from orcamento_itens), 1),
  true
);
