-- Protecao para restores/importacoes locais: garante que o proximo grupo de amostra
-- nao tente reutilizar um id ja existente.
select setval(
  pg_get_serial_sequence('demanda_grupos_amostras', 'id'),
  greatest((select coalesce(max(id), 0) from demanda_grupos_amostras), 1),
  true
);
