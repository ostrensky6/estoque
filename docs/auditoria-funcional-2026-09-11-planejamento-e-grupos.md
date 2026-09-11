# Auditoria funcional — primeiro conjunto de correções

Data: 2026-09-11 · Branch: `claude/app-functionality-audit-22caf7` · Versão: `1.0.5`

Três estados são mantidos separados ao longo do documento:

- **Corrigido no código** — alteração escrita e revisada no repositório.
- **Testado localmente** — comportamento exercido contra o banco local de testes
  ou pela suíte automatizada.
- **Validado em produção** — **não ocorreu para nenhum item.**

## Situação dos bloqueios

| Bloqueio | Situação final |
| --- | --- |
| Supabase `gkcjzwfsnoknxgpsumxi` (produção) | **Persiste.** `list_projects` volta vazio; `list_migrations` retorna `You do not have permission to perform this action`. Nenhum projeto substituto foi usado. Produção **não verificada**. |
| Ambiente local do Kontrol | **Resolvido.** O registro compartilhado passou a permitir projetos em paralelo sob isolamento próprio, e o uso do Engine foi autorizado. |

### Ambiente local utilizado

- Distro WSL `CSC-Docker-Engine`, Docker Engine 29.7.2.
- CLI Supabase **Linux** 2.117.0 em `~/kontrol/bin`, binário ELF x86-64 conferido.
  O `npx` visível dentro da distro resolve para o Node do **Windows** e não foi
  usado em nenhum momento.
- `project_id = "Estoque"` → containers e volumes `*_Estoque`, distintos de
  `iagen-csc` e `cardume`.
- Portas 54520–54529. CSC ocupa 54321/54322 e Cardume 54622 — sem colisão.
- Banco recriado com `supabase db reset --local`. É **banco de testes novo**,
  semeado por `seed/seed.sql`. **Não é recuperação dos dados antigos do Kontrol.**
- Nenhum recurso de CSC ou Cardume foi tocado. Nenhuma limpeza global, mudança
  de contexto Docker ou parada de distro. A distro para sozinha por ociosidade;
  foi mantida viva por um processo próprio durante os testes.

## Achados

### P1 — `DELETE` direto em `planejamento` desfazia reservas sem autorização

Quatro camadas verificadas — inclusive a de privilégio de tabela, que foi a que
derrubou P4:

| Camada | Estado anterior |
| --- | --- |
| Aplicação | `excluirPlano` sem nenhuma guarda de papel |
| Privilégio de tabela | `grant insert, update, delete on all tables … to authenticated` (0002). Diferente de `lotes_estoque`, `reservas_estoque`, `estoque_movimentacoes` e `equipamento_reservas`, `planejamento` **não** entrou nas revogações de 0085 |
| RLS | `rls_tecnico_delete_planejamento`, criada pelo laço `format()` de 0014 → `papel_minimo('tecnico')` |
| Gatilho | 0091/0102 interceptam só `status_operacional`; `DELETE` não era interceptado |

O peso está no cascade: `planejamento` é referenciada por `planejamento_itens`,
`reservas_estoque`, `planejamento_lote_conferencias` e `equipamento_reservas`
com `on delete cascade`, e por `pedidos_internos` com `set null`. Desfazer
reserva é operação de coordenador (`liberar_plano`,
`cancelar_planejamento_operacional`); o `DELETE` produzia o mesmo efeito a
partir do papel mínimo.

**Reproduzido no banco de teste** antes de corrigir.

### P2 — Sucesso relatado sem confirmação de efeito

`adicionarItem`, `removerItem` e `excluirPlano` chamavam `await supabase.from(...)`
sem capturar `error`, seguindo direto para `revalidatePath`/`redirect`.

Capturar `error` não resolve sozinho, e isso foi **comprovado no banco**: um
`DELETE` de técnico em `analises` (política de coordenador) retorna
`error: null` com **zero linhas**. Só o `RETURNING` — o `.select()` do cliente —
distingue negação de sucesso.

### P3 — Planejamento sem trilha de auditoria

