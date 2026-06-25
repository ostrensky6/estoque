-- Importacao tecnica do Laboratorio1.xlsm e selecao de analises por grupo.
-- Aditivo: preserva tabelas existentes e historico comercial.

alter table analises add column if not exists origem_dados text;
alter table analises add column if not exists prazo_maximo_dias numeric;
alter table analises add column if not exists amostras_por_execucao_gargalo numeric;
alter table analises add column if not exists amostras_por_dia_gargalo numeric;
alter table analises add column if not exists custo_equipamento_amostra numeric;
alter table analises add column if not exists tempo_maquina_horas numeric;
alter table analises add column if not exists tempo_bancada_horas numeric;

comment on column analises.origem_dados is 'Fonte do cadastro tecnico. Para as receitas iniciais: Laboratorio1.xlsm/Sintese.';

alter table insumos add column if not exists ativo boolean not null default true;

alter table insumo_analise add column if not exists status_vinculo_insumo text not null default 'ok'
  check (status_vinculo_insumo in ('ok','insumo_sem_cadastro_correspondente'));
alter table insumo_analise add column if not exists custo_unitario_snapshot numeric;
alter table insumo_analise add column if not exists custo_por_amostra numeric;
alter table insumo_analise add column if not exists custo_por_execucao numeric;

update insumo_analise ia
   set status_vinculo_insumo = case when ia.insumo_id is null then 'insumo_sem_cadastro_correspondente' else 'ok' end,
       custo_unitario_snapshot = i.custo_unitario,
       custo_por_amostra = case
         when ia.modo_cobranca = 'por_execucao' then null
         else coalesce(ia.quantidade_por_amostra, 0) * coalesce(i.custo_unitario, 0)
       end,
       custo_por_execucao = case
         when ia.modo_cobranca = 'por_execucao' then coalesce(ia.quantidade_por_amostra, 0) * coalesce(i.custo_unitario, 0)
         else null
       end
  from insumos i
 where i.id = ia.insumo_id;

update insumo_analise
   set status_vinculo_insumo = 'insumo_sem_cadastro_correspondente',
       custo_unitario_snapshot = null,
       custo_por_amostra = null,
       custo_por_execucao = null
 where insumo_id is null;

