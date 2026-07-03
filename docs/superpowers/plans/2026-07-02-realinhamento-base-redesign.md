# Redesign visual do Kontrol — Registro de mudanças e plano de realinhamento

Data: 2026-07-02
Branch de trabalho: `claude/bold-wu-4a19e2` (worktree `D:\Aplicativos\Kontrol\.claude\worktrees\bold-wu-4a19e2`)
Status: **PAUSADO — base incorreta detectada.** Nada foi enviado para fora da máquina (sem push, sem deploy).

---

## 1. O que foi feito (commits na branch `claude/bold-wu-4a19e2`)

Base usada (incorreta): `origin/main` @ `783e6e4`.

| Commit | Conteúdo | Portável para a base correta? |
|---|---|---|
| `88e6c21` | Spec do redesign — `docs/superpowers/specs/2026-07-02-redesign-visual-kontrol-design.md` | Sim (documento novo) |
| `9935d73` | Plano de implementação (11 tasks, 5 fases) — `docs/superpowers/plans/2026-07-02-redesign-visual-kontrol.md` | Sim (documento novo) |
| `dbfba95` | Tokens semânticos de status em `src/app/globals.css` (`--success/warning/info/danger` soft+strong, claro e escuro) + gradiente do canvas suavizado | Reaplicar manualmente (o arquivo mudou na base correta) |
| `a182890` | Primitivas `PageShell` e `PageHeader` em `src/components/app/` | Sim (arquivos novos) |
| `8eacd46` | Primitivas `SectionCard`, `StatCard`, `EmptyState`, `FilterBar` | Sim (arquivos novos) |
| `166748a` | `StatusBadge` + dicionário central `status.ts` (~60 status do domínio) + teste vitest | Sim (arquivos novos) |
| `c4fbde5` | `PageLoading` reescrito com tokens | Reaplicar manualmente (conferir versão da base correta) |
| (não commitado) | Task 6 — restyle de `Sidebar.tsx`/`SideNav.tsx` | **Descartar e refazer** (a base correta tem navegação nova) |

Alterações locais auxiliares (não são código do app):

- `.env.local` copiado da pasta principal para a worktree (rodar dev server local).
- `.claude/launch.json`: adicionada configuração `mock` (dev server com `PLAYWRIGHT_MOCK_SUPABASE=1` para visualizar o app autenticado).

Verificações que passaram durante o trabalho: `npm run lint`, `npm test` (178 testes, incluindo 2 novos de `statusInfo`), colapso/persistência da sidebar, dark mode e render autenticado em modo mock.

## 2. Problema detectado

- A worktree foi criada a partir de `origin/main` (`783e6e4`).
- A pasta principal `D:\Aplicativos\Kontrol` está na branch **`codex/recuperacao-hibrida-kontrol-reconcile-main`** (`9a37387`) — **19 commits à frente da main**, contendo o resgate da produção (26/06) reconciliado + correções de julho (cadastro de insumos, ficha técnica de análises, redefinição de senha por admin).
- Diferença total: **189 arquivos, +20.484/−1.384 linhas.** Atinge diretamente o redesign:
  - `src/components/layout/SideNav.tsx` reescrito (229 linhas);
  - novos `ModuleTopNav.tsx` / `ModuleTopNavClient.tsx` (navegação "macroblock");
  - `src/app/globals.css` com 49 linhas novas;
  - `DataTable.tsx` alterado; novo `QrCode.tsx` (+teste).
- Conclusão: o redesign estava sendo aplicado sobre a versão **antiga** do app. A `main` não é a verdade; a verdade operacional é a branch da pasta principal.

## 3. Plano de realinhamento

### Etapa 0 — Congelar a verdade
1. `git -C D:\Aplicativos\Kontrol status`: se houver alterações não commitadas na pasta principal, commitá-las primeiro em `codex/recuperacao-hibrida-kontrol-reconcile-main` (fazem parte da versão verdadeira).
2. Base-alvo fixada: `codex/recuperacao-hibrida-kontrol-reconcile-main` (`9a37387`).

### Etapa 1 — Recriar a branch do redesign na base correta
```bash
git checkout -b claude/redesign-v2 codex/recuperacao-hibrida-kontrol-reconcile-main
git cherry-pick 88e6c21 9935d73            # docs (spec + plano)
git cherry-pick a182890 8eacd46 166748a    # primitivas (arquivos novos)
# Reaplicar manualmente:
#  - tokens de status no globals.css da base nova (dbfba95)
#  - PageLoading com tokens (c4fbde5), conferindo a versão da base
```
Validação: `npm run lint && npm test`.

### Etapa 2 — Re-diagnosticar o shell na base nova
Ler `ModuleTopNav.tsx`, `ModuleTopNavClient.tsx`, `SideNav.tsx` e `layout.tsx` da base correta e atualizar a Task 6 do plano: o alvo passa a ser **sidebar + top-nav de módulo**, mesmas regras (tokens, chrome leve, zero perda funcional).

### Etapa 3 — Retomar o plano original (Tasks 6→11)
O spec e a receita permanecem válidos — estética sóbria (referência Linear/Notion), primitivas, migração por fases:
1. Shell + Dashboard;
2. Orçamento/Análises/Projetos/Custeio;
3. Planejamento/Estoque/Insumos/Compras/Pedido/Recebimento;
4. Cadastros/Usuários/Auditoria/Governança/Login etc.;
5. Varredura final anti-`slate/zinc` + lint + testes + Playwright/axe + revisão visual (claro/escuro/mobile/impressão).

Regra de ouro mantida: **nenhuma funcionalidade, campo, ação, link, permissão ou regra de negócio é removida**; impressão de orçamentos e exportações intocadas.

### Etapa 4 — Entrega
Merge final da `claude/redesign-v2` na `codex/recuperacao-hibrida-kontrol-reconcile-main` (não na `main`, que está desatualizada).

## 4. Protocolo de economia para a execução
- Zero re-exploração: spec e plano prontos; ler somente os arquivos que serão editados.
- Testes por fechamento de task; Playwright/axe apenas no fim de cada fase.
- Preview visual apenas nas tasks visuais (shell, dashboard, fechamento de fase).
- Execução fatiada opcional: uma etapa/fase por pedido, para controle de gasto.
