-- =====================================================================
-- Fase 4.2 — Agendamento diario local para reposicao automatica.
-- O job chama a RPC idempotente que cria rascunhos de compra e notificacoes
-- in-app. Em producao, aplicar apenas apos confirmar a janela operacional.
-- =====================================================================

create extension if not exists pg_cron with schema extensions;

select cron.unschedule(jobid)
from cron.job
where jobname = 'kontrol-reposicao-diaria';

select cron.schedule(
  'kontrol-reposicao-diaria',
  '15 7 * * *',
  $$select public.gerar_reposicao_automatica();$$
);
