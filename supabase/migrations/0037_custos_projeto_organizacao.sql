-- =====================================================================
-- Organizacao operacional dos custos de projeto.
-- Migration aditiva: preserva historico, RLS, triggers e compatibilidade
-- com o app antigo de orcamento de projetos.
-- =====================================================================

alter table orcamento_projetos
  add column if not exists projeto_sem_custo_justificativa text;

alter table orcamento_projeto_custos
  add column if not exists etapa text,
  add column if not exists atividade text,
  add column if not exists entrega text,
  add column if not exists categoria_institucional text,
  add column if not exists nomenclatura_origem text not null default 'kontrol';

alter table orcamento_projeto_custos
  drop constraint if exists orcamento_projeto_custos_nomenclatura_origem_check,
  add constraint orcamento_projeto_custos_nomenclatura_origem_check
    check (nomenclatura_origem in ('kontrol','catalogo_institucional','orcamento_projetos_antigo'));

update orcamento_projeto_custos
   set etapa = coalesce(etapa, case rubrica
       when 'PE' then 'Equipe'
       when 'VD' then 'Campo e logistica'
       when 'MC' then 'Materiais e consumo'
       when 'MP' then 'Equipamentos'
       when 'ST' then 'Terceiros'
       else 'Projeto'
     end),
       atividade = coalesce(atividade, categoria),
       entrega = coalesce(entrega, 'Entrega principal'),
       categoria_institucional = coalesce(categoria_institucional, case rubrica
         when 'PE' then 'Pessoal'
         when 'MC' then 'Material de consumo'
         when 'MP' then 'Material permanente'
         when 'ST' then 'Servicos de terceiros'
         when 'VD' then 'Viagens e diarias'
         else 'Outros custos'
       end),
       nomenclatura_origem = case
         when origem = 'orcamento_projetos_antigo' then 'orcamento_projetos_antigo'
         when origem = 'catalogo' then 'catalogo_institucional'
         else coalesce(nomenclatura_origem, 'kontrol')
       end
 where etapa is null
    or atividade is null
    or entrega is null
    or categoria_institucional is null
    or nomenclatura_origem is null;

create index if not exists idx_orcamento_projeto_custos_operacional
  on orcamento_projeto_custos (orcamento_projeto_id, etapa, atividade, entrega);
