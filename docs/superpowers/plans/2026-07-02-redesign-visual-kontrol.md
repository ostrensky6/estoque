# Redesign Visual do Kontrol — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar o design system sóbrio definido em `docs/superpowers/specs/2026-07-02-redesign-visual-kontrol-design.md` a todas as telas do Kontrol, sem perda de funcionalidade.

**Architecture:** Camada fina de primitivas de layout (`src/components/app/`) sobre o shadcn/ui existente + tokens semânticos de status em `globals.css`; depois migração mecânica página a página (shell → dashboard → orçamento → suprimento → base), com inventário funcional antes/depois de cada tela.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind 4 (tokens via `@theme inline`), shadcn/ui, lucide-react, vitest, Playwright+axe.

## Global Constraints

- **Nenhuma funcionalidade removida**: todo dado exibido, ação, link, formulário, estado condicional e verificação de papel de cada tela migrada permanece (reorganizar pode; remover não).
- **Proibido** alterar: queries Supabase, server actions, schema/RLS/migrations, rotas, regras de cálculo, exportações docx/xlsx, `@media print` e `.print-area`.
- Páginas e componentes migrados **não usam** `slate-*`/`zinc-*`/`text-white`/`bg-white` diretos — somente tokens (`bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-muted`, tons de status). Exceções permitidas: `globals.css`, `src/components/theme/`, cores de gráficos (recharts) e `brand-*` para marca.
- Tipografia fixa: h1 = `text-xl font-semibold tracking-tight` (dashboard pode `sm:text-2xl`); título de seção = `text-sm font-semibold`; corpo `text-sm`; meta `text-xs text-muted-foreground`; números `tabular-nums`.
- Textos de UI em pt-BR, como o restante do app.
- Ao fim de cada task: `npm run lint` e `npm test` verdes. Commits pequenos e frequentes.

---

### Task 1: Tokens semânticos de status em `globals.css`

**Files:**
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: classes utilitárias Tailwind `bg-success-soft`, `text-success-strong`, `bg-warning-soft`, `text-warning-strong`, `bg-info-soft`, `text-info-strong`, `bg-danger-soft`, `text-danger-strong` (+ `border-*-strong/20`), usadas pelas Tasks 2–4.

- [ ] **Step 1: Adicionar tokens claros em `:root`** (após `--ring: #1b5aac;`):

```css
  /* Tons de status — soft = superfície, strong = texto/ícone (AA sobre soft) */
  --success-soft: #e6f7e6;
  --success-strong: #0a6b0a;
  --warning-soft: #fef3c7;
  --warning-strong: #92400e;
  --info-soft: #e0f5f7;
  --info-strong: #0a727d;
  --danger-soft: #fee2e2;
  --danger-strong: #b91c1c;
```

- [ ] **Step 2: Adicionar tokens escuros em `.dark`** (após `--ring: #2f7fd1;`):

```css
  --success-soft: #122f12;
  --success-strong: #8fda8c;
  --warning-soft: #33230a;
  --warning-strong: #fbbf24;
  --info-soft: #0b2f33;
  --info-strong: #7fd3da;
  --danger-soft: #390f0f;
  --danger-strong: #f87171;
```

- [ ] **Step 3: Mapear no `@theme inline`** (junto aos demais `--color-*`):

```css
  --color-success-soft: var(--success-soft);
  --color-success-strong: var(--success-strong);
  --color-warning-soft: var(--warning-soft);
  --color-warning-strong: var(--warning-strong);
  --color-info-soft: var(--info-soft);
  --color-info-strong: var(--info-strong);
  --color-danger-soft: var(--danger-soft);
  --color-danger-strong: var(--danger-strong);
```

- [ ] **Step 4: Suavizar o gradiente do canvas** — em `.app-canvas`, trocar `0.06`→`0.04` e `0.08`→`0.05`.

- [ ] **Step 5: Verificar e commitar**

Run: `npm run lint && npm test`  → Expected: PASS (nada consome os tokens ainda).

```bash
git add src/app/globals.css
git commit -m "feat(design): tokens semanticos de status (soft/strong) claro+escuro"
```

---

### Task 2: Primitivas `PageShell` e `PageHeader`