`planejamento` e `planejamento_itens` não tinham gatilho `fn_auditoria`. As
reservas filhas têm, e os `DELETE` em cascata disparam gatilhos de linha: as
reservas sumiam **com** registro, mas sem registro da causa.

Sobre autorização de edição: **não existe regra declarada** para o módulo
Planejamento — `src/lib/orcamento/governanca.ts` cobre apenas Orçamentos. Um
técnico editar um rascunho não contraria nenhuma regra escrita, e por isso
nenhum piso de papel foi imposto. Definir essa regra é decisão pendente.

### P4 — RETIRADO: `equipamento_reservas` já estava fechada

A auditoria afirmou que a policy ampla recriada por 0081 deixava a tabela
gravável. **A afirmação não se sustenta.** A migration 0085 já havia:

- revogado `insert, update, delete` de `authenticated` (`0085:21`);
- revogado `all` de `anon, public` (`0085:14`);
- removido `authenticated_all_equipamento_reservas` e criado
  `rls_read_equipamento_reservas`, somente `select` (`0085:31–36`).

O erro foi de método: procurei a substituição da policy em 0100 e 0103, não em
0085, e não verifiquei a camada de privilégio. **Privilégio de tabela e política
de linha são portões independentes; ambos precisam permitir.** Nenhuma migration
deste conjunto altera essa tabela.

### C1 — Grupos de amostras digitados e não persistidos

> **Alcance exato desta correção.** C1 está corrigido para **criação** dos grupos
> e das associações análise↔grupo, e para a **preservação** deles em salvamentos
> posteriores. A **edição** desses dados depois da criação continua pendente: o
> editor de grupos existe apenas na tela de criação. Isto **não** é o
> gerenciamento completo de grupos.


`DemandaForm` enviava `grupo_key`, `grupo_identificacao`, `grupo_tipo_matriz` e
`grupo_quantidade`; nenhuma server action lia esses campos.
`demanda_grupos_amostras` (0056) nunca recebia linha e
`demanda_analises.grupo_amostra_id` nunca era preenchida. Sobrevivia só o
derivado: soma em `quantidade_amostras_estimada` e concatenação em
`matriz_amostra`.

Achado colateral: `mock-supabase.ts` implementava a RPC
`sincronizar_demanda_analises`, que **não existe em nenhuma migration nem é
chamada por código de aplicação**. E o `rpc` do mock terminava em
`return { data: null, error: null }` — qualquer RPC desconhecida devolvia
sucesso. O mesmo defeito de P2, no nível do harness.

### Retratação — `receita.ts` não é vulnerabilidade

Uma triagem por expressão regular apontou 15 de 15 ações sem guarda. Verificado o
caminho completo, a conclusão se inverte: `receita.ts` usa `createClient`
(sujeito a RLS) e 0014 coloca `analises`, `etapas`, `equipamento_analise` e
`insumo_analise` no bloco **coordenador**. Nenhuma migration posterior cria
política sobre elas. Um técnico é barrado.

Permanecem válidos apenas: a negação chegar como erro cru do Postgres, e a
ausência de trilha de auditoria nessas tabelas.

**Contagem de guardas não comprova cobertura.** Foi uma inferência por contagem
que produziu o erro original — a triagem não enxergava o wrapper
`exigirPapelOrcamento`.

## Correções aplicadas

### Migrations

| Migration | Conteúdo |
| --- | --- |
| `0104_planejamento_autorizacao_trilha_e_grupos_demanda.sql` | Gatilhos `fn_auditoria` em `planejamento` e `planejamento_itens`; RPC `excluir_planejamento_rascunho`; gatilho `BEFORE DELETE` com marcador autorizado (padrão de 0103); RPC `sincronizar_demanda_grupos`. |
| `0105_demanda_grupos_e_analises_transacional.sql` | RPC `salvar_demanda_com_grupos`: demanda, grupos e associações análise↔grupo em uma transação. Update por chave presente no payload, para não apagar campos que o formulário não exibe. |
| `0106_grupos_demanda_preservar_quando_ausente.sql` | `p_grupos NULL` preserva os grupos; `'[]'` remove. Corrige a regressão descrita abaixo. |

