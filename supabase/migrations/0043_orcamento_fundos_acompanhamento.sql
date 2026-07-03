-- =====================================================================
-- Orcamentos: acompanhamento financeiro de fundos e taxas.
--
-- Migration aditiva. Nao altera tabelas historicas de orcamento, nao remove
-- dados e preserva auditoria via trigger padrao.
-- =====================================================================

create table if not exists orcamento_fundos_acompanhamento (
  id bigint generated always as identity primary key,
  orcamento_final_versao_id bigint not null references orcamento_final_versoes(id) on delete restrict,
  valor_recebido numeric not null default 0,
  impostos_pagos numeric not null default 0,
  incubacao_paga numeric not null default 0,
  reserva_gasta numeric not null default 0,
  investimento_gasto numeric not null default 0,
  observacao text,
  atualizado_por uuid references auth.users(id),
  atualizado_em timestamptz not null default now(),
  constraint orcamento_fundos_acompanhamento_versao_unique unique (orcamento_final_versao_id),
  constraint orcamento_fundos_acompanhamento_valores_check check (
    valor_recebido >= 0
    and impostos_pagos >= 0
    and incubacao_paga >= 0
    and reserva_gasta >= 0
    and investimento_gasto >= 0
  )
);

comment on table orcamento_fundos_acompanhamento is
  'Acompanhamento financeiro dos valores recebidos, impostos/taxas pagos e fundos executados por versao final de orcamento.';

create index if not exists orcamento_fundos_acompanhamento_versao_idx
  on orcamento_fundos_acompanhamento (orcamento_final_versao_id);

create index if not exists orcamento_fundos_acompanhamento_atualizado_idx
  on orcamento_fundos_acompanhamento (atualizado_em desc);

alter table orcamento_fundos_acompanhamento enable row level security;

drop policy if exists orcamento_fundos_acompanhamento_read on orcamento_fundos_acompanhamento;
create policy orcamento_fundos_acompanhamento_read on orcamento_fundos_acompanhamento
  for select to authenticated
  using (papel_minimo('tecnico'));

drop policy if exists orcamento_fundos_acompanhamento_write on orcamento_fundos_acompanhamento;
create policy orcamento_fundos_acompanhamento_write on orcamento_fundos_acompanhamento
  for all to authenticated
  using (papel_minimo('gestor'))
  with check (papel_minimo('gestor'));

grant select, insert, update, delete on orcamento_fundos_acompanhamento to authenticated, service_role;

drop trigger if exists aud_orcamento_fundos_acompanhamento on orcamento_fundos_acompanhamento;
create trigger aud_orcamento_fundos_acompanhamento
  after insert or update or delete on orcamento_fundos_acompanhamento
  for each row execute function fn_auditoria();
