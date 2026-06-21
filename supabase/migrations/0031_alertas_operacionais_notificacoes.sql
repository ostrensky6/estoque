-- =====================================================================
-- Suprimentos: materializa alertas operacionais como notificacoes.
--
-- Mantem a RPC existente e acrescenta notificacoes para quarentena
-- pendente e insumos criticos sem validade, sem alterar a estrutura de
-- dados nem descartar historico.
-- =====================================================================

create or replace function gerar_reposicao_automatica()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_pedido_id bigint;
  v_criados int := 0;
  v_itens int := 0;
  v_notificacoes int := 0;
  v_linhas int := 0;
begin
  for r in
    select *
    from v_previsao_suprimentos
    where qtd_sugerida_compra > 0
      and qtd_pedida_aberta <= 0
      and disponivel <= ponto_reposicao_sugerido
    order by fornecedor_id nulls last, categoria_compra, especificacao
  loop
    select p.id into v_pedido_id
    from pedidos_compra p
    where p.status = 'solicitado'
      and p.fornecedor_id is not distinct from r.fornecedor_id
      and p.observacao = 'Rascunho automatico de reposicao'
    order by p.id desc
    limit 1;

    if v_pedido_id is null then
      insert into pedidos_compra(fornecedor_id, status, solicitante, observacao)
      values (r.fornecedor_id, 'solicitado', 'automacao', 'Rascunho automatico de reposicao')
      returning id into v_pedido_id;
      v_criados := v_criados + 1;
    end if;

    insert into pedidos_compra_itens(pedido_id, insumo_id, quantidade, custo_unitario_estimado)
    values (v_pedido_id, r.insumo_id, r.qtd_sugerida_compra, r.custo_unitario);
    v_itens := v_itens + 1;

    insert into notificacoes(tipo, titulo, corpo, entidade_tipo, entidade_id, papel_destino, dedupe_key)
    select
      'reposicao',
      'Reposicao sugerida',
      r.especificacao || ' esta abaixo do ponto sugerido. Rascunho de compra #' || v_pedido_id || ' criado.',
      'pedido_compra',
      v_pedido_id,
      'coordenador',
      'reposicao:' || r.insumo_id || ':' || current_date
    where not exists (
      select 1 from notificacoes n
      where n.dedupe_key = 'reposicao:' || r.insumo_id || ':' || current_date
    );
    get diagnostics v_linhas = row_count;
    v_notificacoes := v_notificacoes + v_linhas;

    v_pedido_id := null;
  end loop;

  insert into notificacoes(tipo, titulo, corpo, papel_destino, dedupe_key)
  select
    'vencimento',
    'Lotes vencendo',
    count(*) || ' lote(s) aceitos entram no horizonte de vencimento ou ja venceram.',
    'gestor',
    'vencimentos:' || current_date
  from v_alertas_estoque
  where tipo in ('vencimento','vencido')
  having count(*) > 0
     and not exists (
       select 1 from notificacoes n
       where n.dedupe_key = 'vencimentos:' || current_date
     );
  get diagnostics v_linhas = row_count;
  v_notificacoes := v_notificacoes + v_linhas;

  insert into notificacoes(tipo, titulo, corpo, entidade_tipo, entidade_id, papel_destino, dedupe_key)
  select
    'vencimento',
    'Insumo critico sem validade',
    a.especificacao || ' possui lote aceito/em uso sem validade cadastrada. Saldo afetado: ' || a.valor || '.',
    'insumo',
    a.insumo_id,
    'coordenador',
    'sem_validade:' || a.insumo_id || ':' || current_date
  from v_alertas_estoque a
  where a.tipo = 'sem_validade'
    and not exists (
      select 1 from notificacoes n
      where n.dedupe_key = 'sem_validade:' || a.insumo_id || ':' || current_date
    );
  get diagnostics v_linhas = row_count;
  v_notificacoes := v_notificacoes + v_linhas;

  insert into notificacoes(tipo, titulo, corpo, entidade_tipo, entidade_id, papel_destino, dedupe_key)
  select
    'sistema',
    'Quarentena pendente',
    a.especificacao || ' tem ' || a.valor || ' unidade(s) aguardando aceite no estoque.',
    'insumo',
    a.insumo_id,
    'coordenador',
    'quarentena:' || a.insumo_id || ':' || current_date
  from v_alertas_estoque a
  where a.tipo = 'quarentena'
    and not exists (
      select 1 from notificacoes n
      where n.dedupe_key = 'quarentena:' || a.insumo_id || ':' || current_date
    );
  get diagnostics v_linhas = row_count;
  v_notificacoes := v_notificacoes + v_linhas;

  return jsonb_build_object(
    'pedidos_criados', v_criados,
    'itens_criados', v_itens,
    'notificacoes_criadas', v_notificacoes
  );
end $$;

grant execute on function gerar_reposicao_automatica() to authenticated, service_role;