Todas aditivas, idempotentes, com rollback documentado no cabeçalho.

**Regra de exclusão adotada, sujeita a confirmação:** exclusão física de
planejamento só é admissível em `rascunho` sem vínculo algum. Nos demais casos o
caminho é o cancelamento operacional, que preserva histórico. **Planos com
vínculo deixam de ser excluíveis** — mudança de comportamento deliberada, que
precisa de aceite.

### Aplicação

| Arquivo | Mudança |
| --- | --- |
| `src/lib/supabase/escrita.ts` (novo) | `garantirEscrita`/`conferirEscrita`: exigem linha devolvida por `.select()`, não apenas ausência de erro. |
| `src/lib/orcamento/grupos-amostras.ts` (novo) | Leitura pura de grupos e análises do `FormData`, com validação que recusa em vez de descartar. `null` = campos ausentes (preservar); `[]` = remover. |
| `src/lib/actions/planejamento.ts` | `excluirPlano` via RPC, redirect só após confirmação; `adicionarItem`/`removerItem` com `.select()` + `garantirEscrita`. |
| `src/lib/actions/demandas.ts` | `criarDemanda` e `salvarDemanda` validam antes de escrever e gravam por uma única RPC transacional; derivam `matriz_amostra` e `quantidade_amostras_estimada` no servidor. |
| `src/components/orcamento/DemandaForm.tsx` | Envia `grupo_id` para atualizar grupo existente em vez de recriar. |
| `src/lib/testing/mock-supabase.ts` | RPC desconhecida passa a **falhar explicitamente**; cada ramo simulado retorna por conta própria; adicionadas as simulações das RPCs novas. |

## Regressão encontrada pelo teste de interface

Só o fluxo pela interface contra o banco local revelou: a tela de detalhe
(`/orcamento/demandas/[id]`) salva a demanda **sem nenhum campo de grupo**,
porque o editor de grupos só existe na tela de criação. Com a primeira versão da
correção, `lerGruposAmostras` devolvia `[]` e a RPC **apagava todos os grupos** e
zerava as associações.

Reproduzido pela interface (1 grupo + 1 associação → 0 e 0), corrigido pela
0106 mais o contrato `null`/`[]`, e re-testado pela interface: após salvar pela
tela de detalhe, grupo e associação permanecem.

Uma segunda regressão apareceu no mesmo teste: os campos ocultos `grupo_unidade`
e `grupo_observacao` acrescentados por mim duplicavam campos visíveis já
existentes, enviando 4 valores para 2 grupos. Removidos, e a validação de
alinhamento passou a cobrir todos os campos repetidos.

## Evidências

### Testado localmente — contra o banco real

`scripts/sql/validacao-0104-0105.sql`, executado a partir de banco recriado.
Identidades reais por papel (`set local role authenticated` + claims de JWT),
sem acesso administrativo para simular usuário. **15 de 15 asserções passaram:**

| Teste | Resultado |
| --- | --- |
| T0 reprodução do defeito pré-0104 | DEFEITO REPRODUZIDO (técnico apagou 1 linha), revertido |
| T1 técnico, `DELETE` direto | bloqueado `42501` |
| T2 técnico, via RPC | bloqueado `42501` |
| T3 marcador transacional forjado por `set_config` | bloqueado `42501` |
| T4 coordenador, plano com dependência | bloqueado `23503` |
| T5 coordenador, plano fora de rascunho | bloqueado `22023` |
| T6 coordenador, rascunho elegível | excluído, itens removidos |
| T7 trilha de auditoria | ator registrado (`coord@teste.local`) |
| C1-T1 criar demanda + grupos + análises | 2 grupos, 2 análises associadas |
| C1-T2 reabrir | grupos e associações preservados |
| C1-T3 editar | id do grupo mantido preservado |
| C1-T4 falha na criação | nada órfão |
| C1-T5 falha na edição | estado anterior intacto |
| C1-T6 `NULL` preserva / `[]` remove | 1 → 1 → 0 |
| P2 negação silenciosa + contraprova | `error: null` com 0 linhas; coordenador devolve 1 |

