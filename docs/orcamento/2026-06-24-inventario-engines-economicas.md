# Inventário das engines/fórmulas econômicas — Orçamentos (Fase 4)

Data: 2026-06-24 · Status: **diagnóstico; nenhuma engine trocada**

> Mapeamento de **todas** as fórmulas econômicas existentes no código, com
> arquivo/função, o que calculam e onde são (ou não) usadas em produção. Base
> para a decisão `DEC-ORC-001`. **Nenhuma regra de produção foi alterada.**

## 1. Camadas econômicas (visão geral)

```
[1] Custeio por amostra           costing/engine.ts  calcularAnalise
     custo técnico + preço base    → preço = custoTotal × (1 + Σfatores)   (MARKUP)
        │  (snapshot custo_unitario / preco_unitario em orcamento_itens)
        ▼
[2] Proposta final (PRODUÇÃO)      orcamento-final.ts consolidarOrcamentoFinal
     lab "preço já formado" +      → costing/pricing.ts aplicarParametrosEconomicos
     gross-up só no projeto           (GROSS_UP, lab PRECO_JA_FORMADO, projeto APENAS_PROJETO)

[B] Engine alternativa (NÃO usada) orcamento-economico.ts consolidarEconomiaOrcamento
     impostos+incubação gross-up + reserva/investimentos/lucro markup  (só testes)
```

## 2. Inventário por função

### 2.1 Custo técnico e preço base laboratorial (custeio)
| Função | Arquivo | Calcula |
|---|---|---|
| `equipCustoDia` | `src/lib/costing/engine.ts` | custo/dia de equipamento (depreciação linear + manutenção) |
| `gargalo` | `src/lib/costing/engine.ts` | execuções/amostras-dia (replica planilha; ignora Qubit) |
| `horasBancadaPorAmostra` | `src/lib/costing/engine.ts` | horas de bancada por amostra |
| `reagentesPorAmostra` | `src/lib/costing/engine.ts` | reagentes por amostra (por_amostra/por_execucao) |
| `calcularAnalise` | `src/lib/costing/engine.ts` | **custo técnico** (reagentes+equip+pessoal+overhead) e **preço base** = `custoTotal × (1 + Σfatores/100)` (**MARKUP**) |
| `Parametros` (tipo) | `src/lib/costing/engine.ts` | fatores: `margem_lucro, impostos, taxas, fundo_reserva, fundo_investimento` (%) |
| loader | `src/lib/costing/loader.ts` | carrega dados crus p/ `calcularAnalise` |
| **Consumidor** | `src/components/custeio/CusteioSimulator.tsx` | tela de Custeio |

> O preço base por amostra é gravado como snapshot em `orcamento_itens.preco_unitario`
> (e `custo_unitario`). É esse **preço já formado** que entra na proposta final.

### 2.2 Custo de projeto + parâmetros (engine legada de projeto)
| Função | Arquivo | Calcula |
|---|---|---|
| `itemProjetoTotal` | `src/lib/project-budget/legacy.ts` | total do item (rubrica PE usa meses; demais quantidade × unitário) |
| `validarParametrosProjetoGrossUp` | `src/lib/project-budget/legacy.ts` | rejeita negativos; soma ≥ 100% → inválido |
| `calcularOrcamentoProjetoLegacy` | `src/lib/project-budget/legacy.ts` | **gross-up** do subtotal de projeto: `grossTotal = subtotal / (1 − Σrates/100)`; decompõe impostos/incubação/reserva/investimentos/lucro |
| `ProjetoBudgetRates` (tipo) | `src/lib/project-budget/legacy.ts` | `impostos_legacy, incubacao, reserva, investimentos, lucro` (%) |
| exporters/travel | `src/lib/project-budget/exporters.ts`, `travel.ts` | exports e diárias do projeto |

### 2.3 Engine de parâmetros (gross-up/markup unificado — usada na proposta final)
| Função | Arquivo | Calcula |
|---|---|---|
| `aplicarParametrosEconomicos` | `src/lib/costing/pricing.ts` | **engine de parâmetros**. `metodo` MARKUP/GROSS_UP; `laboratorio.modo` CUSTO_TECNICO/PRECO_JA_FORMADO; `base` por parâmetro (APENAS_LABORATORIO/APENAS_PROJETO/TODOS_COMPONENTES/VALOR_FIXO/NAO_APLICAVEL). Em GROSS_UP: `total = base / (1 − Σ%/100)`; bloqueia Σ ≥ 100% (throw) |
| `roundMoney` | `src/lib/costing/pricing.ts` | arredondamento monetário (2 casas, `Math.round((v+EPS)*100)/100`) |

### 2.4 Adaptação proposta → engine de parâmetros
| Função | Arquivo | Calcula |
|---|---|---|
| `totalLaboratorioCusto` / `totalLaboratorioPreco` | `src/lib/orcamento/parametros-adapter.ts` | Σ(custo/preço × n_amostras), arredondado |
| `totalProjetoCusto` | `src/lib/orcamento/parametros-adapter.ts` | Σ `itemProjetoTotal` na base de custo |
| `parametrosProjetoParaPricing` | `src/lib/orcamento/parametros-adapter.ts` | mapeia os 5 rates → `base: APENAS_PROJETO` |
| `adaptarOrcamentoParaEntradaParametros` | `src/lib/orcamento/parametros-adapter.ts` | monta entrada: `metodo GROSS_UP`, lab `PRECO_JA_FORMADO`, projeto custo, parâmetros APENAS_PROJETO |
| `aplicarParametrosDoOrcamento` | `src/lib/orcamento/parametros-adapter.ts` | adapta + chama `aplicarParametrosEconomicos` |

