-- Validade/fim de vida nos cadastros-base.
-- A data pode ser informada manualmente ou calculada pela aplicação a partir
-- da aquisição/fabricação e do prazo/vida útil quando houver dados suficientes.

alter table equipamentos
  add column if not exists data_validade date;

comment on column equipamentos.data_validade is
  'Data de fim de vida útil/validade operacional. Pode ser calculada por data_aquisicao + vida_util_anos ou preenchida manualmente.';

alter table insumos
  add column if not exists data_fabricacao date,
  add column if not exists validade_dias integer,
  add column if not exists data_validade date;

comment on column insumos.data_fabricacao is
  'Data de fabricação do material, quando conhecida.';
comment on column insumos.validade_dias is
  'Prazo de validade em dias a partir da fabricação ou, quando ausente, da aquisição.';
comment on column insumos.data_validade is
  'Data de validade do material. Pode ser calculada por data_fabricacao/data_aquisicao + validade_dias ou preenchida manualmente.';
