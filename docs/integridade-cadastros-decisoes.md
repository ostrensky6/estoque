# Integridade dos cadastros do custeio — decisões e roadmap

Documento de arquitetura para o trabalho de fortalecimento dos cadastros que
alimentam custeio laboratorial, orçamento de análises, orçamento de projetos,
parâmetros econômicos, planejamento, estoque e orçamento final.

> Princípio reitor: **inconsistência cadastral nunca pode virar custo zero
> silencioso**. Toda condição que gere custo técnico incorreto **bloqueia** a
> análise; o que apenas degrada a qualidade do cálculo gera **alerta**.

## 1. O que foi entregue nesta etapa (código, testado, não destrutivo)

Fatia fundacional das ETAPAS 1–3, escolhida por ser **100% verificável offline**
(testes + lint + typecheck + build) e **não destrutiva** (nenhuma migração de
schema, nenhum dado histórico tocado):

| Item | Arquivo | Etapa do plano |
|------|---------|----------------|
| Validador central de integridade (puro) | `src/lib/cadastros/validar-integridade.ts` | ETAPA 1 |
| Loader de servidor do validador | `src/lib/cadastros/integridade-loader.ts` | ETAPA 1 |
| Tela administrativa | `src/app/governanca/integridade-cadastros/page.tsx` | ETAPA 1 |
| Link na navegação (gestor+) | `src/config/navigation.ts` | ETAPA 1 |
| Normalização backend (texto, código, unidade, modo de cobrança) | `src/lib/cadastros/normalizar.ts` | ETAPA 2 (camada pura) |
| Detecção explícita de custo-zero-silencioso | `src/lib/costing/engine.ts` (`validarInsumosCusteio`) | ETAPA 3 (núcleo) |
| Testes | `*.test.ts` (normalizar, validar-integridade, engine) | TESTES 1,2,3,6,8,9,13,23 |

A tela classifica cada análise como **PRONTA / COM_ALERTAS / BLOQUEADA**, com
resumo global e, por análise, a causa específica de cada problema, o cadastro de
origem, a gravidade, a ação recomendada e o link para edição.

### Regras de classificação implementadas

**Bloqueio** (gera custo técnico incorreto):
- insumo ativo sem vínculo (`insumo_id` nulo);
- insumo vinculado sem custo unitário;
- insumo sem modo de cobrança (`null` **não** é tratado como `por_amostra`);
- insumo sem quantidade por amostra;
- nenhuma etapa com produtividade (impede gargalo/rateio);
- parâmetros técnicos essenciais ausentes (ex.: `dias_uteis_ano`);
- equipamento vinculado inexistente ou com peso de alocação inválido.

**Alerta** (degrada o cálculo, mas não o torna incorreto por definição):
- análise sem nome; etapas duplicadas; sem tempo de bancada; sem tempo de
  máquina quando o gargalo é equipamento; quantidade zero; grupo de escolha
  duplicado por caixa/espaço/acento; equipamento sem vida útil/sem custo;
  equipamento não possuído; pessoal/overhead ausentes havendo bancada.

## 2. Decisões arquiteturais

1. **Funções puras + loader fino.** O validador não acessa banco; recebe dados
   já carregados. Isso o torna testável sem mocks de Supabase e reutilizável
   (write-time, emissão de orçamento, telas).
2. **Engine inalterada para preservar snapshots.** `calcularAnalise` mantém o
   fallback histórico (custo ausente ⇒ 0) para **não reescrever o passado**. A
   proteção contra custo-zero é aditiva: `validarInsumosCusteio` detecta e os
   callers de **novos** orçamentos devem bloquear.
3. **Normalização preserva o histórico.** Geram-se *chaves* de comparação; o
   texto exibido nunca é sobrescrito silenciosamente.
4. **`null` nunca é classificado por inferência.** Modo de cobrança e unidade
   desconhecidos retornam `null` (pendente), conforme o plano exige.
5. **Quantidade zero ≠ inativo.** Tratada como alerta de revisão, não como item
   desligado — a semântica de "inativo" exige campo próprio (migração futura).

## 3. Por que as migrações estruturais NÃO foram aplicadas aqui

As ETAPAS 2,4,5,7–12 exigem migrações sobre um **banco de produção já populado**
(Supabase em nuvem). Os próprios princípios do plano e do `AGENTS.md` exigem:
validação sobre dados existentes, backup lógico, relatório de impacto, plano de
rollback e regeneração de `database.types.ts`. Deste ambiente **não há acesso de
escrita ao banco de produção** (ver memória `git-deploy-identidade`), portanto
aplicar migrações sem validar contra os dados reais violaria a regra 11 e o
protocolo de migração. As migrações abaixo ficam **projetadas** e devem ser
geradas/aplicadas com acesso ao banco, cada uma acompanhada de relatório de
registros ambíguos.

