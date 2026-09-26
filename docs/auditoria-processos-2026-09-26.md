# Auditoria de processos, cadastros, papéis e interface — 26/09/2026

Base auditada: branch do PR #35 (`claude/kontrol-unificado`, commit `4e0f345`), que já inclui a
unificação da fórmula de preço, dos status e da previsão de reagentes.

## 0. Como foi feita e o que vale cada evidência

| Marca | Significado |
|---|---|
| **[S]** | Simulado no banco local: Supabase local com as migrations 0001–0119 e o seed, usuários de teste por papel (técnico, coordenador, gestor, admin), RLS ativo, chamando as mesmas RPCs do app. Cada cenário roda numa transação revertida. |
| **[P]** | Conferido em produção **só por contagem anônima** (cabeçalho `Content-Range`, `limit=0`), sem trazer nenhum dado. |
| **[T]** | Visto na interface, no modo simulado usado pelos testes E2E. |
| **[C]** | Verificado no código, com arquivo e linha. |
| **[I]** | Inferido; precisa de confirmação. |

**Limitações**

- O Docker desta máquina não publica portas para o Windows, e isso vale para todos os projetos. Reiniciar o Docker derrubaria os outros projetos em uso. Por isso o app não rodou contra o banco local: os fluxos de dados foram simulados direto nas RPCs, e a interface foi vista no modo simulado, só como admin.
- O banco de produção não foi inspecionado além das contagens anônimas. As migrations 0110–0119 ainda não estão em produção, então o estado real pode diferir do local.
- Concorrência foi avaliada pelo código (travas `FOR UPDATE`, `operacao_id`), sem sessões paralelas reais.
- Desempenho: só hipóteses, sem medição.
- As correções das Ondas 1 e 2 (migrations 0120 e 0121) foram gravadas depois da autorização do dono e validadas só no banco local e em testes. Nada foi aplicado em produção (ver §7).

---

## 1. Diagnóstico prioritário

Problemas que impedem concluir processos, corrompem dados ou expõem informação.

