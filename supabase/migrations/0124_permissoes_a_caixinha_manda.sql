-- Permissões: "a caixinha manda" (decisão e autorização do dono em 2026-09-26).
--
-- Antes, só 5 das 37 caixinhas de /usuarios tinham efeito; as demais eram
-- gravadas, mas o banco e o app olhavam só o papel. Agora toda ação e todo
-- módulo obedecem à permissão efetiva (0112: valor individual do usuário
-- antes do valor da categoria/papel; admin sempre pode; suspenso nunca). O
-- papel só define a marcação inicial de cada categoria.
--
-- Ninguém ganha nem perde acesso no dia do deploy (decisão do dono): os
-- padrões por papel das chaves que passam a valer reproduzem exatamente o que
-- cada papel fazia antes (técnico < coordenador < gestor), e as marcações
-- individuais dessas chaves, que nunca tiveram efeito, são removidas. Cada
-- exceção removida que divergia do padrão é listada em NOTICE para o admin
-- reaplicar em Usuários, se quiser.
--
-- O que muda no banco:
--  * RPCs trocam fn_exige_papel(...) por kontrol_private.exigir_permissao(chave).
--  * Políticas de escrita por papel viram políticas por permissão.
--  * Leitura de orçamentos/propostas passa a exigir "Orçamentos: Visualizar";
--    a auditoria, "Ver auditoria" (a restrição de salário da 0112 continua).
--  * Novas chaves: planejamento.executar, orcamentos.fundos, orcamentos.modelos.
--  * RPC public.minhas_permissoes() para o app montar menu e telas.
--  * Usuários, privilégios e backups continuam só do admin.
--
-- Não remove tabelas, colunas nem RLS: políticas são recriadas com a nova regra.
-- Rollback: reaplicar as definições das funções da 0100–0123 (fn_exige_papel),
-- as políticas da 0014/0023/0043/0047/0071/0075 e restaurar
-- permissoes_categorias/perfis.permissoes a partir do backup lógico prévio.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '180s';

do $$
begin
  if to_regprocedure('kontrol_private.tem_permissao_efetiva(text)') is null
    or to_regprocedure('kontrol_private.exigir_papel_ou_permissao(text,text)') is null then
    raise exception '0124: requer as migrations 0112 e 0121';
  end if;
end $$;

