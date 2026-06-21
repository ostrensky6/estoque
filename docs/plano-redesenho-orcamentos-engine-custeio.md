# Plano de redesenho do modulo Orcamentos

Data: 2026-06-21

## 1. Decisao central

O modulo Orcamentos do Kontrol deve ser redesenhado como uma engine de
custeio e formacao de preco, com rastreabilidade comercial como camada
posterior.

O objetivo principal nao e apenas guardar, classificar e acompanhar
orcamentos. O objetivo principal e formar orcamentos tecnicamente precisos,
financeiramente defensaveis e auditaveis.

Diretriz aprovada para o redesenho:

```text
Demanda / oportunidade
-> custeio tecnico laboratorial
-> custeio proprio de projeto, se houver
-> parametros economicos aplicados ao orcamento
-> orcamento final
-> emissao, aprovacao, historico e auditoria
```

Historico, status, aprovacoes, duplicacao, dashboards e rastreamento sao
importantes, mas nao podem ser o centro funcional do modulo. Eles devem nascer
como consequencia de um orcamento corretamente calculado.

## 2. Problema atual

O modulo atual ficou forte como deposito e controle de orcamentos, mas ainda
nao esta suficientemente centrado na formacao rigorosa do custo e do preco.

O problema nao e existir controle de orcamentos antigos, status, historico,
aprovacao ou rastreabilidade. Esses recursos sao desejaveis.

O problema e eles terem se tornado o foco principal antes da consolidacao da
engine de custeio.

O modulo precisa responder, com memoria de calculo:

- quanto custa executar cada analise laboratorial;
- quais insumos, materiais e reagentes entram no custo;
- qual consumo por amostra foi considerado;
- qual equipamento foi usado;
- qual depreciacao foi aplicada;
- qual manutencao foi considerada;
- qual tempo de maquina e bancada foi usado;
- qual custo de pessoal foi alocado;
- qual overhead tecnico foi aplicado;
- qual custo proprio de projeto foi somado, quando houver;
- quais parametros economicos transformaram custo em preco;
- qual valor final foi emitido ao cliente.

Sem essas respostas, o modulo pode estar bem organizado, mas nao cumpre o papel
principal de formar orcamentos precisos.

## 3. O que deve ser preservado

O redesenho nao deve descartar o que esta correto. Devem ser preservados e
aproveitados:

1. Demandas/Propostas como entrada comercial.
2. Clientes, projetos e cadastros existentes.
3. Snapshots de custo, preco, parametros e documentos emitidos.
4. Historico de orcamentos, versoes, status e auditoria.
5. Integracao com estoque, planejamento, compras e governanca.
6. Parametros economicos globais ja existentes.
7. Base tecnica de custeio laboratorial ja existente.
8. Testes automatizados existentes.
9. Migrations ja aplicadas, sem sobrescrita destrutiva.
10. Protocolo de migracao do app antigo de orcamento de projetos.

Nada deve ser removido sem diagnostico, justificativa tecnica, plano de
rollback e validacao.

## 4. Regra obrigatoria de migracao e seguranca

Qualquer alteracao ligada a importacao, migracao, adaptacao ou substituicao de
funcionalidades do app antigo `orcamento-projetos` deve seguir o protocolo:

```text
docs/migracao-orcamento-projetos-protocolo.md
```

Antes de alteracoes estruturais, entregar:

- diagnostico do app antigo;
- diagnostico do Kontrol atual;
- mapa comparativo de funcionalidades;
- mapa comparativo de tabelas;
- mapa de campos equivalentes;
- funcionalidades em risco de perda;
- dados em risco de perda;
- proposta de arquitetura final;
- proposta de rotas;
- proposta de migrations;
- plano de migracao;
- plano de rollback;
- criterios de validacao;
- ordem incremental de implementacao.

Ficam proibidos, salvo plano formal aprovado:

- `DROP TABLE`;
- `TRUNCATE`;
- remocao de colunas com dados;
- remocao de RLS;
- remocao de triggers de auditoria;
- sobrescrita de migrations antigas;
- apagamento de parametros economicos;
- apagamento de clientes, projetos, categorias ou orcamentos existentes.

## 5. Modelo funcional desejado

O orcamento deve ser um unico agregado comercial:

```text
Orcamento
├── Identificacao obrigatoria
├── Classificacao / componentes
├── Custeio laboratorial opcional
├── Custeio de projeto opcional
├── Parametros economicos aplicados
├── Orcamento final
└── Historico, emissao, aprovacao e auditoria
```

