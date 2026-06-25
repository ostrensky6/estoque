# Auditoria do fluxo Demandas/Propostas

## Fonte oficial das analises

A fonte oficial das analises executadas pelo laboratorio e a tabela `analises`.
O campo `codigo` e a chave primaria atual e e usado historicamente por
`orcamento_itens`, `orcamento_projeto_analises`, `planejamento_itens`,
`etapas`, `insumo_analise` e `equipamento_analise`. Nao foi criado catalogo
paralelo.

## Operacao e cadastro tecnico

- Analise: `analises.codigo`, `analises.nome`, `analises.nome_simplificado`,
  `analises.ativo`, `analises.status`.
- Metodo e etapas: derivados de `etapas.nome_etapa` e
  `etapas.nome_atividade`.
- Matriz: hoje existe como texto da demanda (`demandas_propostas.matriz_amostra`).
  Nao ha relacao normalizada analise-matriz no schema atual.
- Equipamentos: `equipamento_analise` vincula analise a equipamentos.
- Reagentes/consumo: `insumo_analise` define insumo, unidade,
  quantidade por amostra e modo de cobranca por amostra ou por execucao.
- Capacidade e prazo tecnico: estimados a partir de
  `etapas.execucoes_por_dia` e `etapas.amostras_por_execucao`.
- Custeio: `calcularTodas()` carrega analises, etapas, equipamentos,
  tecnicos, overhead, insumos e parametros para calcular custo tecnico.
- Previsao operacional da demanda: a tela calcula lotes, prazo e consumo
  previsto a partir de `etapas` e `insumo_analise`. A quantidade digitada por
  analise altera imediatamente a previsao antes do salvamento.

## Problema do dropdown

A consulta anterior carregava `analises` ativas, mas exibia pouco contexto e
nao distinguia custeio disponivel de custeio pendente. Tambem nao mostrava
matriz, metodo, unidade, prazo tecnico ou motivo de lista vazia. O problema
nao foi identificado como RLS, tenant ou action: a falha era principalmente
consulta incompleta e apresentacao insuficiente no Client Component.

## Duplicidades encontradas

- Dados de cliente apareciam na demanda e novamente como formulario editavel no
  orcamento laboratorial.
- O detalhe da demanda misturava identificacao inicial, custos, parametros,
  revisao, emissao e historico com mesmo peso visual.
- Quantidade geral e quantidade por item nao tinham hierarquia clara.
- Analises dentro de projeto podiam ser somadas como custo de projeto mesmo
  quando a modalidade tambem exigia laboratorio.

## Decisoes aplicadas

- A demanda salva analises e quantidades mesmo sem custeio.
- A sincronizacao de `demanda_analises` e `orcamento_itens` ocorre pela RPC
  Postgres `sincronizar_demanda_analises(...)`. A funcao faz `for update`,
  valida duplicidades, valida catalogo oficial, cria/usa apenas orcamento
  laboratorial em rascunho e deixa o Postgres fazer rollback integral se houver
  excecao.
- Analise sem custo grava snapshot explicito de custeio pendente no item, mas a
  emissao final nao confia cegamente no `status_custeio` persistido: ela
  recalcula o status atual com `calcularTodas()`.
- A emissao final e bloqueada enquanto existir analise obrigatoria com custeio
  atualmente pendente.
- O orcamento laboratorial herdado de demanda mostra resumo comercial e link
  para editar a demanda, sem duplicar formulario de cliente.
- Consumo operacional permanece como previsao/snapshot; reserva, baixa e ordem
  operacional continuam para etapa posterior a aprovacao.
- Matriz aparece como informacao da demanda, nao como compatibilidade oficial.
  A interface mostra aviso claro porque ainda nao ha tabela normalizada
  analise-matriz.
- Versoes finais emitidas preservam snapshot de demanda, analises solicitadas,
  itens laboratoriais com `valor_snapshot`, itens de projeto e parametros
  economicos aplicados.

## Consultas de validacao no banco

```sql
-- Demanda e itens laboratoriais sincronizados pela RPC
select da.demanda_id, da.codigo_analise, da.quantidade_amostras,
       oi.orcamento_id, oi.n_amostras, oi.valor_snapshot
  from demanda_analises da
  join orcamentos o on o.demanda_id = da.demanda_id and o.status = 'rascunho'
  join orcamento_itens oi
    on oi.orcamento_id = o.id
   and oi.codigo_analise = da.codigo_analise
 where da.demanda_id = :demanda_id;

-- Itens de demanda tentando atualizar orcamento ja emitido/enviado
select o.id, o.demanda_id, o.status
  from orcamentos o
 where o.demanda_id = :demanda_id
   and o.status <> 'rascunho'
   and exists (select 1 from demanda_analises da where da.demanda_id = o.demanda_id);

-- Versao final com snapshot imutavel de analises e parametros
select id, numero, versao,
       snapshot->'demanda' as demanda_snapshot,
       snapshot->'analises_solicitadas' as analises_snapshot,
       snapshot->'orcamentos_analises' as laboratorio_snapshot,
       snapshot->'consolidado'->'parametrosAplicados' as parametros_snapshot
  from orcamento_final_versoes
 where demanda_id = :demanda_id
 order by versao desc;
```

## Lacunas reais

- Nao existe tabela oficial de compatibilidade analise-matriz.
- Nao existe versionamento tecnico formal de metodo/receita por analise.
- Nao existe coluna dedicada de status de custeio em `orcamento_itens`; o status
  operacional fica no snapshot do item e o bloqueio de emissao recalcula o
  custeio atual.
