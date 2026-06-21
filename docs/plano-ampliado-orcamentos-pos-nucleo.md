# Plano ampliado de Orcamentos pos-nucleo

Data: 2026-06-21

Este plano continua a auditoria operacional da funcao Orcamentos depois do
fechamento do nucleo obrigatorio. O nucleo ja cobre demanda obrigatoria,
custos laboratoriais, custos de projeto, parametros economicos, orcamento final,
historico, validacoes, snapshots e cancelamento sem destruicao de dados.

O objetivo daqui em diante e transformar o modulo em uma experiencia completa
de produto: navegacao clara, telas menos longas, informacao organizada por
decisao operacional, historico rico, visual institucional, aprovacao externa e
governanca mais fina.

## Visao geral das fases ampliadas

| Fase | Tema | Objetivo | Faltante estimado |
| --- | --- | --- | ---: |
| 8 | Arquitetura de navegacao | Separar subareas do menu Orcamentos e reduzir ambiguidade operacional | 0% |
| 9 | Demanda em abas | Transformar a demanda em cockpit por etapas, com campos e tabelas especificas | 0% |
| 10 | Custos laboratoriais detalhados | Expandir a tela laboratorial para composicao tecnica por insumo, equipamento, mao de obra e terceiros | 0% |
| 11 | Custos de projeto detalhados | Criar visao por rubrica, etapa, atividade, entrega e periodo, com edicao organizada | 0% |
| 12 | Parametros economicos avancados | Mostrar impacto, formula, versoes, justificativa e comparacao de parametros | 0% |
| 13 | Orcamento final institucional | Refinar documento final, visual externo e pacote de exportacao/aprovacao | 0% |
| 14 | Historico avancado e comparacao | Filtros, comparacao lado a lado, auditoria visual e exportacao historica | 0% |
| 15 | Modelos e catalogos | Area propria para templates, catalogo institucional e origem do app antigo | 0% |
| 16 | Dashboard de funil | Indicadores de demandas, custos, revisao, emissao, aprovacao e vencimento | 0% |
| 17 | Governanca e permissoes finas | Perfis, aprovacao tecnica, auditoria por campo e trilhas de recalculo | 0% |

## Fase 8 - Arquitetura de navegacao

### Objetivo

Trocar a navegacao generica de Orcamentos por subareas orientadas ao trabalho.
O usuario deve saber se esta criando demanda, preenchendo custos, revisando
parametros, emitindo documento ou consultando historico.

### Status

Concluida em 2026-06-21.

Implementado:

- Menu lateral de Orcamentos ampliado com subareas do funil operacional.
- `/orcamento` virou visao geral com cards para as subareas e lista consolidada
  recente.
- Novas rotas: `/orcamento/em-elaboracao`, `/orcamento/revisao`,
  `/orcamento/emitidos`, `/orcamento/decididos` e `/orcamento/modelos`.
- A rota existente `/orcamento/historico` foi integrada como area formal do
  menu.
- Listagem consolidada centralizada em `src/lib/orcamento/orcamentos-listagem.ts`.
- Tabelas de orcamento agora exibem etapa, responsavel e filtros por esses
  campos.
- Area inicial de Modelos/Templates lista templates de projeto e catalogo
  institucional com origem preservada.
- Detecção de link ativo do menu ajustada para `/orcamento` nao marcar todas as
  subrotas como item principal ativo.

Por fazer:

- Fase completa no escopo da arquitetura de navegacao. Melhorias futuras ficam
  nas fases 9, 14, 15 e 16: abas da demanda, filtros avancados, gestao completa
  de modelos e dashboard de funil.

### Menu recomendado

No menu lateral, dentro de `Orcamentos`:

| Item | Rota sugerida | Conteudo |
| --- | --- | --- |
| Demandas/Propostas | `/orcamento/demandas` | Entrada obrigatoria e funil inicial |
| Em elaboracao | `/orcamento/em-elaboracao` | Demandas e modulos ainda pendentes |
| Prontos para revisao | `/orcamento/revisao` | Custos preenchidos e aguardando revisao/parametros |
| Emitidos/Enviados | `/orcamento/emitidos` | Orcamentos finais ativos, enviados ou aguardando aceite |
| Aprovados/Recusados | `/orcamento/decididos` | Resultado comercial ou tecnico |
| Historico de Orcamentos | `/orcamento/historico` | Versoes finais, vencidas, canceladas, substituidas |
| Parametros Economicos | `/orcamento/parametros` | Parametros globais e por projeto |
| Modelos/Templates | `/orcamento/modelos` | Templates e catalogos reutilizaveis |

### Organizacao visual

Cada subarea deve ter:

- Cabecalho curto com titulo e contador principal.
- Barra de filtros logo abaixo do cabecalho.
- Tabela operacional como conteudo principal.
- Acoes primarias no canto superior direito.
- Estados vazios com acao natural, sem textos longos.

### Tabela base para subareas

Campos comuns:

