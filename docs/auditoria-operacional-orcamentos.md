# Auditoria operacional da funcao Orcamentos

Data: 2026-06-20

Escopo auditado: aplicativo Kontrol local em `http://localhost:3000`, rotas de
orcamento, actions, migrations e documentos existentes. O link do aplicativo e
o site externo de referencia para Parametros Economicos vieram como
placeholders no pedido; portanto, a comparacao visual externa nao foi
executada. As recomendacoes de Parametros Economicos usam como base o app
antigo ja diagnosticado em `docs/migracao-orcamento-projetos-diagnostico-preliminar.md`.

## 1. Diagnostico do fluxo atual

O Kontrol ja tem uma base conceitual boa: Demandas/Propostas, orcamento de
analises, orcamento de projetos e parametros economicos. A arquitetura tambem
respeita parte do protocolo de migracao: tabelas aditivas, catalogo antigo,
templates, links publicos, anexos, auditoria e snapshots de custo/preco.

O problema principal e operacional: a tela e as regras ainda nao conduzem o
usuario por etapas obrigatorias. A demanda existe, mas nao bloqueia nem guia os
modulos seguintes. O usuario consegue criar orcamentos diretamente em
`/orcamento` ou `/orcamento/projetos`, contornando a Etapa 1.

Falhas observadas:

- `/orcamento` tem titulo "Analises/Lab.", mas tambem cria "So projeto" e
  "Analises + projeto". O botao diz "Novo custo de analise" mesmo quando a
  selecao cria projeto.
- A lista consolidada de `/orcamento` mistura orcamentos de analises e projetos,
  mas nao e apresentada como "Historico de Orcamentos" nem como "Orcamento
  final".
- Na tabela de `/orcamento`, ha duas colunas chamadas "Projeto": uma representa
  projeto vinculado e outra representa custos de projeto.
- Demandas permitem selecionar modalidade, mas a tela de detalhe sempre oferece
  "Analises/Lab." e "Custos de projeto", sem depender da modalidade.
- Orcamentos de projeto possuem custos, analises, parametros economicos, viagens,
  anexos, aprovacao, templates e dados cadastrais na mesma pagina vertical.
- Parametros economicos laboratoriais vivem em `/orcamento/parametros`, mas
  parametros de projeto ficam dentro do formulario "Dados do orcamento de
  projeto".
- No projeto, o formulario de custo proprio possui `custo_unitario` e
  `preco_unitario`. Isso contradiz a regra solicitada: os modulos de levantamento
  deveriam registrar custos, nao preco final.
- Nao ha uma etapa unica de consolidacao que valide "todos os modulos exigidos
  pela demanda foram preenchidos".
- Historico/versionamento ainda e parcial. Existem listas, status, templates,
  links e auditoria, mas nao ha uma area explicita "Historico de Orcamentos" com
  versoes, duplicacao, validade e situacao consolidada.

## 2. Fluxo operacional proposto

Fluxo padrao:

1. Demanda/Proposta
   - Cliente, contato, projeto vinculado, escopo, prazo, responsavel e
     modalidade.
   - Modalidades aceitas: somente analises laboratoriais; somente projeto;
     analises laboratoriais e projeto.
   - A modalidade define os proximos modulos habilitados.

2. Levantamento de custos
   - Laboratorio: apenas analises, insumos, reagentes, materiais, equipamentos,
     mao de obra tecnica, terceiros laboratoriais e custo total da analise.
   - Projeto: apenas custos proprios do projeto, por rubrica/categoria/etapa,
     sem taxas, impostos, lucro ou fundos.
   - Quando a demanda tiver ambos, os dois modulos devem ficar independentes e
     com status proprio.

3. Parametros Economicos
   - Recebe os custos consolidados dos modulos anteriores.
   - Aplica impostos, taxas, incubacao, reserva, investimentos, lucro/margem e
     demais percentuais institucionais.
   - Deve explicitar formula, base de calculo, gross-up ou markup simples,
     origem dos parametros e snapshot usado.

4. Orcamento Final
   - Documento consolidado, pronto para revisao, impressao, exportacao, link de
     aprovacao e envio.
   - Deve mostrar o resumo do preco e manter a composicao detalhada auditavel.

5. Historico de Orcamentos
   - Consulta separada de orcamentos e versoes anteriores.
   - Deve permitir busca, filtros, ordenacao, abrir completo, duplicar,
     identificar demanda, versao, responsavel, datas, validade e status.

## 3. Arquitetura da informacao recomendada

Menu "Orcamentos":

- Demandas/Propostas
- Orcamentos
  - Em elaboracao
  - Prontos para revisao
  - Emitidos/enviados
  - Aprovados/recusados/vencidos/cancelados
- Historico de Orcamentos
- Parametros Economicos
- Modelos/Templates

Dentro de uma demanda:

- Aba 1: Demanda
- Aba 2: Custos laboratoriais, se modalidade exigir
- Aba 3: Custos de projeto, se modalidade exigir
- Aba 4: Parametros Economicos
- Aba 5: Orcamento Final
- Aba 6: Historico e Auditoria

