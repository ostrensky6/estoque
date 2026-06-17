-- =====================================================================
-- Complementos do workflow de pedidos internos:
-- urgencia, aprovacoes formais, anexos/documentos e comunicacoes.
-- Migration aditiva, sem remocao de dados.
-- =====================================================================

alter table pedidos_internos
  add column if not exists urgencia text not null default 'normal'
    check (urgencia in ('baixa','normal','alta','critica')),
  add column if not exists comprador_responsavel text,
  add column if not exists aprovacao_final_em timestamptz,
  add column if not exists pagamento_nf_em timestamptz,
  add column if not exists concluido_em timestamptz;

alter table pedidos_internos
  drop constraint if exists pedidos_internos_status_check;

alter table pedidos_internos
  add constraint pedidos_internos_status_check
  check (status in (
    'rascunho',
    'em_validacao',
    'ajuste_solicitante',
    'validado',
    'formalizado',
    'analise_administrativa',
    'ajuste_compras',
    'aprovado_compra',
    'orcamentos',
    'orcamentos_recebidos',
    'aguardando_aprovacao_final',
    'aprovado_para_compra',
    'compra_fechada',
    'encaminhado_instituicao',
    'aguardando_pagamento_nf',
    'compra_concluida',
    'cancelado'
  ));

create table if not exists pedidos_internos_aprovacoes (
  id                 bigint generated always as identity primary key,
  pedido_interno_id  bigint not null references pedidos_internos(id) on delete cascade,
  etapa              text not null,
  decisao            text not null check (decisao in ('aprovado','reprovado','devolvido','registrado')),
  responsavel        text,
  papel              text,
  comentario         text,
  status_origem      text,
  status_destino     text,
  criado_em          timestamptz not null default now()
);

create table if not exists pedidos_internos_anexos (
  id                 bigint generated always as identity primary key,
  pedido_interno_id  bigint not null references pedidos_internos(id) on delete cascade,
  etapa              text,
  tipo               text not null default 'outro'
                     check (tipo in (
                       'orcamento_previo',
                       'proposta',
                       'print',
                       'email',
                       'termo_referencia',
                       'oficio',
                       'boleto',
                       'nota_fiscal',
                       'comprovante',
                       'outro'
                     )),
  titulo             text not null,
  url                text,
  observacao         text,
  usuario            text,
  criado_em          timestamptz not null default now()
);

create table if not exists pedidos_internos_comunicacoes (
  id                 bigint generated always as identity primary key,
  pedido_interno_id  bigint not null references pedidos_internos(id) on delete cascade,
  etapa              text,
  tipo               text not null default 'email'
                     check (tipo in ('email','reuniao','telefone','mensagem','outro')),
  remetente          text,
  destinatarios      text,
  assunto            text,
  referencia         text,
  observacao         text,
  usuario            text,
  criado_em          timestamptz not null default now()
);

create index if not exists pedidos_internos_aprovacoes_pedido_idx
  on pedidos_internos_aprovacoes(pedido_interno_id, criado_em);
create index if not exists pedidos_internos_anexos_pedido_idx
  on pedidos_internos_anexos(pedido_interno_id, criado_em);
create index if not exists pedidos_internos_comunicacoes_pedido_idx
  on pedidos_internos_comunicacoes(pedido_interno_id, criado_em);

alter table pedidos_internos_aprovacoes enable row level security;
alter table pedidos_internos_anexos enable row level security;
alter table pedidos_internos_comunicacoes enable row level security;

create policy rls_read_pedidos_internos_aprovacoes on pedidos_internos_aprovacoes
  for select to authenticated using (true);
create policy rls_tecnico_insert_pedidos_internos_aprovacoes on pedidos_internos_aprovacoes
  for insert to authenticated with check (papel_minimo('tecnico'));

create policy rls_read_pedidos_internos_anexos on pedidos_internos_anexos
  for select to authenticated using (true);
create policy rls_tecnico_insert_pedidos_internos_anexos on pedidos_internos_anexos
  for insert to authenticated with check (papel_minimo('tecnico'));
create policy rls_tecnico_update_pedidos_internos_anexos on pedidos_internos_anexos
  for update to authenticated using (papel_minimo('tecnico')) with check (papel_minimo('tecnico'));
create policy rls_tecnico_delete_pedidos_internos_anexos on pedidos_internos_anexos
  for delete to authenticated using (papel_minimo('tecnico'));

create policy rls_read_pedidos_internos_comunicacoes on pedidos_internos_comunicacoes
  for select to authenticated using (true);
create policy rls_tecnico_insert_pedidos_internos_comunicacoes on pedidos_internos_comunicacoes
  for insert to authenticated with check (papel_minimo('tecnico'));
create policy rls_tecnico_update_pedidos_internos_comunicacoes on pedidos_internos_comunicacoes
  for update to authenticated using (papel_minimo('tecnico')) with check (papel_minimo('tecnico'));
create policy rls_tecnico_delete_pedidos_internos_comunicacoes on pedidos_internos_comunicacoes
  for delete to authenticated using (papel_minimo('tecnico'));

grant all on pedidos_internos_aprovacoes to authenticated, service_role;
grant all on pedidos_internos_anexos to authenticated, service_role;
grant all on pedidos_internos_comunicacoes to authenticated, service_role;
grant usage, select on sequence pedidos_internos_aprovacoes_id_seq to authenticated, service_role;
grant usage, select on sequence pedidos_internos_anexos_id_seq to authenticated, service_role;
grant usage, select on sequence pedidos_internos_comunicacoes_id_seq to authenticated, service_role;

create trigger aud_pedidos_internos_aprovacoes
  after insert or update or delete on pedidos_internos_aprovacoes
  for each row execute function fn_auditoria();

create trigger aud_pedidos_internos_anexos
  after insert or update or delete on pedidos_internos_anexos
  for each row execute function fn_auditoria();

create trigger aud_pedidos_internos_comunicacoes
  after insert or update or delete on pedidos_internos_comunicacoes
  for each row execute function fn_auditoria();
