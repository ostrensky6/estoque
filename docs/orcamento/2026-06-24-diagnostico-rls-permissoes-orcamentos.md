# Diagnóstico de RLS, Permissões e Validações do Módulo Orçamentos

Este documento apresenta a auditoria de segurança das permissões, políticas de Row Level Security (RLS), Server Actions e procedimentos de validação de papéis no módulo de Orçamentos do Kontrol.

---

## 1. Mapeamento das Tabelas do Módulo Orçamentos

O módulo de orçamentos é composto pelas seguintes tabelas no PostgreSQL:

1. **`demandas_propostas`**: Entrada comercial e metadados de escopo da demanda.
2. **`orcamentos`**: Metadados do módulo laboratorial da proposta.
3. **`orcamento_itens`**: Itens de ensaio/análises associados ao módulo laboratorial.
4. **`orcamento_projetos`**: Metadados do módulo de projeto da proposta.
5. **`orcamento_projeto_analises`**: Snapshots de análises executadas no escopo do projeto.
6. **`orcamento_projeto_custos`**: Rubricas de custos diretos do projeto (equipe, insumos, viagens, terceiros).
7. **`orcamento_final_versoes`**: Versões de propostas finais emitidas e consolidadas para o cliente.
8. **`orcamento_parametros_aplicados`**: Snapshot de fórmulas e percentuais econômicos aplicados em cada versão final.
9. **`demanda_analises`**: Snapshots de análises vinculados à demanda comercial.
10. **`demanda_grupos_amostras`**: Grupos de amostras para orientar a precificação e ensaios.
11. **`eventos_status`**: Linha do tempo e histórico de auditoria de transições de status.
12. **`orcamento_projeto_anexos`**: Arquivos anexados aos orçamentos de projetos.
13. **`orcamento_projeto_links`**: Links públicos temporários para visualização externa pelo cliente.

---

## 2. Policies RLS Existentes

Abaixo estão listadas as políticas de RLS ativas para as tabelas do módulo de orçamentos (mapeadas a partir das migrations `0005`, `0014`, `0017`, `0021`, `0022`, `0033`, `0040`, `0041` e `0042`):

| Tabela | RLS Ativo? | Nome da Política / Acesso | Operação | Alvo / Condição |
| :--- | :--- | :--- | :--- | :--- |
| **`demandas_propostas`** | Sim | `rls_read_demandas_propostas`<br>`rls_tecnico_insert_demandas_propostas`<br>`rls_tecnico_update_demandas_propostas`<br>`rls_tecnico_delete_demandas_propostas` | SELECT<br>INSERT<br>UPDATE<br>DELETE | `authenticated` (true)<br>`authenticated` (`papel_minimo('tecnico')`) |
| **`orcamentos`** | Sim | `rls_read_orcamentos`<br>`rls_tecnico_insert_orcamentos`<br>`rls_tecnico_update_orcamentos`<br>`rls_tecnico_delete_orcamentos` | SELECT<br>INSERT<br>UPDATE<br>DELETE | `authenticated` (true)<br>`authenticated` (`papel_minimo('tecnico')`) |
| **`orcamento_itens`** | Sim | `rls_read_orcamento_itens`<br>`rls_tecnico_insert_orcamento_itens`<br>`rls_tecnico_update_orcamento_itens`<br>`rls_tecnico_delete_orcamento_itens` | SELECT<br>INSERT<br>UPDATE<br>DELETE | `authenticated` (true)<br>`authenticated` (`papel_minimo('tecnico')`) |
| ****`orcamento_projetos`** | Sim | `rls_read_orcamento_projetos`<br>`rls_tecnico_insert_orcamento_projetos`<br>`rls_tecnico_update_orcamento_projetos`<br>`rls_tecnico_delete_orcamento_projetos` | SELECT<br>INSERT<br>UPDATE<br>DELETE | `authenticated` (true)<br>`authenticated` (`papel_minimo('tecnico')`) |
| **`orcamento_projeto_analises`** | Sim | `rls_read_orcamento_projeto_analises`<br>`rls_tecnico_insert_orcamento_projeto_analises`<br>`rls_tecnico_update_orcamento_projeto_analises`<br>`rls_tecnico_delete_orcamento_projeto_analises` | SELECT<br>INSERT<br>UPDATE<br>DELETE | `authenticated` (true)<br>`authenticated` (`papel_minimo('tecnico')`) |
| **`orcamento_projeto_custos`** | Sim | `rls_read_orcamento_projeto_custos`<br>`rls_tecnico_insert_orcamento_projeto_custos`<br>`rls_tecnico_update_orcamento_projeto_custos`<br>`rls_tecnico_delete_orcamento_projeto_custos` | SELECT<br>INSERT<br>UPDATE<br>DELETE | `authenticated` (true)<br>`authenticated` (`papel_minimo('tecnico')`) |
| **`orcamento_final_versoes`** | Sim | `authenticated_all_orcamento_final_versoes` | ALL | `authenticated` (`using (true) with check (true)`) |
| **`orcamento_parametros_aplicados`** | Sim | `authenticated_all_orcamento_parametros_aplicados` | ALL | `authenticated` (`using (true) with check (true)`) |
| **`demanda_analises`** | Sim | `authenticated_all_demanda_analises` | ALL | `authenticated` (`using (true) with check (true)`) |
| **`demanda_grupos_amostras`** | Sim | `authenticated_all_demanda_grupos_amostras` | ALL | `authenticated` (`using (true) with check (true)`) |
| **`eventos_status`** | Sim | `authenticated_all_eventos_status` | ALL | `authenticated` (`using (true) with check (true)`) |
| **`orcamento_projeto_anexos`** | Sim | `authenticated_all_orcamento_projeto_anexos` | ALL | `authenticated` (`using (true) with check (true)`) |
| **`orcamento_projeto_links`** | Sim | `authenticated_all_orcamento_projeto_links` | ALL | `authenticated` (`using (true) with check (true)`) |

