# Diagnóstico comparativo — orçamento de projetos (app antigo × Kontrol) — 25/09/2026

Entregável exigido por `docs/migracao-orcamento-projetos-protocolo.md` antes de qualquer código de
migração. Substitui, onde houver conflito, o diagnóstico preliminar de 13/06/2026
(`docs/migracao-orcamento-projetos-diagnostico-preliminar.md`), que não tinha acesso ao código-fonte.

**Status: aguardando aprovação.** Nenhum código de migração foi escrito.

## 0. Fontes e limitações

| Fonte | Acesso | Observação |
|---|---|---|
| Código do app antigo `G:\Aplicativos\Projetos-reference` (= `D:\...`, mesmo commit `3b97704`, 25/05/2026) | Lido integralmente | Repositório `Ostrensky2/Projetos`, nome `atgc-orcamentos` 2.0.0, deploy `orcamento-projetos.vercel.app` |
| Migrations do app antigo `001`–`010` | Lidas | README diz que 004–010 **podem não estar aplicadas em produção** |
| Supabase antigo (dados reais) | **Não acessado** | Ver riscos R1–R3 |
| Kontrol, branch `claude/kontrol-ui-ux-audit-9dd16c` (base `main` `a8f96a5`) | Lido | Código, migrations 0010–0109, histórico git |

Não verificado: dados de produção do Supabase antigo e do Kontrol, localStorage dos navegadores dos
usuários antigos, políticas efetivamente aplicadas no banco antigo.

---

## 1. Diagnóstico do app antigo

- **Uma única tela** (`src/app/page.tsx` → `BudgetWorkspace`), com abas internas: PE, MC, MP, ST, VD,
  OU, Catálogo, Parâmetros Econômicos, Salvos, Fundos e taxas, Configurações. Não existe rota
  `/configuracoes` (a aba Configurações só gerencia usuários).
- **Cabeçalho do orçamento:** número, projeto, cliente (texto livre), meses (1–60, padrão 12), status.
  `coordinator`, `owner_name` e `notes` existem no banco mas **não têm campo na tela**.
- **Rubricas:** PE Pessoal, MC Material de Consumo, MP Material Permanente, ST Serviços de Terceiros,
  VD Viagens e Diárias, OU Outros.
- **PE:** valor mensal × meses marcados numa grade M1…Mn (paginada por ano). Sem encargos.
- **VD:** entradas de viagem (pessoas, dias de campo, fator de risco, diárias de hotel, quartos,
  veículos, km, consumo km/L, pedágios, passagens) que calculam a quantidade dos itens pelo texto da
  descrição (alimentação, hospedagem, combustível, pedágio, passagem, aluguel, seguro).
- **Cálculo (Next.js, atual):** todos os cinco parâmetros (impostos, incubação, reserva, investimentos,
  lucro) incidem sobre o **preço bruto**: `fator = 1/(1 − Σ%)`; `total = subtotal × fator`;
  bloqueio se `Σ ≥ 100%`. Teste de referência: custo 100 com 10/5/5/5/5 → **142,86**; impostos 14,29.
- **Cálculo v1 (Vite/Electron, legado):** reserva, investimento e lucro sobre o **custo**; só impostos
  e incubação em gross-up. Não é o cálculo vigente do app antigo.
- **Status:** `em_preparacao`, `em_analise_cliente`, `aprovado` (sem fluxo obrigatório). Default do
  banco é `rascunho` — divergência interna do app antigo.
- **Salvos:** filtros, status e data de confirmação inline, Editar, Duplicar, "Versão" (nova linha
  `base-V{n}`), XLSX, DOCX, Excluir.
- **Fundos e taxas:** para aprovados, valor pago e gasto por fundo (impostos, incubação, reserva,
  investimentos); liberado = planejado × (pago/total). **Salvo só no localStorage.**
- **Catálogo:** CRUD inline (grupo, descrição, unidade, preço); exclusão = arquivar.
- **Importação de planilha** com abas PE/MC/MP/ST/VD/OU e números no formato brasileiro.
- **Exportação:** XLSX (Projeto, Itens, Demonstrativo) e DOCX. Sem PDF.
- **Persistência:** localStorage primeiro, depois `budgets` no Supabase. **Não vão para a nuvem:**
  entradas de viagem, data de confirmação, versão/pai, acompanhamento de fundos. O `calculation`
  gravado tem o subtotal errado (grava o total bruto).
