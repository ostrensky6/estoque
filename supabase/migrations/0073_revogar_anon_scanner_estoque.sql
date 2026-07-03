-- =====================================================================
-- Scanner/estoque: revogar privilegios diretos de anon nos objetos novos.
--
-- As migrations 0068-0072 concedem acesso operacional a authenticated e
-- service_role. Em ambientes com default privileges permissivos, anon pode
-- herdar privilegios diretos nos objetos criados; esta migration bloqueia
-- explicitamente esse acesso sem alterar policies, UI ou fluxos funcionais.
-- =====================================================================

revoke all on table public.identificadores from anon, public;
revoke all on table public.scan_eventos from anon, public;
revoke all on table public.cadastros_triagem from anon, public;
revoke all on table public.inventario_ciclos from anon, public;
revoke all on table public.inventario_contagens from anon, public;
revoke all on table public.planejamento_lote_conferencias from anon, public;

revoke all on sequence public.identificadores_id_seq from anon, public;
revoke all on sequence public.scan_eventos_id_seq from anon, public;
revoke all on sequence public.cadastros_triagem_id_seq from anon, public;
revoke all on sequence public.inventario_ciclos_id_seq from anon, public;
revoke all on sequence public.inventario_contagens_id_seq from anon, public;
revoke all on sequence public.planejamento_lote_conferencias_id_seq from anon, public;

revoke all on function public.resolver_triagem_criando_insumo(
  bigint,
  text,
  text,
  text,
  numeric,
  numeric,
  numeric,
  text
) from anon, public;

revoke all on function public.aplicar_ajuste_inventario_contagem(bigint) from anon, public;

grant all on public.identificadores to authenticated, service_role;
grant all on public.scan_eventos to authenticated, service_role;
grant all on public.cadastros_triagem to authenticated, service_role;
grant all on public.inventario_ciclos to authenticated, service_role;
grant all on public.inventario_contagens to authenticated, service_role;
grant all on public.planejamento_lote_conferencias to authenticated, service_role;

grant usage, select on sequence public.identificadores_id_seq to authenticated, service_role;
grant usage, select on sequence public.scan_eventos_id_seq to authenticated, service_role;
grant usage, select on sequence public.cadastros_triagem_id_seq to authenticated, service_role;
grant usage, select on sequence public.inventario_ciclos_id_seq to authenticated, service_role;
grant usage, select on sequence public.inventario_contagens_id_seq to authenticated, service_role;
grant usage, select on sequence public.planejamento_lote_conferencias_id_seq to authenticated, service_role;

grant execute on function public.resolver_triagem_criando_insumo(
  bigint,
  text,
  text,
  text,
  numeric,
  numeric,
  numeric,
  text
) to authenticated, service_role;

grant execute on function public.aplicar_ajuste_inventario_contagem(bigint)
  to authenticated, service_role;
