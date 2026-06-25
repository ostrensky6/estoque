# Diagnostico e plano tecnico - integracao dos orcamentos GIA/ATGC

Data: 2026-06-22

Este documento atende ao bloqueio de `AGENTS.md` e de
`docs/migracao-orcamento-projetos-protocolo.md`: antes de implementar a
migracao/adaptacao do app antigo de orcamento de projetos dentro do Kontrol, foi
feito o diagnostico comparativo entre o app de referencia
`D:\Aplicativos\Orçamentos\Projetos` e o Kontrol em `D:\Aplicativos\Estoque`.

## Fontes inspecionadas

- Next local: `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`,
  `05-server-and-client-components.md` e `07-mutating-data.md`.
- App antigo: `src/components/AnalyticsDashboard.tsx`,
  `src/components/budget-workspace.tsx`, `src/lib/budget.ts`,
  `src/app/orcamentos/*`, `src/components/budget-workspace/*`,
  `supabase/migrations/*`.
- Kontrol: rotas `src/app/orcamento/**`, actions
  `src/lib/actions/demandas.ts`, `orcamentos.ts`,
  `orcamento-projetos.ts`, engines `src/lib/costing/*`,
  `src/lib/orcamento/*`, `src/lib/project-budget/*` e migrations
  `supabase/migrations/0010..0040`.

## Diagnostico do app antigo

| Area | Evidencia | Observacao |
| --- | --- | --- |
| Rotas | `/orcamentos`, `/orcamentos/[id]` | Workspace principal de orcamentos por rubricas. |
| Painel economico | `AnalyticsDashboard.tsx` | Layout denso com KPI grid, tabela de parametros, composicao por rubrica e resultado consolidado. |
| Rubricas | `RUBRICS` em `src/lib/budget.ts` | PE, MC, MP, ST, VD e OU. |
| Formula | `calculateBudget` em `src/lib/budget.ts` | Gross-up unico: subtotal / (1 - soma parametros). |
| Parametros | `taxes`, `incubation`, `reserve`, `investments`, `profit` | Entradas percentuais aplicadas sobre o valor final. |
| PE | `itemTotal` | Se houver meses selecionados, total = meses selecionados x valor unitario. |
| Demais rubricas | `itemTotal` | Total = quantidade x valor unitario. |
| Persistencia | migrations `budgets`, `budget_items`, `budget_versions`, `catalog_items`, `clients`, `coordinators`, `audit_log` | O app antigo normaliza itens, mantem snapshots/versionamento e auditoria. |
| Permissoes | migrations `authorized_users`, `user_roles`, policies RLS | Deve ser mapeado para governanca/perfis do Kontrol, nao copiado isoladamente. |
| Exportacoes/anexos | migrations e componentes | Existem anexos, links publicos, versoes, exportacoes DOCX/PDF/XLSX no ecossistema antigo. |

## Diagnostico do Kontrol atual

| Area | Evidencia | Observacao |
| --- | --- | --- |
| Raiz agregadora | `demandas_propostas` e `/orcamento/demandas` | Ja existe, mas a UI ainda mostra quatro modalidades e exige botoes manuais para gerar modulos. |
| Laboratorio | `orcamentos`, `orcamento_itens`, `src/lib/costing/engine.ts`, `loader.ts`, `actions/orcamentos.ts` | Engine laboratorial existe e deve fornecer `breakdown.custoTotal`/custo tecnico, nao preco formado. |
| Projeto | `orcamento_projetos`, `orcamento_projeto_custos`, `orcamento_projeto_analises` | Projeto ja existe, com rubricas e compatibilidade parcial com app antigo. |
| Catalogo antigo | migration `0012_orcamento_projetos_compat_antigo.sql` | Catalogo do app antigo ja foi importado de forma aditiva para `orcamento_projeto_catalogo`. |
| Parametros | `project-budget/legacy.ts`, `costing/pricing.ts`, `orcamento/parametros-adapter.ts`, `orcamento/orcamento-final.ts` | Ha mais de uma formula/adapter; precisa virar uma engine autoritativa unica. |
| Painel atual | `PainelParametrosEconomicos.tsx` | E generico e menor que o painel antigo; ainda usa `precoLaboratorio + custoProjeto`. |
| Versao final | `orcamento_final_versoes`, `emitirOrcamentoFinalDaDemanda` | Ja ha snapshot imutavel e versionamento, mas a formula do snapshot precisa mudar. |
| Parametros aplicados | migration `0040_orcamento_parametros_aplicados.sql` | Ja persiste formula/snapshot; pode ser preservada com novos campos sem destruir historico. |
| Idempotencia | `gerarOrcamentoAnalisesDaDemanda`, `gerarOrcamentoProjetoDaDemanda` | Hoje fazem `insert` direto; cliques repetidos podem duplicar modulos. |
| Fonte de analises | `orcamento_itens` e `orcamento_projeto_analises` | Ha duplicidade potencial; a fonte canonica deve ser `orcamentos/orcamento_itens`, mantendo leitura historica de `orcamento_projeto_analises`. |

