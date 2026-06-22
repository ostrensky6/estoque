-- =====================================================================
-- PREFLIGHT DE INTEGRIDADE DOS CADASTROS DO CUSTEIO  (SOMENTE LEITURA)
-- =====================================================================
--
-- Objetivo: auditar, sobre os DADOS REAIS, as inconsistências que o
-- validador (`src/lib/cadastros/validar-integridade.ts`) classifica e que as
-- migrações aditivas (0041+) pretendem endereçar — ANTES de qualquer migração.
--
-- Garantias:
--   * 100% somente leitura — a sessão é aberta como READ ONLY e termina em
--     ROLLBACK. Nenhuma linha é alterada.
--   * Sem dependência de extensões (não usa `unaccent`): a normalização de
--     acentos é aproximada via translate(), espelhando `chaveComparacao`.
--
-- Uso:
--   psql "$DB_URL" -f scripts/sql/preflight-integridade-cadastros.sql
--
-- A saída tem duas partes:
--   (A) RESUMO — uma linha por verificação, com a contagem.
--   (B) DETALHE — listagens dos registros que exigem correção manual.
-- =====================================================================

\set ON_ERROR_STOP on
BEGIN;
SET TRANSACTION READ ONLY;

-- Expressão de chave de comparação (case/acento/espaço-insensível), portável.
-- Mantém-se como subconsulta inline; o Postgres não tem `unaccent` aqui.
-- translate cobre os acentos do pt-BR; lower+regexp colapsa caixa/espaços.

-- ---------------------------------------------------------------------
-- (A) RESUMO
-- ---------------------------------------------------------------------
\echo '==================== RESUMO ===================='