As combinacoes validas sao:

| Tipo derivado | Laboratorio | Projeto |
| --- | --- | --- |
| Laboratorial | Sim | Nao |
| Projeto | Nao | Sim |
| Misto | Sim | Sim |

O tipo do orcamento deve ser derivado dos componentes selecionados, nao da rota
nem da tabela escolhida pelo usuario.

O usuario deve iniciar sempre por:

```text
Novo orcamento
```

e nao por:

```text
Novo orcamento laboratorial
Novo orcamento de projeto
```

## 6. Fluxo operacional obrigatorio

O fluxo deve ser unico, sequencial e visivel:

```text
1. Identificacao da proposta
2. Classificacao do orcamento
3. Custo laboratorial, se houver
4. Custo de projeto, se houver
5. Parametros economicos
6. Orcamento final
7. Emissao, aprovacao e historico
```

### 6.1 Identificacao da proposta

Campos esperados:

- cliente;
- contato;
- titulo;
- descricao ou escopo inicial;
- data;
- validade;
- responsavel;
- demanda/proposta vinculada, quando aplicavel;
- projeto operacional vinculado, quando ja existir;
- observacoes iniciais.

### 6.2 Classificacao do orcamento

O usuario deve selecionar:

```text
[ ] Inclui analises laboratoriais
[ ] Inclui projeto
```

Pelo menos uma opcao deve ser obrigatoria.

A selecao controla quais etapas seguintes aparecem e quais validacoes serao
exigidas.

### 6.3 Custo laboratorial

Esta e a etapa central do modulo.

O sistema deve calcular o custo tecnico das analises com rigor, incluindo:

- analise;
- matriz ou tipo de amostra;
- numero de amostras;
- lote ou tamanho de corrida;
- repeticoes;
- perdas;
- controles;
- branco;
- calibracao, quando aplicavel;
- insumos;
- reagentes;
- materiais de consumo;
- consumo por amostra;
- modo de cobranca por amostra ou por execucao;
- equipamentos utilizados;
- tempo de maquina;
- tempo de bancada;
- depreciacao de equipamento;
- manutencao de equipamento;
- pessoal tecnico;
- horas de trabalho;
- custo-hora;
- terceiros laboratoriais;
- overhead tecnico;
- custo total por analise;
- custo total por amostra;
- custo total do bloco laboratorial.

O resultado desta etapa deve ser uma memoria de calculo auditavel.

Nao devem ser tratados aqui como entrada principal:

- impostos;
- margem;
- lucro;
- fundo de reserva;
- fundo de investimento;
- preco final ao cliente.

Esses itens pertencem a etapa de Parametros Economicos.

### 6.4 Custo de projeto

Quando houver componente de projeto, o sistema deve registrar custos proprios
do projeto, como:

- escopo;
- entregas;
- cronograma;
- etapas;
- atividades;
- responsaveis;
- mao de obra de projeto;
- deslocamento;
- viagens;
- diarias;
- materiais;
- equipamentos;
- servicos de terceiros;
- custos administrativos especificos;
- outros custos diretos ou indiretos do projeto.

O projeto deve aceitar dois modos de precificacao operacional:

| Modo | Uso |
| --- | --- |
| Valor global | Quando o projeto sera apresentado como valor unico |
| Composicao detalhada | Quando o preco nasce de itens internos de custo |

Mesmo no modo valor global, o sistema deve preservar escopo, entregas,
cronograma, justificativa e snapshot.

### 6.5 Parametros economicos

Parametros Economicos nao devem ser um modulo isolado de uso operacional.

Eles devem ser uma etapa do fluxo de formacao do orcamento final.

Existem dois conceitos diferentes:

| Conceito | Papel |
| --- | --- |
| Configuracao de parametros economicos | Cadastro administrativo de valores padrao institucionais |
| Aplicacao de parametros economicos | Uso desses parametros dentro de um orcamento especifico |

A configuracao global pode existir em area administrativa.

A aplicacao dos parametros deve acontecer dentro do fluxo do orcamento, depois
dos custos laboratoriais e de projeto, e antes do orcamento final.

Esta etapa deve:

1. Receber automaticamente os subtotais de laboratorio e projeto.
2. Permitir editar ou confirmar percentuais e valores aplicaveis.
3. Mostrar a formula usada.
4. Mostrar o valor em reais de cada parametro.
5. Mostrar o total final do orcamento na mesma tela.
6. Gerar snapshot dos parametros aplicados.
7. Bloquear emissao se os parametros estiverem ausentes ou invalidos.
8. Preservar versoes anteriores.
9. Exigir nova versao quando houver recalculo apos emissao.

Parametros esperados:

- impostos;
- taxas;
- margem ou lucro;
- fundo de reserva;
- fundo de investimento;
- overhead institucional;
- descontos;
- acrescimos;
- metodo de calculo: markup simples ou gross-up;
- base de incidencia de cada fator.

Cada parametro deve declarar sua base:

| Base | Significado |
| --- | --- |
| APENAS_LABORATORIO | Incide somente sobre o componente laboratorial |
| APENAS_PROJETO | Incide somente sobre custos proprios de projeto |
| TODOS_COMPONENTES | Incide sobre laboratorio e projeto |
| VALOR_FIXO | Valor absoluto |
| NAO_APLICAVEL | Parametro preservado, mas nao aplicado |

### 6.6 Orcamento final

O Orcamento Final deve ser a consequencia direta das etapas anteriores.

Ele deve reunir:

- identificacao;
- cliente;
- escopo;
- classificacao;
- resumo laboratorial, se houver;
- resumo de projeto, se houver;
- parametros economicos aplicados;
- valor final;
- condicoes comerciais;
- validade;
- responsavel;
- versao;
- status;
- snapshot.

O documento final entregue ao cliente nao deve expor custo interno, margem
interna, depreciacao, manutencao, custo de pessoal ou composicao confidencial,
salvo quando houver decisao explicita de proposta aberta.

## 7. Regra financeira contra dupla incidencia

O sistema deve impedir dupla aplicacao inadvertida de margem, impostos ou
fundos.

Quando o laboratorio for incorporado a um projeto, deve ficar explicito se o
valor laboratorial entra como:

1. custo tecnico laboratorial;
2. preco laboratorial ja formado;
3. componente com parametros economicos proprios;
4. componente de pacote global.

Regra padrao recomendada:

```text
Subtotal laboratorio = valor laboratorial calculado conforme regra propria
Subtotal projeto = custos proprios do projeto
Parametros economicos = aplicados conforme base declarada
Total final = subtotal laboratorio + subtotal projeto + ajustes explicitos
```

Nenhuma margem, imposto ou taxa deve incidir novamente sobre laboratorio ja
precificado sem selecao deliberada do usuario e registro no snapshot.

## 8. Regras de layout e experiencia

### 8.1 Parametros Economicos dentro do fluxo

A etapa Parametros Economicos deve aparecer dentro do orcamento, imediatamente
antes do Orcamento Final.

Ela nao deve obrigar o usuario a sair do fluxo para uma tela isolada e depois
procurar o resultado final em outro lugar.

Layout recomendado para telas grandes:

```text
┌──────────────────────────────────────────────────────────────────┐
│ Parametros Economicos                                             │
│ Aplicados ao orcamento atual                                      │
├──────────────────────┬────────────────────────┬──────────────────┤
│ Base de calculo       │ Parametros editaveis   │ Resultado final  │
│                      │                        │                  │
│ Custo laboratorio     │ Impostos               │ Total calculado  │
│ Custo projeto         │ Taxas                  │ Receita liquida  │
│ Subtotal custos       │ Margem/lucro           │ Valor impostos   │
│ Ajustes existentes    │ Fundos                 │ Valor margem     │
│                      │ Metodo de calculo       │                  │
└──────────────────────┴────────────────────────┴──────────────────┘
```

Esta etapa deve usar melhor o espaco de tela. Nao deve apresentar apenas duas
colunas dispersas para poucos campos numericos.

Blocos minimos:

1. Entrada consolidada de custos.
2. Parametros editaveis.
3. Resultado calculado.
4. Memoria de calculo.
5. Snapshot e versao.
6. Avisos de validacao.

O total final do orcamento deve estar sempre visivel ou facilmente acessivel
durante a aplicacao dos parametros.

### 8.2 Linguagem visual global: azul e preto

O Kontrol deve adotar uma linguagem visual global para diferenciar entrada do
usuario e resultado do sistema.

Regra obrigatoria:

```text
Azul = dado inserido, escolhido ou editavel pelo usuario
Preto/neutro = dado calculado, derivado, fixo, bloqueado ou snapshotado
```