-- ---- 1. Checagem única -----------------------------------------------------
create or replace function kontrol_private.exigir_permissao(p_chave text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if kontrol_private.tem_permissao_efetiva(p_chave) then
    return;
  end if;
  raise exception 'Sem permissão para esta ação (%). Peça ao administrador para liberar em Usuários.', p_chave
    using errcode = '42501';
end $$;

revoke all on function kontrol_private.exigir_permissao(text) from public, anon, authenticated, service_role;
grant execute on function kontrol_private.exigir_permissao(text) to authenticated;

-- Funções de apoio das migrations anteriores passam a olhar só a permissão.
create or replace function kontrol_private.pode_editar_analises()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select kontrol_private.tem_permissao_efetiva('analises.editar');
$$;

create or replace function kontrol_private.pode_editar_parametros()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select kontrol_private.tem_permissao_efetiva('orcamento.parametros.editar');
$$;

create or replace function kontrol_private.exigir_papel_ou_permissao(p_min text, p_chave text)
returns void
language plpgsql stable security definer
set search_path = ''
as $$
begin
  -- Mantida só por compatibilidade: desde a 0124 vale apenas a permissão.
  perform kontrol_private.exigir_permissao(p_chave);
end $$;

-- ---- 2. Padrões por papel e limpeza dos valores individuais -----------------
do $$
declare
  -- Chaves que passam a ter efeito agora (as 5 que já valiam ficam de fora).
  v_novas text[] := array[
    'cadastros.ver', 'analises.ver', 'insumos.ver', 'custeio.ver', 'estoque.ver',
    'planejamento.ver', 'pedido.ver', 'compras.ver', 'recebimento.ver',
    'orcamentos.visualizar', 'projetos.ver', 'auditoria.visualizar', 'configuracoes.ver',
    'orcamentos.criar_editar', 'orcamentos.emitir', 'orcamentos.cancelar',
    'orcamento.parametros.editar', 'orcamentos.fundos', 'orcamentos.modelos',
    'compras.solicitar', 'compras.aprovar', 'compras.receber', 'compras.cancelar',
    'pedido.criar', 'pedido.aprovar', 'recebimento.registrar',
    'estoque.movimentar', 'estoque.lote.aceitar', 'estoque.lote.gerir',
    'estoque.descartar_bloquear', 'planejamento.editar', 'planejamento.executar',
    'analises.editar'
  ];
  -- O que cada papel fazia antes (regra por papel do banco e das telas).
  v_tecnico text[] := array[
    'cadastros.ver', 'analises.ver', 'insumos.ver', 'custeio.ver', 'estoque.ver',
    'planejamento.ver', 'pedido.ver', 'compras.ver', 'recebimento.ver',
    'orcamentos.visualizar', 'projetos.ver',
    'orcamentos.criar_editar', 'compras.solicitar', 'pedido.criar',
    'recebimento.registrar', 'estoque.movimentar', 'planejamento.executar'
  ];
  v_coordenador text[] := v_tecnico || array[
    'analises.editar', 'orcamentos.emitir', 'orcamentos.cancelar', 'compras.aprovar', 'compras.receber',
    'compras.cancelar', 'pedido.aprovar', 'estoque.lote.aceitar', 'estoque.lote.gerir',
    'planejamento.editar'
  ];
  v_gestor text[] := v_coordenador || array[
    'estoque.descartar_bloquear', 'orcamento.parametros.editar', 'orcamentos.fundos',
    'orcamentos.modelos', 'auditoria.visualizar', 'configuracoes.ver'
  ];
  v_papel text;
  v_padrao text[];
  v_chave text;
  v_mudancas integer := 0;
  v_perfil record;
  v_valor jsonb;
begin
  foreach v_papel in array array['tecnico', 'coordenador', 'gestor'] loop
    v_padrao := case v_papel when 'tecnico' then v_tecnico when 'coordenador' then v_coordenador else v_gestor end;
    insert into public.permissoes_categorias (papel, permissoes)
    values (v_papel, '{}'::jsonb)
    on conflict (papel) do nothing;
    foreach v_chave in array v_novas loop
      update public.permissoes_categorias
         set permissoes = permissoes || jsonb_build_object(v_chave, v_chave = any(v_padrao)),
             atualizado_em = now()
       where papel = v_papel
         and (permissoes -> v_chave) is distinct from to_jsonb(v_chave = any(v_padrao));
      if found then
        v_mudancas := v_mudancas + 1;
        raise notice '0124: categoria % → % = %', v_papel, v_chave, v_chave = any(v_padrao);
      end if;
    end loop;
  end loop;

  -- Marcações individuais das chaves que passam a valer: removidas (a pessoa
  -- segue a categoria, isto é, o acesso que tinha). As que divergiam do
  -- padrão ficam listadas para o admin decidir.
  for v_perfil in
    select id, email, papel, permissoes from public.perfis
    where papel in ('tecnico', 'coordenador', 'gestor') and permissoes <> '{}'::jsonb
  loop
    v_padrao := case v_perfil.papel when 'tecnico' then v_tecnico when 'coordenador' then v_coordenador else v_gestor end;
    foreach v_chave in array v_novas loop
      v_valor := v_perfil.permissoes -> v_chave;
      continue when v_valor is null;
      if jsonb_typeof(v_valor) = 'boolean' and v_valor <> to_jsonb(v_chave = any(v_padrao)) then
        raise notice '0124: % (%) tinha % = % (sem efeito até hoje); passa a seguir o padrão do papel',
          v_perfil.email, v_perfil.papel, v_chave, v_valor;
      end if;
      update public.perfis set permissoes = permissoes - v_chave where id = v_perfil.id;
    end loop;
  end loop;
  -- chaves de gestão de acesso não são delegáveis (só admin): sai a sobra
  update public.perfis
     set permissoes = permissoes - 'usuarios.gerenciar' - 'privilegios.gerenciar' - 'backups.gerenciar'
   where permissoes ?| array['usuarios.gerenciar', 'privilegios.gerenciar', 'backups.gerenciar'];
  raise notice '0124: % valor(es) de categoria ajustados para reproduzir o acesso anterior.', v_mudancas;
end $$;

-- ---- 3. RPCs: fn_exige_papel → exigir_permissao -----------------------------
do $$
declare
  v_fn record;
  v_def text;
  v_nova text;
  v_chave text;
  v_mapa constant jsonb := '{
    "dar_baixa_plano": "planejamento.executar",
    "reservar_plano": "planejamento.executar",
    "concluir_planejamento": "planejamento.executar",
    "marcar_planejamento_reservado": "planejamento.executar",
    "marcar_planejamento_em_execucao": "planejamento.executar",
    "validar_planejamento_executivo": "planejamento.executar",
    "reservar_equipamento_planejamento": "planejamento.executar",
    "liberar_plano": "planejamento.editar",
    "cancelar_planejamento": "planejamento.editar",
    "cancelar_planejamento_operacional": "planejamento.editar",
    "excluir_planejamento": "planejamento.editar",
    "excluir_planejamento_rascunho": "planejamento.editar",
    "receber_lote": "estoque.movimentar",
    "entrada_inventario": "estoque.movimentar",
    "baixa_manual_lote": "estoque.movimentar",
    "baixa_manual_embalagens": "estoque.movimentar",
    "abrir_embalagem": "estoque.movimentar",
    "registrar_entrada_manual_embalagens": "estoque.movimentar",
    "aceitar_lote": "estoque.lote.aceitar",
    "ajustar_saldo_lote": "estoque.lote.gerir",
    "estornar_recebimento_lote": "estoque.lote.gerir",
    "estornar_recebimento_item_pedido_interno": "estoque.lote.gerir",
    "corrigir_quantidade_embalagens_fechadas": "estoque.lote.gerir",
    "bloquear_lote": "estoque.descartar_bloquear",
    "desbloquear_lote": "estoque.descartar_bloquear",
    "descartar_lote": "estoque.descartar_bloquear",
    "receber_item_pedido_interno": "recebimento.registrar",
    "receber_item_pedido_compra": "compras.receber",
    "cancelar_pedido_interno_operacional": "compras.cancelar",
    "formalizar_pedido_interno": "pedido.aprovar",
    "registrar_modalidade_pedido_interno": "pedido.aprovar",
    "criar_pedido_reposicao_estoque": "pedido.criar"
  }'::jsonb;
