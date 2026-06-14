-- =====================================================================
-- Fase 1.4 — RLS por papel.
-- Substitui policies amplas "authenticated_all" por regras explícitas
-- para os papéis tecnico < coordenador < gestor < admin.
--
-- Migration aditiva sobre o histórico: não remove tabelas, colunas, dados,
-- triggers de auditoria nem RLS. Apenas troca policies permissivas por
-- policies mais específicas e reforça RPCs transacionais.
-- =====================================================================

create or replace function papel_minimo(p_min text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    array_position(array['tecnico','coordenador','gestor','admin'], current_papel())
      >= array_position(array['tecnico','coordenador','gestor','admin'], p_min),
    false
  );
$$;

grant execute on function papel_minimo(text) to authenticated, service_role;

create or replace function fn_exige_papel(p_min text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare p text;
begin
  p := coalesce(current_papel(), 'tecnico');
  if not papel_minimo(p_min) then
    raise exception 'Sem permissão: requer papel % ou superior (atual: %).', p_min, p
      using errcode = '42501';
  end if;
end $$;

grant execute on function fn_exige_papel(text) to authenticated, service_role;

-- Remove policies herdadas abertas. RLS continua habilitado.
do $$
declare
  t text;
begin
  foreach t in array array[
    'parametros',
    'analises',
    'etapas',
    'equipamentos',
    'equipamento_analise',
    'tecnicos',
    'overhead',
    'insumos',
    'insumo_analise',
    'estoque_movimentacoes',
    'planejamento',
    'planejamento_itens',
    'lotes_estoque',
    'reservas_estoque',
    'fornecedores',
    'locais',
    'pedidos_compra',
    'pedidos_compra_itens',
    'orcamentos',
    'orcamento_itens',
    'clientes',
    'projetos',
    'orcamento_projetos',
    'orcamento_projeto_analises',
    'orcamento_projeto_custos',
    'demandas_propostas',
    'orcamento_projeto_catalogo',
    'orcamento_projeto_templates'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security;', t);
      execute format('drop policy if exists authenticated_all_%1$s on public.%1$I;', t);
      execute format('drop policy if exists anon_read_%1$s on public.%1$I;', t);
    end if;
  end loop;

  -- Policies de 0003 usavam nomes abreviados, diferentes do nome real da tabela.
  drop policy if exists authenticated_all_lotes on public.lotes_estoque;
  drop policy if exists anon_read_lotes on public.lotes_estoque;
  drop policy if exists authenticated_all_reservas on public.reservas_estoque;
  drop policy if exists anon_read_reservas on public.reservas_estoque;
end $$;

-- Leitura interna: todo usuário autenticado enxerga a operação.
do $$
declare
  t text;
begin
  foreach t in array array[
    'parametros',
    'analises',
    'etapas',
    'equipamentos',
    'equipamento_analise',
    'tecnicos',
    'overhead',
    'insumos',
    'insumo_analise',
    'estoque_movimentacoes',
    'planejamento',
    'planejamento_itens',
    'lotes_estoque',
    'reservas_estoque',
    'fornecedores',
    'locais',
    'pedidos_compra',
    'pedidos_compra_itens',
    'orcamentos',
    'orcamento_itens',
    'clientes',
    'projetos',
    'orcamento_projetos',
    'orcamento_projeto_analises',
    'orcamento_projeto_custos',
    'demandas_propostas',
    'orcamento_projeto_catalogo',
    'orcamento_projeto_templates'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format(
        'create policy %I on public.%I for select to authenticated using (true);',
        'rls_read_' || t,
        t
      );
    end if;
  end loop;
end $$;

-- Cadastros e parâmetros: alteração estrutural/financeira exige coordenação.
do $$
declare
  t text;
begin
  foreach t in array array[
    'analises',
    'etapas',
    'equipamentos',
    'equipamento_analise',
    'tecnicos',
    'overhead',
    'insumos',
    'insumo_analise',
    'fornecedores',
    'locais',
    'clientes',
    'projetos',
    'orcamento_projeto_catalogo',
    'orcamento_projeto_templates'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format(
        'create policy %I on public.%I for insert to authenticated with check (papel_minimo(%L));',
        'rls_coordenador_insert_' || t,
        t,
        'coordenador'
      );
      execute format(
        'create policy %I on public.%I for update to authenticated using (papel_minimo(%L)) with check (papel_minimo(%L));',
        'rls_coordenador_update_' || t,
        t,
        'coordenador',
        'coordenador'
      );
      execute format(
        'create policy %I on public.%I for delete to authenticated using (papel_minimo(%L));',
        'rls_coordenador_delete_' || t,
        t,
        'coordenador'
      );
    end if;
  end loop;

  if to_regclass('public.parametros') is not null then
    create policy rls_gestor_insert_parametros on parametros
      for insert to authenticated with check (papel_minimo('gestor'));
    create policy rls_gestor_update_parametros on parametros
      for update to authenticated using (papel_minimo('gestor')) with check (papel_minimo('gestor'));
    create policy rls_gestor_delete_parametros on parametros
      for delete to authenticated using (papel_minimo('gestor'));
  end if;
end $$;

-- Fluxos operacionais: técnicos registram; aprovações continuam em actions/RPCs.
do $$
declare
  t text;
begin
  foreach t in array array[
    'planejamento',
    'planejamento_itens',
    'orcamentos',
    'orcamento_itens',
    'orcamento_projetos',
    'orcamento_projeto_analises',
    'orcamento_projeto_custos',
    'demandas_propostas',
    'pedidos_compra_itens'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format(
        'create policy %I on public.%I for insert to authenticated with check (papel_minimo(%L));',
        'rls_tecnico_insert_' || t,
        t,
        'tecnico'
      );
      execute format(
        'create policy %I on public.%I for update to authenticated using (papel_minimo(%L)) with check (papel_minimo(%L));',
        'rls_tecnico_update_' || t,
        t,
        'tecnico',
        'tecnico'
      );
      execute format(
        'create policy %I on public.%I for delete to authenticated using (papel_minimo(%L));',
        'rls_tecnico_delete_' || t,
        t,
        'tecnico'
      );
    end if;
  end loop;
end $$;

-- Pedidos de compra: qualquer autenticado solicita; coordenador+ muda status/cancela.
create policy rls_tecnico_insert_pedidos_compra on pedidos_compra
  for insert to authenticated with check (papel_minimo('tecnico'));
create policy rls_coordenador_update_pedidos_compra on pedidos_compra
  for update to authenticated using (papel_minimo('coordenador')) with check (papel_minimo('coordenador'));
create policy rls_coordenador_delete_pedidos_compra on pedidos_compra
  for delete to authenticated using (papel_minimo('coordenador'));

-- Estoque físico é mutado por RPC transacional. Leitura acima permanece aberta.
-- Sem policies de insert/update/delete diretas em lotes/reservas/movimentações.

-- Perfis e auditoria permanecem especiais.
drop policy if exists perfis_write on perfis;
drop policy if exists perfis_admin_write on perfis;
create policy perfis_admin_write on perfis
  for all to authenticated
  using (papel_minimo('admin'))
  with check (papel_minimo('admin'));

drop policy if exists authenticated_all_auditoria on auditoria;
drop policy if exists anon_read_auditoria on auditoria;
drop policy if exists auditoria_read on auditoria;
create policy auditoria_read on auditoria
  for select to authenticated
  using (papel_minimo('gestor'));

revoke insert, update, delete on auditoria from authenticated, anon;

-- Reforço das RPCs de estoque/planejamento. Security definer preserva
-- atomicidade e centraliza as transições permitidas.
create or replace function receber_lote(
  p_insumo_id  bigint,
  p_quantidade numeric,
  p_validade   date    default null,
  p_custo      numeric default null,
  p_codigo     text    default null,
  p_fornecedor text    default null,
  p_local_id   bigint  default null,
  p_nota_fiscal text   default null,
  p_projeto    text    default null
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare v_lote bigint;
begin
  perform fn_exige_papel('tecnico');

  insert into lotes_estoque(insumo_id, codigo_lote, validade, quantidade_inicial,
                            quantidade_atual, custo_unitario, fornecedor, status,
                            local_id, nota_fiscal, projeto)
  values (p_insumo_id, p_codigo, p_validade, p_quantidade, p_quantidade, p_custo,
          p_fornecedor, 'quarentena', p_local_id, p_nota_fiscal, p_projeto)
  returning id into v_lote;

  insert into estoque_movimentacoes(insumo_id, tipo, quantidade, custo_unitario, motivo, lote_id)
  values (p_insumo_id, 'entrada', p_quantidade, p_custo, 'recebimento (quarentena)', v_lote);

  return v_lote;
end $$;

create or replace function reservar_plano(p_planejamento_id bigint, p_itens jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform fn_exige_papel('tecnico');

  delete from reservas_estoque
   where planejamento_id = p_planejamento_id and status = 'reservado';

  insert into reservas_estoque(planejamento_id, insumo_id, quantidade, status)
  select p_planejamento_id, (e->>'insumo_id')::bigint, (e->>'quantidade')::numeric, 'reservado'
  from jsonb_array_elements(p_itens) e
  where (e->>'insumo_id') is not null and (e->>'quantidade')::numeric > 0;
end $$;

create or replace function dar_baixa_plano(p_planejamento_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  l record;
  v_rem numeric;
  v_take numeric;
  v_short jsonb := '[]'::jsonb;
begin
  perform fn_exige_papel('tecnico');

  for r in select * from reservas_estoque
           where planejamento_id = p_planejamento_id and status = 'reservado' loop
    v_rem := r.quantidade;
    for l in select * from lotes_estoque
             where insumo_id = r.insumo_id and quantidade_atual > 0
               and status in ('aceito','em_uso')
               and (validade is null or validade >= current_date)
             order by validade nulls last, id loop
      exit when v_rem <= 0;
      v_take := least(v_rem, l.quantidade_atual);
      update lotes_estoque
         set quantidade_atual = quantidade_atual - v_take,
             status = case when quantidade_atual - v_take <= 0 then 'consumido' else 'em_uso' end,
             data_abertura = coalesce(data_abertura, current_date)
       where id = l.id;
      insert into estoque_movimentacoes(insumo_id, tipo, quantidade, custo_unitario, motivo, referencia, lote_id)
      values (r.insumo_id, 'saida', v_take, l.custo_unitario,
              'baixa análise', 'plano ' || p_planejamento_id, l.id);
      v_rem := v_rem - v_take;
    end loop;

    update reservas_estoque set status = 'consumido' where id = r.id;

    if v_rem > 0 then
      v_short := v_short || jsonb_build_object('insumo_id', r.insumo_id, 'falta', v_rem);
    end if;
  end loop;

  return jsonb_build_object('shortfalls', v_short);
end $$;

create or replace function liberar_plano(p_planejamento_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform fn_exige_papel('tecnico');

  update reservas_estoque set status = 'liberado'
   where planejamento_id = p_planejamento_id and status = 'reservado';
end $$;

create or replace function aceitar_lote(p_lote_id bigint, p_responsavel text default null, p_criterio text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  perform fn_exige_papel('coordenador');
  begin
    v_email := nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'email';
  exception when others then
    v_email := null;
  end;

  update lotes_estoque
     set status = 'aceito',
         responsavel_liberacao = coalesce(p_responsavel, v_email),
         criterio_aceitacao = p_criterio
   where id = p_lote_id and status = 'quarentena';
end $$;

create or replace function bloquear_lote(p_lote_id bigint, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform fn_exige_papel('gestor');
  update lotes_estoque set status = 'bloqueado', motivo_bloqueio = p_motivo where id = p_lote_id;
end $$;

create or replace function desbloquear_lote(p_lote_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform fn_exige_papel('gestor');
  update lotes_estoque set status = 'aceito', motivo_bloqueio = null where id = p_lote_id and status = 'bloqueado';
end $$;

create or replace function descartar_lote(p_lote_id bigint, p_justificativa text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_insumo bigint;
  v_qtd numeric;
begin
  perform fn_exige_papel('gestor');
  update lotes_estoque set status = 'descartado', quantidade_atual = 0 where id = p_lote_id
  returning insumo_id, quantidade_inicial into v_insumo, v_qtd;
  insert into estoque_movimentacoes(insumo_id, tipo, quantidade, motivo, lote_id)
  values (v_insumo, 'ajuste', v_qtd, 'descarte: ' || p_justificativa, p_lote_id);
end $$;

grant execute on function receber_lote(bigint,numeric,date,numeric,text,text,bigint,text,text) to authenticated, service_role;
grant execute on function reservar_plano(bigint,jsonb) to authenticated, service_role;
grant execute on function dar_baixa_plano(bigint) to authenticated, service_role;
grant execute on function liberar_plano(bigint) to authenticated, service_role;
grant execute on function aceitar_lote(bigint,text,text) to authenticated, service_role;
grant execute on function bloquear_lote(bigint,text) to authenticated, service_role;
grant execute on function desbloquear_lote(bigint) to authenticated, service_role;
grant execute on function descartar_lote(bigint,text) to authenticated, service_role;
