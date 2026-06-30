# Reorganização da navegação de Orçamentos — Proposta como unidade

**Data:** 2026-06-24
**Status:** Aprovado para planejamento

## Problema

No painel esquerdo, o grupo **Orçamentos** lista hoje 11 itens, vários dos quais
não são *destinos navegáveis* e sim *estados* ou *artefatos internos* de uma
proposta:

- **Orçamento de projeto** (hoje "Projetos" → `/orcamento/projetos`) e
  **Proposta final** (`/orcamento/final/[id]`) só existem atrelados a uma
  proposta. São gerados/consolidados *de dentro* de uma demanda, nunca um ponto
  de partida.
- Os estados do funil (Em elaboração, Prontos p/ revisão, Emitidos/enviados,
  Aprovados/recusados) são filtros de status, não módulos.

Isso cria a ilusão de que se pode "começar por" esses itens, quando o único
ponto de entrada legítimo é **criar uma nova proposta** ou **abrir uma proposta
existente**.

A entidade central é `demandas_propostas`. A página
[`/orcamento/demandas/[id]`](../../../src/app/orcamento/demandas/[id]/page.tsx)
**já é o workspace da proposta**: dispara `gerarOrcamentoProjetoDaDemanda`,
`gerarOrcamentoAnalisesDaDemanda` e `emitirOrcamentoFinalDaDemanda`.

## Princípio de design

> O painel esquerdo expõe **destinos** (listas e configurações). O ciclo de vida
> de uma proposta — análises → projeto → consolidação final — vira **etapas
> dentro do workspace da proposta**, não itens de menu.

## Decisões aprovadas

1. **Escopo:** remover os 2 itens *e* enxugar o funil (estados viram filtros).
2. **Navegação interna:** stepper horizontal no topo do workspace — fluxo
   guiado, mas **navegação livre** (voltar/revisar/recalcular sem travas). Não é
   wizard rígido.
3. **Painel/funil:** o `/orcamento` (visão geral do funil) **não** é item de
   menu separado; seus indicadores/contadores vão para o topo da lista de
   Propostas.
4. **Lista de projetos:** `/orcamento/projetos` sai do menu; vira a etapa
   "Custos do projeto" no workspace. Agregação entre propostas, se necessária no
   futuro, entra como relatório/filtro em Histórico — não como item operacional.

## Parte 1 — Novo grupo "Orçamentos" no painel (11 → 5)

| Item | Papel |
|---|---|
| **Propostas** | Ponto de entrada único, servido pela rota existente `/orcamento/demandas` (apenas relabel de "Demandas/Propostas" → "Propostas"). Topo: indicadores do funil (em elaboração, revisão, emitidas, aprovadas, recusadas, concluídas). Abaixo: lista operacional com filtros por status + o formulário **Nova proposta** já existente na página. |
| **Histórico** | Versões, validade, comparação (transversal). Hospeda futuros relatórios agregados de custos de projeto. |
| **Parâmetros econômicos** | Cadastro/configuração dos **parâmetros-padrão do sistema**: taxas, impostos, margem de lucro, fundos de investimento e fundos de equipamentos. É a fonte canônica dos valores globais. Também aparece como etapa na proposta (que copia esses valores como base/snapshot), mas o destino global permanece como o cadastro mestre. |
| **Modelos/Templates** | Catálogo institucional. |
| **Governança** | Permissões, eventos, auditoria por campo. |

**Removidos do menu** (absorvidos por outros itens ou pelo workspace):
- Orçamento de projeto / "Projetos" → etapa "Custos do projeto" no workspace.
- Proposta final → etapa final no workspace.
- Painel/funil `/orcamento` → indicadores no topo de Propostas.
- Em elaboração, Prontos p/ revisão, Emitidos/enviados, Aprovados/recusados →
  filtros de status dentro de Propostas (`/orcamento/demandas?status=...`).

## Parte 2 — Workspace da proposta (stepper condicional por modalidade)

Stepper horizontal no topo da proposta aberta, com **ordem fixa** e etapas
exibidas condicionalmente conforme a `modalidade` da demanda:

```
Dados da demanda
→ Orçamento laboratorial   (se houver)
→ Custos do projeto        (se houver)
→ Parâmetros econômicos
→ Proposta final
```

