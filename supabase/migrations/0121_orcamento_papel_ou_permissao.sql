-- Permissões de orçamento passam a valer: "papel OU permissão efetiva".
--
-- As caixas orcamentos.* de /usuarios não tinham efeito: as RPCs de orçamento
-- só exigiam papel (fn_exige_papel('coordenador')). Agora, como em análises
-- (0114), vale o papel mínimo de sempre OU a permissão efetiva (0112: perfil
-- individual antes da categoria; admin sempre):
--
--   revisar, recalcular, emitir, classificar e duplicar → orcamentos.emitir
--   cancelar (orçamento, módulo de projeto ou versão final) → orcamentos.cancelar
--   parâmetros globais (tabela parametros, antes só gestor) → orcamento.parametros.editar
--
-- Nenhum acesso existente é retirado: a caixa só concede a quem não tem o papel.
-- Decisão do dono em 2026-09-26 (opção 1 da auditoria do PR #35).
--
-- As seis funções são reescritas a partir da definição vigente no banco,
-- trocando apenas a chamada fn_exige_papel('coordenador'); o bloco confere que
-- houve exatamente uma troca em cada função.
--
-- Aditiva: não remove tabelas, colunas, dados, RLS nem gatilhos. As policies
-- de escrita de parametros são recriadas com a regra ampliada.
-- Rollback: recriar as funções da 0090/0101 (fn_exige_papel('coordenador')) e
-- as policies rls_gestor_{insert,update,delete}_parametros com
-- papel_minimo('gestor'); dropar kontrol_private.exigir_papel_ou_permissao e
-- kontrol_private.pode_editar_parametros.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
begin
  if to_regprocedure('kontrol_private.tem_permissao_efetiva(text)') is null
    or to_regprocedure('public.papel_minimo(text)') is null
    or to_regclass('public.permissoes_categorias') is null then
    raise exception '0121: requer as migrations 0014, 0042 e 0112';
  end if;
end $$;

create or replace function kontrol_private.exigir_papel_ou_permissao(p_min text, p_chave text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.papel_minimo(p_min) or kontrol_private.tem_permissao_efetiva(p_chave) then
    return;
  end if;
  raise exception 'Sem permissão: requer papel % ou superior, ou a permissão "%".', p_min, p_chave
    using errcode = '42501';
end $$;

revoke all on function kontrol_private.exigir_papel_ou_permissao(text, text)
  from public, anon, authenticated, service_role;
grant execute on function kontrol_private.exigir_papel_ou_permissao(text, text) to authenticated;

create or replace function kontrol_private.pode_editar_parametros()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.papel_minimo('gestor')
    or kontrol_private.tem_permissao_efetiva('orcamento.parametros.editar');
$$;

revoke all on function kontrol_private.pode_editar_parametros()
  from public, anon, authenticated, service_role;
grant execute on function kontrol_private.pode_editar_parametros() to authenticated;

-- Padrão por papel onde a chave ainda não existe (não sobrescreve o admin).
update public.permissoes_categorias
   set permissoes = permissoes || jsonb_build_object('orcamentos.cancelar', papel in ('coordenador', 'gestor', 'admin')),
       atualizado_em = now()
 where not (permissoes ? 'orcamentos.cancelar');

-- ---- RPCs de orçamento -----------------------------------------------------
do $$
declare
  v_alvo record;
  v_def text;
  v_nova text;
  v_antes constant text := 'fn_exige_papel(''coordenador'')';
begin
  for v_alvo in
    select p.oid, p.proname,
      case
        when p.proname in ('transicionar_orcamento', 'transicionar_orcamento_projeto', 'transicionar_orcamento_final')
          then 'kontrol_private.exigir_papel_ou_permissao(''coordenador'', case when p_status_destino = ''cancelado'' then ''orcamentos.cancelar'' else ''orcamentos.emitir'' end)'
        else 'kontrol_private.exigir_papel_ou_permissao(''coordenador'', ''orcamentos.emitir'')'
      end as depois
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'transicionar_orcamento', 'transicionar_orcamento_projeto', 'transicionar_orcamento_final',
        'recalcular_orcamento_transacional', 'duplicar_orcamento_final_transacional',
        'emitir_orcamento_final_transacional'
      )
  loop
    v_def := pg_get_functiondef(v_alvo.oid);
    -- a chamada aparece como public.fn_exige_papel(...) ou fn_exige_papel(...)
    v_nova := replace(v_def, 'public.' || v_antes, v_alvo.depois);
    v_nova := replace(v_nova, v_antes, v_alvo.depois);
    if (length(v_nova) - length(replace(v_nova, 'kontrol_private.exigir_papel_ou_permissao(', '')))
         / length('kontrol_private.exigir_papel_ou_permissao(') <> 1
       or position(v_antes in v_nova) > 0 then
      raise exception '0121: % (oid %) não tem exatamente uma checagem de coordenador', v_alvo.proname, v_alvo.oid;
    end if;
    execute v_nova;
  end loop;
end $$;

do $$
declare
  v_qtd integer;
begin
  select count(*) into v_qtd
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'transicionar_orcamento', 'transicionar_orcamento_projeto', 'transicionar_orcamento_final',
      'recalcular_orcamento_transacional', 'duplicar_orcamento_final_transacional',
      'emitir_orcamento_final_transacional'
    )
    and pg_get_functiondef(p.oid) like '%kontrol_private.exigir_papel_ou_permissao(%';
  if v_qtd < 6 then
    raise exception '0121: esperadas ao menos 6 funções convertidas (obtidas %)', v_qtd;
  end if;
end $$;

-- ---- Parâmetros globais -----------------------------------------------------
drop policy if exists rls_gestor_insert_parametros on public.parametros;
drop policy if exists rls_gestor_update_parametros on public.parametros;
drop policy if exists rls_gestor_delete_parametros on public.parametros;

create policy rls_parametros_insert on public.parametros
  for insert to authenticated with check (kontrol_private.pode_editar_parametros());
create policy rls_parametros_update on public.parametros
  for update to authenticated
  using (kontrol_private.pode_editar_parametros())
  with check (kontrol_private.pode_editar_parametros());
create policy rls_parametros_delete on public.parametros
  for delete to authenticated using (kontrol_private.pode_editar_parametros());

commit;
