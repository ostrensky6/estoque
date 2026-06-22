-- =====================================================================
-- 0042 — Vinculo insumo_analise.etapa_id -> etapas.id (ADITIVA)
--
-- Hoje o vinculo insumo<->etapa e feito por texto (nome_etapa, nome_atividade),
-- o que e ambiguo quando ha etapas duplicadas (ex.: Illumina_Sh tem duas
-- "Montagem de biblioteca / Qubit"). Esta migracao adiciona uma FK opcional e
-- preenche SOMENTE as correspondencias inequivocas (exatamente 1 etapa casa).
-- Os textos sao preservados como snapshot; vinculos ambiguos ficam sem
-- preenchimento e sao expostos numa VIEW de relatorio (nao escolhe arbitrario).
--
-- Rollback seguro: coluna/FK/indice aditivos; a VIEW pode ser dropada.
-- =====================================================================

alter table insumo_analise
  add column if not exists etapa_id bigint;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'insumo_analise_etapa_id_fkey'
  ) then
    alter table insumo_analise
      add constraint insumo_analise_etapa_id_fkey
      foreign key (etapa_id) references etapas(id) on delete set null;
  end if;
end $$;

create index if not exists insumo_analise_etapa_id_idx on insumo_analise (etapa_id);

-- Preenche apenas correspondencias INEQUIVOCAS: a (codigo_analise, nome_etapa,
-- nome_atividade) casa com exatamente UMA etapa. Comparacao case/space-insensivel.
update insumo_analise ia
   set etapa_id = e.id
  from etapas e
 where ia.etapa_id is null
   and e.codigo_analise = ia.codigo_analise
   and lower(btrim(e.nome_etapa)) = lower(btrim(coalesce(ia.nome_etapa, '')))
   and lower(btrim(e.nome_atividade)) = lower(btrim(coalesce(ia.nome_atividade, '')))
   and (
     select count(*) from etapas e2
      where e2.codigo_analise = ia.codigo_analise
        and lower(btrim(e2.nome_etapa)) = lower(btrim(coalesce(ia.nome_etapa, '')))
        and lower(btrim(e2.nome_atividade)) = lower(btrim(coalesce(ia.nome_atividade, '')))
   ) = 1;

-- Relatorio (somente leitura) de vinculos que NAO puderam ser resolvidos:
-- 0 etapas casadas (sem correspondencia) ou >1 (ambiguo). Para tratamento manual.
create or replace view vw_insumo_analise_etapa_ambiguos as
select
  ia.id,
  ia.codigo_analise,
  ia.nome_etapa,
  ia.nome_atividade,
  ia.especificacao_insumo,
  (
    select count(*) from etapas e
     where e.codigo_analise = ia.codigo_analise
       and lower(btrim(e.nome_etapa)) = lower(btrim(coalesce(ia.nome_etapa, '')))
       and lower(btrim(e.nome_atividade)) = lower(btrim(coalesce(ia.nome_atividade, '')))
  ) as etapas_casadas
from insumo_analise ia
where ia.etapa_id is null;

comment on view vw_insumo_analise_etapa_ambiguos is
  'Vinculos insumo_analise sem etapa_id resolvido (0 ou >1 etapas casadas) — exigem decisao manual.';

comment on column insumo_analise.etapa_id is
  'FK autoritativa para etapas.id. Textos nome_etapa/nome_atividade viram snapshot.';