**Files:**
- Create: `src/components/app/PageShell.tsx`
- Create: `src/components/app/PageHeader.tsx`

**Interfaces:**
- Consumes: `Breadcrumbs`/`BreadcrumbItem` de `src/components/common/Breadcrumbs.tsx`, `cn` de `src/lib/utils.ts`.
- Produces: `PageShell({ width?: "default"|"wide"|"narrow", className?, children })` e `PageHeader({ breadcrumbs?: BreadcrumbItem[], title: ReactNode, description?: ReactNode, meta?: ReactNode, actions?: ReactNode, className? })` — usados por todas as tasks de migração.

- [ ] **Step 1: Criar `PageShell.tsx`**

```tsx
import { cn } from "@/lib/utils";

const WIDTHS = {
  default: "max-w-6xl",
  wide: "max-w-none",
  narrow: "max-w-3xl",
} as const;

export type PageShellWidth = keyof typeof WIDTHS;

/** Container padrão de página: largura, padding e ritmo vertical únicos no app. */
export function PageShell({
  width = "default",
  className,
  children,
}: {
  width?: PageShellWidth;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <main className={cn("mx-auto w-full space-y-6 px-4 py-6 sm:px-6 sm:py-8", WIDTHS[width], className)}>
      {children}
    </main>
  );
}
```

- [ ] **Step 2: Criar `PageHeader.tsx`**

```tsx
import { Breadcrumbs, type BreadcrumbItem } from "@/components/common/Breadcrumbs";
import { cn } from "@/lib/utils";

/** Cabeçalho padrão: breadcrumbs, h1 na escala fixa, meta (badges) e ações à direita. */
export function PageHeader({
  breadcrumbs,
  title,
  description,
  meta,
  actions,
  className,
}: {
  breadcrumbs?: BreadcrumbItem[];
  title: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("space-y-3", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
            {meta}
          </div>
          {description && (
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Verificar e commitar**

Run: `npm run lint && npm test` → Expected: PASS.

```bash
git add src/components/app/PageShell.tsx src/components/app/PageHeader.tsx
git commit -m "feat(design): primitivas PageShell e PageHeader"
```

---

### Task 3: Primitivas `SectionCard`, `StatCard`, `EmptyState`, `FilterBar`

**Files:**
- Create: `src/components/app/SectionCard.tsx`
- Create: `src/components/app/StatCard.tsx`
- Create: `src/components/app/EmptyState.tsx`
- Create: `src/components/app/FilterBar.tsx`

**Interfaces:**
- Consumes: `cn`, tokens da Task 1, tipo `Tone` (definido em `StatCard.tsx` e reexportado).
- Produces:
  - `type Tone = "neutral"|"success"|"warning"|"danger"|"info"|"brand"`
  - `SectionCard({ title?, description?, actions?, children, className?, contentClassName? })`
  - `StatCard({ label, value, detail?, tone?, icon? })`
  - `EmptyState({ icon?, title, description?, action?, className? })`
  - `FilterBar({ children, className? })`

- [ ] **Step 1: Criar `StatCard.tsx`** (define `Tone`, usado pelos demais)

```tsx
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";

const DOT: Record<Tone, string> = {
  neutral: "bg-muted-foreground/50",
  success: "bg-success-strong",
  warning: "bg-warning-strong",
  danger: "bg-danger-strong",
  info: "bg-info-strong",
  brand: "bg-primary",
};

const VALUE: Record<Tone, string> = {
  neutral: "text-foreground",
  success: "text-foreground",
  warning: "text-foreground",
  danger: "text-danger-strong",
  info: "text-foreground",
  brand: "text-foreground",
};

