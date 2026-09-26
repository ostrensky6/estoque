-- =====================================================================
-- 0111 — Edicao e exclusao de planejamento ("Excluir se nao houve baixa").
--
-- Migration ADITIVA e idempotente. Nao remove tabelas, colunas, dados,
-- RLS nem gatilhos de auditoria; nao altera o comportamento de
-- excluir_planejamento_rascunho (0104), que permanece disponivel.
--
-- Regra aprovada:
--   * Exclusao fisica e permitida quando NENHUM material foi baixado para o
--     plano: status diferente de em_execucao/concluido, nenhuma reserva
--     consumida (status 'consumido' ou quantidade_consumida > 0) e nenhuma
--     saida em estoque_movimentacoes referenciando o plano. Reservas ativas
--     sao liberadas antes da exclusao. Pedidos internos vinculados que nao
--     estejam cancelados impedem a exclusao (a mensagem lista quais).
--   * Houve baixa -> somente cancelamento (historico preservado), via
--     cancelar_planejamento, que registra o motivo e delega a
--     cancelar_planejamento_operacional (0100).
--   * Itens do plano so podem ser incluidos, alterados ou removidos com o
--     plano em rascunho ou reservado. Alterar itens de plano reservado marca
--     reserva_desatualizada; uma nova reserva de insumos limpa a marca; o
--     inicio (baixa) e bloqueado enquanto a marca estiver ligada.
--
-- Trilha: o motivo e gravado em eventos_status e em auditoria (justificativa)
-- ANTES do DELETE, e os gatilhos aud_planejamento / aud_planejamento_itens /
-- aud_reservas / aud_equipamento_reservas continuam registrando cada linha
-- removida por cascade.
--
-- ---------------------------------------------------------------------
-- ROLLBACK (manual, documentado; nao remove dados de negocio):
--   drop trigger if exists trg_bloquear_inicio_reserva_desatualizada on public.planejamento;
--   drop function if exists public.bloquear_inicio_reserva_desatualizada();
--   drop trigger if exists trg_limpar_reserva_desatualizada on public.reservas_estoque;
--   drop function if exists public.limpar_reserva_desatualizada();
--   drop trigger if exists trg_guardar_itens_planejamento_editavel on public.planejamento_itens;
--   drop function if exists public.guardar_itens_planejamento_editavel();
--   drop function if exists public.cancelar_planejamento(bigint, text);
--   drop function if exists public.excluir_planejamento(bigint, text);
--   -- restaurar bloquear_exclusao_direta_planejamento() com o corpo de 0104
--   -- (a coluna reserva_desatualizada pode permanecer; e so um indicador).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Indicador de reserva desatualizada.
-- ---------------------------------------------------------------------
alter table public.planejamento
  add column if not exists reserva_desatualizada boolean not null default false;

comment on column public.planejamento.reserva_desatualizada is
  'true quando os itens mudaram depois da reserva de insumos; limpa na proxima reserva (0111).';


