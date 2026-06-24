# Reorganização da navegação de Orçamentos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar a *proposta* a unidade de navegação dos Orçamentos: remover "Orçamento de projeto" e "Proposta final" do painel esquerdo (viram etapas do workspace da proposta), enxugar o grupo de 11 → 5 itens e transformar os estados do funil em indicadores/filtros dentro de Propostas.

**Architecture:** Mudança de arquitetura de informação + composição de UI, sem mexer no motor de pricing nem no schema. Duas funções puras novas (resumo de funil e montagem de etapas) cobertas por testes; o restante são edições de páginas Next (server components) e redirects de rotas legadas.

**Tech Stack:** Next.js 16.2.9 (App Router, server components), React 19, TypeScript, Tailwind v4, Supabase SSR, Vitest 4 (unit), Playwright (e2e). Ícones lucide-react.

## Global Constraints

- **Next.js é não-padrão:** antes de usar qualquer API de routing/redirect, ler o guia em `node_modules/next/dist/docs/` (instrução de `AGENTS.md`). Heed deprecation notices.
- **Sem alterações destrutivas de banco** e sem tocar no protocolo de migração `orcamento-projetos`. Esta entrega é só IA/UI/routing.
- **Cor de entrada do usuário em azul** (`TOM_ENTRADA` / classe brand) — §8.2 já presente no código; manter ao editar formulários.
- **Rótulos aprovados (verbatim):** etapa de laboratório = **"Orçamento laboratorial"**; etapa de projeto = **"Custos do projeto"**; etapa de parâmetros = **"Parâmetros econômicos"**; etapa final = **"Proposta final"**. "Orçamento" só na consolidação final.
- **Ordem fixa do stepper:** Dados da demanda → Orçamento laboratorial (se houver) → Custos do projeto (se houver) → Parâmetros econômicos → Proposta final.
- **Grupo final do menu (5 itens):** Propostas · Histórico · Parâmetros econômicos · Modelos/Templates · Governança.
- Comandos: `npm test` (vitest), `npm run lint`, `npx tsc --noEmit` para checagem de tipos.

## Assumption (confirmar com o usuário se divergir)

O filtro de status na tela de Propostas opera sobre o **status próprio da demanda**
(`nova`, `em_analise`, `orcada`, `aprovada`, `recusada`, `cancelada`). Os indicadores
do topo são contadores do funil de **documentos** (via `resumirFunilPropostas`). As
rotas legadas de funil (`em-elaboracao`, `revisao`, `emitidos`, `decididos`)
redirecionam para o hub `/orcamento/demandas` (sem deep-link de status, que pode ser
refinado depois). Deep-link `?status=<status_demanda>` é honrado pela tela quando
presente.

## File Structure

- **Criar** `src/lib/orcamento/etapas-proposta.ts` — sets de modalidade + `montarEtapasProposta()`. Responsabilidade única: derivar a sequência condicional de etapas.
- **Criar** `src/lib/orcamento/etapas-proposta.test.ts`
- **Criar** `src/lib/orcamento/funil-propostas.ts` — `resumirFunilPropostas()`. Responsabilidade única: contar documentos por métrica de funil.
- **Criar** `src/lib/orcamento/funil-propostas.test.ts`
- **Modificar** `src/config/navigation.ts` — grupo "Orçamentos" reduzido a 5 itens (CommandPalette herda automaticamente).
- **Modificar** `src/app/orcamento/demandas/page.tsx` — vira hub "Propostas": indicadores de funil + filtro por status.
- **Modificar** `src/app/orcamento/demandas/[id]/page.tsx` — stepper via `montarEtapasProposta`, rótulos aprovados.
- **Modificar** (vira redirect) `src/app/orcamento/page.tsx`, `.../em-elaboracao/page.tsx`, `.../revisao/page.tsx`, `.../emitidos/page.tsx`, `.../decididos/page.tsx`, `.../projetos/page.tsx`, `.../projetos/[id]/page.tsx`.
- **Inalterada** `src/app/orcamento/final/[id]/page.tsx` (página de export, agora alcançada pelo workspace).

---

### Task 1: Função pura `montarEtapasProposta`

**Files:**
- Create: `src/lib/orcamento/etapas-proposta.ts`
- Test: `src/lib/orcamento/etapas-proposta.test.ts`

