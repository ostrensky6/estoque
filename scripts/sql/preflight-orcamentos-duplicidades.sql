-- =====================================================================
-- PREFLIGHT — Inventário de duplicidades e inconsistências (módulo Orçamentos)
-- Entrega A / Fase 3.  SOMENTE LEITURA.  NÃO corrige dados.
--
-- Segurança:
--   * Todo o script roda dentro de UMA transação READ ONLY e termina em
--     ROLLBACK. Nenhuma linha é criada, alterada ou removida.
--   * Não há INSERT / UPDATE / DELETE / TRUNCATE / DROP / ALTER / CREATE / GRANT.
--   * Mesmo que algum SELECT seja copiado para fora da transação, ele continua
--     sendo apenas leitura.
--
-- Como executar (recomendado, para ver TODOS os resultados):
--   psql "$DATABASE_URL" -f scripts/sql/preflight-orcamentos-duplicidades.sql
--
-- No Supabase SQL Editor (mostra apenas o último result set): rode primeiro o
-- bloco "RESUMO" e, depois, cada consulta de DETALHE individualmente.
--
-- Schema de referência (migrations 0007/0010/0011/0013/0033/0035/0037/0038/0039/
-- 0040/0041). "Módulo ativo" = status <> 'cancelado' (e, no laboratório, também
-- status_operacional <> 'cancelado').
-- =====================================================================

begin;
set transaction read only;