insert into analises (codigo, nome, nome_simplificado, descricao, status, ativo, origem_dados)
values
  ('Eletrof_vir_hem', 'Eletrof_vir_hem', coalesce((select nome_simplificado from analises where codigo = 'Eletrof_vir_hem'), 'Eletrof_vir_hem'), 'Importado da aba Sintese do Laboratorio1.xlsm', coalesce((select status from analises where codigo = 'Eletrof_vir_hem'), 'Ativo'), true, 'Laboratorio1.xlsm/Sintese'),
  ('Eletrof_vir_tec', 'Eletrof_vir_tec', coalesce((select nome_simplificado from analises where codigo = 'Eletrof_vir_tec'), 'Eletrof_vir_tec'), 'Importado da aba Sintese do Laboratorio1.xlsm', coalesce((select status from analises where codigo = 'Eletrof_vir_tec'), 'Ativo'), true, 'Laboratorio1.xlsm/Sintese'),
  ('Illumina_Sh', 'Illumina_Sh', coalesce((select nome_simplificado from analises where codigo = 'Illumina_Sh'), 'Illumina_Sh'), 'Importado da aba Sintese do Laboratorio1.xlsm', coalesce((select status from analises where codigo = 'Illumina_Sh'), 'Ativo'), true, 'Laboratorio1.xlsm/Sintese'),
  ('Illumina_Sh_qPCR', 'Illumina_Sh_qPCR', coalesce((select nome_simplificado from analises where codigo = 'Illumina_Sh_qPCR'), 'Illumina_Sh_qPCR'), 'Importado da aba Sintese do Laboratorio1.xlsm', coalesce((select status from analises where codigo = 'Illumina_Sh_qPCR'), 'Ativo'), true, 'Laboratorio1.xlsm/Sintese'),
  ('Illumina_16S_AC', 'Illumina_16S_AC', coalesce((select nome_simplificado from analises where codigo = 'Illumina_16S_AC'), 'Illumina_16S_AC'), 'Importado da aba Sintese do Laboratorio1.xlsm', coalesce((select status from analises where codigo = 'Illumina_16S_AC'), 'Ativo'), true, 'Laboratorio1.xlsm/Sintese'),
  ('Illumina_16S_BC', 'Illumina_16S_BC', coalesce((select nome_simplificado from analises where codigo = 'Illumina_16S_BC'), 'Illumina_16S_BC'), 'Importado da aba Sintese do Laboratorio1.xlsm', coalesce((select status from analises where codigo = 'Illumina_16S_BC'), 'Ativo'), true, 'Laboratorio1.xlsm/Sintese'),
  ('Illumina_DNA_P_AC', 'Illumina_DNA_P_AC', coalesce((select nome_simplificado from analises where codigo = 'Illumina_DNA_P_AC'), 'Illumina_DNA_P_AC'), 'Importado da aba Sintese do Laboratorio1.xlsm', coalesce((select status from analises where codigo = 'Illumina_DNA_P_AC'), 'Ativo'), true, 'Laboratorio1.xlsm/Sintese'),
  ('Illumina_DNA_P_BC', 'Illumina_DNA_P_BC', coalesce((select nome_simplificado from analises where codigo = 'Illumina_DNA_P_BC'), 'Illumina_DNA_P_BC'), 'Importado da aba Sintese do Laboratorio1.xlsm', coalesce((select status from analises where codigo = 'Illumina_DNA_P_BC'), 'Ativo'), true, 'Laboratorio1.xlsm/Sintese'),
  ('qPCR_F', 'qPCR_F', coalesce((select nome_simplificado from analises where codigo = 'qPCR_F'), 'qPCR_F'), 'Importado da aba Sintese do Laboratorio1.xlsm', coalesce((select status from analises where codigo = 'qPCR_F'), 'Ativo'), true, 'Laboratorio1.xlsm/Sintese'),
  ('qPCR_SF', 'qPCR_SF', coalesce((select nome_simplificado from analises where codigo = 'qPCR_SF'), 'qPCR_SF'), 'Importado da aba Sintese do Laboratorio1.xlsm', coalesce((select status from analises where codigo = 'qPCR_SF'), 'Ativo'), true, 'Laboratorio1.xlsm/Sintese'),
  ('RTqPCR_RNA_virus_H', 'RTqPCR_RNA_virus_H', coalesce((select nome_simplificado from analises where codigo = 'RTqPCR_RNA_virus_H'), 'RTqPCR_RNA_virus_H'), 'Importado da aba Sintese do Laboratorio1.xlsm', coalesce((select status from analises where codigo = 'RTqPCR_RNA_virus_H'), 'Ativo'), true, 'Laboratorio1.xlsm/Sintese'),
  ('RTqPCR_RNA_virus_T', 'RTqPCR_RNA_virus_T', coalesce((select nome_simplificado from analises where codigo = 'RTqPCR_RNA_virus_T'), 'RTqPCR_RNA_virus_T'), 'Importado da aba Sintese do Laboratorio1.xlsm', coalesce((select status from analises where codigo = 'RTqPCR_RNA_virus_T'), 'Ativo'), true, 'Laboratorio1.xlsm/Sintese'),
  ('Sanger', 'Sanger', coalesce((select nome_simplificado from analises where codigo = 'Sanger'), 'Sanger'), 'Importado da aba Sintese do Laboratorio1.xlsm', coalesce((select status from analises where codigo = 'Sanger'), 'Ativo'), true, 'Laboratorio1.xlsm/Sintese')
on conflict (codigo) do update
   set nome = coalesce(analises.nome, excluded.nome),
       nome_simplificado = coalesce(analises.nome_simplificado, excluded.nome_simplificado),
       descricao = coalesce(analises.descricao, excluded.descricao),
       status = coalesce(analises.status, excluded.status),
       ativo = true,
       origem_dados = 'Laboratorio1.xlsm/Sintese';