Essa regra deve ser aplicada no aplicativo inteiro, incluindo:

- Orcamentos;
- Custeio;
- Parametros;
- Estoque;
- Compras;
- Planejamento;
- Cadastros;
- Governanca, quando houver formularios.

#### Exemplos de dados em azul

- cliente selecionado;
- titulo da proposta;
- validade;
- quantidade de amostras;
- escolha de analise;
- matriz ou tipo de amostra;
- escopo;
- entregas;
- quantidade de itens de projeto;
- custo manual informado;
- percentual de imposto ajustavel;
- margem ajustavel;
- taxa ajustavel;
- observacoes;
- condicoes comerciais.

#### Exemplos de dados em preto/neutro

- subtotal de analise;
- custo de equipamento rateado;
- depreciacao calculada;
- manutencao calculada;
- custo de pessoal calculado;
- subtotal laboratorio;
- subtotal projeto;
- imposto calculado em reais;
- margem calculada em reais;
- total final;
- numero do orcamento gerado;
- status;
- versao;
- data de emissao;
- valores vindos de snapshot bloqueado.

Campos calculados nao devem parecer inputs editaveis.

Campos editaveis nao devem parecer texto estatico.

O usuario deve aprender rapidamente:

```text
Azul e onde eu ajo.
Preto e o que o sistema calcula, deriva ou preserva.
```

## 9. Modelo de dados conceitual recomendado

### 9.1 Cabecalho unico

```text
orcamentos
---------
id
numero
revisao
demanda_id
cliente_id
cliente_nome_snapshot
cnpj_snapshot
contato_snapshot
projeto_id nullable
titulo
descricao
data_emissao
validade_ate
responsavel_id
status
moeda
observacoes
criado_por
criado_em
atualizado_em
```

### 9.2 Componentes

```text
orcamento_componentes
---------------------
orcamento_id
tipo -- LABORATORIO | PROJETO
status_operacional
snapshot
atualizado_em
```

Restricao:

```text
unique (orcamento_id, tipo)
```

O tipo exibido e derivado:

```text
{LABORATORIO}          -> LABORATORIAL
{PROJETO}              -> PROJETO
{LABORATORIO, PROJETO} -> MISTO
```

### 9.3 Custeio laboratorial

O custeio laboratorial deve preservar memoria de calculo por analise e por
orcamento.

Entidades conceituais:

```text
orcamento_laboratorio_itens
orcamento_laboratorio_insumos
orcamento_laboratorio_materiais
orcamento_laboratorio_equipamentos
orcamento_laboratorio_pessoal
orcamento_laboratorio_terceiros
orcamento_laboratorio_overhead
orcamento_laboratorio_snapshots
```

Campos minimos por item de analise:

```text
id
orcamento_id
analise_id
codigo_snapshot
descricao_snapshot
matriz_snapshot
numero_amostras
lote_amostras
repeticoes
perdas
controles
custo_reagentes
custo_materiais
custo_equipamentos
custo_manutencao
custo_depreciacao
custo_pessoal
custo_terceiros
overhead_tecnico
custo_total
custo_por_amostra
snapshot_memoria_calculo
```

### 9.4 Custeio de projeto

```text
orcamento_projeto
-----------------
orcamento_id
modo_precificacao -- GLOBAL | DETALHADO
escopo
entregas
cronograma
valor_global
justificativa_valor_global
snapshot
```

```text
orcamento_projeto_itens
-----------------------
id
orcamento_id
categoria
etapa
atividade
entrega
descricao
quantidade
unidade
custo_unitario
subtotal
origem
visivel_ao_cliente
snapshot
```

### 9.5 Parametros economicos aplicados

```text
orcamento_parametros_aplicados
------------------------------
id
orcamento_id
versao
origem_parametros
metodo_calculo -- MARKUP | GROSS_UP
subtotal_laboratorio
subtotal_projeto
subtotal_custos
impostos_percentual
impostos_valor
taxas_percentual
taxas_valor
margem_percentual
margem_valor
fundo_reserva_percentual
fundo_reserva_valor
fundo_investimento_percentual
fundo_investimento_valor
descontos_valor
acrescimos_valor
total_final
formula_snapshot
parametros_snapshot
criado_por
criado_em
```

### 9.6 Orcamento final emitido

