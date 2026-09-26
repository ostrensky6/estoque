-- =====================================================================
-- 0112 — Salário dos técnicos e valores nominais de pessoal (PE) visíveis
-- somente para quem tem a permissão efetiva 'tecnicos.salario.ver'.
--
-- Padrão: somente admin. A permissão é concedida por categoria
-- (permissoes_categorias) ou por usuário (perfis.permissoes), com a mesma
-- precedência da 0108 (perfil > categoria; admin sempre; suspenso nunca).
--
-- Abordagem (menor risco): privilégio de coluna. Nenhuma tabela, coluna,
-- linha, policy, trigger ou dado existente é removido. Os valores continuam
-- em tecnicos.valor_mes e orcamento_projeto_catalogo.preco_unitario; apenas o
-- SELECT direto dessas duas colunas deixa de ser concedido a anon/authenticated
-- (inclusive admin). A leitura passa por funções SECURITY DEFINER que
-- devolvem o valor real só com permissão e NULL (mascarado) sem ela. O custeio
-- usa apenas o agregado valor_hora_pessoal_total(). Escritas no salário/preço
-- PE sem permissão são rejeitadas por trigger. A auditoria de técnicos grava o
-- salário em linha separada ('tecnicos_remuneracao') e uma policy RESTRICTIVE
-- esconde essas linhas (e o histórico de preços PE) de quem não tem permissão.
--
-- Rollback ensaiável: scripts/sql/rollback-0112-salario-tecnicos.sql.
-- =====================================================================
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- ---- Preflight: falha antes de qualquer DDL se o contrato mudou -------------
do $$
declare
  v_cols text[];
begin
  if to_regnamespace('kontrol_private') is null
    or to_regprocedure('kontrol_private.pode_editar_cadastro(text)') is null then
    raise exception '0112: 0108 ausente (schema/helper privado)';
  end if;
  if to_regprocedure('kontrol_private.tem_permissao_efetiva(text)') is not null
    or to_regprocedure('kontrol_private.pode_ver_salario()') is not null
    or to_regprocedure('kontrol_private.fn_tecnicos_proteger_salario()') is not null
    or to_regprocedure('kontrol_private.fn_catalogo_proteger_preco_pe()') is not null
    or to_regprocedure('kontrol_private.fn_auditoria_tecnicos()') is not null
    or to_regprocedure('public.tem_permissao(text)') is not null
    or to_regprocedure('public.tecnicos_remuneracao()') is not null
    or to_regprocedure('public.valor_hora_pessoal_total()') is not null
    or to_regprocedure('public.orcamento_projeto_catalogo_listar()') is not null then
    raise exception '0112: objetos ja existentes; inspecionar antes de aplicar';
  end if;

  perform papel, permissoes, suspenso from public.perfis where false;
  perform papel, permissoes from public.permissoes_categorias where false;
  perform tabela, registro_id, acao, valor_anterior, valor_novo, usuario
    from public.auditoria where false;

  -- Privilégio de coluna só é seguro com o conjunto de colunas conhecido:
  -- uma coluna nova ficaria invisível (ou, pior, seria esquecida no grant).
  select array_agg(attname::text order by attname) into v_cols
  from pg_catalog.pg_attribute
  where attrelid = 'public.tecnicos'::regclass and attnum > 0 and not attisdropped;
  if v_cols is distinct from array[
    'horas_mes_base', 'id', 'nome', 'percentual_dedicado', 'processo', 'valor_mes'
  ] then
    raise exception '0112: colunas de tecnicos divergentes: %', v_cols;
  end if;

  select array_agg(attname::text order by attname) into v_cols
  from pg_catalog.pg_attribute
  where attrelid = 'public.orcamento_projeto_catalogo'::regclass and attnum > 0 and not attisdropped;
  if v_cols is distinct from array[
    'ativo', 'atualizado_em', 'categoria', 'criado_em', 'descricao', 'id',
    'origem', 'preco_unitario', 'rubrica', 'unidade', 'valid_from'
  ] then
    raise exception '0112: colunas de orcamento_projeto_catalogo divergentes: %', v_cols;
  end if;

  -- tecnicos nunca teve trigger: a auditoria nova nao pode duplicar outra.
  if exists (
    select 1 from pg_catalog.pg_trigger
    where tgrelid = 'public.tecnicos'::regclass and not tgisinternal
  ) then
    raise exception '0112: tecnicos ja possui triggers; inspecionar antes de aplicar';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'auditoria'
      and policyname = 'auditoria_read' and cmd = 'SELECT'
  ) or exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'auditoria'
      and policyname = 'auditoria_salario_restrito'
  ) then
    raise exception '0112: policies de auditoria divergentes';
  end if;
