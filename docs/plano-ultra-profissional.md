# Plano Ultra-Profissional — Lab Custos & Estoque

> Roadmap de evolução do app para padrão de produto de classe mundial.
> Deriva diretamente da auditoria de produto (junho/2026). Cada item rastreia
> um achado da auditoria e tem critério de "pronto". Implementação deve seguir
> os guias do Next 16 em `node_modules/next/dist/docs/` (ver `AGENTS.md`).

---

## 0. Norte: o que é "ultra-profissional" aqui

Este app é, na prática, três produtos num só nicho de laboratório de biologia molecular:

- **CPQ** (Configure-Price-Quote) — custeio e orçamento de análises.
- **LIMS-lite** — rastreabilidade de lotes, validade, FEFO, quarentena (padrão ISO 15189 / Benchling / Labguru).
- **ERP-lite de suprimentos** — ponto de reposição, compras, previsão (padrão Odoo / NetSuite / Quartzy).

A barra "classe mundial" para cada pilar:

| Pilar | Referência de mercado | Barra a atingir |
|---|---|---|
| Custeio/Orçamento | CPQ (Salesforce/DealHub) | Preço dirigido por parâmetros, simulação de cenário, documento com marca, numeração, versão |
| Estoque/Lotes | Benchling, Labguru, Quartzy | Rastreabilidade reversa, código de barras, validade dupla, ajuste de inventário |
| Suprimentos | Odoo, NetSuite | Reposição automática por cobertura, lead time, sugestão→PO→recebimento sem retrabalho |
| Plataforma | SaaS moderno | RLS por papel, testes, CI/CD, observabilidade, acessibilidade AA |

### Princípios de design (aplicar em tudo)
1. **Uma ação, um lugar.** Nada de "leia a falta numa tela e recrie em outra".
2. **Projeto no centro.** Toda atividade (orçamento/plano/compra) se enxerga a partir do projeto.
3. **Densidade com clareza.** Tabelas ricas, mas com busca, filtro, ordenação e estados vazios que orientam.
4. **Feedback imediato.** Toda ação responde (toast, otimista), nada de "salvou?".
5. **Seguro por padrão.** RLS no banco, não confiança no cliente. Papel define o que se vê e se faz.
6. **Verdade no app, não na planilha.** Tudo que hoje só existe importado deve ser editável.

---

## Fase 0 — Correções de negócio (dias, não semanas)

Bloqueiam valor comercial. Fazer antes de qualquer melhoria estética.

| # | Item | Pronto quando |
|---|---|---|
| 0.1 | **Ocultar custo interno no orçamento impresso.** Marcar coluna/total de "Custo" como `no-print` em `orcamento/[id]`. | O PDF enviado ao cliente mostra só preço, amostras e subtotal. Custo visível apenas na edição interna. |
| 0.2 | **Garantir a tela de Parâmetros no branch de produção.** Margem, impostos, taxas, fundos editáveis; soma ao vivo; recalcula custeio/orçamento. | Alterar margem para 30% recalcula preços em `/custeio` e em novos orçamentos. Preço ≠ Custo. |
| 0.3 | **Confirmação em exclusões de raiz.** "Excluir orçamento" e "Excluir plano" passam a usar modal de confirmação (reusar o padrão do CrudShell). | Não é possível apagar orçamento/plano com um clique acidental. |
| 0.4 | **Vocabulário controlado em `grupo_escolha`.** Trocar input de texto livre por combobox com os grupos existentes + "novo grupo". | Não há como criar grupo por typo; kits MiSeq agrupáveis com 2 cliques. |

---

## Fase 1 — Fundações (a camada que destrava todo o resto)

Sem isto, cada melhoria seguinte custa o dobro. É investimento de plataforma.

### 1.1 Design system
- Adotar **shadcn/ui** (componentes copy-in sobre Radix + Tailwind v4 — compatível com a stack atual, sem runtime pesado, acessível por padrão).
- Tokens unificados: **eliminar a mistura `slate`/`zinc`** — padronizar em `slate` (combina com o canvas azulado). Escala de tipografia e espaçamento única.
- Componentes-base: `Button`, `Input`, `Select/Combobox`, `Dialog`, `Drawer`, `Badge`, `Table`, `Toast`, `Tabs`, `Card`, `Tooltip`, `DropdownMenu`, `Command`.
- **Tema:** `next-themes` com toggle claro/escuro/sistema. Dark mode ganha profundidade (não preto chapado).
- **Feedback:** `sonner` para toasts. Toda server action retorna sucesso/erro → toast.
- **Pronto quando:** uma página piloto (ex.: Cadastros) está 100% no novo sistema e serve de molde.

