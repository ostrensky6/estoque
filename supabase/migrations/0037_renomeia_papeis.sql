-- =====================================================================
-- Fase 1 (permissões) — renomeia papéis (4 -> 5) sem mudar comportamento.
-- admin->administrador, gestor->gerente, tecnico->usuário; +administrativo.
-- Abordagem por ranking: rank_papel aceita nomes ANTIGOS e NOVOS, então as
-- políticas/RPCs existentes (que passam literais antigos) seguem válidas.
-- Não-destrutiva: sem DROP TABLE/TRUNCATE/colunas. Renomeia dados + recria
-- funções/constraint. Rollback no fim do arquivo (comentado).
-- =====================================================================

-- 1) Ranking canônico (ordem nova). Mapeia legado e novo ao mesmo rank.
create or replace function rank_papel(p text)
returns int language sql immutable set search_path = public as $$
  select case lower(coalesce(p,''))
    when 'tecnico'        then 1
    when 'usuário'        then 1
    when 'usuario'        then 1
    when 'coordenador'    then 2
    when 'administrativo' then 3
    when 'gestor'         then 4
    when 'gerente'        then 4
    when 'admin'          then 5
    when 'administrador'  then 5
    else 0
  end;
$$;
grant execute on function rank_papel(text) to authenticated, service_role;

-- 2) papel_minimo passa a comparar por rank (aceita literais antigos/novos).
create or replace function papel_minimo(p_min text)
returns boolean language sql stable security definer set search_path = public as $$
  select rank_papel(current_papel()) >= rank_papel(p_min)
         and rank_papel(p_min) > 0;
$$;
grant execute on function papel_minimo(text) to authenticated, service_role;

-- 3) Renomeia os dados existentes e amplia o CHECK para os 5 nomes novos.
alter table perfis drop constraint if exists perfis_papel_check;
update perfis set papel = 'administrador' where papel = 'admin';
update perfis set papel = 'gerente'       where papel = 'gestor';
update perfis set papel = 'usuário'       where papel = 'tecnico';
alter table perfis
  alter column papel set default 'usuário',
  add constraint perfis_papel_check
  check (papel in ('usuário','coordenador','administrativo','gerente','administrador'));

-- 4) Recria as 2 políticas que dependiam de papel, agora com nomes novos
--    (funcionalmente idênticas; papel_minimo já normalizaria, mas mantemos claro).
drop policy if exists perfis_admin_write on perfis;
create policy perfis_admin_write on perfis
  for all to authenticated
  using (papel_minimo('administrador'))
  with check (papel_minimo('administrador'));

drop policy if exists auditoria_read on auditoria;
create policy auditoria_read on auditoria
  for select to authenticated
  using (papel_minimo('gerente'));

-- Rollback (se necessário, aplicar manualmente):
--   update perfis set papel='admin'   where papel='administrador';
--   update perfis set papel='gestor'  where papel='gerente';
--   update perfis set papel='tecnico' where papel in ('usuário','administrativo');
--   (e recriar o CHECK antigo + papel_minimo da 0014)