---

## 3. Policies Excessivamente Genéricas

As seguintes policies herdam a lógica antiga do padrão `authenticated_all`, permitindo que **qualquer usuário autenticado** execute qualquer operação (`INSERT`, `UPDATE`, `DELETE`) sem verificação de papel ou autorização no nível de banco de dados:

1. **`authenticated_all_orcamento_final_versoes`**
2. **`authenticated_all_orcamento_parametros_aplicados`**
3. **`authenticated_all_demanda_analises`**
4. **`authenticated_all_demanda_grupos_amostras`**
5. **`authenticated_all_eventos_status`**
6. **`authenticated_all_orcamento_projeto_anexos`**
7. **`authenticated_all_orcamento_projeto_links`**

### Riscos Identificados
* **Bypass de Lógica de Negócio**: Um usuário mal-intencionado ou com papel restrito (`tecnico`) pode usar um cliente Supabase ou executar chamadas GraphQL/REST para cadastrar propostas finais falsas, corromper snapshots, reescrever parâmetros econômicos aplicados, ou apagar anexos e links de propostas sem passar pelas Server Actions ou RPCs autoritativas.
* **Corrupção de Auditoria**: Qualquer usuário autenticado pode injetar registros falsos na tabela `eventos_status`, forjando o histórico de quem aprovou ou alterou um orçamento.

---

## 4. Mapeamento das Server Actions do Módulo

