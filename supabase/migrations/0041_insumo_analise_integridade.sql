-- =====================================================================
-- 0041 — Integridade basica de insumo_analise (ADITIVA / NAO DESTRUTIVA)
--
-- Adiciona estado de ativacao, obrigatoriedade e revisao de integridade aos
-- vinculos insumo<->analise, e um domínio para `modo_cobranca`, SEM converter
-- registros ambiguos nem transformar nulos em 'por_amostra'.
--
-- Decisoes (ver docs/integridade-cadastros-decisoes.md):
--   * `modo_cobranca` permanece NULLABLE durante a transicao. O dominio e
--     adicionado como NOT VALID (nao varre as 321 linhas nulas existentes) e
--     PERMITE null no predicado, de modo que editar uma linha ainda pendente
--     nao falhe. Garante apenas que valores NAO-nulos sejam validos. O
--     aperto para NOT NULL fica para migracao posterior, apos resolver os
--     nulos com evidencia (regra: ausente = bloqueio na aplicacao).
--   * Nada e convertido automaticamente: classificacao de modo/quantidade
--     depende de inspecao dos dados reais (relatorio do preflight).
--
-- Rollback seguro: as colunas sao aditivas; podem ser removidas se necessario
-- apos backup logico. A constraint pode ser derrubada com DROP CONSTRAINT.
-- =====================================================================

alter table insumo_analise
  add column if not exists ativo boolean not null default true,
  add column if not exists obrigatorio boolean not null default true,
  add column if not exists estado_integridade text not null default 'pendente',
  add column if not exists revisado_em timestamptz,
  add column if not exists revisado_por uuid references auth.users(id),
  add column if not exists motivo_inativacao text;

-- Estados validos de revisao de integridade.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'insumo_analise_estado_integridade_chk'
  ) then
    alter table insumo_analise
      add constraint insumo_analise_estado_integridade_chk
      check (estado_integridade in ('pendente','revisado','ambiguo','bloqueado'));
  end if;
end $$;

-- Dominio de modo_cobranca: permite NULL (transicao) e proibe valores invalidos
-- em escritas novas. NOT VALID evita varredura das linhas historicas.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'insumo_analise_modo_cobranca_chk'
  ) then
    alter table insumo_analise
      add constraint insumo_analise_modo_cobranca_chk
      check (modo_cobranca is null or modo_cobranca in ('por_amostra','por_execucao'))
      not valid;
  end if;
end $$;

create index if not exists insumo_analise_ativo_idx on insumo_analise (ativo);

comment on column insumo_analise.ativo is
  'Linha ativa no custeio. Quantidade 0 NAO significa inativo; usar este campo.';
comment on column insumo_analise.obrigatorio is
  'Insumo obrigatorio: se sem vinculo/custo, a analise e BLOQUEADA (nao vira custo zero).';
comment on column insumo_analise.estado_integridade is
  'pendente|revisado|ambiguo|bloqueado — controle de revisao manual da integridade.';