| Coluna | Tipo | Observacao |
| --- | --- | --- |
| Numero/Demanda | link | Mostra numero, titulo e modalidade |
| Cliente | texto | Nome e instituicao quando houver |
| Projeto | texto/filtro | Projeto vinculado ou `--` |
| Etapa atual | badge | Demanda, custos, parametros, final, historico |
| Status operacional | badge | Pendente, preenchido, revisado, bloqueado |
| Responsavel | texto | Responsavel interno atual |
| Atualizado em | data | Ultima mudanca relevante |
| Proxima acao | botao/link | Abrir custo, revisar, emitir, duplicar |

### Criterios de aceite

- `/orcamento` deixa de ser a unica lista generica.
- Cada item de menu tem proposito claro e rota propria.
- Nenhuma tela mistura criacao, revisao e historico sem separacao visual.
- As tabelas possuem filtros por status, modalidade, responsavel e periodo.

## Fase 9 - Demanda em abas

### Objetivo

Transformar a demanda em um cockpit operacional com abas ou segmentos fixos. A
demanda deixa de ser apenas um formulario e passa a coordenar todo o ciclo.

### Status

Concluida em 2026-06-21.

Implementado:

- Detalhe da demanda com barra fixa de segmentos para Demanda, Custos
  laboratoriais, Custos de projeto, Parametros economicos, Orcamento final e
  Historico/auditoria.
- Topo da demanda preservando titulo, modalidade, cliente, status, prioridade,
  completude e principais metadados.
- Aba de demanda com formulario existente preservado e status de completude em
  destaque.
- Aba de custos laboratoriais com estado `Nao se aplica`, resumo de valores,
  quantidade de itens e tabela de orcamentos vinculados.
- Aba de custos de projeto com estado `Nao se aplica`, resumo de custos
  proprios, analises internas, justificativa e tabela de orcamentos vinculados.
- Tabela operacional de pendencias com etapa, obrigatoriedade, status, pendencia
  e acao direta.
- Aba de parametros economicos com custos recebidos, markup, percentuais,
  valores calculados, origem e regra de formula.
- Aba de orcamento final com emissao, resumo financeiro, bloqueios e versoes
  emitidas.
- Aba de historico/auditoria com demanda, modulos vinculados e versoes finais em
  uma linha operacional preservada.

Por fazer:

- Fase completa no escopo de cockpit em abas. Melhorias mais profundas de
  detalhe tecnico ficam nas fases 10, 11, 12 e 14.

### Estrutura da tela

Topo fixo da demanda:

| Campo/area | Conteudo |
| --- | --- |
| Titulo | Nome da demanda/proposta |
| Modalidade | Somente analises, somente projeto, analises + projeto |
| Cliente | Nome, contato e instituicao |
| Status geral | Rascunho, pronta, custos, parametros, final emitido |
| Completude | Percentual e pendencias principais |
| Acoes | Salvar, gerar modulo permitido, emitir versao final |

Abas:

1. Demanda
2. Custos laboratoriais
3. Custos de projeto
4. Parametros economicos
5. Orcamento final
6. Historico e auditoria

### Aba 1 - Demanda

Caixa `Identificacao`:

| Campo | Tipo | Regra |
| --- | --- | --- |
| Titulo | input texto | Obrigatorio |
| Cliente cadastrado | select/combobox | Opcional se cliente livre preenchido |
| Cliente livre | input texto | Obrigatorio se nao houver cliente cadastrado |
| Contato | input texto | Email, telefone ou pessoa |
| Instituicao | input texto | Opcional |
| Responsavel interno | input texto/select | Recomendado |

Caixa `Classificacao`:

| Campo | Tipo | Regra |
| --- | --- | --- |
| Modalidade | segmented control | Controla abas e acoes |
| Prioridade | select | Baixa, media, alta, urgente |
| Origem | select/texto | Email, edital, cliente recorrente, interno |
| Projeto vinculado | combobox | Obrigatorio quando modalidade envolve projeto |

Caixa `Escopo inicial`:

| Campo | Tipo | Regra |
| --- | --- | --- |
| Escopo preliminar | textarea | Obrigatorio |
| Matriz/amostra | input/select | Obrigatorio quando envolve analises |
| Quantidade estimada de amostras | number | Obrigatorio quando envolve analises |
| Prazo esperado | date/texto | Opcional |
| Prazo tecnico estimado | number | Opcional |
| Observacoes | textarea | Opcional |

Caixa `Pendencias`:

Tabela:

| Coluna | Conteudo |
| --- | --- |
| Etapa | Demanda, laboratorio, projeto, parametros, final |
| Obrigatorio? | Sim/nao |
| Status | Completo, pendente, bloqueado |
| Pendencia | Texto curto |
| Acao | Link para campo ou modulo |

### Aba 2 - Custos laboratoriais

Quando modalidade nao exigir laboratorio, mostrar estado `Nao se aplica`.

Tabela resumida:

| Coluna | Conteudo |
| --- | --- |
| Orcamento lab | Link para modulo |
| Status operacional | Pendente, preenchido, revisado |
| Analises | Quantidade de analises |
| Amostras | Total de amostras |
| Custo tecnico | Subtotal interno |
| Snapshot | Data do ultimo snapshot |
| Acao | Abrir/revisar |

### Aba 3 - Custos de projeto

Tabela resumida:

| Coluna | Conteudo |
| --- | --- |
| Orcamento projeto | Link |
| Status operacional | Pendente, preenchido, revisado |
| Rubricas | PE/MC/MP/ST/VD/OU usadas |
| Entregas | Quantidade |
| Custo total | Subtotal interno |
| Justificativa custo zero | Sim/nao |
| Acao | Abrir/revisar |

