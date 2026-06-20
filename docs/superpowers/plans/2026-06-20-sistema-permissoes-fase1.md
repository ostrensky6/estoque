# Sistema de Permissões (Fase 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o controle de acesso por comparação de papéis por uma matriz `papel × capacidade` persistida no banco e editável por um administrador, sem alterar o comportamento atual no "Dia 1".

**Architecture:** Renomeia os papéis (4→5) com uma migration de banco de baixo risco (ranking que aceita nomes antigos e novos, evitando reescrever políticas/RPCs). Adiciona a tabela `permissoes_papel` (fonte da verdade) lida por um novo helper `temPermissao(chave)` na camada do app. Guardas de server actions, páginas e navegação passam a usar `temPermissao`. Uma tela-matriz em `/governanca/privilegios` edita a tabela.

**Tech Stack:** Next.js 16 (App Router, Server Components/Actions), Supabase (Postgres + RLS), TypeScript, vitest, Tailwind v4, lucide-react.

## Global Constraints

- **Next.js 16 não-convencional:** antes de usar qualquer API do Next, ler o guia em `node_modules/next/dist/docs/`. (de AGENTS.md)
- **Migrations não-destrutivas:** proibido `DROP TABLE`, `TRUNCATE`, remoção de colunas com dados, remoção de RLS ou de triggers de auditoria; nada de sobrescrever migrations antigas. Renomear valor de dado e recriar função/política é permitido, com backup e rollback. (de AGENTS.md)
- **Paleta institucional:** usar tokens `brand`/`leaf`/`aqua`; **não** usar `emerald`.
- **Taxonomia fixa de 5 papéis:** `usuário < coordenador < administrativo < gerente < administrador`. Sem criação de papéis pela UI.
- **Invariante Dia 1 = hoje:** o seed reproduz o comportamento atual; nada muda até a matriz ser editada.
- **`administrador` sempre permitido:** override no código; a coluna na matriz é renderizada marcada e desabilitada.
- **Disciplina:** TDD onde houver lógica; commits frequentes; ao final `npm run lint`, `npm run build` e `npm run test` verdes.
- **Spec de referência:** `docs/superpowers/specs/2026-06-20-sistema-permissoes-fase1-design.md`.

---

## File Structure

- `supabase/migrations/0037_renomeia_papeis.sql` (novo) — rank de papéis + rename de dados + constraint.
- `supabase/migrations/0038_permissoes_papel.sql` (novo) — tabela, RLS e seed.
- `src/lib/auth/capacidades.ts` (novo) — catálogo de chaves por módulo + lista de papéis.
- `src/lib/auth/permissoes.ts` (novo) — `temPermissao(chave)`.
- `src/lib/auth/permissoes.test.ts` (novo) — testes do helper.
- `src/lib/auth/roles.ts` (modificar) — nova `ORDEM` de 5 papéis; default `usuário`.
- `src/config/navigation.ts` (modificar) — links via `temPermissao`; entrada Privilégios.
- `src/lib/actions/{compras,pedidos-internos,usuarios,backups}.ts` (modificar) — guardas → `temPermissao`.
- `src/app/{auditoria,usuarios,compras/[id],estoque,pedido,pedido/[id]}/page.tsx` (modificar) — guardas → `temPermissao`.
- `src/app/usuarios/*` (modificar) — 5 nomes + acesso a Privilégios.
- `src/app/governanca/privilegios/page.tsx` + `src/components/governanca/PrivilegiosMatriz.tsx` + `src/lib/actions/privilegios.ts` (novos) — tela-matriz e action.
- `src/lib/testing/mock-supabase.ts` (modificar) — seed de `permissoes_papel`; `perfis.papel` para nome novo.
- `src/lib/security/rls-policies.test.ts` (modificar) — nomes novos de papel.

---

## Task 1: Migration 0037 — rename de papéis (rank de baixo risco)

**Files:**
- Create: `supabase/migrations/0037_renomeia_papeis.sql`

**Interfaces:**
- Produces (SQL): função `rank_papel(text) returns int` (aceita nomes antigos e novos); `papel_minimo(text)` e `fn_exige_papel(text)` continuam com a mesma assinatura e semântica (limiares preservados). `perfis.papel` passa a conter os nomes novos.

**Contexto:** hoje `papel_minimo` (0014) usa `array['tecnico','coordenador','gestor','admin']` e os literais antigos são passados como `p_min` em dezenas de políticas/RPCs. Para não reescrever tudo, criamos `rank_papel` que mapeia **nomes antigos e novos** ao mesmo rank; assim os literais antigos existentes continuam válidos e o código novo usa nomes novos.

- [ ] **Step 1: Escrever a migration**

Create `supabase/migrations/0037_renomeia_papeis.sql`:

