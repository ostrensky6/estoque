# Módulo de Estoque & Custos — Design e Lógica de Operação

> Documento de referência. Define o modelo de dados, a máquina de estados do
> ciclo de vida dos insumos e os ganchos para automação/previsão. Pensado para
> evolução: as decisões abaixo isolam o que muda no futuro.

## 1. Desafios que o desenho precisa resolver
1. **Otimizar estoque** — nem faltar (para a operação) nem sobrar (capital parado / vencimento).
2. **Previsão de compras** — saber *o que, quanto e quando* comprar, com antecedência do lead time.
3. **Operação ininterrupta** — nunca parar uma análise por falta de insumo: estoque de segurança + ponto de reposição dimensionados pelo consumo e pelo prazo de entrega.

## 2. Conceitos centrais (vocabulário)

| Termo | Definição |
|---|---|
| **Em mãos** (on hand) | Quantidade física existente, somada por lotes. |
| **Reservado** | Quantidade comprometida com análises planejadas, ainda não consumida. |
| **Disponível** | `em_mãos − reservado`. É o que pode ser prometido a novos planos. |
| **Demanda** | Consumo previsto de um plano de análises (nº de amostras × consumo/amostra). |
| **Ponto de reposição** | Nível de *disponível* que dispara a sugestão de compra. |
| **Estoque de segurança** | Colchão para cobrir variação de consumo/atraso de entrega. |
| **Lote** | Uma entrada física de um reagente, com validade e custo próprios. |

## 3. Modelo de dados (proposto)

Reaproveita o que já existe (`insumos`, `equipamentos`, `equipamento_analise`,
`planejamento`) e acrescenta:

### 3.1 Reagentes
`insumos` (catálogo) ganha atributos de política de estoque:
- `ponto_reposicao` (numérico, na unidade do insumo)
- `estoque_seguranca`
- `lead_time_dias` (prazo de entrega do fornecedor)
- `unidade` (já existe) — **deve ser a mesma unidade do consumo na MCA**

### 3.2 Lotes (rastreio de validade — FEFO)
`lotes_estoque`: cada recebimento físico de um reagente.
- `insumo_id`, `codigo_lote`, `validade` (data), `quantidade_inicial`,
  `quantidade_atual`, `custo_unitario` (do recebimento), `data_entrada`, `fornecedor`
- Saídas consomem dos lotes por **FEFO** (*first expired, first out*: vence antes, sai antes).

### 3.3 Movimentações (livro-razão)
`estoque_movimentacoes` (já existe) passa a referenciar `lote_id`:
- tipos: `entrada` (cria/abastece lote), `saida` (baixa definitiva), `ajuste` (inventário/perda).
- É a **fonte da verdade** e o histórico para previsões.

### 3.4 Reservas
`reservas_estoque`: vínculo entre um plano e um insumo.
- `planejamento_id`, `insumo_id`, `quantidade`, `status`
- status: `reservado` → `consumido` (baixa) ou `liberado` (plano cancelado).

### 3.5 Equipamentos (custo, não inventário consumível)
`equipamentos` + `equipamento_analise` (já existem). Custo por análise:
- depreciação **linear** (`custo/vida_util`) + manutenção (fração ou contrato fixo),
  rateado por dias úteis e pelo throughput (amostras/dia) da análise.
- "Uso por análise" = `equipamento_analise.peso_alocacao`.

## 4. Ciclo de vida: demanda → reserva → uso → reposição

Esta é a lógica de interação central. Os quatro verbos são transições de estado
da quantidade de cada reagente.

```
   PLANEJAR                 INICIAR análise            REPOR
  (demanda)                  (baixa definitiva)       (compra)
      │                            │                     │
      ▼                            ▼                     ▼
 ┌──────────┐  reserva   ┌──────────────┐  consumo  ┌──────────┐
 │DISPONÍVEL│──────────▶ │  RESERVADO   │─────────▶ │  BAIXA   │
 │          │ (-disp.)   │ (em mãos -   │ (-em mãos │ (saída    │
 │          │            │  reservado)  │  FEFO)    │  no lote) │
 └────┬─────┘            └──────┬───────┘           └──────────┘
      ▲                         │ cancelar plano
      └─────────────────────────┘ (libera reserva, +disp.)
```