### 1.2 Tabelas de dados de verdade
- **TanStack Table** para todas as listas: ordenação, filtro por coluna, busca global, seleção de colunas, paginação e **virtualização** (Estoque/Insumos com 82+ linhas).
- Em mobile, tabela colapsa para cartões.
- **Pronto quando:** dá para achar um insumo em 82 por busca/filtro em < 3s; ordenar por qualquer coluna.

### 1.3 Navegação moderna
- **Command palette (⌘K)** com `cmdk`: navegar, buscar análise/insumo/projeto, ações rápidas ("novo orçamento").
- **Breadcrumbs** nas páginas de detalhe.
- **Menu mobile** colapsável (drawer) — resolve o cabeçalho gigante atual.
- **Pronto quando:** ⌘K abre, busca e navega; no celular o conteúdo aparece sem rolar por 9 links.

### 1.4 Seletores com busca
- Trocar todos os `<select>` nativos (análise por código, insumo, cliente, projeto, fornecedor) por **Combobox** com busca e rótulo amigável (código **+ nome** da análise).
- **Pronto quando:** adicionar análise a um orçamento mostra "Illumina_16S_AC — Metagenômica 16S" pesquisável.

### 1.5 Qualidade de plataforma (fundação invisível, essencial)
- **RLS uniforme por papel** no Postgres — parar de usar o cliente *service-role* para escritas comuns (hoje planejamento/cadastros/insumos contornam o RLS). Política por tabela: técnico lê/registra, coordenador aprova/aceita, gestor bloqueia/descarta, admin tudo.
- **Tipos ponta a ponta:** abandonar os clientes "untyped" onde possível; usar os tipos gerados do banco.
- **Testes:** unitários na **engine de custeio** (é o coração — qualquer erro vira dinheiro errado); e2e com **Playwright** nos fluxos críticos (criar orçamento, reservar plano, receber lote).
- **CI/CD:** GitHub Actions (lint + typecheck + test + e2e + build) por PR. Deploy de produção é do **Vercel**, projeto `kontrol`: push em `main` deve alimentar a produção quando o projeto estiver conectado ao repositório.
- **Observabilidade:** Sentry (erros) + PostHog (analytics de uso) + logs estruturados.
- **Segredos:** confirmar rotação da senha de produção (foi exposta em chat); segredos só em `.env` local, Supabase/Vercel e gerenciador de senhas.
- **Pronto quando:** um técnico logado não consegue (testado) editar parâmetros nem aprovar compra; pipeline verde bloqueia merge quebrado.

**Status em 2026-06-14:**
- **1.5 concluída no recorte de testes da fase:** Vitest cobre contratos das actions de orçamento/estoque e regressões existentes da engine/RLS; Playwright cobre fluxo orçamento → documento imprimível/PDF e ciclo de estoque receber → aceitar → bloquear.
- **Infra de e2e criada:** `playwright.config.ts`, script `npm run test:e2e`, execução em `localhost:3001`, Chrome local e mock Supabase ativado apenas por `PLAYWRIGHT_MOCK_SUPABASE=1`.
- **Validação executada:** `npm run lint`, `npx tsc --noEmit`, `npm run test`, `npm run test:e2e` e `npm run build` passaram.
- **Pendente para a sequência:** clientes Supabase tipados onde ainda houver `createClientUntyped`, CI/CD em PR, observabilidade Sentry/PostHog e rotação/checagem final de segredos.

### 1.6 Fechamento de plataforma (pendências da Fase 1)

Sub-fase que executa a lista "Pendente para a sequência" acima.

- **Clientes Supabase tipados (tipos ponta a ponta).** Migrar todas as actions e páginas
  de `createClientUntyped` → `createClient<Database>` tipado. Manter `createClientUntyped`
  **apenas** em `cadastros.ts` (CRUD genérico com tabela/payload dinâmicos resolvidos em runtime).