end $$;

-- ---- 1. Nova permissão: padrão somente admin (valores existentes vencem) ----
insert into public.permissoes_categorias (papel, permissoes)
values
  ('tecnico', '{"tecnicos.salario.ver": false}'::jsonb),
  ('coordenador', '{"tecnicos.salario.ver": false}'::jsonb),
  ('gestor', '{"tecnicos.salario.ver": false}'::jsonb),
  ('admin', '{"tecnicos.salario.ver": true}'::jsonb)
on conflict (papel) do update
set permissoes = excluded.permissoes || permissoes_categorias.permissoes,
    atualizado_em = now();

-- ---- 2. Permissão efetiva (mesma regra da 0108, para qualquer chave) --------
create function kontrol_private.tem_permissao_efetiva(p_chave text)
returns boolean
language plpgsql stable security definer
set search_path = pg_catalog
as $$
declare
  v_papel text;
  v_permissoes jsonb;
  v_valor jsonb;
begin
  if p_chave is null
    or p_chave !~ '^[a-z_]+(\.[a-z_]+)+$'
    or auth.uid() is null then
    return false;
  end if;

  select papel, permissoes into v_papel, v_permissoes
  from public.perfis
  where id = auth.uid() and not suspenso;
  if not found then
    return false;
  end if;
  if v_papel = 'admin' then
    return true;
  end if;
  if v_papel not in ('tecnico', 'coordenador', 'gestor') then
    return false;
  end if;

  if v_permissoes ? p_chave then
    v_valor := v_permissoes -> p_chave;
  else
    select permissoes -> p_chave into v_valor
    from public.permissoes_categorias where papel = v_papel;
  end if;
  if jsonb_typeof(v_valor) = 'boolean' then
    return v_valor = 'true'::jsonb;
  end if;
  return false;
end $$;

create function kontrol_private.pode_ver_salario()
returns boolean
language sql stable security definer
set search_path = pg_catalog
as $$
  select kontrol_private.tem_permissao_efetiva('tecnicos.salario.ver')
$$;

revoke all on function kontrol_private.tem_permissao_efetiva(text)
  from public, anon, authenticated, service_role;
revoke all on function kontrol_private.pode_ver_salario()
  from public, anon, authenticated, service_role;
grant execute on function kontrol_private.tem_permissao_efetiva(text) to authenticated;
grant execute on function kontrol_private.pode_ver_salario() to authenticated;

-- Ponte exposta ao PostgREST: o app consulta a mesma regra que o banco aplica.
create function public.tem_permissao(p_chave text)
returns boolean
language sql stable security invoker
set search_path = pg_catalog
as $$
  select kontrol_private.tem_permissao_efetiva(p_chave)
$$;
revoke all on function public.tem_permissao(text) from public, anon, authenticated, service_role;
grant execute on function public.tem_permissao(text) to authenticated;

-- ---- 3. Leitura: privilégio de coluna + funções mascaradas -------------------
-- REVOKE no nível da tabela também remove privilégios de coluna; os grants
-- abaixo reabrem somente as colunas não sensíveis. RLS permanece como está.
revoke select on public.tecnicos from anon, authenticated;
grant select (id, nome, processo, horas_mes_base, percentual_dedicado)
  on public.tecnicos to authenticated;

revoke select on public.orcamento_projeto_catalogo from anon, authenticated;
grant select (id, rubrica, descricao, unidade, categoria, ativo, valid_from,
              origem, criado_em, atualizado_em)
  on public.orcamento_projeto_catalogo to authenticated;

