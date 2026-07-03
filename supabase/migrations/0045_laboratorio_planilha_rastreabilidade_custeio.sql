-- =====================================================================
-- Rastreabilidade da planilha Laboratorio1.xlsm e correções de vínculo.
-- Migration aditiva/idempotente: não remove dados, não altera histórico
-- emitido e resolve apenas relações seguras.
-- =====================================================================

alter table insumo_analise
  add column if not exists etapa_id bigint references etapas(id) on delete set null;

comment on column insumo_analise.etapa_id is
  'Vínculo estável com etapas.id. Backfill automático apenas quando codigo_analise + etapa + atividade identificam uma única etapa.';

create index if not exists idx_insumo_analise_etapa_id on insumo_analise (etapa_id);

with candidatos as (
  select
    ia.id as insumo_analise_id,
    min(e.id) as etapa_id,
    count(*) as total
  from insumo_analise ia
  join etapas e
    on e.codigo_analise = ia.codigo_analise
   and e.nome_etapa = ia.nome_etapa
   and e.nome_atividade = ia.nome_atividade
  where ia.etapa_id is null
  group by ia.id
)
update insumo_analise ia
   set etapa_id = c.etapa_id
  from candidatos c
 where ia.id = c.insumo_analise_id
   and c.total = 1;

-- Aliases observados na aba MCA: a planilha aponta por texto para itens que
-- existem no MC com especificação canônica diferente. Mantemos
-- especificacao_insumo como veio da planilha e resolvemos o id do catálogo.
update insumo_analise ia
   set insumo_id = i.id
  from insumos i
 where ia.insumo_id is null
   and ia.especificacao_insumo = 'QuantiNova® SYBR®Green RT-PCR Kit'
   and i.especificacao = 'QuantiNova® SYBR®Green RT-PCR Kit (2500 reações)';

update insumo_analise ia
   set insumo_id = i.id
  from insumos i
 where ia.insumo_id is null
   and ia.especificacao_insumo = 'dNTP mix 10 mM. Kit c/ 800 uL (4 x 200 uL)'
   and i.especificacao = 'dNTP mix 10 mM - 1 mL';

create or replace view v_insumo_analise_pendencias as
select
  ia.id,
  ia.codigo_analise,
  ia.nome_etapa,
  ia.nome_atividade,
  ia.especificacao_insumo,
  ia.insumo_id,
  ia.etapa_id,
  case
    when ia.insumo_id is null and ia.especificacao_insumo is not null then 'insumo_sem_catalogo'
    when ia.etapa_id is null then 'etapa_ambigua_ou_inexistente'
    else 'ok'
  end as status_vinculo
from insumo_analise ia
where ia.insumo_id is null
   or ia.etapa_id is null;

grant select on v_insumo_analise_pendencias to authenticated, service_role;