-- ---------------------------------------------------------------------
-- RESUMO — um panorama (uma linha por verificação, com a contagem).
-- Severidade: ALTA = bloqueia limpeza/emissão; MEDIA = revisar; BAIXA = informativo.
-- ---------------------------------------------------------------------
with
-- A1: demandas com mais de um orçamento laboratorial ATIVO
a1 as (
  select demanda_id
    from orcamentos
   where demanda_id is not null
     and coalesce(status, '') <> 'cancelado'
     and coalesce(status_operacional, '') <> 'cancelado'
   group by demanda_id
  having count(*) > 1
),
-- A2: demandas com mais de um orçamento de projeto ATIVO
a2 as (
  select demanda_id
    from orcamento_projetos
   where demanda_id is not null
     and coalesce(status, '') <> 'cancelado'
   group by demanda_id
  having count(*) > 1
),
-- A3: análises repetidas dentro do MESMO orçamento laboratorial
a3 as (
  select orcamento_id, codigo_analise
    from orcamento_itens
   group by orcamento_id, codigo_analise
  having count(*) > 1
),
-- A4: mesma análise duplicada entre laboratório e análises-dentro-de-projeto
--     na MESMA demanda (risco de dupla contagem em proposta nova)
a4 as (
  select distinct o.demanda_id, oi.codigo_analise
    from orcamento_itens oi
    join orcamentos o on o.id = oi.orcamento_id
   where o.demanda_id is not null
     and coalesce(o.status, '') <> 'cancelado'
   and exists (
        select 1
          from orcamento_projeto_analises opa
          join orcamento_projetos op on op.id = opa.orcamento_projeto_id
         where op.demanda_id = o.demanda_id
           and coalesce(op.status, '') <> 'cancelado'
           and opa.codigo_analise = oi.codigo_analise
   )
),
-- A5: custos de catálogo repetidos no MESMO orçamento de projeto
--     (mesma categoria + descrição normalizada)
a5 as (
  select orcamento_projeto_id, categoria, lower(btrim(descricao)) as descricao_norm
    from orcamento_projeto_custos
   group by orcamento_projeto_id, categoria, lower(btrim(descricao))
  having count(*) > 1
),
-- A6: versões finais EMITIDAS cujo snapshot inclui módulos cancelados
a6 as (
  select v.id, v.demanda_id, v.numero
    from orcamento_final_versoes v
   where v.status = 'emitido'
     and (
       exists (
         select 1
           from jsonb_array_elements(coalesce(v.snapshot->'orcamentos_analises', '[]'::jsonb)) e
          where e->>'status' = 'cancelado'
       )
       or exists (
         select 1
           from jsonb_array_elements(coalesce(v.snapshot->'orcamentos_projeto', '[]'::jsonb)) e
          where e->>'status' = 'cancelado'
       )
     )
),
-- A7: números de versão final duplicados (protegido por UNIQUE; deve ser 0)
a7 as (
  select numero
    from orcamento_final_versoes
   group by numero
  having count(*) > 1
),
-- A8: mais de uma versão VIGENTE (status = 'emitido') por demanda
a8 as (
  select demanda_id
    from orcamento_final_versoes
   where status = 'emitido'
   group by demanda_id
  having count(*) > 1
),
-- A9: parâmetros aplicados duplicados (mais de um por versão final emitida)
a9 as (
  select orcamento_final_versao_id
    from orcamento_parametros_aplicados
   where orcamento_final_versao_id is not null
   group by orcamento_final_versao_id
  having count(*) > 1
),
-- A10: registros órfãos — módulos sem demanda vinculada e parâmetros sem versão
a10_orc as (
  select id from orcamentos where demanda_id is null
),
a10_proj as (
  select id from orcamento_projetos where demanda_id is null
),
a10_par as (
  select id from orcamento_parametros_aplicados
   where orcamento_final_versao_id is null and demanda_id is null
),
-- A11: modalidades legadas e canônica coexistindo em demandas_propostas
a11 as (
  select modalidade, count(*) as qtd
    from demandas_propostas
   where modalidade in ('analises_projeto','projeto_analises_custos','projeto_com_analises')
   group by modalidade
),
a11_coexistem as (
  select 1
   where (select count(*) from a11 where modalidade in ('analises_projeto','projeto_analises_custos')) > 0
     and (select count(*) from a11 where modalidade = 'projeto_com_analises') > 0
),
-- A12: status incompatíveis entre demanda / módulos / proposta final
a12_orcada_sem_modulo as (
  select d.id
    from demandas_propostas d
   where d.status = 'orcada'
     and not exists (select 1 from orcamentos o where o.demanda_id = d.id and coalesce(o.status,'') <> 'cancelado')
     and not exists (select 1 from orcamento_projetos p where p.demanda_id = d.id and coalesce(p.status,'') <> 'cancelado')
),
a12_aprovada_sem_versao as (
  select d.id
    from demandas_propostas d
   where d.status = 'aprovada'
     and not exists (select 1 from orcamento_final_versoes v where v.demanda_id = d.id and v.status in ('emitido','substituido'))
),
a12_versao_em_demanda_cancelada as (
  select v.id
    from orcamento_final_versoes v
    join demandas_propostas d on d.id = v.demanda_id
   where v.status = 'emitido'
     and d.status = 'cancelada'
),
-- A13: itens com custo <= 0 sem justificativa
a13_lab as (
  select id from orcamento_itens where coalesce(custo_unitario,0) <= 0
),
a13_proj_analises as (
  select id from orcamento_projeto_analises where coalesce(custo_unitario,0) <= 0
),
a13_proj_custos as (
  select c.id
    from orcamento_projeto_custos c
    join orcamento_projetos p on p.id = c.orcamento_projeto_id
   where coalesce(c.custo_unitario,0) <= 0
     and coalesce(btrim(p.projeto_sem_custo_justificativa), '') = ''
),
-- A14: total_final que não reconcilia com o snapshot.consolidado.totalFinal
a14 as (
  select v.id, v.numero, v.total_final,
         (v.snapshot->'consolidado'->>'totalFinal')::numeric as total_snapshot
    from orcamento_final_versoes v
   where v.snapshot ? 'consolidado'
     and (v.snapshot->'consolidado'->>'totalFinal') ~ '^-?[0-9]+(\.[0-9]+)?$'
     and abs(v.total_final - (v.snapshot->'consolidado'->>'totalFinal')::numeric) > 0.01
),
resumo as (
  select 'A1'  as id, 'ALTA'  as severidade, 'demandas com >1 orçamento laboratorial ativo'                  as descricao, (select count(*) from a1)  as ocorrencias
  union all select 'A2','ALTA','demandas com >1 orçamento de projeto ativo',                                  (select count(*) from a2)
  union all select 'A3','ALTA','análises repetidas no mesmo orçamento laboratorial',                          (select count(*) from a3)
  union all select 'A4','ALTA','mesma análise duplicada entre laboratório e análises-de-projeto (mesma demanda)', (select count(*) from a4)
  union all select 'A5','MEDIA','custos de catálogo repetidos no mesmo orçamento de projeto',                  (select count(*) from a5)
  union all select 'A6','ALTA','versões finais emitidas com módulos cancelados no snapshot',                   (select count(*) from a6)
  union all select 'A7','ALTA','números de versão final duplicados (deve ser 0 — UNIQUE)',                     (select count(*) from a7)
  union all select 'A8','ALTA','mais de uma versão vigente (emitida) por demanda',                            (select count(*) from a8)
  union all select 'A9','ALTA','parâmetros aplicados duplicados por versão final',                            (select count(*) from a9)
  union all select 'A10','MEDIA','registros órfãos (módulos sem demanda / parâmetros sem versão)',            (select (select count(*) from a10_orc)+(select count(*) from a10_proj)+(select count(*) from a10_par))
  union all select 'A11','MEDIA','modalidades legadas e canônica coexistindo',                                (select case when exists (select 1 from a11_coexistem) then (select count(*) from a11) else 0 end)
  union all select 'A12','ALTA','status incompatíveis (demanda/módulos/proposta)',                            (select (select count(*) from a12_orcada_sem_modulo)+(select count(*) from a12_aprovada_sem_versao)+(select count(*) from a12_versao_em_demanda_cancelada))
  union all select 'A13','MEDIA','itens com custo zero sem justificativa',                                    (select (select count(*) from a13_lab)+(select count(*) from a13_proj_analises)+(select count(*) from a13_proj_custos))
  union all select 'A14','ALTA','total final que não reconcilia com o snapshot',                              (select count(*) from a14)
)
select id, severidade, descricao, ocorrencias
  from resumo
 order by id;

