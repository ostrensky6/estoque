# Redesign visual e de layout do Kontrol — Design Spec

Data: 2026-07-02
Status: aprovado para planejamento (usuário pediu execução sem novas perguntas)

## 1. Objetivo

Elevar o Kontrol a um padrão visual profissional e elegante — consistente, sóbrio e
eficiente — em todas as telas, **sem perder nenhuma funcionalidade, campo, ação,
link, permissão ou regra de negócio**. O trabalho é de arquitetura de apresentação:
o que muda é layout, hierarquia, tipografia, cor e componentes; o que não muda é
comportamento, dados e fluxo de servidor.

Dores confirmadas pelo usuário e por diagnóstico do código:

1. **Falta de consistência** entre módulos.
2. **Poluição/densidade** mal controlada (muita cor e texto competindo).
3. **Aparência genérica**, sem salto de elegância.
4. **Fluxos pouco eficientes** em telas de trabalho.

## 2. Diagnóstico do código atual

- 34 páginas com `<h1>` usando 4 combinações distintas de tamanho/peso
  (`text-2xl|3xl` × `bold|semibold`). Não existe componente `PageHeader`.
- Larguras de página inconsistentes: `max-w-5xl`, `max-w-6xl` e sem limite,
  alternando entre rotas vizinhas.
- `Breadcrumbs` presentes em apenas 11 telas (detalhes); listagens não têm.
- Cores hardcoded (`bg-white dark:bg-zinc-900`, `text-slate-500 dark:text-zinc-400`)
  repetidas em centenas de pontos, em vez dos tokens semânticos já definidos em
  `globals.css` (`bg-card`, `text-muted-foreground`, `border-border`). Isso é a
  raiz da colcha de retalhos e do custo de manter o dark mode.
- Dashboard (`src/app/page.tsx`) define localmente `TONS` com 5 paletas decorativas
  e componentes próprios (`Kpi`, `Badge`, `AcaoRapida`, `JornadaCard`,
  `ListaProblemas`) que não são reutilizados em nenhuma outra tela.
- Pontos fortes a preservar: `DataTable` (tanstack, densidade, filtros, mobile
  cards, paginação — já 100% em tokens), `CommandPalette` (Ctrl K), sidebar
  colapsável com persistência, dark mode via `next-themes`, testes axe no
  Playwright, CSS de impressão de orçamentos.

## 3. Decisões de direção (respostas do usuário)

- **Escopo**: app inteiro, por fases (design system primeiro, depois módulo a módulo).
- **Estética**: sóbrio corporativo denso (referência Linear/Notion) — neutros
  dominam; cor aparece apenas com significado (ação, status, alerta, marca).
- **Liberdade estrutural**: reestruturar layout/hierarquia/navegação livremente,
  desde que nenhuma funcionalidade seja perdida.
- **Restrições preservadas** (defaults adotados; tudo já existe no código):
  dark mode completo, impressão de orçamentos intacta, acessibilidade AA
  (axe/Playwright passando), mobile utilizável.

## 4. Linguagem visual

### 4.1 Cor

- Neutro único: a UI usa exclusivamente tokens semânticos (`background`, `card`,
  `border`, `muted`, `foreground`...). Páginas ficam proibidas de usar
  `slate-*`/`zinc-*` diretos; o neutro concreto é decisão do tema, não da tela.
- Novos tokens semânticos de status em `globals.css` (claro + escuro):
  - `--success` (base verde ATGC/leaf), `--warning` (amber), `--info` (teal aqua),
    cada um com `-foreground` e superfície suave (`--success-soft` etc. via
    `color-mix` ou valores explícitos).
- Azul institucional GIA (`--primary`) reservado para: ação primária, link,
  navegação ativa, foco. Nunca decorativo em fundos grandes.
- Gradiente do `app-canvas` mantido, porém mais sutil (elegância discreta).

### 4.2 Tipografia (escala fixa)

| Papel | Classe |
|---|---|
| Título de página | `text-xl font-semibold tracking-tight` (+ `sm:text-2xl` no dashboard) |
| Título de seção/card | `text-sm font-semibold` |
| Corpo | `text-sm` |
| Meta/legenda | `text-xs text-muted-foreground` |
| Números/moeda | `tabular-nums` sempre |

### 4.3 Superfície e espaçamento

- Card padrão: `rounded-lg border bg-card shadow-xs` (sombra mais leve que hoje).
- Ritmo vertical padrão da página: `space-y-6`; interno de card: `p-4`/`p-5`.
- Largura: **todas** as páginas via `PageShell` (ver 5.1) — `default` = `max-w-6xl`,
  `wide` = sem limite (tabelões), `narrow` = `max-w-3xl` (formulários/login).

## 5. Arquitetura de componentes

Nova camada fina em `src/components/app/` (primitivas de página), por cima do
shadcn/ui existente. Nenhuma primitiva contém lógica de dados — apenas layout.

### 5.1 Primitivas

1. **`PageShell`** — `<main>` com largura (`default|wide|narrow`), padding e ritmo
   verticais padronizados. Substitui os `mx-auto max-w-* px-* py-*` ad hoc.
2. **`PageHeader`** — breadcrumbs (opcional), título (h1 na escala fixa),
   descrição curta, slot de ações à direita (botão primário, menu) e slot de meta
   (badges de status/contagem). Usado em 100% das telas.
3. **`SectionCard`** — card com cabeçalho (título, descrição, ação) e conteúdo.
   Substitui os `<section className="rounded-lg border...">` repetidos.
