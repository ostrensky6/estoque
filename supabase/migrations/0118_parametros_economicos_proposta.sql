-- Parametros economicos no nivel da proposta (DEC-ORC-001, secao 9).
--
-- Os percentuais (impostos, incubacao, reserva, investimentos, lucro) so
-- existiam no orcamento de projeto; proposta "Apenas analises" nao tinha
-- onde guarda-los e saia pelo custo tecnico, sem impostos nem lucro. Estas
-- colunas guardam os percentuais da propria proposta, usados quando ela nao
-- tem orcamento de projeto. Propostas com projeto continuam usando os
-- percentuais do projeto (sem mudanca). Nulo = ainda nao definido: a tela e
-- a emissao usam os padroes de Parametros de custeio.
--
-- Aditiva: so adiciona colunas anulaveis; nao altera dados, RLS nem gatilhos.
-- Rollback: alter table public.demandas_propostas drop column param_* (as
-- colunas sao novas e nao sao lidas por nenhuma versao anterior do app).

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

alter table public.demandas_propostas
  add column if not exists param_impostos numeric,
  add column if not exists param_incubacao numeric,
  add column if not exists param_reserva numeric,
  add column if not exists param_investimentos numeric,
  add column if not exists param_lucro numeric;

alter table public.demandas_propostas
  drop constraint if exists demandas_propostas_param_faixa_check,
  add constraint demandas_propostas_param_faixa_check check (
    coalesce(param_impostos, 0) >= 0
    and coalesce(param_incubacao, 0) >= 0
    and coalesce(param_reserva, 0) >= 0
    and coalesce(param_investimentos, 0) >= 0
    and coalesce(param_lucro, 0) >= 0
    and coalesce(param_impostos, 0) + coalesce(param_incubacao, 0) + coalesce(param_reserva, 0)
      + coalesce(param_investimentos, 0) + coalesce(param_lucro, 0) < 100
  );

comment on column public.demandas_propostas.param_impostos is
  'Percentual de impostos da proposta sem orcamento de projeto (gross-up unico, Politica A).';

commit;
