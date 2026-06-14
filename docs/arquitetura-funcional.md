# Arquitetura funcional do Kontrol

O Kontrol passa a ser organizado pela operacao real do laboratorio:

1. Analises definem a operacao tecnica.
2. A operacao tecnica define consumo, tempo, equipamentos, lotes e custos.
3. O estoque garante disponibilidade e rastreabilidade.
4. A demanda/proposta organiza a entrada comercial ou institucional.
5. O orcamento transforma a demanda em valor.
6. O projeto integra analises, custos proprios, planejamento, compras e execucao.

## Modulo Analises

Eixo inicial do sistema. Reune o cadastro tecnico e operacional das analises
realizadas pela ATGC/GIA.

Submodulos:

- Painel de analises: visao geral das analises ativas.
- Catalogo de analises: codigo, nome, tipo, finalidade e matriz/amostra.
- Protocolos/etapas: etapas, atividades, tempos e capacidade do protocolo.
- Consumo por analise: reagentes, insumos, controles, repeticoes e perdas.
- Lotes/sublotes analiticos: regras de rodada, sublotes, controles e capacidade.
- Custeio por analise: custo tecnico e preco de referencia.
- Capacidade operacional: gargalos, amostras por execucao e capacidade diaria.

Rotas atuais reaproveitadas:

- `/analises`
- `/analises/[codigo]`
- `/insumos`
- `/custeio`

## Modulo Estoque

Segundo bloco funcional. O estoque responde as necessidades geradas pelas
analises e pelo planejamento.

Submodulos:

- Visao de estoque.
- Insumos.
- Lotes.
- Reservas.
- Planejamento de demanda.
- Compras e reposicao.
- Alertas.

Principios:

- Preservar RPCs transacionais para receber, aceitar, bloquear, desbloquear,
  descartar, reservar, baixar e liberar.
- Manter lotes com status, validade, localizacao e custo real.
- Usar disponibilidade real para alertas, reservas e baixa.

## Modulo Orcamento

Terceiro bloco funcional. Orcamento nao e o ponto de partida tecnico; ele e
uma consequencia de uma demanda comercial ou institucional.

Submodulos:

- Demandas/Propostas.
- Orcamentos de analises.
- Orcamentos de projetos.
- Parametros economicos.

### Demandas/Propostas

Etapa anterior ao orcamento formal. Concentra os dados comuns para evitar
redigitacao entre orcamento de analises e orcamento de projetos.

Campos principais:

- cliente;
- CNPJ/CPF;
- contato;
- instituicao;
- responsavel interno;
- data da solicitacao;
- prazo esperado;
- descricao da demanda;
- escopo preliminar;
- observacoes;
- status;
- tipo/modalidade;
- origem;
- prioridade;
- projeto vinculado.

Modalidades:

- apenas analises laboratoriais;
- apenas projeto;
- analises dentro de projeto;
- projeto com custos proprios e analises laboratoriais associadas.

Fluxo:

- Apenas analises gera orcamento laboratorial.
- Apenas projeto gera orcamento de projeto sem analises obrigatorias.
- Analises dentro de projeto gera orcamento de projeto com itens analiticos.
- Projeto com custos proprios e analises permite composicao hibrida.

## Projeto como eixo transversal

Projeto e uma entidade transversal. Pode se relacionar com:

- cliente;
- demanda/proposta;
- orcamento de analises;
- orcamento de projeto;
- planejamento;
- reservas de estoque;
- compras;
- execucao futura;
- auditoria.

## Cadastros

Agrupa entidades de base:

- clientes;
- projetos;
- fornecedores;
- equipamentos;
- tecnicos;
- locais;
- overhead;
- outros cadastros-base.

## Governanca

Agrupa:

- auditoria;
- usuarios;
- papeis e permissoes.

## Plano incremental

1. Reorganizar menu e linguagem conceitual sem quebrar rotas existentes.
2. Criar Demandas/Propostas como entidade anterior aos orcamentos.
3. Vincular demandas a orcamentos de analises e de projetos.
4. Evoluir Analises para explicitar protocolos, lotes/sublotes e capacidade.
5. Expandir cadastros-base sem duplicar entidades existentes.
6. Amarrar projeto a planejamento, reservas, compras e execucao futura.

## Regra para migracao do app antigo de orcamento de projetos

A migracao do app antigo `orcamento-projetos` para dentro do Kontrol deve seguir
o protocolo obrigatorio em `docs/migracao-orcamento-projetos-protocolo.md`.

Nenhuma implementacao dessa migracao deve comecar antes de inventario,
comparacao, plano de dados, plano de rollback e criterios de validacao.
