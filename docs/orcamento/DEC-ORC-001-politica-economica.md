# DEC-ORC-001 — Política econômica autoritativa (decisão pendente)

Data: 2026-06-24 · Status: **PROPOSTA / aguardando aprovação do usuário**
Relacionado: [inventário das engines](2026-06-24-inventario-engines-economicas.md)

> Esta decisão escolhe **uma** política de cálculo para a engine econômica
> autoritativa. **Nada foi trocado.** A engine de produção segue a Alternativa C
> (ver §6). A implementação só ocorre após aprovação explícita.

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

### A) Todos os percentuais em GROSS-UP sobre o total final
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

### C) Laboratório já precificado; parâmetros aplicados APENAS ao projeto  ✅ *(implementada hoje)*
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

## 6. O que está implementado HOJE

**Alternativa C.** `consolidarOrcamentoFinal` usa `aplicarParametrosEconomicos`
com `laboratorio.modo = PRECO_JA_FORMADO` (lab não recebe parâmetros) e os 5
parâmetros com `base = APENAS_PROJETO` em **gross-up**. O total final é
`labPreço + projeto/(1−Σ/100)`. A engine `consolidarEconomiaOrcamento` (Alt. B)
existe mas **não é usada** em produção.

## 7. Recomendação técnica preliminar (não é decisão)

- **Manter a Alternativa C como base** (é a atual; não muda propostas antigas),
  **formalizá-la** como engine autoritativa única e **transformar a engine B
  (`consolidarEconomiaOrcamento`) em adapter de compatibilidade ou removê-la**.
- **Antes de fixar**, validar dois pontos com o usuário e com a planilha:
  1. Laboratório **não** deve receber parâmetros na proposta (confirma C vs A/B)?
  2. Projeto usa **gross-up** (C) ou **markup** (D)? — depende do que a planilha faz.
- Unificar o vocabulário de parâmetros (custeio × projeto) e o bloqueio Σ≥100%
  num único ponto.

## 8. Decisões que precisam da sua aprovação explícita

1. **Política:** A, B, **C** (atual) ou D?
2. **Laboratório na proposta final:** preço já formado (não recebe parâmetros) **ou**
   recebe parâmetros?
3. **Projeto:** gross-up **ou** markup?
4. **Vocabulário único** de parâmetros e mapeamento custeio↔projeto.
5. **Destino da engine B** (`consolidarEconomiaOrcamento`): adapter de
   compatibilidade ou remoção.

> Após sua escolha, implemento a engine autoritativa única (com testes de valores
> conhecidos e snapshot reproduzível), mantendo as antigas como adapters quando
> necessário — **sem recalcular propostas históricas**.
