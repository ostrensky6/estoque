-- Separa oferta comercial do estado ativo e classifica etapas pos-analise.
-- Migration aditiva/idempotente: nao remove dados, nao altera ids e nao toca historico de orcamentos.

alter table analises
  add column if not exists ofertavel boolean not null default false;

comment on column analises.ofertavel is
  'Controla se a analise pode entrar em novos orcamentos. Diferente de ativo, que preserva o cadastro administrativo/historico.';

update analises
   set ofertavel = true
 where codigo in (
   'Eletrof_vir_hem',
   'Eletrof_vir_tec',
   'Illumina_16S_AC',
   'Illumina_Sh',
   'qPCR_F',
   'qPCR_SF',
   'RTqPCR_RNA_virus_H',
   'RTqPCR_RNA_virus_T',
   'Sanger'
 );

update analises
   set ofertavel = false
 where codigo in (
   'Illumina_16S_BC',
   'Illumina_DNA_P_AC',
   'Illumina_DNA_P_BC',
   'Illumina_Sh_qPCR'
 );

alter table etapas
  add column if not exists escopo_operacional text not null default 'laboratorio';

comment on column etapas.escopo_operacional is
  'Classifica a etapa como laboratorio ou pos_analise. Bioinformatica deve ficar fora de estoque e capacidade laboratorial.';

update etapas
   set escopo_operacional = 'laboratorio'
 where escopo_operacional is null
    or btrim(escopo_operacional) = '';

update etapas
   set escopo_operacional = 'pos_analise'
 where nome_etapa ilike '%bioinform%'
    or nome_atividade ilike '%bioinform%';

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'etapas_escopo_operacional_check'
       and conrelid = 'public.etapas'::regclass
  ) then
    alter table etapas
      add constraint etapas_escopo_operacional_check
      check (escopo_operacional in ('laboratorio', 'pos_analise'));
  end if;
end $$;
