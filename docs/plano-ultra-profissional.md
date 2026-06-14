# Plano ultra-profissional — Lab Custos & Estoque

> Roadmap de evolução do app para nível de classe mundial, derivado da auditoria
> de produto. Cada item tem **critério de "pronto"** verificável. Este documento é
> versionado junto ao código — atualize o status conforme avança.

## Enquadramento

O app é, ao mesmo tempo:
- **CPQ** (configure-price-quote): custeio e orçamento de análises;
- **LIMS-lite**: lotes, FEFO, validade, quarentena;
- **ERP-lite de suprimentos**: planejamento, reserva, compras.

A barra de qualidade é Benchling / Labguru / Odoo / um CPQ moderno.

Cadeia de valor: `custo analítico (reagentes + equipamento + pessoal) → + overhead
= custo total → × (1 + Σ fatores) = preço de venda`.

## Estado atual (2026-06-13)

Base de código real em `main` (≈ commit `3b44787`): migrations `0001`–`0009`,
e os módulos /orcamento, /custeio, /analises, /planejamento, /estoque, /compras,
/cadastros, /insumos, /auditoria, /usuarios, /login. Engine de custeio em
`src/lib/costing/`. Auth + papéis (técnico < coordenador < gestor < admin), RLS
`authenticated_all`, auditoria por trigger.

> Nota histórica: trabalho já feito mas perdido por não ter sido commitado (a
> tela de Parâmetros e este próprio plano viviam só em worktrees descartados).
> **Commitar cada incremento** é parte do "pronto".

### Legenda de status
`[x]` pronto e verificado · `[~]` parcial · `[ ]` a fazer

---

## Fase 0 — Negócio (rápido, alto impacto)

- [x] **Não vazar custo no PDF do orçamento.** A coluna "Custo/amostra" e o total
  de custo agora têm `no-print`; o cliente vê só Análise, Preço/amostra, Amostras,
  Subtotal e Total.
  *Pronto:* na impressão de `/orcamento/[id]` nenhuma informação de custo aparece;
  na tela (uso interno) o custo continua visível. ✅ verificado por inspeção do DOM.
- [x] **Tela de Parâmetros.** `/parametros` edita os 5 fatores de preço
  (margem, impostos, taxas, fundo de reserva, fundo de investimento) e os
  operacionais (dias úteis/ano etc.), com soma de markup ao vivo e exemplo.
  *Pronto:* salvar recalcula custeio/orçamentos/análises. ✅ verificado: margem 30%
  → /custeio R$ 99,71 → R$ 129,63.
- [ ] **Fatores de preço reais.** Os 5 fatores estão em 0 no seed (preço == custo).
  O laboratório precisa preencher os valores reais em `/parametros`.
  *Pronto:* Σ fatores > 0 reflete a política comercial; preço de venda ≠ custo.
- [x] **Confirmação ao excluir.** Novo `ConfirmActionButton`
  (`src/components/common/`) com modal custom, usado em "Excluir orçamento" e
  "Excluir plano".
  *Pronto:* exclusões pedem confirmação sem `confirm()` nativo. ✅
  *Resta:* o "Iniciar (baixa definitiva)" em `PlanoAcoes` ainda usa `confirm()`
  nativo — migrar para o mesmo modal.
- [ ] **`grupo_escolha` como combobox.** Hoje é texto livre em `/insumos` — digitar
  errado quebra o agrupamento silenciosamente.
  *Pronto:* seleção a partir dos grupos existentes (+ criar novo explicitamente).
- [ ] **Tag dos reagentes de sequenciamento.** Kits MiSeq / flow cell sem
  `grupo_escolha`/`modo_cobranca=por_execucao` inflam o custo (ver
  `achados-dados-planilha`).
  *Pronto:* MiSeq num grupo de escolha + `por_execucao`; custo/amostra cai com o lote.

## Fase 1 — Fundações de engenharia

- [ ] **Design system (shadcn/ui + Radix).** Hoje há mistura de `slate`/`zinc`.
  *Pronto:* tokens unificados; componentes base (Button, Input, Dialog, Table,
  Select, Toast) num só lugar; paleta única.
- [ ] **Tabelas com busca/ordenação/filtro (TanStack Table).**
  *Pronto:* /custeio, /cadastros, /estoque, /compras com busca e ordenação por coluna.
- [ ] **Paleta de comandos ⌘K (cmdk).** *Pronto:* navegar e abrir ações por teclado.
- [ ] **Menu mobile.** *Pronto:* nav lateral colapsa em drawer < md; testado em 375px.
- [ ] **RLS por papel.** Parar de usar service-role em escritas comuns; políticas
  por papel (ex.: bloquear/descartar lote só gestor+).
  *Pronto:* nenhuma escrita de fluxo usa service-role; políticas testadas por papel.