- **Banco:** `budgets` (itens em jsonb), `budget_items` (espelho normalizado), `budget_versions`
  (versão imutável a cada alteração, não usada pela tela), `catalog_items`, `authorized_users`,
  `user_roles`, `clients`, `coordinators`, `audit_log`, `budget_number_sequences` (`ORC-AAAA-NNNN`).
- **Permissões:** `budgets` visível **só ao criador** (nem admin vê os dos outros). Admin = 4 fundadores
  fixos. Senha/chave de equipe fixa `ATGC26` no código.
- **Não existem no app antigo:** `budget_templates` (a tabela não está no código; o diagnóstico
  preliminar a encontrou vazia no banco), anexos, link público de aprovação, PDF, escopo, cronograma,
  dados institucionais, encargos, custos indiretos.

## 2. Diagnóstico do Kontrol atual

- **Banco completo para projetos** (migrations 0010–0037): `orcamento_projetos` (já com os campos do
  app antigo: número, coordenador, proprietário, `project_months`, os cinco percentuais,
  `travel_inputs`), `orcamento_projeto_custos` (rubrica, meses, catálogo, origem, etapa, atividade,
  entrega), `orcamento_projeto_analises`, `orcamento_projeto_catalogo` (**os 100 itens do app antigo
  já importados em 0012**), `orcamento_projeto_templates`, `orcamento_projeto_links` (0021/0101),
  `orcamento_projeto_anexos` + bucket (0022), versões de parâmetros (0036), auditoria `aud_*`,
  trigger que exige demanda (0034), status só por RPC (0090/0103).
- **Sem tela de edição desde 24/06/2026** (commit `587bed4`). A decisão de design daquele dia
  (`docs/superpowers/specs/2026-06-24-reorganizacao-navegacao-orcamentos-design.md`) era levar o
  editor para a etapa "Custos do projeto" da proposta; o plano só trocou a página por um
  redirecionamento e **o editor nunca foi levado**.
- **Ações sem tela:** 17 das 21 funções de `src/lib/actions/orcamento-projetos.ts` (criar, salvar,
  parâmetros, adicionar/remover custo e análise, catálogo, viagens, link público, anexos, modelo,
  excluir, cancelar). Em uso: aprovar pelo link público e três ações de modelos.
- **Componentes órfãos (~2.800 linhas):** `FormPessoal` e `FormRubricaGenerica` (nunca usados;
  dependem de ações que não existem), `EmissaoFinalForm`, `ParametrosDemandaGrossUp` (**usa a fórmula
  v1, diferente da Política A — não pode ser reativado como está**), `ExportProjetoButtons`,
  `ProjetoOrcamentosTable`; `src/lib/project-budget/exporters.ts` e `travel.ts`.
- **Cálculo oficial:** Política A (`DEC-ORC-001`, `engine-economica.ts`) = mesma fórmula do app
  antigo atual: `total = (custo laboratório + custo projeto) / (1 − Σ%)`. Telas antigas ainda usam
  `calcularOrcamentoProjetoLegacy` com bases diferentes (`/projetos/[id]` usa preço; `/orcamento/parametros`
  classifica análises como ST).

### Defeitos encontrados (independentes da migração)

| # | Defeito | Efeito |
|---|---|---|
| K1 | Nenhuma tela chama `transicionar_orcamento_projeto` | Módulo de projeto nunca fica "revisado" → **emissão bloqueada** para modalidades com projeto, salvo projetos já enviados antes de 24/06 |
| K2 | `criarProjetoDeTemplate` insere sem `demanda_id` | Botão "Usar" em `/orcamento/modelos` falha (trigger 0034) |
| K3 | `gerarOrcamentoProjetoDaDemanda` não copia percentuais | Projeto nasce com parâmetros 0 (fator 1). **Confirmar com dados reais** |
| K4 | Política do bucket `orcamento-anexos` (0022) continua liberando tudo a qualquer autenticado | Anexos legíveis/apagáveis por qualquer usuário |
| K5 | Salários nominais no catálogo PE (`orcamento_projeto_catalogo`) legíveis por qualquer autenticado | Mesma questão do salário dos técnicos |
| K6 | Central de Ajuda e `docs/status-implementacao-orcamentos.md` descrevem o editor removido | Documentação enganosa |

