# Matriz de Evidências — Homologação Real Módulo Orçamentos (Staging)

> Documento de evidências da execução do plano `docs/orcamento/2026-06-25-plano-homologacao-real.md`.
> Pilha: PR #3 → PR #12. **Sem merge, sem produção.**

---

## Cadastro Canônico do App Kontrol (confirmado pelo responsável 2026-06-25)

| Item | Valor |
|---|---|
| App de produção | `https://kontrol-gia.vercel.app` |
| GitHub | `ostrensky6/estoque` |
| Branch de produção | `main` |
| Vercel produção | projeto `kontrol-gia` |
| **Supabase PRODUÇÃO — projeto** | `estoque` |
| **Supabase PRODUÇÃO — ref** | `hhxwdcwphitfxywbgtju` |
| Supabase PRODUÇÃO — região | `sa-east-1` |
| Supabase PRODUÇÃO — URL | `https://hhxwdcwphitfxywbgtju.supabase.co` |

> ⛔ **`hhxwdcwphitfxywbgtju` é PRODUÇÃO.** Proibido para homologação, migrations, `db push`, `db reset`, testes destrutivos, limpeza ou qualquer operação remota de Staging.
> O ref `hxrzgisczusgqzwixrhk` permanece **NÃO confirmado** como Staging → também não autorizado para migrations.
> **Não existe, até o momento, um Supabase Staging formalmente identificado.**

---

## Etapa 0 — Auditoria de Retomada (read-only)

**Data/hora:** 2026-06-25 (retomada após interrupção por créditos)
**Operador:** Claude (sessão de retomada)
**Natureza:** somente inspeção, nenhuma mutação executada.

### 0.1 Estado Git

| Item | Valor |
|---|---|
| Worktree desta sessão | `D:/Aplicativos/Estoque/.claude/worktrees/sad-mclaren-d04a63` |
| Branch do worktree | `claude/sad-mclaren-d04a63` (commit `e81bd3c`) — **NÃO é a RC** |
| Working tree do worktree | limpo |
| **Checkout principal** | `D:/Aplicativos/Estoque` |
| **Branch do checkout principal** | `claude/rls-permissoes-orcamentos-fase11` ✅ **(branch RC)** |
| Commit topo RC | `192bd06` "docs(orcamento): adiciona plano e roteiro detalhado de homologacao real" |
| Stash | `stash@{0}` e `stash@{1}` presentes em `main` (não tocados) |

> A sessão anterior operou no **checkout principal** (branch RC), não neste worktree.
> O plano e as migrations 0045–0047 existem **apenas** na branch RC.

### 0.2 Vínculo Supabase / Ambientes — ⚠️ AMBIGUIDADE CRÍTICA

| Item | Valor | Observação |
|---|---|---|
| Stack LOCAL docker | `supabase_db_Estoque` (porta 54522), kong 54521 | rodando; `supabase_db_Estoque` "Up 51 min" (recriado = assinatura de `db reset` local) |
| `.env.local` (usado pelo app) | aponta **somente** para `http://127.0.0.1` | app roda contra LOCAL ✅ |
| Remote **linkado** (`supabase/.temp/linked-project.json`) | ref `hxrzgisczusgqzwixrhk` (name "estoque") | linkado no checkout principal |
| Remote citado em `.env.example` | ref `hhxwdcwphitfxywbgtju` | **ref DIFERENTE** do linkado |
| Identificação staging vs produção | **DESCONHECIDA / NÃO CONFIRMADA** | nenhum dos dois refs documentado como staging |

### 0.3 Reset anterior — local ou remoto?

**Conclusão: LOCAL.** Evidências:
- Transcript anterior mostra apenas `supabase db reset` (sem `--linked`/`--db-url`); o default do comando é o banco LOCAL.
- Container `supabase_db_Estoque` recriado ~51 min atrás enquanto serviços irmãos seguem "Up 4 horas" — assinatura típica de `db reset` local (recria o container db e re-aplica migrations).
- `.env.local` aponta apenas para 127.0.0.1.

### 0.4 Algum comando contra Staging/Produção?