| Server Action | Arquivo de Origem | Objetivo |
| :--- | :--- | :--- |
| `criarDemanda` | `src/lib/actions/demandas.ts` | Registra nova solicitação/demanda. |
| `salvarDemanda` | `src/lib/actions/demandas.ts` | Atualiza metadados da demanda. |
| `gerarOrcamentoAnalisesDaDemanda` | `src/lib/actions/demandas.ts` | Inicializa submódulo laboratorial. |
| `gerarOrcamentoProjetoDaDemanda` | `src/lib/actions/demandas.ts` | Inicializa submódulo de projetos. |
| `garantirModulosDaProposta` | `src/lib/actions/demandas.ts` | Ajusta idempotentemente os submódulos da demanda. |
| `emitirOrcamentoFinalDaDemanda` | `src/lib/actions/demandas.ts` | Consolida e emite a proposta comercial oficial. |
| `criarOrcamento` | `src/lib/actions/orcamentos.ts` | Cria rascunho de orçamento laboratorial. |
| `salvarCabecalho` | `src/lib/actions/orcamentos.ts` | Salva dados e status do orçamento laboratorial. |
| `adicionarItemOrcamento` | `src/lib/actions/orcamentos.ts` | Adiciona análise com preço/custo técnico. |
| `removerItemOrcamento` | `src/lib/actions/orcamentos.ts` | Deleta análise do laboratório. |
| `recalcularOrcamento` | `src/lib/actions/orcamentos.ts` | Reatualiza snapshots de custos das análises. |
| `excluirOrcamento` | `src/lib/actions/orcamentos.ts` | Exclui fisicamente o orçamento (apenas se rascunho). |
| `cancelarOrcamento` | `src/lib/actions/orcamentos.ts` | Cancela orçamento em status enviado/aprovado. |
| `salvarParametrosEconomicos` | `src/lib/actions/orcamentos.ts` | Atualiza markup e premissas globais do laboratório. |
| `criarOrcamentoProjeto` | `src/lib/actions/orcamento-projetos.ts` | Cria rascunho de orçamento de projeto. |
| `salvarOrcamentoProjeto` | `src/lib/actions/orcamento-projetos.ts` | Atualiza dados e status do orçamento de projeto. |
| `salvarParametrosEconomicosProjeto` | `src/lib/actions/orcamento-projetos.ts` | Edita gross-up, lucro e taxas do projeto. |
| `adicionarAnaliseProjeto` | `src/lib/actions/orcamento-projetos.ts` | Adiciona análises ao escopo do projeto. |
| `adicionarCustoProjeto` | `src/lib/actions/orcamento-projetos.ts` | Insere rubrica de custo customizada. |
| `adicionarCustoCatalogoProjeto` | `src/lib/actions/orcamento-projetos.ts` | Insere custo a partir de catálogo de itens padrão. |
| `salvarViagensProjeto` | `src/lib/actions/orcamento-projetos.ts` | Grava despesas de viagem de campo. |
| `removerAnaliseProjeto` | `src/lib/actions/orcamento-projetos.ts` | Remove análise do projeto. |
| `removerCustoProjeto` | `src/lib/actions/orcamento-projetos.ts` | Remove rubrica de custo do projeto. |
| `criarLinkPublico` | `src/lib/actions/orcamento-projetos.ts` | Gera token e link de compartilhamento externo. |
| `revogarLinkPublico` | `src/lib/actions/orcamento-projetos.ts` | Revoga acesso público de visualização do projeto. |
| `aprovarOrcamentoPublico` | `src/lib/actions/orcamento-projetos.ts` | Fluxo de aceitação final feito pelo cliente (externo). |
| `salvarComoTemplate` | `src/lib/actions/orcamento-projetos.ts` | Grava premissas e custos como template reutilizável. |
| `criarProjetoDeTemplate` | `src/lib/actions/orcamento-projetos.ts` | Cria novo orçamento aplicando template. |
| `excluirTemplate` | `src/lib/actions/orcamento-projetos.ts` | Marca template de projeto como arquivado. |
| `duplicarTemplateProjeto` | `src/lib/actions/orcamento-projetos.ts` | Clona template existente. |
| `arquivarCatalogoProjetoItem` | `src/lib/actions/orcamento-projetos.ts` | Desativa item do catálogo de projetos. |
| `adicionarAnexoProjeto` | `src/lib/actions/orcamento-projetos.ts` | Salva metadados e faz upload de anexo de projeto. |
| `removerAnexoProjeto` | `src/lib/actions/orcamento-projetos.ts` | Remove anexo do banco e storage. |
| `excluirOrcamentoProjeto` | `src/lib/actions/orcamento-projetos.ts` | Deleta rascunho de orçamento de projeto. |
| `cancelarOrcamentoProjeto` | `src/lib/actions/orcamento-projetos.ts` | Cancela orçamento de projeto enviado/aprovado. |
| `cancelarVersaoFinal` | `src/lib/actions/orcamento-historico.ts` | Cancela proposta comercial final já emitida. |
| `duplicarVersaoFinal` | `src/lib/actions/orcamento-historico.ts` | Clona proposta comercial antiga incrementando a versão. |

---

## 5. Actions com Verificação Ativa (`exigirPapelOrcamento`)