### Aba 4 - Parametros economicos

Caixas:

- Custos recebidos.
- Parametros aplicados.
- Versao do parametro.
- Formula.
- Pendencias.

### Aba 5 - Orcamento final

Tabela de versoes finais:

| Coluna | Conteudo |
| --- | --- |
| Numero | Link para versao |
| Versao | v1, v2, v3 |
| Status | Emitido, substituido, vencido, cancelado |
| Validade | Data |
| Total final | Valor |
| Acao | Abrir, duplicar, cancelar |

### Aba 6 - Historico e auditoria

Tabela:

| Coluna | Conteudo |
| --- | --- |
| Data | Quando ocorreu |
| Tipo | Status, parametro, custo, emissao, cancelamento |
| Responsavel | Usuario/perfil |
| Origem | Action/tela |
| Antes | Valor anterior resumido |
| Depois | Valor novo resumido |
| Observacao | Motivo |

### Criterios de aceite

- Demanda mostra somente abas aplicaveis a modalidade.
- Cada pendencia tem acao clara.
- O usuario consegue entender o que falta sem abrir todas as telas.
- Historico da demanda mostra versoes finais e eventos principais.

## Fase 10 - Custos laboratoriais detalhados

### Objetivo

Expandir a tela de laboratorio para composicao tecnica auditavel. A tela atual
ja separa custo operacional do preco, mas ainda nao permite inspecionar e
editar a composicao fina por item.

### Status

Concluida em 2026-06-21.

Implementado:

- Detalhe de orçamento laboratorial com navegação interna por Identificação,
  Análises, Composição, Totais, Revisão e Histórico.
- Cabeçalho enriquecido com orçamento/status, demanda vinculada, cliente,
  matriz/amostra, responsável, projeto e data do snapshot de custo.
- Tela ampliada para leitura técnica em largura operacional, mantendo a página
  como Server Component.
- Tabela de análises e quantidades com código, nome, matriz, lote, amostras,
  reagentes, equipamentos, mão de obra, overhead, custo e origem do snapshot.
- Preço final deixou de ser foco da tabela técnica e ficou preservado no resumo
  operacional/documento.
- Caixa de composição técnica com origem, regra e subtotal para reagentes,
  materiais, equipamentos, mão de obra, terceiros e overhead.
- Caixa de revisão técnica com pendências explícitas para cliente, responsável,
  itens e recalculo quando parâmetros mudam.
- Histórico da tela recebeu âncora própria para ficar integrado à navegação.

Por fazer:

- Fase completa no escopo de inspeção técnica auditável sem alterações
  estruturais de banco. Edição fina por componente individual e auditoria por
  campo ficam nas fases 14 e 17.

### Estrutura da tela

Cabecalho:

| Campo | Conteudo |
| --- | --- |
| Orcamento lab | Numero e status |
| Demanda | Link |
| Cliente | Nome |
| Matriz/amostra | Vem da demanda |
| Responsavel tecnico | Campo ou usuario |
| Snapshot de custo | Data/hora |

Caixa `Identificacao tecnica`:

| Campo | Tipo |
| --- | --- |
| Protocolo/metodo | select/texto |
| Matriz | select/texto |
| Unidade de cobranca tecnica | select |
| Responsavel tecnico | select/texto |
| Observacao tecnica | textarea |

Caixa `Analises e quantidades`:

Tabela:

| Coluna | Conteudo |
| --- | --- |
| Analise | Codigo e nome |
| Matriz | Texto |
| Amostras | Numero |
| Repeticoes | Numero |
| Perdas/controles | Numero |
| Quantidade tecnica final | Calculada |
| Custo/amostra | Valor |
| Subtotal custo | Valor |
| Origem | Snapshot atual/recalculado |
| Acao | Remover, recalcular linha |

Caixa `Insumos e reagentes`:

Tabela por analise:

| Coluna | Conteudo |
| --- | --- |
| Analise | Codigo |
| Etapa | Preparo, PCR, sequenciamento etc. |
| Atividade | Nome da atividade |
| Insumo/reagente | Especificacao |
| Lote opcional | Lote quando definido |
| Qtd/amostra | Numero |
| Unidade | Unidade |
| Custo unitario | Valor |
| Modo cobranca | Por amostra/por execucao |
| Subtotal | Valor |
| Origem | Cadastro, estoque, ajuste manual |

Caixa `Materiais de consumo`:

Tabela:

| Coluna | Conteudo |
| --- | --- |
| Material | Nome |
| Categoria | Plastico, descartavel, limpeza, outro |
| Quantidade | Numero |
| Unidade | Unidade |
| Custo unitario | Valor |
| Subtotal | Valor |
| Origem | Insumo, manual, catalogo |

Caixa `Equipamentos`:

Tabela:

| Coluna | Conteudo |
| --- | --- |
| Equipamento | Nome |
| Etapa | Etapa da analise |
| Tempo/uso | Horas ou fracao |
| Regra de rateio | Por dia, por amostra, por execucao |
| Custo diario/hora | Valor |
| Peso alocacao | Percentual |
| Subtotal alocado | Valor |