## 4. Separacao entre custo e preco

Custos:

- Laboratorio: custo_unitario, quantidade/amostras, subtotal tecnico, rubrica,
  origem do custo, data do snapshot.
- Projeto: rubrica PE/MC/MP/ST/VD/OU, categoria, etapa/atividade/entrega,
  descricao, quantidade, unidade, custo_unitario, subtotal, origem.

Preco:

- Deve surgir somente em Parametros Economicos e Orcamento Final.
- Para o projeto, substituir o uso operacional de `preco_unitario` por
  `custo_unitario` na UI de levantamento. Se o banco mantiver `preco_unitario`
  por compatibilidade, preencher como snapshot tecnico, nao como preco final.

## 5. Modelo de tela: Analises Laboratoriais

Blocos recomendados:

- Identificacao: demanda, analise, matriz/amostra, protocolo, responsavel.
- Quantidades: numero de amostras, repeticoes, perdas, controles, unidade.
- Insumos/reagentes: item, lote opcional, qtd/amostra, unidade, custo unitario,
  subtotal, origem.
- Materiais de consumo: item, quantidade, unidade, custo unitario, subtotal.
- Equipamentos: equipamento, tempo, regra de rateio, custo alocado.
- Mao de obra tecnica: tecnico/perfil, horas, custo-hora, subtotal.
- Terceiros laboratoriais: fornecedor/servico, quantidade, custo.
- Totais: subtotal por rubrica e custo total da analise.

Nao mostrar aqui: impostos, taxas, fundos, lucro, preco final ou gross-up.

## 6. Modelo de tela: Projeto

Blocos recomendados:

- Identificacao: demanda, projeto, titulo, cliente, coordenador, responsavel.
- Escopo e entregas: objetivo, entregas, marcos, cronograma.
- Custos por rubrica: PE, MC, MP, ST, VD, OU.
- Custos por etapa/atividade: etapa, atividade, entrega, periodo, responsavel.
- Viagens e diarias: parametros de quantidade que geram linhas VD.
- Catalogo/modelos: inserir itens do catalogo antigo com origem preservada.
- Totais: subtotal por rubrica, subtotal por etapa e custo total do projeto.

Nao mostrar aqui: lucro, impostos, fundos ou preco final. Esses dados devem ser
movidos para Parametros Economicos.

## 7. Modelo de tela: Parametros Economicos

Estrutura recomendada:

- Entrada: custos recebidos do laboratorio e/ou projeto.
- Parametros globais: impostos, taxas administrativas, incubacao, fundos,
  margem/lucro.
- Metodo de calculo: markup simples ou gross-up, com validacao de soma menor que
  100% quando gross-up for usado.
- Resultado: subtotal de custos, valor de cada parametro, preco final, receita
  liquida, total antes/depois de impostos.
- Snapshot: data, usuario, versao dos parametros e justificativa.
- Previa de impacto: manter para analises, mas tambem adicionar previa para
  projeto e consolidado.

## 8. Modelo de Orcamento Final

Blocos:

- Cabecalho institucional, numero, versao, data, validade e status.
- Dados do cliente e demanda.
- Escopo resumido.
- Custos laboratoriais, se houver.
- Custos de projeto, se houver.
- Parametros economicos aplicados.
- Preco final.
- Condicoes, observacoes, responsavel e aprovacao.
- Acoes: imprimir/PDF, DOCX, XLSX, gerar link de aprovacao, duplicar, criar
  nova versao.

Na visualizacao externa/cliente, ocultar custos internos quando necessario e
mostrar apenas composicao comercial aprovada.

## 9. Modelo de Historico de Orcamentos

Tela separada com tabela e filtros:

- numero, versao, demanda, cliente, projeto, modalidade, responsavel;
- data de criacao, ultima atualizacao, data de envio, validade;
- status: em elaboracao, concluido, aprovado, recusado, cancelado, vencido;
- total de custos, parametros aplicados, preco final;
- acoes: abrir, duplicar, exportar, comparar versoes, ver auditoria.

Essa tela deve substituir a mistura atual entre criacao e consulta nas paginas
principais.

## 10. Regras de validacao e dependencia

- Nenhum orcamento formal deve ser criado sem demanda vinculada.
- A modalidade da demanda controla quais modulos ficam habilitados.
- "Somente analises" exige ao menos uma analise.
- "Somente projeto" exige ao menos um custo proprio ou justificativa formal de
  custo zero.
- "Analises + projeto" exige os dois modulos completos antes de Parametros
  Economicos.
- Parametros Economicos so podem consolidar custos de modulos com status
  "preenchido" ou "revisado".
- Gross-up deve bloquear soma de percentuais maior ou igual a 100%.
- Alteracao de parametro apos emissao cria nova versao ou exige acao explicita
  de recalcule, preservando snapshot anterior.
