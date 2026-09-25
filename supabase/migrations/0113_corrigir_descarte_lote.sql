-- Correcao do descarte de lote (auditoria de suprimentos, P0).
--
-- A versao anterior de descartar_lote (0014) registrava a quantidade
-- INICIAL do lote como movimentacao, e nao o saldo que estava sendo
-- descartado; nao gravava o custo unitario (a perda ficava sem valor) e
-- aceitava descartar de novo um lote ja consumido ou descartado, gerando
-- movimentacoes duplicadas.
--
-- Esta versao:
--   * mantem a mesma assinatura (bigint, text), retorno void e o papel
--     minimo 'gestor';
--   * trava o lote e recusa lotes inexistentes, 'consumido' ou 'descartado';
--   * registra o saldo atual (quantidade_atual) como 'ajuste' -- perdas
--     continuam fora da previsao de consumo, que soma apenas 'saida' --,
--     com o custo_unitario do lote, a justificativa no motivo e
--     categoria_saida = 'descarte' (coluna criada na 0111);
--   * continua zerando o saldo e mudando o status para 'descartado'.
--
-- Aditiva: nao remove dados, colunas, politicas, gatilhos nem permissoes.
-- Rollback: reaplicar o corpo de descartar_lote da 0014 (create or replace).

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
begin
  if to_regprocedure('public.descartar_lote(bigint, text)') is null then
    raise exception '0113: requer a funcao descartar_lote(bigint, text) (0014)';
  end if;
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'estoque_movimentacoes'
      and column_name = 'categoria_saida'
  ) then
    raise exception '0113: requer a migration 0111 (estoque_movimentacoes.categoria_saida)';
  end if;
end $$;

create or replace function public.descartar_lote(p_lote_id bigint, p_justificativa text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lote public.lotes_estoque%rowtype;
  v_justificativa text := nullif(btrim(coalesce(p_justificativa, '')), '');
begin
  perform public.fn_exige_papel('gestor');

  select * into v_lote
  from public.lotes_estoque l
  where l.id = p_lote_id
  for update;
  if not found then
    raise exception 'Lote não encontrado.' using errcode = 'P0002';
  end if;
  if v_lote.status = 'descartado' then
    raise exception 'Este lote já foi descartado.' using errcode = '22023';
  end if;
  if v_lote.status = 'consumido' then
    raise exception 'Este lote já foi consumido; não há saldo para descartar.' using errcode = '22023';
  end if;

  update public.lotes_estoque
     set status = 'descartado',
         quantidade_atual = 0
   where id = p_lote_id;

  if coalesce(v_lote.quantidade_atual, 0) > 0 then
    insert into public.estoque_movimentacoes (
      insumo_id, tipo, quantidade, custo_unitario, motivo, lote_id, categoria_saida
    ) values (
      v_lote.insumo_id, 'ajuste', v_lote.quantidade_atual, v_lote.custo_unitario,
      'descarte: ' || coalesce(v_justificativa, '—'), p_lote_id, 'descarte'
    );
  end if;
end;
$$;

revoke execute on function public.descartar_lote(bigint, text) from public, anon;
grant execute on function public.descartar_lote(bigint, text) to authenticated, service_role;

commit;