Caixa `Mao de obra tecnica`:

Tabela:

| Coluna | Conteudo |
| --- | --- |
| Perfil/tecnico | Nome ou perfil |
| Etapa | Etapa |
| Horas bancada | Numero |
| Custo hora | Valor |
| Percentual dedicado | Percentual |
| Subtotal | Valor |

Caixa `Terceiros laboratoriais`:

Tabela:

| Coluna | Conteudo |
| --- | --- |
| Fornecedor/servico | Texto |
| Analise/etapa | Texto |
| Quantidade | Numero |
| Custo unitario | Valor |
| Subtotal | Valor |
| Comprovante | Anexo opcional |

Caixa `Totais tecnicos`:

| Campo | Conteudo |
| --- | --- |
| Reagentes | Soma |
| Materiais | Soma |
| Equipamentos | Soma |
| Mao de obra | Soma |
| Terceiros | Soma |
| Overhead tecnico | Soma |
| Custo total laboratorio | Soma |

### Acoes

- Adicionar analise.
- Recalcular snapshots.
- Recalcular apenas linha.
- Marcar como revisado.
- Cancelar modulo.
- Gerar planejamento quando aprovado.

### Criterios de aceite

- Nenhum preco final aparece como foco da tela tecnica.
- Cada subtotal tem origem e regra.
- Recalculo e acao explicita.
- Snapshot anterior nao e sobrescrito sem registro.

## Fase 11 - Custos de projeto detalhados

### Objetivo

Evoluir a tela de projeto de uma pagina longa para uma interface de trabalho
por rubrica, etapa, atividade e entrega.

### Status

Concluida em 2026-06-21.

Implementado:

- Detalhe de orçamento de projeto com navegação interna por Escopo, Entregas,
  Rubricas, Etapas, Viagens, Anexos, Revisão e Aprovação.
- Topo enriquecido com demanda vinculada, projeto, cliente, coordenador,
  responsável, status, data e totais de custo/gross-up.
- Leitura por entregas com atividades, rubricas, quantidade de itens e custo
  associado.
- Leitura por etapas/atividades com entregas, rubricas e total por etapa.
- Tabela de custos próprios expandida com rubrica, categoria institucional,
  etapa, atividade, entrega, descrição, quantidade, unidade, custo unitário,
  subtotal, origem e ação.
- Caixa de revisão operacional com pendências explícitas antes da alteração de
  parâmetros econômicos.
- Âncoras e nomes corrigidos: catálogo institucional, modelos, anexos, revisão,
  viagens, escopo e aprovação agora apontam para as áreas corretas.
- Uso normal da tela deixou de chamar o catálogo de `antigo`, preservando a
  origem antiga apenas como informação auditável na tabela.

Por fazer:

- Fase completa no escopo de organização detalhada de custos de projeto.
  Edição inline, versionamento visual avançado e auditoria por campo ficam nas
  fases 12, 14 e 17.

### Estrutura de tela

Topo:

| Campo | Conteudo |
| --- | --- |
| Titulo do projeto | Texto |
| Demanda | Link |
| Cliente | Texto |
| Coordenador | Texto |
| Responsavel | Texto |
| Status operacional | Badge |
| Custo total | Valor interno |

Navegacao interna:

- Escopo
- Entregas
- Rubricas
- Etapas/atividades
- Viagens
- Anexos
- Revisao

### Aba `Escopo`

Caixas:

`Identificacao`

| Campo | Tipo |
| --- | --- |
| Numero | input |
| Titulo | input |
| Projeto vinculado | combobox |
| Cliente | combobox/texto |
| Coordenador | input/select |
| Responsavel | input/select |

`Escopo e cronograma`

| Campo | Tipo |
| --- | --- |
| Objetivo | textarea |
| Escopo | textarea |
| Fora de escopo | textarea |
| Cronograma narrativo | textarea |
| Premissas | textarea |
| Restricoes | textarea |

### Aba `Entregas`

Tabela:

| Coluna | Conteudo |
| --- | --- |
| Entrega | Nome |
| Descricao | Texto curto |
| Marco | Data/periodo |
| Responsavel | Pessoa |
| Status | Planejada, em custo, revisada |
| Custo associado | Soma |
| Acao | Editar |

### Aba `Rubricas`

Tabela principal:

| Coluna | Conteudo |
| --- | --- |
| Rubrica | PE, MC, MP, ST, VD, OU |
| Categoria institucional | Pessoal, Material de consumo etc. |
| Descricao | Item |
| Etapa | Etapa |
| Atividade | Atividade |
| Entrega | Entrega vinculada |
| Periodo | Meses ou datas |
| Quantidade | Numero |
| Unidade | Unidade |
| Custo unitario | Valor |
| Subtotal | Valor |
| Origem | Manual, catalogo, template, app antigo |
| Acao | Editar/remover |

Subtotais:

| Caixa | Conteudo |
| --- | --- |
| PE | Total pessoal |
| MC | Total material consumo |
| MP | Total material permanente |
| ST | Total terceiros |
| VD | Total viagem/diarias |
| OU | Outros |
| Total projeto | Soma |

### Aba `Etapas/atividades`

Tabela agrupada por etapa:

| Coluna | Conteudo |
| --- | --- |
| Etapa | Nome |
| Atividade | Nome |
| Entrega | Nome |
| Periodo | Inicio/fim ou mes |
| Responsavel | Pessoa |
| Rubricas associadas | Lista |
| Custo | Soma |

### Aba `Viagens`

Caixa de parametros:

| Campo | Tipo |
| --- | --- |
| Pessoas | number |
| Dias de campo | number |
| Fator de risco | number |
| Hospedagens | number |
| Quartos | number |
| Veiculos | number |
| Distancia | number |
| Consumo | number |
| Pedagios | number |
| Passagens | number |

Tabela de linhas geradas:

| Coluna | Conteudo |
| --- | --- |
| Despesa | Alimentacao, hospedagem, combustivel etc. |
| Regra | Formula |
| Quantidade calculada | Numero |
| Custo unitario | Valor |
| Subtotal | Valor |

### Aba `Revisao`

Caixas:

- Pendencias.
- Justificativa de custo zero.
- Status operacional.
- Aprovacao tecnica.
- Ultimo snapshot.

### Criterios de aceite

- Projeto nao mostra lucro/impostos/fundos como parte dos custos.
- Todo item tem rubrica, etapa, atividade, entrega e origem.
- Subtotais por rubrica e etapa conferem com total.
- Itens de catalogo antigo aparecem como catalogo institucional com origem
  preservada.

## Fase 12 - Parametros economicos avancados

### Objetivo

Transformar parametros em uma tela de decisao financeira auditavel, com entrada
de custos, parametros aplicados, formula, impacto e versoes.

### Status

Concluida em 2026-06-21.

Implementado:

- `/orcamento/parametros` passou a funcionar como cockpit financeiro consolidado
  de custos recebidos, parametros aplicados, formula, validacao e versoes.
- Cabecalho e cards principais agora destacam fator economico total, dias
  uteis, impacto de laboratorio e impacto de projeto.
- Caixa `Custos recebidos` separa laboratorio, projeto e consolidado, com
  quantidade de analises/orcamentos considerados.
- Caixa `Formula e validacao` explicita markup simples de laboratorio e gross-up
  de projeto, com bases antes/depois e alerta para gross-up invalido.
- Tabela de impacto dos parametros globais mostra campo, valor, unidade, origem,
  versao e impacto financeiro estimado sobre o custo medio laboratorial.
- Tabela de impacto dos parametros de projeto soma os impactos dos orcamentos
  recentes e apresenta percentual medio por parametro.
- Tabela de orcamentos de projeto considerados mostra cliente, itens, custo,
  gross-up, total e validacao com link direto para cada orcamento.
- Versionamento recente passou a exibir escopo, versao, projeto/global, origem,
  data e resumo do payload salvo no snapshot.
- A tela preserva o formulario existente de parametros globais e continua usando
  o versionamento formal em `parametros_economicos_versoes`.

Por fazer:

- Fase completa no escopo de decisao financeira auditavel sem criar estrutura
  paralela. Comparacao lado a lado entre duas versoes e restauracao com
  confirmacao ficam para a Fase 14/17, pois exigem fluxo proprio de auditoria e
  permissao sensivel.

### Layout

Coluna esquerda: custos recebidos.

Caixas:

| Caixa | Campos |
| --- | --- |
| Laboratorio | Custo, preco tecnico preservado, quantidade de analises |
| Projeto | Custo por rubrica, custo por etapa, custo total |
| Consolidado | Subtotal de custos, modulos considerados, pendencias |

Coluna direita: parametros.

Tabela:

| Campo | Valor | Unidade | Origem | Versao | Impacto |
| --- | ---: | --- | --- | --- | ---: |
| Impostos | % | percentual | global/projeto | vN | R$ |
| Taxas | % | percentual | global | vN | R$ |
| Incubacao | % | percentual | projeto | vN | R$ |
| Reserva | % | percentual | projeto | vN | R$ |
| Investimentos | % | percentual | projeto | vN | R$ |
| Lucro/margem | % | percentual | global/projeto | vN | R$ |

Caixa `Formula`:

| Campo | Conteudo |
| --- | --- |
| Metodo | Markup simples/gross-up |
| Base | Subtotal de custos |
| Formula | Texto calculado |
| Validacao | Soma percentual, fator, bloqueios |
| Resultado | Preco final |

Caixa `Versionamento`:

Tabela:

| Coluna | Conteudo |
| --- | --- |
| Versao | Numero |
| Escopo | Global/projeto |
| Criado em | Data |
| Usuario | Pessoa |
| Origem | Tela/action |
| Justificativa | Texto |
| Acao | Comparar/restaurar |

### Criterios de aceite

- Parametros mostram impacto financeiro.
- Gross-up invalido bloqueia salvamento.
- Toda versao tem usuario/data/origem.
- Restaurar versao exige confirmacao e cria nova versao.

## Fase 13 - Orcamento final institucional

### Objetivo

Refinar o documento final para ser uma proposta institucional completa, com
visual de cliente e opcoes de ocultar custos internos.

### Status

Concluida em 2026-06-21.

Implementado:

- `/orcamento/final/[id]` passou a abrir primeiro como proposta comercial
  institucional, com faixa de identidade ATGC, numero, versao, status, cliente,
  emissao, validade, escopo, total e composicao comercial.