-- Salário por técnico: valor real só com permissão; sem ela, NULL (= "XXX").
create function public.tecnicos_remuneracao()
returns table (id bigint, valor_mes numeric)
language sql stable security definer
set search_path = pg_catalog
as $$
  with acesso as (select kontrol_private.pode_ver_salario() as pode)
  select t.id, case when a.pode then t.valor_mes end
  from public.tecnicos t
  cross join acesso a
  order by t.id
$$;

-- Custeio: somente o agregado Σ (valor_mes / horas_mes_base × %dedicado / 100).
create function public.valor_hora_pessoal_total()
returns numeric
language sql stable security definer
set search_path = pg_catalog
as $$
  select coalesce(sum(t.valor_mes / t.horas_mes_base * t.percentual_dedicado / 100), 0)
  from public.tecnicos t
  where t.horas_mes_base > 0
$$;

-- Catálogo de projetos: preço unitário de PE (pessoas nominais) mascarado.
create function public.orcamento_projeto_catalogo_listar()
returns table (
  id text,
  rubrica text,
  descricao text,
  unidade text,
  preco_unitario numeric,
  preco_mascarado boolean,
  categoria text,
  ativo boolean,
  valid_from timestamptz,
  origem text,
  criado_em timestamptz,
  atualizado_em timestamptz
)
language sql stable security definer
set search_path = pg_catalog
as $$
  with acesso as (select kontrol_private.pode_ver_salario() as pode)
  select c.id, c.rubrica, c.descricao, c.unidade,
    case when c.rubrica = 'PE' and not a.pode then null else c.preco_unitario end,
    (c.rubrica = 'PE' and not a.pode),
    c.categoria, c.ativo, c.valid_from, c.origem, c.criado_em, c.atualizado_em
  from public.orcamento_projeto_catalogo c
  cross join acesso a
  order by c.rubrica, c.descricao, c.id
$$;

revoke all on function public.tecnicos_remuneracao() from public, anon, authenticated, service_role;
revoke all on function public.valor_hora_pessoal_total() from public, anon, authenticated, service_role;
revoke all on function public.orcamento_projeto_catalogo_listar() from public, anon, authenticated, service_role;
grant execute on function public.tecnicos_remuneracao() to authenticated, service_role;
grant execute on function public.valor_hora_pessoal_total() to authenticated, service_role;
grant execute on function public.orcamento_projeto_catalogo_listar() to authenticated, service_role;

-- ---- 4. Escrita: salário / preço PE só com permissão -------------------------
-- Aplica-se a sessões do PostgREST (authenticated/anon). service_role e o
-- owner de migrations (importadores/scripts administrativos) não são afetados.
-- Sem permissão, um técnico pode ser criado com valor_mes = 0 (padrão da
-- coluna) e ter nome/processo/horas/dedicação editados; o salário fica para
-- quem tem permissão.
create function kontrol_private.fn_tecnicos_proteger_salario()
returns trigger
language plpgsql security invoker
set search_path = pg_catalog
as $$
begin
  if current_user::text not in ('authenticated', 'anon')
    or kontrol_private.pode_ver_salario() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.valor_mes is distinct from 0 then
      raise exception using
        errcode = '42501',
        message = 'Sem permissão para definir o salário do técnico (Ver salário dos técnicos).';
    end if;
  elsif new.valor_mes is distinct from old.valor_mes then
    raise exception using
      errcode = '42501',
      message = 'Sem permissão para alterar o salário do técnico (Ver salário dos técnicos).';
  end if;
  return new;
end $$;

create function kontrol_private.fn_catalogo_proteger_preco_pe()
returns trigger
language plpgsql security invoker
set search_path = pg_catalog
as $$
begin
  if current_user::text not in ('authenticated', 'anon')
    or kontrol_private.pode_ver_salario() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.rubrica = 'PE' and new.preco_unitario is distinct from 0 then
      raise exception using
        errcode = '42501',
        message = 'Sem permissão para definir valores de pessoal (PE) do catálogo.';
    end if;
  elsif (old.rubrica = 'PE' or new.rubrica = 'PE')
    and (new.rubrica is distinct from old.rubrica
         or new.preco_unitario is distinct from old.preco_unitario) then
    raise exception using
      errcode = '42501',
      message = 'Sem permissão para alterar valores de pessoal (PE) do catálogo.';
  end if;
  return new;
