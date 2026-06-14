# Protocolo de migracao do app antigo de orcamento de projetos

Este documento e uma regra operacional obrigatoria para migrar o app antigo de
orcamento de projetos para dentro do Kontrol. A migracao deve ser funcional,
conceitual e de banco de dados. Nao deve ser tratada como recriacao visual.

## Regra principal

Antes de implementar qualquer codigo de migracao, entregar diagnostico completo
e obter aprovacao do plano.

O app antigo deve ser absorvido pelo Kontrol sem perda de funcionalidades
relevantes, dados, historico, regras de negocio, permissoes, RLS ou auditoria.

## Escopo da auditoria do app antigo

Levantar e documentar:

- rotas existentes;
- telas;
- formularios;
- campos;
- modulos de configuracao;
- cadastros;
- tabelas;
- views;
- funcoes/RPCs;
- relacionamentos;
- parametros economicos;
- regras de calculo;
- categorias de custo;
- status;
- fluxos de criacao, edicao, exclusao, duplicacao, impressao e exportacao;
- dados ja existentes no Supabase antigo;
- autenticacao, permissoes e politicas RLS;
- dependencias de bibliotecas, componentes e funcoes utilitarias.

Nao assumir irrelevancia de uma funcionalidade antes de lista-la.

## Escopo da auditoria do Kontrol

Levantar e documentar:

- rotas em `src/app`;
- menu lateral e navegacao;
- actions existentes;
- migrations Supabase aplicadas;
- tabelas;
- views;
- RPCs;
- triggers de auditoria;
- politicas RLS;
- tabelas de clientes, projetos, demandas/propostas, orcamentos, orcamento de
  projetos, planejamento, compras e estoque;
- componentes relacionados a orcamento;
- engine de custeio laboratorial;
- fluxo de orcamento de analises;
- fluxo atual de orcamento de projetos;
- integracao com estoque, planejamento e compras.

O Kontrol nao deve ser substituido pelo app antigo. O app antigo deve ser
absorvido pela arquitetura atual.

## Quadros comparativos obrigatorios

Entregar, antes de codar:

| Funcionalidade no app antigo | Existe no Kontrol? | Esta equivalente? | Precisa migrar? | Como migrar | Risco de perda de dados |
| --- | --- | --- | --- | --- | --- |

Tambem entregar:

- mapa comparativo das tabelas;
- mapa de campos equivalentes;
- campos ausentes no Kontrol;
- campos duplicados;
- tabelas reaproveitaveis;
- tabelas que precisam ser criadas;
- dados que precisam ser importados;
- regras de calculo ausentes;
- funcionalidades em risco de perda;
- dados em risco de perda.

## Protecao obrigatoria de dados

Proibido no contexto dessa migracao, salvo plano formal aprovado:

- `DROP TABLE`;
- `TRUNCATE`;
- apagar colunas com dados;
- renomear tabelas sem compatibilidade;
- substituir tabelas existentes sem backup;
- sobrescrever migrations antigas;
- remover politicas RLS sem recria-las corretamente;
- remover triggers de auditoria;
- apagar dados de configuracao;
- apagar parametros economicos;
- apagar clientes, projetos, categorias ou orcamentos existentes.

Qualquer mudanca estrutural deve ser incremental, aditiva e segura. Antes de
qualquer alteracao destrutiva, gerar:

- backup logico do schema;
- backup dos dados;
- relatorio de impacto;
- plano de rollback;
- script de validacao pos-migracao.

## Modelo final dentro do Kontrol

Preservar a arquitetura:

- Analises;
- Estoque;
- Orcamento;
- Cadastros/Governanca.

O orcamento de projetos deve viver no modulo Orcamento e se relacionar com:

- clientes;
- projetos;
- demandas/propostas;
- analises laboratoriais;
- custos proprios de projeto;
- parametros economicos;
- planejamento;
- estoque;
- compras;
- auditoria.

Preservar separacao conceitual entre:

- orcamento de analises laboratoriais;
- orcamento de projetos;
- analises dentro de projetos;
- custos proprios de projeto;
- demandas/propostas;
- pedidos de compra.

Nao chamar demanda comercial de pedido. Usar Demandas/Propostas.

## Funcionalidades do app antigo a verificar e migrar

Migrar ou justificar substituicao/descarte para:

- configuracoes de orcamento de projeto;
- parametros de calculo;
- categorias de custo;
- itens de projeto;
- custos diretos;
- custos indiretos;
- margem;
- impostos;
- encargos;
- composicao de preco;
- clientes;
- dados institucionais;
- escopo;
- cronograma;
- responsaveis;
- impressao ou geracao de proposta;
- status do orcamento;
- duplicacao ou reaproveitamento de orcamentos;
- qualquer configuracao ja implementada no app antigo.

## Integracao obrigatoria com o Kontrol

O modulo integrado deve:

- usar clientes e projetos existentes quando possivel;
- evitar duplicidade de cadastro;
- preservar snapshots de custo e preco;
- permitir vinculo com analises laboratoriais;
- permitir custos proprios de projeto;
- manter historico e auditoria;
- respeitar permissoes e RLS;
- funcionar com Supabase/Auth;
- ser compativel com menu e layout atuais;
- nao quebrar orcamento de analises;
- nao quebrar estoque;
- nao quebrar planejamento;
- nao quebrar compras;
- nao quebrar auditoria.

## Entregaveis antes da implementacao

Nenhuma etapa de codigo de migracao deve iniciar sem:

1. Diagnostico do app antigo.
2. Diagnostico do Kontrol atual.
3. Mapa comparativo das funcionalidades.
4. Mapa comparativo das tabelas.
5. Mapa de campos equivalentes.
6. Lista de funcionalidades em risco de perda.
7. Lista de dados em risco de perda.
8. Proposta de arquitetura final.
9. Proposta de rotas dentro do Kontrol.
10. Proposta de migrations.
11. Plano de migracao dos dados.
12. Plano de rollback.
13. Criterios de validacao.
14. Ordem incremental de implementacao.

## Ordem incremental de implementacao

Depois do diagnostico aprovado:

1. Criar backup e scripts de inspecao.
2. Criar migrations aditivas.
3. Migrar tabelas ou campos ausentes.
4. Migrar dados de configuracao.
5. Migrar parametros de calculo.
6. Integrar rotas e componentes.
7. Integrar ao menu do Kontrol.
8. Integrar com clientes/projetos existentes.
9. Integrar com analises laboratoriais.
10. Preservar ou adaptar tela de configuracoes do app antigo.
11. Testar calculo antigo versus novo.
12. Testar criacao, edicao, listagem, impressao e exclusao.
13. Testar permissoes.
14. Testar auditoria.
15. Testar regressao dos modulos atuais.

## Criterios de aceite

A migracao so pode ser considerada concluida quando:

- todas as funcionalidades relevantes do app antigo tiverem equivalente no Kontrol;
- todos os dados antigos tiverem sido preservados ou migrados;
- nenhum orcamento antigo tiver sido perdido;
- nenhuma configuracao antiga tiver sido perdida;
- calculos antigos puderem ser reproduzidos no Kontrol;
- orcamento de analises continuar funcionando;
- orcamento de projetos continuar funcionando;
- estoque, planejamento e compras nao forem quebrados;
- RLS, permissoes e auditoria continuarem funcionando;
- nao houver tabelas duplicadas desnecessarias;
- o menu final fizer sentido dentro da logica do Kontrol;
- houver documentacao clara do que foi migrado, adaptado ou substituido.