- **Nenhuma evidência** de comando contra remote no transcript ou no estado inspecionado.
- **Produção: nada executado** (confirmado dentro dos limites observáveis).

---

## Etapa 2 — Validação de Migrations (executada contra LOCAL — read-only)

> ⚠️ Validação feita no banco **LOCAL** `supabase_db_Estoque`, que já reflete as migrations da RC após o `db reset` anterior. **Ainda NÃO validado contra um remote de Staging** (bloqueado — ver B1).

| Verificação | Resultado LOCAL | Status |
|---|---|---|
| Migration 0045 aplicada | presente em `schema_migrations` | ✅ |
| Migration 0046 aplicada | presente | ✅ |
| Migration 0047 aplicada | presente | ✅ |
| `projeto_com_analises` aceito | constraint `demandas_propostas_modalidade_check` inclui `projeto_com_analises` | ✅ |
| RPC `emitir_orcamento_final_transacional` existe | `public.emitir_orcamento_final_transacional` presente | ✅ |
| Grants RPC | `authenticated`, `service_role`, `postgres` = EXECUTE | ✅ |
| `anon` SEM EXECUTE | `anon` ausente da lista de grants | ✅ |
| RLS habilitado | `demandas_propostas`=true, `orcamento_parametros_aplicados`=true | ✅ (parcial — demais tabelas a confirmar pela lista exata do plano) |

> Nota: a checagem de RLS usou nomes de tabela presumidos; restam confirmar os nomes exatos listados na seção E do plano.

---

## BLOQUEADORES (exigem decisão humana)

### INFRA-001 — Supabase Staging — **DESBLOQUEADO PARA VERIFICAÇÃO** (Staging oficial identificado) — **PUSH/LINK AINDA NÃO AUTORIZADOS**

> **Status:** DESBLOQUEADO PARA VERIFICAÇÃO · **Severidade:** (rebaixada) · **Bloqueia merge:** Sim, até concluir homologação · **Atualizado em:** 2026-06-25
> **Resumo:** Staging oficial identificado e confirmado read-only na org correta. Produção continua **proibida**. `supabase link`/`db push`/migrations **ainda não autorizados**.

**Staging OFICIAL do Kontrol (confirmado read-only via `supabase projects list` em 2026-06-25):**

| Item | Valor |
|---|---|
| Nome do projeto | `teste_kontrol_provisorio` |
| Project Ref | `bebeqqrrmdvqaabkqfhp` |
| URL | `https://bebeqqrrmdvqaabkqfhp.supabase.co` |
| Org | `syexigkdeqzrlgpsbgtt` ("ostrensky6") — mesma org da produção, **projeto separado** |
| Região | South America / São Paulo (`sa-east-1`) — igual à produção |
| Criado em | 2026-06-25 15:01:11 UTC |
| **≠ Produção?** | ✅ Sim — Staging `bebeqqrrmdvqaabkqfhp` **≠** Produção `hhxwdcwphitfxywbgtju` |

**✅ Relink concluído (2026-06-25):** `supabase link --project-ref bebeqqrrmdvqaabkqfhp` executado com sucesso (`Finished supabase link.`). Confirmado read-only via `supabase projects list`:
- `LINKED ●` agora aponta para **STAGING** `bebeqqrrmdvqaabkqfhp` (teste_kontrol_provisorio).
- Produção `hhxwdcwphitfxywbgtju` **NÃO está mais linkada** (sem marcador) e permanece intocada.
- Nenhum `db push`, migration, SQL ou preflight executado. Nenhum secret/senha impresso ou registrado.

**⚠️ `db push` ainda NÃO autorizado.** Mesmo com o CLI agora linkado ao Staging, qualquer `supabase db push`/migration aguarda autorização explícita do responsável.

**Proibições mantidas:** produção `hhxwdcwphitfxywbgtju` intocável; sem `link`, `db push`, migrations, preflight, limpeza, constraints, merge ou cópia de dados de produção até autorização explícita.

