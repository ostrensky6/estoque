// Metadados e consultas de DETALHE do preflight de Orçamentos (Fase 3).
// Cada `sql` é um SELECT puro (somente-leitura); o runner valida isso e o
// envolve em `begin; set transaction read only; … rollback;` na execução.
// Fonte única para o runner e o planejador dry-run. Mantém paridade com
// scripts/sql/preflight-orcamentos-duplicidades.sql.

/**
 * decisao: 'automatizavel' | 'parcial' | 'manual'
 *   - automatizavel: regra determinística, baixo risco;
 *   - parcial: parte automatizável, parte exige confirmação;
 *   - manual: exige decisão humana.
 */
export const CHECKS = [
  {
    id: "A1",
    severidade: "ALTA",
    descricao: "demandas com >1 orçamento laboratorial ativo",
    decisao: "parcial",
    acao: "eleger módulo canônico, remapear referências, cancelar os demais",
    canonicoRegra: "referenciado por versão final → revisado → mais itens válidos → mais recente",
    constraintSugerida:
      "create unique index on orcamentos (demanda_id) where status <> 'cancelado' and status_operacional <> 'cancelado';",
    ordem: 2,
    sql: `select demanda_id, count(*) as qtd, array_agg(id order by id) as orcamentos
            from orcamentos
           where demanda_id is not null
             and coalesce(status,'') <> 'cancelado'
             and coalesce(status_operacional,'') <> 'cancelado'
           group by demanda_id having count(*) > 1 order by qtd desc`,
  },
  {
    id: "A2",
    severidade: "ALTA",
    descricao: "demandas com >1 orçamento de projeto ativo",
    decisao: "parcial",
    acao: "eleger módulo canônico, remapear referências, cancelar os demais",
    canonicoRegra: "referenciado por versão final → aprovado → mais itens válidos → mais recente",
    constraintSugerida:
      "create unique index on orcamento_projetos (demanda_id) where status <> 'cancelado';",
    ordem: 2,
    sql: `select demanda_id, count(*) as qtd, array_agg(id order by id) as projetos
            from orcamento_projetos
           where demanda_id is not null and coalesce(status,'') <> 'cancelado'
           group by demanda_id having count(*) > 1 order by qtd desc`,
  },
  {
    id: "A3",
    severidade: "ALTA",
    descricao: "análises repetidas no mesmo orçamento laboratorial",
    decisao: "parcial",
    acao: "consolidar somando n_amostras na linha canônica; logar valores originais",
    canonicoRegra: "menor id por (orcamento_id, codigo_analise)",
    constraintSugerida: "create unique index on orcamento_itens (orcamento_id, codigo_analise);",
    ordem: 3,
    sql: `select orcamento_id, codigo_analise, count(*) as qtd, array_agg(id order by id) as itens
            from orcamento_itens
           group by orcamento_id, codigo_analise having count(*) > 1 order by qtd desc`,
  },
  {
    id: "A4",
    severidade: "ALTA",
    descricao: "mesma análise duplicada entre laboratório e análises-de-projeto (mesma demanda)",
    decisao: "manual",
    acao: "definir fonte canônica (orcamentos/orcamento_itens); remover duplicata da fonte legada (Fase 4)",
    canonicoRegra: "fonte canônica = orcamento_itens; orcamento_projeto_analises só compatibilidade",
    constraintSugerida: "validação de aplicação (Fase 4) — sem constraint cross-table trivial",
    ordem: 4,
    sql: `select o.demanda_id, oi.codigo_analise
            from orcamento_itens oi
            join orcamentos o on o.id = oi.orcamento_id
           where o.demanda_id is not null and coalesce(o.status,'') <> 'cancelado'
             and exists (select 1 from orcamento_projeto_analises opa
                           join orcamento_projetos op on op.id = opa.orcamento_projeto_id
                          where op.demanda_id = o.demanda_id and coalesce(op.status,'') <> 'cancelado'
                            and opa.codigo_analise = oi.codigo_analise)
           group by o.demanda_id, oi.codigo_analise order by o.demanda_id`,
  },
  {
    id: "A5",
    severidade: "MEDIA",
    descricao: "custos de catálogo repetidos no mesmo orçamento de projeto",
    decisao: "manual",
    acao: "revisar caso a caso (pode ser repetição legítima); consolidar quando indevido",
    canonicoRegra: "menor id por (orcamento_projeto_id, categoria, descricao_norm) quando indevido",
    constraintSugerida:
      "condicional — só se o negócio confirmar que não há repetição legítima",
    ordem: 5,
    sql: `select orcamento_projeto_id, categoria, lower(btrim(descricao)) as descricao_norm,
                 count(*) as qtd, array_agg(id order by id) as custos
            from orcamento_projeto_custos
           group by orcamento_projeto_id, categoria, lower(btrim(descricao))
           having count(*) > 1 order by qtd desc`,
  },
  {
    id: "A6",
    severidade: "ALTA",
    descricao: "versões finais emitidas com módulos cancelados no snapshot",
    decisao: "manual",
    acao: "NÃO recalcular versão histórica; sinalizar; corrigir fluxo de emissão (Fase 9)",
    canonicoRegra: "n/a (não se deduplica versão histórica)",
    constraintSugerida: "validação na emissão (Fase 9), não constraint de tabela",
    ordem: 9,
    sql: `select v.id, v.demanda_id, v.numero
            from orcamento_final_versoes v
           where v.status = 'emitido'
             and (exists (select 1 from jsonb_array_elements(coalesce(v.snapshot->'orcamentos_analises','[]'::jsonb)) e where e->>'status' = 'cancelado')
               or exists (select 1 from jsonb_array_elements(coalesce(v.snapshot->'orcamentos_projeto','[]'::jsonb)) e where e->>'status' = 'cancelado'))`,
  },
  {
    id: "A7",
    severidade: "ALTA",
    descricao: "números de versão final duplicados (deve ser 0 — UNIQUE)",
    decisao: "manual",
    acao: "incidente — investigar bypass de constraint se aparecer",
    canonicoRegra: "n/a",
    constraintSugerida: "já existe UNIQUE(numero)",
    ordem: 9,
    sql: `select numero, count(*) as qtd from orcamento_final_versoes
           group by numero having count(*) > 1`,
  },
  {
    id: "A8",
    severidade: "ALTA",
    descricao: "mais de uma versão vigente (emitida) por demanda",
    decisao: "parcial",
    acao: "manter maior versao como 'emitido'; anteriores → 'substituido' (não apagar)",
    canonicoRegra: "maior versao por demanda permanece emitido",
    constraintSugerida:
      "create unique index on orcamento_final_versoes (demanda_id) where status = 'emitido';",
    ordem: 8,
    sql: `select demanda_id, count(*) as qtd, array_agg(versao order by versao) as versoes
            from orcamento_final_versoes where status = 'emitido'
           group by demanda_id having count(*) > 1`,
  },
  {
    id: "A9",
    severidade: "ALTA",
    descricao: "parâmetros aplicados duplicados por versão final",
    decisao: "parcial",
    acao: "manter o consistente com total_final da versão; arquivar duplicatas",
    canonicoRegra: "registro com total_final == versão; desempate por criado_em",
    constraintSugerida:
      "create unique index on orcamento_parametros_aplicados (orcamento_final_versao_id) where orcamento_final_versao_id is not null;",
    ordem: 8,
    sql: `select orcamento_final_versao_id, count(*) as qtd, array_agg(id order by id) as registros
            from orcamento_parametros_aplicados where orcamento_final_versao_id is not null
           group by orcamento_final_versao_id having count(*) > 1`,
  },
  {
    id: "A10",
    severidade: "MEDIA",
    descricao: "registros órfãos (módulos sem demanda / parâmetros sem versão)",
    decisao: "manual",
    acao: "vincular à demanda correta ou arquivar; NÃO deletar sem backup/relatório",
    canonicoRegra: "n/a",
    constraintSugerida: "avaliar tornar demanda_id obrigatório após sanar (not valid + validate)",
    ordem: 6,
    sql: `select 'orcamento' as origem, id from orcamentos where demanda_id is null
           union all select 'orcamento_projeto', id from orcamento_projetos where demanda_id is null
           union all select 'parametros_aplicados', id from orcamento_parametros_aplicados
                     where orcamento_final_versao_id is null and demanda_id is null`,
  },
  {
    id: "A11",
    severidade: "MEDIA",
    descricao: "modalidades legadas e canônica coexistindo",
    decisao: "automatizavel",
    acao: "normalizar legadas → projeto_com_analises via migration 0045 (aditiva)",
    canonicoRegra: "projeto_com_analises é canônica; legadas normalizadas no backfill",
    constraintSugerida: "check ampliado da 0045; opcional remover legadas do check após backfill",
    ordem: 1,
    // Distribuição; o runner deriva coexistência (legadas + canônica presentes).
    sql: `select modalidade, count(*) as qtd from demandas_propostas
           where modalidade in ('analises_projeto','projeto_analises_custos','projeto_com_analises')
           group by modalidade order by modalidade`,
    tipoContagem: "coexistencia",
  },
  {
    id: "A12",
    severidade: "ALTA",
    descricao: "status incompatíveis (demanda/módulos/proposta)",
    decisao: "manual",
    acao: "reconciliar status conforme ciclo de vida (Fase 8), preservando datas/auditoria",
    canonicoRegra: "n/a (reconciliação de status)",
    constraintSugerida: "validações de transição de status no servidor (Fase 8)",
    ordem: 7,
    sql: `select 'orcada_sem_modulo' as caso, d.id from demandas_propostas d
           where d.status='orcada'
             and not exists (select 1 from orcamentos o where o.demanda_id=d.id and coalesce(o.status,'')<>'cancelado')
             and not exists (select 1 from orcamento_projetos p where p.demanda_id=d.id and coalesce(p.status,'')<>'cancelado')
          union all
          select 'aprovada_sem_versao', d.id from demandas_propostas d
           where d.status='aprovada'
             and not exists (select 1 from orcamento_final_versoes v where v.demanda_id=d.id and v.status in ('emitido','substituido'))
          union all
          select 'versao_em_demanda_cancelada', v.id from orcamento_final_versoes v
            join demandas_propostas d on d.id=v.demanda_id where v.status='emitido' and d.status='cancelada'`,
  },
  {
    id: "A13",
    severidade: "MEDIA",
    descricao: "itens com custo zero sem justificativa",
    decisao: "manual",
    acao: "exigir flag de isenção + justificativa + responsável + aprovação (Fase 7)",
    canonicoRegra: "n/a (completude/política)",
    constraintSugerida: "validação de emissão (Fase 7) — zero pode ser legítimo com isenção",
    ordem: 7,
    sql: `select 'lab_item' as origem, id from orcamento_itens where coalesce(custo_unitario,0) <= 0
          union all select 'proj_analise', id from orcamento_projeto_analises where coalesce(custo_unitario,0) <= 0
          union all select 'proj_custo', c.id from orcamento_projeto_custos c
                     join orcamento_projetos p on p.id = c.orcamento_projeto_id
                    where coalesce(c.custo_unitario,0) <= 0 and coalesce(btrim(p.projeto_sem_custo_justificativa),'') = ''`,
  },
  {
    id: "A14",
    severidade: "ALTA",
    descricao: "total final que não reconcilia com o snapshot",
    decisao: "manual",
    acao: "investigar engine (Fase 6 — DEC-ORC-001); NÃO reescrever snapshots históricos",
    canonicoRegra: "n/a (bug de cálculo)",
    constraintSugerida: "teste de reconciliação no pipeline (validação financeira)",
    ordem: 9,
    sql: `select v.id, v.numero, v.total_final,
                 (v.snapshot->'consolidado'->>'totalFinal')::numeric as total_snapshot,
                 v.total_final - (v.snapshot->'consolidado'->>'totalFinal')::numeric as diferenca
            from orcamento_final_versoes v
           where v.snapshot ? 'consolidado'
             and (v.snapshot->'consolidado'->>'totalFinal') ~ '^-?[0-9]+(\\.[0-9]+)?$'
             and abs(v.total_final - (v.snapshot->'consolidado'->>'totalFinal')::numeric) > 0.01`,
  },
  {
    id: "A15",
    severidade: "ALTA",
    descricao: "conflito de numeração de migrations aplicadas",
    decisao: "automatizavel",
    acao: "RESOLVIDO no repo: migration de modalidade renumerada 0041 → 0045",
    canonicoRegra: "n/a",
    constraintSugerida: "convenção de numeração na integração",
    ordem: 1,
    tolerante: true, // schema_migrations pode não ser acessível em todo ambiente
    sql: `select left(version, 4) as prefixo, count(*) as qtd, array_agg(version order by version) as versions
            from supabase_migrations.schema_migrations
           group by left(version, 4) having count(*) > 1 order by prefixo`,
  },
];
