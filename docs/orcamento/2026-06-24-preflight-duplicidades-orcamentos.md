# Preflight de duplicidades e inconsistências — Orçamentos (Entrega A / Fase 3)

Data: 2026-06-24
Script: [`scripts/sql/preflight-orcamentos-duplicidades.sql`](../../scripts/sql/preflight-orcamentos-duplicidades.sql)
Teste de read-only: [`scripts/sql/verify-preflight-readonly.mjs`](../../scripts/sql/verify-preflight-readonly.mjs)

> **A limpeza/deduplicação AINDA NÃO foi executada.** Esta entrega é apenas o
> inventário **somente-leitura**. Nenhum dado foi criado, alterado ou removido.
> Nenhuma migration destrutiva foi aplicada. Nenhum `DELETE` foi executado.
> Produção não foi tocada. A estratégia de deduplicação será proposta **depois**
> da execução do preflight contra a base de homologação/produção e da sua
> aprovação.

## Como o script é seguro (somente-leitura)

- Todo o conteúdo executável roda dentro de **uma transação `READ ONLY`** que
  termina em **`ROLLBACK`** (`begin; set transaction read only; … rollback;`).
- Não há `INSERT/UPDATE/DELETE/TRUNCATE/DROP/ALTER/CREATE/GRANT/COMMIT`.
- O teste local `node scripts/sql/verify-preflight-readonly.mjs` remove comentários
  e literais e **falha** se qualquer verbo de escrita/DDL aparecer, ou se faltar
  o guard-rail de transação read-only. Resultado atual: **✓ aprovado**.

## Como executar

```bash
# Ver todos os result sets (recomendado):
psql "$DATABASE_URL" -f scripts/sql/preflight-orcamentos-duplicidades.sql

# Comprovar que é somente-leitura, sem banco:
node scripts/sql/verify-preflight-readonly.mjs
```

No **Supabase SQL Editor** (mostra só o último result set): rode o bloco
**RESUMO** primeiro e, depois, cada consulta de **DETALHE** individualmente
(estão comentadas no fim do arquivo).

> Observação de cliente: o operador JSON `?` (usado em `snapshot ? 'consolidado'`)
> pode ser interpretado como placeholder por alguns drivers. Em `psql` funciona;
> em drivers que tratam `?`, escapar como `??` ou rodar a consulta A14 via editor.

## Esquema de referência

Migrations `0007/0010/0011/0013/0033/0035/0037/0038/0039/0040/0041`.
"Módulo ativo" = `status <> 'cancelado'` (no laboratório, também
`status_operacional <> 'cancelado'`). "Versão vigente" = `status = 'emitido'`.

---

## Verificações, risco e ação recomendada

