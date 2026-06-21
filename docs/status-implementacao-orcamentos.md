# Status de implementacao do plano de Orcamentos

Data: 2026-06-20

Observacao: este documento acompanha o nucleo operacional das etapas 1 a 7.
As fases ampliadas de produto, UX, historico avancado, catalogos, dashboard e
governanca fina estao detalhadas em
`docs/plano-ampliado-orcamentos-pos-nucleo.md`.

## Etapa 1 - Demanda como entrada obrigatoria

Implementado:

- A tela de detalhe da demanda passa a mostrar os modulos permitidos pela
  modalidade.
- Server Actions de gerar custo laboratorial/projeto bloqueiam modulo
  incompatível com a modalidade e retornam para a demanda.
- Actions legadas de criacao direta passam a exigir `demanda_id` e redirecionam
  para Demandas/Propostas quando chamadas sem vinculo.
- A completude da demanda agora e calculada por regra unica, considerando
  titulo, cliente, modalidade, escopo e projeto vinculado quando a modalidade
  envolve projeto.
- A tela de detalhe e a lista de Demandas/Propostas exibem se a demanda esta
  pronta ou qual percentual ainda falta.
- A geracao de modulos de custo fica bloqueada enquanto a demanda estiver
  incompleta.
- A tela de demanda enumera pendencias por etapa e percentual faltante.
- Testes automatizados cobrem bloqueio de criacao direta sem demanda e bloqueio
  de modulos incompatíveis com a modalidade ou demanda incompleta.
- Migration aditiva `0034_demanda_completude_e_guarda_orcamentos.sql` adiciona
  criterios laboratoriais minimos, snapshot de completude e triggers que
  impedem novas insercoes de orcamentos sem `demanda_id`.
- Demandas com analises agora exigem matriz/tipo de amostra e quantidade
  estimada de amostras para ficarem completas.
- A criacao e edicao de demandas persistem `completude_snapshot` e
  `completude_atualizada_em`.

Por fazer:

- Fase completa. Melhorias futuras ficam fora do escopo minimo: anexar
  documentos da proposta, detalhar multiplas matrizes por demanda e automatizar
  sugestoes de prazo por tipo de analise.

Faltante estimado: 0%.

## Etapa 2 - Custos laboratoriais independentes

Implementado:

- A demanda mostra quando custos laboratoriais sao exigidos e se ja ha itens.
- A criacao do modulo laboratorial so aparece quando a modalidade exige
  analises.
- O historico consolidado distingue custos laboratoriais de custos de projeto.
- A demanda passa a calcular status operacional dos custos laboratoriais:
  pendente, preenchido, revisado ou nao exigido.
- A etapa laboratorial so fica totalmente liberada para Parametros Economicos
  quando ha itens e o documento foi marcado como enviado ou aprovado.
- Testes automatizados cobrem a regra de status operacional de modulo.
- Migration aditiva `0038_orcamentos_laboratoriais_operacionais.sql` adiciona
  `status_operacional`, data de atualizacao e `custo_snapshot` aos orcamentos
  laboratoriais.
- A tela de detalhe do orcamento laboratorial passa a exibir preenchimento
  interno por blocos de custo: reagentes, materiais, equipamentos, mao de obra,
  terceiros, overhead e subtotais.
- O foco visual da etapa interna passa a ser o custo operacional; o preco
  preservado continua registrado para documento, historico e consolidacao.
- Server Actions de cabecalho, inclusao/remocao de itens, recalculo e
  cancelamento atualizam o status operacional e o snapshot de custos.
- O snapshot operacional e montado a partir da engine de custeio existente, sem
  calculo paralelo.
- Testes automatizados cobrem status operacional laboratorial e totais do
  snapshot por bloco de custo.

Por fazer:

- Fase completa no escopo operacional atual. Melhorias futuras: editar
  composicao fina por insumo diretamente no orcamento, anexar laudo tecnico ao
  modulo laboratorial e aprovar revisao por perfil tecnico.

Faltante estimado: 0%.

## Etapa 3 - Custos de projeto independentes

Implementado:

- A lista de Projetos deixa de oferecer criacao direta e aponta para
  Demandas/Propostas.
- O formulario de custo proprio do projeto remove `preco_unitario` da UI.
- Novos custos manuais gravam `preco_unitario` igual ao custo apenas por
  compatibilidade, mas a interface trabalha como custo.
- A consolidacao de projeto passa a usar `custo_unitario` como base dos custos
  proprios.
- A demanda passa a calcular status operacional dos custos de projeto:
  pendente, preenchido, revisado ou nao exigido.