- [ ] **Testes (Vitest + Playwright).**
  *Pronto:* engine de custeio coberta por unit tests (casos da planilha como
  golden); 1 e2e do fluxo orçamento→PDF e do ciclo de estoque.
- [ ] **CI/CD.** *Pronto:* PR roda lint + tsc + testes + build; deploy só com verde.
- [ ] **Observabilidade (Sentry + PostHog).** *Pronto:* erros e eventos-chave
  capturados em produção.

## Fase 2 — Integração entre módulos

- [ ] **Hub de Projeto `/projetos/[id]`.** Tela de payoff que amarra orçamentos,
  planos e compras de um projeto.
  *Pronto:* abrir um projeto mostra seus orçamentos/planos/pedidos e o status geral.
- [ ] **Orçamento aprovado → gerar plano.** *Pronto:* 1 clique cria o plano com as
  análises e amostras do orçamento.
- [ ] **Falta do plano → gerar pedido de compra.** *Pronto:* faltas viram itens de pedido.
- [ ] **Recebimento único.** *Pronto:* receber pedido cria lote (quarentena) sem
  retrabalho manual.
- [ ] **Ponte de unidades insumo↔MCA.** *Pronto:* baixa de estoque na unidade certa
  mesmo quando a MCA usa unidade diferente da embalagem (ver `estoque-design` D3).

## Fase 3 — Profundidade de domínio

- [ ] **Editor de receita de análise.** Etapas/equipamentos/materiais editáveis
  (hoje só importados).
  *Pronto:* criar/editar uma análise pela UI recalcula custo automaticamente.
- [ ] **PDFs com marca + numeração server-side.** *Pronto:* documento com logo,
  numeração e geração no servidor (não só `window.print`).
- [ ] **Lote grau-LIMS.** Histórico por lote, ajuste de inventário, código de
  barras/QR.
  *Pronto:* rastrear um lote do recebimento ao consumo, com ajustes auditados.

## Fase 4 — Inteligência

- [ ] **Cobertura e consumo médio.** *Pronto:* dias de cobertura por insumo a partir
  do consumo histórico.
- [ ] **Reposição automática (pg_cron).** *Pronto:* sugestão/pedido gerado por
  agendamento quando disponível ≤ ponto.
- [ ] **Notificações (Resend).** *Pronto:* alerta de vencimento/reposição por e-mail.
- [ ] **Dashboards (Recharts).** *Pronto:* painéis de custo, consumo e estoque.
- [ ] **Simulador de custeio interativo.** Lote editável + curva de custo.
  *Pronto:* deslizar o tamanho do lote atualiza o custo/amostra ao vivo.
  (Já existe um esboço no branch `claude/angry-mendeleev-08b54f`, commit `bc13341` —
  avaliar e integrar.)

## Fase 5 — Acabamento

- [ ] **Acessibilidade AA.** *Pronto:* contraste, foco visível e navegação por
  teclado em todas as telas.
- [ ] **Convite de usuário.** *Pronto:* admin convida por e-mail (hoje só via dashboard).
- [ ] **i18n.** *Pronto:* strings externalizadas.
- [ ] **Performance.** *Pronto:* sem N+1 nas listas; orçamento e custeio < 1s em prod.

---

## Decisões (travadas em 2026-06-13)

1. **Libs**: abraçar o stack completo — shadcn/ui + Radix + TanStack Table + cmdk
   + sonner + next-themes.
2. **PDF**: server-side (com marca e numeração).
3. **RLS**: política uniforme por papel (Fase 1.5), saindo do service-role.
4. **Previsão**: estatística simples (consumo médio) antes de qualquer ML.
5. **Marca / dados fiscais** dos documentos: **pendente** — o usuário fornece
   antes da Fase 3.2 (logo, CNPJ, textos legais).

## Convenções a preservar

- Ler `node_modules/next/dist/docs/` (Next 16) antes de codar (ver `AGENTS.md`).
- Server Actions + `FormState` (`{ ok, message, errors }`) para feedback inline.
- `createClientUntyped` p/ escrita com auth+auditoria; `createClient` p/ leitura.
- Engine de custeio = funções puras em `src/lib/costing/engine.ts`; tudo deriva de
  `parametros` para simulação em tempo real.
- Cada incremento: `tsc` + `lint` + `build` limpos, verificado por preview, e
  **commitado** (não repetir a perda de trabalho não versionado).