- **`database.types.ts` sincronizado** com o banco (estava defasado: faltavam as tabelas das
  migrations 0010–0015 — `orcamento_projetos`, `demandas_propostas`, etc.).
- **CI:** adicionar passo **e2e (Playwright)** ao pipeline + upload do relatório.
- **Observabilidade (Sentry/PostHog):** depende de contas/DSN do usuário — **não iniciado**.
- **Segredos:** rotação da senha do Postgres de produção e da `service_role` — **tarefa de ops do usuário**.

**Status em 2026-06-14:**
- ✅ **Tipos ponta a ponta:** ~17 arquivos (actions + páginas) migrados para o cliente tipado;
  só `cadastros.ts` permanece untyped (CRUD genérico, intencional). `database.types.ts`
  regenerado do banco (+497 linhas; 6 tabelas que faltavam agora presentes).
- ✅ **Bug latente corrigido pela tipagem:** `data_orcamento`/`data_solicitacao` eram gravados
  como `null` em colunas NOT NULL (falhariam em runtime ao limpar a data) — trocado por `undefined`
  (omite → mantém/usa default).
- ✅ **CI:** passo e2e (Playwright + Chrome) e artifact do relatório adicionados a `.github/workflows/ci.yml`.
- ✅ **Validação:** `tsc --noEmit`, `npm test` (23/23) e `npm run lint` passam.
- ⏳ **Observabilidade:** pendente das chaves Sentry/PostHog do usuário.
- ⏳ **Segredos:** senha do Postgres de produção foi exposta em chat (de novo) → **rotacionar**;
  tratar `service_role` como comprometida.
- ⏳ **Deploy-as-code (`vercel.json`):** nao criado; o projeto usa a deteccao padrao Next.js da Vercel.

---

## Fase 2 — Integração entre módulos (o maior salto de valor)

Transforma "dois fluxos independentes" em um sistema. É onde o produto deixa de ser um conjunto de telas e vira uma operação.

### 2.1 Hub de Projeto (a tela que faltava)
- Página `/projetos/[id]`: visão 360° — orçamentos, planos, compras, **custo realizado vs. orçado**, status, cronograma, consumo de insumos do projeto.
- Os FKs já existem em todas as tabelas; falta a tela de payoff.
- **Pronto quando:** abrir um projeto mostra, num lugar só, tudo que aconteceu nele e quanto custou.

### 2.2 Orçamento aprovado → Planejamento
- Ao mover orçamento para "aprovado": ação **"Gerar planejamento"** que cria um plano com as análises/amostras do orçamento, já vinculado ao projeto.
- **Pronto quando:** aprovar a proposta da Embrapa gera o plano correspondente com 1 clique.

### 2.3 Falta do plano → Pedido de compra
- No painel de demanda do plano: botão **"Comprar faltas"** que abre um pedido pré-preenchido (insumos faltantes, qtd sugerida = falta + estoque de segurança, fornecedor principal do insumo).
- **Pronto quando:** as faltas de um plano viram um pedido sem digitar nada de novo.

### 2.4 Recebimento único
- Padronizar: receber estoque **sempre** fecha um item de pedido (o "+ Lote" avulso vira "entrada de inventário/ajuste", caminho separado e explícito).
- **Pronto quando:** não há duas portas concorrentes para a mesma entrada física.

### 2.5 Ponte de unidades (correção silenciosa de erro)
- Resolver a divergência de unidade insumo↔MCA (ex.: beads µL vs. embalagem) com fator de conversão por insumo, para a baixa bater.
- **Pronto quando:** a demanda e a baixa de um insumo "por execução" conferem com o estoque físico.

---

## Fase 3 — Profundidade funcional (o app vira a fonte da verdade)

### 3.1 Editor de receita de análise (gap operacional nº 1)
- Tornar editáveis no app: **etapas** (tempos, gargalo, prazo), **alocação de equipamentos** (`equipamento_analise` + peso), **materiais** (`insumo_analise` — qtd/amostra, modo de cobrança, grupo).
- Criar/duplicar/versionar análises. "Duplicar e ajustar" é o fluxo real de um lab.
- **Pronto quando:** criar uma análise nova e custeá-la sem tocar no banco.