## 3. Mapa comparativo das funcionalidades

| Funcionalidade no app antigo | Existe no Kontrol? | Equivalente? | Precisa migrar? | Como migrar | Risco de perda de dados |
|---|---|---|---|---|---|
| Cabeçalho (número, projeto, cliente, meses, status) | Sim (banco) | Parcial: sem tela; cliente vem da proposta | Sim (tela) | Cabeçalho vem da proposta; meses e número na etapa de projeto | Baixo |
| Coordenador / responsável / observações | Sim (banco) | Sim | Tela | Campos na etapa | Nenhum (antigo nem tinha tela) |
| Rubricas PE…OU com itens | Sim (banco + ações) | Sim | **Tela** | Editor na etapa "Custos do projeto" | Baixo |
| Grade de meses PE | Sim (`meses_selecionados`) | Sim | Tela | Reaproveitar `FormPessoal` completando as ações | Baixo |
| Entradas de viagem VD com cálculo automático | Sim (`travel_inputs`, `travel.ts`) | Sim | Tela | Painel VD; a ação hoje não cria linhas, só recalcula | Médio (entradas antigas estavam só no localStorage) |
| Catálogo: listar/arquivar | Sim | Sim | — | — | Nenhum (100 itens já importados) |
| Catálogo: criar e editar item | **Não** | Não | **Sim** | Novas ações + tela em `/orcamento/modelos` | Baixo |
| Parâmetros econômicos (5 %) com gross-up | Sim (Política A) | **Sim, mesma fórmula** | Tela única | Usar a etapa "Parâmetros" da proposta como fonte única (decisão D2) | Baixo |
| Status livre (3 valores) | Status por RPC (rascunho/enviado/aprovado/recusado/cancelado) | Mais rígido | Mapear | `em_preparacao→rascunho`, `em_analise_cliente→enviado`, `aprovado→aprovado` | Baixo |
| Salvos: lista e filtros | Lista de propostas | Sim | — | — | — |
| Duplicar | **Não** para projeto | Não | Sim | Duplicar proposta com seus módulos | — |
| "Versão" manual | Versões finais imutáveis da proposta | Sim (melhor) | Não | Justificativa: versão = emissão | — |
| Versão automática a cada alteração (`budget_versions`) | Auditoria `aud_*` | Equivalente | Não | Justificativa: trilha de auditoria cobre | — |
| Exportar XLSX/DOCX do projeto | Sim, órfão | Sim | Religar | `ExportProjetoButtons` na etapa | — |
| Importar planilha de itens | **Não** | Não | **Sim** | Importador para a etapa (reusar regras de cabeçalho e número BR) | — |
| Fundos e taxas (pago/gasto por fundo) | `/orcamento/fundos` | Verificar paridade | Conferir | Comparar campos antes de decidir | **Alto**: dados só no localStorage dos usuários |
| Gestão de usuários / chave `ATGC26` | Usuários e permissões do Kontrol | Superior | Não | Justificativa: substituído | — (não migrar a chave fixa) |
| Numeração `ORC-AAAA-NNNN` | Número da proposta | Sim | Não | Guardar número antigo em campo de origem | Baixo |
| Link público, anexos, modelos | **Só no Kontrol** | — | Religar | Link na etapa final (vinculado à versão emitida) | — |

## 4. Mapa comparativo das tabelas

