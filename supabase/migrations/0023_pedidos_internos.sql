-- =====================================================================
-- Pedidos internos do GATGF: camada entre planejamento e compras formais.
-- Modela o fluxo atual da lista de material, validacao, formalizacao,
-- analise administrativa, orcamentos e encaminhamento/fechamento.
-- =====================================================================

create table pedidos_internos (
  id                      bigint generated always as identity primary key,
  titulo                  text not null,
  status                  text not null default 'rascunho'
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
                            'compra_fechada',
                            'encaminhado_instituicao',
                            'cancelado'
                          )),
  solicitante             text,
  projeto_id              bigint references projetos(id) on delete set null,
  planejamento_id         bigint references planejamento(id) on delete set null,
  pedido_compra_id        bigint references pedidos_compra(id) on delete set null,
  data_necessidade        date,
  justificativa           text,
  fonte_recurso           text,
  rubrica                 text,
  conformidade_admin      text,
  observacao_compras      text,
  orcamento_previo_total  numeric,
  criado_em               timestamptz not null default now(),
  atualizado_em           timestamptz not null default now(),
  enviado_validacao_em    timestamptz,
  validado_em             timestamptz,
  formalizado_em          timestamptz,
  analisado_em            timestamptz,
  orcamentos_em           timestamptz,
  fechado_em              timestamptz,
  encaminhado_em          timestamptz
);

create table pedidos_internos_itens (
  id                    bigint generated always as identity primary key,
  pedido_interno_id     bigint not null references pedidos_internos(id) on delete cascade,
  insumo_id             bigint references insumos(id) on delete set null,
  tipo                  text not null default 'material'
                        check (tipo in ('material','servico')),
  especificacao         text not null,
  modelo                text,
  volume                text,
  quantidade            numeric not null default 1 check (quantidade > 0),
  unidade               text,
  orcamento_previo      numeric,
  fornecedor_sugerido   text,
  observacao            text,
  criado_em             timestamptz not null default now()
);

create index pedidos_internos_status_idx on pedidos_internos(status);
create index pedidos_internos_projeto_idx on pedidos_internos(projeto_id);
create index pedidos_internos_planejamento_idx on pedidos_internos(planejamento_id);
create index pedidos_internos_pedido_compra_idx on pedidos_internos(pedido_compra_id);
create index pedidos_internos_itens_pedido_idx on pedidos_internos_itens(pedido_interno_id);
create index pedidos_internos_itens_insumo_idx on pedidos_internos_itens(insumo_id);

create or replace function touch_pedidos_internos()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

create trigger trg_touch_pedidos_internos
  before update on pedidos_internos
  for each row execute function touch_pedidos_internos();

alter table pedidos_internos enable row level security;
alter table pedidos_internos_itens enable row level security;

create policy rls_read_pedidos_internos on pedidos_internos
  for select to authenticated using (true);
create policy rls_tecnico_insert_pedidos_internos on pedidos_internos
  for insert to authenticated with check (papel_minimo('tecnico'));
create policy rls_tecnico_update_pedidos_internos on pedidos_internos
  for update to authenticated using (papel_minimo('tecnico')) with check (papel_minimo('tecnico'));
create policy rls_coordenador_delete_pedidos_internos on pedidos_internos
  for delete to authenticated using (papel_minimo('coordenador'));

create policy rls_read_pedidos_internos_itens on pedidos_internos_itens
  for select to authenticated using (true);
create policy rls_tecnico_insert_pedidos_internos_itens on pedidos_internos_itens
  for insert to authenticated with check (papel_minimo('tecnico'));
create policy rls_tecnico_update_pedidos_internos_itens on pedidos_internos_itens
  for update to authenticated using (papel_minimo('tecnico')) with check (papel_minimo('tecnico'));
create policy rls_tecnico_delete_pedidos_internos_itens on pedidos_internos_itens
  for delete to authenticated using (papel_minimo('tecnico'));

grant all on pedidos_internos to authenticated, service_role;
grant all on pedidos_internos_itens to authenticated, service_role;
grant usage, select on sequence pedidos_internos_id_seq to authenticated, service_role;
grant usage, select on sequence pedidos_internos_itens_id_seq to authenticated, service_role;

create trigger aud_pedidos_internos
  after insert or update or delete on pedidos_internos
  for each row execute function fn_auditoria();

create trigger aud_pedidos_internos_itens
  after insert or update or delete on pedidos_internos_itens
  for each row execute function fn_auditoria();
