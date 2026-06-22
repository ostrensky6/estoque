-- =====================================================================
-- 0043 — Snapshot laboratorial por item de orcamento (ADITIVA)
--
-- Preserva, por item de orcamento (laboratorial ou analise de projeto), a
-- COMPOSICAO INTEGRAL do custo no momento do calculo, para que orcamentos
-- antigos sejam reabertos pelo snapshot e NUNCA reconstruidos com os cadastros
-- atuais. Inclui override de integridade (quando uma analise bloqueada foi
-- incluida excepcionalmente) com justificativa e usuario.
--
-- Vinculo flexivel: aponta para orcamento_itens OU orcamento_projeto_analises.
--
-- Rollback seguro: tabela aditiva; exportar antes de remover, se necessario.
-- =====================================================================

create table if not exists orcamento_item_snapshot (
  id                          bigint generated always as identity primary key,
  orcamento_item_id           bigint references orcamento_itens(id) on delete cascade,
  orcamento_projeto_analise_id bigint references orcamento_projeto_analises(id) on delete cascade,
  codigo_analise              text not null,
  lote                        numeric,
  -- composicao do custo tecnico unitario (por amostra)
  reagentes                   numeric not null default 0,
  equipamentos                numeric not null default 0,
  pessoal                     numeric not null default 0,
  overhead                    numeric not null default 0,
  custo_tecnico_unitario      numeric not null default 0,
  -- escolhas de grupo aplicadas e alertas detectados no calculo
  escolhas_grupo              jsonb not null default '{}'::jsonb,
  alertas                     jsonb not null default '[]'::jsonb,
  -- versoes/timestamps dos cadastros usados (rastreabilidade do calculo)
  cadastros_versao            jsonb not null default '{}'::jsonb,
  -- override de integridade (analise bloqueada incluida excepcionalmente)
  override_aplicado           boolean not null default false,
  override_justificativa      text,
  override_usuario            uuid references auth.users(id),
  override_problemas          jsonb not null default '[]'::jsonb,
  calculado_em                timestamptz not null default now(),
  criado_em                   timestamptz not null default now(),
  constraint orcamento_item_snapshot_alvo_chk check (
    orcamento_item_id is not null or orcamento_projeto_analise_id is not null
  ),
  constraint orcamento_item_snapshot_override_chk check (
    not override_aplicado or (override_justificativa is not null and btrim(override_justificativa) <> '')
  )
);

create index if not exists orcamento_item_snapshot_item_idx
  on orcamento_item_snapshot (orcamento_item_id);
create index if not exists orcamento_item_snapshot_projeto_idx
  on orcamento_item_snapshot (orcamento_projeto_analise_id);
create index if not exists orcamento_item_snapshot_codigo_idx
  on orcamento_item_snapshot (codigo_analise);

alter table orcamento_item_snapshot enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'orcamento_item_snapshot'
       and policyname = 'authenticated_all_orcamento_item_snapshot'
  ) then
    create policy authenticated_all_orcamento_item_snapshot
      on orcamento_item_snapshot
      for all to authenticated
      using (true)
      with check (true);
  end if;
end $$;

grant all on orcamento_item_snapshot to service_role;

drop trigger if exists aud_orcamento_item_snapshot on orcamento_item_snapshot;
create trigger aud_orcamento_item_snapshot
  after insert or update or delete on orcamento_item_snapshot
  for each row execute function fn_auditoria();

comment on table orcamento_item_snapshot is
  'Composicao integral do custo tecnico por item de orcamento no momento do calculo. Fonte de leitura de orcamentos historicos; NAO recalcular com cadastros atuais.';
