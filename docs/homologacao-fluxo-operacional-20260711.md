# Homologação do fluxo operacional completo

## Objetivo

Validar, em ambiente de homologação formalmente identificado, o percurso
`demanda → orçamento → planejamento → reserva → compra → recebimento → aceite → consumo → custo real`.

Este roteiro não autoriza alterações em produção. Não usar refs legados nem
executar `supabase db push --linked` até que o ambiente de homologação esteja
identificado e confirmado conforme `docs/operacao-producao.md`.

## Pré-condições

- Banco de homologação identificado, com backup lógico e migrations revisadas.
- Usuários de teste distintos para técnico, coordenador, gestor e admin.
- Um projeto, cliente, fornecedor, análise e insumo de teste cadastrados.
- A análise deve ter receita com insumo e, quando aplicável, equipamento vinculado.
- Pelo menos uma unidade física do equipamento deve estar operacional.

## Cenários obrigatórios

| # | Papel | Ação | Resultado esperado | Evidência |
|---|---|---|---|---|
| 1 | Técnico | Criar demanda e orçamento laboratorial | Dados comerciais e análises ficam vinculados à demanda | URL e número da demanda |
| 2 | Coordenador | Revisar módulos e emitir versão final | Snapshot preserva custo, preço e parâmetros aplicados | Número da versão e registro de auditoria |
| 3 | Técnico | Gerar planejamento do orçamento aprovado | Projeto, orçamento e análises são copiados ao plano | URL do plano |
| 4 | Técnico | Informar período, reservar equipamento e reservar insumos | Sem conflito de agenda; lotes e unidade física ficam rastreáveis | IDs das reservas |
| 5 | Técnico | Tentar iniciar sem estoque ou equipamento válido | Início é bloqueado, sem baixa de estoque | Mensagem e auditoria |
| 6 | Técnico | Gerar pedido interno para a falta | Pedido nasce vinculado ao planejamento | ID do pedido |
| 7 | Coordenador | Validar/formalizar o pedido | Compra formal é criada na mesma trilha | IDs interno e compra |
| 8 | Técnico | Receber parcialmente uma compra | Quantidade recebida, lote e histórico são criados sem fechar item pendente | ID do recebimento e lote |
| 9 | Coordenador | Aceitar o lote | Lote passa a disponível para reserva/FEFO | Status do lote |
| 10 | Técnico | Receber saldo restante e iniciar o plano | Baixas usam lotes reservados e custo real por lote | Movimentações `plano {id}` |
| 11 | Coordenador | Conferir margem | Plano mostra previsto versus realizado parcial de insumos | Captura da seção de margem |
| 12 | Gestor | Estornar recebimento permitido | Estoque e histórico são revertidos conforme regra | Evento de estorno |
| 13 | Gestor | Tentar estornar lote já consumido | Operação é bloqueada sem alterar histórico | Mensagem de bloqueio |
| 14 | Admin | Verificar qualidade de cadastros | Pendências de custo, unidade, fornecedor, validade e oferta aparecem | Captura de `/cadastros/qualidade` |

## Regressões de segurança

Executar com um usuário técnico e registrar a negação esperada:

- Alterar diretamente status de pedido, compra, orçamento ou planejamento.
- Criar/editar lote, reserva, movimentação ou reserva de equipamento via API direta.
- Pular aprovação ou formalização de compra.
- Iniciar plano com equipamento exigido sem reserva ativa.
- Registrar consumo fora do plano com referência `plano {id}` sem equipamento válido.

## Critérios de aceite

- Não há mutação física sem RPC/transação e trilha de auditoria.
- Uma divergência de custo de compra altera a previsão futura, mas não orçamento final já emitido.
- O plano não inicia com falta de insumo, lote inválido ou equipamento obrigatório indisponível.
- Cada item comprado pode ser rastreado até lote recebido e consumo associado ao plano.
- A matriz de evidências contém responsável, data, URL/ID e resultado de todos os cenários.

## Matriz de evidências

| Data/hora | Ambiente | Usuário/papel | Cenário | Entidades/IDs | Resultado | Evidência | Pendência |
|---|---|---|---|---|---|---|---|
|  | homologação |  |  |  | OK / Falha |  |  |