with resumo as (
  select
    a.codigo,
    max(e.dia_fim_max) as prazo_maximo_dias,
    min(nullif(e.amostras_por_execucao, 0)) filter (where e.amostras_por_execucao is not null and e.amostras_por_execucao > 0 and e.nome_atividade !~* 'qubit') as amostras_por_execucao_gargalo,
    min(nullif(e.execucoes_por_dia * e.amostras_por_execucao, 0)) filter (where e.execucoes_por_dia is not null and e.amostras_por_execucao is not null and e.nome_atividade !~* 'qubit') as amostras_por_dia_gargalo,
    sum(coalesce(e.tempo_maquina_h, 0)) as tempo_maquina_horas,
    sum(coalesce(e.tempo_bancada_h, 0)) as tempo_bancada_horas
  from analises a
  left join etapas e on e.codigo_analise = a.codigo
  where a.codigo in (
    'Eletrof_vir_hem','Eletrof_vir_tec','Illumina_Sh','Illumina_Sh_qPCR',
    'Illumina_16S_AC','Illumina_16S_BC','Illumina_DNA_P_AC','Illumina_DNA_P_BC',
    'qPCR_F','qPCR_SF','RTqPCR_RNA_virus_H','RTqPCR_RNA_virus_T','Sanger'
  )
  group by a.codigo
)
update analises a
   set prazo_maximo_dias = resumo.prazo_maximo_dias,
       amostras_por_execucao_gargalo = resumo.amostras_por_execucao_gargalo,
       amostras_por_dia_gargalo = resumo.amostras_por_dia_gargalo,
       tempo_maquina_horas = resumo.tempo_maquina_horas,
       tempo_bancada_horas = resumo.tempo_bancada_horas
  from resumo
 where resumo.codigo = a.codigo;

create table if not exists demanda_grupos_amostras (
  id bigint generated always as identity primary key,
  demanda_id bigint not null references demandas_propostas(id) on delete cascade,
  identificacao text not null,
  tipo_matriz text,
  quantidade_amostras integer not null default 1 check (quantidade_amostras > 0),
  unidade text not null default 'amostras',
  observacao text,
  ordem integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (demanda_id, identificacao)
);

alter table demanda_analises add column if not exists grupo_amostra_id bigint references demanda_grupos_amostras(id) on delete cascade;

do $$
begin
  if exists (
    select 1 from pg_constraint
     where conname = 'demanda_analises_demanda_id_codigo_analise_key'
       and conrelid = 'demanda_analises'::regclass
  ) then
    alter table demanda_analises drop constraint demanda_analises_demanda_id_codigo_analise_key;
  end if;
end $$;

create unique index if not exists demanda_analises_grupo_codigo_key
  on demanda_analises (grupo_amostra_id, codigo_analise)
  where grupo_amostra_id is not null;

create index if not exists demanda_grupos_amostras_demanda_idx on demanda_grupos_amostras (demanda_id, ordem);
create index if not exists demanda_analises_grupo_idx on demanda_analises (grupo_amostra_id);

alter table demanda_grupos_amostras enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'demanda_grupos_amostras'
       and policyname = 'authenticated_all_demanda_grupos_amostras'
  ) then
    create policy authenticated_all_demanda_grupos_amostras
      on demanda_grupos_amostras
      for all to authenticated
      using (true)
      with check (true);
  end if;
end $$;

grant all on demanda_grupos_amostras to authenticated;
grant all on demanda_grupos_amostras to service_role;
grant usage, select on sequence demanda_grupos_amostras_id_seq to authenticated;
grant usage, select on sequence demanda_grupos_amostras_id_seq to service_role;

create or replace function fn_touch_demanda_grupos_amostras()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_touch_demanda_grupos_amostras on demanda_grupos_amostras;
create trigger trg_touch_demanda_grupos_amostras
  before update on demanda_grupos_amostras
  for each row execute function fn_touch_demanda_grupos_amostras();

drop trigger if exists aud_demanda_grupos_amostras on demanda_grupos_amostras;
create trigger aud_demanda_grupos_amostras
  after insert or update or delete on demanda_grupos_amostras
  for each row execute function fn_auditoria();
