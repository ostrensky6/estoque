# Diagnóstico — idempotência dos módulos e ciclo de vida da proposta (Fase 5)

Data: 2026-06-24 · Nenhum dado alterado. Nenhuma constraint aplicada.

> Mapeamento das actions e dos pontos que permitem **duplicidade** ou **edição
> indevida**, e as correções aplicadas nesta fase.

## 1. Actions que criam módulos

| Action | Arquivo | Problema (antes) | Correção (Fase 5) |
|---|---|---|---|
| `gerarOrcamentoAnalisesDaDemanda` | `actions/demandas.ts` | inseria novo `orcamentos` a cada clique; marcava demanda `orcada` | idempotente (`planejarModulosProposta`): cria só se faltar, abre se existir, bloqueia se >1; status → `em_analise` |
| `gerarOrcamentoProjetoDaDemanda` | `actions/demandas.ts` | idem para `orcamento_projetos` | idem |
| `garantirModulosDaProposta` *(novo)* | `actions/demandas.ts` | — | rotina única idempotente que garante todos os módulos aplicáveis |
| `criarOrcamento` (rota legada) | `actions/orcamentos.ts` | insere sem checar duplicidade | mantida como legada; o fluxo canônico passa por `gerar*`/`garantir*` (documentado) |
| `criarOrcamentoProjeto` | `actions/orcamento-projetos.ts` | insere sem checar | idem (legada) |

## 2. Actions que adicionam/removem itens

| Action | Arquivo | Antes | Correção |
|---|---|---|---|
| `adicionarItemOrcamento` / `removerItemOrcamento` | `actions/orcamentos.ts` | **sem** guarda de status | `assegurarLaboratorioEditavel` (bloqueia enviado/aprovado/cancelado/revisado) |
| `recalcularOrcamento` | `actions/orcamentos.ts` | já exigia papel+motivo p/ revisado | mantido |
| `adicionarAnaliseProjeto`, `adicionarCustoProjeto`, `adicionarCustoCatalogoProjeto`, `removerAnaliseProjeto`, `removerCustoProjeto`, `salvarViagensProjeto` | `actions/orcamento-projetos.ts` | **sem** guarda | `assegurarProjetoEditavel` (bloqueia enviado/aprovado/cancelado) |

## 3. Actions que alteram status / parâmetros

| Action | Arquivo | Observação |
|---|---|---|
| `salvarCabecalho` | `actions/orcamentos.ts` | exige papel ao mover p/ enviado/aprovado/cancelado |
| `salvarOrcamentoProjeto` | `actions/orcamento-projetos.ts` | idem |
| `salvarParametrosEconomicosProjeto` | `actions/orcamento-projetos.ts` | **sem** guarda → adicionada `assegurarProjetoEditavel` |
| `salvarParametrosEconomicos` (global) | `actions/orcamentos.ts` | parâmetros globais; fora do ciclo de um módulo |

## 4. Actions que emitem proposta final

| Action | Arquivo | Antes | Correção |
|---|---|---|---|
| `emitirOrcamentoFinalDaDemanda` | `actions/demandas.ts` | **não** marcava `orcada` | passa a marcar `orcada` **após** emissão bem-sucedida (somente se status era `nova`/`em_analise`) |

## 5. Status usados

- **Demanda** (`demandas_propostas.status`, migration 0011): `nova, em_analise,
  orcada, aprovada, recusada, cancelada`. **Não há** `em_composicao`/
  `aguardando_revisao` etc. no banco — usamos `em_analise` como transitório.
- **Documento lab/projeto** (`status`): `rascunho, enviado, aprovado, recusado,
  cancelado`. Lab também tem `status_operacional`: `pendente, preenchido,
  revisado, cancelado`.
- **Versão final**: `emitido, substituido, cancelado, vencido`.

### 5.1 `status = orcada` cedo demais (corrigido)
Antes, `gerar*` marcava a demanda como `orcada` ao criar **um módulo vazio**.
Agora: criar módulo → no máximo `em_analise`; `orcada` só **após emissão**.

### 5.2 Módulos revisados/aprovados ainda editáveis (corrigido)
As actions de item/custo de projeto e de parâmetros de projeto não checavam
status. Agora há validação **defensiva no servidor** (`moduloBloqueadoParaEdicao`).
A criação de "nova revisão" **não existe ainda** — a alteração é apenas
**bloqueada** (pendência da próxima fase).

### 5.3 Duplo clique criava duplicidade (corrigido)
`gerar*` inseria a cada clique. Agora re-consultam os módulos ativos e **abrem o
existente** em vez de duplicar (idempotência sequencial). Concorrência simultânea
real só será 100% garantida com **constraint única**/RPC (próximas fases).

## 6. Rotina idempotente

`planejarModulosProposta({ modalidade, projetoAssociado, laboratorioAtivos,
projetoAtivos })` (PURA, `lib/orcamento/garantir-modulos.ts`) decide por módulo:
`criar` (0 ativos) · `abrir` (1 ativo) · `bloqueado` (>1 ativo) · `nao_aplicavel`.
As actions (`gerar*`, `garantirModulosDaProposta`) reusam essa decisão.

## 7. UI da proposta (etapa demanda)

- Sem módulo aplicável → **“Criar orçamento …”**.
- Um módulo ativo → **“Abrir orçamento …”**.
- >1 módulo ativo → **alerta de integridade** e **não** permite criar.
- Modalidade sem o módulo → “… não se aplica”.

## 8. Constraints futuras (NÃO aplicadas nesta fase)

Só após o preflight real e a limpeza aprovada:
- um módulo laboratorial ativo por demanda;
- um módulo de projeto ativo por demanda;
- um código de análise por orçamento;
- um item de catálogo por projeto (salvo repetição permitida);
- uma versão final vigente por demanda;
- `orcamento_final_versoes(demanda_id, versao)` único (já existe).

## 9. Pendências conhecidas

- **Nova revisão**: bloqueio atual sem fluxo de revisão — implementar na próxima fase.
- **Concorrência simultânea**: idempotência é sequencial; corrida real exige
  constraint/RPC (Fases de emissão transacional/constraints).
- **Detecção “incorporado à proposta final”**: hoje o bloqueio usa o status do
  próprio módulo; vincular ao snapshot da versão emitida fica para a próxima fase.
- `criarOrcamento`/`criarOrcamentoProjeto` legadas permanecem; o fluxo canônico é
  via `gerar*`/`garantir*`.
