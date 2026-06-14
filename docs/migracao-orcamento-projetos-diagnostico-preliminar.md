# Diagnostico preliminar da migracao do app antigo de orcamento de projetos

Data: 2026-06-13

Este diagnostico e preliminar. Foi produzido a partir do app publico
`https://orcamento-projetos.vercel.app/configuracoes`, dos bundles publicos
baixados do deploy e da estrutura local do Kontrol.

## Estado da auditoria

O acesso autenticado ao app antigo foi validado em 2026-06-13. Ainda assim,
sem repositorio-fonte ou dump completo do Supabase antigo, permanecem pendentes
alguns itens de auditoria:

- RLS/policies;
- views;
- RPCs;
- triggers;
- permissoes por usuario em detalhe;
- formato completo de exportacao DOCX/PDF/XLSX;
- regras internas nao expostas no bundle compilado.

Para fechar 100% da auditoria, ainda e recomendado obter:

- repositorio-fonte do app antigo;
- dump do Supabase antigo;
- export SQL/schema + CSV/JSON das tabelas antigas.

## Dados antigos autenticados

Consulta autenticada ao Supabase antigo:

| Tabela antiga | Linhas visiveis | Observacao |
| --- | ---: | --- |
| `budgets` | 0 | Nenhum orcamento salvo visivel para o usuario auditado |
| `budget_templates` | 0 | Nenhum template salvo visivel para o usuario auditado |
| `catalog_items` | 100 | Catalogo precisa ser migrado |
| `user_roles` | Indisponivel | Consulta retornou erro 500; requer auditoria por schema/dump |

Distribuicao de `catalog_items`:

| Rubrica | Linhas | Menor valor | Maior valor |
| --- | ---: | ---: | ---: |
| `PE` | 10 | 3100.00 | 16800.00 |
| `MC` | 48 | 1.80 | 545000.00 |
| `MP` | 18 | 150.00 | 9000.00 |
| `ST` | 18 | 80.00 | 12000.00 |
| `VD` | 6 | 7.20 | 390.00 |
| `OU` | 0 | - | - |

Colunas confirmadas em `catalog_items`:

- `id`;
- `rubric`;
- `description`;
- `unit`;
- `unit_price`;
- `category`;
- `active`;
- `valid_from`;
- `created_at`;
- `updated_at`;
- `created_by`.

## Inventario parcial do app antigo

### Rotas identificadas em bundles publicos

| Rota antiga | Evidencia | Observacao |
| --- | --- | --- |
| `/dashboard` | bundle publico | Provavel painel principal |
| `/orcamentos` | bundle publico | Lista/gestao de orcamentos |
| `/orcamentos/[id]` | bundle publico com `/orcamentos/` | Detalhe de orcamento |
| `/configuracoes` | URL publica e bundle | Parametros economicos/configuracoes |
| `/usuarios` | bundle publico | Gestao ou consulta de usuarios |
| `/ajuda` | bundle publico | Ajuda/documentacao |

### Tabelas Supabase identificadas em bundles publicos

| Tabela antiga | Evidencia | Possivel papel |
| --- | --- | --- |
| `budgets` | `.from("budgets")` | Orcamentos de projeto |
| `budget_templates` | `.from("budget_templates")` | Templates/reaproveitamento |
| `catalog_items` | `.from("catalog_items")` | Catalogo de itens de custo |
| `user_roles` | `.from("user_roles")` | Papeis/permissoes |

### Rubricas/categorias de custo identificadas

| Codigo | Label |
| --- | --- |
| `PE` | Pessoal |
| `MC` | Material de Consumo |
| `MP` | Material Permanente |
| `ST` | Servicos de Terceiros |
| `VD` | Viagens e Diarias |
| `OU` | Outros |

### Parametros economicos identificados

| Chave antiga | Label |
| --- | --- |
| `taxes` | Impostos |
| `incubation` | Incubacao |
| `reserve` | Reserva |
| `investments` | Investimentos |
| `profit` | Lucro |

### Campos de orcamento identificados

Campos padrao extraidos do bundle:

- `number`;
- `projectName`;
- `client`;
- `clientContact`;
- `clientPhone`;
- `clientEmail`;
- `clientAddress`;
- `clientDetails`;
- `coordinator`;
- `owner`;
- `notes`;
- `status`;
- `projectMonths`.

Status identificados:

- `em_preparacao`;
- `em_analise_cliente`;
- `aprovado`.

### Regras de calculo identificadas

O app antigo calcula:

- total por item;
- total por rubrica;
- subtotal de custos diretos;
- gross-up por soma de parametros economicos;
- fator de gross-up;
- total final;
- valor de impostos;
- taxa de incubacao;
- fundo de reserva;
- fundo de investimento;
- lucro;
- receita liquida ou resultado;
- participacao percentual por rubrica no total final.

Regra extraida:

- Para rubrica `PE`, se houver `selectedMonths`, o total do item e
  `selectedMonths.length * unitPrice`.
- Para as demais rubricas, o total do item e `quantity * unitPrice`.
- A soma dos percentuais economicos precisa ser menor que 100%.
- Quando a soma e maior ou igual a 100%, o calculo retorna erro de validacao.
- Gross-up: `grossUpFactor = 1 / (1 - somaPercentuais)`.
- Total final: `grossTotal = subtotal * grossUpFactor`.

### Funcionalidades identificadas por strings publicas

- login e criacao de conta;
- primeiro acesso com senha provisoria;
- salvar orcamento na nuvem;
- fallback para salvar localmente;
- carregar orcamentos da nuvem;
- apagar orcamento da nuvem;
- atualizar status;
- notificar mudanca de status;
- catalogo inicial no banco;
- salvar novo item de catalogo;
- atualizar item de catalogo;
- apagar item de catalogo;
- salvar template;
- remover template;
- carregar templates;
- importar planilha `.xlsx`/`.xls`;
- exportar XLSX;
- gerar DOCX;
- gerar PDF com timbre;
- gerar link do cliente;
- criar versao;
- revisar proposta.

## Inventario resumido do Kontrol atual

### Rotas atuais relevantes

| Rota Kontrol | Papel atual |
| --- | --- |
| `/analises` | Painel/catalogo tecnico de analises |
| `/analises/[codigo]` | Detalhe tecnico de analise |
| `/insumos` | Consumo por analise |
| `/custeio` | Custeio por analise |
| `/estoque` | Saldos, lotes e alertas |
| `/planejamento` | Planejamento de demanda/reservas |
| `/compras` | Compras/reposicao |
| `/orcamento/demandas` | Demandas/Propostas |
| `/orcamento` | Orcamentos de analises |
| `/orcamento/[id]` | Detalhe de orcamento de analises |
| `/orcamento/projetos` | Orcamentos de projetos |
| `/orcamento/projetos/[id]` | Detalhe de orcamento de projeto |
| `/orcamento/parametros` | Parametros economicos laboratoriais |
| `/cadastros/[slug]` | Cadastros-base |
| `/auditoria` | Auditoria |
| `/usuarios` | Usuarios/perfis |

### Tabelas Kontrol ja existentes para reaproveitar

| Tabela Kontrol | Papel |
| --- | --- |
| `clientes` | Cadastro central de clientes |
| `projetos` | Eixo transversal |
| `demandas_propostas` | Entrada anterior ao orcamento |
| `orcamentos` | Orcamentos de analises |
| `orcamento_itens` | Itens de analise com snapshot |
| `orcamento_projetos` | Cabecalho de orcamento de projeto |
| `orcamento_projeto_analises` | Analises dentro de projeto |
| `orcamento_projeto_custos` | Custos proprios de projeto |
| `parametros` | Parametros economicos/custeio |
| `analises` | Catalogo tecnico |
| `insumos` | Materiais/reagentes |
| `lotes_estoque` | Lotes e custo real |
| `planejamento` | Planejamento operacional |
| `pedidos_compra` | Compras |
| `auditoria` | Historico de alteracoes |
| `perfis` | Usuarios/papeis |

## Comparativo preliminar de funcionalidades

