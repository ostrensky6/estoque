# Diagnóstico visual/operacional — aba Proposta final (`?etapa=final`)

Data: 2026-06-24 · Rota: `/orcamento/demandas/[id]?etapa=final`
Status: diagnóstico **antes** do redesenho (Fase 10). Nenhum dado alterado.

> Levantamento dos problemas da aba final **antes** de alterar, conforme exigido.
> O redesenho e a reconciliação estão no mesmo PR (módulo
> `src/lib/orcamento/proposta-final.ts` + seção `#final` da página).

## Problemas identificados (estado anterior)

| # | Problema | Evidência (antes) | Tratamento no redesenho |
|---|----------|-------------------|-------------------------|
| 1 | **Blocos repetidos** | KPIs de custo apareciam em "Parâmetros econômicos", de novo na "Proposta final" e na tabela de origens | Resumo executivo único + resumo econômico único; sem repetição entre cartões/tabelas |
| 2 | **Rubricas zeradas exibidas** | KPI "Custo projeto R$ 0,00" mesmo em modalidade só-laboratório | Cartão de projeto só quando `exigeProjeto`; composição oculta componentes com subtotal ≤ 0 |
| 3 | **Projeto aparecendo quando não aplicável** | "Parâmetros econômicos do projeto" e custos de projeto renderizados sem checar modalidade | Blocos de projeto condicionados a `exigeProjeto` |
| 4 | **Composição itemizada ≠ total final** | A composição comercial somava itens por `preco_unitario`, divergindo do `total_final` (gross-up sobre custo técnico) | Reconciliação: `valor_comercial = total_final × participação técnica`; soma confere com o total |
| 5 | **Custo unitário não reconcilia com subtotal** | Item exibia preço unitário antigo sem relação com o fechamento por gross-up | Colunas distintas: custo unit. técnico, subtotal técnico, participação, valor comercial |
| 6 | **Custo zero** | Itens com custo técnico 0 não bloqueavam a emissão de forma visível | Detecção `detectarCustosZero`; bloco de bloqueio + botão de emissão desabilitado + validação no servidor |
| 7 | **Status contraditórios** | Badge "Pronto para emissão" vs "Bloqueado"; "Pendente" aparecia mesmo pronta | Status padronizado: Bloqueada/Em composição/Aguardando revisão/Pronta para emitir/Emitida/Substituída/Cancelada |
| 8 | **Excesso de espaço vazio** | Cartões grandes e seções soltas com alturas fixas | Layout denso em `space-y-4`, sem alturas fixas |
| 9 | **Total final sem destaque suficiente** | Total como mais um KPI numa grade de 4 | Total final em faixa destacada (3xl) **acima da dobra**, junto às ações |
| 10 | **Visão comercial × detalhamento interno misturados** | Preço snapshot e custo técnico no mesmo nível | Composição comercial reconciliada separada; detalhamento interno (custo técnico × preço snapshot) em `<details>` expansível |

## Estrutura do redesenho (A–G)

- **A. Cabeçalho:** Nº/identificação, cliente, modalidade, status, validade; ações
  pré-visualizar / emitir / abrir versão emitida. Total final acima da dobra.
- **B. Resumo executivo:** custo laboratorial técnico, custo direto de projeto
  (se aplicável), subtotal técnico, total de parâmetros, **total final em destaque**.
- **C. Resumo econômico:** subtotal técnico, soma %, fator de gross-up, valor
  nominal por parâmetro, total final, **fórmula aplicada**.
- **D. Composição da proposta:** reconciliada (componente, descrição, qtd, custo
  unit. técnico, subtotal técnico, participação, valor comercial, observação);
  só rubricas com valor positivo; sem bloco de projeto fora da modalidade.
- **E. Itens detalhados:** `<details>` expansível, separando custo técnico do
  preço snapshot (referência).
- **F. Pendências e bloqueios:** custo zero, módulo não revisado, parâmetros
  inválidos (Σ ≥ 100%), divergência de reconciliação.
- **G. Histórico resumido:** versões emitidas (status, validade, total, link);
  versões antigas mantidas em modo legado.

## Reconciliação (exemplo)

Lab técnico 100 + projeto direto 200, Σ 20% → `total_final = 300 / 0,8 = 375`.
- Participação lab = 100/300 = 33,3% → valor comercial = 375 × 0,333 = **125,00**.
- Participação projeto = 200/300 = 66,7% → valor comercial = **250,00**.
- Soma comercial = **375,00** = total final (resíduo de arredondamento absorvido
  na última linha). Parâmetros = 375 − 300 = **75,00**.

## Pendências conhecidas

- **Exports (PDF/DOCX/XLSX)** ainda usam a composição itemizada por
  `preco_unitario` (em `final-exporters.ts` via `/orcamento/final/[id]`). **Não**
  reescritos nesta fase — **pendência explícita** para alinhar à reconciliação.
- **Sinalização de versão legada por item** no histórico depende de inspecionar o
  snapshot de cada versão (custo de query) — feita de forma genérica por nota.
- Fonte de parâmetros para propostas só-laboratório (herdada do módulo de projeto).
