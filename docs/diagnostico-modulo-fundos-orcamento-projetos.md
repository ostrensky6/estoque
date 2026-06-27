# Diagnostico do modulo Fundos do app orcamento-projetos

Data: 2026-06-27

## Objetivo

Avaliar a programacao do modulo "Fundos e taxas" do app antigo
`orcamento-projetos` e propor adaptacao segura para o Kontrol, no modulo
Orcamentos, abaixo de "Historico de orcamentos".

Este diagnostico segue o protocolo obrigatorio em
`docs/migracao-orcamento-projetos-protocolo.md`. Nenhuma implementacao de
migracao foi iniciada antes da aprovacao do plano.

## Fonte auditada

- App antigo local: `D:\Aplicativos\Projetos-reference`
- Arquivos principais:
  - `src/components/budget-workspace.tsx`
  - `src/lib/hooks/useFundTracking.ts`
  - `src/lib/budget.ts`
  - `src/lib/budget-types.ts`
  - `src/components/AnalyticsDashboard.tsx`
  - `supabase/migrations/001_initial_schema.sql`
  - `supabase/migrations/007_budget_versions.sql`
- App atual: `D:\Aplicativos\Kontrol`
- Arquivos principais no Kontrol:
  - `src/app/orcamento/page.tsx`
  - `src/app/orcamento/demandas/[id]/page.tsx`
  - `src/lib/orcamento/orcamento-final.ts`
  - `src/lib/orcamento/orcamento-economico.ts`
  - `src/lib/orcamento/orcamentos-listagem.ts`
  - `supabase/migrations/0033_orcamento_final_versoes.sql`
  - `supabase/migrations/0040_orcamento_parametros_aplicados.sql`

## Diagnostico do app antigo

O modulo antigo fica no workspace principal como a aba `FUNDS`, rotulada como
"Fundos e taxas".

### Comportamento

- Lista somente orcamentos aprovados:
  - `budget.status === "aprovado"` ou `budget.info.status === "aprovado"`.
- Para cada orcamento aprovado, recalcula o orcamento com:
  - `calculateBudget(budget.items, budget.rates)`.
- O usuario informa:
  - valor pago pelo cliente;
  - impostos pagos;
  - incubacao paga;
  - valor gasto do fundo de reserva;
  - valor gasto do fundo de investimento.
- A liberacao dos valores e proporcional ao recebimento:
  - `paidRatio = paidAmount / grossTotal`, limitado entre 0 e 1.
- Valores liberados:
  - impostos liberados = `legalTaxes * paidRatio`;
  - incubacao liberada = `incubationFee * paidRatio`;
  - reserva liberada = `reserveFund * paidRatio`;
  - investimento liberado = `investmentFund * paidRatio`.
- Saldos consolidados:
  - impostos a pagar = liberado - pago;
  - incubacao a pagar = liberado - pago;
  - fundo de reserva a executar = liberado - gasto;
  - fundo de investimento a executar = liberado - gasto.

### Persistencia no app antigo

O acompanhamento financeiro de fundos nao tem tabela propria no banco antigo.
Ele e salvo em `localStorage`, chave `atgc-fund-tracking-v1`, pelo hook
`useFundTracking`.

Tipo antigo:

```ts
type FundTracking = {
  budgetId: string;
  paidAmount: number;
  legalTaxesPaid: number;
  incubationPaid: number;
  reserveSpent: number;
  investmentSpent: number;
};
```

### Dados no banco antigo

As tabelas antigas de orcamento sao:

- `public.budgets`
- `public.budget_versions`

Campos relevantes:

- `budgets.status`
- `budgets.rates` jsonb
- `budgets.items` jsonb
- `budgets.calculation` jsonb
- `budget_versions.snapshot` jsonb

A consulta somente leitura ao banco antigo nao foi concluida porque a conexao
com o pooler retornou `password authentication failed`. A senha ou a forma de
conexao do projeto antigo deve ser reconfirmada antes de auditoria de dados em
producao.

## Diagnostico do Kontrol atual