| Funcionalidade no app antigo | Existe no Kontrol? | Esta equivalente? | Precisa migrar? | Como migrar | Risco |
| --- | --- | --- | --- | --- | --- |
| Orcamentos de projeto | Parcial | Nao | Sim | Expandir `orcamento_projetos` sem criar tabela paralela | Alto |
| Rubricas PE/MC/MP/ST/VD/OU | Parcial | Nao | Sim | Mapear para categorias de custo do projeto | Medio |
| Gross-up por impostos/incubacao/reserva/investimentos/lucro | Parcial | Nao | Sim | Adicionar parametros especificos de projeto ou tabela de configuracao | Alto |
| Catalogo de itens | Parcial | Nao | Sim | Mapear `catalog_items` para cadastro de itens/categorias de custo | Alto |
| Templates de orcamento | Nao | Nao | Sim | Criar estrutura aditiva para templates | Alto |
| Importar planilha XLS/XLSX | Nao | Nao | Sim, se usado | Criar importador apos mapear formato | Medio |
| Exportar XLSX | Nao | Nao | Sim, se usado | Implementar exportacao compativel | Medio |
| Gerar DOCX | Nao | Nao | Sim, se usado | Migrar geracao de proposta | Medio |
| PDF com timbre | Parcial via impressao | Nao | Sim, se usado | Gerar/adequar proposta imprimivel/PDF | Medio |
| Link do cliente | Nao | Nao | Avaliar | Requer modelo publico seguro | Alto |
| Criar versao | Nao | Nao | Sim, se usado | Criar versionamento de orcamentos | Alto |
| Revisar proposta | Nao | Nao | Sim, se usado | Mapear status/fluxo de revisao | Medio |
| Usuarios/user_roles | Parcial | Nao | Migrar com cuidado | Mapear para `perfis` e RLS do Kontrol | Alto |
| Fallback localStorage | Nao | Nao | Provavelmente substituir | Kontrol deve usar Supabase/Auth; importar dados locais se existirem | Medio |

## Mapa preliminar de campos

| Campo antigo | Destino provavel no Kontrol | Observacao |
| --- | --- | --- |
| `number` | `orcamento_projetos.numero` ou campo novo | Campo ausente hoje |
| `projectName` | `orcamento_projetos.titulo` / `projetos.nome` | Verificar regra |
| `client` | `clientes.nome` / snapshot `cliente_nome` | Reaproveitar cliente central |
| `clientContact` | `cliente_contato` | Pode consolidar com email/telefone |
| `clientPhone` | `clientes.telefone` ou snapshot novo | Campo snapshot ausente no orcamento projeto |
| `clientEmail` | `clientes.email` ou snapshot novo | Campo snapshot ausente no orcamento projeto |
| `clientAddress` | `clientes.endereco` ou snapshot novo | Campo snapshot ausente no orcamento projeto |
| `clientDetails` | `observacoes` ou campo novo | Precisa decisao |
| `coordinator` | `responsavel` | Equivalente parcial |
| `owner` | campo novo | Possivel responsavel/proprietario comercial |
| `notes` | `observacoes` | Equivalente parcial |
| `status` | `status` | Precisa mapear valores |
| `projectMonths` | campo novo | Necessario para PE/meses |

## Proposta preliminar de arquitetura final

Nao criar um modulo paralelo. Expandir o modulo atual:

- `demandas_propostas` segue como entrada comum.
- `orcamento_projetos` recebe campos ausentes do app antigo.
- `orcamento_projeto_custos` deve suportar rubrica antiga, meses selecionados,
  quantidade, unidade, preco unitario e origem catalogo/template.
- Nova estrutura para `orcamento_projeto_parametros` ou parametros snapshotados
  por orcamento, para reproduzir gross-up historico.
- Nova estrutura para templates, se confirmada por fonte/dados.
- Novo cadastro de itens de catalogo, mapeando `catalog_items`.
- Exportacao/geracao de proposta so apos confirmar formato antigo.

## Proximos passos obrigatorios

1. Obter acesso ao app antigo autenticado, repo-fonte ou dump Supabase.
2. Extrair schema antigo completo.
3. Extrair amostra/dump dos dados antigos.
4. Preencher comparativo definitivo.
5. Propor migrations aditivas.
6. Gerar backup do Kontrol local/remoto antes de migrar dados.
7. Implementar em etapas pequenas.