rollback;

-- =====================================================================
-- DETALHE — consultas individuais (todas SOMENTE LEITURA).
-- Rode cada bloco isoladamente para ver as linhas ofensoras.
-- Sugerido envolver em:  begin; set transaction read only;  <select>  ; rollback;
-- =====================================================================

-- A1 — demandas com >1 orçamento laboratorial ativo
-- select demanda_id, count(*) as qtd, array_agg(id order by id) as orcamentos
--   from orcamentos
--  where demanda_id is not null and coalesce(status,'')<>'cancelado'
--    and coalesce(status_operacional,'')<>'cancelado'
--  group by demanda_id having count(*) > 1 order by qtd desc;

-- A2 — demandas com >1 orçamento de projeto ativo
-- select demanda_id, count(*) as qtd, array_agg(id order by id) as projetos
--   from orcamento_projetos
--  where demanda_id is not null and coalesce(status,'')<>'cancelado'
--  group by demanda_id having count(*) > 1 order by qtd desc;

-- A3 — análises repetidas no mesmo orçamento laboratorial
-- select orcamento_id, codigo_analise, count(*) as qtd, array_agg(id order by id) as itens
--   from orcamento_itens group by orcamento_id, codigo_analise
--  having count(*) > 1 order by qtd desc;

-- A4 — mesma análise em laboratório e em análises-de-projeto na mesma demanda
-- select o.demanda_id, oi.codigo_analise
--   from orcamento_itens oi join orcamentos o on o.id = oi.orcamento_id
--  where o.demanda_id is not null and coalesce(o.status,'')<>'cancelado'
--    and exists (select 1 from orcamento_projeto_analises opa
--                  join orcamento_projetos op on op.id = opa.orcamento_projeto_id
--                 where op.demanda_id = o.demanda_id and coalesce(op.status,'')<>'cancelado'
--                   and opa.codigo_analise = oi.codigo_analise)
--  group by o.demanda_id, oi.codigo_analise order by o.demanda_id;

-- A5 — custos de catálogo repetidos no mesmo orçamento de projeto
-- select orcamento_projeto_id, categoria, lower(btrim(descricao)) as descricao_norm,
--        count(*) as qtd, array_agg(id order by id) as custos
--   from orcamento_projeto_custos
--  group by orcamento_projeto_id, categoria, lower(btrim(descricao))
--  having count(*) > 1 order by qtd desc;