- A etapa de projeto so fica totalmente liberada para Parametros Economicos
  quando ha itens e o documento foi marcado como enviado ou aprovado.
- Migration aditiva `0037_custos_projeto_organizacao.sql` adiciona etapa,
  atividade, entrega, categoria institucional, origem de nomenclatura e
  justificativa formal para projeto sem custo.
- A tela de detalhe do orcamento de projeto ganhou navegacao operacional para
  Escopo, Rubricas, Viagens, Anexos e Aprovacao.
- Custos proprios manuais passam a ser cadastrados com etapa, atividade,
  entrega e categoria institucional.
- Itens vindos do catalogo preservam origem de nomenclatura, distinguindo
  Kontrol, catalogo institucional e app antigo.
- A tabela de custos proprios passa a exibir organizacao por etapa, atividade,
  entrega, rubrica, categoria institucional e origem.
- A justificativa formal de projeto sem custo e persistida no orcamento de
  projeto e considerada evidência operacional na etapa de demanda.
- Templates de projeto passam a preservar os metadados operacionais dos custos.
- Testes automatizados cobrem gravacao dos metadados de custo e da justificativa
  formal de projeto sem custo.

Por fazer:

- Fase completa no escopo operacional atual. Melhorias futuras: edicao inline
  dos metadados dos custos ja cadastrados, visao kanban por entrega e workflow
  formal de aprovacao tecnico-financeira.

Faltante estimado: 0%.

## Etapa 4 - Parametros Economicos

Implementado:

- Parametros economicos do projeto ganharam bloco proprio no detalhe do
  orcamento de projeto.
- O bloco cadastral "Dados do orcamento de projeto" nao salva mais percentuais
  economicos.
- O historico `/orcamento` passa a tratar Parametros como etapa separada.
- A demanda agora bloqueia Parametros Economicos enquanto modulos exigidos
  estiverem pendentes ou apenas preenchidos, aguardando revisao.
- O salvamento de Parametros Economicos do projeto bloqueia gross-up invalido
  quando a soma de impostos, incubacao, reserva, investimentos e lucro e maior
  ou igual a 100%.
- A tela de projeto exibe o motivo quando o salvamento dos parametros
  economicos e recusado.
- Testes automatizados cobrem validacao pura do gross-up e bloqueio na Server
  Action.
- Migration aditiva `0036_parametros_economicos_versoes.sql` cria historico
  formal de versoes para parametros economicos globais e de projeto, com RLS e
  auditoria.
- O salvamento dos parametros globais do laboratorio registra snapshot
  versionado com origem `orcamento/parametros`.
- O salvamento dos parametros economicos do projeto registra snapshot
  versionado por orcamento de projeto com origem `orcamento/projetos`.
- `/orcamento/parametros` passa a ser uma experiencia consolidada para
  parametros globais, regra de gross-up de projeto e versoes recentes.
- Testes automatizados cobrem incremento de versao e snapshot dos parametros
  economicos.

Por fazer:

- Fase completa no escopo operacional atual. Melhorias futuras: comparar
  versoes lado a lado, restaurar parametros anteriores com aprovacao e aplicar
  identidade visual da referencia quando o link real for fornecido.

Faltante estimado: 0%.

## Etapa 5 - Orcamento final consolidado

Implementado:

- `/orcamento` foi reposicionado como historico/consolidacao em vez de formulario
  de criacao direta.
- A tabela consolidada removeu ambiguidade de colunas, separando "Projeto
  vinculado" de "Custos de projeto".
- A classificacao de orcamento de projeto considera a modalidade da demanda
  quando existe.
- A tela de detalhe da demanda ganhou uma secao "Orcamento final" com
  consolidacao calculada de laboratorio, projeto e parametros economicos.
- O Orcamento Final fica bloqueado quando modulos exigidos ainda nao foram
  revisados ou quando parametros economicos estao invalidos.
- O resumo mostra custo de laboratorio, preco de laboratorio, custo de projeto,
  parametros aplicados e total final.
- Testes automatizados cobrem a consolidacao final calculada.
- Migration aditiva `0033_orcamento_final_versoes.sql` cria historico de versoes
  finais emitidas por demanda, com RLS, auditoria e snapshot JSON.
- A demanda agora permite emitir uma versao final com validade, numero e totais
  preservados quando todos os bloqueios estao satisfeitos.
- Versoes anteriores emitidas da mesma demanda passam para status
  `substituido` quando uma nova versao final e emitida.
- Cada versao final emitida agora pode ser aberta em `/orcamento/final/[id]`,
  com cabecalho, cliente, escopo, composicao financeira, parametros economicos,
  origem e botao de impressao/PDF.