```sql
-- =====================================================================
-- Fase 1 (permissões) — renomeia papéis (4 -> 5) sem mudar comportamento.
-- admin->administrador, gestor->gerente, tecnico->usuário; +administrativo.
-- Abordagem por ranking: rank_papel aceita nomes ANTIGOS e NOVOS, então as
-- políticas/RPCs existentes (que passam literais antigos) seguem válidas.
-- Não-destrutiva: sem DROP TABLE/TRUNCATE/colunas. Renomeia dados + recria
-- funções/constraint. Rollback no fim do arquivo (comentado).
-- =====================================================================

-- 1) Ranking canônico (ordem nova). Mapeia legado e novo ao mesmo rank.
create or replace function rank_papel(p text)
returns int language sql immutable set search_path = public as $$
  select case lower(coalesce(p,''))
    when 'tecnico'        then 1
    when 'usuário'        then 1
    when 'usuario'        then 1
    when 'coordenador'    then 2
    when 'administrativo' then 3
    when 'gestor'         then 4
    when 'gerente'        then 4
    when 'admin'          then 5
    when 'administrador'  then 5
    else 0
  end;
$$;
grant execute on function rank_papel(text) to authenticated, service_role;

-- 2) papel_minimo passa a comparar por rank (aceita literais antigos/novos).
create or replace function papel_minimo(p_min text)
returns boolean language sql stable security definer set search_path = public as $$
  select rank_papel(current_papel()) >= rank_papel(p_min)
         and rank_papel(p_min) > 0;
$$;
grant execute on function papel_minimo(text) to authenticated, service_role;

-- 3) Renomeia os dados existentes e amplia o CHECK para os 5 nomes novos.
alter table perfis drop constraint if exists perfis_papel_check;
update perfis set papel = 'administrador' where papel = 'admin';
update perfis set papel = 'gerente'       where papel = 'gestor';
update perfis set papel = 'usuário'       where papel = 'tecnico';
alter table perfis
  alter column papel set default 'usuário',
  add constraint perfis_papel_check
  check (papel in ('usuário','coordenador','administrativo','gerente','administrador'));

-- 4) Recria as 2 políticas que dependiam de papel, agora com nomes novos
--    (funcionalmente idênticas; papel_minimo já normalizaria, mas mantemos claro).
drop policy if exists perfis_admin_write on perfis;
create policy perfis_admin_write on perfis
  for all to authenticated
  using (papel_minimo('administrador'))
  with check (papel_minimo('administrador'));

drop policy if exists auditoria_read on auditoria;
create policy auditoria_read on auditoria
  for select to authenticated
  using (papel_minimo('gerente'));

-- Rollback (se necessário, aplicar manualmente):
--   update perfis set papel='admin'   where papel='administrador';
--   update perfis set papel='gestor'  where papel='gerente';
--   update perfis set papel='tecnico' where papel in ('usuário','administrativo');
--   (e recriar o CHECK antigo + papel_minimo da 0014)
```

- [ ] **Step 2: Aplicar localmente e verificar**

Run:
```bash
cd "D:/Aplicativos/Estoque"
supabase migration up
```
Then verify in SQL (psql/Studio):
```sql
select papel_minimo('coordenador');  -- depende do usuário logado; via service deve refletir rank
select rank_papel('gestor') = rank_papel('gerente');   -- t
select rank_papel('administrativo');                   -- 3
select distinct papel from perfis;                     -- só nomes novos
```
Expected: ranks legado==novo iguais; `perfis.papel` só com nomes novos.

- [ ] **Step 3: Recriar usuários DEV com papéis novos**

Os usuários DEV (`ostrensky@ufpr.br` admin, `tecnico@ufpr.br`) viram `administrador`/`usuário` automaticamente pelo `update` do Step 1. Confirmar:
```sql
select email, papel from perfis order by papel;
```
Expected: `ostrensky@ufpr.br = administrador`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0037_renomeia_papeis.sql
git commit -m "feat(perms): migration 0037 renomeia papeis para os 5 nomes (rank)"
```

---

## Task 2: Migration 0038 — tabela `permissoes_papel` + seed

**Files:**
- Create: `supabase/migrations/0038_permissoes_papel.sql`

**Interfaces:**
- Produces (SQL): tabela `permissoes_papel(papel text, chave text, permitido boolean, pk(papel,chave))` com RLS (leitura authenticated; escrita `administrador`) e seed que reproduz o comportamento atual. `administrador` **não** é semeado (forçado no código).

**Seed (Dia 1 = hoje).** Colunas: u=usuário, c=coordenador, a=administrativo, g=gerente. `administrador` omitido (override). Catálogo idêntico ao §5.2 do spec.

| chave | u | c | a | g |
|---|:-:|:-:|:-:|:-:|
| analises.ver | T | T | T | T |
| analises.editar | F | T | F | T |
| insumos.ver | T | T | T | T |
| insumos.editar | F | T | F | T |
| custeio.ver | T | T | T | T |
| estoque.ver | T | T | T | T |
| estoque.lote.aceitar | F | T | F | T |
| estoque.lote.gerir | F | F | F | T |
| planejamento.ver | T | T | T | T |
| planejamento.editar | T | T | F | T |
| pedido.ver | T | T | T | T |
| pedido.criar | T | T | F | T |
| pedido.aprovar | F | T | F | T |
| compras.ver | T | T | T | T |
| compras.aprovar | F | T | F | T |
| compras.receber | F | T | F | T |
| compras.cancelar | F | T | F | T |
| recebimento.ver | T | T | T | T |
| recebimento.registrar | F | T | F | T |
| orcamento.ver | T | T | T | T |
| orcamento.editar | T | T | F | T |
| orcamento.parametros.editar | F | F | F | T |
| projetos.ver | T | T | T | T |
| projetos.editar | F | T | F | T |
| cadastros.ver | T | T | T | T |
| cadastros.editar | F | T | F | T |
| auditoria.ver | F | F | F | T |
| usuarios.gerir | F | F | F | F |
| backups.gerir | F | F | F | F |
| privilegios.gerir | F | F | F | F |
| configuracoes.ver | F | F | F | F |

- [ ] **Step 1: Escrever a migration**

Create `supabase/migrations/0038_permissoes_papel.sql`:

```sql
-- =====================================================================
-- Fase 1 (permissões) — matriz papel x capacidade (fonte da verdade do app).
-- Seed reproduz exatamente o comportamento atual (ver plano, Task 2).
-- 'administrador' é forçado no código (sempre true) e não é semeado.
-- =====================================================================
create table if not exists permissoes_papel (
  papel     text not null
            check (papel in ('usuário','coordenador','administrativo','gerente')),
  chave     text not null,
  permitido boolean not null default false,
  primary key (papel, chave)
);