**Decisão humana registrada (2026-06-25):**
- `hhxwdcwphitfxywbgtju` = **PRODUÇÃO** (Kontrol/estoque). **Não tocar.**
- `hxrzgisczusgqzwixrhk` = **não confirmado** como Staging. Sem operação remota de migration até confirmação no Supabase Dashboard.
- Supabase local **não** substitui Staging (apenas conferência técnica preliminar).

**Auditoria read-only de identificação (executada):**

| Fonte | Ref | Org | Nome | Acesso do token atual |
|---|---|---|---|---|
| `supabase projects list` (CLI ao vivo) — marcado **LINKED ●** | **`hhxwdcwphitfxywbgtju`** | `syexigkdeqzrlgpsbgtt` | "ostrensky6's Project" (São Paulo, criado 2026-06-11) | ✅ visível |
| `supabase/.temp/linked-project.json` (arquivo, possivelmente stale) | `hxrzgisczusgqzwixrhk` | `gjkxxhfwezicjasqowji` | "estoque" | ❌ inacessível (`get_project` → "no permission") |
| `.env.example` | `hhxwdcwphitfxywbgtju` | — | — | (= produção) |
| MCP Supabase (outra conta) | `qbqjpercvmncxcjppmvt` | `jbaraiyuoerevocmnigb` | "Sanepar Project" | irrelevante ao estoque |

**Conclusões críticas:**
1. **Não há ambiente de Staging acessível.** O token do CLI do usuário enxerga **somente PRODUÇÃO** (`hhxwdcwphitfxywbgtju`).
2. **`supabase db push --linked` (Passo 3) resolveria para PRODUÇÃO**, pois é o projeto que o CLI reporta como LINKED. O `hxrzgisczusgqzwixrhk` do arquivo está em org inacessível e não pode ser alvo efetivo com este token. → **Passo 3 do plano é perigoso neste ambiente.**
3. Divergência entre `linked-project.json` (`hxrz…`) e o que o CLI reporta como linkado (`hhxw…`) — estado de link inconsistente, reforça o risco.

**Ações de proteção tomadas:**
- **NÃO** executei `supabase db push`, `link`, `db reset` remoto, nem qualquer mutação remota.
- `hhxwdcwphitfxywbgtju` (produção) **não foi tocado** — apenas listado por metadados read-only.
- Homologação remota **PARADA**, conforme regra: "Se não for possível comprovar que hxrzgisczusgqzwixrhk é Staging, pare e solicite criação/identificação formal do ambiente Staging antes de qualquer migration."

**Solicitação ao responsável humano:**
- Criar/identificar formalmente o projeto **Staging** no Supabase Dashboard e fornecer o ref + confirmação documental, **ou**
- Confirmar via Dashboard que `hxrzgisczusgqzwixrhk` é Staging e prover um access token com acesso à org `gjkxxhfwezicjasqowji` (o token atual não a acessa).
- Recomenda-se também corrigir/realinhar o `supabase link` (hoje o CLI aponta para produção) antes de qualquer execução de homologação.

---

## Execução em Staging — Migrations + Testes (2026-06-25)

### Migrations aplicadas no Staging `bebeqqrrmdvqaabkqfhp`
- **Pré-condição verificada:** `supabase projects list` → `LINKED ●` em `bebeqqrrmdvqaabkqfhp`; produção `hhxwdcwphitfxywbgtju` **sem** marcador. ✅
- **`supabase db push --linked`** → EXIT 0. Banco de Staging estava vazio → aplicou toda a cadeia `0001`→`0047`, **incluindo 0045, 0046, 0047** (0044 não existe).
- **`supabase migration list --linked`** → Local = Remote para todas as versões, incluindo 0045/0046/0047. ✅
- **Produção intocada:** push direcionado por `--linked` ao Staging; nenhum comando contra `hhxwdcwphitfxywbgtju`. ✅
- Sem SQL manual, sem preflight, sem limpeza, sem constraints definitivas, sem merge.

### Testes automatizados (working tree da RC, com alterações NÃO commitadas de outro fluxo)

