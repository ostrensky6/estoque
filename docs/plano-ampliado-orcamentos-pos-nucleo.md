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
| 8 | Arquitetura de navegacao | Separar subareas do menu Orcamentos e reduzir ambiguidade operacional | 80% |
| 9 | Demanda em abas | Transformar a demanda em cockpit por etapas, com campos e tabelas especificas | 70% |
| 10 | Custos laboratoriais detalhados | Expandir a tela laboratorial para composicao tecnica por insumo, equipamento, mao de obra e terceiros | 65% |
| 11 | Custos de projeto detalhados | Criar visao por rubrica, etapa, atividade, entrega e periodo, com edicao organizada | 55% |
| 12 | Parametros economicos avancados | Mostrar impacto, formula, versoes, justificativa e comparacao de parametros | 60% |
| 13 | Orcamento final institucional | Refinar documento final, visual externo e pacote de exportacao/aprovacao | 60% |
| 14 | Historico avancado e comparacao | Filtros, comparacao lado a lado, auditoria visual e exportacao historica | 55% |
| 15 | Modelos e catalogos | Area propria para templates, catalogo institucional e origem do app antigo | 50% |
| 16 | Dashboard de funil | Indicadores de demandas, custos, revisao, emissao, aprovacao e vencimento | 75% |
| 17 | Governanca e permissoes finas | Perfis, aprovacao tecnica, auditoria por campo e trilhas de recalculo | 65% |

## Fase 8 - Arquitetura de navegacao

### Objetivo

Trocar a navegacao generica de Orcamentos por subareas orientadas ao trabalho.
O usuario deve saber se esta criando demanda, preenchendo custos, revisando
parametros, emitindo documento ou consultando historico.

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