-- ---------------------------------------------------------------------
-- 2. Exclusao controlada com liberacao de reservas.
-- ---------------------------------------------------------------------
create or replace function public.excluir_planejamento(
  p_planejamento_id bigint,
  p_motivo text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plano record;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_claims jsonb;
  v_ator text;
  v_pedidos text;
  v_itens integer := 0;
  v_reservas integer := 0;
  v_equipamentos integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Sessão obrigatória para excluir planejamento.' using errcode = '42501';
  end if;
  perform public.fn_exige_papel('coordenador');

  if v_motivo is null or pg_catalog.length(v_motivo) < 3 then
    raise exception 'Informe o motivo da exclusão.' using errcode = '22023';
  end if;

  v_claims := coalesce(nullif(pg_catalog.current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  v_ator := coalesce(nullif(v_claims->>'email', ''), auth.uid()::text);

  select *
    into v_plano
    from public.planejamento
   where id = p_planejamento_id
     for update;

  if not found then
    raise exception 'Planejamento % não encontrado.', p_planejamento_id using errcode = 'P0002';
  end if;

  if v_plano.status_operacional in ('em_execucao', 'concluido') then
    raise exception 'Já houve baixa de material neste plano (status: %). Só é possível cancelar.',
      v_plano.status_operacional using errcode = '22023';
  end if;

  if exists (
    select 1
      from public.reservas_estoque r
     where r.planejamento_id = p_planejamento_id
       and (r.status = 'consumido' or coalesce(r.quantidade_consumida, 0) > 0)
  ) or exists (
    select 1
      from public.estoque_movimentacoes m
     where m.tipo = 'saida'
       and (
         m.referencia = 'plano ' || p_planejamento_id::text
         or m.referencia like 'plano ' || p_planejamento_id::text || ';%'
       )
  ) then
    raise exception 'Já houve baixa de material neste plano. Só é possível cancelar.'
      using errcode = '22023';
  end if;

  select pg_catalog.string_agg(pg_catalog.format('#%s (%s)', p.id, p.status), ', ' order by p.id)
    into v_pedidos
    from public.pedidos_internos p
   where p.planejamento_id = p_planejamento_id
     and p.status is distinct from 'cancelado';

  if v_pedidos is not null then
    raise exception 'Cancele antes os pedidos internos vinculados ao plano: %.', v_pedidos
      using errcode = '23503';
  end if;

  -- Libera reservas ativas como liberar_plano (0100), inclusive a agenda
  -- das unidades de equipamento, antes que o cascade remova as linhas.
  update public.reservas_estoque
     set status = 'liberado',
         liberado_em = coalesce(liberado_em, pg_catalog.now()),
         observacao = coalesce(observacao, 'Liberada pela exclusão do plano')
   where planejamento_id = p_planejamento_id
     and status in ('reservado', 'parcial');
  get diagnostics v_reservas = row_count;

  update public.equipamento_reservas
     set status = 'liberado',
         liberado_em = coalesce(liberado_em, pg_catalog.now())
   where planejamento_id = p_planejamento_id
     and status in ('reservado', 'em_uso');
  get diagnostics v_equipamentos = row_count;

  update public.equipamento_unidades eu
     set status_operacional = 'operacional'
   where eu.status_operacional = 'reservado'
     and exists (
       select 1
         from public.equipamento_reservas er
        where er.planejamento_id = p_planejamento_id
          and er.equipamento_unidade_id = eu.id
     )
     and not exists (
       select 1
         from public.equipamento_reservas er
        where er.equipamento_unidade_id = eu.id
          and er.status in ('reservado', 'em_uso')
     );

  select count(*) into v_itens
    from public.planejamento_itens
   where planejamento_id = p_planejamento_id;

  -- Trilha gravada antes do DELETE: sobrevive a exclusao (sem FK).
  insert into public.eventos_status(entidade, entidade_id, de_status, para_status, usuario, observacao)
  values (
    'planejamento',
    p_planejamento_id,
    v_plano.status_operacional,
    'excluido',
    v_ator,
    pg_catalog.format('Plano "%s" excluído. Motivo: %s', coalesce(v_plano.nome, '-'), v_motivo)
  );

  insert into public.auditoria(tabela, registro_id, acao, valor_anterior, valor_novo, usuario, justificativa)
  values (
    'planejamento',
    p_planejamento_id::text,
    'exclusao_solicitada',
    pg_catalog.to_jsonb(v_plano),
    pg_catalog.jsonb_build_object(
      'itens', v_itens,
      'reservas_liberadas', v_reservas,
      'equipamentos_liberados', v_equipamentos
    ),
    v_ator,
    v_motivo
  );

  perform pg_catalog.set_config('app.planejamento_exclusao', 'permitida', true);
  delete from public.planejamento where id = p_planejamento_id;
  perform pg_catalog.set_config('app.planejamento_exclusao', '', true);

  return pg_catalog.jsonb_build_object(
    'planejamento_id', p_planejamento_id,
    'nome', v_plano.nome,
    'itens_removidos', v_itens,
    'reservas_liberadas', v_reservas,
    'equipamentos_liberados', v_equipamentos
  );
end $$;

revoke execute on function public.excluir_planejamento(bigint, text) from public, anon;
grant execute on function public.excluir_planejamento(bigint, text) to authenticated, service_role;


-- O gatilho de 0104 passa a reconhecer tambem a nova RPC. Mesmo marcador,
-- mesma verificacao de owner (fn_marcador_transacional_autorizado, 0103).
create or replace function public.bloquear_exclusao_direta_planejamento()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if not public.fn_marcador_transacional_autorizado(array[
       'public.excluir_planejamento_rascunho(bigint)'::regprocedure,
       'public.excluir_planejamento(bigint,text)'::regprocedure
     ])
     or current_setting('app.planejamento_exclusao', true) is distinct from 'permitida' then
    raise exception 'Planejamento só pode ser excluído pela RPC de exclusão controlada.'
      using errcode = '42501';
  end if;
  return old;
end $$;


-- ---------------------------------------------------------------------
-- 3. Cancelamento com motivo (houve baixa -> historico preservado).
-- ---------------------------------------------------------------------
create or replace function public.cancelar_planejamento(
  p_planejamento_id bigint,
  p_motivo text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_claims jsonb;
  v_ator text;
begin
  if auth.uid() is null then
    raise exception 'Sessão obrigatória para cancelar planejamento.' using errcode = '42501';
  end if;
  perform public.fn_exige_papel('coordenador');

  if v_motivo is null or pg_catalog.length(v_motivo) < 3 then
    raise exception 'Informe o motivo do cancelamento.' using errcode = '22023';
  end if;

  v_claims := coalesce(nullif(pg_catalog.current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  v_ator := coalesce(nullif(v_claims->>'email', ''), auth.uid()::text);

  select status_operacional
    into v_status
    from public.planejamento
   where id = p_planejamento_id
     for update;

  if not found then
    raise exception 'Planejamento % não encontrado.', p_planejamento_id using errcode = 'P0002';
  end if;
  if v_status = 'concluido' then
    raise exception 'Planejamento concluído não pode ser cancelado.' using errcode = '22023';
  end if;
  if v_status = 'cancelado' then
    raise exception 'Planejamento já está cancelado.' using errcode = '22023';
  end if;

  perform public.cancelar_planejamento_operacional(p_planejamento_id);

  insert into public.eventos_status(entidade, entidade_id, de_status, para_status, usuario, observacao)
  values ('planejamento', p_planejamento_id, v_status, 'cancelado', v_ator,
          pg_catalog.format('Plano cancelado. Motivo: %s', v_motivo));

  return pg_catalog.jsonb_build_object(
    'planejamento_id', p_planejamento_id,
    'status_anterior', v_status,
    'status', 'cancelado'
  );
end $$;

revoke execute on function public.cancelar_planejamento(bigint, text) from public, anon;
grant execute on function public.cancelar_planejamento(bigint, text) to authenticated, service_role;


-- ---------------------------------------------------------------------
-- 4. Itens editaveis apenas em rascunho/reservado.
--
-- Security definer para marcar reserva_desatualizada mesmo quando o papel
-- chamador nao tem UPDATE direto em planejamento. Durante a exclusao
-- controlada o plano-pai ja nao e visivel ao cascade: nesse caso o DELETE
-- do item e liberado.
-- ---------------------------------------------------------------------
create or replace function public.guardar_itens_planejamento_editavel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids bigint[];
  v_id bigint;
  v_status text;
begin
  if tg_op = 'INSERT' then
    v_ids := array[new.planejamento_id];
  elsif tg_op = 'UPDATE' then
    v_ids := array[old.planejamento_id, new.planejamento_id];
  else
    v_ids := array[old.planejamento_id];
  end if;

  foreach v_id in array v_ids loop
    select status_operacional into v_status
      from public.planejamento
     where id = v_id;

    if not found then
      if tg_op = 'DELETE' then
        continue;
      end if;
      raise exception 'Planejamento % não encontrado.', v_id using errcode = 'P0002';
    end if;

    if v_status not in ('rascunho', 'reservado') then
      raise exception 'Itens só podem ser alterados com o plano em rascunho ou reservado (status atual: %).',
        v_status using errcode = '22023';
    end if;

    if v_status = 'reservado' then
      update public.planejamento
         set reserva_desatualizada = true
       where id = v_id
         and not reserva_desatualizada;
    end if;
  end loop;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end $$;

revoke execute on function public.guardar_itens_planejamento_editavel() from public, anon, authenticated;

drop trigger if exists trg_guardar_itens_planejamento_editavel on public.planejamento_itens;
create trigger trg_guardar_itens_planejamento_editavel
  before insert or update or delete on public.planejamento_itens
  for each row execute function public.guardar_itens_planejamento_editavel();


-- ---------------------------------------------------------------------
-- 5. Nova reserva de insumos limpa a marca.
--
-- Abordagem menos invasiva: em vez de reescrever reservar_plano (0100),
-- um gatilho AFTER INSERT em reservas_estoque zera a marca sempre que uma
-- reserva nova (reservado/parcial) nasce para o plano. reservar_plano
-- sempre libera as reservas antigas e insere as novas na mesma transacao.
-- ---------------------------------------------------------------------
create or replace function public.limpar_reserva_desatualizada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.planejamento_id is not null and new.status in ('reservado', 'parcial') then
    update public.planejamento
       set reserva_desatualizada = false
     where id = new.planejamento_id
       and reserva_desatualizada;
  end if;
  return new;
end $$;

revoke execute on function public.limpar_reserva_desatualizada() from public, anon, authenticated;

drop trigger if exists trg_limpar_reserva_desatualizada on public.reservas_estoque;
create trigger trg_limpar_reserva_desatualizada
  after insert on public.reservas_estoque
  for each row execute function public.limpar_reserva_desatualizada();


-- ---------------------------------------------------------------------
-- 6. Inicio (baixa) bloqueado com reserva desatualizada.
--
-- dar_baixa_plano (0100) consome as reservas gravadas; se os itens mudaram
-- depois da reserva, a baixa usaria quantidades antigas. O gatilho recusa
-- a transicao reservado -> em_execucao enquanto a marca estiver ligada.
-- ---------------------------------------------------------------------
create or replace function public.bloquear_inicio_reserva_desatualizada()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if new.status_operacional = 'em_execucao'
     and old.status_operacional is distinct from 'em_execucao'
     and coalesce(new.reserva_desatualizada, false) then
    raise exception 'Os itens mudaram depois da reserva. Reserve os insumos de novo antes de iniciar.'
      using errcode = '22023';
  end if;
  return new;
end $$;

revoke execute on function public.bloquear_inicio_reserva_desatualizada() from public, anon, authenticated;

drop trigger if exists trg_bloquear_inicio_reserva_desatualizada on public.planejamento;
create trigger trg_bloquear_inicio_reserva_desatualizada
  before update of status_operacional on public.planejamento
  for each row execute function public.bloquear_inicio_reserva_desatualizada();