4. **`StatCard`** — KPI: label, valor grande (`tabular-nums`), detalhe, tom
   semântico (`neutral|success|warning|danger|info|brand`) e ícone opcional.
   Substitui o `Kpi` local do dashboard.
5. **`StatusBadge`** — mapeia status de domínio → cor semântica, com dicionário
   central (orçamento: rascunho/enviado/aprovado/perdido; compras:
   solicitado/aprovado/enviado/recebido/cancelado; estoque: quarentena/vencido/
   bloqueado; etc.). Elimina badges coloridos ad hoc e garante que o mesmo status
   tenha sempre a mesma cor no app inteiro.
6. **`EmptyState`** — ícone, título, texto, ação. Unifica os estados vazios
   (DataTable já tem o seu; passa a renderizar este por dentro).
7. **`FilterBar`** — contêiner horizontal para busca + selects + ações de lista
   (a lógica continua no `DataTable`; isto padroniza o posicionamento quando há
   filtros fora dele).

### 5.2 Shell (layout global)

- **Sidebar**: manter todas as funções (collapse persistido, drawer mobile,
  Ctrl K, perfil, sair, toggle de tema, logos GIA/ATGC). Refinar visual: grupos
  sem "caixinhas" com borda (ícone simples + label uppercase menor), menos
  bordas internas, footer mais discreto (logos menores em uma linha), logo do
  app em altura fixa menor. Migrar tudo para tokens.
- **SideNav**: item ativo com indicador de barra à esquerda (mantido), tipografia
  da escala fixa, contagem "N itens" removida do cabeçalho de grupo (ruído).
- **PageLoading**: skeleton em tokens, alinhado ao `PageShell`.

### 5.3 Padrões por tipo de tela

- **Listagem** (ex.: `/analises`, `/insumos`, `/compras`):
  `PageShell` + `PageHeader` (título, contagem em meta, ação primária "Novo…") +
  `DataTable`. Sem hero/textos institucionais longos.
- **Detalhe** (ex.: `/orcamento/[id]`, `/estoque/lotes/[id]`):
  `PageHeader` com breadcrumbs, título + `StatusBadge`, ações no slot direito;
  corpo em grid de `SectionCard` (resumo/meta primeiro, blocos de trabalho depois).
- **Dashboard** (`/`): enxugar o hero (logo + 1 linha de propósito), "Atenção de
  hoje" como faixa de `StatCard`s, ações rápidas compactas, jornadas e listas de
  problemas como `SectionCard`s neutros com `StatusBadge`s. Reduzir drasticamente
  os painéis coloridos decorativos — cor só onde há estado (vencido = danger etc.).
- **Formulário/página estreita** (login, trocar-senha, aprovar/[token]):
  `PageShell narrow`, cartão único centrado.
- **Documento** (`/orcamento/final/[id]` e impressão): tela usa `PageShell wide`;
  `.print-area` e `@media print` permanecem intocados.

## 6. Não-regressão funcional (regra de ouro)

Para cada tela migrada:

1. Inventariar antes: todos os dados exibidos, ações, links, formulários,
   estados condicionais e permissões por papel.
2. Migrar apresentação; reorganizar hierarquia é permitido, remover é proibido.
3. Conferir o inventário depois (mesmos dados, mesmas ações, mesmos destinos).
4. `npm run lint`, `npm test` e Playwright (incl. axe) passando ao fim de cada fase.
5. Nenhuma mudança em: queries Supabase, server actions, schema, RLS, rotas,
   regras de cálculo, exportações (docx/xlsx), impressão.

## 7. Fases de entrega

- **Fase 0 — Fundamentos**: tokens de status em `globals.css`, sombras/gradiente
  refinados, primitivas em `src/components/app/`, `PageLoading` novo.
  (Nenhuma tela muda ainda; zero risco.)
- **Fase 1 — Shell + Dashboard**: Sidebar/SideNav refinados, `/` redesenhado
  com as primitivas. É a vitrine do novo padrão.
- **Fase 2 — Orçamento**: todas as rotas `/orcamento/*`, `/analises`, `/projetos`,
  `/custeio` (fluxo comercial completo).
- **Fase 3 — Cadeia de suprimento**: `/planejamento`, `/estoque`, `/insumos`,
  `/compras`, `/pedido`, `/recebimento`.
- **Fase 4 — Base e suporte**: `/cadastros`, `/usuarios`, `/auditoria`,
  `/governanca`, `/parametros`, `/notificacoes`, `/ajuda`, `/login`,
  `/trocar-senha`, `/aprovar/[token]`.
- Encerramento: varredura anti-`slate-*/zinc-*` em `src/app` e
  `src/components` (exceto tema), revisão visual claro/escuro/mobile/print.

## 8. Fora de escopo

- Novas funcionalidades, mudanças de banco/RLS/migrations, alterações em
  server actions ou regras de cálculo, mudança de stack (permanece Next +
  Tailwind 4 + shadcn/ui + lucide + sonner + recharts).

## 9. Critérios de sucesso

- Nenhum uso direto de `slate-*`/`zinc-*` fora de `globals.css`/tema.
- 100% das páginas com `PageShell` + `PageHeader`; um único padrão de título.
- Mesmo status ⇒ mesma cor em qualquer módulo (`StatusBadge`).
- Testes existentes (unit, e2e, axe) verdes; impressão de orçamento idêntica.
- Leitura subjetiva: telas mais calmas, hierarquia óbvia, produto "premium".