- A versao final exibe composicao detalhada do snapshot: analises laboratoriais,
  custos proprios do projeto e analises dentro de projeto.
- Snapshots antigos sem composicao detalhada continuam abrindo com estado vazio
  por bloco.
- A versao final emitida ganhou exportacao XLSX e DOCX com dados da demanda,
  resumo financeiro, composicao de itens e origem dos valores.
- Testes automatizados cobrem os exportadores XLSX/DOCX do Orcamento Final.

Por fazer:

- Fase completa no escopo operacional atual. Melhorias futuras: layout
  institucional final do documento, assinatura digital e pacote de anexos.

Faltante estimado: 0%.

## Etapa 6 - Historico de Orcamentos

Implementado:

- A tela `/orcamento` agora se comporta como historico operacional consolidado.
- O estado vazio foi ajustado para historico, nao para criacao direta.
- A demanda lista versoes finais emitidas com numero, versao, status, validade e
  total.
- A nova tabela `orcamento_final_versoes` preserva snapshot de emissao para
  historico e auditoria.
- Versoes finais emitidas possuem rota propria navegavel e imprimivel.
- `/orcamento/historico` passa a existir como rota explicita de Historico de
  Orcamentos.
- Migration aditiva `0039_historico_orcamentos_final.sql` adiciona status
  `vencido`, origem de duplicacao e campos de cancelamento das versoes finais.
- O carregamento do historico marca automaticamente versoes emitidas vencidas
  quando `valido_ate` fica no passado.
- A tela de historico exibe demanda relacionada, cliente, responsavel, usuario
  emissor, data de emissao, validade, status e motivo de cancelamento.
- A tela compara cada versao com a versao anterior da mesma demanda, mostrando
  diferenca absoluta e percentual.
- Versoes finais podem ser duplicadas preservando snapshot, totais e origem,
  gerando nova versao numerada.
- Versoes finais podem ser canceladas sem remover o snapshot historico.
- `/orcamento` ganhou entrada explicita para o Historico de Orcamentos e os
  indicadores da jornada foram atualizados para refletir fases concluídas.
- Testes automatizados cobrem vencimento automatico e cancelamento de versao
  final.

Por fazer:

- Fase completa no escopo operacional atual. Melhorias futuras: filtros
  avancados por responsavel/periodo, comparacao lado a lado do snapshot completo
  e trilha visual detalhada de auditoria por campo alterado.

Faltante estimado: 0%.

## Etapa 7 - Regras de validacao, auditoria e manutencao

Implementado:

- Bloqueio de modulo incompatível com modalidade nas Server Actions de demanda.
- Bloqueio de criacao direta sem demanda nas Server Actions legadas.
- Bloqueio de modulo quando a demanda nao atende os criterios minimos.
- Status operacional calculado para modulos de custo, distinguindo pendente,
  preenchido e revisado.
- Validacao server-side de gross-up invalido nos parametros economicos de
  projeto.
- Exclusao destrutiva de orcamentos enviados ou aprovados passa a ser bloqueada
  nas Server Actions de laboratorio e projeto.
- As telas de detalhe exibem aviso quando uma exclusao e recusada por status.
- Migration aditiva preserva versoes finais com trigger de auditoria e sem
  alterar tabelas antigas.
- Migration aditiva `0034_demanda_completude_e_guarda_orcamentos.sql` adiciona
  criterios laboratoriais minimos, snapshot de completude e triggers que
  impedem novas insercoes de orcamentos sem `demanda_id`.
- Migration aditiva `0035_cancelamento_orcamentos.sql` amplia status de
  orcamentos laboratoriais e de projeto para aceitar `cancelado`.
- Orcamentos enviados ou aprovados podem ser cancelados por action propria,
  preservando dados e registrando evento de status.
- As telas de detalhe mostram acao de cancelamento para documentos enviados ou
  aprovados, mantendo exclusao apenas para documentos ainda removiveis.
- Testes automatizados iniciais para modalidade, demanda obrigatoria e
  completude operacional.
- Testes automatizados cobrem cancelamento persistido de laboratorio e projeto.
- Preservacao de snapshots existentes e sem migration destrutiva.
- Calculo de projeto usa custo como base e gross-up apenas na consolidacao.
- A consolidacao final gera trilha explicita de origem/regra para cada total
  exibido.
- A tela de versao final mostra origem, regra e valor preservado para cada
  total consolidado, com fallback para snapshots antigos.
- Testes automatizados cobrem a geracao da trilha de origem no Orcamento Final.

Por fazer:

- Fase completa no escopo operacional atual. Melhorias futuras: detalhar origem
  linha a linha por item e expor comparacao entre versoes.

Faltante estimado: 0%.