### 4.1 Demanda (planejar)
Ao planejar `N` amostras da análise `A`, o sistema calcula o consumo por insumo:
- itens **por amostra**: `quantidade_por_amostra × N`
- itens **por execução** (kits/placas): `quantidade_por_execução × ceil(N / amostras_por_execução)`
Isso vem das mesmas regras já implementadas no custeio (engine + MCA), garantindo
coerência entre **custo** e **consumo**.

### 4.2 Reserva (confirmar plano)
- Para cada insumo: se `disponível ≥ demanda`, cria `reserva (status=reservado)` → reduz o disponível.
- Se `disponível < demanda`: o plano é aceito mas marca **falta**, e gera sugestão de compra (qtd faltante + estoque de segurança).
- Reserva **não** mexe no físico (em mãos) — é um compromisso.

### 4.3 Uso (iniciar análise = baixa definitiva)
- Converte as reservas do plano em `movimentações de saída`, consumindo lotes por **FEFO**.
- `reserva → consumido`; `lote.quantidade_atual` diminui; `em mãos` diminui.
- Operação **transacional** (tudo ou nada) para nunca deixar estoque inconsistente.

### 4.4 Reposição (comprar/receber)
- Disparada por alerta (ponto de reposição) ou pela falta de um plano.
- Recebimento cria/abastece um `lote` (com validade e custo) via `movimentação de entrada`.

## 5. Alertas (derivados, recalculados sob demanda)
1. **Reposição**: `disponível ≤ ponto_reposicao`.
2. **Vencimento**: `lote.validade ≤ hoje + janela` (ex.: 30/60 dias) e `quantidade_atual > 0`.
3. **Falta para plano**: `demanda > disponível` em algum plano confirmado.
4. **Vencido**: `validade < hoje` e `quantidade_atual > 0` (bloquear uso).

## 6. Integridade & operação ininterrupta
- **Transações no banco (RPC/funções Postgres)** para reservar e dar baixa: garantem atomicidade e ficam reutilizáveis por qualquer cliente (app hoje, automação amanhã).
- **Ponto de reposição** sugerido = `consumo_médio_diário × lead_time_dias + estoque_seguranca`.
- **Estoque de segurança** cobre a variabilidade — chave para não parar a operação.

## 7. Ganchos para automação e previsão (evolução futura)
O histórico de `movimentações` + `reservas` é a base de dados de eventos para:
- **Consumo médio** e **dias de cobertura** (`disponível / consumo_diário`).
- **Sugestão de compra** automática (qtd e data ótimas pelo lead time).
- **Previsão avançada** (sazonalidade/ML) lendo a série temporal de consumo.
- **Reposição automática**: uma rotina agendada gera ordens de compra quando cruza o ponto de reposição.
Nada disso muda o modelo — são leituras/rotinas sobre os mesmos eventos.

## 8. Plano de instalação (setup inicial)
1. Migration do schema (lotes, reservas, colunas de política, RPCs).
2. **Inventário inicial**: registrar lotes existentes (qtd, validade, custo) — um movimento de entrada por lote.
3. Definir por reagente: `ponto_reposicao`, `estoque_seguranca`, `lead_time_dias` (ou deixar o sistema sugerir após acumular histórico).
4. Conferir **unidades** insumo↔MCA (ver §9).

## 9. Decisões em aberto (a refinar)
- **D1. Rastreio por lote/validade (FEFO)?** Recomendado para biologia molecular (kits e enzimas vencem). Alternativa: validade única por reagente (mais simples, menos preciso).
- **D2. Onde fica a lógica de reserva/baixa?** Recomendado: **funções no Postgres (RPC)** — atômicas e prontas para automação. Alternativa: lógica no app.
- **D3. Unidades**: alguns consumos da MCA estão em unidade diferente do estoque (ex.: beads em µL vs embalagem). Precisamos padronizar a unidade por insumo para a baixa bater.
- **D4. Reserva bloqueia ou só sinaliza?** Plano sem estoque: barrar o início até repor, ou permitir e apenas alertar?