## 4. Roadmap de migrações incrementais (projetadas, pendentes de aplicação)

Todas **aditivas** (sem `DROP`/`TRUNCATE`/remoção de coluna), com campos legados
mantidos durante a transição.

- **0041 — normalização de códigos de análise.** Tabela
  `analise_codigo_mapa (codigo_antigo, codigo_canonico)`; preencher via
  `codigoCanonico`; **não** reescrever a PK (FKs vivas) — usar para detectar
  variações e exibir na tela. Constraint de unicidade case-insensitive para
  impedir novas variações: `create unique index on analises (lower(codigo))`.
- **0042 — catálogo de unidades.** Tabela `unidades (canonica, rotulo)` +
  coluna `insumos.unidade_canonica` preenchida por `normalizarUnidade`;
  `unidade` textual preservada. Itens sem equivalência ⇒ relatório.
- **0043 — integridade de insumo_analise.** Colunas `ativo boolean default
  true`, `obrigatorio boolean default true`, `tipo_uso text`,
  `motivo_inativacao text`. Classificar registros com `quantidade_por_amostra =
  0`: os inequívocos ⇒ `ativo=false`; ambíguos ⇒ relatório, fora do cálculo.
- **0044 — modo de cobrança obrigatório.** Classificar apenas regras
  inequívocas; ambíguos ⇒ pendentes + análises bloqueadas. Ao final da
  transição, `check (modo_cobranca in ('por_amostra','por_execucao'))` para
  ativos.
- **0045 — grupos de escolha como entidade.** `grupos_escolha` e
  `grupo_escolha_opcoes (grupo_id, codigo_analise, etapa_id, insumo_id,
  prioridade, ativo, padrao, justificativa_padrao)`; migrar texto→FK
  gradualmente; manter `grupo_escolha` textual como snapshot.
- **0046 — `insumo_analise.etapa_id → etapas.id`.** Mapear por
  `(codigo_analise, nome_etapa, nome_atividade)`; preencher os inequívocos;
  duplicidades ⇒ relatório (não vincular arbitrariamente). `etapa_id` vira a
  relação autoritativa; textos viram snapshot.
- **0047 — semântica de equipamentos.** `tipo_alocacao`,
  `quantidade_utilizada`/`fracao_rateio`, `modo_disponibilidade`,
  `custo_locacao`, `custo_terceirizacao`, `bloqueia_execucao`; convenção única
  de percentual de manutenção (decidir fração 0–1 **ou** 0–100 e migrar com
  segurança — o código atual já usa **fração**). Validações anti dupla
  multiplicação.
- **0048 — processos de pessoal.** `processos`, `tecnico_processos`,
  `etapas.processo_id`. Custo de pessoal por análise só dos processos das suas
  etapas.
- **0049 — escopo de overhead.** `ativo`, `valid_from`, `valid_to`, `escopo`,
  `processo_id`, `justificativa_percentual`, `horas_base`.
- **0050 — catálogo de projetos.** `custo_unitario_base`, `tipo_valor`,
  `fonte_valor`, `valid_from`, `valid_to`; `preco_unitario` vira legado.
- **0051 — snapshots laboratoriais completos.** Colunas/tabela de snapshot por
  item de orçamento (composição integral + versões/timestamps + usuário +
  alertas + override). Orçamento antigo abre pelo snapshot.

Após cada migração: regenerar `database.types.ts`, preservar RLS e revisar
permissões; criar relatório de registros ambíguos.

## 5. Colunas derivadas da planilha ignoradas (ETAPA 6)

O Kontrol importa apenas **dados brutos** e recalcula na engine. **Não** são
fonte de verdade as colunas derivadas da `MCA` equivalentes a: custo por
amostra, custo por execução, amostras por execução, amostras por dia e execuções
por dia — há indício de incompatibilidade entre cabeçalhos e fórmulas na
planilha. A engine (`src/lib/costing/engine.ts`) é a fonte autoritativa de
produtividade, gargalo, rateios e custo por amostra.

## 6. Separação de parâmetros (ETAPA 10) — estado atual e meta

Hoje `calcularAnalise` produz `custoTotal` **e** `preco` (aplica fatores
econômicos). Meta: a engine laboratorial produz **somente custo técnico**; o
preço final vem de `custo_laboratorio + custo_projeto → Parâmetros Econômicos`.
`breakdown.preco` deve ser marcado como **legado** e não usado na consolidação.
Já existe versionamento de parâmetros econômicos (migração 0036) e parâmetros
aplicados (0040) — a consolidação final deve passar a usá-los como fonte única.