O Kontrol ja tem a estrutura conceitual para alimentar o modulo de fundos:

- `orcamento_final_versoes`: versoes finais emitidas por demanda;
- `orcamento_parametros_aplicados`: snapshot dos parametros economicos
  aplicados ao orcamento final;
- `orcamento_final_versoes.snapshot`: preserva demanda, analises, custos de
  projeto e consolidado usado na emissao;
- `consolidarEconomiaOrcamento`: calcula impostos, incubacao, reserva,
  investimentos e lucro.

O calculo atual do Kontrol preserva estes parametros:

- `impostos_legacy`: base sobre valor final;
- `incubacao`: base sobre valor final;
- `reserva`: base sobre custo;
- `investimentos`: base sobre custo;
- `lucro`: base sobre custo.

O menu atual de Orcamentos tem:

- `Orçamentos não finalizados`
- `Histórico de orçamentos`

A pagina principal `/orcamento` tambem exibe cards de subareas, onde o novo
card pode entrar abaixo de "Historico de orcamentos".

## Quadro comparativo de funcionalidades

| Funcionalidade no app antigo | Existe no Kontrol? | Esta equivalente? | Precisa migrar? | Como migrar | Risco de perda de dados |
| --- | --- | --- | --- | --- | --- |
| Listar orcamentos aprovados para fundos | Parcial | Nao | Sim | Usar `orcamento_final_versoes` com status aprovado/emitido, conforme regra de negocio aprovada | Medio |
| Calcular impostos, incubacao, reserva e investimento | Sim | Parcial | Sim | Usar snapshots em `orcamento_parametros_aplicados`, sem recalcular orcamentos antigos | Baixo |
| Valor pago pelo cliente | Nao | Nao | Sim | Criar tabela aditiva de acompanhamento financeiro por versao final | Alto se ficar em localStorage |
| Impostos pagos | Nao | Nao | Sim | Criar campo/tabela de lancamento auditavel | Medio |
| Incubacao paga | Nao | Nao | Sim | Criar campo/tabela de lancamento auditavel | Medio |
| Gasto do fundo de reserva | Nao | Nao | Sim | Criar campo/tabela de lancamento auditavel | Medio |
| Gasto do fundo de investimento | Nao | Nao | Sim | Criar campo/tabela de lancamento auditavel | Medio |
| Liberacao proporcional ao pagamento | Nao como tela | Nao | Sim | Reimplementar regra com base em snapshot final | Baixo |
| Saldos consolidados | Nao | Nao | Sim | Nova rota `/orcamento/fundos` com agregacao | Baixo |
| Persistencia localStorage | Nao desejavel | Nao | Substituir | Usar Supabase com RLS e auditoria | Alto se tentar manter localStorage |

## Mapa comparativo de tabelas

| App antigo | Kontrol atual | Equivalencia | Observacao |
| --- | --- | --- | --- |
| `budgets` | `orcamento_final_versoes` | Parcial | Kontrol separa demanda, laboratorio, projeto e versao final |
| `budget_versions` | `orcamento_final_versoes` | Parcial | Kontrol ja tem versao final imutavel |
| `budgets.rates` | `orcamento_parametros_aplicados.parametros_snapshot` | Sim | Usar snapshot aplicado, nao valores atuais |
| `budgets.calculation` | `orcamento_parametros_aplicados` + `orcamento_final_versoes.snapshot` | Sim | Kontrol preserva consolidado |
| `localStorage fundTracking` | Ausente | Nao | Criar tabela nova |

## Campos equivalentes

| App antigo | Kontrol proposto |
| --- | --- |
| `budgetId` | `orcamento_final_versao_id` |
| `paidAmount` | `valor_recebido` |
| `legalTaxesPaid` | `impostos_pagos` |
| `incubationPaid` | `incubacao_paga` |
| `reserveSpent` | `reserva_gasta` |
| `investmentSpent` | `investimento_gasto` |
| `calculation.grossTotal` | `orcamento_final_versoes.total_final` |
| `calculation.legalTaxes` | parametro snapshot `impostos_legacy` |
| `calculation.incubationFee` | parametro snapshot `incubacao` |
| `calculation.reserveFund` | parametro snapshot `reserva` |
| `calculation.investmentFund` | parametro snapshot `investimentos` |

