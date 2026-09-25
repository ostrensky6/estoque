-- Relatorio de bugs v5 (itens 9 e 12).
--
-- Item 12: o salario dos tecnicos (tecnicos.valor_mes) era legivel por
-- qualquer usuario autenticado. Passa a exigir a permissao configuravel
-- 'tecnicos.remuneracao.ver' (padrao: gestor e admin; editavel na matriz de
-- privilegios e por usuario). Quem nao tem a permissao continua vendo nome,
-- processo, horas e dedicacao por listar_tecnicos(), com a remuneracao nula,
-- e o custeio usa somente o total agregado de fn_valor_hora_pessoal().
--
-- Item 9: a escrita no catalogo de analises aceitava apenas papel
-- coordenador+. Passa a aceitar tambem quem recebeu 'analises.editar'
-- (regra antiga preservada com OR; nenhum acesso existente e retirado).
--
-- Aditiva: nao remove tabelas, colunas, dados, RLS nem gatilhos de auditoria.
-- Rollback: recriar rls_read_tecnicos (using true) e as policies
-- rls_coordenador_* das tabelas de analises com papel_minimo('coordenador').

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
begin
  if to_regnamespace('kontrol_private') is null
    or to_regclass('public.tecnicos') is null
    or to_regclass('public.permissoes_categorias') is null
    or to_regclass('public.analises') is null
    or to_regprocedure('public.papel_minimo(text)') is null then
    raise exception '0112: dependencias ausentes (0014, 0042, 0108)';
  end if;
end $$;

-- 1) Permissao efetiva generica (mesma regra de pode_editar_cadastro) ------

create or replace function kontrol_private.tem_permissao(p_chave text)
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
    or p_chave not in ('tecnicos.remuneracao.ver', 'analises.editar')
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

revoke all on function kontrol_private.tem_permissao(text)
  from public, anon, authenticated, service_role;
grant execute on function kontrol_private.tem_permissao(text) to authenticated;

-- Consulta publica (somente as chaves acima) para a interface decidir o que mostrar.
create or replace function public.tem_permissao(p_chave text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select kontrol_private.tem_permissao(p_chave);
$$;

revoke all on function public.tem_permissao(text) from public, anon;
grant execute on function public.tem_permissao(text) to authenticated;

-- Padroes por papel (nao sobrescreve valor ja definido pelo administrador).
update public.permissoes_categorias
   set permissoes = permissoes || jsonb_build_object('tecnicos.remuneracao.ver', papel in ('gestor', 'admin')),
       atualizado_em = now()
 where not (permissoes ? 'tecnicos.remuneracao.ver');

update public.permissoes_categorias
   set permissoes = permissoes || jsonb_build_object('analises.editar', papel in ('coordenador', 'gestor', 'admin')),
       atualizado_em = now()
 where not (permissoes ? 'analises.editar');

-- 2) Leitura da tabela tecnicos restrita a quem pode ver remuneracao ------

drop policy if exists rls_read_tecnicos on public.tecnicos;
drop policy if exists rls_remuneracao_read_tecnicos on public.tecnicos;
create policy rls_remuneracao_read_tecnicos on public.tecnicos
  for select to authenticated
  using (kontrol_private.tem_permissao('tecnicos.remuneracao.ver'));

-- Lista para todos os autenticados; remuneracao so para quem tem permissao.
create or replace function public.listar_tecnicos()
returns table (
  id bigint,
  nome text,
  processo text,
  valor_mes numeric,
  horas_mes_base numeric,
  percentual_dedicado numeric,
  remuneracao_visivel boolean
)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_pode boolean := kontrol_private.tem_permissao('tecnicos.remuneracao.ver');
begin
  if auth.uid() is null then
    return;
  end if;
  return query
    select t.id::bigint, t.nome::text, t.processo::text,
           case when v_pode then t.valor_mes::numeric end,
           t.horas_mes_base::numeric, t.percentual_dedicado::numeric,
           v_pode
    from public.tecnicos t
    order by t.nome;
end $$;

revoke all on function public.listar_tecnicos() from public, anon;
grant execute on function public.listar_tecnicos() to authenticated;

-- Total do valor-hora de pessoal (Σ valor_mes / horas × %dedicado), usado no custeio.
create or replace function public.fn_valor_hora_pessoal()
returns numeric
language sql stable security definer
set search_path = ''
as $$
  select case when auth.uid() is null then 0 else coalesce(sum(
    case when t.horas_mes_base > 0
      then (t.valor_mes / t.horas_mes_base) * t.percentual_dedicado / 100
      else 0 end
  ), 0) end
  from public.tecnicos t;
$$;

revoke all on function public.fn_valor_hora_pessoal() from public, anon;
grant execute on function public.fn_valor_hora_pessoal() to authenticated;

-- Auditoria das alteracoes de remuneracao.
do $$
begin
  if to_regprocedure('public.fn_auditoria()') is not null
    and not exists (
      select 1 from pg_catalog.pg_trigger
      where tgrelid = 'public.tecnicos'::regclass and tgname = 'aud_tecnicos'
    ) then
    create trigger aud_tecnicos after insert or update or delete on public.tecnicos
      for each row execute function public.fn_auditoria();
  end if;
end $$;

-- 3) Catalogo de analises: coordenador+ OU permissao analises.editar -------

do $$
declare
  t text;
  op text;
  pol record;
begin
  foreach t in array array['analises', 'etapas', 'insumo_analise', 'equipamento_analise'] loop
    if to_regclass(format('public.%I', t)) is null then
      continue;
    end if;
    foreach op in array array['insert', 'update', 'delete'] loop
      select * into pol from pg_catalog.pg_policies
      where schemaname = 'public' and tablename = t
        and policyname = format('rls_coordenador_%s_%s', op, t);
      if not found then
        continue;
      end if;
      execute format('drop policy %I on public.%I', pol.policyname, t);
      if op = 'insert' then
        execute format(
          'create policy %I on public.%I for insert to authenticated with check (public.papel_minimo(%L) or kontrol_private.tem_permissao(%L))',
          format('rls_analises_insert_%s', t), t, 'coordenador', 'analises.editar');
      elsif op = 'update' then
        execute format(
          'create policy %I on public.%I for update to authenticated using (public.papel_minimo(%L) or kontrol_private.tem_permissao(%L)) with check (public.papel_minimo(%L) or kontrol_private.tem_permissao(%L))',
          format('rls_analises_update_%s', t), t, 'coordenador', 'analises.editar', 'coordenador', 'analises.editar');
      else
        execute format(
          'create policy %I on public.%I for delete to authenticated using (public.papel_minimo(%L) or kontrol_private.tem_permissao(%L))',
          format('rls_analises_delete_%s', t), t, 'coordenador', 'analises.editar');
      end if;
    end loop;
  end loop;
end $$;

commit;