- Exclusao de orcamento emitido/aprovado deve ser bloqueada; usar cancelamento.
- Cada total deve exibir origem: item manual, catalogo, template, analise,
  viagem calculada, parametro global ou snapshot.

## 11. Problemas priorizados

Criticos:

- Demanda nao governa os modulos seguintes.
- Parametros economicos de projeto estao misturados na tela de projeto.
- Campo `preco_unitario` aparece no levantamento de custo do projeto.
- Nao ha consolidacao final bloqueada por completude dos modulos exigidos.

Altos:

- `/orcamento` mistura criacao, lista consolidada e historico sem nomenclatura
  clara.
- Historico/versionamento ainda nao atende a consulta formal de orcamentos.
- Modalidade "analises + projeto" pode aparecer como "so projeto" se ainda nao
  houver itens.
- Duplicidade visual de coluna "Projeto" na lista consolidada.
- Status nao cobre vencido/cancelado/concluido em todos os tipos de orcamento.

Medios:

- Detalhe de projeto e uma pagina longa demais, sem abas ou etapas.
- Cards introdutorios em `/orcamento/projetos` ocupam espaco operacional.
- Parametros laboratoriais e parametros de projeto usam estruturas visuais e
  conceituais diferentes.
- Catalogo antigo esta presente, mas aparece como "catalogo antigo" na UI; deve
  virar catalogo institucional de custos com origem auditavel.

Baixos:

- Textos de ajuda sao bons, mas ainda explicam arquitetura em vez de guiar a
  proxima acao.
- Estado vazio de demandas nao oferece caminho de fluxo completo.

## 12. Plano de implementacao

Correcoes imediatas:

1. Renomear `/orcamento` para "Orcamentos" ou "Historico/Consolidado" e ajustar
   botao de criacao.
2. Bloquear geracao de modulos incompatíveis com a modalidade da demanda.
3. Renomear colunas duplicadas e corrigir classificacao visual de tipos.
4. Remover "preco unitario" da UI de custos proprios do projeto.
5. Criar status de completude por modulo antes da consolidacao.

Melhorias estruturais:

1. Reorganizar detalhe de demanda em abas/etapas.
2. Extrair Parametros Economicos do detalhe de projeto.
3. Criar Orcamento Final como etapa/documento unico.
4. Criar Historico de Orcamentos separado.
5. Criar snapshots/versionamento formal de parametros e totais.

Funcionalidades futuras:

1. Comparacao de versoes.
2. Duplicacao orientada por demanda/template.
3. Exportacao com layout institucional revisado.
4. Link de aprovacao tambem para orcamentos laboratoriais.
5. Dashboard de funil: demandas novas, custos pendentes, aguardando parametro,
   enviados, aprovados e vencidos.

## 13. Criterios objetivos de aceite

- Uma demanda "somente analises" nao permite gerar projeto.
- Uma demanda "somente projeto" nao permite adicionar analise laboratorial.
- Uma demanda "analises + projeto" nao libera Parametros Economicos enquanto os
  dois modulos nao estiverem preenchidos.
- Laboratorio e Projeto exibem apenas custos e subtotais, sem preco final.
- Parametros Economicos mostra subtotal de custos, parametros aplicados e preco
  final com formula auditavel.
- Orcamento Final exibe composicao completa e tem acoes de imprimir/exportar.
- Historico de Orcamentos existe como area separada, com filtros, ordenacao,
  status, versao, responsavel e duplicacao.
- Orcamentos emitidos preservam snapshots de custo, preco e parametros.
- Recalculo apos mudanca de parametros e acao explicita e auditada.
- Nenhum valor total aparece sem origem e regra de calculo identificavel.

## 14. Evidencias locais

- `src/app/orcamento/demandas/page.tsx`: formulario de demanda e lista.
- `src/app/orcamento/demandas/[id]/page.tsx`: detalhe da demanda e geracao de
  custos.
- `src/app/orcamento/page.tsx`: lista/criacao consolidada de orcamentos.
- `src/app/orcamento/[id]/page.tsx`: detalhe de orcamento laboratorial.
- `src/app/orcamento/projetos/page.tsx`: lista/criacao de projetos.
- `src/app/orcamento/projetos/[id]/page.tsx`: detalhe completo de projeto.
- `src/app/orcamento/parametros/page.tsx`: parametros laboratoriais.
- `src/lib/project-budget/legacy.ts`: calculo de gross-up do projeto.
- `src/lib/actions/orcamentos.ts` e `src/lib/actions/orcamento-projetos.ts`:
  criacao, snapshots, parametros, templates, anexos e links.
- `supabase/migrations/0010_orcamento_projetos.sql`,
  `0011_demandas_propostas.sql`, `0012_orcamento_projetos_compat_antigo.sql` e
  `0013_orcamento_unificado.sql`: base de dados relevante.
- Screenshots de apoio: `output/playwright/demandas.png`,
  `output/playwright/orcamento.png`, `output/playwright/projetos.png`,
  `output/playwright/parametros.png`.