* `emitirOrcamentoFinalDaDemanda` (Ação: `"emitir_final"` -> papel mínimo: `coordenador`)
* `salvarCabecalho` (Apenas quando move status para enviado/aprovado/cancelado) (Ação: `"revisar_modulo"` -> papel mínimo: `coordenador`)
* `recalcularOrcamento` (Apenas quando recalcula módulo enviado/aprovado/cancelado) (Ação: `"recalcular_custos"` -> papel mínimo: `coordenador`)
* `cancelarOrcamento` (Ação: `"cancelar_documento"` -> papel mínimo: `coordenador`)
* `salvarParametrosEconomicos` (Ação: `"editar_parametros"` -> papel mínimo: `gestor`)
* `salvarOrcamentoProjeto` (Apenas quando muda status do projeto) (Ação: `"revisar_modulo"` -> papel mínimo: `coordenador`)
* `salvarParametrosEconomicosProjeto` (Ação: `"editar_parametros"` -> papel mínimo: `gestor`)
* `excluirTemplate` (Ação: `"gerir_modelos"` -> papel mínimo: `gestor`)
* `duplicarTemplateProjeto` (Ação: `"gerir_modelos"` -> papel mínimo: `gestor`)
* `arquivarCatalogoProjetoItem` (Ação: `"gerir_modelos"` -> papel mínimo: `gestor`)
* `cancelarOrcamentoProjeto` (Ação: `"cancelar_documento"` -> papel mínimo: `coordenador`)
* `cancelarVersaoFinal` (Ação: `"cancelar_documento"` -> papel mínimo: `coordenador`)
* `duplicarVersaoFinal` (Ação: `"duplicar_final"` -> papel mínimo: `coordenador`)

---

## 6. Actions sem Verificação Ativa (Lacunas Identificadas)

As seguintes actions realizam escritas ou alterações de estrutura de custos diretamente e não exigem papel, dependendo puramente da UI ou de validações simples do Supabase:

* **Demandas/Estruturação**:
  - `criarDemanda`, `salvarDemanda` (exigência recomendada: `"criar_demanda"` / papel mínimo: `tecnico`)
  - `gerarOrcamentoAnalisesDaDemanda`, `gerarOrcamentoProjetoDaDemanda`, `garantirModulosDaProposta` (exigência recomendada: `"preencher_custos"` / papel mínimo: `tecnico`)
* **Módulo Laboratorial**:
  - `criarOrcamento` (exigência recomendada: `"preencher_custos"` / papel mínimo: `tecnico`)
  - `adicionarItemOrcamento`, `removerItemOrcamento` (exigência recomendada: `"preencher_custos"` / papel mínimo: `tecnico`)
  - `excluirOrcamento` (exigência recomendada: `"cancelar_documento"` / papel mínimo: `coordenador`)
* **Módulo de Projeto**:
  - `criarOrcamentoProjeto` (exigência recomendada: `"preencher_custos"` / papel mínimo: `tecnico`)
  - `adicionarAnaliseProjeto`, `adicionarCustoProjeto`, `adicionarCustoCatalogoProjeto`, `salvarViagensProjeto`, `removerAnaliseProjeto`, `removerCustoProjeto` (exigência recomendada: `"preencher_custos"` / papel mínimo: `tecnico`)
  - `criarLinkPublico`, `revogarLinkPublico` (exigência recomendada: `"preencher_custos"` / papel mínimo: `tecnico`)
  - `salvarComoTemplate` (exigência recomendada: `"gerir_modelos"` / papel mínimo: `gestor`)
  - `criarProjetoDeTemplate` (exigência recomendada: `"preencher_custos"` / papel mínimo: `tecnico`)
  - `adicionarAnexoProjeto`, `removerAnexoProjeto` (exigência recomendada: `"preencher_custos"` / papel mínimo: `tecnico`)
  - `excluirOrcamentoProjeto` (exigência recomendada: `"cancelar_documento"` / papel mínimo: `coordenador`)

---

## 7. Mapeamento de Papéis por Operação

O sistema segue a seguinte governança de papéis estabelecida em `governanca.ts`:

* **`tecnico`**: Papel operacional básico. Pode criar demandas, salvar informações preliminares, estruturar tabelas de custo, adicionar e remover itens e gerenciar despesas operacionais (análises e custos específicos).
* **`coordenador`**: Nível de supervisão. Pode além das tarefas de técnico, emitir a proposta final consolidada, duplicar propostas históricas, realizar recálculos em lotes de orçamentos enviados e aplicar revisões de status (rascunho para enviado/aprovado/cancelado).
* **`gestor`**: Controle estratégico e financeiro. Pode gerenciar templates, catálogo de preços, arquivar templates institucionais e, crucialmente, alterar parâmetros econômicos globais (impostos, markup, margem de lucro padrão).
* **`admin`**: Acesso irrestrito a governança e administração de usuários/perfis.

---

## 8. Operações Exclusivas de Leitura (Sem Escrita)

As consultas de telas de listagem, painéis e históricos são puramente de leitura.
Elas **não possuem Server Actions associadas**, sendo resolvidas diretamente no servidor via componentes do Next.js (Server Components) fazendo `SELECT` no Supabase Client. O RLS do banco de dados (que possui políticas `rls_read_*` abertas para qualquer `authenticated`) cuida para que nenhum usuário não autenticado enxergue dados comerciais.