## 7. Pendências de validação posterior (precisam de acesso ao banco/planilha)

- Rodar o validador sobre os **dados reais** para listar as análises efetivamente
  bloqueadas hoje (a tela já faz isso quando aberta em produção).
- Insumos citados no plano (`dNTP mix 10 mM…`, `QuantiNova® SYBR®Green RT-PCR
  Kit`): se não houver custo confirmado, cadastrar como **incompleto** (custo
  nulo, bloqueador) — **não** inventar valor. Hoje o validador já os marcaria
  como `insumo.sem_custo`/`insumo.sem_vinculo`.
- Classificação automática de modo de cobrança e de quantidade-zero depende de
  inspeção dos dados reais; registros ambíguos vão para relatório.

## 8. Riscos residuais

- A heurística `etapaUsaMaquina` (tempo de máquina obrigatório) usa
  `tipo_limitacao` textual; ficará precisa quando houver `processo_id`/recurso
  como entidade.
- Aplicabilidade de pessoal/overhead ainda é global (somatório), não por
  processo — sai de alerta para preciso após a migração 0048/0049.
- As migrações projetadas precisam de teste sobre banco populado antes de ir a
  produção (regra 11 + protocolo de migração).

## 9. Fase operacional entregue (branch `feat/integridade-cadastros`)

O validador deixou de ser função auxiliar e virou **trava real**. Resumo do que
mudou nesta fase (sobre o commit `3b1cc2d`):

1. **Guard de custeio** (`src/lib/cadastros/guard-custeio.ts`):
   `assegurarAnaliseLiberada` / `assegurarAnalisesLiberadas`. Análise
   `BLOQUEADA` não entra; override exige permissão + justificativa + auditoria +
   identidade, e carimba o problema no snapshot. Aplicado em: inclusão de
   análise (orçamento e projeto), recálculo, revisão do módulo laboratorial,
   emissão final e geração de planejamento. `calcularTodas` anexa o status de
   integridade a cada breakdown (sem bloquear a exibição).
2. **Permissões** (`src/lib/cadastros/permissoes.ts`): política data-driven
   `cadastros.integridade.{visualizar,corrigir,override}` sobre o sistema de
   papéis (sem hard-code de `gestor+`). `visualizar`/`corrigir` = coordenador+;
   `override` = gestor+.
3. **Fallback histórico**: a engine mantém o fallback **apenas para leitura** de
   snapshots; novos cálculos passam pelo guard.
4. **Migrações renumeradas e implementadas** (a numeração tentativa da seção 4
   foi substituída por estas três, seguras e validadas em banco local populado):
   - `0041` — integridade básica de `insumo_analise` (`ativo`, `obrigatorio`,
     `estado_integridade`, revisão; domínio `modo_cobranca` `NOT VALID`).
   - `0042` — `insumo_analise.etapa_id` (FK), preenche só inequívocos; view
     `vw_insumo_analise_etapa_ambiguos` para os ambíguos.
   - `0043` — `orcamento_item_snapshot` (composição integral + override).
   As migrações 0044–0051 da seção 4 seguem **projetadas** para fases seguintes.
5. **Normalização no write-time**: `cadastros.ts` e `receita.ts` normalizam texto
   no servidor; `modo_cobranca` via `normalizarModoCobranca`; novos códigos via
   `codigoCanonico` (existentes nunca reescritos).
6. **Tela**: filtros (status, cadastro, tipo) + campo/valor por problema.
7. **Preflight** `scripts/sql/preflight-integridade-cadastros.sql` (READ ONLY).

### Retrato real (banco local populado — seed)

`scripts/sql/preflight-integridade-cadastros.sql` e a classificação do validador
sobre os 11 cadastros de análise existentes:

- **PRONTAS: 0 · COM_ALERTAS: 0 · BLOQUEADAS: 11.**
- Causa dominante: **321 de 343** `insumo_analise` sem `modo_cobranca` válido
  (todos NULL). Também: 7 `insumo_analise` sem `insumo_id` (dNTP/QuantiNova),
  18 vínculos ambíguos insumo→etapa, 1 equipamento não possuído alocado,
  técnicos/overhead com dados insuficientes, e o código `Illumina _16S` com
  **espaço interno** (corrigir manualmente; `codigoCanonico` evita novos casos).
- Conclusão: o estado atual **comprova** o valor do guard — sem ele, essas 11
  análises gerariam custo técnico incorreto silenciosamente. Tornar as análises
  prontas exige **classificar `modo_cobranca`** com evidência (futura `0044`) e
  cadastrar custos dos insumos sem vínculo — trabalho de dados, não de código.
