# Sistema de permissões baseado em dados — Fase 1 (camada do aplicativo)

Data: 2026-06-20
Autor: brainstorming (Kontrol)
Status: para revisão do usuário

## 1. Objetivo

Substituir o controle de acesso atual — baseado em comparação de papéis
hierárquicos espalhada pelo código — por um modelo **orientado a dados**: uma
matriz `papel × capacidade` persistida no banco, editável por um administrador
numa tela visual, com efeito imediato.

Esta é a **Fase 1 de 2**, restrita à **camada do aplicativo** (server actions,
guardas de página e links de navegação). A Fase 2 (fora deste spec) levará a
granularidade fina por papel para a camada de RLS no banco.

**Invariante de não-regressão:** no "Dia 1" o comportamento deve ser
**idêntico ao de hoje**. Nada muda até a matriz ser editada.

## 2. Estado atual (resumo)

- `perfis.papel` é `text` com `check (papel in ('tecnico','coordenador','gestor','admin'))` (migration `0005_auth`).
- Hierarquia no app: `ORDEM = ["tecnico","coordenador","gestor","admin"]` em
  [`src/lib/auth/roles.ts`](src/lib/auth/roles.ts) e duplicada em
  [`src/config/navigation.ts`](src/config/navigation.ts).
- Enforcement hoje:
  - **App:** `temPapel(min)` em ~22 arquivos (compras, pedidos-internos,
    estoque, auditoria, usuários, backups, navegação).
  - **Banco:** `current_papel()`, `fn_exige_papel(min)` e `papel_minimo(min)`
    com literais de papel em `0006_governanca` e `0014_rls_por_papel`
    (RPCs de lote, RLS de `perfis`/`auditoria` e de update por papel).
- Os nomes de papel aparecem como literais em código TS **e** SQL.

## 3. Decisões (do resumo aprovado pelo usuário)

1. **Taxonomia (4 → 5 papéis):** renomear `admin → administrador`,
   `gestor → gerente`, `tecnico → usuário`; manter `coordenador`; **inserir
   novo papel `administrativo`**.
2. **Seed = hoje:** a matriz inicial replica exatamente o comportamento atual
   (coordenador aprova compras/aceita lotes; gerente bloqueia/descarta lotes;
   só administrador gerencia usuários). Nada muda até edição.
3. **Execução (app layer):** novo `src/lib/auth/permissoes.ts` com
   `temPermissao(chave)` lendo a tabela `permissoes_papel`. `administrador`
   sempre retorna `true`. `temPapel()` é **mantido apenas** para a lógica
   hierárquica de navegação. Server actions, guardas de página e links de nav
   passam a usar `temPermissao()` (ex.: link Compras exige `compras.ver`).
4. **UI `/usuarios`:** atualizar para os 5 novos nomes; manter
   criar/editar/excluir; adicionar link/sub-aba para a tela de Privilégios.
5. **UI `/governanca/privilegios` (nova):** só para `administrador`; matriz
   visual com **linhas = capacidades agrupadas por módulo** e **colunas = os 5
   papéis**; checkboxes alternam "permitido"; a coluna `administrador` é
   renderizada marcada e desabilitada; um server action persiste; efeito
   imediato.

## 4. Decisões complementares (confirmadas na revisão)

Dois pontos não estavam no resumo inicial; foram confirmados pelo usuário:

- **D1 — Posição hierárquica de `administrativo`** (usado só pela navegação via
  `temPapel`): `usuário < coordenador < administrativo < gerente < administrador`.
- **D2 — Seed inicial de `administrativo`** (papel novo, sem "comportamento de
  hoje"): mesmas capacidades de **leitura** que `usuário` (vê os módulos
  operacionais/orçamento) **sem** capacidades de aprovação, gestão de lote,
  auditoria ou administração. Entra "só leitura" até a matriz ser editada.

## 5. Arquitetura

### 5.1 Modelo de dados — `permissoes_papel`

Nova tabela (migration `0038_permissoes_papel`):

```
permissoes_papel (
  papel      text not null,      -- referencia os 5 papéis válidos
  chave      text not null,      -- ex.: 'compras.aprovar'
  permitido  boolean not null default false,
  primary key (papel, chave)
)
```

- RLS: leitura para `authenticated`; escrita só para `administrador`
  (via `current_papel()`), espelhando o padrão de `perfis`.