alter table permissoes_papel enable row level security;

drop policy if exists permissoes_read on permissoes_papel;
create policy permissoes_read on permissoes_papel
  for select to authenticated using (true);

drop policy if exists permissoes_admin_write on permissoes_papel;
create policy permissoes_admin_write on permissoes_papel
  for all to authenticated
  using (papel_minimo('administrador'))
  with check (papel_minimo('administrador'));

-- Seed: insere TRUE explicitamente; ausência = negado (default false na leitura).
insert into permissoes_papel (papel, chave, permitido) values
  ('usuário','analises.ver',true),('coordenador','analises.ver',true),('administrativo','analises.ver',true),('gerente','analises.ver',true),
  ('coordenador','analises.editar',true),('gerente','analises.editar',true),
  ('usuário','insumos.ver',true),('coordenador','insumos.ver',true),('administrativo','insumos.ver',true),('gerente','insumos.ver',true),
  ('coordenador','insumos.editar',true),('gerente','insumos.editar',true),
  ('usuário','custeio.ver',true),('coordenador','custeio.ver',true),('administrativo','custeio.ver',true),('gerente','custeio.ver',true),
  ('usuário','estoque.ver',true),('coordenador','estoque.ver',true),('administrativo','estoque.ver',true),('gerente','estoque.ver',true),
  ('coordenador','estoque.lote.aceitar',true),('gerente','estoque.lote.aceitar',true),
  ('gerente','estoque.lote.gerir',true),
  ('usuário','planejamento.ver',true),('coordenador','planejamento.ver',true),('administrativo','planejamento.ver',true),('gerente','planejamento.ver',true),
  ('usuário','planejamento.editar',true),('coordenador','planejamento.editar',true),('gerente','planejamento.editar',true),
  ('usuário','pedido.ver',true),('coordenador','pedido.ver',true),('administrativo','pedido.ver',true),('gerente','pedido.ver',true),
  ('usuário','pedido.criar',true),('coordenador','pedido.criar',true),('gerente','pedido.criar',true),
  ('coordenador','pedido.aprovar',true),('gerente','pedido.aprovar',true),
  ('usuário','compras.ver',true),('coordenador','compras.ver',true),('administrativo','compras.ver',true),('gerente','compras.ver',true),
  ('coordenador','compras.aprovar',true),('gerente','compras.aprovar',true),
  ('coordenador','compras.receber',true),('gerente','compras.receber',true),
  ('coordenador','compras.cancelar',true),('gerente','compras.cancelar',true),
  ('usuário','recebimento.ver',true),('coordenador','recebimento.ver',true),('administrativo','recebimento.ver',true),('gerente','recebimento.ver',true),
  ('coordenador','recebimento.registrar',true),('gerente','recebimento.registrar',true),
  ('usuário','orcamento.ver',true),('coordenador','orcamento.ver',true),('administrativo','orcamento.ver',true),('gerente','orcamento.ver',true),
  ('usuário','orcamento.editar',true),('coordenador','orcamento.editar',true),('gerente','orcamento.editar',true),
  ('gerente','orcamento.parametros.editar',true),
  ('usuário','projetos.ver',true),('coordenador','projetos.ver',true),('administrativo','projetos.ver',true),('gerente','projetos.ver',true),
  ('coordenador','projetos.editar',true),('gerente','projetos.editar',true),
  ('usuário','cadastros.ver',true),('coordenador','cadastros.ver',true),('administrativo','cadastros.ver',true),('gerente','cadastros.ver',true),
  ('coordenador','cadastros.editar',true),('gerente','cadastros.editar',true),
  ('gerente','auditoria.ver',true)
on conflict (papel, chave) do nothing;
-- usuarios.gerir / backups.gerir / privilegios.gerir / configuracoes.ver:
-- nenhum papel <administrador> recebe; ficam negados por ausência.
```

- [ ] **Step 2: Aplicar e verificar**

Run:
```bash
supabase migration up
```
Verify:
```sql
select count(*) from permissoes_papel;                 -- 70
select permitido from permissoes_papel where papel='gerente' and chave='estoque.lote.gerir'; -- t
select count(*) from permissoes_papel where chave='usuarios.gerir'; -- 0 (só administrador, via código)
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0038_permissoes_papel.sql
git commit -m "feat(perms): migration 0038 tabela permissoes_papel + seed (dia 1 = hoje)"
```

---

## Task 3: Tipos + `roles.ts` + navegação (5 papéis)

**Files:**
- Modify: `src/lib/supabase/database.types.ts`
- Modify: `src/lib/auth/roles.ts:4-29`
- Modify: `src/config/navigation.ts:3-15`

**Interfaces:**
- Produces: `ORDEM`/`Papel` com os 5 nomes novos; tipos do Supabase incluindo `permissoes_papel`.

- [ ] **Step 1: Regenerar tipos do banco**

Run:
```bash
supabase gen types typescript --local > src/lib/supabase/database.types.ts
```
Expected: o arquivo passa a conter `permissoes_papel` em `Tables`.

- [ ] **Step 2: Atualizar `roles.ts`**

Em `src/lib/auth/roles.ts`, trocar a linha 4 e o default da linha 28:

```ts
const ORDEM = ["usuário", "coordenador", "administrativo", "gerente", "administrador"] as const;
```
```ts
  return (u?.papel as Papel) ?? "usuário";