end $$;

revoke all on function kontrol_private.fn_tecnicos_proteger_salario()
  from public, anon, authenticated, service_role;
revoke all on function kontrol_private.fn_catalogo_proteger_preco_pe()
  from public, anon, authenticated, service_role;

create trigger trg_tecnicos_proteger_salario
  before insert or update on public.tecnicos
  for each row execute function kontrol_private.fn_tecnicos_proteger_salario();
create trigger trg_catalogo_proteger_preco_pe
  before insert or update on public.orcamento_projeto_catalogo
  for each row execute function kontrol_private.fn_catalogo_proteger_preco_pe();

-- ---- 5. Auditoria de técnicos sem expor salário -----------------------------
-- Linha 'tecnicos': mesma forma do fn_auditoria, com valor_mes = "XXX".
-- Linha 'tecnicos_remuneracao': salário real, só quando entra/muda/sai.
create function kontrol_private.fn_auditoria_tecnicos()
returns trigger
language plpgsql security definer
set search_path = pg_catalog
as $$
declare
  v_user text;
  v_registro text;
  v_mascara constant jsonb := jsonb_build_object('valor_mes', 'XXX');
begin
  begin
    v_user := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email';
  exception when others then
    v_user := null;
  end;
  v_user := coalesce(v_user, current_setting('app.usuario', true));
  v_registro := (case when tg_op = 'DELETE' then old.id else new.id end)::text;

  insert into public.auditoria (tabela, registro_id, acao, valor_anterior, valor_novo, usuario)
  values (
    'tecnicos',
    v_registro,
    lower(tg_op),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) || v_mascara end,
    case when tg_op in ('UPDATE', 'INSERT') then to_jsonb(new) || v_mascara end,
    v_user
  );

  if tg_op <> 'UPDATE' or new.valor_mes is distinct from old.valor_mes then
    insert into public.auditoria (tabela, registro_id, acao, valor_anterior, valor_novo, usuario)
    values (
      'tecnicos_remuneracao',
      v_registro,
      lower(tg_op),
      case when tg_op in ('UPDATE', 'DELETE')
        then jsonb_build_object('id', old.id, 'nome', old.nome, 'valor_mes', old.valor_mes) end,
      case when tg_op in ('UPDATE', 'INSERT')
        then jsonb_build_object('id', new.id, 'nome', new.nome, 'valor_mes', new.valor_mes) end,
      v_user
    );
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end $$;

revoke all on function kontrol_private.fn_auditoria_tecnicos()
  from public, anon, authenticated, service_role;

create trigger aud_tecnicos
  after insert or update or delete on public.tecnicos
  for each row execute function kontrol_private.fn_auditoria_tecnicos();

-- Esconde de quem não tem permissão: salário de técnicos (linha dedicada ou
-- qualquer linha de tecnicos com valor numérico) e o histórico de itens PE do
-- catálogo, inclusive as linhas antigas gravadas pelo seed da 0012. Nenhuma
-- linha da trilha é alterada ou removida.
create policy auditoria_salario_restrito on public.auditoria
  as restrictive
  for select to authenticated
  using (
    (select kontrol_private.pode_ver_salario())
    or not (
      tabela = 'tecnicos_remuneracao'
      or (tabela = 'tecnicos' and (
        jsonb_typeof(valor_anterior -> 'valor_mes') = 'number'
        or jsonb_typeof(valor_novo -> 'valor_mes') = 'number'))
      or (tabela = 'orcamento_projeto_catalogo' and 'PE' in (
        coalesce(valor_anterior ->> 'rubrica', ''),
        coalesce(valor_novo ->> 'rubrica', '')))
    )
  );

commit;