- A linha de `administrador` pode ser omitida do banco (a aplicação força
  `true`); a tela apenas a renderiza marcada/desabilitada.
- A tabela é a **fonte da verdade** consultada por `temPermissao`.

### 5.2 Catálogo de capacidades (chaves)

Chaves no formato `modulo.acao`, agrupadas por módulo para a matriz. Catálogo
**proposto** (a lista definitiva será reconciliada com cada guarda real
existente durante o plano de implementação):

- **analises:** `analises.ver`, `analises.editar`
- **insumos:** `insumos.ver`, `insumos.editar`
- **custeio:** `custeio.ver`
- **estoque:** `estoque.ver`, `estoque.lote.aceitar`, `estoque.lote.gerir`
- **planejamento:** `planejamento.ver`, `planejamento.editar`
- **pedido:** `pedido.ver`, `pedido.criar`, `pedido.aprovar`
- **compras:** `compras.ver`, `compras.aprovar`, `compras.receber`, `compras.cancelar`
- **recebimento:** `recebimento.ver`, `recebimento.registrar`
- **orcamento:** `orcamento.ver`, `orcamento.editar`, `orcamento.parametros.editar`
- **projetos:** `projetos.ver`, `projetos.editar`
- **cadastros:** `cadastros.ver`, `cadastros.editar`
- **governanca:** `auditoria.ver`, `usuarios.gerir`, `backups.gerir`,
  `privilegios.gerir`, `configuracoes.ver`

O catálogo é definido em código (constante única, ex.
`src/lib/auth/capacidades.ts`) — é a "verdade" das linhas da matriz e do que a
UI/guards podem exigir. A matriz no banco guarda apenas o booleano por
`(papel, chave)`.

### 5.3 Seed inicial (invariante "Dia 1 = hoje")

O seed deriva mecanicamente dos limiares atuais (mapeando os nomes antigos para
os novos):

| Capacidade | usuário | coordenador | administrativo | gerente | administrador |
|---|:--:|:--:|:--:|:--:|:--:|
| `*.ver` operacional/orçamento/cadastros | ✓ | ✓ | ✓ (D2) | ✓ | ✓ |
| `*.editar` operacional/catálogo¹ | ✓ | ✓ | — (D2) | ✓ | ✓ |
| `estoque.lote.aceitar` | — | ✓ | — | ✓ | ✓ |
| `estoque.lote.gerir` (bloquear/descartar) | — | — | — | ✓ | ✓ |
| `compras.aprovar/receber/cancelar` | — | ✓ | — | ✓ | ✓ |
| `pedido.aprovar` | (conforme guarda atual) | ✓ | — | ✓ | ✓ |
| `auditoria.ver` | — | — | — | ✓ | ✓ |
| `usuarios.gerir`, `backups.gerir`, `privilegios.gerir` | — | — | — | — | ✓ |

¹ Hoje a maioria das tabelas é `authenticated_all` (qualquer autenticado
edita); por isso `usuário` recebe `*.editar` no Dia 1. Restringir isso é
trabalho da **Fase 2** (RLS fina), fora deste spec.

A coluna `administrador` é sempre permitida (override no código), independente
das linhas no banco.

### 5.4 Camada de execução — `permissoes.ts`

Novo [`src/lib/auth/permissoes.ts`](src/lib/auth/permissoes.ts):

```
temPermissao(chave): Promise<boolean>
  1. lê o usuário e seu papel (reusa usuarioAtual()/papelAtual())
  2. se papel === 'administrador' → true
  3. consulta permissoes_papel por (papel, chave); retorna permitido ?? false
```

- Sem usuário/papel → `false` (fail-closed).
- `temPapel()` permanece em `roles.ts`, **somente** para hierarquia de nav
  (agrupamentos que dependem de "≥ gerente" etc.).
- Substituir as guardas de papel por `temPermissao(chave)` em: server actions
  (compras, pedidos-internos, estoque/lotes, usuários, backups), guardas de
  página e a montagem dos links de navegação.
- Mensagem de acesso negado mantém o padrão atual (retorno `{ ok:false, ... }`
  nas actions; redirecionamento/empty-state nas páginas).

### 5.5 UI `/usuarios`

- Trocar os rótulos para os 5 novos nomes (e o seletor de papel em
  criar/editar). Fluxos de criar/editar/suspender/resetar senha inalterados.
- Adicionar acesso à tela de Privilégios (link ou sub-aba), visível só para
  `administrador`.

