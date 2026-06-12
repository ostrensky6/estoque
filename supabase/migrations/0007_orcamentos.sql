-- =====================================================================
-- Orçamentos: documento comercial por cliente, com histórico.
-- Cabeçalho (cliente/CNPJ/endereço/data) + itens (análise × nº amostras)
-- com SNAPSHOT do custo e preço no momento do orçamento, para que
-- alterações futuras de parâmetros não mudem orçamentos já emitidos.
-- =====================================================================

create table orcamentos (
  id              bigint generated always as identity primary key,
  cliente_nome    text not null,
  cliente_cnpj    text,
  cliente_endereco text,
  cliente_contato text,                       -- e-mail / telefone / responsável
  data_orcamento  date not null default current_date,
  validade_dias   integer not null default 30,
  responsavel     text,                        -- quem do laboratório emitiu
  observacoes     text,
  status          text not null default 'rascunho'
                  check (status in ('rascunho','enviado','aprovado','recusado')),
  criado_em       timestamptz not null default now()
);

create table orcamento_itens (
  id              bigint generated always as identity primary key,
  orcamento_id    bigint not null references orcamentos(id) on delete cascade,
  codigo_analise  text not null references analises(codigo),
  n_amostras      numeric not null default 1 check (n_amostras > 0),
  -- snapshot no momento do orçamento (preço/custo por amostra):
  custo_unitario  numeric not null default 0,
  preco_unitario  numeric not null default 0
);
create index on orcamento_itens (orcamento_id);

-- RLS: app interno; authenticated tem acesso total (default privileges do 0002
-- já concederam insert/update/delete + uso de sequência às tabelas novas).
alter table orcamentos      enable row level security;
alter table orcamento_itens enable row level security;
create policy authenticated_all_orcamentos      on orcamentos      for all to authenticated using (true) with check (true);
create policy authenticated_all_orcamento_itens on orcamento_itens for all to authenticated using (true) with check (true);

grant all on all tables in schema public to service_role;

-- Trilha de auditoria (mesma fn_auditoria dos demais).
create trigger aud_orcamentos after insert or update or delete on orcamentos
  for each row execute function fn_auditoria();