Autorização da RPC nova, verificada à parte: grupo de outra demanda recusado
(`23503`) sem afetar a demanda de origem; `anon` negado (`42501`) nas duas RPCs;
demanda inexistente recusada (`P0002`).

### Testado localmente — fluxo pela interface contra o banco local

App servido contra `http://127.0.0.1:54521`, autenticado como usuário real
(`qa@local.test`, papel `coordenador`). Criada uma demanda com dois grupos de
matrizes distintas e uma análise em cada. Gravado no banco:

- `demandas_propostas`: `matriz_amostra = "Água; Sedimento"`,
  `quantidade_amostras_estimada = 20` — ambos derivados no servidor a partir dos
  grupos (12 + 8).
- `demanda_grupos_amostras`: `Ponto A / Água / 12 / ordem 1` e
  `Ponto B / Sedimento / 8 / ordem 2`.
- `demanda_analises`: `Eletrof_vir_hem → Ponto A`, `qPCR_F → Ponto B`.

Depois, salvamento pela tela de detalhe preservou grupo e associação.

### Testado localmente — suíte automatizada

`tsc --noEmit` sem erros · `eslint` sem problemas · `vitest` 65 arquivos /
**377 testes** · `next build` ok · `playwright` **24 testes**, todos passando
com o fallback estrito do mock ativo.

## Pendências

### Não validado em produção

1. Se as migrations estão todas aplicadas — governa a decisão sobre os fallbacks
   `erroSchemaCache`, que regravam planejamento sem `origem_planejamento`,
   `orcamento_id` e `planejado_por`, em silêncio.
2. O que a chave anônima permite sem sessão, e o que cada papel alcança com
   sessão. A chave é pública por projeto; a pergunta é a superfície efetiva.
3. Políticas efetivas em produção versus as derivadas das migrations.

### Lacunas conhecidas

1. **Não há editor de grupos na tela de detalhe da demanda.** Grupos só podem ser
   definidos na criação. A correção garante que salvar pela tela de detalhe não
   os destrua, mas editá-los depois exige levar o editor para lá.
2. `demanda_analises` só é gravada pela RPC nova, a partir do formulário de
   criação. Não há outra escrita no app.
3. A regra de autorização do módulo Planejamento continua indefinida.

## Decisões do responsável — registradas em 2026-09-11

| Decisão | Orientação aprovada | Situação |
| --- | --- | --- |
| Exclusão física de planejamento | **Aprovada a regra da 0104**: coordenador ou superior pode excluir rascunho sem as dependências operacionais verificadas. Planos com reservas, conferências ou pedidos seguem liberação ou cancelamento, preservando histórico. | **Já implementada** nesta entrega. |
| Autorização de Planejamento | Preservar para técnicos as operações já permitidas pelas RPCs existentes. Reservar a coordenador ou superior: alteração de planejamento executivo, liberação, cancelamento e exclusão elegível. Registrado explicitamente como **proposta de regra de negócio nova**, não como regra anterior comprovada. | **Pendente de implementação**, em alteração própria. |
| Matriz canônica de permissões | Adotar o catálogo global de permissões granulares (`src/lib/auth/permissions.ts`) como referência e fazer as configurações do administrador valerem de fato. Integrar Orçamentos a esse modelo aproveitando `governanca.ts`. Ações e banco precisam corresponder ao que o administrador configura. | **Pendente de implementação**, em alteração própria. |

### Encaminhamento acordado

1. Versionar as correções já validadas localmente. ✔ feito nesta entrega.
2. Implementar as regras de autorização acima, em alteração própria.
3. Incluir a edição de grupos e associações na demanda existente.
4. Retomar os demais achados abertos da auditoria.

Novos recursos e reorganizações de arquitetura ficam fora deste fechamento.
Uma correção só é reaberta diante de falha concreta.