### 5.6 UI `/governanca/privilegios` (nova)

- Rota nova sob Governança; guarda: `privilegios.gerir` (⇒ só administrador).
- Matriz: linhas agrupadas por módulo (do catálogo §5.2), colunas = 5 papéis.
- Checkbox por célula reflete `permissoes_papel.permitido`. A coluna
  `administrador` aparece **marcada e desabilitada**.
- Server action `atualizarPermissao(papel, chave, permitido)` (ou em lote)
  faz upsert em `permissoes_papel`, com `revalidatePath`; efeito imediato.
- Empty-state/erro para não-administrador, no padrão de `/governanca/backups`.

## 6. Migrações de banco

Duas migrations novas, **não destrutivas** e reversíveis:

- **`0037_renomeia_papeis`:**
  1. Backup lógico de `perfis` (ou `pg_dump` da tabela) antes de alterar.
  2. `drop constraint` do CHECK antigo; `update perfis set papel = <novo>`
     para os 4 nomes; `add constraint` novo CHECK com os 5 nomes.
  3. Atualizar os literais nas funções/políticas SQL existentes
     (`fn_exige_papel`, `papel_minimo`, policies de `0006`/`0014` que comparam
     `current_papel() in ('gestor','admin')` etc.) para os novos nomes,
     **preservando os mesmos limiares** (sem mudança de comportamento).
  4. Recriar usuários DEV com os novos papéis no seed.
- **`0038_permissoes_papel`:** cria a tabela, RLS e o seed inicial (§5.3).

**Segurança/rollback:** relatório de impacto (lista de policies/funções
tocadas), backup lógico antes, e migration de rollback que reverte os nomes e
remove a tabela. Validação pós-migração: login de cada papel, RPCs de lote por
papel, e a matriz refletindo o comportamento atual.

> Observação: embora o **modelo** de permissão seja app-layer nesta fase, o
> **rename** é inevitavelmente um trabalho de banco (CHECK + dados + literais
> em funções/políticas). Ele só renomeia; não altera quem pode o quê.

## 7. Verificação e testes

- **Unidades (vitest):** `temPermissao` (administrador→true; permitido/negado;
  fail-closed sem usuário) com o Supabase mock — incluir `permissoes_papel` e
  os 5 papéis no seed do mock.
- **Seed = hoje:** teste que, para o seed inicial, cada par `(papel, chave)`
  resolve igual ao limiar antigo correspondente (tabela §5.3).
- **RLS (existente):** `src/lib/security/rls-policies.test.ts` atualizado para
  os novos nomes de papel.
- **Build/lint** verdes; e2e do fluxo de compras/lotes ainda passando.

## 8. Fora de escopo (Fase 2)

- RLS fina por papel/capacidade nas tabelas hoje `authenticated_all`
  (catálogos e operacional) — empurrar a matriz para o banco.
- Permissões por usuário individual além do papel (não solicitado).
- Papéis configuráveis/criação de novos papéis pela UI (a taxonomia é fixa em 5).

## 9. Arquivos afetados (visão geral)

| Área | Mudança |
|---|---|
| `supabase/migrations/0037_*`, `0038_*` | Rename de papéis + tabela `permissoes_papel` + seed |
| `src/lib/supabase/database.types.ts` | Regenerar tipos (nova tabela, papéis) |
| `src/lib/auth/capacidades.ts` (novo) | Catálogo de chaves por módulo |
| `src/lib/auth/permissoes.ts` (novo) | `temPermissao()` |
| `src/lib/auth/roles.ts` | Nova `ORDEM` (5 papéis); `temPapel` restrito à nav |
| `src/config/navigation.ts` | Links via `temPermissao`; nova entrada Privilégios |
| `src/lib/actions/*` (compras, pedidos-internos, estoque, usuarios, backups) | Guardas → `temPermissao(chave)` |
| `src/app/.../page.tsx` (páginas guardadas) | Guardas → `temPermissao(chave)` |
| `src/app/usuarios/*` | 5 nomes + acesso a Privilégios |
| `src/app/governanca/privilegios/*` (novo) | Tela de matriz + server action |
| `src/lib/testing/mock-supabase.ts` | Seed de `permissoes_papel` e papéis novos |
| Testes (`vitest`, `rls-policies.test.ts`) | Cobertura de `temPermissao` e nomes novos |