/** KPI padrão: label discreto, valor tabular grande, detalhe opcional. Cor só no ponto de estado. */
export function StatCard({
  label,
  value,
  detail,
  tone = "neutral",
  icon: Icon,
  className,
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  tone?: Tone;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-4 shadow-xs", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {Icon ? (
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : (
          <span className={cn("h-2 w-2 shrink-0 rounded-full", DOT[tone])} aria-hidden="true" />
        )}
      </div>
      <div className={cn("mt-2 text-2xl font-semibold tracking-tight tabular-nums", VALUE[tone])}>
        {value}
      </div>
      {detail && <p className="mt-1 text-xs leading-snug text-muted-foreground">{detail}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Criar `SectionCard.tsx`**

```tsx
import { cn } from "@/lib/utils";

/** Card de seção com cabeçalho padronizado. Substitui <section className="rounded-lg border..."> ad hoc. */
export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const hasHeader = Boolean(title || description || actions);
  return (
    <section className={cn("rounded-lg border border-border bg-card text-card-foreground shadow-xs", className)}>
      {hasHeader && (
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 border-b border-border/70 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-foreground">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn("p-4 sm:p-5", contentClassName)}>{children}</div>
    </section>
  );
}
```

- [ ] **Step 3: Criar `EmptyState.tsx`**

```tsx
import { SearchX, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Estado vazio padrão para listas, tabelas e seções sem dados. */
export function EmptyState({
  icon: Icon = SearchX,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto flex max-w-sm flex-col items-center gap-2 py-8 text-center", className)}>
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}
```

- [ ] **Step 4: Criar `FilterBar.tsx`**

```tsx
import { cn } from "@/lib/utils";

/** Linha padrão de busca/filtros/ações acima de listas. */
export function FilterBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center gap-2", className)}>{children}</div>;
}
```

- [ ] **Step 5: Verificar e commitar**

Run: `npm run lint && npm test` → Expected: PASS.

```bash
git add src/components/app
git commit -m "feat(design): primitivas SectionCard, StatCard, EmptyState e FilterBar"
```

---

### Task 4: `StatusBadge` com dicionário central + teste

**Files:**
- Create: `src/components/app/status.ts` (dicionário puro, testável)
- Create: `src/components/app/StatusBadge.tsx`
- Test: `src/components/app/status.test.ts`

**Interfaces:**
- Consumes: `Tone` de `StatCard.tsx`.
- Produces: `statusInfo(status: string): { label: string; tone: Tone }`, `StatusBadge({ status, label?, className? })`.

- [ ] **Step 1: Levantar os status reais do domínio**

Run: `grep -rhoE "status\s*(===|!==|==)\s*['\"][a-z_]+['\"]" src --include=*.ts --include=*.tsx | grep -oE "['\"][a-z_]+['\"]$" | sort -u`
e `grep -rhoE "\.in\(\s*\"status\",\s*\[[^\]]+\]" src | sort -u`

Anotar todos os literais; o dicionário do Step 2 deve conter **todos** eles (os já conhecidos estão listados; acrescentar os que o grep revelar).

- [ ] **Step 2: Escrever o teste que falha** — `src/components/app/status.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { statusInfo } from "./status";

describe("statusInfo", () => {
  it("mapeia status conhecidos para tom e rótulo", () => {
    expect(statusInfo("aprovado")).toEqual({ label: "Aprovado", tone: "success" });
    expect(statusInfo("rascunho")).toEqual({ label: "Rascunho", tone: "neutral" });
    expect(statusInfo("vencido")).toEqual({ label: "Vencido", tone: "danger" });
    expect(statusInfo("enviado")).toEqual({ label: "Enviado", tone: "info" });
  });

  it("faz fallback neutro com o proprio texto para status desconhecido", () => {
    expect(statusInfo("qualquer_coisa")).toEqual({ label: "qualquer_coisa", tone: "neutral" });
  });
});
```

Run: `npm test` → Expected: FAIL (`Cannot find module './status'`).

- [ ] **Step 3: Criar `status.ts`** (estender com os achados do Step 1)

```ts
import type { Tone } from "@/components/app/StatCard";

export type StatusInfo = { label: string; tone: Tone };

/** Dicionário único status→cor: o mesmo status tem sempre a mesma cor no app inteiro. */
const STATUS: Record<string, StatusInfo> = {
  // Orçamento
  rascunho: { label: "Rascunho", tone: "neutral" },
  em_elaboracao: { label: "Em elaboração", tone: "neutral" },
  em_revisao: { label: "Em revisão", tone: "warning" },
  enviado: { label: "Enviado", tone: "info" },
  emitido: { label: "Emitido", tone: "info" },
  aprovado: { label: "Aprovado", tone: "success" },
  perdido: { label: "Perdido", tone: "danger" },
  cancelado: { label: "Cancelado", tone: "danger" },
  // Compras/pedidos
  solicitado: { label: "Solicitado", tone: "warning" },
  recebido: { label: "Recebido", tone: "success" },
  parcial: { label: "Parcial", tone: "warning" },
  // Estoque
  quarentena: { label: "Quarentena", tone: "warning" },
  bloqueado: { label: "Bloqueado", tone: "danger" },
  vencido: { label: "Vencido", tone: "danger" },
  reposicao: { label: "Reposição", tone: "warning" },
  sem_validade: { label: "Sem validade", tone: "warning" },
  ativo: { label: "Ativo", tone: "success" },
  inativo: { label: "Inativo", tone: "neutral" },
};

export function statusInfo(status: string): StatusInfo {
  return STATUS[status] ?? { label: status, tone: "neutral" };
}
```

- [ ] **Step 4: Rodar o teste** — Run: `npm test` → Expected: PASS.

- [ ] **Step 5: Criar `StatusBadge.tsx`**

```tsx
import { cn } from "@/lib/utils";
import type { Tone } from "@/components/app/StatCard";
import { statusInfo } from "@/components/app/status";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-success-soft text-success-strong",
  warning: "bg-warning-soft text-warning-strong",
  danger: "bg-danger-soft text-danger-strong",
  info: "bg-info-soft text-info-strong",
  brand: "bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300",
};

/** Badge de status de domínio. `label` sobrepõe o rótulo do dicionário quando necessário. */
export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  label?: string;
  className?: string;
}) {
  const info = statusInfo(status);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        TONE_CLASSES[info.tone],
        className,
      )}
    >
      {label ?? info.label}
    </span>
  );
}
```

- [ ] **Step 6: Verificar e commitar**

Run: `npm run lint && npm test` → Expected: PASS.

```bash
git add src/components/app/status.ts src/components/app/status.test.ts src/components/app/StatusBadge.tsx
git commit -m "feat(design): StatusBadge com dicionario central status->tom"
```

---

### Task 5: `PageLoading` em tokens

**Files:**
- Modify: `src/components/common/PageLoading.tsx`

**Interfaces:**
- Consumes: nada novo. Produces: mesma assinatura `PageLoading({ title? })`.

- [ ] **Step 1: Reescrever com tokens** — substituir todas as classes `slate-*`/`zinc-*`/`bg-white` por: container `mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8`; barras `animate-pulse rounded bg-muted`; cards `rounded-lg border border-border bg-card p-4 shadow-xs`. Estrutura (título + 3 cards + tabela) permanece.

- [ ] **Step 2: Verificar e commitar**

Run: `npm run lint && npm test` → PASS.

```bash
git add src/components/common/PageLoading.tsx
git commit -m "refactor(design): PageLoading com tokens semanticos"
```

---

### Task 6: Shell — refinamento visual de `Sidebar` e `SideNav`

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/layout/SideNav.tsx`

**Regra:** manter TODAS as funções: collapse persistido em localStorage, drawer mobile, abertura da paleta (Ctrl K), perfil/papel, sair, ThemeToggle, logos GIA/ATGC, atalhos `kbd`, grupos abre/fecha persistidos, indicador de item ativo, `aria-*`.

- [ ] **Step 1: `SideNav.tsx` — cabeçalho de grupo mais leve**

Substituir o bloco do ícone "caixinha" (span com `border ... h-7 w-7`) e o "`{g.links.length} itens`" por uma linha única discreta. O botão do grupo vira:

```tsx
<button
  type="button"
  onClick={() => alternarGrupo(g.title)}
  aria-expanded={aberto}
  className={cn(
    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted/60",
    aberto || temLinkAtivo ? "text-foreground" : "text-muted-foreground",
  )}
>
  <GrupoIcone
    className={cn("h-3.5 w-3.5 shrink-0", temLinkAtivo ? "text-primary" : "text-muted-foreground")}
    aria-hidden="true"
  />
  <span className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-wider">
    {g.title}
  </span>
  <ChevronDown
    className={cn("h-3.5 w-3.5 text-muted-foreground/70 transition-transform", aberto && "rotate-180")}
  />
</button>
```

- [ ] **Step 2: `SideNav.tsx` — trocar todas as classes `slate-*`/`zinc-*` restantes por tokens**: itens ativos `bg-primary/10 text-primary` (claro e escuro), hover `hover:bg-muted/60 hover:text-foreground`, bordas `border-border/70`, barra ativa `bg-primary`, `kbd` `border-border bg-muted text-muted-foreground`. Modo `collapsed` idem.

- [ ] **Step 3: `Sidebar.tsx` — tokens e chrome mais discreto**: `aside` com `border-border bg-card` (sombra atual mantida); divisórias internas `border-border/70`; logo do app com `w-40` (expandida); botão de busca com `bg-background text-muted-foreground`; footer com logos `h-8` e textos já em `text-muted-foreground`; botão "Sair" `text-muted-foreground hover:bg-danger-soft hover:text-danger-strong`. Barra superior mobile: `border-border bg-card/95`.

- [ ] **Step 4: Verificação funcional manual (preview)** — subir dev server e conferir: expandir/colapsar persiste após reload; drawer mobile abre/fecha; Ctrl K abre paleta; grupos persistem; item ativo destacado; dark mode ok.

- [ ] **Step 5: Verificar e commitar**

Run: `npm run lint && npm test` → PASS. Run: `npx playwright test e2e/a11y.spec.ts` → PASS.

```bash
git add src/components/layout
git commit -m "refactor(design): shell sobrio em tokens (Sidebar/SideNav), sem mudanca funcional"
```

---

### Task 7: Dashboard (`/`) redesenhado com as primitivas

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `PageShell`, `PageHeader`, `SectionCard`, `StatCard`, `StatusBadge`, `EmptyState`.

**Inventário a preservar (conferir no fim):** contagens (análises ativas, planejamentos, insumos monitorados, status geral), KPIs de atenção (reposição, vencidos, sem disponível, pedidos), 5 ações rápidas com destinos, KPIs executivos (comprar agora, vencendo, quarentena, cobertura, estoque ativo, vencendo R$, compras abertas, margem média), `ExecutiveCharts` (gastos+funil), 2 jornadas com todos os passos/links, 4 listas de problemas com itens e links, bloco Base de controle (3 links). Queries intocadas.

- [ ] **Step 1: Reescrever o render** mantendo todo o bloco de dados (imports, types, queries, derivações) e removendo `TONS`, `Badge`, `Kpi`, `AcaoRapida`, `JornadaCard`, `ListaProblemas` locais. Novo esqueleto:

```tsx
return (
  <PageShell>
    <PageHeader
      title="Painel de decisão operacional"
      description="Orçamento, planejamento, estoque e compras no mesmo fluxo de decisão."
      meta={<StatusBadge status={alertas.length > 0 ? "reposicao" : "ativo"} label={statusGeral} />}
    />

    {/* Atenção de hoje: KPIs de estado */}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Reposição" value={alertasReposicao.length} detail="abaixo do ponto configurado" tone={alertasReposicao.length ? "warning" : "neutral"} />
      <StatCard label="Vencidos" value={alertasVencidos.length + alertasSemValidade.length} detail="vencidos ou críticos sem validade" tone={alertasVencidos.length + alertasSemValidade.length ? "danger" : "neutral"} />
      <StatCard label="Sem disponível" value={semDisponivel.length} detail={`${pct(semDisponivel.length, saldo.length)} dos insumos`} tone={semDisponivel.length ? "danger" : "neutral"} />
      <StatCard label="Pedidos abertos" value={pedidos.length} detail="solicitados, aprovados ou enviados" tone={pedidos.length ? "info" : "neutral"} />
    </div>

    {/* Ações rápidas: 5 links compactos (mesmos destinos) */}
    {/* Dashboard executivo: SectionCard com grid de StatCard + ExecutiveCharts */}
    {/* Jornadas: 2 SectionCards com os mesmos passos numerados/links */}
    {/* Listas de problemas: 4 SectionCards; itens vazios usam EmptyState */}
    {/* Base de controle: SectionCard com os 3 links */}
  </PageShell>
);
```

Ações rápidas (padrão para os 5 itens atuais, mesmos href/título/desc/ícone):

```tsx
<Link
  href={href}
  className="group flex min-w-52 flex-1 items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-xs transition-colors hover:bg-muted/50"
>
  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground group-hover:text-foreground">
    <Icon className="h-4 w-4" />
  </span>
  <span className="min-w-0 flex-1">
    <span className="block truncate text-sm font-semibold text-foreground">{titulo}</span>
    <span className="block truncate text-xs text-muted-foreground">{desc}</span>
  </span>
  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
</Link>
```

Passos de jornada: item numerado `flex gap-3 rounded-md border border-border/70 p-3 hover:bg-muted/50`, número em `bg-muted text-muted-foreground`; título `text-sm font-medium text-foreground`, desc `text-xs text-muted-foreground`. Listas de problemas: itens `rounded-md bg-muted/50 px-3 py-2` com título `text-sm font-medium` e meta `text-xs text-muted-foreground`; badges de alerta via `StatusBadge`.

O hero institucional longo (logo grande + parágrafo) sai; o propósito fica na `description` do `PageHeader` (o logo já existe na sidebar). Nada de dado/link é perdido — os textos das jornadas permanecem nos cards.

- [ ] **Step 2: Conferir inventário** — comparar com a lista acima; todos os números, links e textos presentes.

- [ ] **Step 3: Verificação visual (preview)** — claro/escuro/mobile; console sem erros.

- [ ] **Step 4: Verificar e commitar**

Run: `npm run lint && npm test && npx playwright test e2e/a11y.spec.ts` → PASS.

```bash
git add src/app/page.tsx
git commit -m "redesign(dashboard): painel sobrio com primitivas do design system"
```

---

### Receita de migração de página (usada nas Tasks 8–11)

Para **cada** página listada na task:

1. **Inventariar**: ler o arquivo inteiro; listar dados exibidos, ações/botões, links, formulários, condicionais de papel/estado.
2. **Converter estrutura**:
   - wrapper `<main className="mx-auto max-w-...">` → `<PageShell>` (`wide` para telas de tabelões/documento; `narrow` para formulário isolado).
   - bloco de título/h1/descrição/botões → `<PageHeader breadcrumbs={...} title description actions meta>`; listagens ganham breadcrumbs de 1 nível (ex.: `[{ label: "Análises" }]`).
   - `<section className="rounded-lg border ...">` → `<SectionCard title description actions>`.
   - KPIs/cartões numéricos ad hoc → `<StatCard>`.
   - badges de status coloridos ad hoc → `<StatusBadge status={...}>` (estender `status.ts` se surgir status novo — com teste).
   - estados vazios ad hoc → `<EmptyState>`.
3. **Trocar cores**: toda classe `slate-*`/`zinc-*`/`bg-white`/`text-white` → token equivalente (`text-muted-foreground`, `bg-card`, `bg-muted`, `border-border`, `text-foreground`, tons soft/strong). Verificar com: `grep -nE "slate-|zinc-" <arquivo>` → deve retornar vazio.
4. **Componentes-filho** (em `src/components/<modulo>/`) usados pela página: aplicar o passo 3 neles também.
5. **Conferir inventário** do passo 1 contra o resultado.
6. Run: `npm run lint && npm test` → PASS. Commit: `redesign(<modulo>): <paginas> no padrao do design system`.

Ao final de cada task de fase: `npx playwright test` (inclui axe) → PASS; conferência visual claro/escuro/mobile no preview das rotas migradas.

---

### Task 8: Fase 2 — módulo comercial (Orçamento)

**Files (Modify):** `src/app/orcamento/page.tsx`, `orcamento/[id]/page.tsx`, `orcamento/demandas/page.tsx`, `orcamento/demandas/[id]/page.tsx`, `orcamento/decididos/page.tsx`, `orcamento/em-elaboracao/page.tsx`, `orcamento/emitidos/page.tsx`, `orcamento/final/[id]/page.tsx`, `orcamento/governanca/page.tsx`, `orcamento/historico/page.tsx`, `orcamento/modelos/page.tsx`, `orcamento/parametros/page.tsx`, `orcamento/projetos/page.tsx`, `orcamento/projetos/[id]/page.tsx`, `orcamento/revisao/page.tsx`, `src/app/analises/page.tsx`, `analises/[codigo]/page.tsx`, `src/app/projetos/page.tsx`, `projetos/[id]/page.tsx`, `src/app/custeio/page.tsx` + componentes em `src/components/orcamento/`, `src/components/analises/`, `src/components/custeio/` que tiverem classes hardcoded.

- [ ] **Step 1–N:** aplicar a Receita de migração a cada página, uma por commit (agrupar rotas irmãs pequenas no mesmo commit é aceitável, ex.: as listas `decididos/em-elaboracao/emitidos`).
- [ ] **Atenção especial:** `orcamento/final/[id]` e componentes de impressão — `.print-area`, `@media print` e botões de exportação intocados; migrar apenas o chrome da tela. Validar: `npx playwright test e2e/orcamento-pdf.spec.ts` → PASS.
- [ ] **Fechamento da fase:** `npx playwright test` → PASS; `grep -rnE "slate-|zinc-" src/app/orcamento src/app/analises src/app/projetos src/app/custeio src/components/orcamento src/components/analises src/components/custeio` → vazio.

---

### Task 9: Fase 3 — cadeia de suprimento

**Files (Modify):** `src/app/planejamento/page.tsx`, `planejamento/[id]/page.tsx`, `src/app/estoque/page.tsx`, `estoque/lotes/[id]/page.tsx`, `src/app/insumos/page.tsx`, `src/app/compras/page.tsx`, `compras/[id]/page.tsx`, `src/app/pedido/page.tsx`, `pedido/[id]/page.tsx`, `src/app/recebimento/page.tsx` + componentes em `src/components/estoque/`, `src/components/insumos/`, `src/components/compras/`, `src/components/pedido/`, `src/components/planejamento/`.

- [ ] **Step 1–N:** Receita de migração por página; status de compras/estoque passam por `StatusBadge` (estender dicionário + teste se necessário).
- [ ] **Fechamento da fase:** `npx playwright test e2e/estoque-ciclo.spec.ts e2e/a11y.spec.ts` → PASS; grep anti-slate/zinc nas pastas da fase → vazio.

---

### Task 10: Fase 4 — base, governança e acesso

**Files (Modify):** `src/app/cadastros/page.tsx`, `cadastros/[slug]/page.tsx`, `src/app/usuarios/page.tsx`, `src/app/auditoria/page.tsx`, `src/app/governanca/backups/page.tsx`, `src/app/parametros/page.tsx`, `src/app/notificacoes/page.tsx`, `src/app/ajuda/page.tsx`, `src/app/login/page.tsx`, `src/app/trocar-senha/page.tsx`, `src/app/aprovar/[token]/page.tsx` + componentes em `src/components/cadastros/`, `usuarios/`, `auditoria/`, `governanca/`, `parametros/`, `ajuda/`.

- [ ] **Step 1–N:** Receita de migração. `login`, `trocar-senha` e `aprovar/[token]` usam `PageShell narrow` com cartão único centrado (estes três não têm sidebar — manter esse comportamento do layout).
- [ ] **Fechamento da fase:** `npx playwright test` → PASS; grep anti-slate/zinc nas pastas da fase → vazio.

---

### Task 11: Varredura final e verificação global

- [ ] **Step 1: Varredura anti-cor-direta**

Run: `grep -rnE "slate-|zinc-" src/app src/components --include=*.tsx | grep -vE "globals.css|components/theme|Charts"`
Expected: vazio (exceções documentadas no Global Constraints).

- [ ] **Step 2: Verificação completa**

Run: `npm run lint && npm test && npm run build && npx playwright test`
Expected: tudo PASS.

- [ ] **Step 3: Revisão visual final (preview)** — dashboard, uma listagem, um detalhe, um formulário e a tela de documento em claro/escuro/mobile; impressão do orçamento conferida.

- [ ] **Step 4: Commit final + atualização de docs**

Adicionar seção curta "Design system" no `README.md` (primitivas em `src/components/app/`, regra de tokens, escala tipográfica).

```bash
git add -A
git commit -m "docs(design): guia rapido do design system e varredura final"
```
