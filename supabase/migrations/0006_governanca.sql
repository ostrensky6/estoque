-- =====================================================================
-- Governança: papéis no RLS, auditoria imutável e restrita.
-- =====================================================================

-- ---- perfis: só admin altera papéis (evita auto-promoção) -----------
drop policy if exists perfis_write on perfis;
create policy perfis_admin_write on perfis
  for all to authenticated
  using (current_papel() = 'admin')
  with check (current_papel() = 'admin');
-- leitura permanece para todos os autenticados (perfis_read, do 0005)

-- ---- auditoria: imutável (só o trigger definer insere) + leitura gestor+ ----
revoke insert, update, delete on auditoria from authenticated, anon;

drop policy if exists authenticated_all_auditoria on auditoria;
drop policy if exists anon_read_auditoria on auditoria;
create policy auditoria_read on auditoria
  for select to authenticated
  using (current_papel() in ('gestor', 'admin'));

-- =====================================================================
-- Autorização por papel nas RPCs de ciclo de vida do lote.
-- Aceitação (liberação p/ uso) = coordenador+; bloqueio/descarte = gestor+.
-- =====================================================================
create or replace function fn_exige_papel(p_min text)
returns void language plpgsql security definer set search_path = public as $$
declare ordem text[] := array['tecnico','coordenador','gestor','admin']; p text;
begin
  select papel into p from perfis where id = auth.uid();
  p := coalesce(p, 'tecnico');
  if array_position(ordem, p) < array_position(ordem, p_min) then
    raise exception 'Sem permissão: requer papel % ou superior (atual: %).', p_min, p
      using errcode = '42501';
  end if;
end $$;

create or replace function aceitar_lote(p_lote_id bigint, p_responsavel text default null, p_criterio text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform fn_exige_papel('coordenador');
  update lotes_estoque
     set status = 'aceito', responsavel_liberacao = coalesce(p_responsavel, current_setting('request.jwt.claims', true)::jsonb->>'email'), criterio_aceitacao = p_criterio
   where id = p_lote_id and status = 'quarentena';
end $$;

create or replace function bloquear_lote(p_lote_id bigint, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform fn_exige_papel('gestor');
  update lotes_estoque set status = 'bloqueado', motivo_bloqueio = p_motivo where id = p_lote_id;
end $$;

create or replace function desbloquear_lote(p_lote_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform fn_exige_papel('gestor');
  update lotes_estoque set status = 'aceito', motivo_bloqueio = null where id = p_lote_id and status = 'bloqueado';
end $$;

create or replace function descartar_lote(p_lote_id bigint, p_justificativa text)
returns void language plpgsql security definer set search_path = public as $$
declare v_insumo bigint; v_qtd numeric;
begin
  perform fn_exige_papel('gestor');
  update lotes_estoque set status = 'descartado', quantidade_atual = 0 where id = p_lote_id
  returning insumo_id, quantidade_inicial into v_insumo, v_qtd;
  insert into estoque_movimentacoes(insumo_id, tipo, quantidade, motivo, lote_id)
  values (v_insumo, 'ajuste', v_qtd, 'descarte: ' || p_justificativa, p_lote_id);
end $$;

grant execute on function fn_exige_papel(text) to authenticated, service_role;