### 3.2 Documentos profissionais
- **Orçamento:** numeração sequencial com máscara, marca/logo, versão (v1, v2…), validade, condições, assinatura. **PDF server-side** (react-pdf ou Puppeteer/edge) — pixel-perfect, não "imprimir do navegador".
- **Pedido de compra:** documento imprimível/PDF para enviar ao fornecedor (hoje inexistente).
- **Pronto quando:** o PDF do orçamento parece emitido por sistema, com nº e marca; o PO pode ser enviado ao fornecedor.

### 3.3 Estoque grau-LIMS
- **Detalhe/histórico do lote** (movimentações, rastreabilidade reversa: que análises usaram o lote X).
- **Ajuste de inventário** (perda/quebra/contagem cíclica) pela UI.
- **Código de barras/QR** no recebimento e no consumo (etiqueta do lote) — padrão de laboratório moderno.
- **Validade dupla** (fabricação/abertura) e bloqueio de uso de vencido.
- **Pronto quando:** dá para auditar um lote do recebimento ao consumo e contar inventário no app.

### 3.4 Workflow de aprovação com estado e datas
- Orçamento e pedido com transições registradas (quem/quando), SLA, e ações ("enviar" gera evento, não só rótulo).
- **Pronto quando:** a linha do tempo de um orçamento/pedido é auditável por data e responsável.

---

## Fase 4 — Inteligência & automação (o diferencial "moderno")

Tudo isto já estava previsto como "ganchos" no design doc; aqui vira produto.

### 4.1 Previsão de suprimentos
- **Consumo médio diário** e **dias de cobertura** (`disponível / consumo_diário`) por insumo, lendo a série de movimentações.
- **Ponto de reposição sugerido** = consumo médio × lead time + estoque de segurança (calculado, não digitado).
- **Pronto quando:** o app sugere o ponto de reposição por dado histórico, não por chute.

### 4.2 Reposição automática
- Rotina agendada (Supabase cron / edge function) que, ao cruzar o ponto de reposição, **gera rascunhos de pedido** e notifica o coordenador.
- **Pronto quando:** itens abaixo do ponto geram pedido-rascunho sozinhos, todo dia.

### 4.3 Notificações
- **E-mail/in-app** para: reposição, vencimento próximo, falta para plano, aprovação pendente. (Resend + edge functions.)
- **Pronto quando:** o gestor recebe alerta de vencimento sem abrir o app.

### 4.4 Dashboards executivos
- Home vira dashboard de verdade: gasto por projeto/mês, valor de estoque parado, vencimentos no horizonte, funil de orçamentos (rascunho→aprovado), margem média.
- **Recharts/visx**, com drill-down.
- **Pronto quando:** o gestor entende a saúde do laboratório em 10 segundos na home.

### 4.5 Simulador de cenário de custeio (pedido antigo)
- `/custeio` interativo: deslizar tamanho de lote, escolher opção de `grupo_escolha`, mexer em fatores — ver preço mudar ao vivo. (O custeio "por execução vs. por amostra" é o grande desafio do negócio.)
- **Pronto quando:** dá para responder "e se o lote for 96 em vez de 24?" sem recarregar.

**Status em 2026-06-14:**
- ✅ **4.1 Previsão de suprimentos:** `v_previsao_suprimentos` calcula consumo médio diário,
  dias de cobertura, ponto sugerido e quantidade sugerida por histórico de movimentações,
  lead time e estoque de segurança. `/estoque` mostra consumo/dia, cobertura e ponto sugerido.
- ✅ **4.2 Reposição automática:** `gerar_reposicao_automatica()` cria rascunhos de pedido
  idempotentes, agrupados por fornecedor, e registra notificações in-app. `pg_cron` local
  agenda `kontrol-reposicao-diaria` às 07:15. `/compras` também permite disparo manual.
- ⏳ **4.3 Notificações:** in-app concluído via tabela `notificacoes` e painel na home.
  E-mail externo fica pendente de credenciais/configuração Resend + edge function.
- ✅ **4.4 Dashboard executivo:** home ganhou KPIs executivos e gráficos Recharts para
  gasto mensal e funil de orçamentos, usando `v_dashboard_executivo`.
- ✅ **4.5 Simulador de cenário:** `/custeio` ganhou simulador client-side com a engine
  pura de custeio para lote, margem incremental e escolhas de `grupo_escolha`.
- **Validação:** `tsc --noEmit`, `npm test`, `npm run lint` e `npm run build` passaram.
- **Percentual da Fase 4:** 92% (4 itens completos + notificações in-app; e-mail Resend pendente).