## Proposta de arquitetura final

Criar um submodulo `Fundos e taxas` dentro de Orcamentos:

- rota: `/orcamento/fundos`;
- item de menu abaixo de `Historico de orcamentos`;
- card em `/orcamento` abaixo de `Historico de orcamentos`;
- leitura de versoes finais emitidas/aprovadas;
- calculo sempre baseado em snapshots preservados;
- persistencia dos lancamentos em tabela Supabase com RLS e trigger de
  auditoria.

Tabela proposta:

```sql
create table orcamento_fundos_acompanhamento (
  id bigint generated always as identity primary key,
  orcamento_final_versao_id bigint not null references orcamento_final_versoes(id) on delete restrict,
  valor_recebido numeric not null default 0,
  impostos_pagos numeric not null default 0,
  incubacao_paga numeric not null default 0,
  reserva_gasta numeric not null default 0,
  investimento_gasto numeric not null default 0,
  observacao text,
  atualizado_por uuid references auth.users(id),
  atualizado_em timestamptz not null default now(),
  unique (orcamento_final_versao_id)
);
```

Esta tabela deve ter:

- RLS por perfil/permissao de Orcamentos;
- `grant all` para `service_role`;
- trigger `fn_auditoria()`;
- migration aditiva, sem alterar tabelas historicas.

## Regras de calculo propostas

Para cada versao final:

- `percentual_recebido = min(1, max(0, valor_recebido / total_final))`
- `impostos_liberados = impostos_previstos * percentual_recebido`
- `incubacao_liberada = incubacao_prevista * percentual_recebido`
- `reserva_liberada = reserva_prevista * percentual_recebido`
- `investimento_liberado = investimento_previsto * percentual_recebido`

Saldos:

- `impostos_a_pagar = impostos_liberados - impostos_pagos`
- `incubacao_a_pagar = incubacao_liberada - incubacao_paga`
- `reserva_disponivel = reserva_liberada - reserva_gasta`
- `investimento_disponivel = investimento_liberado - investimento_gasto`

## Riscos e pendencias

- Confirmar qual status no Kontrol equivale a "aprovado" para abastecer fundos:
  `aprovado`, `emitido`, ou ambos.
- Confirmar se "Fundo de investimento" do app antigo deve virar apenas
  "Fundo de investimento" ou separar tambem "Reposicao de equipamentos", termo
  ja presente na tela de emissao final.
- Reconfirmar credencial/conexao do banco antigo para levantar dados reais de
  `budgets` e validar se existem acompanhamentos em navegadores locais via
  localStorage.
- Evitar importar localStorage antigo como fonte oficial sem exportacao
  auditavel.

## Ordem incremental recomendada

1. Aprovar este diagnostico e a regra de status que alimenta fundos.
2. Criar backup logico antes da migration.
3. Criar migration aditiva `orcamento_fundos_acompanhamento`.
4. Criar helper puro para extrair parametros de fundo dos snapshots finais.
5. Criar actions de salvar acompanhamento financeiro.
6. Criar rota `/orcamento/fundos`.
7. Adicionar item no menu abaixo de `Historico de orcamentos`.
8. Adicionar card em `/orcamento` abaixo de `Historico de orcamentos`.
9. Testar calculo proporcional, persistencia, RLS e auditoria.

## Criterios de validacao

- Versoes finais aparecem no modulo de fundos.
- Valores previstos de impostos, incubacao, reserva e investimento batem com o
  snapshot da versao final.
- Alterar `valor_recebido` recalcula liberado proporcionalmente.
- Lancamentos persistem no Supabase e aparecem apos recarregar.
- Auditoria registra insert/update/delete.
- O modulo de Orcamentos nao finalizados, Historico e Emissao final continua
  funcionando.