### 2.5 Consolidação da proposta final (PRODUÇÃO)
| Função | Arquivo | Calcula |
|---|---|---|
| `consolidarOrcamentoFinal` | `src/lib/orcamento/orcamento-final.ts` | **engine de produção**. `totalLaboratorioPreco` + projeto com gross-up; `totalFinal = parametrosAplicados.totalFinal ?? (totalLaboratorioPreco + totalProjetoFinal)`; gera `origens` e `parametrosAplicados` |
| **Consumidores** | `src/app/orcamento/demandas/[id]/page.tsx`, `src/lib/actions/demandas.ts` (emissão) | página e emissão usam **esta** engine; o snapshot da versão final guarda `consolidado` |

### 2.6 Engine econômica alternativa (NÃO usada em produção)
| Função | Arquivo | Calcula |
|---|---|---|
| `consolidarEconomiaOrcamento` | `src/lib/orcamento/orcamento-economico.ts` | subtotal = custoLab+custoProjeto; impostos+incubação **gross-up sobre o total**; reserva/investimentos/lucro **markup sobre custo**; bloqueia Σfinal ≥ 100% |
| `calcularTotalLaboratorioDireto` / `calcularTotalProjetoDireto` | `src/lib/orcamento/orcamento-economico.ts` | somas diretas |
| **Consumidores** | — **nenhum em produção** (apenas `orcamento-economico.test.ts`) |

### 2.7 Parâmetros econômicos (versões/origem dos percentuais)
| Função | Arquivo | Calcula |
|---|---|---|
| `parametros-versionamento.ts` | `src/lib/orcamento/parametros-versionamento.ts` | versionamento dos parâmetros econômicos |
| tabela `parametros` (custeio) | migrations | `margem_lucro, impostos, taxas, fundo_reserva, fundo_investimento` |
| colunas em `orcamento_projetos` | migrations 0010/0036/0037 | `impostos, margem_lucro, impostos_legacy, incubacao, reserva, investimentos, lucro` |

### 2.8 Snapshots e exports
| Item | Arquivo | Observação |
|---|---|---|
| Snapshot da versão final | `src/lib/actions/demandas.ts` (`emitir…`) | grava `snapshot = { demanda, orcamentos_analises, orcamentos_projeto, consolidado }` + `total_*` colunas |
| `orcamento_parametros_aplicados` | `src/lib/actions/demandas.ts` | snapshot dos parâmetros aplicados (metodo, subtotais, total) |
| Exports finais (PDF/DOCX/XLSX) | `src/lib/orcamento/final-exporters.ts` | usam `total_laboratorio_custo/preco, total_projeto_custo/final, total_final` |
| Exports de projeto | `src/lib/project-budget/exporters.ts` | decomposição da engine legada de projeto |

## 3. Testes econômicos existentes
- `src/lib/costing/engine.test.ts` — custeio (custo/preço por amostra, markup).
- `src/lib/costing/pricing.test.ts` — `aplicarParametrosEconomicos` (gross-up/markup, bases).
- `src/lib/project-budget/legacy.test.ts` — gross-up de projeto.
- `src/lib/orcamento/orcamento-final.test.ts` — consolidação de produção.
- `src/lib/orcamento/parametros-adapter.test.ts` — adaptação.
- `src/lib/orcamento/orcamento-economico.test.ts` — engine **alternativa** (não-produção).
- `src/lib/orcamento/parametros-versionamento.test.ts` — versionamento de parâmetros.
- `src/lib/project-budget/exporters.test.ts`, `travel.test.ts` — exports/diárias.

## 4. Conflitos e ambiguidades (para a decisão DEC-ORC-001)
1. **Duas operações matemáticas diferentes**: custeio usa **MARKUP** (`×(1+Σ)`),
   a proposta final usa **GROSS-UP** (`÷(1−Σ)`). Mesmos % → resultados diferentes.
2. **Dois vocabulários de parâmetros**: `{margem_lucro, impostos, taxas, fundo_reserva, fundo_investimento}` (custeio)
   vs `{impostos_legacy, incubacao, reserva, investimentos, lucro}` (projeto/final). Falta um mapa oficial.
3. **Duas engines de consolidação**: `consolidarOrcamentoFinal` (produção, Policy C)
   vs `consolidarEconomiaOrcamento` (alternativa, Policy B) — "duas fontes de verdade".
4. **Laboratório na final**: entra como **preço já formado** (não recebe parâmetros);
   parâmetros incidem **só no projeto**. É uma escolha de política (ver DEC-ORC-001).
5. **Bloqueio Σ ≥ 100%**: presente em 3 lugares (pricing, legacy, economico) com
   mensagens diferentes — consolidar.

> A política efetivamente implementada hoje na proposta final é a **Alternativa C**
> (ver `DEC-ORC-001`). Nada será trocado sem aprovação explícita.