---

## Fase 5 — Acabamento de classe mundial

- **Acessibilidade AA:** navegação por teclado completa, foco gerenciado, `scope` em tabelas, skip-link, leitor de tela (Radix entrega a base).
- **Onboarding de usuários:** convite por e-mail, "esqueci a senha", primeiro acesso guiado. (Hoje só há login.)
- **Internacionalização-ready:** locale `pt-BR` centralizado (datas/moeda/números) — base para multi-idioma se necessário.
- **Performance:** revisar `force-dynamic` global; usar revalidação por tag; carregar dados sob demanda.
- **Estados vazios ricos** com CTA em todas as telas.
- **Tour/ajuda contextual** nos fluxos novos.

**Status em 2026-06-14:**
- ✅ **Acessibilidade base AA:** skip-link global para `#conteudo-principal`, foco visível
  consistente e `scope="col"` nas tabelas compartilhadas. Componentes Radix seguem como
  base para foco gerenciado em diálogos/drawers.
- ✅ **Onboarding sem credencial externa:** login ganhou recuperação de acesso via Supabase
  Auth e orientação de primeiro acesso. `/usuarios` ganhou preparo de convite como pendência
  in-app para admin.
- ⏳ **Convite/e-mail transacional:** envio real de convite e recuperação em produção depende
  de SMTP/Resend/URL pública confirmados.
- ✅ **Internacionalização-ready:** criado `src/lib/formatters.ts` com `pt-BR`,
  `America/Sao_Paulo` e `BRL` centralizados; telas novas passaram a usar a base.
- ✅ **Performance percebida:** `loading.tsx` global e skeletons em rotas dinâmicas de detalhe
  para streaming/prefetch parcial do Next 16.
- ✅ **Estados vazios ricos:** `DataTable` agora suporta título, ícone e CTA opcional sem
  refatorar cada lista.
- ✅ **Ajuda contextual:** botão flutuante abre diálogo contextual por módulo.
- ⏳ **A11y final:** ainda falta auditoria dedicada com axe/Lighthouse e correção fina por fluxo.
- ⏳ **Performance final:** ainda falta rodada específica para reduzir `force-dynamic`,
  adotar tags de revalidação onde fizer sentido e medir bundle.
- **Validação:** `tsc --noEmit`, `npm test`, `npm run lint` e `npm run build` passaram.
- **Percentual da Fase 5:** 72% (base implementada; pendem e-mail real, auditoria AA completa
  e otimização de cache por rota).

---

## Roadmap em ondas (visão executiva)

| Onda | Foco | Resultado para o usuário |
|---|---|---|
| **0 — Negócio** | Custo oculto no PDF, Parâmetros, confirmações, grupo_escolha | Para de vender ao custo e de vazar margem |
| **1 — Fundações** | Design system, tabelas, ⌘K, mobile, RLS, testes, CI | App rápido de usar e seguro; base para escalar |
| **2 — Integração** | Hub de projeto, orçamento→plano→compra, recebimento único | Os dois fluxos viram uma operação |
| **3 — Profundidade** | Editor de receita, PDFs com marca, lote LIMS | O app substitui a planilha de vez |
| **4 — Inteligência** | Previsão, reposição automática, alertas, dashboards | O app trabalha sozinho e antecipa |
| **5 — Acabamento** | A11y AA, onboarding, i18n, performance | Produto polido, pronto para crescer |

---

## Stack recomendada ("o mais moderno e funcional")

| Necessidade | Escolha | Por quê |
|---|---|---|
| Componentes UI | **shadcn/ui + Radix** | Padrão atual; acessível; copy-in (sem lock-in/runtime); Tailwind v4 |
| Tabelas | **TanStack Table** | De fato o padrão para tabelas ricas em React |
| Command palette | **cmdk** | ⌘K como em Linear/Vercel |
| Toasts | **sonner** | Feedback moderno, leve |
| Tema | **next-themes** | Claro/escuro/sistema com toggle |
| Formulários | **react-hook-form + zod** | Validação compartilhada cliente/servidor (zod já está no projeto) |
| Gráficos | **Recharts** (ou visx) | Dashboards declarativos |
| PDF | **react-pdf** ou **Puppeteer/edge** | Documentos pixel-perfect, não print do navegador |
| E-mail | **Resend** + edge functions | Notificações transacionais |
| Testes | **Vitest + Playwright** | Unit na engine + e2e nos fluxos |
| Erros/Analytics | **Sentry + PostHog** | Observabilidade de produto |
| Agendamento | **Supabase cron / pg_cron** | Reposição e alertas automáticos |