-- A6 — versões finais emitidas com módulos cancelados no snapshot
-- select v.id, v.demanda_id, v.numero
--   from orcamento_final_versoes v
--  where v.status = 'emitido'
--    and (exists (select 1 from jsonb_array_elements(coalesce(v.snapshot->'orcamentos_analises','[]'::jsonb)) e where e->>'status'='cancelado')
--      or exists (select 1 from jsonb_array_elements(coalesce(v.snapshot->'orcamentos_projeto','[]'::jsonb)) e where e->>'status'='cancelado'));

-- A7 — números de versão final duplicados (deve ser 0)
-- select numero, count(*) from orcamento_final_versoes group by numero having count(*) > 1;

-- A8 — mais de uma versão vigente (emitida) por demanda
-- select demanda_id, count(*) as qtd, array_agg(versao order by versao) as versoes
--   from orcamento_final_versoes where status='emitido' group by demanda_id having count(*) > 1;

-- A9 — parâmetros aplicados duplicados por versão final
-- select orcamento_final_versao_id, count(*) as qtd, array_agg(id order by id) as registros
--   from orcamento_parametros_aplicados where orcamento_final_versao_id is not null
--  group by orcamento_final_versao_id having count(*) > 1;

-- A10 — registros órfãos
-- select 'orcamento' as origem, id from orcamentos where demanda_id is null
-- union all select 'orcamento_projeto', id from orcamento_projetos where demanda_id is null
-- union all select 'parametros_aplicados', id from orcamento_parametros_aplicados
--           where orcamento_final_versao_id is null and demanda_id is null;

-- A11 — modalidades legadas e canônica coexistindo
-- select modalidade, count(*) as qtd from demandas_propostas
--  where modalidade in ('analises_projeto','projeto_analises_custos','projeto_com_analises')
--  group by modalidade order by modalidade;

-- A12 — status incompatíveis
-- select 'orcada_sem_modulo' as caso, id from demandas_propostas d
--   where d.status='orcada'
--     and not exists (select 1 from orcamentos o where o.demanda_id=d.id and coalesce(o.status,'')<>'cancelado')
--     and not exists (select 1 from orcamento_projetos p where p.demanda_id=d.id and coalesce(p.status,'')<>'cancelado')
-- union all
-- select 'aprovada_sem_versao', id from demandas_propostas d
--   where d.status='aprovada'
--     and not exists (select 1 from orcamento_final_versoes v where v.demanda_id=d.id and v.status in ('emitido','substituido'))
-- union all
-- select 'versao_em_demanda_cancelada', v.id from orcamento_final_versoes v
--   join demandas_propostas d on d.id=v.demanda_id where v.status='emitido' and d.status='cancelada';

-- A13 — itens com custo zero sem justificativa
-- select 'lab_item' as origem, id from orcamento_itens where coalesce(custo_unitario,0) <= 0
-- union all select 'proj_analise', id from orcamento_projeto_analises where coalesce(custo_unitario,0) <= 0
-- union all select 'proj_custo', c.id from orcamento_projeto_custos c
--           join orcamento_projetos p on p.id=c.orcamento_projeto_id
--          where coalesce(c.custo_unitario,0) <= 0 and coalesce(btrim(p.projeto_sem_custo_justificativa),'')='';

-- A14 — total final que não reconcilia com o snapshot
-- select v.id, v.numero, v.total_final,
--        (v.snapshot->'consolidado'->>'totalFinal')::numeric as total_snapshot,
--        v.total_final - (v.snapshot->'consolidado'->>'totalFinal')::numeric as diferenca
--   from orcamento_final_versoes v
--  where v.snapshot ? 'consolidado'
--    and (v.snapshot->'consolidado'->>'totalFinal') ~ '^-?[0-9]+(\.[0-9]+)?$'
--    and abs(v.total_final - (v.snapshot->'consolidado'->>'totalFinal')::numeric) > 0.01;

-- A15 — conflito de numeração de migrations aplicadas (ledger do Supabase).
--       Detecta dois arquivos com o mesmo prefixo numérico (ex.: 0041) aplicados.
--       Observação: o conflito 0041 desta entrega é de REPOSITÓRIO (arquivos),
--       resolvido na revisão de integração; esta consulta cobre o que já foi aplicado.
-- select left(version, 4) as prefixo, count(*) as qtd, array_agg(version order by version) as versions
--   from supabase_migrations.schema_migrations
--  group by left(version, 4) having count(*) > 1 order by prefixo;