| # | P | Problema | Evidência |
|---|---|---|---|
| 1 | **P0** | **Dados legíveis sem login.** Com a chave pública do app (que vai no navegador) dá para ler, sem autenticação: o painel executivo (valor do estoque, orçamentos, margem média, compras abertas, gasto por projeto), as 463 linhas de receitas das análises e o histórico de status (`eventos_status`, com e-mail de quem agiu e motivos). | [P] contagens anônimas: `v_dashboard_executivo` 1, `v_insumo_analise_pendencias` 463, `eventos_status` 14. [S] também `v_custo_estoque_vigente` (82 linhas locais). Causa: views sem `security_invoker` rodam como dono e ignoram o RLS; policy `anon_read_eventos_status` (0017:22) |
| 2 | **P0** | **Planejamento trata "frasco" como "mL".** Em insumos com lotes de embalagens fechadas (o modelo usado desde o PR #33), a reserva e a baixa do plano subtraem a quantidade física da contagem de embalagens. | [S] Frascos de 100 mL, 3 em estoque. Plano de **2 mL**: tira **2 frascos** (200 mL) e o frasco restante some do saldo (fica `em_uso`, que esse modelo não conta). Plano de **2,5 mL**: o início falha com erro de constraint. Plano de **250 mL** com 300 mL em estoque: acusa falta de 247 e não inicia |
| 3 | **P0** | **Excluir um insumo apaga seu histórico.** Lotes, movimentações, reservas e itens de compra são apagados em cascata. A tela só bloqueia quando já houve recebimento formal. Equipamento: apaga unidades, manutenções, log de status e reservas. | [S] coordenador exclui insumo com entrada e baixa → 0 lotes e 0 movimentações. [C] FKs `ON DELETE CASCADE` (0001:127, 0003:26/47, 0004:78, 0052) |
| 4 | P1 | **Reserva-fantasma.** Descartar, bloquear, estornar ou reduzir um lote reservado não libera a reserva: o disponível do insumo é descontado duas vezes e o plano não inicia. | [S] lote A (10) reservado, lote B (10) livre; descartar A → disponível do insumo = **0** |
| 5 | P1 | **Inventário "ressuscita" consumo.** A contagem é aplicada como saldo absoluto, mesmo que o lote tenha mudado depois da contagem. | [S] contagem 9 (sistema 10), baixa de 3 (fica 7), aplicar → lote volta a **9** |
| 6 | P1 | **Compra recebida em parte fica aberta para sempre.** Não existe "encerrar com pendência"; o cancelamento é recusado quando houve recebimento. O saldo pendente continua contando como "em compra" e suprime a reposição. | [S] receber 100 de 300 → cancelar é recusado; não há outra transição |
| 7 | P1 | **Um insumo passa a ter dois modelos de quantidade.** O recebimento de compra sempre cria lote "por volume", mesmo para insumo controlado por embalagens. O saldo soma frascos com mL, e depois disso a entrada por embalagens é recusada. | [S] 2 frascos + receber 100 mL → saldo exibido **102 mL**; nova entrada de frascos: "Este insumo usa controle por volume" |
| 8 | P1 | **Custo médio ponderado até 100× maior.** Lotes de embalagens fechadas guardam o preço da embalagem, e a view divide como se fosse preço por unidade. | [S] R$ 500 / frasco de 100 mL, fator 1000: esperado R$ 0,005/µL; view dá **R$ 0,50/µL** e marca "divergente" |
| 9 | P1 | **A proposta aprovada não chega à operação.** Aprovar a versão (pelo histórico ou pelo link) não altera o módulo, o projeto nem o planejamento. O botão "Gerar planejamento" exige o módulo `aprovado`, status que a interface não alcança. | [C] `orcamento/[id]/page.tsx:214-221`, `:544`, `:667`; `orcamentos.ts:193,223-229`; 0090:57; 0101:617-637 |
| 10 | P1 | **Margem real do plano sempre ignora o consumo.** A view procura a referência `plano N`, mas a baixa grava `plano N; analise …; reserva …`. | [S] definição da view (0096:35) × gravação (0100:515) |
| 11 | P1 | **32 das 37 permissões de `/usuarios` não têm efeito.** Só `cadastros.editar`, `insumos.editar`, `projetos.editar`, `analises.editar` e `tecnicos.salario.ver` valem. Orçamento, compras, pedido, estoque, planejamento, recebimento e as de governança são só visuais. | [C] busca por cada chave em `src` e nas migrations; `governanca.ts:140-148` só olha o papel |
| 12 | P1 | **Erro de validação vira tela genérica.** 134 `throw new Error` em ações chamadas direto por formulário: em produção o `error.tsx` esconde a mensagem e o usuário perde o que digitou. | [C] ex.: `orcamentos.ts:191` via `orcamento/[id]/page.tsx:668`; `planejamento.ts:285-335` |
| 13 | P1 | **Pedido interno trava depois da formalização.** Devolvido para ajuste, volta a `validado` e o único botão é "Formalizar", que falha porque a compra já existe. Cancelar a compra formal deixa o pedido sem caminho de recebimento. | [C] 0087:44-48; `PedidoInternoAcoes.tsx:126-128`; 0088:34-36; 0083:126-131 |
| 14 | P1 | **"Liberar reservas" cancela o plano** sem confirmação nem motivo; o plano não pode mais ser reservado. | [C] 0100:555-612 (grava `cancelado`); `PlanoAcoes.tsx:127,185-191` |
| 15 | P2 | **Desbloquear lote pula a aceitação.** Lote em quarentena, bloqueado e desbloqueado, vira "aceito" sem critério nem responsável. | [S] |

---

## 2. Mapa dos fluxos

### 2.1 Ciclo físico do insumo

| Fluxo | Início e dados | Responsável | Estados | Registros | Encerramento | Ruptura |
|---|---|---|---|---|---|---|
| Necessidade | Alerta de reposição (disponível ≤ ponto), previsão por consumo × prazo, falta do plano, cron diário | cron, técnico, coordenador | — | `notificacoes` | Vira pedido interno ou compra; o alerta não se encerra | Três portas de reposição com regras diferentes; o alerta ignora compras abertas |
| Pedido interno | Projeto, justificativa, fonte, urgência, itens | Técnico cria; coordenador aprova e conduz | 18 status, de rascunho a compra concluída | aprovações, eventos, auditoria | Compra formal | Travas do item 13; `compra_concluida` não exige recebimento |
| Compra formal | Itens, quantidade, custo estimado | Coordenador | solicitado → aprovado → enviado → em trânsito → recebido (automático a 100%) / cancelado | eventos | 100% recebido | Item 6 |
| Recebimento | Quantidade ≤ pendente, validade (obrigatória se crítico), código, `operacao_id` | Compra formal: **coordenador**; pedido interno sem compra: técnico | Cada entrega cria lote novo **em quarentena** | movimentação, livro de recebimento, eventos | Item fechado ao completar | Item 7; `/recebimento` não recebe itens formalizados; o custo do lote é o estimado |
| Quarentena / aceite | Lote em quarentena; item crítico exige critério | Coordenador aceita; gestor bloqueia e descarta | quarentena → aceito → em uso → consumido; bloqueado; descartado | auditoria | Lote aceito entra no disponível | Item 15; lote bloqueado sem alerta nem prazo |
| Entrada avulsa | Cadastro com quantidade, entrada manual, inventário | Técnico | Lote **aceito** direto (embalagens) ou em quarentena (volume) | movimentação | Saldo | Quarentena contornável pelo cadastro, mesmo para item crítico |
| Reserva | Demanda do plano ÷ fator de conversão | Técnico | Plano rascunho → reservado; falta vira reserva "parcial" sem lote | `reservas_estoque` | Consumida no início ou liberada | Itens 2 e 4; reserva não expira |
| Baixa / consumo | Início do plano (tudo de uma vez), baixa manual, abertura de embalagem | Técnico | plano → em execução | saída com `plano N; reserva R` | Plano concluído | Item 2; conferência de lote não comanda a baixa; não há devolução de sobra |
| Validade / descarte | View de alertas, notificação diária | Gestor descarta; técnico baixa com motivo "Vencimento" | — | ajuste com categoria | Lote zerado | O alerta não identifica o lote nem leva à ação |
| Inventário | Campanha, contagem, justificativa | Coordenador conta; gestor aplica | Campanha **sem fechamento** | contagens, ajuste | Lote ajustado | Item 5; tabelas de inventário graváveis por qualquer usuário via API |
| Estornos | Motivo | Coordenador | Estorno bilateral só para pedido interno | ajuste, lote descartado | Reabre pendente | Compra formal sem pedido interno não tem estorno |

**Quando o saldo muda:** comprar não altera; receber cria saldo em quarentena (fora do disponível); aceitar libera; reservar reduz o disponível sem tirar do lote; iniciar o plano tira tudo; concluir não mexe no estoque.

### 2.2 Cadeia comercial → operação

| Etapa | Gatilho / papel | Encerramento | Ruptura |
|---|---|---|---|
| Orçamento (dados) | Qualquer usuário | Módulos de análises e de projeto | "Aprovado/recusado" só por seletor manual |
| Módulo de análises | preencher custos (técnico); revisar (coordenador) | Emissão | Status `aprovado` inalcançável; "Marcar revisado" com opção "Aprovado" grava metade e trava o módulo |
| Emissão da proposta | Coordenador; transação idempotente | Classificação ou link | **Sólida**: atômica, idempotente, snapshot imutável |
| Classificação / link público | Coordenador ou cliente | — | **Fim da linha**: não propaga; a criação do link sumiu da tela em junho (commit 587bed4); nova versão não substitui versões `enviado`, e a versão antiga continua aprovável |
| Projeto | Cadastro manual | Manual | Não nasce da proposta; pode ser concluído com plano e compras abertos |
| Planejamento | Manual (o botão a partir do orçamento é inalcançável) | Concluído | Sem vínculo com a versão aprovada; margem com consumo zero |
| Falta → compra | "Comprar faltas" | Pedido interno | Cada clique cria outro pedido para a mesma falta |

### 2.3 Passagens de responsabilidade

| Pendência | Quem resolve | Como fica sabendo | Problema |
|---|---|---|---|
| Pedido interno em validação | Coordenador | KPI em `/suprimentos` | Sem notificação; "coordenador do projeto" aceito no app e recusado no banco |
| Etapas administrativas de compra | Coordenador | Mapa em `/suprimentos` | Não existe papel administrativo; o mesmo coordenador cria, valida e aprova, sem checar solicitante ≠ aprovador |
| Compra aguardando chegada | Coordenador | Página inicial, `/recebimento` | Quem recebe fisicamente (técnico) não consegue registrar |
| Lote em quarentena | Coordenador | Notificação diária | Notificações são globais: um técnico "marca todas como lidas" e o gestor perde o alerta |
| Orçamento pronto para emitir | Coordenador | KPI "Em revisão" | Sem fila por responsável |
| Cliente aprovou pelo link | — | Só o evento gravado | **Ninguém é avisado** |

A página inicial é a mesma para todos os papéis e não mostra "aguardando você".

---

## 3. Cadastros

| Cadastro | Necessário e presente | Ausente ou em lugar errado | Redundante / sem uso demonstrado |
|---|---|---|---|
| **Insumo** | especificação, unidade, unidade de consumo, fator, embalagem, fabricante, criticidade, ponto de reposição, validade após abertura | **Não há "ativo"**: a única saída é excluir (item 3). `data_validade`, `data_fabricacao` e `data_aquisicao` são dados de **lote**, não do produto: a coluna "Validade" do insumo não muda quando chega lote novo. O custo nunca é atualizado pelo recebimento | `codigo_interno`, `fornecedor_alt_id`, `condicao_armazenamento`, `sds_url` (gravados, nunca lidos). `nome_item` duplica o tipo técnico. `prazo_entrega_max_dias` duplica `lead_time_dias` |
| **Lote** | código, validade, quantidade, custo, status, snapshot da embalagem | **Local não é gravado** no recebimento nem no lote inicial; só o inventário grava. Fornecedor e projeto são texto livre | — |
| **Fornecedor** | nome, CNPJ e contatos (impressão do pedido), prazo médio | Nome sem unicidade; sem validação de CNPJ/e-mail | `site`, `catalogo_padrao`, `prazo_max_dias` sem uso. A exclusão apaga o fornecedor de pedidos antigos (`SET NULL`), embora exista "ativo" |
| **Cliente** | Dados copiados para o orçamento (histórico preservado — bom) | O orçamento aceita cliente só em texto | `observacoes` sem uso |
| **Projeto** | nome, status, datas, cliente | Aceita data de fim antes do início. O coordenador que aprova pedidos (`coordenador_email`) **não está no formulário** | Quatro campos para o mesmo papel: `responsavel`, `coordenador`, `coordenador_nome`, `coordenador_email` |
| **Equipamento** | custo, vida útil, manutenção (custeio) | Sem auditoria; exclusão apaga o histórico | Duplica dados de `equipamento_unidades` sem sincronia; `possui` não afeta custo |
| **Técnico** | salário, horas, dedicação (valor-hora) | Sem "ativo" nem data de desligamento | `processo` não entra no cálculo |
| **Local** | nome, tipo | — | Editar pela tela **apaga `parent_id`** (hierarquia) |
| **Tipo técnico** | nome | Policy aberta: qualquer usuário cria, edita ou exclui | `classe`, `unidade_referencia`, `finalidade` sem uso |
| **Parâmetros** | margem, impostos, fundos, horas | — | **Duas telas** editam a mesma tabela com promessas diferentes: `/parametros` diz "recalcula custos e preços imediatamente" [T] e não versiona; `/orcamento/parametros` versiona |

**Importação por planilha:** projetos são importados antes de clientes e insumos antes de fornecedores, então referências a registros novos da mesma planilha falham. Percentual entre 0 e 1 é multiplicado por 100 (1% vira 100%).

---

## 4. Tabela de achados

Os itens do §1 não se repetem aqui. Todos são **defeitos comprovados**, salvo quando marcados [I].

| ID | Local | Atual → esperado | Evidência / reprodução | Impacto | P | Correção proposta |
|---|---|---|---|---|---|---|
| EST-1 | Pedido interno × compra | Editar ou remover item depois da formalização não chega à compra; excluir item apaga em cascata o livro de recebimento → travar a edição após formalizar e proibir exclusão com recebimento | [C] `pedidos-internos.ts:155-166,486-542`; 0083:11; 0092:8; `compras.ts:205-214` sem checagem de status | Quantidades divergentes, lote sem origem | P1 | Gatilho no banco por status |
| EST-2 | Estorno | Compra formal sem pedido interno (as do cron) não tem estorno → estorno bilateral | [C] `estoque.ts:192-215`; 0099:485-494 | Erro de recebimento sem correção | P1 | RPC de estorno para compra formal |
| EST-3 | Devolução | Não há devolução da sobra do plano; cancelar plano em execução não devolve nada → fluxo de devolução auditado | [C] nenhuma RPC | Sobra física invisível | P1 | Decisão de negócio 2 |
| EST-4 | Conferência de lote | Conferir o lote B (exceção de validade justificada) e iniciar → a baixa sai do lote A → a baixa deve usar o lote conferido | [C] `planejamento-conferencia.ts:117-126` × 0100:471-518 | Rastreabilidade falsa | P1 | Reatribuir a reserva ao lote conferido |
| EST-5 | Idempotência | `baixa_manual_lote`, `entrada_inventario` e "Comprar faltas" não têm `operacao_id` → duplo clique duplica | [C] `estoque.ts:126-134,392-396`; `compras.ts:89-181` | Baixa em dobro, pedidos duplicados | P2 | `operacao_id` como no fluxo de embalagens |
| EST-6 | Alertas de validade | Não identificam o lote nem levam à ação; lotes em quarentena ou bloqueados que vencem não alertam | [C] 0078:98-107; `estoque/page.tsx:223-240` | Vencidos parados | P2 | `lote_id` na view e link "Baixar por vencimento" |
| EST-7 | Indicadores | "Sugerido" do painel (ponto + segurança − disponível) ≠ previsão de Suprimentos (consumo × prazo − aberto) | [C] `page.tsx:246-247` × 0098:130-136 | Telas se contradizem | P2 | Uma fórmula |
| EST-8 | Baixa manual (volume) | Olha só a validade de fábrica, não a validade após abertura | [C] 0117:224 | Uso de frasco aberto vencido | P2 | Usar `menor_validade` |
| EST-9 | Inventário | Tabelas graváveis por qualquer usuário via API; campanha sem fechamento; várias contagens do mesmo lote | [C] 0071:198-208 | Contagem adulterável | P2 | Gravar via RPC; fechar campanha |
| ORC-1 | Revisão do módulo | "Marcar revisado" com "Aprovado": a RPC recusa, mas o status operacional já foi gravado → módulo travado | [C] `orcamentos.ts:214-229`; `page.tsx:684-692` | Única saída é cancelar e refazer | P1 | Tirar a opção; operação atômica |
| ORC-2 | Link público | Criação e revogação do link sumiram da tela; `/aprovar/[token]` inalcançável | [C] `orcamento-projetos.ts:708-763` sem uso; removido em 587bed4 | Funcionalidade do app antigo perdida sem justificativa (contraria o protocolo de migração) | P1 | Restaurar na etapa final da proposta |
| ORC-3 | Versões | Nova emissão só substitui versões `emitido`; a v1 `enviado` continua ativa e aprovável; pode haver duas aprovadas, e Fundos soma as duas | [C] 0075:219-221; 0101:743-746; `fundos/page.tsx:83-87` | Aprovação de preço antigo, total inflado | P1 | Substituir toda versão viva e revogar os links |
| ORC-4 | Faltas → compra | Cada clique em "Comprar faltas" cria outro pedido interno; pedido e itens em dois INSERTs | [C] `compras.ts:89-190`; `demanda.ts:166` | Compras duplicadas | P1 | Descontar o já pedido; transação |
| ORC-5 | Gerar plano | Sem idempotência nem índice único por orçamento; não guarda a versão aprovada | [C] `planejamento.ts:358-412` | Planos duplicados | P2 | Índice único e vínculo com a versão |
| ORC-6 | Cancelamentos | Cancelar proposta aprovada deixa plano, reservas e pedidos ativos; concluir ou cancelar plano não olha pedidos internos abertos | [C] 0090:60; 0101:610; 0111:234-300 | Operação sem cobertura comercial | P2 | Decisão de negócio 5 |
| ORC-7 | Validade da proposta | Versão `enviado` vencida continua aprovável; o vencimento só roda ao abrir o histórico | [C] 0101:56-190; `orcamento-historico.ts:13-30` | Aprovação fora do prazo | P2 | Checar validade na aprovação; job agendado |
| ORC-8 | Números entre telas | O resolvedor das listas conta orçamentos de projeto **cancelados** e usa os padrões globais atuais; a emissão não | [C] `valores-modulos.ts:46-51` × `demandas.ts:410,482` | Lista ≠ proposta depois de mudança | P2 | Mesmo filtro e taxas congeladas |
| ORC-9 | Visão 360° | "Orçado (aprovado)" soma módulos `aprovado` (inalcançável) em vez das versões aprovadas | [C] `projetos/[id]/page.tsx:167-170` | KPI zerado | P2 | Somar versões finais aprovadas |
| ORC-10 | Duplo clique | Criar módulo da demanda duas vezes bloqueia a emissão por "duplicidade ativa" | [C] `demandas.ts:291-314` | Saneamento manual | P2 | Índice único |
| ORC-11 | Link público | O técnico pode gravar `aprovado_em` direto no link, sem evento | [C] 0075:139-140 | Trilha forjável | P2 | Tirar UPDATE direto |
| PER-1 | `/usuarios` | O diálogo usa os padrões fixos do código, não a categoria, e grava todas as chaves: mudanças em `/governanca/privilegios` não chegam a quem foi editado; coordenador rebaixado a técnico mantém `cadastros.editar` | [C] `UsuarioAcoes.tsx:54`; `permissions.ts:408-422` | Delegação imprevisível | P1 | Gravar só as diferenças da categoria |
| PER-2 | Orçamento | Botões visíveis para quem não pode (Duplicar, Cancelar, Revisar, Emitir, Modelos) | [C] `historico/page.tsx:396,404`; `final/[id]:331,345`; `orcamento/[id]:222,668,720` | Erro na cara do usuário | P2 | Calcular as flags e esconder |
| PER-3 | Banco mais aberto que o app | Técnico via API pode excluir `orcamentos`, gravar parâmetros econômicos na demanda, criar insumo pela triagem e disparar a reposição | [C] 0014; 0036:26; 0070; 0031 | Burla de regra e de trilha | P2 | Endurecer RLS e RPCs |
| PER-4 | Notificações | Globais: "marcar todas como lidas" vale para todos; e-mail vai para lista fixa, não por papel | [C] `notificacoes.ts:37-43`; 0018:37; `email.ts:40` | Alerta do gestor apagado pelo técnico | P2 | Leitura por usuário e destino por papel |
| PER-5 | Menu | Governança, Fundos e Parâmetros do orçamento aparecem para todos | [C] `modules.ts:242-266` | Ruído | P3 | `minRole` |
| PER-6 | Suspensão | `papel_minimo` não olha `suspenso`; o bloqueio só vale quando o token expira | [C] 0005:38-41 | Janela curta | P3 | Incluir `not suspenso` |
| CAD-1 | Tipos técnicos | Qualquer usuário cria, edita ou exclui | [C] 0047:36-37 fora da 0108 | Classificação alterável | P2 | Incluir na regra da 0108 |
| CAD-2 | Projeto | Coordenador do projeto fora do formulário; aprovação de pedido interno depende dele | [C] `pedidos-internos.ts:82,136-138`; `config.ts:125-143` | Coordenador do projeto não aprova | P2 | Um campo ligado a usuário |
| CAD-3 | Lote inicial | Nasce aceito, sem local, NF nem critério, mesmo para item crítico | [C] 0113:84-88,147 | Quarentena contornada | P2 | Decisão 3 |
| CAD-4 | Parâmetros | `/parametros` altera margem e impostos sem versão, evento nem teto | [C] `parametros.ts:28-55` | Histórico econômico incompleto | P2 | Uma tela, sempre versionada |
| CAD-5 | Importação | Ordem entre abas; 1% vira 100% | [C] `config.ts:534-544`; `importacao.ts:207-211` | Importação falha ou erra percentuais | P3 | Ordem topológica; não converter 0–1 |
| CAD-6 | Local | Editar apaga a hierarquia (`parent_id`) | [C] `cadastros.ts:239` | Perda de estrutura | P3 | Enviar o campo ou não sobrescrever |
| UI-1 | Mensagens | Mensagens cruas do banco (inglês, "violates…") chegam à tela: 110 ocorrências de `error.message` | [C] `cadastros.ts:303-309`; `estoque.ts:299` | Usuário sem orientação | P1 | Tradutor único por código de erro |
| UI-2 | Confirmação de início do plano | Modal feito à mão, sem papel de diálogo, sem Esc e sem foco preso; título "Confirmar ação" para uma baixa definitiva | [C] `PlanoAcoes.tsx:64-95,182` | Teclado e leitor de tela se perdem | P1 | `ConfirmSubmitButton` "Dar baixa e iniciar" |
| UI-3 | Glossário | "Demanda" ainda na interface; lista chamada "Propostas" com botão "Nova demanda" e dois "Cliente livre" | [T] `/orcamento/demandas`; [C] `demandas/page.tsx:90,113-158` e mais 15 pontos | Usuário acha que são coisas diferentes | P1 | Ver §5 |
| UI-4 | "Orçamento" em Suprimentos | Usado no sentido de cotação ("Aguardando orçamento") | [C] `lib/pedido/status.ts:38,48` | Conflito com o glossário | P2 | "Cotação" |
| UI-5 | "Pedido" | Nomeia pedido interno e compra | [C] `modules.ts:155`; `ComprasTable.tsx:62` | Ambiguidade | P2 | "Pedido interno" e "Compra" |
| UI-6 | Status editável | Status do orçamento é campo livre no formulário | [C] `DemandaForm.tsx:262-268` | Status contradiz o fluxo | P1 | Status como consequência das ações |
| UI-7 | Painel "Dados completos" | 20 campos com IDs e códigos crus | [C] `DemandaForm.tsx:686-705` | Ruído | P2 | Remover ou formatar |
| UI-8 | Status crus | Status exibidos com o código interno | [C] `final/[id]:464,513`; `planejamento/[id]:658`; `projetos/[id]:397` | Leitura técnica | P2 | `StatusBadge` |
| UI-9 | Confirmações | Botão de desistir diz "Cancelar" mesmo em "Cancelar orçamento"; motivo do cancelamento é fixo no código; remover item/anexo do pedido sem confirmação | [C] `ConfirmActionButton.tsx:25`; `orcamento/[id]:721`; `pedido/[id]:655,886` | Ambiguidade, exclusão acidental | P2 | "Voltar"; motivo obrigatório |
| UI-10 | Retorno das ações | Mensagens sem `aria-live`; botões sem estado de envio | [C] 16 de 25 arquivos com `useActionState` | Leitor de tela não anuncia; duplo envio | P2 | Padrão único de retorno |
| UI-11 | Tabelas | 57 tabelas feitas à mão sem versão para celular; Histórico com 1.900 px de largura | [C] | Ação fora da tela | P2 | `DataTable` e coluna de ações fixa |
| UI-12 | Acessibilidade | 160 `<label>` sem `htmlFor`; "?" dentro de `<label>` rouba o nome do campo | [C] `DemandaForm.tsx:330-336`; `demandas/[id]:973-979` | Campo sem nome | P2 | Componente `Campo` |

**Hipóteses de desempenho (precisam de medição):** custeio do catálogo inteiro a cada abertura de `/analises`, `/custeio` e novo orçamento (sem cache); listas sem limite no servidor (a paginação acontece no navegador); consultas em sequência em `cadastros/[slug]` e `planejamento/[id]`; `recharts` carregado sem divisão na página inicial.

---

## 5. Melhorias de interface

### 5.1 Textos revisados

| Local | Hoje | Proposta |
|---|---|---|
| Lista de orçamentos | "Propostas" · "Nova demanda" · "Título da demanda" | "Orçamentos" · "Novo orçamento" · "Título do orçamento" |
| Formulário | "Salvar demanda" / "Criar demanda" | "Salvar orçamento" / "Criar orçamento" |
| Etapas | "Demanda", "Laboratorio", "Parametros", "Final" | "Dados", "Laboratório", "Parâmetros", "Proposta" |
| Suprimentos | "Aguardando orçamento", "Orçamentos recebidos" | "Aguardando cotação", "Cotações recebidas" |
| Pedido interno | "Ajuste solicitante", "Análise adm.", "Ajuste compras" | "Devolvido ao solicitante", "Em análise administrativa", "Devolvido a Compras" |
| Planejamento | "Demanda prevista", "Demanda" | "Consumo previsto", "Necessário" |
| Início do plano | "Confirmar ação" / "Confirmar" | "Iniciar e dar baixa?" / "Dar baixa e iniciar" |
| "Liberar reservas" | "Reservas liberadas." (e o plano é cancelado) | "Reservas liberadas. O plano voltou para rascunho." |
| Estoque | "Ponto atual", "Ponto suger.", "OK" | "Ponto de reposição", "Ponto sugerido", "Em dia" |
| `/parametros` | "Alterar um fator recalcula custos e preços imediatamente." | Unificar as telas; "Vale para novos cálculos. Propostas emitidas não mudam." |
| Erros de análise | "Analise inativa ou nao oferecivel para novo orcamento." | "Análise inativa ou fora da oferta; não pode entrar em novos orçamentos." |
| Recebimento | "Requer coordenação" | "Só coordenador ou superior" |
| Encerrar compra (novo) | — | "Encerrar com pendência" · "Informe por que o restante não será recebido." |

### 5.2 Ajuda "?" (HelpTip)

O mecanismo funciona por clique, toque e teclado. Faltam: nome acessível no conteúdo, área de toque de 44 px (hoje 32), texto alinhado à esquerda (hoje justificado) e um só "?" por título (o botão flutuante `ContextHelp` usa o mesmo ícone).

**Remover** (não resolvem dúvida ou escondem consequência):
- "Novo orçamento" e "Marcar revisado": repetem o que a tela já diz.
- "Dados somente leitura": já existe o selo.
- "Instituição emissora": trocar por lista com as duas opções.
- "Delta": renomear a coluna para "Variação vs. versão anterior".
- "Número do lote": renomear o campo para "Lote do fabricante".
- "Entradas de viagem": esconde que salvar **sobrescreve ajustes manuais**. Isso deve ser aviso visível, não ajuda.

**Acrescentar** (dúvida real):
- **Quantidade na embalagem:** "Quanto vem em 1 embalagem fechada, na unidade da embalagem. Ex.: frasco de 500 mL → 500."
- **Unidade → "Unidade da embalagem":** "Unidade em que a embalagem é vendida (mL, un, reações). A de consumo pode ser outra; o fator converte."
- **Margem de lucro** (a ajuda atual está errada para propostas): "Nas propostas, é % do preço final. Na tabela de análises, soma-se ao custo."
- **Taxa de incubação** em `/orcamento/parametros`: "Padrão de 2%. É ajustada em Parâmetros de custeio."
- **Recebimento, "Prontos" × "Aguardando":** "Aguardando: tudo que falta chegar. Prontos: pedido aprovado ou enviado, já pode registrar a chegada."
- **Legenda dos 18 status do pedido interno** nas colunas "Etapa".

### 5.3 Organização

- Um botão primário por tela.
- No máximo 4 ou 5 indicadores por tela, cada um levando à lista já filtrada. A página inicial tem 12, e "Vencendo" aparece duas vezes.
- Página inicial por papel, com bloco "Aguardando você": pedidos em validação, lotes em quarentena, orçamentos para emitir.
- Estoque e Controle de Estoque numa tela só, com abas.
- Formulário de orçamento em etapas, com os campos secundários recolhidos.
- Detalhe do pedido interno em abas: Itens, Documentos, Comunicação, Histórico.

---

## 6. Decisões de negócio que precisam de você

1. **Unidade oficial do saldo:** embalagens fechadas ou unidade física (mL, reações)? E o ponto de reposição? Enquanto isso não for decidido, o recebimento de compra continua criando lote por volume para insumos contados em embalagens (item 7).
2. **Baixa do plano:** integral no início (hoje) ou pelo consumo real na conclusão, com devolução da sobra? Quem autoriza a devolução?
3. **Estoque inicial pelo cadastro:** passa por quarentena, pelo menos para item crítico?
4. **Quem recebe fisicamente** a compra formal: técnico ou só coordenador? E quem conta inventário?
5. **Cancelar proposta aprovada:** cancela ou suspende plano, reservas e pedidos, ou só alerta?
6. **Aprovar proposta:** cria o planejamento automaticamente ou só libera o botão? Um plano por proposta ou por módulo?
7. **Modelo das permissões individuais:** "papel OU permissão" (só concede, como análises) ou "só permissão" (concede e revoga, como cadastros)? Hoje convivem os dois, e 32 caixas não fazem nada. A escolha define o que fazer com as caixas de compras, estoque, pedido e planejamento.
8. **Segregação de funções:** criar um papel administrativo/compras e exigir aprovador diferente do solicitante?
9. **Reservas:** devem expirar? Em quantos dias?
10. **Desbloqueio de lote:** exige nova aceitação?
11. **Ajuste de inventário** acima de X% ou R$ Y exige segunda aprovação?
12. **Exclusão física de cadastros:** continua existindo? Para qual perfil? Ou só inativação?
13. **Coordenador do projeto** aprova pedidos internos mesmo sendo técnico?

---

## 7. Plano de correção e validação

### Onda 1 — Segurança e integridade de dados — **implementada** (migration 0120)

Autorizada pelo dono em 26/09. Validada no banco local por `supabase/tests/integridade_estoque_0120.sql`, que reproduz cada cenário e agora roda no CI:

| Correção | Critério objetivo de validação |
|---|---|
| Revogar SELECT de `anon` em todas as views; remover as policies de leitura anônima de `eventos_status` e `tipo_insumos` | Contagem anônima = erro 401/permissão negada em `v_dashboard_executivo`, `v_insumo_analise_pendencias` e `eventos_status`; `/aprovar/[token]` continua funcionando |
| Reserva e baixa do plano em embalagens inteiras para lotes de embalagens fechadas; reparo dos lotes deixados em `em_uso` | Cenários do item 2: plano de 2 mL tira 1 frasco e deixa 2 `aceito`; 2,5 mL tira 1; 250 mL reserva 3 sem falta |
| Liberar as reservas do lote ao descartar, bloquear, estornar ou reduzir, marcando o plano como "reserva desatualizada" | Cenário do item 4: após descartar A, disponível = 10 e a nova reserva usa B |
| Desbloquear devolve ao status anterior | Quarentena → bloquear → desbloquear = quarentena |
| Inventário exige saldo atual = saldo da contagem | Cenário do item 5: aplicar é recusado com "conte de novo" |
| Custo médio ponderado normalizado pelo conteúdo | Cenário do item 8: R$ 0,005/µL, situação "alinhado" |
| Margem real casa `plano N;%` | Plano iniciado mostra custo real > 0 |
| "Liberar reservas" devolve ao rascunho | Plano liberado pode ser reservado de novo |
| Transição "Encerrar com pendência" (motivo obrigatório; registra a pendência nos itens) | Compra 100/300 encerrada sai de "em compra" na previsão |
| Gatilhos que recusam excluir insumo ou equipamento com vínculo (código 23503, que a tela já traduz) | Cenário do item 3: exclusão recusada com "está em uso" |
| Testes SQL em `supabase/tests/` e no CI (como 0108 e 0111) | Job `schema` verde |

Mudanças no app ligadas a esta onda:
- a previsão do plano lê o disponível na unidade física (nova view `v_estoque_disponivel_unidade`);
- `/compras/[id]` ganhou "Encerrar com pendência" (com motivo), que substitui "Cancelar" quando já houve recebimento;
- "Liberar reservas" pede confirmação e avisa que o plano volta ao rascunho;
- o início do plano usa o diálogo padrão ("Dar baixa e iniciar"), com Esc e foco (UI-2).

Também foram corrigidos dois testes SQL desatualizados desde a 0117 (`baixa_manual_embalagens_0110.sql`), que não rodavam no CI; agora rodam, junto com o da 0112.

### Onda 2 — Permissões de orçamento — **implementada** (migration 0121)

Opção 1, escolhida pelo dono: "papel OU permissão efetiva", como em análises (0114).

| Ação | Papel | Ou a permissão |
|---|---|---|
| Revisar, recalcular, emitir, classificar, duplicar | Coordenador | Orçamentos: Emitir proposta |
| Cancelar orçamento, módulo ou proposta | Coordenador | Orçamentos: Cancelar (padrão do coordenador passou a ser marcado) |
| Parâmetros econômicos globais | Gestor | Orçamentos: Editar parâmetros (também no banco, tabela `parametros`) |
| Fundos, modelos, governança | Gestor | — (só papel) |

- As seis RPCs de orçamento trocaram só a checagem de papel.
- As telas escondem Recalcular, Marcar revisado, Cancelar, Excluir, Duplicar e Emitir para quem não pode, e explicam quem pode.
- A matriz em `/orcamento/governanca` mostra a permissão que libera cada ação.
- "Marcar revisado" perdeu o seletor "Enviado/Aprovado" e grava na ordem certa (ORC-1).

Validação: `supabase/tests/orcamento_permissoes_0121.sql`.
- Técnico sem permissão é recusado.
- Coordenador sem caixas continua podendo.
- Técnico com as caixas passa, inclusive nos parâmetros.

As caixas das outras áreas continuam dependendo da decisão 7.

### Onda 3 — Continuidade dos processos (depende das decisões 1, 2, 5 e 6)

- Proposta aprovada → planejamento, com vínculo com a versão (ORC-1, item 9).
- Restaurar o link público (ORC-2).
- Substituição de versões e validade na aprovação (ORC-3, ORC-7).
- Pedido interno depois da formalização (item 13, EST-1).
- Estorno de compra formal (EST-2); idempotência (EST-5, ORC-4, ORC-5).
- Recebimento no modelo do insumo (item 7).

Cada item com teste SQL do cenário e teste E2E do caminho do usuário.

### Onda 4 — Interface

1. Erros tratados (item 12, UI-1).
2. ~~Confirmação do início do plano (UI-2)~~ — feita na Onda 1.
3. Glossário (UI-3 a UI-5).
4. Status como consequência (UI-6).
5. Parâmetros numa tela (CAD-4).
6. HelpTips (§5.2).
7. Página inicial por papel.

Validação: E2E existentes, mais um por fluxo alterado, e verificação de teclado nos diálogos.

**Dependências:** a Onda 1 pode seguir junto com o PR #35 ou logo depois dele, porque não muda regra de negócio. A Onda 3 espera as decisões. A Onda 4 é independente.

---

## 8. Pendências da rodada anterior (PR #35)

- **Permissões de orçamento:** decididas (opção 1) e implementadas na 0121.
- **Deploy:** mesclar o PR #35 exige aplicar as migrations 0110–0119. Nesta rodada, as 16 migrations (0104–0119) foram aplicadas em sequência, sem erro, sobre um banco na 0103 [S]. Os 594 testes unitários passam no branch.

---

## 9. Decisões do dono e implementação (26/09, segunda rodada)

Decisões registradas:
- **Unidade do saldo:** frasco (embalagem). O volume do frasco vem do cadastro e pode ser informado na chegada quando a embalagem vier diferente.
- **Baixa:** acontece quando alguém retira o material, em frascos inteiros. Sobras não voltam ao almoxarifado.
- **Proposta aprovada:** gera o planejamento sozinha, em rascunho. Datas, equipamentos e reserva ficam com a equipe.
- **Permissões:** "a caixinha manda" no app inteiro. A permissão de ver bloqueia o módulo inteiro (menu e rota). Salário é a única exceção: dentro do módulo, só os valores ficam ocultos.

Implementado no branch `claude/auditoria-processos-onda3`:

| Migration | O que faz | Teste |
|---|---|---|
| 0122 | Plano automático da proposta aprovada (um por proposta, aviso ao coordenador); movimentações guardam quem retirou | `plano_da_proposta_0122.sql` |
| 0123 | Compra em frascos, com o volume do frasco no item; o recebimento cria o lote no modelo do insumo, sem misturar frascos e mL; a previsão de compras converte o que está em aberto | `recebimento_frascos_0123.sql` |
| 0124 | A caixinha manda: RPCs e políticas por permissão; leitura de orçamentos e auditoria por permissão; padrões por papel iguais ao acesso anterior; valores individuais que só repetiam o padrão antigo são removidos; `minhas_permissoes()` | `permissoes_0124.sql` |

No app:
- menu e rotas obedecem às permissões de acesso, com a página "Sem acesso";
- botões e ações usam a permissão correspondente;
- o diálogo de usuário mostra a categoria mais as exceções e grava só as exceções (PER-1);
- usuários, privilégios e backups continuam só do admin, e essas três caixinhas saíram da tela;
- compra e recebimento em frascos;
- "Retirar insumos e iniciar";
- coluna "Por" no histórico do lote.

Pendências conhecidas:
- Converter os lotes antigos (por volume) em frascos exige relatório de impacto e aprovação próprios.
- Equipamentos (unidades, manutenção) continuam com escrita aberta a qualquer usuário logado; falta definir a permissão.
- O coordenador do projeto deixa de aprovar pedido interno só pelo e-mail: precisa da permissão "Aprovar pedidos internos".
