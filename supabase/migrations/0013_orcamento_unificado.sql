-- =====================================================================
-- Orçamento unificado: a entrada comercial passa a explicitar o escopo.
-- Migration aditiva, sem mover ou apagar dados existentes.
-- =====================================================================

alter table orcamentos
  add column tipo text not null default 'analises'
    check (tipo in ('analises','projeto','analises_projeto'));

update orcamentos
   set tipo = 'analises'
 where tipo is null;

create index if not exists idx_orcamentos_tipo on orcamentos (tipo);