```text
orcamento_final_versoes
-----------------------
id
orcamento_id
numero
versao
status
total_final
valido_ate
emitido_por
emitido_em
snapshot_completo
documento_snapshot
origem_duplicacao_id nullable
cancelado_em nullable
cancelado_por nullable
motivo_cancelamento nullable
```

## 10. Regras de integridade obrigatorias

1. Todo orcamento deve possuir pelo menos um componente.
2. Laboratorio exige pelo menos uma analise valida.
3. Projeto exige valor global ou composicao detalhada.
4. Numero de amostras so e obrigatorio para itens laboratoriais.
5. Projeto sem laboratorio nao deve exigir amostras.
6. Parametros economicos sao obrigatorios antes da emissao.
7. Gross-up deve bloquear soma percentual maior ou igual a 100%.
8. Totais devem ser recalculados no servidor.
9. O navegador nunca deve ser fonte definitiva de total.
10. Orcamento emitido nao pode ser alterado diretamente.
11. Alteracao posterior a emissao gera nova versao.
12. Documento emitido usa snapshots, nao cadastros vivos.
13. Campos ocultos ou componentes desmarcados nao participam do calculo.
14. Remover componente preenchido exige confirmacao explicita.
15. Orcamento emitido ou aprovado nao pode ser apagado fisicamente.
16. Cancelamento deve preservar snapshot e motivo.
17. Valores monetarios devem usar `NUMERIC`/`DECIMAL`, nunca float.
18. RLS, permissoes e auditoria devem ser preservadas.

## 11. Ordem incremental de execucao

### Fase 0 - Congelar evolucao do deposito

Suspender prioridade de:

- dashboards;
- funis avancados;
- automacoes;
- historico visual sofisticado;
- filtros secundarios;
- melhorias esteticas isoladas;
- novas telas de acompanhamento.

Priorizar:

- engine de custeio;
- regras financeiras;
- parametros economicos dentro do fluxo;
- orcamento final;
- snapshots;
- testes de calculo.

### Fase 1 - Diagnostico tecnico-financeiro

Entregar:

1. Mapa do fluxo atual de orcamento laboratorial.
2. Mapa do fluxo atual de orcamento de projeto.
3. Mapa da engine de custeio existente.
4. Comparacao com o app antigo `orcamento-projetos`.
5. Lista de regras financeiras implementadas.
6. Lista de regras financeiras ausentes.
7. Lista de calculos duplicados ou conflitantes.
8. Risco de dupla margem ou duplo imposto.
9. Pontos onde preco aparece antes da etapa economica.
10. Pontos onde totais podem vir da interface.

Criterio de aceite:

```text
Deve ser possivel explicar, linha por linha, como o sistema calcula custo
laboratorial, custo de projeto, parametros economicos e total final.
```

### Fase 2 - Redefinir o fluxo unico de orcamento

Implementar ou ajustar:

- um unico ponto de entrada: Novo orcamento;
- identificacao obrigatoria;
- classificacao por componentes;
- laboratorio opcional;
- projeto opcional;
- parametros economicos dentro do fluxo;
- orcamento final como consequencia.

### Fase 3 - Fortalecer a engine laboratorial

Recentrar o modulo em:

- insumos;
- materiais;
- reagentes;
- consumo por amostra;
- equipamento;
- depreciacao;
- manutencao;
- tempo de maquina;
- tempo de bancada;
- pessoal;
- terceiros;
- overhead;
- memoria de calculo.

Criterio de aceite:

```text
Cada analise orcada deve possuir memoria de calculo completa e recalculo
server-side.
```

### Fase 4 - Separar custo, preco e documento

Regra:

```text
Custo nao e preco.
Preco nao e documento.
Documento nao e historico.
```

Implementar separacao visual, conceitual e tecnica:

- custo tecnico em laboratorio/projeto;
- preco na etapa de parametros economicos;
- documento na etapa de orcamento final;
- historico apos emissao.

### Fase 5 - Reposicionar Parametros Economicos

Transformar Parametros Economicos em etapa operacional do orcamento.

Manter area administrativa apenas para configuracao global e versoes padrao.

A etapa operacional deve exibir na mesma tela:

- custos de entrada;
- parametros editaveis;
- memoria de calculo;
- resultado final;
- snapshot.

### Fase 6 - Ajustar projeto como componente

Projeto nao deve concorrer com laboratorio.

Projeto deve:

