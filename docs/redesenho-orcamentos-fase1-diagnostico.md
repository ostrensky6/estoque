# Redesenho de Orcamentos - Fase 1: diagnostico tecnico-financeiro

Data: 2026-06-21

## 1. Objetivo

Este diagnostico cumpre a Fase 1 do plano de redesenho do modulo Orcamentos:
explicar como o Kontrol calcula custos, parametros economicos e total final
antes de avancar para alteracoes de UI ou fluxo.

O foco e financeiro. A pergunta principal nao e se o sistema consegue guardar
orcamentos, mas se ele consegue formar precos rigorosos, auditaveis e sem dupla
incidencia.

## 2. Escopo verificado

Arquivos e estruturas relevantes:

- `src/lib/costing/engine.ts`
- `src/lib/project-budget/legacy.ts`
- `src/lib/orcamento/orcamento-final.ts`
- `src/lib/actions/orcamentos.ts`
- `src/lib/actions/orcamento-projetos.ts`
- `src/lib/orcamento/parametros-versionamento.ts`
- `supabase/migrations/0007_orcamentos.sql`
- `supabase/migrations/0010_orcamento_projetos.sql`
- `supabase/migrations/0033_orcamento_final_versoes.sql`
- `supabase/migrations/0036_parametros_economicos_versoes.sql`
- `supabase/migrations/0038_orcamentos_laboratoriais_operacionais.sql`
- `docs/plano-redesenho-orcamentos-engine-custeio.md`
- `docs/migracao-orcamento-projetos-protocolo.md`

## 3. Achado central

Existem dois motores financeiros conceitualmente divergentes:

1. Laboratorio usa markup simples.
2. Projeto usa gross-up.

No laboratorio, a engine calcula preco como:

```text
preco = custoTotal * (1 + soma_percentual)
```

Essa regra esta em `src/lib/costing/engine.ts`, dentro de `calcularAnalise`.

No projeto, a engine legada calcula total como:

```text
grossTotal = subtotal / (1 - soma_percentual)
```

Essa regra esta em `src/lib/project-budget/legacy.ts`, dentro de
`calcularOrcamentoProjetoLegacy`.

As duas formulas podem ser validas em contextos diferentes, mas hoje nao existe
um contrato unico que declare explicitamente quando usar `MARKUP`, quando usar
`GROSS_UP`, qual base recebe cada fator e se o laboratorio ja entra como custo
tecnico ou preco formado.

Consequencia:

- risco de totais divergentes;
- risco de comparacoes incorretas entre laboratorio e projeto;
- risco de dupla incidencia em orcamentos mistos;
- dificuldade de explicar a memoria financeira do orcamento final;
- ausencia de um total final autoritativo unico para o novo fluxo.

## 4. Entregavel 1 - mapa do fluxo atual de orcamento laboratorial

Fluxo observado:

```text
analises / insumos / equipamentos / tecnicos / overhead
-> src/lib/costing/engine.ts
-> calcularAnalise
-> custoAnalitico
-> overhead
-> custoTotal
-> markup simples com margem, impostos, taxas e fundos
-> preco
-> orcamento laboratorial / itens / snapshots
```

Pontos positivos:

- engine pura;
- separacao de etapas, insumos, equipamentos e pessoal;
- calculo de depreciao/manutencao de equipamentos;
- testes unitarios existentes;
- snapshots operacionais recentes.

Fragilidades:

- parametros economicos entram na propria engine laboratorial;
- laboratorio mistura custo e preco cedo demais;
- markup e o unico metodo expressivo no contrato atual;
- nao ha base de incidencia por fator;
- nao ha declaracao de como esse preco se comporta quando incorporado ao
  projeto.

## 5. Entregavel 2 - mapa do fluxo atual de orcamento de projeto

Fluxo observado:

```text
orcamento_projetos
-> orcamento_projeto_custos
-> orcamento_projeto_analises
-> src/lib/project-budget/legacy.ts
-> calcularOrcamentoProjetoLegacy
-> subtotal
-> gross-up com impostos, incubacao, reserva, investimentos e lucro
-> grossTotal
```