WITH
chk AS (
  SELECT '01 codigos de analise com diferenca de caixa' AS verificacao,
         (SELECT count(*) FROM (
            SELECT lower(codigo) k FROM analises GROUP BY lower(codigo) HAVING count(*) > 1
          ) x) AS qtd
  UNION ALL
  SELECT '02 textos com espacos iniciais/finais',
         (SELECT
            (SELECT count(*) FROM analises WHERE nome IS DISTINCT FROM btrim(nome))
          + (SELECT count(*) FROM etapas WHERE nome_etapa IS DISTINCT FROM btrim(nome_etapa)
                                            OR nome_atividade IS DISTINCT FROM btrim(nome_atividade))
          + (SELECT count(*) FROM insumo_analise WHERE especificacao_insumo IS DISTINCT FROM btrim(especificacao_insumo)
                                            OR grupo_escolha IS DISTINCT FROM btrim(grupo_escolha))
          + (SELECT count(*) FROM insumos WHERE especificacao IS DISTINCT FROM btrim(especificacao))
          + (SELECT count(*) FROM equipamentos WHERE nome IS DISTINCT FROM btrim(nome)))
  UNION ALL
  SELECT '03 etapas duplicadas (codigo+etapa+atividade)',
         (SELECT count(*) FROM (
            SELECT codigo_analise, lower(btrim(nome_etapa)) e, lower(btrim(nome_atividade)) a
              FROM etapas GROUP BY 1,2,3 HAVING count(*) > 1
          ) x)
  UNION ALL
  SELECT '04 insumo_analise sem insumo_id',
         (SELECT count(*) FROM insumo_analise WHERE insumo_id IS NULL)
  UNION ALL
  SELECT '05 insumos sem custo (custo_unitario nulo/zero)',
         (SELECT count(*) FROM insumos WHERE custo_unitario IS NULL OR custo_unitario <= 0)
  UNION ALL
  SELECT '05b insumo_analise vinculado a insumo sem custo',
         (SELECT count(*) FROM insumo_analise ia JOIN insumos i ON i.id = ia.insumo_id
            WHERE i.custo_unitario IS NULL OR i.custo_unitario <= 0)
  UNION ALL
  SELECT '06 insumo_analise com quantidade nula ou zero',
         (SELECT count(*) FROM insumo_analise WHERE quantidade_por_amostra IS NULL OR quantidade_por_amostra = 0)
  UNION ALL
  SELECT '07 modo_cobranca nulo ou invalido',
         (SELECT count(*) FROM insumo_analise
            WHERE modo_cobranca IS NULL OR modo_cobranca NOT IN ('por_amostra','por_execucao'))
  UNION ALL
  SELECT '08 grupos de escolha duplicados apos normalizacao',
         (SELECT count(*) FROM (
            SELECT codigo_analise,
                   lower(translate(btrim(grupo_escolha),
                     'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
                     'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')) AS chave,
                   count(DISTINCT grupo_escolha) AS variacoes
              FROM insumo_analise
             WHERE grupo_escolha IS NOT NULL AND btrim(grupo_escolha) <> ''
             GROUP BY 1,2
            HAVING count(DISTINCT grupo_escolha) > 1
          ) x)
  UNION ALL
  SELECT '09 vinculos ambiguos insumo_analise -> etapas (>1 etapa)',
         (SELECT count(*) FROM insumo_analise ia
            WHERE (SELECT count(*) FROM etapas e
                     WHERE e.codigo_analise = ia.codigo_analise
                       AND lower(btrim(e.nome_etapa)) = lower(btrim(ia.nome_etapa))
                       AND lower(btrim(e.nome_atividade)) = lower(btrim(ia.nome_atividade))) > 1)
  UNION ALL
  SELECT '09b insumo_analise sem etapa correspondente (0 etapas)',
         (SELECT count(*) FROM insumo_analise ia
            WHERE ia.nome_etapa IS NOT NULL
              AND (SELECT count(*) FROM etapas e
                     WHERE e.codigo_analise = ia.codigo_analise
                       AND lower(btrim(e.nome_etapa)) = lower(btrim(ia.nome_etapa))
                       AND lower(btrim(e.nome_atividade)) = lower(btrim(ia.nome_atividade))) = 0)
  UNION ALL
  SELECT '10 equipamentos sem custo ou vida util',
         (SELECT count(*) FROM equipamentos
            WHERE custo_unitario IS NULL OR custo_unitario <= 0
               OR vida_util_anos IS NULL OR vida_util_anos <= 0)
  UNION ALL
  SELECT '11 equipamentos nao possuidos e ainda alocados',
         (SELECT count(DISTINCT e.id) FROM equipamentos e
            JOIN equipamento_analise ea ON ea.equipamento_id = e.id
           WHERE e.possui IS NOT TRUE)
  UNION ALL
  SELECT '12 pesos de alocacao invalidos (nulo/<0)',
         (SELECT count(*) FROM equipamento_analise WHERE peso_alocacao IS NULL OR peso_alocacao < 0)
  UNION ALL
  SELECT '13 etapas sem produtividade ou tempo',
         (SELECT count(*) FROM etapas
            WHERE execucoes_por_dia IS NULL OR execucoes_por_dia <= 0
               OR amostras_por_execucao IS NULL OR amostras_por_execucao <= 0
               OR (tempo_bancada_h IS NULL AND tempo_maquina_h IS NULL))
  UNION ALL
  SELECT '14a tecnicos sem dados suficientes',
         (SELECT count(*) FROM tecnicos
            WHERE valor_mes IS NULL OR valor_mes <= 0
               OR horas_mes_base IS NULL OR horas_mes_base <= 0
               OR percentual_dedicado IS NULL OR percentual_dedicado <= 0)
  UNION ALL
  SELECT '14b overhead sem dados suficientes',
         (SELECT count(*) FROM overhead
            WHERE custo_mensal IS NULL OR custo_mensal <= 0
               OR horas_bancada_mes IS NULL OR horas_bancada_mes <= 0
               OR percentual_compensada IS NULL OR percentual_compensada <= 0)
)
SELECT verificacao, qtd FROM chk ORDER BY verificacao;

-- ---------------------------------------------------------------------
-- (B) DETALHE — registros que exigem correção manual
-- ---------------------------------------------------------------------
\echo ''
\echo '==================== DETALHE ===================='

\echo '-- 01 codigos de analise com diferenca de caixa'
SELECT lower(codigo) AS chave, array_agg(codigo ORDER BY codigo) AS variacoes
  FROM analises GROUP BY lower(codigo) HAVING count(*) > 1;

\echo '-- 03 etapas duplicadas'
SELECT codigo_analise, btrim(nome_etapa) AS etapa, btrim(nome_atividade) AS atividade, count(*) AS n
  FROM etapas GROUP BY codigo_analise, lower(btrim(nome_etapa)), lower(btrim(nome_atividade)), 2, 3
 HAVING count(*) > 1 ORDER BY codigo_analise;

\echo '-- 04 insumo_analise sem insumo_id (custo indeterminado -> BLOQUEIO)'
SELECT id, codigo_analise, especificacao_insumo, nome_etapa, nome_atividade
  FROM insumo_analise WHERE insumo_id IS NULL ORDER BY codigo_analise, id;

\echo '-- 05b insumo_analise vinculado a insumo sem custo (-> BLOQUEIO)'
SELECT ia.id, ia.codigo_analise, ia.especificacao_insumo, i.id AS insumo_id, i.custo_unitario
  FROM insumo_analise ia JOIN insumos i ON i.id = ia.insumo_id
 WHERE i.custo_unitario IS NULL OR i.custo_unitario <= 0
 ORDER BY ia.codigo_analise, ia.id;