| Suíte | Comando | Resultado | EXIT |
|---|---|---|---|
| Unit/integração | `npm test` (vitest run) | **2 falhas / 179 passou** (181) | 1 |
| Lint | `npm run lint` | **5 erros** (`no-explicit-any`) | 1 |
| Typecheck | `npx tsc --noEmit` | **1 erro de tipo** | 2 |
| Build | `npm run build` | compilou OK; **falha no type-check** | 1 |
| E2E/A11y | `npm run test:e2e` (playwright) | **16 passou / 1 falhou** | 1 |

**Causa-raiz comum (não é defeito da RC commitada):** todas as 4 falhas convergem para alterações **não-commitadas no working tree**, de outro fluxo, fora da pilha PR #3→#12:
- `src/lib/actions/demandas.ts` (Modified, não commitado) → 5 erros de lint `no-explicit-any` e mudança de assinatura de `salvarDemanda`.
- `src/app/orcamento/demandas/[id]/page.tsx` (commitado) consome a assinatura nova → erro de tipo no `tsc`/`build`.
- `src/lib/actions/demandas-sync-rpc.test.ts` (untracked) → 2 falhas unitárias.
- `e2e/orcamento-parametros.spec.ts:9` → `#parametros` não renderiza (página da demanda quebrada pela `demandas.ts` suja).

> Nenhuma correção/stash/cleanup aplicada (fora de escopo). Recomenda-se re-executar a suíte sobre um checkout **limpo** da RC para isolar o status real da pilha.

### Re-validação em checkout LIMPO (clone novo, 2026-06-25)
Clone limpo `D:/Aplicativos/estoque-rc-clean` da branch RC `claude/rls-permissoes-orcamentos-fase11` @ `ec85eac` (working tree vazio, `npm install` limpo).

| Suíte | Resultado (checkout limpo) | EXIT |
|---|---|---|
| `npm test` | ✅ **176 passou / 0 falha** (34 arquivos) | 0 |
| `npm run lint` | ✅ **0 erros** | 0 |
| `npx tsc --noEmit` | ✅ **0 erros** | 0 |
| `npm run build` | ✅ **sucesso** | 0 |
| `npm run test:e2e` | ✅ **17 passou / 0 falha** (mock supabase, porta isolada) | 0 |