Pontos positivos:

- gross-up invalido ja e bloqueado quando soma percentual >= 100%;
- custos de projeto foram reposicionados como custos, nao preco final;
- ha organizacao por rubricas/categorias;
- ha versionamento de parametros economicos.

Fragilidades:

- projeto usa motor financeiro diferente do laboratorio;
- analises dentro do projeto podem chegar como preco ja formado;
- nao ha contrato explicito de anti-dupla-incidencia;
- total final do projeto pode nao ser semanticamente comparavel ao total
  laboratorial;
- parametros economicos de projeto ainda precisam ser consumidos dentro de uma
  etapa unica de orcamento final.

## 6. Entregavel 3 - mapa da engine de custeio existente

A engine laboratorial atual calcula:

- gargalo por execucoes/dia e amostras/execucao;
- horas de bancada por amostra;
- insumos selecionados por grupo;
- reagentes por amostra ou por execucao;
- custo de equipamento por dia;
- rateio de equipamento por amostra;
- pessoal por hora de bancada;
- overhead por hora de bancada;
- custo analitico;
- custo total;
- preco com markup.

A engine e boa como ponto de partida, mas deve ser reposicionada:

```text
engine.ts deve formar custo tecnico laboratorial.
pricing.ts deve aplicar parametros economicos ao orcamento.
```

Essa separacao evita que laboratorio e projeto usem regras financeiras
implcitas e diferentes.

## 7. Entregavel 4 - comparacao com o app antigo `orcamento-projetos`

O protocolo exige comparacao completa antes de migracao funcional.

Neste diagnostico financeiro preliminar, o ponto a preservar do app antigo e a
nocao de composicao de projeto por custos e parametros proprios. O ponto a
corrigir no Kontrol e que essa composicao nao pode se tornar um segundo motor
concorrente ao laboratorio.

Antes de migrar dados ou substituir rotas, ainda e obrigatorio entregar:

- quadro comparativo de funcionalidades;
- mapa de tabelas;
- mapa de campos;
- parametros antigos;
- categorias antigas;
- regras de calculo antigas;
- risco de perda de dados.

Sem isso, a migracao continua bloqueada pelo protocolo.

## 8. Entregavel 5 - regras financeiras implementadas

Regras ja existentes:

1. Laboratorio calcula custo tecnico a partir de insumos, equipamentos, pessoal
   e overhead.
2. Laboratorio aplica markup simples.
3. Projeto calcula subtotal por itens/rubricas.
4. Projeto aplica gross-up.
5. Projeto bloqueia gross-up com soma percentual maior ou igual a 100%.
6. Parametros economicos possuem versionamento.
7. Orcamento final possui snapshots de versoes emitidas.
8. Orcamentos emitidos ou aprovados possuem protecoes contra exclusao
   destrutiva.

## 9. Entregavel 6 - regras financeiras ausentes

Regras ausentes ou insuficientes:

1. Metodo financeiro unico e explicito por orcamento: `MARKUP` ou `GROSS_UP`.
2. Base de incidencia por parametro.
3. Regra formal anti-dupla-incidencia.
4. Declaracao do laboratorio como `CUSTO_TECNICO` ou `PRECO_JA_FORMADO`.
5. Snapshot unico de parametros aplicados ao orcamento final.
6. Total final autoritativo unico recalculado server-side.
7. Separacao completa entre custo tecnico e preco comercial.
8. Parametros economicos como etapa operacional dentro do fluxo.
9. Memoria de calculo consolidada para laboratorio + projeto.
10. UI que mostre na mesma tela custo de entrada, parametros e total final.

## 10. Entregavel 7 - calculos duplicados ou conflitantes

Conflitos confirmados:

| Area | Formula | Risco |
| --- | --- | --- |
| Laboratorio | `custo * (1 + soma%)` | Markup simples |
| Projeto | `subtotal / (1 - soma%)` | Gross-up |
| Orcamento misto | Laboratorio pode entrar como preco e projeto aplicar parametros | Dupla incidencia |
| Parametros globais e de projeto | Estruturas separadas | Snapshots e totais podem divergir |

