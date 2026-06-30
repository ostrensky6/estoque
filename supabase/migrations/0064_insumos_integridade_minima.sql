alter table public.insumos
  add column if not exists unidade_consumo text;

comment on column public.insumos.unidade is
  'Unidade fisica de estoque/compra do insumo.';

comment on column public.insumos.unidade_consumo is
  'Unidade usada nas receitas das analises para consumo planejado.';

comment on column public.insumos.fator_conversao is
  'Quantidade de unidades de consumo contidas em 1 unidade de estoque.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'insumos_quantidade_embalagem_positive'
  ) then
    alter table public.insumos
    add constraint insumos_quantidade_embalagem_positive
    check (quantidade_embalagem is null or quantidade_embalagem > 0)
    not valid;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'insumos_fator_conversao_positive'
  ) then
    alter table public.insumos
    add constraint insumos_fator_conversao_positive
    check (fator_conversao is null or fator_conversao > 0)
    not valid;
  end if;
end $$;
