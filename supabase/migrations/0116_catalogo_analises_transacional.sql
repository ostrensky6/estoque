-- Relatorio de bugs v5 (item 9): criar, duplicar e excluir analises.
--
-- As acoes do app apagavam etapas/materiais/equipamentos antes de tentar
-- apagar a analise (que falhava se houvesse orcamento), e a duplicacao nao
-- conferia as copias. Estas funcoes fazem cada operacao numa transacao:
--   duplicar_analise: copia cabecalho, etapas, equipamentos, materiais e
--     matrizes; nada fica pela metade.
--   excluir_analise_sem_historico: so apaga analise sem uso em orcamentos,
--     propostas ou planejamentos; com historico, orienta a inativar.
-- Autorizacao: mesma regra de escrita das tabelas (0114): coordenador+ ou
-- permissao 'analises.editar'.
--
-- Aditiva: nao altera tabelas, RLS nem gatilhos existentes.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
begin
  if to_regprocedure('kontrol_private.pode_editar_analises()') is null then
    raise exception '0116: requer a migration 0114 (kontrol_private.pode_editar_analises)';
  end if;
end $$;

-- Copia as linhas de uma tabela filha trocando o codigo da analise.
create or replace function kontrol_private.copiar_filhos_analise(
  p_tabela text,
  p_origem text,
  p_novo text
) returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_cols text;
  v_linhas integer;
begin
  if to_regclass(format('public.%I', p_tabela)) is null then
    return 0;
  end if;
  select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position)
    into v_cols
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = p_tabela
    and c.column_name not in ('id', 'codigo_analise')
    and c.is_generated = 'NEVER'
    and c.is_identity = 'NO'
    and coalesce(c.column_default, '') not like 'nextval(%';
  if v_cols is null then
    return 0;
  end if;
  execute format(
    'insert into public.%1$I (codigo_analise, %2$s) select $1, %2$s from public.%1$I where codigo_analise = $2',
    p_tabela, v_cols
  ) using p_novo, p_origem;
  get diagnostics v_linhas = row_count;
  return v_linhas;
end $$;

revoke all on function kontrol_private.copiar_filhos_analise(text, text, text)
  from public, anon, authenticated, service_role;

create or replace function public.duplicar_analise(
  p_origem text,
  p_novo text,
  p_nome text
) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_base public.analises%rowtype;
  v_novo text := btrim(coalesce(p_novo, ''));
  v_resultado jsonb := '{}'::jsonb;
  t text;
begin
  if auth.uid() is null or not kontrol_private.pode_editar_analises() then
    raise exception 'Sem permissão para editar o catálogo de análises.' using errcode = '42501';
  end if;
  if v_novo = '' or v_novo !~ '^[A-Za-z0-9_.-]{2,60}$' then
    raise exception 'Código inválido: use de 2 a 60 letras, números, _ . ou -, sem espaços.' using errcode = '22023';
  end if;

  select * into v_base from public.analises a where a.codigo = btrim(p_origem) for share;
  if not found then
    raise exception 'Análise de origem não encontrada.' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.analises a where lower(a.codigo) = lower(v_novo)) then
    raise exception 'Já existe uma análise com o código %.', v_novo using errcode = '23505';
  end if;

  insert into public.analises (codigo, nome, descricao, nome_simplificado, status, ativo, ofertavel)
  values (
    v_novo,
    coalesce(nullif(btrim(coalesce(p_nome, '')), ''), coalesce(v_base.nome, v_base.codigo) || ' (cópia)'),
    v_base.descricao,
    v_base.nome_simplificado,
    v_base.status,
    true,
    false
  );

  foreach t in array array['etapas', 'equipamento_analise', 'insumo_analise', 'analises_matrizes_amostras'] loop
    v_resultado := v_resultado || jsonb_build_object(t, kontrol_private.copiar_filhos_analise(t, v_base.codigo, v_novo));
  end loop;

  return jsonb_build_object('codigo', v_novo, 'copiados', v_resultado);
end $$;

create or replace function public.excluir_analise_sem_historico(p_codigo text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_codigo text := btrim(coalesce(p_codigo, ''));
  v_refs bigint := 0;
  v_n bigint;
  t text;
begin
  if auth.uid() is null or not kontrol_private.pode_editar_analises() then
    raise exception 'Sem permissão para editar o catálogo de análises.' using errcode = '42501';
  end if;
  perform 1 from public.analises a where a.codigo = v_codigo for update;
  if not found then
    raise exception 'Análise não encontrada.' using errcode = 'P0002';
  end if;

  foreach t in array array['orcamento_itens', 'orcamento_projeto_analises', 'planejamento_itens', 'demanda_analises'] loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('select count(*) from public.%I where codigo_analise = $1', t) into v_n using v_codigo;
      v_refs := v_refs + v_n;
    end if;
  end loop;
  if v_refs > 0 then
    raise exception 'Esta análise aparece em % orçamento(s), proposta(s) ou plano(s). Para preservar o histórico, inative-a em vez de excluir.', v_refs
      using errcode = '23503';
  end if;

  delete from public.insumo_analise where codigo_analise = v_codigo;
  delete from public.equipamento_analise where codigo_analise = v_codigo;
  delete from public.etapas where codigo_analise = v_codigo;
  if to_regclass('public.analises_matrizes_amostras') is not null then
    delete from public.analises_matrizes_amostras where codigo_analise = v_codigo;
  end if;
  delete from public.analises where codigo = v_codigo;

  return jsonb_build_object('codigo', v_codigo, 'excluida', true);
end $$;

revoke all on function public.duplicar_analise(text, text, text) from public, anon;
revoke all on function public.excluir_analise_sem_historico(text) from public, anon;
grant execute on function public.duplicar_analise(text, text, text) to authenticated;
grant execute on function public.excluir_analise_sem_historico(text) to authenticated;

commit;
