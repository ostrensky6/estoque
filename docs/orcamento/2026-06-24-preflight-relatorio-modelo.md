# Relatório de preflight — Orçamentos (MODELO PARA PREENCHER)

> Preencha com os resultados **reais** da execução do preflight. Não altere dados
> para preencher isto — é só leitura. Veja como rodar em
> [`2026-06-24-preflight-instrucoes-execucao.md`](2026-06-24-preflight-instrucoes-execucao.md).

## Identificação da execução

| Campo | Valor |
|---|---|
| Ambiente | ( ) homologação ( ) produção |
| Data/hora | `____-__-__ __:__` |
| Executado por | `__________` |
| Como rodou | ( ) Supabase SQL Editor ( ) psql |
| Arquivo | `scripts/sql/preflight-orcamentos-duplicidades.sql` |
| Confirmou `transaction_read_only = on`? | ( ) sim ( ) não |
| Terminou em `ROLLBACK` (sem `COMMIT`)? | ( ) sim ( ) não |

## Contagens antes/depois (prova de que nada mudou)

| Tabela | Linhas ANTES | Linhas DEPOIS | Iguais? |
|---|---:|---:|:--:|
| orcamentos | | | |
| orcamento_itens | | | |
| orcamento_projetos | | | |
| orcamento_projeto_custos | | | |
| orcamento_projeto_analises | | | |
| orcamento_final_versoes | | | |
| orcamento_parametros_aplicados | | | |
| demandas_propostas | | | |

## RESUMO (cole a saída A1…A14)

| ID | Severidade | Descrição | Ocorrências |
|----|-----------|-----------|------------:|
| A1 | ALTA | demandas com >1 orçamento laboratorial ativo | |
| A2 | ALTA | demandas com >1 orçamento de projeto ativo | |
| A3 | ALTA | análises repetidas no mesmo orçamento laboratorial | |
| A4 | ALTA | mesma análise duplicada entre laboratório e análises-de-projeto | |
| A5 | MÉDIA | custos de catálogo repetidos no mesmo orçamento de projeto | |
| A6 | ALTA | versões finais emitidas com módulos cancelados no snapshot | |
| A7 | ALTA | números de versão final duplicados (deve ser 0) | |
| A8 | ALTA | mais de uma versão vigente (emitida) por demanda | |
| A9 | ALTA | parâmetros aplicados duplicados por versão final | |
| A10 | MÉDIA | registros órfãos | |
| A11 | MÉDIA | modalidades legadas e canônica coexistindo | |
| A12 | ALTA | status incompatíveis (demanda/módulos/proposta) | |
| A13 | MÉDIA | itens com custo zero sem justificativa | |
| A14 | ALTA | total final que não reconcilia com o snapshot | |

---

## DETALHES por seção

> Preencha **apenas** as seções com `ocorrências > 0` no resumo. Cole a saída da
> consulta de DETALHE correspondente (ids/linhas ofensoras). Onde houver decisão a
> tomar, anote sua observação.

### 1. Duplicidades de orçamento laboratorial (A1)
- Ocorrências: `__`
- Demandas afetadas (`demanda_id` → orçamentos):
  ```
  (cole aqui)
  ```
- Observações:

### 2. Duplicidades de orçamento de projeto (A2)
- Ocorrências: `__`
- Demandas afetadas:
  ```
  (cole aqui)
  ```
- Observações:

### 3. Análises repetidas no mesmo orçamento (A3)
- Ocorrências: `__`
- `(orcamento_id, codigo_analise)` → itens:
  ```
  (cole aqui)
  ```
- Observações:

### 4. Duplicidade laboratório × análises de projeto (A4)
- Ocorrências: `__`
- `(demanda_id, codigo_analise)`:
  ```
  (cole aqui)
  ```
- Observações:

### 5. Custos de catálogo repetidos (A5)
- Ocorrências: `__`
- `(orcamento_projeto_id, categoria, descricao_norm)` → custos:
  ```
  (cole aqui)
  ```
- Repetição é legítima? (sim/não por caso):

### 6. Versões finais inconsistentes (A6, A7, A8)
- A6 (emitidas com módulos cancelados): `__`
  ```
  (cole aqui)
  ```
- A7 (números duplicados — esperado 0): `__`
  ```
  (cole aqui)
  ```
- A8 (>1 versão vigente por demanda): `__`
  ```
  (cole aqui)
  ```
- Observações:

### 7. Parâmetros aplicados duplicados (A9)
- Ocorrências: `__`
- `orcamento_final_versao_id` → registros:
  ```
  (cole aqui)
  ```
- Observações:

### 8. Registros órfãos (A10)
- Ocorrências: `__`
- Origem/ids:
  ```
  (cole aqui)
  ```
- Observações:

### 9. Modalidades legadas (A11)
- Coexistem legadas + canônica? (sim/não): `__`
- Distribuição por `modalidade`:
  ```
  (cole aqui)
  ```
- Observações:

### 10. Status incompatíveis (A12)
- Ocorrências: `__`
- Casos (`orcada_sem_modulo` / `aprovada_sem_versao` / `versao_em_demanda_cancelada`):
  ```
  (cole aqui)
  ```
- Observações:

### 11. Itens com custo zero (A13)
- Ocorrências: `__`
- Origem/ids (`lab_item` / `proj_analise` / `proj_custo`):
  ```
  (cole aqui)
  ```
- Observações:

### 12. Divergência entre total final e snapshot (A14)
- Ocorrências: `__`
- `(id, numero, total_final, total_snapshot, diferenca)`:
  ```
  (cole aqui)
  ```
- Observações:

### 13. Conflito de migrations (A15)
- Prefixos duplicados em `schema_migrations`:
  ```
  (cole aqui)
  ```
- Nota: no repositório, a migration de modalidade foi renumerada `0041 → 0045`
  (resolvido no PR #4). Confirmar se o banco-alvo já tem algum `0041..0044`
  aplicado de outra branch.

---

## Conclusão do operador

- Severidade geral observada: ( ) sem duplicidades ( ) baixa ( ) média ( ) alta
- Pode prosseguir para a proposta de deduplicação? ( ) sim ( ) não
- Comentários finais:
