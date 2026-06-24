# DEC-ORC-001 — Política econômica autoritativa

Data: 2026-06-24 · Status: **APROVADA — Alternativa A** (decisão do usuário, 2026-06-24)
Relacionado: [inventário das engines](2026-06-24-inventario-engines-economicas.md) ·
implementação: `src/lib/orcamento/engine-economica.ts`

> ## ✅ Decisão aprovada: **Alternativa A** (para novas propostas)
>
> ```
> total_final = (custo_laboratorial_tecnico + custo_direto_projeto) / (1 - Σparametros/100)
> ```
>
> - Laboratório = **custo técnico** (não preço já formado); recebe parâmetros.
> - Projeto = **custo direto**.
> - Parâmetros incidem sobre a **proposta inteira**, em **gross-up único** (sem
>   gross-up separado de projeto + proposta).
> - Lucro, fundos, impostos, taxas e incubação = percentuais líquidos do valor final.
> - Preço laboratorial já formado = **apenas referência/snapshot**, não entra no
>   fechamento de novas propostas.
> - **Versões históricas não são recalculadas**; snapshots antigos são lidos no
>   **modo legado**.
> - A **Alternativa C** permanece **somente** como compatibilidade histórica
>   (`aplicarParametrosEconomicos`/adapters legados, marcados `@deprecated`).

## 1. Glossário de operações

- **MARKUP sobre custo:** `preço = custo × (1 + Σ%/100)`. Σ é "por fora" do custo.
- **GROSS-UP sobre o total:** `total = base / (1 − Σ%/100)`. Σ é "por dentro" do
  preço final (ex.: impostos que incidem sobre a própria receita).
- Mesmos percentuais → **resultados diferentes** (gross-up ≥ markup quando Σ>0).

## 2. Cenário canônico de comparação

- Laboratório (custo técnico / preço base): **100**
- Projeto (custo direto): **200**
- Parâmetros (Σ = **20%**): impostos **10%**, reserva **3%**, investimentos **2%**, lucro **5%**, incubação 0%.

## 3. Alternativas

### A) Todos os percentuais em GROSS-UP sobre o total final ✅ *(APROVADA)*
- **Fórmula:** `subtotal = lab + projeto`; `totalFinal = subtotal / (1 − Σ/100)`.
  Parâmetros incidem sobre **lab e projeto**.
- **Exemplo:** `300 / (1 − 0,20) = ` **375,00**.
- **Vantagens:** simples; trata todos os parâmetros como "por dentro"; coerente
  se impostos incidem sobre a receita total (lab + projeto).
- **Riscos:** reaplica parâmetros sobre laboratório que **já** foi precificado no
  custeio (dupla margem). Total mais alto.
- **Impacto em propostas antigas:** mudaria o total exibido (não os snapshots já
  gravados — versões finais não se recalculam).
- **Compatibilidade com a planilha:** o custeio já aplica **markup** por amostra;
  gross-up no total diverge da planilha no nível da amostra (a confirmar no .xlsm).
- **Snapshots:** novos snapshots com base `TODOS_COMPONENTES`; antigos preservados.
- **Exports:** `total_final` maior; composição muda (lab passa a receber parâmetros).
- **Decisão que exige aprovação:** aceitar dupla incidência sobre laboratório.

### B) Impostos/taxas/incubação em GROSS-UP; lucro/fundos em MARKUP sobre custo
- **Fórmula (engine `consolidarEconomiaOrcamento`):**
  `subtotal = custoLab + custoProjeto`;
  `baseComMarkup = subtotal × (1 + (reserva+investimentos+lucro)/100)`;
  `totalFinal = baseComMarkup / (1 − (impostos+incubação)/100)`.
- **Exemplo:** `markup = 300 × 1,10 = 330`; `total = 330 / (1 − 0,10) = ` **366,67**.
- **Vantagens:** distingue tributos ("por dentro") de margem/fundos ("por fora"),
  o que costuma refletir a realidade fiscal.
- **Riscos:** mais complexo; também incide sobre o laboratório (base = custoLab).
- **Impacto em propostas antigas:** muda total exibido; snapshots preservados.
- **Compatibilidade com a planilha:** parcial — depende de como o .xlsm separa
  tributos de margem (a confirmar).
- **Snapshots/Exports:** exigem decompor "tributos" × "margem/fundos".
- **Decisão que exige aprovação:** classificação de cada parâmetro (tributo vs margem)
  e incidência sobre laboratório.

### C) Laboratório já precificado; parâmetros aplicados APENAS ao projeto  ⚠️ *(LEGADA — só compat. histórica)*
- **Fórmula (`consolidarOrcamentoFinal` → `aplicarParametrosEconomicos`):**
  lab entra como **preço já formado** (não recebe parâmetros);
  `projetoFinal = custoProjeto / (1 − Σprojeto/100)`;
  `totalFinal = labPreço + projetoFinal`.
- **Exemplo:** `projeto = 200 / (1 − 0,20) = 250`; `total = 100 + 250 = ` **350,00**.
- **Vantagens:** evita dupla margem no laboratório (já precificado no custeio);
  separa claramente "preço de bancada" de "custos próprios do projeto".