- A composicao comercial de cliente consolida itens do snapshot por grupo,
  descricao, quantidade, unidade e subtotal, sem exibir custo interno.
- Custos, parametros, composicao detalhada, origens de valor e snapshot ficaram
  separados em `Modo interno`, fora da area principal de impressao.
- O detalhe final ganhou acoes diretas de imprimir/PDF, exportar DOCX/XLSX,
  voltar a demanda, duplicar versao e cancelar versao.
- Exportacao XLSX ganhou aba `Proposta Cliente`, preservando tambem abas de
  resumo, itens internos e origem dos valores.
- Exportacao DOCX foi reorganizada como documento comercial: cabecalho,
  emissao, validade, cliente, escopo, composicao comercial, condicoes e resumo
  interno.
- Os dados exportados agora carregam emitido em, validade em dias, responsavel e
  condicoes comerciais.

Por fazer:

- Fase completa no escopo de documento institucional e pacote de exportacao.
  Link publico dedicado para versao final permanece como evolucao de governanca
  da Fase 17; hoje o app ja possui aprovacao externa por link no orcamento de
  projeto.

### Estrutura do documento

Cabecalho:

| Campo | Conteudo |
| --- | --- |
| Logo/instituicao | Identidade visual |
| Numero | OF-AAAA-ID-vN |
| Versao | vN |
| Status | Emitido/aprovado/vencido |
| Data emissao | Data |
| Validade | Data |

Blocos:

1. Dados do cliente.
2. Dados da demanda.
3. Escopo resumido.
4. Entregas.
5. Composicao comercial.
6. Condicoes comerciais.
7. Prazos.
8. Observacoes.
9. Responsavel e aprovacao.

Tabela de composicao comercial:

| Coluna | Conteudo |
| --- | --- |
| Grupo | Laboratorio, projeto, viagem, terceiros |
| Descricao | Texto aprovado |
| Quantidade | Numero |
| Unidade | Unidade |
| Valor unitario | Opcional conforme perfil |
| Subtotal | Valor |

Modo interno:

- Mostra custo, regra, parametro, origem.

Modo cliente:

- Oculta custo interno.
- Mostra apenas preco aprovado e condicoes.

### Acoes

- Imprimir/PDF.
- Exportar DOCX.
- Exportar XLSX.
- Gerar link de aprovacao.
- Duplicar.
- Criar nova versao.
- Cancelar.
- Enviar por email futuramente.

### Criterios de aceite

- Documento e legivel para cliente.
- Custos internos podem ser ocultados.
- Exportacoes preservam numero, versao e totais.
- Link publico tem validade, status e trilha de aceite.

## Fase 14 - Historico avancado e comparacao

### Objetivo

Evoluir o historico atual para consulta executiva e auditoria comparativa.

### Status

Concluida em 2026-06-21.

Implementado:

- `/orcamento/historico` ganhou filtros reais por status, cliente, responsavel,
  modalidade, periodo de emissao, periodo de validade e faixa de valor.
- Cards principais agora respondem ao conjunto filtrado: emitidos ativos,
  vencidos, cancelados e total filtrado.
- Tabela historica foi ampliada com numero, versao, demanda, cliente,
  modalidade, responsavel, criado em, enviado em, aprovado em, validade, status,
  custo total, parametros, preco final, delta e acoes.
- Cada linha mostra delta financeiro e percentual contra a versao anterior da
  mesma demanda.
- Comparacao lado a lado via `?comparar=ID`, exibindo cabecalho, status, datas,
  itens laboratoriais, itens de projeto, parametros, total e deltas de
  laboratorio, projeto, total e markup.
- Exportacao historica em CSV criada em `/orcamento/historico/export`, respeitando
  os mesmos filtros da tela.
- Acoes de abrir, duplicar, comparar e cancelar permanecem acessiveis na tabela,
  preservando snapshot e trilha historica.

Por fazer:

- Fase completa no escopo de historico executivo, comparacao visual e exportacao
  filtrada. Auditoria por campo com antes/depois detalhado fica para a Fase 17,
  onde entram regras finas de permissao e eventos sensiveis.

### Filtros

| Filtro | Tipo |
| --- | --- |
| Periodo de emissao | date range |
| Periodo de validade | date range |
| Status | multi-select |
| Cliente | combobox |
| Projeto | combobox |
| Responsavel | combobox |
| Modalidade | multi-select |
| Faixa de valor | min/max |

### Tabela

| Coluna | Conteudo |
| --- | --- |
| Numero | Link |
| Versao | Numero |
| Demanda | Link |
| Cliente | Texto |
| Projeto | Texto |
| Modalidade | Badge |
| Responsavel | Texto |
| Criado em | Data |
| Enviado em | Data |
| Aprovado em | Data |
| Validade | Data |
| Status | Badge |
| Custo total | Valor |
| Parametros | Resumo |
| Preco final | Valor |
| Delta vs anterior | Valor/% |
| Acoes | Abrir, duplicar, comparar, exportar |

### Comparacao lado a lado

Tela/modal:

| Secao | Conteudo comparado |
| --- | --- |
| Cabecalho | numero, versao, datas, status |
| Custos laboratorio | linhas adicionadas/removidas/alteradas |
| Custos projeto | rubricas e etapas alteradas |
| Parametros | percentuais alterados |
| Totais | custo, preco, delta |
| Observacoes | texto alterado |

### Criterios de aceite

- Historico possui filtros reais.
- Comparacao mostra diferencas por bloco.
- Exportacao historica respeita filtros.
- Auditoria visual mostra quem alterou e quando.

## Fase 15 - Modelos e catalogos

### Objetivo

Criar area propria para templates e catalogo institucional, reduzindo a
dependencia visual do "catalogo antigo".

### Status

Concluida em 2026-06-21.

Implementado:

- `/orcamento/modelos` virou area operacional com navegacao interna para
  Templates, Catalogo institucional, Parametros padrao e Origem importada.
- Tela ganhou filtros por busca, rubrica, origem e status, aplicados a templates
  e itens de catalogo.
- Cards principais mostram templates ativos, templates arquivados, itens ativos
  e itens com origem importada.
- Tabela de templates passou a exibir nome, descricao, origem, quantidade de
  itens, resumo de parametros, criado em, status e acoes.
- Templates podem ser usados para criar novo orcamento de projeto, inclusive
  vinculando a um projeto existente.
- Templates podem ser duplicados sem alterar o original.
- Arquivar template deixou de apagar registro: a action `excluirTemplate` agora
  marca o registro como arquivado por metadado no nome/descricao e preserva o
  historico.
- Tabela de catalogo institucional passou a exibir codigo, rubrica, categoria,
  descricao, unidade, custo padrao, origem, validade, ativo e acao.
- Itens de catalogo podem ser arquivados com `ativo=false`, sem remocao fisica.
- A origem `orcamento_projetos_antigo` aparece apenas como procedencia
  auditavel (`Importada`), enquanto o uso normal permanece como catalogo
  institucional.
- Bloco de parametros padrao resume medias salvas nos templates ativos.
- Bloco de origem importada mostra a distribuicao dos itens importados por
  rubrica.

Por fazer:

- Fase completa no escopo de produto para modelos e catalogos. Edicao completa
  de item/template em formulario dedicado fica para a governanca fina da Fase
  17, pois envolve permissoes administrativas e auditoria por campo.

### Tela `/orcamento/modelos`

Abas:

- Templates de projeto.
- Catalogo institucional.
- Parametros padrao.
- Importados do app antigo.

Tabela de templates:

| Coluna | Conteudo |
| --- | --- |
| Nome | Link |
| Descricao | Texto |
| Origem | Kontrol/app antigo |
| Itens | Quantidade |
| Parametros | Resumo |
| Criado em | Data |
| Acao | Usar, duplicar, arquivar |

Tabela de catalogo:

| Coluna | Conteudo |
| --- | --- |
| Codigo | ID |
| Rubrica | PE/MC/MP/ST/VD/OU |
| Categoria institucional | Texto |
| Descricao | Texto |
| Unidade | Unidade |
| Custo padrao | Valor |
| Origem | Kontrol/app antigo |
| Valido desde | Data |
| Ativo | Sim/nao |
| Acao | Editar, arquivar |

### Criterios de aceite

- UI deixa de chamar o uso normal de "catalogo antigo".
- Origem antiga continua auditavel.
- Templates podem ser aplicados a uma demanda/projeto.
- Arquivar nao apaga historico.

## Fase 16 - Dashboard de funil

### Objetivo

Dar visao executiva da operacao de orcamentos.

### Status

Concluida em 2026-06-21.

Implementado:

- `/orcamento` foi transformado em dashboard operacional de funil, mantendo a
  lista consolidada e as subareas existentes.
- Filtro de periodo por 15, 30, 60 e 90 dias para os indicadores temporais.
- Cards principais com Demandas novas, Custos pendentes, Aguardando parametros,
  Prontos para emissao, Emitidos, Aprovados, Vencidos e Receita potencial.
- Cards linkam para as areas operacionais correspondentes.
- Grafico de funil por etapa com Demanda, Custos, Parametros, Final e Aprovado.
- Grafico/lista de valor por status, conferindo com a listagem consolidada.
- Tempo medio por etapa calculado em dias desde a ultima atualizacao.
- Top clientes por valor monitorado.
- Distribuicao por modalidade.
- Tabelas de acao para demandas paradas ha mais de 7 dias, orcamentos vencendo
  em ate 30 dias, custos aguardando revisao e parametros pendentes/antigos.
- Lista consolidada recente permanece na parte inferior para acao direta.

Por fazer:

- Fase completa no escopo de dashboard executivo e operacional. Automacoes,
  alertas proativos e SLA formal por perfil ficam para a Fase 17, junto com
  governanca fina e permissoes.

### Cards principais

| Card | Conteudo |
| --- | --- |
| Demandas novas | Quantidade no periodo |
| Custos pendentes | Demandas aguardando laboratorio/projeto |
| Aguardando parametros | Custos revisados sem parametros |
| Prontos para emissao | Orcamentos finais possiveis |
| Emitidos | Versoes emitidas |
| Aprovados | Aprovados no periodo |
| Vencidos | Validade expirada |
| Receita potencial | Soma dos emitidos ativos |

### Graficos

