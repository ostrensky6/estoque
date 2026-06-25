# Diagnóstico do módulo Orçamentos — Fase 1 (auditoria antes de alterar)

Data: 2026-06-24
Branch base auditada: `claude/cranky-wright-a4bce4` (PR #3, tip `a730361`)
Autor: IA executora (Kontrol / Orçamentos)

> Este documento é o entregável obrigatório da **Fase 1** do plano de correção do
> módulo Orçamentos. Ele mapeia o estado real do código, migrations e testes
> **antes** de qualquer implementação, e define a ordem das entregas subsequentes.

---

## 1. Mapa de modalidades existentes

### 1.1 Modalidades em uso (strings reais)

| String | Origem | Significado |
|---|---|---|
| `analises` | DB + código | Apenas análises laboratoriais |
| `projeto` | DB + código | Apenas projeto |
| `analises_projeto` | DB + código (legado) | Análises dentro de projeto |
| `projeto_analises_custos` | DB + código (legado) | Projeto com custos próprios + análises |
| `projeto_com_analises` | **somente** `orcamento-economico.ts` (normalização em memória) | Forma **canônica** alvo para as duas anteriores |

### 1.2 Achado crítico — a modalidade canônica não é persistível

A modalidade canônica `projeto_com_analises`:

- **existe apenas** em `src/lib/orcamento/orcamento-economico.ts` (Sets + `normalizarModalidadeOrcamento`);
- **não** está no `check` da coluna `demandas_propostas.modalidade`
  (`supabase/migrations/0011_demandas_propostas.sql:20-25` só aceita
  `analises`, `projeto`, `analises_projeto`, `projeto_analises_custos`);
- **não** é reconhecida por 3 das 4 fontes de modalidade (ver §2).

Consequência: hoje o banco nunca grava `projeto_com_analises`; ela só aparece
após normalização em memória. Se a normalização passar a ser persistida sem o
`check` ser ampliado, o `INSERT/UPDATE` é **rejeitado pelo banco**. Por isso a
migração de normalização (Fase 2/3) **precisa primeiro** ampliar o `check`.

---

## 2. Helpers que determinam modalidade — QUATRO fontes duplicadas

| Arquivo | Helper/Set | Reconhece `projeto_com_analises`? | Autoritativo? |
|---|---|---|---|
| `src/lib/orcamento/orcamento-economico.ts` | `MODALIDADES_LABORATORIO`, `MODALIDADES_PROJETO`, `modalidadeExigeLaboratorio`, `modalidadeExigeProjeto`, `normalizarModalidadeOrcamento` | ✅ | **SIM** |
| `src/lib/orcamento/etapas-proposta.ts` | `MODALIDADES_COM_ANALISES`, `MODALIDADES_COM_PROJETO` | ❌ | não |
| `src/lib/orcamento/demanda-completude.ts` | `MODALIDADES_COM_ANALISES`, `MODALIDADES_COM_PROJETO` | ❌ | não |
| `src/lib/actions/demandas.ts` | `MODALIDADES_COM_ANALISES`, `MODALIDADES_COM_PROJETO` | ❌ | não |

**Impacto funcional:** uma demanda com modalidade canônica `projeto_com_analises`
seria tratada por `etapas-proposta`/`demanda-completude`/`actions.demandas` como
**nem laboratório nem projeto** (ambos `false`), produzindo etapas erradas,
completude incorreta e bloqueio de geração de módulos. O bug está latente apenas
porque o banco ainda não grava a forma canônica.

**Ação (Fase 2):** todos delegam para o helper único de `orcamento-economico.ts`;
remover os 3 pares de Sets locais.

---

## 3. Helpers que determinam etapas — DUAS fontes divergentes

| Arquivo | Função | Modelo retornado | Consumido por |
|---|---|---|---|
| `src/lib/orcamento/etapas-proposta.ts` | `montarEtapasProposta(modalidade)` | `{ id, label, aplicavel }` (5 etapas, sem `historico`) | página `demandas/[id]/page.tsx` (abas) |
| `src/lib/orcamento/fluxo-demanda.ts` | `calcularFluxoDemanda(args)` | `{ id, numero, label, detalhe, status, estado, obrigatoria }` (6 etapas) | **somente o próprio teste** (não usado pela app) |

Achados:
- `calcularFluxoDemanda` é efetivamente **código morto** na aplicação, mas contém
  o modelo mais rico (estado/sequenciamento/`historico`) que o plano exige.
- `montarEtapasProposta` usa os Sets legados (§2) → não reconhece a canônica.
- Nenhuma das duas devolve o modelo único exigido pela Fase 2.6
  (`id, label, estado, status, aplicavel, obrigatoria, href`).

**Ação (Fase 2):** unificar em **uma** função autoritativa que devolve o modelo
único com `href` (`?etapa=`), na ordem fixa
`demanda → laboratorio → projeto → parametros → final → historico`,
dirigida pelos helpers de modalidade canônicos.

---

## 4. Navegação por etapa (`?etapa=`)

- A página `src/app/orcamento/demandas/[id]/page.tsx` lê **apenas**
  `searchParams.erro_emissao` (linha 69). **Não** lê `?etapa=`.
- As abas usam âncoras de rolagem (`href="#id"`, linha 305), não query string.
- A "Proposta final" é apenas uma `section` no fim de uma página longa
  (`#final`), não uma etapa própria — contraria a Fase 10.

**Ação (Fase 2):** `?etapa=` passa a controlar a etapa exibida; `href` das etapas
aponta para `?etapa=<id>`. (O redesenho completo da etapa final é Fase 10.)

---

## 5. Engines econômicas — múltiplas, sem decisão formal

| Engine | Arquivo | Fórmula/uso |
|---|---|---|
| `consolidarEconomiaOrcamento` | `orcamento-economico.ts` | Gross-up `(custos + reserva + invest. + lucro) / (1 − impostos − incubação)`; bloqueia soma `final ≥ 100%` |
| `consolidarOrcamentoFinal` | `orcamento-final.ts` → `parametros-adapter.ts` + `project-budget/legacy.ts` | Caminho **distinto**, usado de fato pela página e pela emissão |
| `costing/engine.ts`, `costing/pricing.ts` | `src/lib/costing/**` | Motor de custeio/preço por amostra |
| `project-budget/legacy.ts`, `exporters.ts`, `travel.ts` | `src/lib/project-budget/**` | Cálculo legado de projeto |

**Achado:** há pelo menos **duas** consolidações econômicas paralelas
(`consolidarEconomiaOrcamento` vs `consolidarOrcamentoFinal`) — "duas fontes de
verdade" para a mesma regra, exatamente o que o plano proíbe.

**Ação:** **Fase 6** — decisão técnica formal `DEC-ORC-001` comparando as
fórmulas com exemplos numéricos e com a planilha `Laboratorio1.xlsm`, depois
unificar em uma engine única (demais viram adapters). **Fora do escopo da PR #3**
(que deve permanecer focada em navegação).

---

## 6. Onde totais são calculados (repetição)

`src/app/orcamento/demandas/[id]/page.tsx` recalcula totais inline em vários
pontos (linhas 224-243: `totalAnalisesCusto`, `totalAnalisesPreco`,
`totalProjetoCustos`, `totalProjetoAnalises`) **em paralelo** ao que
`consolidarOrcamentoFinal` já calcula. A emissão (`actions/demandas.ts`) repete a
mesma consolidação. → risco de divergência de subtotais (Fase 7) e de telas com
totais repetidos (Fase 10).

---

## 7. Actions que criam módulos / alteram documentos

| Action | Arquivo | Observações |
|---|---|---|
| `criarDemanda`, `salvarDemanda` | `actions/demandas.ts` | gravam `modalidade` crua sem normalizar |
| `gerarOrcamentoAnalisesDaDemanda` | `actions/demandas.ts` | **não** é idempotente: cada clique cria um novo `orcamentos`; marca a demanda como `orcada` ao criar módulo vazio (contraria Fase 5/8) |
| `gerarOrcamentoProjetoDaDemanda` | `actions/demandas.ts` | idem; redirect para `#projeto` (deep link de âncora) |
| `emitirOrcamentoFinalDaDemanda` | `actions/demandas.ts` | emissão **não transacional** (sequência de updates/inserts sem lock por demanda); reserva de versão via `max(versao)+1` sujeita a corrida (Fase 9) |
| `orcamentos.ts`, `orcamento-projetos.ts` | `actions/**` | criação/edição de itens |

**Ações:** idempotência → Fase 5; ciclo de vida/imutabilidade → Fase 8; emissão
transacional + lock → Fase 9.

---

## 8. Tabelas e FKs do módulo (migrations)

- `demandas_propostas` (`0011`): `modalidade` `check` sem a canônica; `status`
  `check` = `nova|em_analise|orcada|aprovada|recusada|cancelada` (não cobre os
  estados do ciclo de vida da Fase 8).
- `orcamentos` + `orcamento_itens` — fonte canônica das análises (Fase 4).
- `orcamento_projetos` + `orcamento_projeto_custos` + `orcamento_projeto_analises`
  — `orcamento_projeto_analises` deve virar **somente compatibilidade** (Fase 4).
- `orcamento_final_versoes` — snapshot/versões; `orcamento_parametros_aplicados`.
- `orcamentos.tipo` `check` (`0013`) = `('analises','projeto','analises_projeto')`
  — também sem a canônica.

**Sem proteções de unicidade** para: um módulo lab/projeto ativo por demanda; um
código de análise por orçamento; uma versão vigente por demanda;
`demanda_id + versao` único. → Fase 3.

---

## 9. Status usados (demanda / laboratório / projeto / versão)

- Demanda (`status`): `nova, em_analise, orcada, aprovada, recusada, cancelada`.
- Orçamento lab/projeto (`status` documento): `pendente, enviado, aprovado, ...`
  + derivações em `modulo-status.ts` (`pendente/preenchido/revisado/nao_exigido`).
- Versão final: `emitido, substituido` (uso em `actions/demandas.ts`).

**Achado:** a action marca a demanda como `orcada` apenas por criar um módulo
vazio (proibido pela Fase 5/8). Faltam os estados do ciclo de vida da Fase 8
(`em_composicao, aguardando_revisao, pronta_para_parametros,
pronta_para_emissao, emitida, ...`).

---

## 10. Rotas, redirects e deep links legados

- Hub `Propostas` e workspace `demandas/[id]` introduzidos pela PR #3
  (commits `96d52ab`, `587bed4`, `515ed65`, `a730361`).
- Deep links de **âncora** internos persistem: `#projeto`, `#final`, `#laboratorio`
  (na página e em `gerarOrcamentoProjetoDaDemanda` → `...#projeto`).
- Redirects legados já existem (commit `587bed4`); revisar para apontar ao
  workspace com `?etapa=` em vez de âncora (Fase 2.9).

---

## 11. Fontes de análises laboratoriais

- **Canônica (alvo):** `orcamentos` → `orcamento_itens`.
- **Legada/compatibilidade:** `orcamento_projetos` → `orcamento_projeto_analises`.

A página e a emissão hoje **somam as duas** (mapeando `orcamento_projeto_analises`
para rubrica `"MC"`). Risco de dupla contagem da mesma análise numa proposta
nova. → Fase 4 (fonte canônica única + adapter explícito p/ legado).

---

## 12. Telas que repetem os mesmos totais

- `demandas/[id]/page.tsx`: KPIs em "Parâmetros econômicos", em "Proposta final"
  e tabela "Pendências por etapa" exibem totais sobrepostos; seções com alturas
  fixas geram vazios (contraria Fase 10).

---

## 13. Ordem de entregas (sem merge automático)

A PR #3 permanece focada em **navegação e arquitetura da informação**. As demais
correções vão em entregas empilhadas e revisáveis.

| Entrega | Conteúdo | Fases |
|---|---|---|
| **PR-3 (fixes)** — *esta entrega* | helper de modalidade único + reconhecimento de `projeto_com_analises`; unificação `etapas-proposta`/`fluxo-demanda` no modelo único; `?etapa=`; rótulos/select; migração **aditiva** do `check` + backfill (com rollback, **não** aplicada em prod) | 1, 2 |
| **A** | inventário/preflight read-only + dedup com backup/relatório/log + proteções de unicidade | 3 |
| **B** | fonte canônica de análises + idempotência de módulos + engine econômica `DEC-ORC-001` + ciclo de vida/imutabilidade + emissão transacional | 4, 5, 6, 8, 9 |
| **C** | redesenho da Proposta final (`?etapa=final` como etapa própria) | 7, 10 |
| **D** | segurança/RLS + homologação/rollout + validação financeira/dados + E2E | 11, testes |

### Restrições reconhecidas
- Migrations **aditivas**, com rollback, **não aplicadas em produção** a partir
  deste ambiente (sem credenciais de prod — ver memória de infra/deploy).
- Nenhuma operação destrutiva; nenhum `DROP/TRUNCATE`; sem apagar histórico.
- Toda mudança financeira com testes de valores conhecidos antes do fechamento.

---

## 14. Critérios de "não concluído"

O módulo **não** é declarado concluído enquanto faltar comprovação de: dedup zero
(Fase 3), engine única decidida (Fase 6), emissão transacional (Fase 9),
redesenho final (Fase 10), RLS por papel (Fase 11), e a bateria E2E + validação
financeira/dados. Esta entrega cobre as Fases 1 e 2 e deixa as demais
explicitamente pendentes e rastreáveis.