\echo '-- 06 quantidade nula/zero'
SELECT id, codigo_analise, especificacao_insumo, quantidade_por_amostra
  FROM insumo_analise WHERE quantidade_por_amostra IS NULL OR quantidade_por_amostra = 0
 ORDER BY codigo_analise, id;

\echo '-- 07 modo_cobranca nulo/invalido (-> BLOQUEIO)'
SELECT id, codigo_analise, especificacao_insumo, modo_cobranca
  FROM insumo_analise WHERE modo_cobranca IS NULL OR modo_cobranca NOT IN ('por_amostra','por_execucao')
 ORDER BY codigo_analise, id;

\echo '-- 08 grupos de escolha duplicados por caixa/acento/espaco'
SELECT codigo_analise,
       lower(translate(btrim(grupo_escolha),
         'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
         'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')) AS chave,
       array_agg(DISTINCT grupo_escolha) AS variacoes
  FROM insumo_analise
 WHERE grupo_escolha IS NOT NULL AND btrim(grupo_escolha) <> ''
 GROUP BY 1,2 HAVING count(DISTINCT grupo_escolha) > 1
 ORDER BY codigo_analise;

\echo '-- 09 vinculos ambiguos (insumo_analise casa com >1 etapa)'
SELECT ia.id, ia.codigo_analise, ia.nome_etapa, ia.nome_atividade,
       (SELECT count(*) FROM etapas e
          WHERE e.codigo_analise = ia.codigo_analise
            AND lower(btrim(e.nome_etapa)) = lower(btrim(ia.nome_etapa))
            AND lower(btrim(e.nome_atividade)) = lower(btrim(ia.nome_atividade))) AS etapas_casadas
  FROM insumo_analise ia
 WHERE (SELECT count(*) FROM etapas e
          WHERE e.codigo_analise = ia.codigo_analise
            AND lower(btrim(e.nome_etapa)) = lower(btrim(ia.nome_etapa))
            AND lower(btrim(e.nome_atividade)) = lower(btrim(ia.nome_atividade))) > 1
 ORDER BY ia.codigo_analise, ia.id;

\echo '-- 10 equipamentos sem custo/vida util'
SELECT id, nome, custo_unitario, vida_util_anos, possui
  FROM equipamentos WHERE custo_unitario IS NULL OR custo_unitario <= 0
     OR vida_util_anos IS NULL OR vida_util_anos <= 0 ORDER BY nome;

\echo '-- 11 equipamentos nao possuidos e alocados'
SELECT e.id, e.nome, e.possui, count(ea.id) AS alocacoes
  FROM equipamentos e JOIN equipamento_analise ea ON ea.equipamento_id = e.id
 WHERE e.possui IS NOT TRUE GROUP BY e.id, e.nome, e.possui ORDER BY e.nome;

\echo '-- 12 pesos de alocacao invalidos'
SELECT id, equipamento_id, codigo_analise, peso_alocacao
  FROM equipamento_analise WHERE peso_alocacao IS NULL OR peso_alocacao < 0 ORDER BY codigo_analise;

\echo '-- 13 etapas sem produtividade/tempo (amostra)'
SELECT id, codigo_analise, nome_etapa, nome_atividade,
       execucoes_por_dia, amostras_por_execucao, tempo_bancada_h, tempo_maquina_h
  FROM etapas
 WHERE execucoes_por_dia IS NULL OR execucoes_por_dia <= 0
    OR amostras_por_execucao IS NULL OR amostras_por_execucao <= 0
    OR (tempo_bancada_h IS NULL AND tempo_maquina_h IS NULL)
 ORDER BY codigo_analise, id
 LIMIT 200;

\echo '-- 14a tecnicos sem dados suficientes'
SELECT id, nome, valor_mes, horas_mes_base, percentual_dedicado
  FROM tecnicos WHERE valor_mes IS NULL OR valor_mes <= 0
     OR horas_mes_base IS NULL OR horas_mes_base <= 0
     OR percentual_dedicado IS NULL OR percentual_dedicado <= 0 ORDER BY nome;

\echo '-- 14b overhead sem dados suficientes'
SELECT id, item, custo_mensal, horas_bancada_mes, percentual_compensada
  FROM overhead WHERE custo_mensal IS NULL OR custo_mensal <= 0
     OR horas_bancada_mes IS NULL OR horas_bancada_mes <= 0
     OR percentual_compensada IS NULL OR percentual_compensada <= 0 ORDER BY item;

ROLLBACK;
-- Fim. Nenhuma alteração foi persistida (transação READ ONLY + ROLLBACK).
