-- =====================================================================
-- Orcamentos finais: classificacao comercial e saldos ajustaveis de fundos.
--
-- Migration aditiva. Preserva snapshots e historico ja emitido, amplia o
-- workflow comercial e registra ajustes de saldo sem sobrescrever valores
-- aprovados ou baixas executadas.
-- =====================================================================

alter table orcamento_final_versoes
  add column if not exists classificado_em timestamptz,
  add column if not exists classificado_por uuid references auth.users(id),
  add column if not exists classificacao_motivo text;

alter table orcamento_final_versoes
  drop constraint if exists orcamento_final_versoes_status_check,
  add constraint orcamento_final_versoes_status_check
    check (status in (
      'emitido',
      'enviado',
      'alterado_reenviado',
      'aprovado',
      'recusado',
      'rejeitado',
      'substituido',
      'cancelado',
      'vencido',
      'convertido_projeto'
    ));

create index if not exists orcamento_final_versoes_classificacao_idx
  on orcamento_final_versoes (status, classificado_em desc);

alter table orcamento_fundos_acompanhamento
  add column if not exists reserva_saldo_ajustado numeric,
  add column if not exists investimento_saldo_ajustado numeric,
  add column if not exists saldo_ajustado_motivo text;

alter table orcamento_fundos_acompanhamento
  drop constraint if exists orcamento_fundos_acompanhamento_valores_check,
  add constraint orcamento_fundos_acompanhamento_valores_check check (
    valor_recebido >= 0
    and impostos_pagos >= 0
    and incubacao_paga >= 0
    and reserva_gasta >= 0
    and investimento_gasto >= 0
    and (reserva_saldo_ajustado is null or reserva_saldo_ajustado >= 0)
    and (investimento_saldo_ajustado is null or investimento_saldo_ajustado >= 0)
  );

comment on column orcamento_fundos_acompanhamento.reserva_saldo_ajustado is
  'Saldo final manual do fundo de reserva, quando a baixa operacional exigir ajuste diferente do calculado.';

comment on column orcamento_fundos_acompanhamento.investimento_saldo_ajustado is
  'Saldo final manual do fundo de investimento, quando a baixa operacional exigir ajuste diferente do calculado.';
