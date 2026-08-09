-- =====================================================================
-- Impede que papeis de API falsifiquem os marcadores app.* com set_config.
--
-- O marcador continua delimitando a operacao, mas so e aceito quando o
-- UPDATE ocorre dentro de uma RPC SECURITY DEFINER controlada. A autorizacao
-- compara dinamicamente current_user ao owner da assinatura permitida, sem
-- depender do nome do owner. As funcoes de trigger sao SECURITY INVOKER.
-- =====================================================================

create or replace function public.fn_marcador_transacional_autorizado(
  p_rpcs regprocedure[]
) returns boolean
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  select exists (
    select 1
      from pg_catalog.unnest(p_rpcs) as rpc(rpc_oid)
      join pg_catalog.pg_proc proc on proc.oid = rpc.rpc_oid::oid
      join pg_catalog.pg_roles owner_role on owner_role.oid = proc.proowner
     where owner_role.rolname = current_user
       and owner_role.rolname not in ('anon', 'authenticated', 'service_role')
  )
$$;

create or replace function public.bloquear_status_direto_pedido_interno()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if new.status is distinct from old.status
     and (
       not public.fn_marcador_transacional_autorizado(array[
         'public.transicionar_pedido_interno(bigint,text,text,text,text)'::regprocedure,
         'public.cancelar_pedido_interno_operacional(bigint,text,text)'::regprocedure,
         'public.formalizar_pedido_interno(bigint)'::regprocedure
       ])
       or current_setting('app.pedido_interno_transicao', true) is distinct from 'permitida'
     ) then
    raise exception 'Status do pedido interno so pode ser alterado por transicao transacional.'
      using errcode = '42501';
  end if;
  return new;
end
$$;

create or replace function public.bloquear_status_direto_pedido_compra()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if new.status is distinct from old.status
     and (
       not public.fn_marcador_transacional_autorizado(array[
         'public.transicionar_pedido_compra(bigint,text,text,date)'::regprocedure,
         'public.cancelar_pedido_interno_operacional(bigint,text,text)'::regprocedure,
         'public.estornar_recebimento_item_pedido_interno(bigint,bigint,bigint,text)'::regprocedure,
         'public.receber_item_pedido_compra(bigint,bigint,uuid,numeric,date,text,text)'::regprocedure
       ])
       or current_setting('app.pedido_compra_transicao', true) is distinct from 'permitida'
     ) then
    raise exception 'O status do pedido de compra so pode ser alterado por transicao transacional.'
      using errcode = '42501';
  end if;
  return new;
end
$$;

create or replace function public.bloquear_status_operacional_direto_planejamento()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if new.status_operacional is distinct from old.status_operacional
     and (
       not public.fn_marcador_transacional_autorizado(array[
         'public.reservar_plano(bigint,jsonb)'::regprocedure,
         'public.dar_baixa_plano(bigint)'::regprocedure,
         'public.liberar_plano(bigint)'::regprocedure,
         'public.cancelar_planejamento_operacional(bigint)'::regprocedure,
         'public.concluir_planejamento(bigint)'::regprocedure,
         'public.marcar_planejamento_reservado(bigint)'::regprocedure
       ])
       or current_setting('app.planejamento_transicao', true) is distinct from 'permitida'
     ) then
    raise exception 'O status operacional do planejamento so pode ser alterado por RPC transacional.'
      using errcode = '42501';
  end if;
  return new;
end
$$;

create or replace function public.bloquear_status_direto_orcamento()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if new.status is distinct from old.status
     and (
       not public.fn_marcador_transacional_autorizado(array[
         'public.transicionar_orcamento(bigint,text,text)'::regprocedure
       ])
       or current_setting('app.orcamento_transicao', true) is distinct from 'permitida'
     ) then
    raise exception 'O status do orcamento so pode ser alterado por transicao transacional.'
      using errcode = '42501';
  end if;
  return new;
end
$$;

create or replace function public.bloquear_status_direto_orcamento_projeto()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if new.status is distinct from old.status
     and (
       not public.fn_marcador_transacional_autorizado(array[
         'public.transicionar_orcamento_projeto(bigint,text,text)'::regprocedure,
         'public.aprovar_orcamento_publico(text,text)'::regprocedure
       ])
       or current_setting('app.orcamento_projeto_transicao', true) is distinct from 'permitida'
     ) then
    raise exception 'O status do orcamento de projeto so pode ser alterado por transicao transacional.'
      using errcode = '42501';
  end if;
  return new;
end
$$;

create or replace function public.proteger_recalculo_orcamento()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if not public.fn_marcador_transacional_autorizado(array[
       'public.recalcular_orcamento_transacional(bigint,text,integer,text,jsonb,jsonb,uuid)'::regprocedure
     ])
     or current_setting('app.orcamento_custo_recalculo', true) is distinct from 'permitido' then
    raise exception 'Custos do orcamento exigem recalculo transacional.' using errcode = '42501';
  end if;
  return new;
end
$$;

create or replace function public.proteger_orcamento_final_emitido()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if new.demanda_id is distinct from old.demanda_id
     or new.versao is distinct from old.versao
     or new.numero is distinct from old.numero
     or new.validade_dias is distinct from old.validade_dias
     or new.valido_ate is distinct from old.valido_ate
     or new.total_laboratorio_custo is distinct from old.total_laboratorio_custo
     or new.total_laboratorio_preco is distinct from old.total_laboratorio_preco
     or new.total_projeto_custo is distinct from old.total_projeto_custo
     or new.total_projeto_final is distinct from old.total_projeto_final
     or new.total_final is distinct from old.total_final
     or new.snapshot is distinct from old.snapshot
     or new.criado_por is distinct from old.criado_por
     or new.criado_em is distinct from old.criado_em then
    raise exception 'Conteudo economico de versao final emitida e imutavel.' using errcode = '42501';
  end if;

  if new.status is distinct from old.status
     and (
       not public.fn_marcador_transacional_autorizado(array[
         'public.aprovar_orcamento_publico(text,text)'::regprocedure,
         'public.transicionar_orcamento_final(bigint,text,text)'::regprocedure,
         'public.duplicar_orcamento_final_transacional(bigint,integer,uuid)'::regprocedure,
         'public.emitir_orcamento_final_transacional(bigint,integer,numeric,numeric,numeric,numeric,numeric,jsonb,jsonb,uuid,text)'::regprocedure,
         'public.emitir_orcamento_final_transacional(bigint,integer,numeric,numeric,numeric,numeric,numeric,jsonb,jsonb,uuid,text,uuid)'::regprocedure
       ])
       or current_setting('app.orcamento_final_transicao', true) is distinct from 'permitida'
     ) then
    raise exception 'Status da versao final exige transicao transacional.' using errcode = '42501';
  end if;

  return new;
end
$$;

revoke all on function public.bloquear_status_direto_pedido_interno() from public;
revoke all on function public.bloquear_status_direto_pedido_compra() from public;
revoke all on function public.bloquear_status_operacional_direto_planejamento() from public;
revoke all on function public.bloquear_status_direto_orcamento() from public;
revoke all on function public.bloquear_status_direto_orcamento_projeto() from public;
revoke all on function public.proteger_recalculo_orcamento() from public;
revoke all on function public.proteger_orcamento_final_emitido() from public;