Conclusao:

```text
E necessario um motor de pricing unico para aplicar parametros economicos.
```

## 11. Entregavel 8 - risco de dupla margem ou duplo imposto

Risco confirmado no caminho conceitual:

```text
analise laboratorial
-> preco laboratorial com margem/impostos
-> entra no projeto como item de analise
-> projeto aplica gross-up sobre subtotal
-> margem/impostos podem incidir novamente
```

Isso pode ser desejado em casos comerciais especificos, mas deve ser uma
escolha explicita, nao comportamento implicito.

Regra recomendada:

```text
Se laboratorio entrar como PRECO_JA_FORMADO, parametros economicos nao incidem
novamente sobre ele por padrao.
```

Para permitir incidencia deliberada, o sistema deve exigir declaracao explicita
e preservar isso no snapshot.

## 12. Entregavel 9 - pontos onde preco aparece antes da etapa economica

Pontos sensiveis:

- `calcularAnalise` retorna `preco`, nao apenas custo tecnico;
- itens laboratoriais podem preservar preco unitario;
- analises vinculadas ao projeto podem carregar valor ja formado;
- o projeto historicamente usou `preco_unitario`, embora a UI tenha sido
  ajustada para custo;
- parametros de projeto e laboratorio ainda nao convergem em uma etapa unica
  operacional de aplicacao.

Diretriz:

```text
O custo tecnico deve nascer nos modulos de laboratorio/projeto.
O preco comercial deve nascer na etapa de Parametros Economicos.
```

## 13. Entregavel 10 - pontos onde totais podem vir da interface

Risco a verificar nas proximas fases:

- actions que recebem totais calculados no navegador;
- formularios que persistem subtotal/preco sem recalculo server-side;
- exportadores que leem snapshots sem validar origem;
- orcamento final que consolida totais de origens diferentes sem contrato
  unico.

Regra para as proximas fases:

```text
O navegador pode exibir pre-calculo, mas o servidor deve recalcular e persistir
o total autoritativo.
```

## 14. Correcao tecnica iniciada nesta fase

Foi criada a engine pura:

```text
src/lib/costing/pricing.ts
```

Ela introduz:

- `aplicarParametrosEconomicos`;
- metodo explicito `MARKUP` ou `GROSS_UP`;
- base de incidencia por fator:
  - `APENAS_LABORATORIO`;
  - `APENAS_PROJETO`;
  - `TODOS_COMPONENTES`;
  - `VALOR_FIXO`;
  - `NAO_APLICAVEL`;
- laboratorio como `CUSTO_TECNICO` ou `PRECO_JA_FORMADO`;
- anti-dupla-incidencia por padrao;
- opcao explicita de incidencia deliberada sobre laboratorio ja precificado;
- bloqueio de gross-up maior ou igual a 100%;
- snapshot dos parametros aplicados.

Tambem foi criada a migration aditiva:

```text
supabase/migrations/0040_orcamento_parametros_aplicados.sql
```

Ela cria a tabela operacional para armazenar os parametros aplicados ao
orcamento, com:

- `numeric` para valores monetarios;
- snapshots JSONB;
- RLS;
- grant para `service_role`;
- trigger de auditoria.

## 15. Estado de autonomia

Este diagnostico e a engine pura podem ser implementados localmente sem aplicar
migration em producao.

As proximas fases dependem da tabela `orcamento_parametros_aplicados` existir no
banco de destino.

Antes de aplicar a migration em producao, seguir o ritual obrigatorio:

1. backup logico;
2. relatorio de impacto;
3. plano de rollback;
4. aplicacao da migration;
5. validacao pos-migration;
6. somente entao wiring de UI e Server Actions.

## 16. Conclusao

O modulo ja tem elementos bons, mas o diagnostico confirma que o problema
principal e financeiro:

```text
Nao havia um contrato unico para transformar custo tecnico em preco final.
```

A criacao de `pricing.ts` e da migration `0040` resolve a base tecnica para as
proximas fases, sem alterar dados existentes e sem construir UI sobre uma tabela
ainda nao aplicada.