> Nota de implementação: as APIs do Next 16.2.9 deste repo podem diferir do
> usual — antes de codar, consultar `node_modules/next/dist/docs/` (regra do
> `AGENTS.md`). Adoção de libs deve ser incremental (uma página piloto primeiro).

---

## Decisões travadas (2026-06-13)

1. **Libs:** abraçar o stack completo — shadcn/ui + Radix + TanStack Table + cmdk + sonner + next-themes. Adoção incremental (página piloto primeiro).
2. **PDF:** server-side (qualidade de produto) — Fase 3.2.
3. **RLS:** migrar de service-role para RLS uniforme por papel — Fase 1.5 (toca todas as actions).
4. **Previsão:** começar com estatística simples (cobertura/média móvel); ML como evolução posterior.
5. **Marca dos documentos:** PENDENTE — usuário fornecerá logo, cores e dados fiscais do laboratório (necessário antes da Fase 3.2).

## Filtros por tela (gestão operacional)

Mapeamento dos filtros/ordenadores por tela. Implementação cai "de graça" com a Fase 1.2
(TanStack Table). Prioridade reflete o quanto a tela é uma **fila de decisão diária**.

| Tela | Filtros recomendados | Ordenar por | Prioridade |
|---|---|---|---|
| **Estoque — saldo** | status (OK/Repor/Sem estoque), categoria (crítico/normal), só com alerta, busca | disponível, ponto repos. | **Alta** |
| **Estoque — lotes** | estado (quarentena/aceito/em uso/bloqueado), vencidos, vence em ≤X dias, reagente, fornecedor | validade (FEFO) | **Alta** |
| **Cadastros — Insumos** | categoria, fabricante, fornecedor, crítico, abaixo do ponto, sem ponto definido, busca | custo, ponto repos. | **Alta** |
| **Compras — pedidos** | status, fornecedor, projeto, solicitante, período | data, total | **Alta** |
| **Orçamentos** | status, cliente, projeto, período, desatualizados (preço ≠ snapshot) | valor, data | Média-alta |
| **Planejamento** | status (rascunho/reservado/iniciado/liberado), projeto, data alvo, com faltas | data alvo | Média-alta |
| **Análises** | ativa/inativa, com gargalo, com material sem cadastro | amostras/dia, nº materiais | Média |
| **Auditoria** | já filtra por tabela; +ação, +usuário, +período, busca no diff | data | Média |
| **Cadastros — Projetos/Clientes/Fornecedores** | status/ativo, cliente (projetos), busca | nome, data | Média |
| **Custeio** | busca por análise | preço, custo, margem | Média (sort > filtro) |
| **Consumo por análise** (`/insumos`) | sem insumo cadastrado, por execução vs. amostra | etapa | Baixa-média |
| **Usuários** | papel, busca | e-mail | Baixa |

**Princípio operacional:** as telas de prioridade alta são **filas de triagem** — "o que repor",
"o que está vencendo / na quarentena", "pedidos em aberto". São onde o filtro vira decisão.
Orçamentos/Planejamento são **funis** (filtro por status). Tabelas de referência (Custeio,
Análises) ganham mais com **ordenação** do que com filtro. Padrão de UI: barra de filtros
persistente no topo da tabela + busca global; estado do filtro na URL (compartilhável/voltável).

---

## Métricas de sucesso (como saber que chegou ao nível)

- **Tempo para emitir um orçamento completo:** < 2 min.
- **Tempo para achar um insumo/análise:** < 5 s (via ⌘K/busca).
- **Zero** retrabalho entre falta de plano e pedido de compra.
- **Zero** rupturas de estoque não previstas (alerta + cobertura).
- **0** vazamentos de custo ao cliente; preço sempre = custo × fatores.
- **Cobertura de testes** da engine de custeio > 90%.
- **Acessibilidade:** Lighthouse/axe sem violações críticas.
- **Adoção:** a planilha `Laboratorio1.xlsm` deixa de ser usada.