- **Riscos:** se o laboratório também devesse sofrer impostos no nível da proposta,
  ficaria subtributado; depende de o preço base já embutir tudo.
- **Impacto em propostas antigas:** **nenhum** — é o comportamento atual.
- **Compatibilidade com a planilha:** o preço laboratorial vem do custeio (markup,
  que replica a planilha); o projeto recebe gross-up (camada nova).
- **Snapshots/Exports:** já é o formato atual (`total_laboratorio_preco` + projeto
  com parâmetros).
- **Decisão que exige aprovação:** confirmar que laboratório **não** deve receber
  parâmetros na proposta final.

### D) MARKUP sobre custo em toda a proposta (coerente com o custeio)
- **Fórmula:** lab = preço já formado (markup no custeio); `projeto = custoProjeto × (1 + Σ/100)`;
  `totalFinal = labPreço + projetoMarkup`. (Ou, variante: `subtotalCusto × (1+Σ)`.)
- **Exemplo:** `projeto = 200 × 1,20 = 240`; `total = 100 + 240 = ` **340,00**.
- **Vantagens:** **mesma operação** (markup) do custeio → coerência ponta a ponta;
  mais fácil de explicar ao cliente.
- **Riscos:** subtributa quando impostos deveriam ser "por dentro" (gross-up).
- **Impacto em propostas antigas:** muda total (menor que C/B/A).
- **Compatibilidade com a planilha:** **maior** no nível da amostra (a planilha usa
  markup); confirmar o tratamento do projeto no .xlsm.
- **Snapshots/Exports:** trocar gross-up por markup no projeto.
- **Decisão que exige aprovação:** usar markup (não gross-up) no projeto.

## 4. Tabela comparativa (cenário do §2)

| Alt. | Operação | Laboratório recebe parâmetros? | Projeto | **Total final** | Engine no código |
|------|----------|:--:|---------|---------:|------------------|
| A | gross-up no total | sim | gross-up | **375,00** | — (não existe) |
| B | gross-up (tributos) + markup (margem) | sim (base custo) | misto | **366,67** | `consolidarEconomiaOrcamento` (não-produção) |
| **C** | gross-up só no projeto | **não** | gross-up | **350,00** | `consolidarOrcamentoFinal` (**produção**) |
| D | markup no projeto | não | markup | **340,00** | parcial (custeio usa markup) |

Materialidade: spread de **340 → 375** (~10%) só pela política. A escolha é relevante.

## 5. Compatibilidade com a planilha `Laboratorio1.xlsm`

- O custeio (`costing/engine.ts`) **replica a planilha** no nível da amostra e usa
  **markup** (`preço = custo × (1+Σ)`). Isso favorece **D** (ou C, que preserva o
  preço de bancada) no nível laboratorial.
- O tratamento do **projeto/proposta** na planilha (markup vs gross-up) **precisa
  ser confirmado abrindo o `Laboratorio1.xlsm`** — não foi possível verificar
  automaticamente nesta entrega. **Item de aprovação/validação.**

## 6. O que está implementado AGORA (pós-decisão)

**Alternativa A.** A engine autoritativa é `engine-economica.ts`
(`calcularPropostaEconomica`): `subtotal = custoLabTécnico + custoDiretoProjeto`;
`totalFinal = subtotal / (1 − Σ/100)`; cada parâmetro = `totalFinal × %`; bloqueio
quando Σ ≥ 100%. `consolidarOrcamentoFinal` e a emissão usam **esta** engine.

Engines/adapters rebaixados a **legado** (`@deprecated`, só compat./testes):
`consolidarEconomiaOrcamento` (Alt. B) e `aplicarParametrosDoOrcamento`/
`adaptarOrcamentoParaEntradaParametros` (Alt. C). **Não recalculam** propostas
históricas; snapshots antigos são lidos no modo legado em `/orcamento/final/[id]`.

## 7. Respostas às perguntas (decididas)

1. **Política:** **A**.
2. **Laboratório na proposta:** recebe parâmetros, entrando como **custo técnico**.
3. **Projeto:** **custo direto**; gross-up **único** sobre lab + projeto.

## 8. Decisões registradas

- Vocabulário de parâmetros da proposta: `impostos_legacy, incubacao, reserva,
  investimentos, lucro` (ordem canônica em `engine-economica.PARAMETROS_PROPOSTA`).
- Bloqueio Σ ≥ 100% centralizado na engine autoritativa.
- Engine B e adapters C ficam como compatibilidade histórica (`@deprecated`).

## 9. Pendências conhecidas

- **Fonte dos parâmetros para propostas só-laboratório:** hoje os percentuais vêm
  do módulo de projeto; para uma proposta sem projeto, é preciso uma fonte de
  parâmetros em nível de proposta (a tratar na unificação de parâmetros).
- **Compatibilidade com `Laboratorio1.xlsm`** no nível do projeto: confirmar
  abrindo a planilha (não verificável automaticamente nesta fase).
- **Reconciliação da “composição comercial”** em `/orcamento/final/[id]`: a tabela
  itemizada soma preços de item (lab a `preco_unitario`) e **não** bate com o
  `total_final` (gross-up sobre custo técnico). Reconciliar no redesign (Fase 10).