| Grafico | Dimensao |
| --- | --- |
| Funil por etapa | Demanda -> custos -> parametros -> final -> aprovado |
| Valor por status | Emitido, aprovado, vencido, cancelado |
| Tempo medio por etapa | Dias |
| Top clientes | Valor/quantidade |
| Modalidade | Analises, projeto, ambos |

### Tabelas de acao

- Demandas paradas ha mais de X dias.
- Orcamentos vencendo em 15/30 dias.
- Custos preenchidos aguardando revisao.
- Parametros invalidos ou antigos.

### Criterios de aceite

- Dashboard orienta proximas acoes.
- Periodo pode ser filtrado.
- Cards linkam para listas filtradas.
- Valores conferem com historico.

## Fase 17 - Governanca e permissoes finas

### Objetivo

Adicionar controle mais forte sobre revisao, recalculo, aprovacao tecnica e
alteracoes sensiveis.

### Status

Concluida em 2026-06-21.

Implementado:

- Helper central `src/lib/orcamento/governanca.ts` com matriz de acoes,
  papel minimo, motivo obrigatorio e evidencia auditavel.
- Acoes sensiveis de laboratorio passaram a exigir papel em mudanca para
  enviado/aprovado/cancelado, recalculo de documento ja emitido/aprovado e
  cancelamento.
- Recalculo laboratorial passou a registrar evento em `eventos_status`, com
  motivo obrigatorio quando o documento ja esta enviado, aprovado ou cancelado.
- Parametros economicos globais exigem papel gestor e continuam criando nova
  versao formal, agora tambem com evento de governanca.
- Orcamentos de projeto passaram a registrar mudancas de status e a exigir
  papel para revisao, cancelamento e edicao de parametros economicos.
- Templates e catalogo institucional passaram a exigir papel gestor para
  duplicar/arquivar, preservando a estrategia sem exclusao fisica.
- Emissao, duplicacao e cancelamento de versoes finais passaram a exigir papel
  adequado e registrar evento auditavel.
- Nova pagina `/orcamento/governanca` com matriz operacional, resumo de acoes
  governadas, eventos sensiveis e auditoria por campo das tabelas de
  Orcamentos.
- Menu lateral e dashboard de Orcamentos receberam entrada direta para
  Governanca.

Por fazer:

- Fase completa no escopo de permissoes finas aplicadas na camada do app,
  eventos sensiveis e leitura operacional de auditoria. Melhorias futuras
  possiveis: workflow formal de aprovacao em duas assinaturas, SLA por perfil,
  notificacoes automaticas e tela administrativa para editar a matriz de
  permissoes sem deploy.

### Perfis sugeridos

| Perfil | Pode |
| --- | --- |
| Solicitante | Criar demanda e acompanhar |
| Tecnico laboratorio | Preencher/revisar custos laboratoriais |
| Coordenador projeto | Preencher/revisar custos de projeto |
| Financeiro | Editar parametros economicos |
| Coordenador | Emitir orcamento final, cancelar, duplicar |
| Administrador | Gerenciar catalogos, templates e permissoes |

### Eventos auditaveis

| Evento | Dados |
| --- | --- |
| Mudanca de status | antes/depois, usuario, motivo |
| Recalculo | parametros antigos/novos, usuario |
| Emissao final | snapshot, numero, versao |
| Duplicacao | origem, destino |
| Cancelamento | motivo, usuario |
| Alteracao de parametro | versao anterior/nova |
| Alteracao de custo | campo, antes/depois |

### Regras

- Recalculo apos emissao exige motivo.
- Alteracao de parametro cria nova versao.
- Cancelamento exige motivo.
- Edicao de custo revisado exige reabrir revisao.
- Emissao final exige modulos revisados.

### Criterios de aceite

- Cada acao sensivel tem usuario, data e motivo quando aplicavel.
- Perfis impedem alteracao indevida.
- Auditoria consegue reconstruir o caminho de um valor final.

## Priorizacao recomendada

### Proxima onda: usabilidade operacional

1. Fase 8 - Arquitetura de navegacao.
2. Fase 9 - Demanda em abas.
3. Fase 11 - Custos de projeto detalhados.
4. Fase 10 - Custos laboratoriais detalhados.

### Segunda onda: documento e historico

1. Fase 13 - Orcamento final institucional.
2. Fase 14 - Historico avancado e comparacao.
3. Fase 15 - Modelos e catalogos.

### Terceira onda: gestao e governanca

1. Fase 12 - Parametros economicos avancados.
2. Fase 16 - Dashboard de funil.
3. Fase 17 - Governanca e permissoes finas.

## Marcadores de progresso

| Camada | Status atual |
| --- | --- |
| Nucleo obrigatorio | Completo no escopo atual |
| UX operacional ampliada | Pendente |
| Visual institucional | Pendente |
| Historico comparativo avancado | Parcial |
| Templates/catalogos como produto | Parcial |
| Dashboard executivo | Pendente |
| Governanca fina por perfil | Pendente |

## Observacao final

Este plano nao contradiz o status de implementacao atual. Ele separa duas
coisas:

- o nucleo operacional minimo, que esta fechado no escopo atual;
- a camada ampliada de produto, UX, governanca e relatorios, que ainda precisa
ser executada em fases novas.
