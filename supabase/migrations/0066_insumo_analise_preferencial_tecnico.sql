alter table insumo_analise
  add column if not exists preferencial boolean not null default false;

create unique index if not exists insumo_analise_um_preferencial_por_grupo_idx
  on insumo_analise (codigo_analise, nullif(btrim(grupo_escolha), ''))
  where preferencial = true
    and nullif(btrim(grupo_escolha), '') is not null;
