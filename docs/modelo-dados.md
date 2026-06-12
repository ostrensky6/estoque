# Modelo de dados — Lab Custos & Estoque

Origem: `Laboratorio1.xlsm` (8 abas). O schema guarda **inputs crus**; os
cálculos de custo/preço ficam na aplicação, lendo a tabela `parametros`, para
permitir simulação de cenários em tempo real.

## Tabelas (migration `supabase/migrations/0001_init.sql`)

| Tabela | Origem (aba) | Papel |
|---|---|---|
| `parametros` | — | Constantes ajustáveis (dias úteis/ano, horas-base, margem, impostos, fundos) |
| `analises` | Tempo | Catálogo das 13 análises (PK = código) |
| `etapas` | Tempo | Etapas/atividades por análise (tempo máquina/bancada, gargalo, prazo) |
| `equipamentos` | Equipamentos | Inventário (custo, vida útil, % manutenção, contrato fixo) |
| `equipamento_analise` | Equipamento_Analise | Matriz de alocação equipamento→análise (`peso_alocacao`) |
| `tecnicos` | Tecnicos | Pessoal (salário, horas/mês, % dedicado) |
| `overhead` | Overhead | Custos fixos rateados por hora de bancada |
| `insumos` | MC | Catálogo de consumo (custo unitário = embalagem ÷ qtd) |
| `insumo_analise` | MCA | Insumo × etapa × análise (qtd/amostra, grupo de escolha, modo de cobrança) |
| `estoque_movimentacoes`, `estoque_config`, `v_estoque_saldo` | — | Módulo de estoque (saldo derivado de movimentações) |
| `planejamento`, `planejamento_itens` | — | Ponte custeio↔estoque (nº de amostras → consumo projetado) |

Chave de junção entre módulos: `codigo_analise`.

## Cadeia de cálculo (na aplicação)

```
custo_analitico/amostra = reagentes(MCA) + equipamentos(deprec. linear + manut, rateado) + pessoal(horas×valor-hora)
preço = custo_analitico + overhead + (margem + impostos + taxas + fundo_reserva + fundo_investimento)
```

## Decisões de modelagem vs. planilha
- **Depreciação linear** (`custo/vida_util`) substitui o `custo×%manutenção` da planilha.
- **`parametros`** externaliza todas as constantes (222 dias, 170 h, 450 h, margens).
- `codigo_analise` **normalizado** para o casing da aba Tempo (a planilha mistura `qpcr_f`/`qPCR_F`).

## Achados de qualidade de dados (corrigir na origem ou no app)
1. **`(análise, etapa, atividade)` não é única** — ex.: `Illumina_Sh | Montagem de biblioteca | Eletroforese` aparece 2×. O VLOOKUP da MCA no .xlsm pega só a 1ª. Schema **não** força unicidade; usar `ordem`/`dia_inicio`.
2. **2 insumos** citados na MCA sem correspondência na MC: `QuantiNova SYBR Green RT-PCR Kit` e `dNTP mix 10 mM. Kit c/ 800 uL`. (7 linhas de `insumo_analise` ficam sem `insumo_id`, contando linhas com insumo em branco.)
3. **`depreciacao_anual` da planilha = manutenção** (bug do original) — abandonado.
4. Possível **duplicação de `quantidade`** no `custo_total_dia` da planilha (M×qtd/222, sendo M já com qtd) — a recalcular no app de forma limpa.
5. Muitas fórmulas viraram `__xludf.DUMMYFUNCTION` (importação Google Sheets→Excel); usamos os valores em cache.

## Como recarregar o seed
```bash
py scripts/extract_xlsm.py            # gera seed/seed.sql + CSVs
# aplicar migration + seed no Postgres/Supabase alvo
```