- **Apenas análises:** Dados da demanda → Orçamento laboratorial → Parâmetros econômicos → Proposta final
- **Apenas projeto:** Dados da demanda → Custos do projeto → Parâmetros econômicos → Proposta final
- **Projeto + análises:** Dados da demanda → Orçamento laboratorial → Custos do projeto → Parâmetros econômicos → Proposta final

**Nomenclatura (intencional):** "orçamento" fica reservado para a consolidação
final. Antes disso, laboratório e projeto são **componentes de custo**. A etapa
de laboratório chama-se **"Orçamento laboratorial"** porque as análises já vêm
precificadas do catálogo (via `gerarOrcamentoAnalisesDaDemanda`); a de projeto
chama-se **"Custos do projeto"** porque entra como rubricas de custo cru, ainda
sem markup. O orçamento propriamente dito só nasce na **Proposta final**, após a
aplicação dos parâmetros econômicos.

Regras:

- **Parâmetros econômicos** (etapa): parte de um **snapshot dos valores globais**
  do cadastro mestre e permite ajustes específicos daquela proposta, sem alterar
  os padrões do sistema.
- **Proposta final** é sempre a última etapa; consolida laboratório + projeto +
  parâmetros econômicos.
- Cada etapa exibe indicador de completude (✓ / pendente), reaproveitando
  `avaliarCompletudeDemanda` / `avaliarModuloOperacional`.
- Navegação é **livre** entre etapas já existentes — sem bloquear retorno para
  recalcular. Apenas a *emissão* da proposta final continua exigindo completude,
  como hoje.
- O gating modalidade→etapas usa os conjuntos já existentes
  (`MODALIDADES_COM_ANALISES`, `MODALIDADES_COM_PROJETO`).

## Parte 3 — Rotas antigas (compatibilidade)

Nada é apagado de imediato. As rotas viram redirects para preservar links
salvos, histórico e auditoria:

- `/orcamento/projetos` → `/orcamento/demandas` (hub de Propostas).
- `/orcamento/projetos/[id]` → proposta correspondente (`/orcamento/demandas/{demanda_id}#projeto`).
- `/orcamento/final/[id]` → **mantida como está** (página de export/impressão da
  versão final). Deixa de ser item de menu; passa a ser alcançada pela etapa
  "Proposta final" dentro do workspace.
- `/orcamento/em-elaboracao`, `/orcamento/revisao`, `/orcamento/emitidos`,
  `/orcamento/decididos` → `/orcamento/demandas?status=<estado>`.
- `/orcamento` → `/orcamento/demandas` (hub de Propostas, com indicadores no topo).

## Componentes afetados

- [`src/config/navigation.ts`](../../../src/config/navigation.ts) — redefinir o
  grupo "Orçamentos".
- [`src/components/layout/CommandPalette.tsx`](../../../src/components/layout/CommandPalette.tsx)
  — alinhar comandos rápidos ao novo conjunto de destinos.
- Workspace da proposta em
  [`src/app/orcamento/demandas/[id]/page.tsx`](../../../src/app/orcamento/demandas/[id]/page.tsx)
  — introduzir o stepper e organizar as seções existentes em etapas.
- Nova lista **Propostas** (`/orcamento/propostas`) com indicadores + filtros,
  reaproveitando a listagem existente
  ([`src/lib/orcamento/orcamentos-listagem.ts`](../../../src/lib/orcamento/orcamentos-listagem.ts),
  [`src/components/orcamento/DemandasTable.tsx`](../../../src/components/orcamento/DemandasTable.tsx)).
- Redirects nas rotas legadas listadas na Parte 3.

## Fora de escopo

- Mudanças no motor de pricing/consolidação (mantém regras atuais).
- Migração de dados ou schema (apenas IA/navegação e composição de UI).
- Relatórios agregados de custos de projeto (apenas reservado lugar em Histórico).

## Critérios de sucesso

- Grupo "Orçamentos" no painel passa a ter 5 itens; nenhum deles é "orçamento de
  projeto" ou "proposta final" isolados.
- Toda criação/edição de orçamento de projeto e proposta final acontece dentro
  do workspace de uma proposta, via stepper condicional pela modalidade.
- Indicadores do funil e filtros de status vivem na tela de Propostas.
- Rotas antigas redirecionam sem quebrar links/auditoria.
