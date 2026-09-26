-- Incubacao da ATGC na UFPR: taxa percentual e valor fixo sao coisas diferentes.
--
-- 1) Taxa de incubacao: percentual (padrao 2%) sobre o valor dos servicos de
--    cada nota fiscal. Vira o parametro global 'taxa_incubacao', editavel em
--    Parametros de custeio; e o padrao do campo "Taxa de incubacao" da
--    proposta (antes o padrao vinha de "Taxas administrativas", outra coisa).
-- 2) Valor fixo mensal da incubacao: custo fixo, nao depende de cada proposta.
--    Entra como linha de Overhead (rateada nas horas de bancada), criada com
--    custo 0 para o usuario informar o valor. So cria se ainda nao houver
--    linha de overhead sobre incubacao.
--
-- Aditiva: so insere quando nao existe; nao altera valores ja cadastrados.
-- Rollback: delete from parametros where chave = 'taxa_incubacao';
--           delete from overhead where item = 'Incubação UFPR (valor fixo mensal)' and custo_mensal = 0;

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

insert into public.parametros (chave, valor, unidade, descricao)
values (
  'taxa_incubacao', 2, '%',
  'Taxa de incubação (UFPR) sobre o valor dos serviços de cada nota fiscal.'
)
on conflict (chave) do nothing;

insert into public.overhead (item, custo_mensal, percentual_compensada, horas_bancada_mes)
select
  'Incubação UFPR (valor fixo mensal)',
  0,
  100,
  coalesce(
    (select o.horas_bancada_mes from public.overhead o order by o.id limit 1),
    (select p.valor from public.parametros p where p.chave = 'horas_bancada_mes'),
    450
  )
where not exists (
  select 1 from public.overhead o where o.item ilike '%incuba%'
);

commit;
