-- Defesa em profundidade para a execução do plano: mesmo que a baixa seja
-- chamada diretamente pela API/RPC, nenhuma saída vinculada ao plano pode ser
-- registrada sem reserva operacional de todos os equipamentos da receita.

create or replace function public.fn_validar_equipamentos_na_baixa_plano()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_planejamento_id bigint;
  v_equipamento_id bigint;
begin
  if new.tipo <> 'saida' or new.referencia !~ '^plano [0-9]+(;|$)' then
    return new;
  end if;

  v_planejamento_id := substring(new.referencia from '^plano ([0-9]+)')::bigint;

  for v_equipamento_id in
    select distinct ea.equipamento_id
      from planejamento_itens pi
      join equipamento_analise ea on ea.codigo_analise = pi.codigo_analise
     where pi.planejamento_id = v_planejamento_id
  loop
    if not exists (
      select 1
        from equipamento_reservas er
        join equipamento_unidades eu on eu.id = er.equipamento_unidade_id
       where er.planejamento_id = v_planejamento_id
         and er.status in ('reservado', 'em_uso')
         and eu.equipamento_id = v_equipamento_id
         and eu.ativo
         and eu.status_operacional not in ('em_manutencao', 'calibracao_vencida', 'inativo', 'descartado')
    ) then
      raise exception 'Não é possível iniciar/baixar o plano %: equipamento % exigido pela análise não possui reserva operacional válida.', v_planejamento_id, v_equipamento_id
        using errcode = '23514';
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_validar_equipamentos_na_baixa_plano on public.estoque_movimentacoes;
create trigger trg_validar_equipamentos_na_baixa_plano
  before insert on public.estoque_movimentacoes
  for each row execute function public.fn_validar_equipamentos_na_baixa_plano();

comment on function public.fn_validar_equipamentos_na_baixa_plano() is
  'Bloqueia saída de estoque referenciada por plano quando a receita exigir equipamento sem reserva ativa e operacional.';