## Comparativo de funcionalidades

| Funcionalidade no app antigo | Existe no Kontrol? | Esta equivalente? | Precisa migrar? | Como migrar | Risco de perda de dados |
| --- | --- | --- | --- | --- | --- |
| Orcamento por rubricas PE/MC/MP/ST/VD/OU | Sim | Parcial | Sim | Reusar `orcamento_projeto_custos` e `project-budget/legacy.ts` como compatibilidade, extraindo calculo final comum. | Medio |
| Painel Parametros Economicos visual | Sim | Nao | Sim | Criar `PainelParametrosEconomicosIntegrado.tsx` baseado na hierarquia de `AnalyticsDashboard.tsx`. | Baixo, se for componente novo |
| Gross-up unico | Sim | Nao | Sim | Criar funcao pura autoritativa para laboratorio + projeto + parametros. | Alto, por impacto financeiro |
| Catalogo de itens | Sim | Quase | Validar | Manter `orcamento_projeto_catalogo`; nao criar tabela paralela. | Baixo |
| PE por meses | Sim | Parcial | Sim | Preservar `meses_selecionados` e testes. | Medio |
| Viagens | Sim | Parcial | Sim | Preservar `project-budget/travel.ts` e UI atual. | Medio |
| Analises dentro de projeto | Sim | Nao no modelo alvo | Adaptar | Usar `orcamento_itens` como canonico e manter adapter de leitura de `orcamento_projeto_analises`. | Alto |
| Templates | Sim | Parcial | Manter | Reusar `orcamento_projeto_templates`. | Baixo |
| Links publicos/anexos | Sim | Parcial | Secundarizar | Manter rotas e mover para "Mais opcoes" na demanda. | Baixo |
| Versionamento final | Sim | Parcial | Sim | Preservar `orcamento_final_versoes`; ajustar snapshot/fomula. | Alto |
| Auditoria | Sim | Sim parcial | Preservar | Nao remover triggers `fn_auditoria`. | Alto |
| Permissoes | Sim | Parcial | Sim | Manter `exigirPapelOrcamento` em Server Actions. | Alto |

## Mapa de tabelas e campos

| App antigo | Kontrol atual | Acao proposta |
| --- | --- | --- |
| `budgets` | `orcamento_projetos` + `orcamento_final_versoes` | Reusar; nao criar `budgets`. |
| `budget_items` | `orcamento_projeto_custos` | Reusar para custos proprios de projeto. |
| `catalog_items` | `orcamento_projeto_catalogo` | Ja importado; validar completude. |
| `budget_versions` | `orcamento_final_versoes` e snapshots de projeto | Reusar versionamento final; avaliar versionamento de projeto se necessario. |
| `clients` | `clientes` + snapshots em demandas/orcamentos | Reusar cadastro central. |
| `coordinators` | `perfis`/responsaveis + snapshots | Mapear sem tabela paralela. |
| `budget_attachments` | `orcamento_projeto_anexos` | Reusar. |
| `public_budget_links` | `orcamento_projeto_links` | Reusar. |
| `audit_log` | `auditoria`/`fn_auditoria` | Reusar. |
| `orcamento_projeto_analises` | `orcamentos` + `orcamento_itens` | Manter apenas como fonte historica/adaptador. |

Campos que precisam de atencao:

- `demandas_propostas.modalidade`: precisa aceitar/exibir as tres canonicas
  `analises`, `projeto`, `projeto_com_analises` e mapear legados
  `analises_projeto` e `projeto_analises_custos`.
- `orcamento_parametros_aplicados`: hoje persiste subtotais aplicados, mas deve
  registrar laboratorio como custo tecnico e explicitar formula de gross-up unico.
- `orcamento_final_versoes`: snapshot ja existe; deve incluir modalidade canonica,
  itens laboratoriais, breakdown laboratorial, itens projeto, percentuais, fator e
  formula.
- Possivel migration aditiva: indice unico parcial por `demanda_id` para evitar
  multiplos modulos ativos de laboratorio/projeto, preservando historicos/cancelados.

## Problemas bloqueadores identificados

1. Markup duplo/semiduplo possivel: `consolidarOrcamentoFinal` usa
   `totalLaboratorioPreco` como parte do `totalFinal`, e o painel atual declara
   "laboratorio (preco ja formado)".
2. Engine economica fragmentada: `src/lib/costing/pricing.ts`,
   `src/lib/project-budget/legacy.ts`, `src/lib/orcamento/parametros-adapter.ts`
   e `src/lib/orcamento/orcamento-final.ts` mantem responsabilidades sobrepostas.