begin
  for v_fn in
    select p.oid, p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f' and p.proname <> 'fn_exige_papel'
      and case when p.prokind = 'f' then pg_get_functiondef(p.oid) end ~ '(fn_exige_papel\(|exigir_papel_ou_permissao\()'
  loop
    v_def := pg_get_functiondef(v_fn.oid);
    v_nova := replace(v_def, 'public.fn_exige_papel(', 'fn_exige_papel(');

    if v_fn.proname = 'transicionar_pedido_interno' then
      v_nova := replace(v_nova, 'fn_exige_papel(''tecnico'')', 'kontrol_private.exigir_permissao(''pedido.criar'')');
      v_nova := replace(v_nova, 'fn_exige_papel(''coordenador'')', 'kontrol_private.exigir_permissao(''pedido.aprovar'')');
    elsif v_fn.proname = 'transicionar_pedido_compra' then
      v_nova := replace(v_nova, 'fn_exige_papel(''coordenador'')',
        'kontrol_private.exigir_permissao(case when p_status_destino = ''cancelado'' then ''compras.cancelar'' else ''compras.aprovar'' end)');
    elsif position('exigir_papel_ou_permissao(' in v_nova) > 0 then
      -- orçamento (0121): mantém a chave, remove o papel
      v_nova := replace(v_nova, 'kontrol_private.exigir_papel_ou_permissao(''coordenador'', ', 'kontrol_private.exigir_permissao(');
    else
      v_chave := v_mapa ->> v_fn.proname;
      if v_chave is null then
        raise exception '0124: função % sem permissão mapeada', v_fn.oid::regprocedure;
      end if;
      v_nova := regexp_replace(v_nova, 'fn_exige_papel\(''[a-z]+''\)',
        'kontrol_private.exigir_permissao(''' || v_chave || ''')', 'g');
    end if;

    if v_nova ~ '(fn_exige_papel\(|exigir_papel_ou_permissao\()' then
      raise exception '0124: % ainda checa papel depois da troca', v_fn.oid::regprocedure;
    end if;
    execute v_nova;
  end loop;
end $$;

-- Rotinas sem checagem que o usuário conseguia chamar pela API. A automação
-- (sem sessão de usuário) continua funcionando.
do $$
declare
  v_def text;
begin
  v_def := pg_get_functiondef('public.gerar_reposicao_automatica()'::regprocedure);
  if position('exigir_permissao' in v_def) = 0 then
    v_def := regexp_replace(v_def, E'\nbegin\n',
      E'\nbegin\n  if auth.uid() is not null then\n    perform kontrol_private.exigir_permissao(''compras.solicitar'');\n  end if;\n');
    execute v_def;
  end if;
  if to_regprocedure('public.resolver_triagem_criando_insumo(bigint,text,text,text,numeric,numeric,numeric,text)') is not null then
    v_def := pg_get_functiondef('public.resolver_triagem_criando_insumo(bigint,text,text,text,numeric,numeric,numeric,text)'::regprocedure);
    if position('exigir_permissao' in v_def) = 0 then
      v_def := regexp_replace(v_def, E'\nbegin\n',
        E'\nbegin\n  perform kontrol_private.exigir_permissao(''insumos.editar'');\n');
      execute v_def;
    end if;
  end if;
end $$;

-- ---- 4. Políticas de escrita por permissão ----------------------------------
do $$
declare
  v_regra record;
  v_pol record;
  v_cond text;
begin
  for v_regra in
    select * from (values
      ('analises_matrizes_amostras', 'analises.editar', null, null),
      ('matrizes_amostras', 'analises.editar', null, null),
      ('demandas_propostas', 'orcamentos.criar_editar', null, null),
      ('demanda_analises', 'orcamentos.criar_editar', null, null),
      ('demanda_grupos_amostras', 'orcamentos.criar_editar', null, null),
      ('orcamentos', 'orcamentos.criar_editar', null, null),
      ('orcamento_itens', 'orcamentos.criar_editar', null, null),
      ('orcamento_projetos', 'orcamentos.criar_editar', null, null),
      ('orcamento_projeto_analises', 'orcamentos.criar_editar', null, null),
      ('orcamento_projeto_anexos', 'orcamentos.criar_editar', null, null),
      ('orcamento_projeto_custos', 'orcamentos.criar_editar', null, null),
      ('orcamento_projeto_links', 'orcamentos.emitir', null, null),
      ('orcamento_final_versoes', 'orcamentos.emitir', null, null),
      ('orcamento_parametros_aplicados', 'orcamentos.emitir', null, null),
      ('orcamento_fundos_acompanhamento', 'orcamentos.fundos', null, null),
      ('orcamento_projeto_catalogo', 'orcamentos.modelos', null, null),
      ('orcamento_projeto_templates', 'orcamentos.modelos', null, null),
      ('parametros_economicos_versoes', 'orcamento.parametros.editar', null, null),
      ('pedidos_compra', 'compras.solicitar', 'compras.aprovar', 'compras.cancelar'),
      ('pedidos_compra_itens', 'compras.solicitar', 'compras.receber', null),
      ('pedidos_internos', 'pedido.criar', 'pedido.aprovar', 'pedido.aprovar'),
      ('pedidos_internos_itens', 'pedido.criar', 'pedido.aprovar', null),
      ('pedidos_internos_anexos', 'pedido.criar', 'pedido.aprovar', null),
      ('pedidos_internos_comunicacoes', 'pedido.criar', 'pedido.aprovar', null),
      ('pedidos_internos_aprovacoes', 'pedido.criar', 'pedido.aprovar', null),
      ('planejamento', 'planejamento.editar', null, null),
      ('planejamento_itens', 'planejamento.editar', null, null),
      ('planejamento_lote_conferencias', 'planejamento.executar', null, null),
      ('inventario_ciclos', 'estoque.lote.gerir', null, null),
      ('inventario_contagens', 'estoque.lote.gerir', null, null),
      ('tipo_insumos', 'cadastros.editar', null, null)
    ) as r(tabela, chave, chave_alternativa, chave_exclusao)
  loop
    if to_regclass(format('public.%I', v_regra.tabela)) is null then
      continue;
    end if;
    -- remove as políticas permissivas de escrita (as restritivas e as de
    -- bloqueio "false" das RPCs ficam). Políticas "for all" de leitura+escrita
    -- abertas são trocadas por leitura aberta + escrita por permissão.
    for v_pol in
      select policyname, cmd from pg_policies
      where schemaname = 'public' and tablename = v_regra.tabela
        and cmd <> 'SELECT' and permissive = 'PERMISSIVE'
        and coalesce(qual, '') <> 'false' and coalesce(with_check, '') <> 'false'
    loop
      execute format('drop policy %I on public.%I', v_pol.policyname, v_regra.tabela);
      if v_pol.cmd = 'ALL' and not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = v_regra.tabela and cmd = 'SELECT'
      ) then
        execute format('create policy %I on public.%I for select to authenticated using (true)',
          'perm_read_' || v_regra.tabela, v_regra.tabela);
      end if;
    end loop;

    v_cond := format('kontrol_private.tem_permissao_efetiva(%L)', v_regra.chave);
    if v_regra.chave_alternativa is not null then
      v_cond := v_cond || format(' or kontrol_private.tem_permissao_efetiva(%L)', v_regra.chave_alternativa);
    end if;

    execute format('create policy %I on public.%I for insert to authenticated with check (%s)',
      'perm_insert_' || v_regra.tabela, v_regra.tabela, v_cond);
    execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)',
      'perm_update_' || v_regra.tabela, v_regra.tabela, v_cond, v_cond);
    execute format('create policy %I on public.%I for delete to authenticated using (%s)',
      'perm_delete_' || v_regra.tabela, v_regra.tabela,
      case when v_regra.chave_exclusao is null then v_cond
        else format('kontrol_private.tem_permissao_efetiva(%L)', v_regra.chave_exclusao) end);
  end loop;
end $$;

-- ---- 5. Leitura bloqueada por módulo ----------------------------------------
do $$
declare
  v_tabela text;
  v_pol record;
begin
  foreach v_tabela in array array[
    'demandas_propostas', 'demanda_analises', 'demanda_grupos_amostras', 'orcamentos',
    'orcamento_itens', 'orcamento_projetos', 'orcamento_projeto_analises',
    'orcamento_projeto_anexos', 'orcamento_projeto_custos', 'orcamento_projeto_links',
    'orcamento_final_versoes', 'orcamento_parametros_aplicados',
    'orcamento_fundos_acompanhamento', 'parametros_economicos_versoes'
  ] loop
    if to_regclass(format('public.%I', v_tabela)) is null then
      continue;
    end if;
    for v_pol in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = v_tabela
        and cmd = 'SELECT' and permissive = 'PERMISSIVE'
    loop
      execute format('drop policy %I on public.%I', v_pol.policyname, v_tabela);
    end loop;
    execute format(
      'create policy %I on public.%I for select to authenticated using (kontrol_private.tem_permissao_efetiva(''orcamentos.visualizar''))',
      'perm_read_' || v_tabela, v_tabela);
  end loop;

  drop policy if exists auditoria_read on public.auditoria;
  drop policy if exists perm_read_auditoria on public.auditoria;
  create policy perm_read_auditoria on public.auditoria
    for select to authenticated
    using (kontrol_private.tem_permissao_efetiva('auditoria.visualizar'));
end $$;

-- ---- 6. Permissões efetivas do usuário corrente (menu e telas) --------------
create or replace function public.minhas_permissoes()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_perfil record;
  v_categoria jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('admin', false, 'permissoes', '{}'::jsonb);
  end if;
  select papel, permissoes, suspenso into v_perfil from public.perfis where id = auth.uid();
  if not found or v_perfil.suspenso then
    return jsonb_build_object('admin', false, 'permissoes', '{}'::jsonb);
  end if;
  if v_perfil.papel = 'admin' then
    return jsonb_build_object('admin', true, 'permissoes', '{}'::jsonb);
  end if;
  select permissoes into v_categoria from public.permissoes_categorias where papel = v_perfil.papel;
  return jsonb_build_object(
    'admin', false,
    'permissoes', coalesce(v_categoria, '{}'::jsonb) || coalesce(v_perfil.permissoes, '{}'::jsonb)
  );
end $$;

revoke all on function public.minhas_permissoes() from public, anon, authenticated, service_role;
grant execute on function public.minhas_permissoes() to authenticated;

commit;