**Interfaces:**
- Produces:
  - `export const MODALIDADES_COM_ANALISES: Set<string>`
  - `export const MODALIDADES_COM_PROJETO: Set<string>`
  - `export type EtapaProposta = { id: "demanda" | "laboratorio" | "projeto" | "parametros" | "final"; label: string; aplicavel: boolean }`
  - `export function montarEtapasProposta(modalidade: string): EtapaProposta[]` — sempre retorna as 5 etapas na ordem fixa, com `aplicavel` condicional.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/orcamento/etapas-proposta.test.ts
import { describe, expect, it } from "vitest";
import { montarEtapasProposta } from "./etapas-proposta";

const labels = (modalidade: string) =>
  montarEtapasProposta(modalidade).filter((e) => e.aplicavel).map((e) => e.label);

describe("montarEtapasProposta", () => {
  it("apenas análises: laboratório sim, projeto não", () => {
    expect(labels("analises")).toEqual([
      "Dados da demanda",
      "Orçamento laboratorial",
      "Parâmetros econômicos",
      "Proposta final",
    ]);
  });

  it("apenas projeto: projeto sim, laboratório não", () => {
    expect(labels("projeto")).toEqual([
      "Dados da demanda",
      "Custos do projeto",
      "Parâmetros econômicos",
      "Proposta final",
    ]);
  });

  it("projeto com análises: laboratório e projeto", () => {
    expect(labels("projeto_analises_custos")).toEqual([
      "Dados da demanda",
      "Orçamento laboratorial",
      "Custos do projeto",
      "Parâmetros econômicos",
      "Proposta final",
    ]);
  });

  it("ordem e ids são fixos independentemente da modalidade", () => {
    const ids = montarEtapasProposta("analises").map((e) => e.id);
    expect(ids).toEqual(["demanda", "laboratorio", "projeto", "parametros", "final"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/orcamento/etapas-proposta.test.ts`
Expected: FAIL — "Cannot find module './etapas-proposta'".

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/orcamento/etapas-proposta.ts
export const MODALIDADES_COM_ANALISES = new Set([
  "analises",
  "analises_projeto",
  "projeto_analises_custos",
]);
export const MODALIDADES_COM_PROJETO = new Set([
  "projeto",
  "analises_projeto",
  "projeto_analises_custos",
]);

export type EtapaProposta = {
  id: "demanda" | "laboratorio" | "projeto" | "parametros" | "final";
  label: string;
  aplicavel: boolean;
};

export function montarEtapasProposta(modalidade: string): EtapaProposta[] {
  const exigeAnalises = MODALIDADES_COM_ANALISES.has(modalidade);
  const exigeProjeto = MODALIDADES_COM_PROJETO.has(modalidade);
  return [
    { id: "demanda", label: "Dados da demanda", aplicavel: true },
    { id: "laboratorio", label: "Orçamento laboratorial", aplicavel: exigeAnalises },
    { id: "projeto", label: "Custos do projeto", aplicavel: exigeProjeto },
    { id: "parametros", label: "Parâmetros econômicos", aplicavel: true },
    { id: "final", label: "Proposta final", aplicavel: true },
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/orcamento/etapas-proposta.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/orcamento/etapas-proposta.ts src/lib/orcamento/etapas-proposta.test.ts
git commit -m "feat(orcamento): montarEtapasProposta com sequencia condicional por modalidade"
```

---

### Task 2: Função pura `resumirFunilPropostas`

**Files:**
- Create: `src/lib/orcamento/funil-propostas.ts`
- Test: `src/lib/orcamento/funil-propostas.test.ts`

**Interfaces:**
- Consumes: `OrcamentoFila` de `src/lib/orcamento/orcamentos-listagem.ts` (já exportado), que tem `grupo: "em_elaboracao" | "revisao" | "emitidos" | "decididos"` e `status: string`.
- Produces:
  - `export type ResumoFunil = { emElaboracao: number; revisao: number; emitidas: number; aprovadas: number; recusadas: number; concluidas: number }`
  - `export function resumirFunilPropostas(linhas: OrcamentoFila[]): ResumoFunil`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/orcamento/funil-propostas.test.ts
import { describe, expect, it } from "vitest";
import { resumirFunilPropostas } from "./funil-propostas";
import type { OrcamentoFila } from "./orcamentos-listagem";

// Só os campos lidos pela função importam; o resto é preenchido por cast.
function linha(grupo: OrcamentoFila["grupo"], status: string): OrcamentoFila {
  return { grupo, status } as OrcamentoFila;
}

describe("resumirFunilPropostas", () => {
  it("conta por grupo e por status decidido", () => {
    const resumo = resumirFunilPropostas([
      linha("em_elaboracao", "rascunho"),
      linha("em_elaboracao", "rascunho"),
      linha("revisao", "enviado"),
      linha("emitidos", "emitido"),
      linha("decididos", "aprovado"),
      linha("decididos", "recusado"),
      linha("decididos", "cancelado"),
    ]);
    expect(resumo).toEqual({
      emElaboracao: 2,
      revisao: 1,
      emitidas: 1,
      aprovadas: 1,
      recusadas: 1,
      concluidas: 3,
    });
  });

  it("lista vazia zera tudo", () => {
    expect(resumirFunilPropostas([])).toEqual({
      emElaboracao: 0,
      revisao: 0,
      emitidas: 0,
      aprovadas: 0,
      recusadas: 0,
      concluidas: 0,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/orcamento/funil-propostas.test.ts`
Expected: FAIL — "Cannot find module './funil-propostas'".

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/orcamento/funil-propostas.ts
import type { OrcamentoFila } from "./orcamentos-listagem";

export type ResumoFunil = {
  emElaboracao: number;
  revisao: number;
  emitidas: number;
  aprovadas: number;
  recusadas: number;
  concluidas: number;
};

export function resumirFunilPropostas(linhas: OrcamentoFila[]): ResumoFunil {
  const resumo: ResumoFunil = {
    emElaboracao: 0,
    revisao: 0,
    emitidas: 0,
    aprovadas: 0,
    recusadas: 0,
    concluidas: 0,
  };
  for (const linha of linhas) {
    if (linha.grupo === "em_elaboracao") resumo.emElaboracao += 1;
    if (linha.grupo === "revisao") resumo.revisao += 1;
    if (linha.grupo === "emitidos") resumo.emitidas += 1;
    if (linha.grupo === "decididos") resumo.concluidas += 1;
    if (linha.status === "aprovado") resumo.aprovadas += 1;
    if (linha.status === "recusado") resumo.recusadas += 1;
  }
  return resumo;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/orcamento/funil-propostas.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/orcamento/funil-propostas.ts src/lib/orcamento/funil-propostas.test.ts
git commit -m "feat(orcamento): resumirFunilPropostas para indicadores do hub de propostas"
```

---

### Task 3: Reduzir o grupo "Orçamentos" no painel a 5 itens

**Files:**
- Modify: `src/config/navigation.ts:125-198` (objeto do grupo `title: "Orçamentos"`)

**Interfaces:**
- Consumes: tipos `NavGroup`/`NavLink` já importados no arquivo.
- Produces: nenhum símbolo novo. `CommandPalette` e `SideNav` herdam o resultado.

- [ ] **Step 1: Substituir o array `links` do grupo "Orçamentos"**

Substituir todo o bloco do objeto com `title: "Orçamentos"` (linhas ~125–198) por:

```ts
    {
      title: "Orçamentos",
      accent: "amber",
      icon: "FileText",
      links: [
        {
          href: "/orcamento/demandas",
          label: "Propostas",
          desc: "entrada, funil e acompanhamento das propostas",
          icon: "Inbox",
          shortcut: "O",
        },
        {
          href: "/orcamento/historico",
          label: "Histórico",
          desc: "versões, validade e comparação",
          icon: "History",
        },
        {
          href: "/orcamento/parametros",
          label: "Parâmetros econômicos",
          desc: "padrões de margens, impostos e fundos",
          icon: "SlidersHorizontal",
        },
        {
          href: "/orcamento/modelos",
          label: "Modelos/Templates",
          desc: "templates e catálogo institucional",
          icon: "LayoutGrid",
        },
        {
          href: "/orcamento/governanca",
          label: "Governança",
          desc: "permissões, eventos e auditoria por campo",
          icon: "ShieldCheck",
        },
      ],
    },
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros. (Ícones usados — Inbox, History, SlidersHorizontal, LayoutGrid, ShieldCheck, FileText — já estão no mapa `ICONS` de `SideNav.tsx`.)

- [ ] **Step 3: Verificação visual rápida**

Subir o dev server e confirmar que o grupo "Orçamentos" mostra exatamente 5 itens e que `Ctrl+K` lista os mesmos destinos (CommandPalette herda de `groups`).

Run: `npm run dev` e abrir `/`. Conferir o painel esquerdo.
Expected: grupo "Orçamentos" = Propostas, Histórico, Parâmetros econômicos, Modelos/Templates, Governança. Nenhum item "Em elaboração", "Projetos", "Orçamentos", "Emitidos", "Aprovados/recusados".

- [ ] **Step 4: Commit**

```bash
git add src/config/navigation.ts
git commit -m "feat(nav): grupo Orcamentos reduzido a 5 destinos (proposta como unidade)"
```

---

### Task 4: Hub "Propostas" — indicadores de funil + filtro por status

**Files:**
- Modify: `src/app/orcamento/demandas/page.tsx`

**Interfaces:**
- Consumes: `resumirFunilPropostas` (Task 2), `carregarLinhasOrcamentos` (`src/lib/orcamento/orcamentos-listagem.ts`), `avaliarCompletudeDemanda` (já importado), `DemandasTable`/`DemandaRow` (já importados).
- Produces: nenhum símbolo exportado novo.

- [ ] **Step 1: Aceitar `searchParams` e carregar linhas do funil**

No topo do arquivo, importar o helper e o carregador:

```ts
import { carregarLinhasOrcamentos } from "@/lib/orcamento/orcamentos-listagem";
import { resumirFunilPropostas } from "@/lib/orcamento/funil-propostas";
```

Trocar a assinatura do componente e o carregamento de dados:

```ts
export default async function DemandasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusFiltro } = await searchParams;
  const supabase = await createClient();
  const [{ data: demandas }, { data: clientes }, { data: projetos }, linhasFunil] =
    await Promise.all([
      supabase
        .from("demandas_propostas")
        .select("id, titulo, cliente_id, cliente_nome, modalidade, status, prioridade, data_solicitacao, prazo_esperado, projeto_id, descricao, escopo_preliminar, matriz_amostra, quantidade_amostras_estimada, prazo_tecnico_dias, criado_em")
        .order("criado_em", { ascending: false }),
      supabase.from("clientes").select("id, nome").eq("ativo", true).order("nome"),
      supabase.from("projetos").select("id, nome").order("nome"),
      carregarLinhasOrcamentos(),
    ]);
  const resumoFunil = resumirFunilPropostas(linhasFunil);
```

- [ ] **Step 2: Filtrar a lista de demandas pelo status selecionado**

Logo após montar `linhas: DemandaRow[]` (mapeamento existente), adicionar o filtro:

```ts
  const linhasFiltradas = statusFiltro
    ? linhas.filter((linha) => linha.status === statusFiltro)
    : linhas;
```

E trocar `<DemandasTable rows={linhas} />` por `<DemandasTable rows={linhasFiltradas} />`.

- [ ] **Step 3: Renderizar indicadores do funil no topo**

Inserir, logo abaixo do bloco do título (`</div>` que fecha o header, antes do `<form action={criarDemanda}>`), os indicadores:

```tsx
        <section className="mt-6 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {[
            { label: "Em elaboração", valor: resumoFunil.emElaboracao },
            { label: "Em revisão", valor: resumoFunil.revisao },
            { label: "Emitidas", valor: resumoFunil.emitidas },
            { label: "Aprovadas", valor: resumoFunil.aprovadas },
            { label: "Recusadas", valor: resumoFunil.recusadas },
            { label: "Concluídas", valor: resumoFunil.concluidas },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <p className="text-xs font-medium text-zinc-500">{item.label}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {item.valor.toLocaleString("pt-BR")}
              </p>
            </div>
          ))}
        </section>
```

- [ ] **Step 4: Renderizar chips de filtro por status acima da tabela**

Imediatamente antes do `<div className="mt-6"><DemandasTable .../></div>`, inserir as chips. Reusar o mapa `STATUS` já existente no arquivo:

```tsx
        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href="/orcamento/demandas"
            className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
              !statusFiltro
                ? "border-brand-600 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-950/30 dark:text-brand-300"
                : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            }`}
          >
            Todas
          </Link>
          {Object.entries(STATUS).map(([value, meta]) => (
            <Link
              key={value}
              href={`/orcamento/demandas?status=${value}`}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                statusFiltro === value
                  ? "border-brand-600 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-950/30 dark:text-brand-300"
                  : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              }`}
            >
              {meta.label}
            </Link>
          ))}
        </div>
```

Adicionar `import Link from "next/link";` no topo (não está importado hoje).

Atualizar também o título de "Demandas/Propostas" para **"Propostas"** no `<h1>` e ajustar o subtítulo se desejar manter coerência ("Crie e acompanhe propostas...").

- [ ] **Step 5: Typecheck + lint + verificação manual**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros.

Run dev server e conferir em `/orcamento/demandas`:
- 6 cartões de indicador no topo com contagens.
- Chips "Todas/Nova/Em análise/Orçada/Aprovada/Recusada/Cancelada".
- Clicar numa chip aplica `?status=` e filtra a tabela; "Todas" limpa.

- [ ] **Step 6: Commit**

```bash
git add src/app/orcamento/demandas/page.tsx
git commit -m "feat(orcamento): hub Propostas com indicadores de funil e filtro por status"
```

---

### Task 5: Stepper da proposta (rótulos aprovados + ordem condicional)

**Files:**
- Modify: `src/app/orcamento/demandas/[id]/page.tsx`

**Interfaces:**
- Consumes: `montarEtapasProposta`, `MODALIDADES_COM_ANALISES`, `MODALIDADES_COM_PROJETO` (Task 1).
- Produces: nenhum símbolo novo.

- [ ] **Step 1: Importar os helpers e remover os sets locais duplicados**

No topo, adicionar:

```ts
import {
  montarEtapasProposta,
  MODALIDADES_COM_ANALISES,
  MODALIDADES_COM_PROJETO,
} from "@/lib/orcamento/etapas-proposta";
```

Remover as definições locais duplicadas (linhas ~28–29):

```ts
const MODALIDADES_COM_ANALISES = new Set([...]);
const MODALIDADES_COM_PROJETO = new Set([...]);
```

(O resto do arquivo continua usando `MODALIDADES_COM_ANALISES.has(...)` etc., agora vindos do import — sem outras mudanças nessas chamadas.)

- [ ] **Step 2: Derivar o stepper a partir de `montarEtapasProposta`**

Substituir a construção manual do array `tabs` (linhas ~171–178) por uma derivação que usa os rótulos aprovados e injeta o status de cada etapa:

```ts
  const statusPorEtapa: Record<string, string> = {
    demanda: completudeDemanda.completa ? "Completa" : `${completudeDemanda.faltante}% faltante`,
    laboratorio: moduloAnalises.label,
    projeto: moduloProjeto.label,
    parametros: podeConsolidar ? "Liberado" : "Bloqueado",
    final: orcamentoFinal.pronto ? "Pronto" : "Bloqueado",
  };
  const etapas = montarEtapasProposta(demanda.modalidade);
  const tabs = etapas.map((etapa) => ({
    id: etapa.id,
    label: etapa.label,
    status: statusPorEtapa[etapa.id] ?? "",
    aplicavel: etapa.aplicavel,
  }));
```

A `<nav>` de tabs (linhas ~292–311) já itera `tabs.map(...)` usando `tab.id`, `tab.label`, `tab.aplicavel`, `tab.status` — **nenhuma** mudança de markup é necessária. A etapa "historico" deixa de aparecer no stepper (a seção `#historico` continua existindo na página, apenas não é mais um passo do fluxo).

- [ ] **Step 3: Relabel das seções para os termos aprovados**

Trocar os títulos das seções para casar com o stepper (somente o texto visível dos `<h2>`):

- Seção `id="laboratorio"`: `<h2>` "Custos laboratoriais" → **"Orçamento laboratorial"**.
- Seção `id="projeto"`: `<h2>` "Custos de projeto" → **"Custos do projeto"**.
- Seção `id="final"`: qualquer `<h2>`/título "Orçamento final" → **"Proposta final"**.
- Botões de ação no card "Próximos módulos": "Custos laboratoriais" → "Orçamento laboratorial". (O botão "Custos de projeto" já está correto.)

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros (confirmar que não sobraram referências às constantes locais removidas).

- [ ] **Step 5: Verificação manual por modalidade**

Subir o dev server e abrir uma demanda de cada modalidade (ou criar via `/orcamento/demandas`):
- `analises`: stepper mostra Dados da demanda · Orçamento laboratorial · Parâmetros econômicos · Proposta final; "Custos do projeto" aparece como "Não se aplica".
- `projeto`: Dados da demanda · Custos do projeto · Parâmetros econômicos · Proposta final.
- `projeto_analises_custos`: as 5 etapas na ordem fixa.

- [ ] **Step 6: Commit**

```bash
git add src/app/orcamento/demandas/[id]/page.tsx
git commit -m "feat(orcamento): stepper da proposta com rotulos aprovados e ordem condicional"
```

---

### Task 6: Redirects das rotas legadas

**Files:**
- Modify: `src/app/orcamento/page.tsx`
- Modify: `src/app/orcamento/em-elaboracao/page.tsx`
- Modify: `src/app/orcamento/revisao/page.tsx`
- Modify: `src/app/orcamento/emitidos/page.tsx`
- Modify: `src/app/orcamento/decididos/page.tsx`
- Modify: `src/app/orcamento/projetos/page.tsx`
- Modify: `src/app/orcamento/projetos/[id]/page.tsx`

**Interfaces:**
- Consumes: `redirect` de `next/navigation`; `createClient` (apenas no caso `projetos/[id]`).
- Produces: nada.

- [ ] **Step 1: Conferir a API de redirect nesta versão do Next**

Ler `node_modules/next/dist/docs/` (busca por "redirect") para confirmar a assinatura de `redirect()` em server components no Next 16.2.9 antes de escrever os arquivos. Heed deprecation notices.

- [ ] **Step 2: Redirects estáticos (hub e funil)**

Substituir **todo** o conteúdo de cada um destes arquivos pelo redirect correspondente:

`src/app/orcamento/page.tsx`:
```tsx
import { redirect } from "next/navigation";

export default function OrcamentoIndexPage() {
  redirect("/orcamento/demandas");
}
```

`src/app/orcamento/em-elaboracao/page.tsx`:
```tsx
import { redirect } from "next/navigation";

export default function OrcamentosEmElaboracaoPage() {
  redirect("/orcamento/demandas");
}
```

Repetir o mesmo padrão (com nome de função único por arquivo) para
`revisao/page.tsx` (`OrcamentosRevisaoPage`), `emitidos/page.tsx`
(`OrcamentosEmitidosPage`), `decididos/page.tsx` (`OrcamentosDecididosPage`) e
`projetos/page.tsx` (`OrcamentoProjetosPage`) — todos redirecionando para
`/orcamento/demandas`.

- [ ] **Step 3: Redirect dinâmico de projeto para o workspace da proposta**

`src/app/orcamento/projetos/[id]/page.tsx` — substituir o conteúdo por um lookup do `demanda_id` e redirect para a etapa "Custos do projeto" do workspace; se não houver demanda associada, cair no hub:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OrcamentoProjetoLegacyRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("orcamento_projetos")
    .select("demanda_id")
    .eq("id", Number(id))
    .single();
  if (data?.demanda_id) {
    redirect(`/orcamento/demandas/${data.demanda_id}#projeto`);
  }
  redirect("/orcamento/demandas");
}
```

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros. (Componentes/funções auxiliares antigos desses arquivos são removidos junto; confirmar que nenhum import órfão sobrou.)

- [ ] **Step 5: Verificação manual dos redirects**

Subir o dev server e visitar cada rota legada:
- `/orcamento`, `/orcamento/em-elaboracao`, `/orcamento/revisao`, `/orcamento/emitidos`, `/orcamento/decididos`, `/orcamento/projetos` → todas levam a `/orcamento/demandas`.
- `/orcamento/projetos/<id-existente>` → `/orcamento/demandas/<demanda_id>#projeto`.
- `/orcamento/final/<id>` continua renderizando a página de export (inalterada).

- [ ] **Step 6: Commit**

```bash
git add src/app/orcamento/page.tsx src/app/orcamento/em-elaboracao/page.tsx src/app/orcamento/revisao/page.tsx src/app/orcamento/emitidos/page.tsx src/app/orcamento/decididos/page.tsx src/app/orcamento/projetos/page.tsx src/app/orcamento/projetos/[id]/page.tsx
git commit -m "feat(orcamento): redirects de rotas legadas para o hub Propostas e workspace"
```

---

### Task 7: Verificação integrada final

**Files:** nenhum (apenas execução).

- [ ] **Step 1: Suíte de testes completa**

Run: `npm test`
Expected: PASS, incluindo os novos `etapas-proposta.test.ts` e `funil-propostas.test.ts`.

- [ ] **Step 2: Lint + typecheck do projeto**

Run: `npm run lint && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Build de produção (pega erros de RSC/redirect)**

Run: `npm run build`
Expected: build conclui sem erros.

- [ ] **Step 4: Checagem manual de aceitação**

- Painel esquerdo "Orçamentos" = 5 itens; nada de "orçamento de projeto" ou "proposta final" soltos.
- `/orcamento/demandas` mostra indicadores + filtros e cria nova proposta.
- Workspace da proposta mostra o stepper condicional com os rótulos aprovados.
- Rotas legadas redirecionam; `/orcamento/final/[id]` preservada.

- [ ] **Step 5: Commit (se necessário) / encerrar**

Sem mudanças de código aqui; se algo falhou, voltar à task correspondente. Caso contrário, a branch está pronta para revisão.