| App antigo | Kontrol | Situação |
|---|---|---|
| `budgets` | `demandas_propostas` + `orcamento_projetos` | Reaproveitar; cabeçalho comercial fica na proposta |
| `budget_items` / `budgets.items` | `orcamento_projeto_custos` | Reaproveitar |
| `budget_versions` | `orcamento_final_versoes` + auditoria | Não criar |
| `catalog_items` | `orcamento_projeto_catalogo` | **Já migrado (0012)** |
| `clients` | `clientes` | Reaproveitar (casar por nome normalizado) |
| `coordinators` | `orcamento_projetos.coordenador` (texto) | Reaproveitar |
| `authorized_users`, `user_roles` | `perfis`, `permissoes_categorias` | Não migrar |
| `audit_log` | `auditoria` | Não migrar (histórico antigo fica no dump) |
| `budget_number_sequences` | numeração do Kontrol | Não migrar |
| — | `orcamento_projeto_templates`, `_links`, `_anexos` | Só no Kontrol |

**Tabelas a criar: nenhuma.** Campos novos possíveis: `orcamento_projetos.origem_externa_id` e
`numero_origem` para rastrear orçamentos importados (só se D4 = importar).

## 5. Mapa de campos equivalentes

| Antigo | Kontrol |
|---|---|
| `number` | `orcamento_projetos.numero` |
| `project_name` | `demandas_propostas.titulo` / `orcamento_projetos.titulo` |
| `client` / `client_id` | `demandas_propostas.cliente_id` ou `cliente_nome` |
| `coordinator` | `orcamento_projetos.coordenador` |
| `owner_name` | `orcamento_projetos.proprietario` |
| `notes` | `orcamento_projetos.observacoes` |
| `status` | `orcamento_projetos.status` (mapa na seção 3) |
| `rates.taxes / incubation / reserve / investments / profit` | `impostos_legacy / incubacao / reserva / investimentos / lucro` |
| `rates.projectMonths` | `project_months` |
| item `rubric, category, description, unit, quantity, unitPrice, selectedMonths, catalogItemId, source` | `rubrica, categoria, descricao, unidade, quantidade, custo_unitario, meses_selecionados, catalogo_item_id, origem='orcamento_projetos_antigo'` |
| travel inputs (localStorage) | `orcamento_projetos.travel_inputs` |

**Ausentes no Kontrol:** nenhum campo de negócio. **Duplicados:** percentuais existem em
`orcamento_projetos` e na tabela global `parametros` (chaves diferentes) — decisão D2.

## 6. Funcionalidades em risco de perda

1. Edição de custos de projeto (perdida desde 24/06 — já é perda real, P0).
2. Emissão de propostas com projeto (bloqueada por K1).
3. Criar/editar item de catálogo (nunca existiu no Kontrol).
4. Importação de planilha de itens.
5. Duplicar orçamento de projeto.
6. Acompanhamento de fundos pago/gasto (se `/orcamento/fundos` não cobrir).

## 7. Dados em risco de perda

- **R1 — Orçamentos antigos de outros usuários.** O diagnóstico de 13/06 viu 0 `budgets`, mas a RLS
  antiga mostra só os do próprio criador. Pode haver orçamentos de outros usuários. **Precisa de dump
  com a chave de serviço do Supabase antigo** (projeto `oudakfbczisqlctkddce`).
- **R2 — Dados só no navegador:** fundos pago/gasto, entradas de viagem, datas de confirmação,
  até 50 orçamentos salvos localmente (`atgc-saved-budgets-v1`). Só recuperáveis exportando do
  navegador de cada usuário.
- **R3 — `budget_templates`:** existe no banco antigo sem estar no código; confirmar conteúdo no dump.
- **R4 — Subtotal gravado errado** no `calculation` antigo: na importação, recalcular a partir dos
  itens, nunca confiar no campo.

## 8. Proposta de arquitetura final

- O orçamento de projeto continua sendo um **módulo da proposta** (decisão de 24/06 mantida). O
  editor volta como **conteúdo da etapa "Custos do projeto"** em `/orcamento/demandas/[id]?etapa=projeto`,
  sem tela própria.
- Blocos da etapa: meses do projeto → grade PE → rubricas MC/MP/ST/OU → painel VD → análises do
  projeto → importar planilha → exportar XLSX/DOCX → **"Concluir revisão dos custos"** (chama
  `transicionar_orcamento_projeto` → resolve K1).