3. Modalidades legadas aparecem como opcoes principais na UI.
4. Geracao de modulos nao e idempotente; actions fazem `insert` direto.
5. Analises de projeto podem ser digitadas em `orcamento_projeto_analises` e em
   `orcamento_itens`.
6. Historico, links, auditoria e fluxo recomendado competem visualmente com as
   etapas principais da demanda.

## Arquitetura proposta

1. Criar uma funcao pura autoritativa em `src/lib/orcamento/orcamento-economico.ts`
   para:
   - normalizar modalidade;
   - consolidar custo laboratorial tecnico;
   - consolidar custo proprio de projeto;
   - aplicar gross-up unico;
   - calcular valores nominais dos parametros;
   - validar soma percentual menor que 100%;
   - gerar payload de snapshot.
2. Fazer `project-budget/legacy.ts` continuar existindo apenas como compatibilidade
   de rubricas/itens antigos, sem ser fonte final de preco consolidado.
3. Alterar adapters para que laboratorio entre por custo tecnico (`custoTotal` ou
   `custo_unitario * n_amostras`) e `preco` fique apenas historico/visual.
4. Criar `PainelParametrosEconomicosIntegrado.tsx` baseado na estrutura do
   `AnalyticsDashboard`, adicionando origem "Laboratorio" ao lado das rubricas.
5. Tornar `salvarDemanda` responsavel por chamar uma rotina idempotente
   `garantirModulosDaDemanda`, que localiza ou cria os modulos obrigatorios.
6. Manter `orcamento_projeto_analises` como leitura historica, mas remover da UI
   principal a digitacao duplicada para demandas `projeto_com_analises`.
7. Simplificar `/orcamento/demandas/[id]`: trilho principal com Demanda,
   Laboratorio, Custos do projeto, Parametros Economicos e Orcamento final;
   historico/anexos/links/exportacoes em area secundaria.

## Proposta de migrations

Somente aditivas, apos aprovacao:

1. Permitir modalidade canonica `projeto_com_analises` nos checks de
   `demandas_propostas` e `orcamentos`, sem remover valores legados.
2. Criar indices unicos parciais para impedir duplicidade de modulos ativos por
   demanda, por exemplo em `orcamentos(demanda_id)` para tipo laboratorio ativo e
   `orcamento_projetos(demanda_id)` para projeto ativo. Cancelados/substituidos
   devem permanecer possiveis.
3. Adicionar metadados opcionais ao snapshot aplicado, se necessario:
   `modalidade_canonica`, `subtotal_laboratorio_custo`,
   `quantidade_amostras_snapshot`, `formula_versao`.
4. Nenhum `DROP TABLE`, `TRUNCATE`, remocao de colunas, remocao de RLS ou
   sobrescrita de migration antiga.

## Plano de rollback

- Antes de migrations: dump logico do schema e das tabelas
  `demandas_propostas`, `orcamentos`, `orcamento_itens`,
  `orcamento_projetos`, `orcamento_projeto_custos`,
  `orcamento_projeto_analises`, `orcamento_final_versoes` e
  `orcamento_parametros_aplicados`.
- Como as migrations propostas sao aditivas, rollback operacional consiste em
  desabilitar a nova UI/engine via codigo e manter leitura dos snapshots antigos.
- Indices/constraints novos devem ser removiveis por migration posterior apenas
  se bloquearem caso historico real nao previsto.

## Criterios de validacao da proxima etapa

- Cenario laboratorio: 100 com 10% impostos e 5% lucro resulta em 117,65.
- Cenario projeto: 200 com 20% resulta em 250,00.
- Cenario projeto com laboratorio: 100 + 200 com 20% resulta em 375,00.
- Soma de parametros maior ou igual a 100 bloqueia emissao e nao persiste versao.
- Mudanca de modalidade cria/libera modulos de forma idempotente sem apagar dados.
- Testes unitarios para calculo, arredondamento, modalidades e idempotencia.
- Testes de UI/integracao para os tres fluxos, permissao de parametros e emissao.

## Plano tecnico curto de implementacao apos aprovacao

1. Adicionar normalizador de modalidades e engine pura de consolidacao economica.
2. Atualizar adapters/actions para usar custo tecnico laboratorial e gross-up
   unico.
3. Trocar o painel por `PainelParametrosEconomicosIntegrado.tsx`, preservando a
   hierarquia visual do app antigo.
4. Implementar criacao/localizacao idempotente dos modulos na action de demanda.
5. Ajustar UI de demanda para tres modalidades canonicas e fluxo sequencial.
6. Criar migrations aditivas e atualizar `database.types.ts`.
7. Atualizar testes unitarios, integracao/e2e, lint, typecheck e build.

## Status

Nenhum codigo de migracao foi alterado neste diagnostico. A implementacao deve
aguardar aprovacao explicita deste plano, conforme protocolo local.
