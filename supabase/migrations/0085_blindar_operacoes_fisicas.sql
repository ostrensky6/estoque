-- =====================================================================
-- Blindagem das operações físicas de suprimentos.
--
-- Estoque, reservas, recebimentos rastreáveis e reservas de equipamento
-- só podem ser alterados pelas RPCs transacionais. Esta migration é
-- aditiva: não remove histórico, apenas fecha permissões e policies
-- amplas que permitiam contornar o fluxo pelo REST.
-- =====================================================================

-- Nenhum acesso anônimo ou público a tabelas físicas/operacionais.
revoke all on table public.lotes_estoque from anon, public;
revoke all on table public.reservas_estoque from anon, public;
revoke all on table public.estoque_movimentacoes from anon, public;
revoke all on table public.equipamento_reservas from anon, public;
revoke all on table public.pedidos_internos_item_recebimentos from anon, public;

-- Usuários autenticados podem consultar, mas não alterar o físico por REST.
revoke insert, update, delete on table public.lotes_estoque from authenticated;
revoke insert, update, delete on table public.reservas_estoque from authenticated;
revoke insert, update, delete on table public.estoque_movimentacoes from authenticated;
revoke insert, update, delete on table public.equipamento_reservas from authenticated;
revoke insert, update, delete on table public.pedidos_internos_item_recebimentos from authenticated;

grant select on table public.lotes_estoque to authenticated, service_role;
grant select on table public.reservas_estoque to authenticated, service_role;
grant select on table public.estoque_movimentacoes to authenticated, service_role;
grant select on table public.equipamento_reservas to authenticated, service_role;
grant select on table public.pedidos_internos_item_recebimentos to authenticated, service_role;

-- A reserva de equipamento era a última policy ALL desse fluxo.
drop policy if exists authenticated_all_equipamento_reservas on public.equipamento_reservas;
drop policy if exists rls_read_equipamento_reservas on public.equipamento_reservas;
create policy rls_read_equipamento_reservas
  on public.equipamento_reservas
  for select to authenticated
  using (true);

-- O histórico de recebimentos é produzido e estornado somente por RPC.
drop policy if exists rls_tecnico_insert_pedidos_internos_item_recebimentos
  on public.pedidos_internos_item_recebimentos;
drop policy if exists rls_coordenador_delete_pedidos_internos_item_recebimentos
  on public.pedidos_internos_item_recebimentos;

-- Funções SECURITY DEFINER não podem ser chamadas anonimamente. Cada uma
-- também valida o papel mínimo dentro da transação.
revoke execute on function public.reservar_plano(bigint, jsonb) from public, anon;
revoke execute on function public.dar_baixa_plano(bigint) from public, anon;
revoke execute on function public.liberar_plano(bigint) from public, anon;
revoke execute on function public.reservar_equipamento_planejamento(bigint, bigint, timestamptz, timestamptz, text, text) from public, anon;
revoke execute on function public.receber_item_pedido_interno(bigint, bigint, bigint, numeric, date, numeric, text, text, text, text) from public, anon;
revoke execute on function public.receber_item_pedido_compra(bigint, bigint, numeric, date, text) from public, anon;
revoke execute on function public.receber_item_pedido_compra(bigint, bigint, numeric, date, text, text) from public, anon;
revoke execute on function public.aceitar_lote(bigint, text, text) from public, anon;
revoke execute on function public.baixa_manual_lote(bigint, numeric, text) from public, anon;
revoke execute on function public.ajustar_saldo_lote(bigint, numeric, text) from public, anon;
revoke execute on function public.estornar_recebimento_lote(bigint, text) from public, anon;
revoke execute on function public.bloquear_lote(bigint, text) from public, anon;
revoke execute on function public.desbloquear_lote(bigint) from public, anon;
revoke execute on function public.descartar_lote(bigint, text) from public, anon;

grant execute on function public.reservar_plano(bigint, jsonb) to authenticated, service_role;
grant execute on function public.dar_baixa_plano(bigint) to authenticated, service_role;
grant execute on function public.liberar_plano(bigint) to authenticated, service_role;
grant execute on function public.reservar_equipamento_planejamento(bigint, bigint, timestamptz, timestamptz, text, text) to authenticated, service_role;
grant execute on function public.receber_item_pedido_interno(bigint, bigint, bigint, numeric, date, numeric, text, text, text, text) to authenticated, service_role;
grant execute on function public.receber_item_pedido_compra(bigint, bigint, numeric, date, text) to authenticated, service_role;
grant execute on function public.receber_item_pedido_compra(bigint, bigint, numeric, date, text, text) to authenticated, service_role;
grant execute on function public.aceitar_lote(bigint, text, text) to authenticated, service_role;
grant execute on function public.baixa_manual_lote(bigint, numeric, text) to authenticated, service_role;
grant execute on function public.ajustar_saldo_lote(bigint, numeric, text) to authenticated, service_role;
grant execute on function public.estornar_recebimento_lote(bigint, text) to authenticated, service_role;
grant execute on function public.bloquear_lote(bigint, text) to authenticated, service_role;
grant execute on function public.desbloquear_lote(bigint) to authenticated, service_role;
grant execute on function public.descartar_lote(bigint, text) to authenticated, service_role;