- **Parâmetros:** fonte única na etapa "Parâmetros" da proposta (Política A), com valores iniciais
  vindos dos padrões globais (resolve K3). Não reativar `ParametrosDemandaGrossUp` (fórmula v1).
- **Link público:** criado na etapa final, sempre vinculado à versão emitida (regra 0101).
- **Anexos:** na etapa de projeto, após corrigir K4.
- **Catálogo e modelos:** `/orcamento/modelos` ganha criar/editar item; "Usar modelo" passa a exigir
  uma proposta de destino (resolve K2).
- **Fundos:** conferir `/orcamento/fundos` contra a aba antiga antes de decidir (D5).

## 9. Rotas

| Rota | Papel |
|---|---|
| `/orcamento/demandas/[id]?etapa=projeto` | Editor de custos de projeto (novo conteúdo) |
| `/orcamento/demandas/[id]?etapa=parametros` | Parâmetros (fonte única) |
| `/orcamento/demandas/[id]?etapa=final` | Emissão + link público |
| `/orcamento/modelos` | Catálogo (CRUD) e modelos |
| `/orcamento/projetos/[id]` | Mantém redirecionamento (compatibilidade de links) |
| `/aprovar/[token]` | Mantida |

## 10. Proposta de migrations (todas aditivas)

- `0110`: política do bucket `orcamento-anexos` por papel (K4), recriando antes de remover a ampla.
- `0111` (se D4 = importar): `orcamento_projetos.origem_externa_id text unique`, `numero_origem text`.
- Nenhum `DROP`, `TRUNCATE`, remoção de coluna ou alteração de migration antiga.

## 11. Plano de migração dos dados

1. Obter dump (schema + dados) do Supabase antigo com a chave de serviço (R1, R3).
2. Pedir a cada usuário antigo a exportação do localStorage (R2) — ou aceitar a perda formalmente.
3. Script de inspeção (somente leitura): contagens, orçamentos por usuário, itens por rubrica.
4. Importação idempotente por `origem_externa_id`: cria proposta + módulo de projeto + custos;
   status mapeado; parâmetros copiados; subtotal recalculado.
5. Relatório antes/depois com o total recalculado de cada orçamento.

## 12. Plano de rollback

- Telas: reverter os commits (sem efeito no banco).
- Migrations aditivas: colunas novas podem ficar sem uso; política do bucket tem script de reversão.
- Importação: tudo marcado por `origem_externa_id`/`origem='orcamento_projetos_antigo'`; remoção
  seletiva só com backup prévio e aprovação.

## 13. Critérios de validação

- Paridade de cálculo: caso 100 → 142,86 e amostra dos orçamentos importados, antigo × Kontrol,
  diferença ≤ R$ 0,01.
- E2E: lançar PE com meses, item de catálogo, VD com cálculo automático, concluir revisão, emitir,
  gerar link, aprovar pelo link.
- Orçamento de análises, estoque, planejamento e compras sem regressão (suíte completa).
- RLS: técnico edita custos; coordenador conclui revisão; anexos inacessíveis sem papel.

## 14. Ordem incremental de implementação

1. **Etapa A (sem banco):** editor na etapa de projeto com as ações existentes + "Concluir revisão"
   (K1) + exportações. Resolve o P0.
2. **Etapa B:** parâmetros com padrão global (K3); corrigir "Usar modelo" (K2); Ajuda (K6).
3. **Etapa C:** criar/editar catálogo; duplicar; importar planilha.
4. **Etapa D:** migration 0110 (anexos) e anexos na etapa.
5. **Etapa E:** importação de dados antigos (depende de D4 e do dump).

## Decisões pendentes

| # | Decisão | Recomendação |
|---|---|---|
| D1 | Aprovar o editor como etapa da proposta (não tela própria) | Sim |
| D2 | Parâmetros: fonte única na proposta com padrões globais | Sim |
| D3 | Salários nominais do catálogo PE: proteger junto com salário dos técnicos | Sim |
| D4 | Importar orçamentos antigos? | Só depois do dump (R1) |
| D5 | Fundos e taxas: conferir paridade com `/orcamento/fundos` | Conferir na Etapa C |
