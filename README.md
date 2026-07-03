# Kontrol

App de **controle de estoque** e **custeio/orçamento de análises** para laboratório
de biologia molecular. Substitui a planilha `Laboratorio1.xlsm`.

Stack: **Next.js 16** (App Router, TS) · **Supabase** (Postgres + Auth) · deploy na **Vercel**.

Produção canônica: https://kontrol-atgc.vercel.app

Dados operacionais de produção: [docs/operacao-producao.md](docs/operacao-producao.md).

## Pré-requisitos
- Node 20+, Docker Desktop em execução
- Supabase CLI (via `npx supabase`)

## Rodar localmente
```bash
# 1. Subir o Supabase local (Postgres+Studio). Portas em 545xx (config.toml).
npx supabase start

# 2. (Re)criar schema + dados da planilha
npx supabase db reset          # aplica migrations + seed/seed.sql

# 3. App
npm install
npm run dev                    # http://localhost:3000
```
Studio local: http://127.0.0.1:54523 · API: http://127.0.0.1:54521

> Variáveis de ambiente em `.env.local` (não versionado). Veja `.env.example`.

## Reimportar a planilha
```bash
py scripts/extract_xlsm.py "D:\Dropbox\ATGC\Custos\1-Laboratorio\Laboratorio1.xlsm"
npx supabase db reset
```

## Regerar tipos do banco (após mudar schema)
```bash
npx supabase gen types typescript --db-url postgresql://postgres:postgres@127.0.0.1:54522/postgres > src/lib/supabase/database.types.ts
```

## Estrutura
```
src/app/                 páginas (App Router)
src/lib/supabase/        clientes server/browser + tipos do banco
supabase/migrations/     0001_init (schema) · 0002_grants_rls (privilégios+RLS)
scripts/extract_xlsm.py  planilha -> seed/seed.sql + CSVs
seed/                    dados importados
docs/modelo-dados.md     mapa das tabelas, fórmulas e achados de qualidade de dados
```

## Notas
- Depreciação de equipamentos é **linear pela vida útil** (não o regime de 222 dias da planilha).
- Todos os parâmetros de custeio ficam na tabela `parametros` (ajustáveis p/ simulação).
- Realtime está desligado no `config.toml` (não usado; evita conflito de seed com outros projetos Supabase locais).

## Design system (redesign 2026-07)

- **Primitivas de página** em `src/components/app/`: `PageShell` (largura/padding), `PageHeader` (breadcrumbs + h1 + ações), `SectionCard`, `StatCard`, `EmptyState`, `FilterBar` e `StatusBadge` (dicionário central status→cor em `status.ts`).
- **Regra de cor**: componentes usam apenas tokens semânticos (`bg-card`, `text-muted-foreground`, `border-border`, `bg-muted` e tons de status `*-soft`/`*-strong` definidos em `src/app/globals.css`). Proibido `slate-*`/`zinc-*` diretos. Exceções: `globals.css`, `src/components/theme/`, cores de séries de gráfico e o documento de emissão (`EmissaoFinalForm`/`orcamento/final/[id]`, identidade institucional GIA/ATGC).
- **Tipografia**: título de página `text-xl font-semibold tracking-tight`; título de seção `text-sm font-semibold`; corpo `text-sm`; meta `text-xs text-muted-foreground`; números sempre `tabular-nums`.
- Specs e planos do redesign: `docs/superpowers/specs/2026-07-02-redesign-visual-kontrol-design.md` e `docs/superpowers/plans/`.
