-- =====================================================================
-- Fase 1.4 — limpeza corretiva de aliases das policies de estoque.
--
-- A migration 0003 criou policies com nomes abreviados
-- authenticated_all_lotes/authenticated_all_reservas. A 0014 remove as
-- policies abertas pelo padrão de nome da tabela; esta migration garante
-- a limpeza em bancos que já aplicaram a 0014 antes da correção.
-- =====================================================================

drop policy if exists authenticated_all_lotes on public.lotes_estoque;
drop policy if exists anon_read_lotes on public.lotes_estoque;
drop policy if exists authenticated_all_reservas on public.reservas_estoque;
drop policy if exists anon_read_reservas on public.reservas_estoque;
