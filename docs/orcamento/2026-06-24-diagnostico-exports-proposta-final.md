# Diagnóstico dos exports da Proposta final

Data: 2026-06-24 · Fase 10 (exports) · Nenhum dado alterado.

> Mapeamento dos exports da proposta final **antes** de alinhá-los à engine
> autoritativa (Política A) e à composição comercial reconciliada.

## Arquivos/funções mapeados

| Item | Arquivo | Papel |
|---|---|---|
| Botões de export | `src/components/orcamento/ExportOrcamentoFinalButtons.tsx` | dispara XLSX/DOCX (client) |
| Exporters | `src/lib/orcamento/final-exporters.ts` | `exportOrcamentoFinalXlsx`, `exportOrcamentoFinalDocx` |
| Montagem dos itens | `src/app/orcamento/final/[id]/page.tsx` | constrói `exportItens`/`exportResumo`/`exportOrigens` do **snapshot** |
| "PDF" | `src/components/orcamento/PrintButton.tsx` | **impressão do navegador** da página (não há export PDF em código) |

## Problemas identificados

1. **Soma por `preco_unitario`.** `final/[id]/page.tsx` monta `exportItens` com
   `subtotal = n_amostras × preco_unitario` (lab) e `quantidade × custo` (projeto).
   A planilha "Proposta Cliente" e a tabela "Composição comercial" do DOCX somam
   esses `subtotal` — **não reconciliam** com o `total_final` (gross-up sobre custo
   técnico, Política A).
2. **Mistura comercial × interno.** O preço laboratorial snapshot aparece junto do
   total comercial; "Projeto final"/"Preço laboratório" expostos como se compusessem
   o total.
3. **Sem reconciliação.** Não há distribuição do `total_final` por participação
   técnica; a soma itemizada diverge do total.
4. **Sem modo legado explícito.** Versões antigas (regra anterior) exportam com o
   mesmo layout, sem sinalizar "regra econômica anterior".
5. **Não há export PDF em código** — apenas impressão do navegador (fora de escopo).

## O que será corrigido nesta fase

- Nova **camada única** `src/lib/orcamento/proposta-final-export.ts` que reusa
  `proposta-final.ts` (`montarComponentesTecnicos` + `reconciliarComposicao`) e
  produz uma estrutura exportável única (comercial + interna + econômica).
- **XLSX** e **DOCX** passam a consumir essa estrutura:
  - **Composição comercial reconciliada** (componente, descrição, qtd, custo unit.
    técnico, subtotal técnico, participação, valor comercial, observação);
  - soma dos **valores comerciais = `total_final`** (resíduo na última linha);
  - **parâmetros econômicos** apresentados à parte (percentual + valor nominal);
  - **visão interna** separada (custo técnico × preço snapshot);
  - **modo legado** para versões sem snapshot da nova engine, preservando o total
    salvo e sinalizando "Versão emitida com regra econômica anterior".
- `final/[id]/page.tsx` passa a montar a estrutura via a camada única.

## Pendências que permanecem

- **Impressão/PDF** continua sendo o print do navegador da página
  `/orcamento/final/[id]`; o conteúdo impresso segue a página (a composição
  comercial da página foi tratada na Fase 10 anterior). Sem export PDF em código —
  **fora de escopo** desta fase.
- A página `/orcamento/final/[id]` mantém a tabela "composição comercial" própria
  (cliente) — alinhada via a mesma estrutura quando possível; ajustes visuais
  finos ficam para o redesign visual, se necessário.