```

- [ ] **Step 3: Atualizar `navigation.ts`**

Em `src/config/navigation.ts`, substituir o bloco 3-15:

```ts
const ORDEM_PAPEIS = ["usuário", "coordenador", "administrativo", "gerente", "administrador"];

export type NavigationProfile = {
  papel?: string | null;
} | null;

function nivelDoPapel(papel?: string | null) {
  return papel ? ORDEM_PAPEIS.indexOf(papel) : -1;
}

export function getNavigationGroups(perfil: NavigationProfile): NavGroup[] {
  const nivel = nivelDoPapel(perfil?.papel);
  const ehGerente = nivel >= ORDEM_PAPEIS.indexOf("gerente");
  const ehAdmin = perfil?.papel === "administrador";
```

Depois trocar usos seguintes no arquivo: `ehGestor` → `ehGerente`.

- [ ] **Step 4: Verificar build**

Run:
```bash
npm run build
```
Expected: compila (pode haver erros de tipo em call sites de `temPapel` com nomes antigos — serão corrigidos nas Tasks 6/7; se o build falhar só por isso, prosseguir e revalidar ao fim da Task 7).

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/database.types.ts src/lib/auth/roles.ts src/config/navigation.ts
git commit -m "feat(perms): taxonomia de 5 papeis em roles e navegacao"
```

---

## Task 4: Catálogo de capacidades

**Files:**
- Create: `src/lib/auth/capacidades.ts`

**Interfaces:**
- Produces: `PAPEIS: readonly Papel[]` (5), `CHAVES_PERMISSAO: readonly string[]`, `CATALOGO: { modulo: string; capacidades: { chave: string; rotulo: string }[] }[]`.

- [ ] **Step 1: Criar o catálogo**

Create `src/lib/auth/capacidades.ts`:

```ts
export const PAPEIS = [
  "usuário",
  "coordenador",
  "administrativo",
  "gerente",
  "administrador",
] as const;
export type PapelPermissao = (typeof PAPEIS)[number];

export const PAPEL_ADMIN: PapelPermissao = "administrador";

export type Capacidade = { chave: string; rotulo: string };
export type ModuloCapacidades = { modulo: string; capacidades: Capacidade[] };

export const CATALOGO: ModuloCapacidades[] = [
  { modulo: "Análises", capacidades: [
    { chave: "analises.ver", rotulo: "Ver" },
    { chave: "analises.editar", rotulo: "Editar" },
  ]},
  { modulo: "Insumos", capacidades: [
    { chave: "insumos.ver", rotulo: "Ver" },
    { chave: "insumos.editar", rotulo: "Editar" },
  ]},
  { modulo: "Custeio", capacidades: [
    { chave: "custeio.ver", rotulo: "Ver" },
  ]},
  { modulo: "Estoque", capacidades: [
    { chave: "estoque.ver", rotulo: "Ver" },
    { chave: "estoque.lote.aceitar", rotulo: "Aceitar lote" },
    { chave: "estoque.lote.gerir", rotulo: "Bloquear/descartar lote" },
  ]},
  { modulo: "Planejamento", capacidades: [
    { chave: "planejamento.ver", rotulo: "Ver" },
    { chave: "planejamento.editar", rotulo: "Editar" },
  ]},
  { modulo: "Pedido", capacidades: [
    { chave: "pedido.ver", rotulo: "Ver" },
    { chave: "pedido.criar", rotulo: "Criar" },
    { chave: "pedido.aprovar", rotulo: "Aprovar/mover" },
  ]},
  { modulo: "Compras", capacidades: [
    { chave: "compras.ver", rotulo: "Ver" },
    { chave: "compras.aprovar", rotulo: "Aprovar" },
    { chave: "compras.receber", rotulo: "Receber" },
    { chave: "compras.cancelar", rotulo: "Cancelar" },
  ]},
  { modulo: "Recebimento", capacidades: [
    { chave: "recebimento.ver", rotulo: "Ver" },
    { chave: "recebimento.registrar", rotulo: "Registrar" },
  ]},
  { modulo: "Orçamento", capacidades: [
    { chave: "orcamento.ver", rotulo: "Ver" },
    { chave: "orcamento.editar", rotulo: "Editar" },
    { chave: "orcamento.parametros.editar", rotulo: "Editar parâmetros econômicos" },
  ]},
  { modulo: "Projetos", capacidades: [
    { chave: "projetos.ver", rotulo: "Ver" },
    { chave: "projetos.editar", rotulo: "Editar" },
  ]},
  { modulo: "Cadastros", capacidades: [
    { chave: "cadastros.ver", rotulo: "Ver" },
    { chave: "cadastros.editar", rotulo: "Editar" },
  ]},
  { modulo: "Governança", capacidades: [
    { chave: "auditoria.ver", rotulo: "Ver auditoria" },
    { chave: "usuarios.gerir", rotulo: "Gerir usuários" },
    { chave: "backups.gerir", rotulo: "Gerir backups" },
    { chave: "privilegios.gerir", rotulo: "Gerir privilégios" },
    { chave: "configuracoes.ver", rotulo: "Ver configurações" },
  ]},
];

export const CHAVES_PERMISSAO: readonly string[] = CATALOGO.flatMap((m) =>
  m.capacidades.map((c) => c.chave),
);
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/auth/capacidades.ts
git commit -m "feat(perms): catalogo de capacidades por modulo"
```

---

## Task 5: `temPermissao` + seed no mock + testes (TDD)

**Files:**
- Modify: `src/lib/testing/mock-supabase.ts`
- Create: `src/lib/auth/permissoes.ts`
- Create: `src/lib/auth/permissoes.test.ts`

**Interfaces:**
- Consumes: `usuarioAtual()` de `roles.ts`; `PAPEL_ADMIN` de `capacidades.ts`.
- Produces: `temPermissao(chave: string): Promise<boolean>`.

- [ ] **Step 1: Semear `permissoes_papel` e ajustar `perfis` no mock**

Em `src/lib/testing/mock-supabase.ts`, no `baseStore()`: trocar o papel do perfil e-2e de `"gestor"` para `"gerente"`, e adicionar a tabela `permissoes_papel`:

```ts
  perfis: [{ id: "user-e2e", nome: "Gestor E2E", email: "gestor@example.com", papel: "gerente" }],
```
Adicionar (ex.: após `perfis`):
```ts
  permissoes_papel: [
    { papel: "gerente", chave: "auditoria.ver", permitido: true },
    { papel: "gerente", chave: "compras.aprovar", permitido: true },
    { papel: "gerente", chave: "estoque.lote.aceitar", permitido: true },
    { papel: "gerente", chave: "estoque.lote.gerir", permitido: true },
    { papel: "usuário", chave: "compras.aprovar", permitido: false },
  ],
```

- [ ] **Step 2: Escrever os testes (devem falhar)**

Create `src/lib/auth/permissoes.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/roles", () => ({
  usuarioAtual: vi.fn(),
}));

import { usuarioAtual } from "@/lib/auth/roles";
import { temPermissao } from "./permissoes";

const mockUsuario = vi.mocked(usuarioAtual);

afterEach(() => {
  vi.clearAllMocks();
  const g = globalThis as typeof globalThis & { __kontrolMockStore?: Record<string, unknown[]> };
  if (g.__kontrolMockStore) {
    g.__kontrolMockStore.permissoes_papel = [
      { papel: "gerente", chave: "compras.aprovar", permitido: true },
      { papel: "usuário", chave: "compras.aprovar", permitido: false },
    ];
  }
});

beforeEach(() => {
  process.env.PLAYWRIGHT_MOCK_SUPABASE = "1";
});

describe("temPermissao", () => {
  it("administrador sempre true (sem consultar tabela)", async () => {
    mockUsuario.mockResolvedValue({ id: "1", email: null, nome: null, papel: "administrador" } as never);
    expect(await temPermissao("usuarios.gerir")).toBe(true);
  });

  it("retorna o permitido da matriz para o papel", async () => {
    mockUsuario.mockResolvedValue({ id: "1", email: null, nome: null, papel: "gerente" } as never);
    expect(await temPermissao("compras.aprovar")).toBe(true);
  });

  it("nega quando a matriz marca false", async () => {
    mockUsuario.mockResolvedValue({ id: "1", email: null, nome: null, papel: "usuário" } as never);
    expect(await temPermissao("compras.aprovar")).toBe(false);
  });

  it("nega quando não há linha (ausência = negado)", async () => {
    mockUsuario.mockResolvedValue({ id: "1", email: null, nome: null, papel: "usuário" } as never);
    expect(await temPermissao("backups.gerir")).toBe(false);
  });

  it("fail-closed sem usuário", async () => {
    mockUsuario.mockResolvedValue(null as never);
    expect(await temPermissao("compras.ver")).toBe(false);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/lib/auth/permissoes.test.ts`
Expected: FAIL (`temPermissao` não existe).

- [ ] **Step 4: Implementar `permissoes.ts`**

Create `src/lib/auth/permissoes.ts`:

```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/roles";
import { PAPEL_ADMIN } from "@/lib/auth/capacidades";

/** true se o papel do usuário tem a capacidade `chave` na matriz permissoes_papel. */
export async function temPermissao(chave: string): Promise<boolean> {
  const u = await usuarioAtual();
  if (!u?.papel) return false;
  if (u.papel === PAPEL_ADMIN) return true;

  const supabase = await createClient();
  const { data } = await supabase
    .from("permissoes_papel")
    .select("permitido")
    .eq("papel", u.papel)
    .eq("chave", chave)
    .maybeSingle();

  return data?.permitido === true;
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/lib/auth/permissoes.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 6: Commit**

```bash
git add src/lib/testing/mock-supabase.ts src/lib/auth/permissoes.ts src/lib/auth/permissoes.test.ts
git commit -m "feat(perms): temPermissao com matriz no banco + testes"
```

---

## Task 6: Guardas das server actions → `temPermissao`

**Files:**
- Modify: `src/lib/actions/backups.ts:54,76`
- Modify: `src/lib/actions/usuarios.ts:21,63,89,113,141`
- Modify: `src/lib/actions/compras.ts:35,147,181,196,211`
- Modify: `src/lib/actions/pedidos-internos.ts:46,153,281,294,308,370,417,429,443,456,479,491,504,517,532,545,781`

**Mapeamento (substituir `temPapel(<antigo>)` pela chave):**

| Arquivo / função | Antes | Depois |
|---|---|---|
| backups.ts `obterResumoBackups`, `executarBackupAplicativo` | `temPapel("admin")` | `temPermissao("backups.gerir")` |
| usuarios.ts (todas as 5) | `temPapel("admin")` | `temPermissao("usuarios.gerir")` |
| compras.ts `criarPedido`/`aprovarPedido`/`marcarEnviado` (35,147,181) | `temPapel("coordenador")` | `temPermissao("compras.aprovar")` |
| compras.ts `cancelarPedido` (196) | `temPapel("coordenador")` | `temPermissao("compras.cancelar")` |
| compras.ts `receberItemPedido` (211) | `temPapel("coordenador")` | `temPermissao("compras.receber")` |
| pedidos-internos.ts (todas as 17) | `temPapel("coordenador")` | `temPermissao("pedido.aprovar")` |

- [ ] **Step 1: Trocar o import em cada arquivo**

Em cada um dos 4 arquivos, adicionar:
```ts
import { temPermissao } from "@/lib/auth/permissoes";
```
e remover `temPapel` do import de `@/lib/auth/roles` **se não houver mais uso** no arquivo (em `compras.ts`/`pedidos-internos.ts`/`usuarios.ts`/`backups.ts` não haverá; manter `usuarioAtual` onde já é importado).

- [ ] **Step 2: Aplicar as substituições**

Trocar cada ocorrência conforme a tabela. Exemplos exatos:

`backups.ts`:
```ts
  if (!(await temPermissao("backups.gerir"))) {
```
`usuarios.ts` (manter a mensagem específica de cada função; só troca a condição):
```ts
  if (!(await temPermissao("usuarios.gerir"))) {
```
`compras.ts` `cancelarPedido`:
```ts
  if (!(await temPermissao("compras.cancelar"))) return SEM_PERMISSAO;
```
`pedidos-internos.ts` helper `podeEditarStatus` (linha 46):
```ts
  return temPermissao("pedido.aprovar");
```

- [ ] **Step 3: Verificar tipos/lint**

Run: `npm run lint`
Expected: sem erros nesses arquivos (nenhum `temPapel` órfão).

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions/backups.ts src/lib/actions/usuarios.ts src/lib/actions/compras.ts src/lib/actions/pedidos-internos.ts
git commit -m "feat(perms): server actions usam temPermissao"
```

---

## Task 7: Guardas de página + links de navegação → `temPermissao`

**Files:**
- Modify: `src/app/auditoria/page.tsx:48`
- Modify: `src/app/usuarios/page.tsx:16`
- Modify: `src/app/compras/[id]/page.tsx:44`
- Modify: `src/app/estoque/page.tsx:49-50`
- Modify: `src/app/pedido/page.tsx:19`
- Modify: `src/app/pedido/[id]/page.tsx:134`
- Modify: `src/config/navigation.ts`

**Mapeamento de páginas:**

| Arquivo | Antes | Depois |
|---|---|---|
| auditoria/page.tsx | `temPapel("gestor")` | `temPermissao("auditoria.ver")` |
| usuarios/page.tsx | `temPapel("admin")` | `temPermissao("usuarios.gerir")` |
| compras/[id]/page.tsx | `temPapel("coordenador")` | `temPermissao("compras.aprovar")` |
| estoque/page.tsx (aceitar) | `temPapel("coordenador")` | `temPermissao("estoque.lote.aceitar")` |
| estoque/page.tsx (gerir) | `temPapel("gestor")` | `temPermissao("estoque.lote.gerir")` |
| pedido/page.tsx | `temPapel("coordenador")` | `temPermissao("pedido.aprovar")` |
| pedido/[id]/page.tsx | `temPapel("coordenador")` | `temPermissao("pedido.aprovar")` |

- [ ] **Step 1: Trocar import + chamada em cada página**

Em cada página, importar `temPermissao` de `@/lib/auth/permissoes` (remover `temPapel` se ficar órfão) e aplicar a substituição. Ex. `estoque/page.tsx`:
```ts
  const [podeAceitar, podeGerir] = await Promise.all([
    temPermissao("estoque.lote.aceitar"),
    temPermissao("estoque.lote.gerir"),
  ]);
```

- [ ] **Step 2: Navegação por permissão**

Em `src/config/navigation.ts`, os links operacionais hoje são sempre visíveis (mantém comportamento — todos têm `*.ver` no seed, então não é necessário gate por link nesta fase, exceto Governança). Atualizar o bloco de Governança para usar permissões via uma função assíncrona. **Como `getNavigationGroups` é síncrona hoje**, manter o gate de Governança por papel (`ehGerente`/`ehAdmin`) que já reproduz o comportamento, e adicionar a entrada Privilégios sob `ehAdmin`:

```ts
  if (ehAdmin) {
    linksGovernanca.push(
      {
        href: "/governanca/configuracoes",
        label: "Configurações",
        desc: "backups e parâmetros do sistema",
        icon: "Settings",
      },
      {
        href: "/governanca/privilegios",
        label: "Privilégios",
        desc: "matriz de permissões por papel",
        icon: "ShieldCheck",
      },
      {
        href: "/usuarios",
        label: "Usuários e permissões",
        desc: "papéis e acesso",
        icon: "UserCog",
      },
    );
  }
```
> Nota: gating fino de links por `temPermissao` (assíncrono) fica como melhoria; o comportamento Dia 1 é preservado pelo gate por papel já existente.

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: compila sem erros de `temPapel`.

- [ ] **Step 4: Commit**

```bash
git add src/app/auditoria/page.tsx src/app/usuarios/page.tsx "src/app/compras/[id]/page.tsx" src/app/estoque/page.tsx src/app/pedido/page.tsx "src/app/pedido/[id]/page.tsx" src/config/navigation.ts
git commit -m "feat(perms): guardas de pagina e nav de governanca por permissao"
```

---

## Task 8: `/usuarios` — 5 nomes + acesso a Privilégios

**Files:**
- Modify: `src/components/usuarios/CriarUsuarioForm.tsx`
- Modify: `src/components/usuarios/UsuarioAcoes.tsx`
- Modify: `src/components/usuarios/UsuariosTable.tsx`
- Modify: `src/app/usuarios/page.tsx`

**Interfaces:**
- Consumes: `PAPEIS` de `capacidades.ts`.

- [ ] **Step 1: Centralizar a lista de papéis nos seletores**

Onde houver `<option>` ou arrays com `tecnico/coordenador/gestor/admin` (selects de papel em `CriarUsuarioForm.tsx` e `UsuarioAcoes.tsx`), substituir pela lista derivada de `PAPEIS`, com rótulos capitalizados:

```tsx
import { PAPEIS } from "@/lib/auth/capacidades";
// ...
{PAPEIS.map((p) => (
  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
))}
```

- [ ] **Step 2: Atualizar badges/labels de papel na tabela**

Em `UsuariosTable.tsx`, qualquer mapa de rótulo `tecnico→Técnico` etc. deve refletir os 5 novos nomes (`usuário/coordenador/administrativo/gerente/administrador`).

- [ ] **Step 3: Link para Privilégios na página**

Em `src/app/usuarios/page.tsx`, adicionar (visível só ao administrador, que já é a guarda da página) um link/sub-aba para `/governanca/privilegios`:
```tsx
import Link from "next/link";
// no cabeçalho da página:
<Link href="/governanca/privilegios" className="text-sm font-medium text-brand-700 hover:underline">
  Privilégios por papel →
</Link>
```

- [ ] **Step 4: Verificar**

Run: `npm run lint && npm run build`
Expected: OK.

- [ ] **Step 5: Commit**

```bash
git add src/components/usuarios src/app/usuarios/page.tsx
git commit -m "feat(perms): /usuarios com 5 papeis e link de privilegios"
```

---

## Task 9: Tela-matriz `/governanca/privilegios` + action

**Files:**
- Create: `src/lib/actions/privilegios.ts`
- Create: `src/components/governanca/PrivilegiosMatriz.tsx`
- Create: `src/app/governanca/privilegios/page.tsx`

**Interfaces:**
- Consumes: `CATALOGO`, `PAPEIS`, `PAPEL_ADMIN` de `capacidades.ts`; `temPermissao` de `permissoes.ts`.
- Produces: `obterMatriz()`, `definirPermissao(papel, chave, permitido)`.

- [ ] **Step 1: Server action `privilegios.ts`**

Create `src/lib/actions/privilegios.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { temPermissao } from "@/lib/auth/permissoes";
import { CHAVES_PERMISSAO, PAPEIS, PAPEL_ADMIN } from "@/lib/auth/capacidades";

export async function obterMatriz(): Promise<Record<string, boolean> | null> {
  if (!(await temPermissao("privilegios.gerir"))) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("permissoes_papel").select("papel, chave, permitido");
  const mapa: Record<string, boolean> = {};
  for (const linha of data ?? []) {
    mapa[`${linha.papel}::${linha.chave}`] = linha.permitido === true;
  }
  return mapa;
}

export async function definirPermissao(
  papel: string,
  chave: string,
  permitido: boolean,
): Promise<{ ok: boolean; message?: string }> {
  if (!(await temPermissao("privilegios.gerir"))) {
    return { ok: false, message: "Acesso restrito ao administrador." };
  }
  if (papel === PAPEL_ADMIN) {
    return { ok: false, message: "Administrador tem acesso total e não é editável." };
  }
  if (!PAPEIS.includes(papel as never) || !CHAVES_PERMISSAO.includes(chave)) {
    return { ok: false, message: "Papel ou capacidade inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("permissoes_papel")
    .upsert({ papel, chave, permitido }, { onConflict: "papel,chave" });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/governanca/privilegios");
  return { ok: true };
}
```

- [ ] **Step 2: Componente de matriz (client)**

Create `src/components/governanca/PrivilegiosMatriz.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CATALOGO, PAPEIS, PAPEL_ADMIN } from "@/lib/auth/capacidades";
import { definirPermissao } from "@/lib/actions/privilegios";

export function PrivilegiosMatriz({ matriz }: { matriz: Record<string, boolean> }) {
  const [estado, setEstado] = useState(matriz);
  const [pending, startTransition] = useTransition();

  function alternar(papel: string, chave: string, atual: boolean) {
    const chaveMapa = `${papel}::${chave}`;
    setEstado((s) => ({ ...s, [chaveMapa]: !atual }));
    startTransition(async () => {
      const res = await definirPermissao(papel, chave, !atual);
      if (!res.ok) {
        setEstado((s) => ({ ...s, [chaveMapa]: atual }));
        toast.error(res.message ?? "Falha ao salvar.");
      }
    });
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-zinc-950/40">
          <tr>
            <th className="px-4 py-3 text-left">Capacidade</th>
            {PAPEIS.map((p) => (
              <th key={p} className="px-3 py-3 text-center">{p}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
          {CATALOGO.map((mod) => (
            <FragmentModulo key={mod.modulo} modulo={mod.modulo} linhas={mod.capacidades}
              estado={estado} pending={pending} onToggle={alternar} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FragmentModulo({
  modulo, linhas, estado, pending, onToggle,
}: {
  modulo: string;
  linhas: { chave: string; rotulo: string }[];
  estado: Record<string, boolean>;
  pending: boolean;
  onToggle: (papel: string, chave: string, atual: boolean) => void;
}) {
  return (
    <>
      <tr className="bg-slate-100/60 dark:bg-zinc-900/60">
        <td colSpan={PAPEIS.length + 1} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-zinc-300">
          {modulo}
        </td>
      </tr>
      {linhas.map((cap) => (
        <tr key={cap.chave}>
          <td className="px-4 py-2 font-medium">{cap.rotulo}<span className="ml-2 text-xs text-slate-400">{cap.chave}</span></td>
          {PAPEIS.map((papel) => {
            const ehAdmin = papel === PAPEL_ADMIN;
            const marcado = ehAdmin ? true : estado[`${papel}::${cap.chave}`] === true;
            return (
              <td key={papel} className="px-3 py-2 text-center">
                <input
                  type="checkbox"
                  checked={marcado}
                  disabled={ehAdmin || pending}
                  onChange={() => onToggle(papel, cap.chave, marcado)}
                  className="h-4 w-4 accent-brand-600"
                  aria-label={`${papel} ${cap.chave}`}
                />
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
```

- [ ] **Step 3: Página (server)**

Create `src/app/governanca/privilegios/page.tsx`:

```tsx
import { ShieldCheck } from "lucide-react";
import { obterMatriz } from "@/lib/actions/privilegios";
import { PrivilegiosMatriz } from "@/components/governanca/PrivilegiosMatriz";

export const dynamic = "force-dynamic";

export default async function PrivilegiosPage() {
  const matriz = await obterMatriz();

  if (!matriz) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center font-sans">
        <p className="text-zinc-500">Acesso restrito: privilégios são uma operação de administrador.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 font-sans text-slate-900 dark:text-slate-100 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Privilégios</h1>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
            Matriz de capacidades por papel. Alterações têm efeito imediato. O papel
            administrador tem acesso total e não é editável.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Governança
        </span>
      </div>
      <div className="mt-6">
        <PrivilegiosMatriz matriz={matriz} />
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Verificar**

Run: `npm run lint && npm run build`
Expected: rota `/governanca/privilegios` no manifesto; sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/privilegios.ts src/components/governanca/PrivilegiosMatriz.tsx src/app/governanca/privilegios/page.tsx
git commit -m "feat(perms): tela-matriz de privilegios com efeito imediato"
```

---

## Task 10: Atualizar testes de RLS + verificação final

**Files:**
- Modify: `src/lib/security/rls-policies.test.ts`

- [ ] **Step 1: Atualizar nomes de papel no teste de RLS**

Em `src/lib/security/rls-policies.test.ts`, substituir literais `admin/gestor/tecnico` por `administrador/gerente/usuário` onde representarem o papel do usuário (mantendo a intenção dos casos). Rodar:
```bash
npx vitest run src/lib/security/rls-policies.test.ts
```
Expected: PASS.

- [ ] **Step 2: Suíte completa + lint + build**

Run:
```bash
npm run test && npm run lint && npm run build
```
Expected: tudo verde; rota de privilégios presente.

- [ ] **Step 3: Verificação manual no app (mock OU banco real)**

- Logar como `administrador` → ver `/governanca/privilegios`, alternar um checkbox (ex.: `gerente / compras.cancelar`) e confirmar persistência (recarregar).
- Logar como `gerente` → `/governanca/privilegios` deve mostrar "acesso restrito".
- Confirmar que ações de compras/lotes continuam permitidas para coordenador/gerente como antes (Dia 1 = hoje).

- [ ] **Step 4: Commit**

```bash
git add src/lib/security/rls-policies.test.ts
git commit -m "test(perms): rls-policies com nomes de papel novos"
```

---

## Self-Review (preenchido)

**Cobertura do spec:** §3.1 taxonomia → Tasks 1,3,8; §3.2 seed=hoje → Task 2; §3.3 execução/`temPermissao` → Tasks 5,6,7; §3.4 `/usuarios` → Task 8; §3.5 `/governanca/privilegios` → Task 9; §6 migrations → Tasks 1,2; §7 testes → Tasks 5,10. Sem lacunas.

**Placeholders:** nenhum "TBD/TODO"; todo passo tem código ou comando concreto.

**Consistência de tipos:** `temPermissao(chave: string)` usado igual em Tasks 5–9; `PAPEIS`/`PAPEL_ADMIN`/`CATALOGO`/`CHAVES_PERMISSAO` definidos na Task 4 e consumidos depois; `obterMatriz`/`definirPermissao` definidos na Task 9 e usados no componente da mesma task.

**Riscos conhecidos:** aplicar migrations exige Supabase local; `supabase gen types` precisa do banco no ar. A 0037 preserva limiares via `rank_papel` (aceita nomes antigos), evitando reescrever políticas/RPCs.