---

## 9. Bloqueio por Ciclo de Vida do Documento

Documentos com status **`enviado`**, **`aprovado`**, **`cancelado`** ou **`emitido`** estão congelados para edições normais. Apenas recálculos autorizados ou cancelamento formal são permitidos.

* O utilitário `moduloBloqueadoParaEdicao` e os métodos `assegurarLaboratorioEditavel` e `assegurarProjetoEditavel` impedem alterações através de Zod/TypeScript.
* Se um payload malicioso tentar injetar novos itens diretamente numa Server Action ignorando o bloqueio de UI, esses validadores no lado do servidor capturam o estado atual no Supabase e lançam uma exceção de segurança, bloqueando a escrita.

---

## 10. Dependências da RPC `emitir_orcamento_final_transacional`

* Apenas a Server Action `emitirOrcamentoFinalDaDemanda` invoca a RPC.
* A lógica calcula a validação de consistência e preços em TypeScript e envia o snapshot validado ao PostgreSQL.
* A RPC realiza as operações atômicas sob transação garantindo isolamento concorrente via `FOR UPDATE` na tabela de demandas.

---

## 11. Permissões de Governança Cadastradas

A matriz cadastrada no arquivo `governanca.ts` define 10 operações:
1. `criar_demanda` (técnico)
2. `preencher_custos` (técnico)
3. `recalcular_custos` (coordenador, com motivo)
4. `revisar_modulo` (coordenador)
5. `editar_parametros` (gestor)
6. `emitir_final` (coordenador)
7. `duplicar_final` (coordenador)
8. `cancelar_documento` (coordenador, com motivo)
9. `gerir_modelos` (gestor)
10. `ver_governanca` (gestor)

---

## 12. Lacunas entre UI, Server Actions, RPC e RLS

1. **Lacuna 1 (RLS Fraco)**: Tabelas criadas nas fases pós-núcleo (como `orcamento_final_versoes` e `orcamento_parametros_aplicados`) não herdam o bloqueio por papel da migration `0014`. Qualquer usuário `authenticated` pode, por exemplo, criar ou atualizar registros nela via API rest.
2. **Lacuna 2 (Ações Expostas)**: Ações como `adicionarItemOrcamento` ou `adicionarCustoProjeto` validam apenas se o documento está travado ou não (`assegurarProjetoEditavel`), mas não verificavam se o usuário logado possui sequer o papel de `tecnico`.

---

## 13. Riscos de Segurança no Workflow de Preflight

* **Instabilidade de Segredos**: O workflow `.github/workflows/orcamento-preflight-readonly.yml` usa segredos do GitHub para armazenar as URLs do banco. Há risco de vazamento caso a string de conexão seja impressa no console em caso de erro nos scripts.
* **Privacidade dos Artifacts**: O preflight gera outputs de diagnóstico (duplicidades de dados reais) e os armazena como artifacts de build. Se o repositório for tornado público ou se membros com acesso read-only baixarem os artifacts, dados financeiros reais e nomes de clientes podem ser expostos.
* **Mitigação**: O script do preflight não imprime a variável `DATABASE_URL` e o console do GitHub Actions mascara automaticamente dados confidenciais. A PR-comment não expõe detalhes de clientes (apenas contagens agregadas).

---

## 14. Estratégia de Proteção Híbrida (Decisão Arquitetural)

Para endurecer o sistema de forma resiliente, adotaremos a abordagem **Defesa em Profundidade**:

1. **Camada 1 (Server Actions)**: Validar o papel do usuário no Next.js Server Side utilizando `exigirPapelOrcamento` e as travas de edição de módulo (`assegurarLaboratorioEditavel`). Isso garante validação imediata antes da execução de queries e previne ações impróprias direto nas requisições do Next.js.
2. **Camada 2 (Database RLS)**: Substituir as policies permissivas `authenticated_all` por regras baseadas em `papel_minimo(...)`. Caso um ataque explore uma Server Action desprotegida ou utilize o cliente Supabase do frontend com privilégios alterados, o banco de dados abortará a transação.
3. **Camada 3 (RPC Transacional)**: A RPC `emitir_orcamento_final_transacional` executa com privilégio elevado (`security definer`), mas seu acesso está restrito à role `authenticated` e sua execução é precedida por validações rígidas de consistência. A chamada deve ser protegida por governança na Server Action.
