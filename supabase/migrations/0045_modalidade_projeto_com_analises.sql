-- =====================================================================
-- Modalidade canônica `projeto_com_analises`.
--
-- Migration ADITIVA e reversível. Objetivo:
--   1. ampliar o check de `demandas_propostas.modalidade` para aceitar a forma
--      canônica `projeto_com_analises` (mantendo as legadas durante a transição);
--   2. normalizar (backfill) as linhas legadas `analises_projeto` e
--      `projeto_analises_custos` para `projeto_com_analises`.
--
-- NÃO remove colunas, NÃO apaga histórico, NÃO altera auditoria. As modalidades
-- legadas continuam aceitas pelo check para permitir rollback seguro e leitura
-- de snapshots antigos. O código já trata legadas == canônica
-- (src/lib/orcamento/orcamento-economico.ts).
--
-- ORDEM DE ROLLOUT: aplicar esta migration ANTES de habilitar a escrita da
-- forma canônica pela UI (select de modalidade), caso contrário o INSERT/UPDATE
-- com `projeto_com_analises` é rejeitado pelo check anterior.
--
-- Pré-checagem (read-only) recomendada antes de aplicar:
--   select modalidade, count(*) from demandas_propostas group by modalidade;
--
-- ---------------------------------------------------------------------
-- ROLLBACK (manual, documentado — sem arquivo `down` por convenção do repo):
--   -- 1. (opcional) reverter o backfill para uma forma legada única:
--   update demandas_propostas set modalidade = 'projeto_analises_custos'
--     where modalidade = 'projeto_com_analises';
--   -- 2. restaurar o check original:
--   alter table demandas_propostas drop constraint if exists demandas_propostas_modalidade_check;
--   alter table demandas_propostas add constraint demandas_propostas_modalidade_check
--     check (modalidade in ('analises','projeto','analises_projeto','projeto_analises_custos'));
--   Observação: o passo 1 é lossy (une as duas formas legadas); só execute se
--   necessário e após backup lógico.
-- =====================================================================

-- 1. Ampliar o check aceitando a forma canônica (legadas mantidas na transição).
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

-- 2. Backfill idempotente das modalidades legadas para a canônica.
update demandas_propostas
   set modalidade = 'projeto_com_analises'
 where modalidade in ('analises_projeto', 'projeto_analises_custos');