| ID | Verificação | Severidade | Risco | Ação recomendada (na limpeza — Fase 3, ainda não executada) |
|----|-------------|-----------|-------|-------------------------------------------------------------|
| **A1** | Demandas com **>1 orçamento laboratorial ativo** | ALTA | Dupla contagem de análises e ambiguidade de qual módulo é canônico | Eleger o módulo canônico pela ordem (referenciado por versão final → aprovado/revisado → mais completo → mais itens → mais recente); remapear referências; cancelar/arquivar os demais. Depois, proteção: 1 módulo lab ativo por demanda |
| **A2** | Demandas com **>1 orçamento de projeto ativo** | ALTA | Idem A1 no projeto | Idem A1; proteção: 1 módulo de projeto ativo por demanda |
| **A3** | **Análises repetidas no mesmo orçamento** laboratorial (`orcamento_id, codigo_analise`) | ALTA | Soma inflada; mesma análise contada N vezes | Consolidar linhas duplicadas (somar `n_amostras` na linha canônica); proteção: 1 `codigo_analise` por orçamento |
| **A4** | Mesma análise **duplicada entre laboratório e análises-de-projeto** na mesma demanda | ALTA | Dupla contagem entre as duas fontes (ver Fase 4 — fonte canônica) | Definir fonte canônica (`orcamentos`/`orcamento_itens`); mover/remover a duplicata na fonte legada; proteção via adapter de leitura legada |
| **A5** | **Custos de catálogo repetidos** no mesmo orçamento de projeto (mesma `categoria`+`descricao`) | MÉDIA | Possível duplicidade de rubrica; pode ser legítimo (repetição intencional) | Revisar caso a caso; consolidar quando indevido; proteção: unicidade por projeto **salvo repetição explicitamente permitida** |
| **A6** | **Versões finais emitidas com módulos cancelados** no `snapshot` | ALTA | Total final inclui módulo que foi cancelado depois | **Não recalcular versões históricas**; sinalizar/anotar em auditoria; corrigir o fluxo de emissão (Fase 9) para travar módulos cancelados |
| **A7** | **Números de versão final duplicados** | ALTA | Numeração comercial ambígua | Deve ser **0** (protegido por `UNIQUE(numero)`); se aparecer, investigar bypass de constraint |
| **A8** | **>1 versão vigente (emitida)** por demanda | ALTA | Duas propostas "válidas" simultâneas para a mesma demanda | Manter a mais recente como `emitido`; marcar anteriores como `substituido` (não apagar); proteção: 1 vigente por demanda |
| **A9** | **Parâmetros aplicados duplicados** por versão final | ALTA | Snapshot econômico ambíguo da mesma versão | Eleger o registro consistente com `total_final` da versão; arquivar duplicatas; registrar decisão em log |
| **A10** | **Registros órfãos** (módulos sem demanda; parâmetros sem versão/demanda) | MÉDIA | Dados fora do fluxo da proposta; ruído em relatórios | Revisar: vincular à demanda correta ou arquivar; **não** `DELETE` sem backup/relatório e comprovação de ausência de dependências |
| **A11** | **Modalidades legadas e canônica coexistindo** | MÉDIA | Inconsistência de modalidade entre linhas | Normalizar legadas → `projeto_com_analises` via migration **0041** (aditiva, já entregue no PR #4); código já trata legadas == canônica |
| **A12** | **Status incompatíveis** (demanda `orcada` sem módulo; `aprovada` sem versão; versão emitida em demanda `cancelada`) | ALTA | Estado do funil não reflete a realidade | Reconciliar status conforme regra de ciclo de vida (Fase 8); registrar em auditoria |
| **A13** | **Itens com custo ≤ 0 sem justificativa** | MÉDIA | Emissão com preço/custo zerado sem aprovação (ver Fase 7) | Exigir flag de isenção + justificativa + responsável + aprovação (Fase 7); por ora, sinalizar na etapa |
| **A14** | **Total final que não reconcilia** com `snapshot.consolidado.totalFinal` | ALTA | Página/PDF/banco divergem do snapshot | Investigar a engine (Fase 6 — `DEC-ORC-001`); **não** reescrever snapshots históricos; corrigir o cálculo no fluxo novo |
| **A15** | **Conflito de numeração de migrations** (ledger aplicado + repositório) | ALTA | Migrations com mesmo prefixo (ex.: **0041**) podem colidir na aplicação | Renumerar antes de integrar: a `0041` desta linha de trabalho colide com a `0041–0051` projetadas em outra branch (ver abaixo) |

### Detalhe do A15 (numeração 0041)

- **Repositório:** a migration `0041_modalidade_projeto_com_analises.sql` (PR #4)
  ocupa o número **0041**. Há, em outra branch não mesclada, migrations
  **0041–0051** projetadas (cadastros/integridade). Como ambas partem do mesmo
  `0040`, há **colisão de prefixo** ao integrar. **Ação:** renumerar uma das
  séries no momento da integração (decisão de ordem de merge), preservando o
  conteúdo. O preflight A15 consulta `supabase_migrations.schema_migrations` para
  detectar prefixos duplicados **já aplicados** no banco-alvo.

---

## Procedimento ANTES de qualquer limpeza (Fase 3)

A limpeza só ocorrerá após aprovação e seguindo, nesta ordem:

1. **Backup lógico** das tabelas relacionadas (`pg_dump` das tabelas do módulo).
2. **Exportar** as tabelas relacionadas (CSV/dump) e **registrar contagem de linhas**.
3. **Não modificar a base se o backup falhar.**
4. Eleger o registro canônico pela ordem: referenciado por versão final →
   aprovado/revisado → mais completo → mais itens válidos → mais recente (desempate).
5. **Remapear referências antes** de cancelar/arquivar duplicados.
6. **Não recalcular versões finais históricas.**
7. Registrar **cada decisão** de deduplicação em auditoria/tabela de log.
8. Criar as **proteções de unicidade** (constraints) só **depois** de zerar as duplicidades.
9. **Reexecutar o preflight** e comprovar duplicidades tratadas = 0.

## Próximos passos

- Rodar o preflight contra homologação/produção (somente-leitura) e **anexar o
  resultado** (RESUMO + detalhes) a este documento.
- Com os números reais, **propor a estratégia de deduplicação** (registro canônico,
  remapeamentos, log de auditoria, migrations aditivas de proteção e rollback).
- **Só então**, com aprovação, executar a limpeza — fora desta entrega.

## Limitações conhecidas desta entrega

- Não foi possível executar o preflight contra um banco real a partir deste
  ambiente (sem credenciais Supabase). O script foi validado **estaticamente** e
  pelo teste de read-only; a validação contra dados reais depende de acesso.
- A14 compara `total_final` com `snapshot.consolidado.totalFinal`; reconciliações
  mais profundas (item a item) entram na Fase 6/validação financeira.
