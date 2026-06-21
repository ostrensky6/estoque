-- =====================================================================
-- Parametros economicos aplicados ao orcamento.
--
-- Migration aditiva/idempotente: cria a tabela que guarda o snapshot da etapa
-- operacional de Parametros Economicos dentro do fluxo de Orcamento Final.
-- Nao altera nem remove tabelas historicas de laboratorio/projeto.
--
-- Rollback seguro: exportar a tabela `orcamento_parametros_aplicados` antes
-- de remove-la, se necessario.
-- =====================================================================

create table if not exists orcamento_parametros_aplicados (
  id                              bigint generated always as identity primary key,
  demanda_id                      bigint references demandas_propostas(id) on delete set null,
  orcamento_laboratorial_id        bigint references orcamentos(id) on delete set null,
  orcamento_projeto_id             bigint references orcamento_projetos(id) on delete set null,
  orcamento_final_versao_id        bigint references orcamento_final_versoes(id) on delete set null,
  versao                          integer not null default 1,
  metodo_calculo                  text not null
                                  check (metodo_calculo in ('MARKUP','GROSS_UP')),
  laboratorio_modo                text not null default 'CUSTO_TECNICO'
                                  check (laboratorio_modo in ('CUSTO_TECNICO','PRECO_JA_FORMADO')),
  subtotal_laboratorio            numeric not null default 0,
  subtotal_projeto                numeric not null default 0,
  subtotal_custos                 numeric not null default 0,
  total_parametros                numeric not null default 0,
  total_final                     numeric not null default 0,
  parametros_snapshot             jsonb not null default '[]'::jsonb,
  formula_snapshot                jsonb not null default '{}'::jsonb,
  alertas_snapshot                jsonb not null default '[]'::jsonb,
  origem                          text not null default 'orcamento/fluxo',
  criado_por                      uuid references auth.users(id),
  criado_em                       timestamptz not null default now(),
  constraint orcamento_parametros_aplicados_versao_check check (versao > 0),
  constraint orcamento_parametros_aplicados_totais_check check (
    subtotal_laboratorio >= 0
    and subtotal_projeto >= 0
    and subtotal_custos >= 0
    and total_final >= 0
  )
);

create index if not exists orcamento_parametros_aplicados_demanda_idx
  on orcamento_parametros_aplicados (demanda_id, versao desc);

create index if not exists orcamento_parametros_aplicados_laboratorio_idx
  on orcamento_parametros_aplicados (orcamento_laboratorial_id, versao desc);

create index if not exists orcamento_parametros_aplicados_projeto_idx
  on orcamento_parametros_aplicados (orcamento_projeto_id, versao desc);

create index if not exists orcamento_parametros_aplicados_final_idx
  on orcamento_parametros_aplicados (orcamento_final_versao_id);

alter table orcamento_parametros_aplicados enable row level security;

do $$
begin
  if not exists (
    select 1
      from pg_policies
     where schemaname = 'public'
       and tablename = 'orcamento_parametros_aplicados'
       and policyname = 'authenticated_all_orcamento_parametros_aplicados'
  ) then
    create policy authenticated_all_orcamento_parametros_aplicados
      on orcamento_parametros_aplicados
      for all to authenticated
      using (true)
      with check (true);
  end if;
end $$;

grant all on orcamento_parametros_aplicados to service_role;

drop trigger if exists aud_orcamento_parametros_aplicados on orcamento_parametros_aplicados;
create trigger aud_orcamento_parametros_aplicados
  after insert or update or delete on orcamento_parametros_aplicados
  for each row execute function fn_auditoria();