- aceitar valor global;
- aceitar composicao detalhada;
- incorporar laboratorio quando houver;
- nao reaplicar margem/imposto automaticamente sobre laboratorio ja precificado;
- preservar escopo, entregas, cronograma e snapshot.

### Fase 7 - Reposicionar historico e rastreamento

Historico deve ser consulta e rastreabilidade, nao fluxo principal de criacao.

Deve permitir:

- buscar orcamentos emitidos;
- ver versoes;
- ver aprovados, recusados, vencidos e cancelados;
- duplicar;
- comparar valores;
- abrir snapshot;
- verificar auditoria.

### Fase 8 - Migrar sem perda

Executar apenas depois de diagnostico aprovado.

Estrategia:

1. Manter tabelas antigas.
2. Criar estruturas novas de forma aditiva.
3. Criar adaptadores ou views temporarias.
4. Migrar parametros e configuracoes.
5. Migrar orcamentos laboratoriais.
6. Migrar orcamentos de projeto.
7. Classificar orcamentos mistos.
8. Preservar snapshots e documentos.
9. Validar totais antes e depois.
10. Desativar criacao por rotas antigas apenas ao final.

## 12. Testes obrigatorios

| Cenario | Resultado obrigatorio |
| --- | --- |
| Uma analise com insumos, equipamento e pessoal | Custo tecnico reproduzivel |
| Mudanca no numero de amostras | Custo por amostra recalculado corretamente |
| Equipamento com depreciacao | Custo rateado aparece na memoria |
| Equipamento com manutencao | Manutencao aparece na memoria |
| Laboratorio sem projeto | Gera orcamento final sozinho |
| Projeto sem laboratorio | Nao exige amostra |
| Projeto com laboratorio | Incorpora laboratorio sem dupla margem automatica |
| Projeto por valor global | Permite formar orcamento sem detalhar todos os itens |
| Projeto detalhado | Soma itens de custo corretamente |
| Parametro economico alterado | Orcamento emitido antigo nao muda |
| Total adulterado no navegador | Servidor ignora e recalcula |
| Documento do cliente | Nao mostra custo interno |
| Orcamento emitido alterado | Gera nova versao |
| Orcamento aprovado | Nao pode ser apagado fisicamente |
| Gross-up invalido | Sistema bloqueia |
| Remover componente preenchido | Exige confirmacao |
| Usuario sem permissao | Backend nega alteracao |

## 13. Criterios de aceite do redesenho

O redesenho so deve ser considerado aprovado quando:

1. O usuario inicia por um unico fluxo de Novo Orcamento.
2. A classificacao laboratorio/projeto deriva dos componentes selecionados.
3. Laboratorio sozinho gera orcamento final completo.
4. Projeto sozinho gera orcamento final sem exigir amostras.
5. Laboratorio + projeto gera orcamento misto com componentes separados.
6. O custo laboratorial possui memoria de calculo tecnica.
7. Equipamento, depreciacao, manutencao e pessoal entram no custo laboratorial.
8. Parametros Economicos aparecem dentro do fluxo do orcamento.
9. O valor final aparece na mesma etapa em que os parametros sao aplicados.
10. A tela de Parametros usa layout denso, claro e adequado a telas grandes.
11. Dados editaveis aparecem em azul.
12. Dados calculados, fixos ou snapshotados aparecem em preto/neutro.
13. Totais sao sempre recalculados no servidor.
14. Snapshots preservam orcamentos emitidos.
15. Documento do cliente nao revela custo interno indevido.
16. Historico existe, mas nao domina o fluxo de criacao.
17. Migracao preserva dados, status, permissoes, RLS e auditoria.
18. Testes financeiros cobrem os cenarios criticos.

## 14. Frases-guia para implementacao

Estas frases devem orientar qualquer IA, dev ou agente que implemente o plano:

```text
O modulo Orcamentos nao e um deposito de propostas.
Ele e uma engine de custeio, formacao de preco e emissao auditavel.
```

```text
Parametros Economicos nao sao uma tela solta.
Eles sao a etapa que transforma custos tecnicos em valor final de orcamento.
```

```text
Azul e entrada do usuario.
Preto/neutro e calculo, derivacao, bloqueio ou snapshot.
```

```text
Historico e rastreabilidade sao consequencias de um orcamento bem calculado,
nao o centro do modulo.
```

```text
Nenhum dado historico deve ser perdido, recalculado silenciosamente ou apagado
para acomodar o novo modelo.
```