**Conclusão:** as 4 falhas anteriores eram **contaminação do working tree local** (alterações não-commitadas de outro fluxo: `demandas.ts`, `demandas-sync-rpc.test.ts`). **A pilha RC commitada (PR #3→#12) está VERDE.** O teste antes falho `orcamento-parametros.spec.ts:9` passa no checkout limpo.

> Nota a11y: o `a11y.spec.ts` registra (log, não-bloqueante) violações `color-contrast` [serious] em Estoque/Compras/Análises/Parâmetros e `scrollable-region-focusable` em Parâmetros econômicos. Os testes passam; são pendências de melhoria de acessibilidade, não bloqueadores.

### Preflight read-only no Staging (2026-06-25)
- `node scripts/sql/verify-preflight-readonly.mjs` → ✅ SQL é SOMENTE LEITURA (sem verbos de escrita/DDL; envolto em `BEGIN; SET TRANSACTION READ ONLY; … ROLLBACK;`).
- Runner `run-preflight-orcamentos.mjs` contra Staging (`PREFLIGHT_ENV=homologacao`, pooler `aws-1-sa-east-1`, sem imprimir a connection string):
  - ✅ `transaction_read_only = on` confirmado · **READ ONLY + ROLLBACK** · nenhuma escrita.
  - Artifacts: `artifacts/orcamento-preflight/2026-06-25T18-31-12-203Z/` (resultado.txt, resultados.json, resumo.md, detalhes/A*.csv).

| Check | Sev. | Ocorrências | Verificação |
|---|---|---:|---|
| A1 | ALTA | 0 | demandas com >1 orçamento laboratorial ativo |
| A2 | ALTA | 0 | demandas com >1 orçamento de projeto ativo |
| A3 | ALTA | 0 | análises repetidas no mesmo orçamento laboratorial |
| A4 | ALTA | 0 | mesma análise duplicada lab × análises-de-projeto |
| A5 | MEDIA | 0 | custos de catálogo repetidos no mesmo orçamento de projeto |
| A6 | ALTA | 0 | versões finais com módulos cancelados no snapshot |
| A7 | ALTA | 0 | números de versão final duplicados |
| A8 | ALTA | 0 | mais de uma versão vigente por demanda |
| A9 | ALTA | 0 | parâmetros aplicados duplicados por versão |
| A10 | MEDIA | 0 | registros órfãos |
| A11 | MEDIA | 0 | modalidades legadas e canônica coexistindo |
| A12 | ALTA | 0 | status incompatíveis (demanda/módulos/proposta) |
| A13 | MEDIA | 0 | itens com custo zero sem justificativa |
| A14 | ALTA | 0 | total final que não reconcilia com snapshot |
| A15 | ALTA | 0 | conflito de numeração de migrations aplicadas |

**Resultado:** 15/15 checks com **0 ocorrências** (esperado — Staging recém-migrado, sem dados). Nenhum bloqueador; nenhuma decisão manual exigida; nenhuma limpeza executada.

### Re-validação read-only do Staging (pós suíte limpa)
- `supabase projects list` → `LINKED ●` em `bebeqqrrmdvqaabkqfhp`; produção `hhxwdcwphitfxywbgtju` **sem** LINKED. ✅
- `supabase migration list --linked` → 0045/0046/0047 com Local=Remote (aplicadas no Staging). ✅
- Produção intocada; sem preflight (não autorizado).

---

## Checklist de Retomada da Homologação Remota (executar SOMENTE após desbloquear INFRA-001)

> Nenhum passo abaixo deve registrar chaves reais em texto. `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` permanecem como placeholders ou são configuradas apenas no ambiente seguro apropriado.

### Pré-condições (gate de INFRA-001) — todas obrigatórias
- [ ] **Ref formal do Supabase Staging** fornecido pelo responsável (≠ `hhxwdcwphitfxywbgtju`, ≠ produção).
- [ ] **Confirmação visual/documental no Supabase Dashboard** de que o ref é o ambiente de Staging/Homologação (print/registro anexado a este doc).
- [ ] **Access token** com acesso à organização correta do Staging (o token atual NÃO acessa a org `gjkxxhfwezicjasqowji`).
- [ ] **`supabase link`** apontando explicitamente para o ref de Staging.
- [ ] **Verificação read-only** de que produção `hhxwdcwphitfxywbgtju` **NÃO** está linkada:
      `supabase projects list` deve marcar `LINKED ●` no ref de Staging e nunca em `hhxwdcwphitfxywbgtju`.
- [ ] Conferir `supabase/.temp/linked-project.json` consistente com o ref de Staging (eliminar divergência atual `hxrz…` vs `hhxw…`).

### Sequência de execução (após o gate acima 100% verde)
- [ ] Passo 1 — checkout RC `claude/rls-permissoes-orcamentos-fase11` + árvore limpa.
- [ ] Passo 2 — `npm install`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- [ ] Passo 3 — `supabase db push --linked` (0045, 0046, 0047) **contra Staging** + validação pós-migration (seções 2.A–2.E do plano).
- [ ] Passo 4 — secrets de Staging (sem expor valores).
- [ ] Passo 5 — preflight read-only diagnóstico (A1–A15).
- [ ] Passo 6 — `npm test`, `npm run test:e2e` (E2E/A11y).
- [ ] Etapa 5 — 16 testes funcionais manuais.
- [ ] Etapa 6 — preencher matriz de evidências por cenário.

### Salvaguardas permanentes (não negociáveis nesta etapa)
- Não tocar produção `hhxwdcwphitfxywbgtju`.
- Não `db reset`/`db push` remoto fora de Staging.
- Não relinkar para produção. Não alterar secrets de produção. Não fazer merge. Não recalcular propostas históricas. Não aplicar constraints definitivas fora do escopo. Local não substitui Staging.

---

## Pendente (bloqueado por INFRA-001)
Build/tsc/lint, `npm test`, E2E/A11y, preflight read-only, testes funcionais manuais (16 cenários), reconciliação DOCX/XLSX — todos aguardam a identificação formal do Staging.
