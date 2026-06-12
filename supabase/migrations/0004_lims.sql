-- =====================================================================
-- Evolução para arquitetura LIMS (Benchling/Labguru/ISO 15189):
-- 3 níveis (produto-mestre · lote · localização), estados do material,
-- validade dupla, compras, auditoria, protocolo de consumo refinado.
-- A implementação de UI é gradual; o MODELO nasce preparado.
-- =====================================================================

-- ---- Fornecedores ----------------------------------------------------
create table fornecedores (
  id              bigint generated always as identity primary key,
  nome            text not null,
  contato         text,
  catalogo_padrao text,
  prazo_medio_dias int,
  prazo_max_dias   int,
  ativo           boolean not null default true
);

-- ---- Localização (hierárquica: prédio>sala>freezer>gaveta>caixa) -----
create table locais (
  id          bigint generated always as identity primary key,
  nome        text not null,
  tipo        text,   -- predio, sala, freezer, geladeira, armario, gaveta, caixa, rack, posicao
  parent_id   bigint references locais(id) on delete set null,
  condicao_armazenamento text  -- ex.: -20°C, 4°C, ambiente
);

-- ---- Produto-mestre: campos de identificação/compra/segurança --------
alter table insumos
  add column codigo_interno          text,
  add column codigo_fabricante       text,
  add column fabricante              text,
  add column categoria_compra        text default 'operacional'
       check (categoria_compra in ('critico','operacional','eventual')),
  add column fornecedor_id           bigint references fornecedores(id) on delete set null,
  add column fornecedor_alt_id       bigint references fornecedores(id) on delete set null,
  add column sds_url                 text,            -- FISPQ / SDS
  add column condicao_armazenamento  text,
  add column validade_apos_abertura_dias int,         -- validade dupla
  add column quantidade_minima_compra numeric,
  add column prazo_entrega_max_dias  int;

-- ---- Lote: estados, localização, qualidade, validade dupla -----------
alter table lotes_estoque
  add column status            text not null default 'quarentena'
       check (status in ('quarentena','aceito','em_uso','bloqueado','consumido','descartado')),
  add column local_id          bigint references locais(id) on delete set null,
  add column nota_fiscal        text,
  add column certificado_analise text,
  add column projeto            text,
  add column data_abertura      date,
  add column validade_apos_abertura date,             -- calculada na abertura
  add column responsavel_recebimento text,
  add column responsavel_liberacao   text,
  add column criterio_aceitacao text,
  add column motivo_bloqueio    text,
  add column condicao_recebimento text;

-- ---- Compras (solicitação → aprovação → pedido → recebimento) --------
create table pedidos_compra (
  id            bigint generated always as identity primary key,
  fornecedor_id bigint references fornecedores(id) on delete set null,
  status        text not null default 'solicitado'
                check (status in ('solicitado','aprovado','enviado','em_transito','recebido','cancelado')),
  solicitante   text,
  aprovador     text,
  projeto       text,
  data_solicitacao  date not null default current_date,
  data_aprovacao    date,
  data_prevista_entrega date,
  observacao    text,
  criado_em     timestamptz not null default now()
);

create table pedidos_compra_itens (
  id            bigint generated always as identity primary key,
  pedido_id     bigint not null references pedidos_compra(id) on delete cascade,
  insumo_id     bigint not null references insumos(id) on delete cascade,
  quantidade    numeric not null,
  custo_unitario_estimado numeric,
  lote_id       bigint references lotes_estoque(id) on delete set null  -- preenchido no recebimento
);

-- ---- Planejamento: controles, repetições, perdas, projeto ------------
alter table planejamento
  add column projeto    text,
  add column responsavel text;

alter table planejamento_itens
  add column n_controles numeric not null default 0,
  add column repeticoes  numeric not null default 1,
  add column perda_percentual numeric not null default 0;

-- ---- Protocolo: base de cálculo do consumo ---------------------------
alter table insumo_analise
  add column base_calculo text;  -- por_amostra, por_reacao, por_placa, por_batelada, por_controle

-- ---- Auditoria (trilha) ----------------------------------------------
create table auditoria (
  id             bigint generated always as identity primary key,
  tabela         text not null,
  registro_id    text,
  acao           text not null,           -- insert/update/delete
  valor_anterior jsonb,
  valor_novo     jsonb,
  usuario        text,                    -- preenchido via set_config('app.usuario',...) quando houver auth
  justificativa  text,
  criado_em      timestamptz not null default now()
);
create index on auditoria (tabela, registro_id);

create or replace function fn_auditoria()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into auditoria(tabela, registro_id, acao, valor_anterior, valor_novo, usuario)
  values (
    tg_table_name,
    (case when tg_op = 'DELETE' then old.id else new.id end)::text,
    lower(tg_op),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('UPDATE','INSERT') then to_jsonb(new) else null end,
    current_setting('app.usuario', true)
  );
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create trigger aud_lotes    after insert or update or delete on lotes_estoque    for each row execute function fn_auditoria();
create trigger aud_insumos  after insert or update or delete on insumos          for each row execute function fn_auditoria();
create trigger aud_reservas after insert or update or delete on reservas_estoque for each row execute function fn_auditoria();
create trigger aud_pedidos  after insert or update or delete on pedidos_compra   for each row execute function fn_auditoria();

-- =====================================================================
-- Views status-aware (disponível real considera só lotes ACEITOS e não vencidos)
-- =====================================================================
drop view if exists v_alertas_estoque;
drop view if exists v_estoque_saldo;

create view v_estoque_saldo as
select
  i.id as insumo_id,
  i.nome_item,
  i.especificacao,
  i.unidade,
  coalesce(sum(l.quantidade_atual) filter (where l.status in ('aceito','em_uso')), 0)            as em_maos,
  coalesce(sum(l.quantidade_atual) filter (where l.status = 'quarentena'), 0)                    as em_quarentena,
  coalesce(sum(l.quantidade_atual) filter (where l.status = 'bloqueado'), 0)                     as bloqueado,
  coalesce(sum(l.quantidade_atual) filter (where l.status in ('aceito','em_uso')
            and l.validade < current_date), 0)                                                  as vencido,
  (select coalesce(sum(r.quantidade), 0) from reservas_estoque r
     where r.insumo_id = i.id and r.status = 'reservado')                                        as reservado,
  coalesce(sum(l.quantidade_atual) filter (where l.status in ('aceito','em_uso')
            and (l.validade is null or l.validade >= current_date)), 0)
    - (select coalesce(sum(r.quantidade), 0) from reservas_estoque r
         where r.insumo_id = i.id and r.status = 'reservado')                                    as disponivel,
  i.ponto_reposicao,
  i.estoque_seguranca,
  i.lead_time_dias,
  i.categoria_compra
from insumos i
left join lotes_estoque l on l.insumo_id = i.id
group by i.id;

create view v_alertas_estoque as
-- reposição (sobre o disponível real)
select 'reposicao'::text as tipo, s.insumo_id, s.especificacao,
       null::date as validade, s.disponivel as valor, s.ponto_reposicao as referencia
from v_estoque_saldo s
where s.ponto_reposicao > 0 and s.disponivel <= s.ponto_reposicao
union all
-- quarentena pendente
select 'quarentena', s.insumo_id, s.especificacao, null, s.em_quarentena, null
from v_estoque_saldo s
where s.em_quarentena > 0
union all
-- vencimento / vencido (lotes aceitos com saldo)
select case when l.validade < current_date then 'vencido' else 'vencimento' end,
       l.insumo_id, i.especificacao, l.validade, l.quantidade_atual, null
from lotes_estoque l
join insumos i on i.id = l.insumo_id
where l.quantidade_atual > 0 and l.validade is not null
  and l.status in ('aceito','em_uso')
  and l.validade <= current_date
      + ((select valor from parametros where chave = 'janela_vencimento_dias')::int);

-- =====================================================================
-- RPCs (estados do material)
-- =====================================================================

-- recebimento → entra em QUARENTENA (precisa aceitação para uso)
drop function if exists receber_lote(bigint,numeric,date,numeric,text,text);
create function receber_lote(
  p_insumo_id  bigint,
  p_quantidade numeric,
  p_validade   date    default null,
  p_custo      numeric default null,
  p_codigo     text    default null,
  p_fornecedor text    default null,
  p_local_id   bigint  default null,
  p_nota_fiscal text   default null,
  p_projeto    text    default null
) returns bigint language plpgsql security definer set search_path = public as $$
declare v_lote bigint;
begin
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

-- aceitar lote (libera para uso)
create or replace function aceitar_lote(p_lote_id bigint, p_responsavel text default null, p_criterio text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  update lotes_estoque
     set status = 'aceito', responsavel_liberacao = p_responsavel, criterio_aceitacao = p_criterio
   where id = p_lote_id and status = 'quarentena';
end $$;

-- bloquear / desbloquear
create or replace function bloquear_lote(p_lote_id bigint, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update lotes_estoque set status = 'bloqueado', motivo_bloqueio = p_motivo where id = p_lote_id;
end $$;

create or replace function desbloquear_lote(p_lote_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  update lotes_estoque set status = 'aceito', motivo_bloqueio = null where id = p_lote_id and status = 'bloqueado';
end $$;

-- descartar lote (com justificativa) → zera saldo + movimentação de ajuste
create or replace function descartar_lote(p_lote_id bigint, p_justificativa text)
returns void language plpgsql security definer set search_path = public as $$
declare v_insumo bigint; v_qtd numeric;
begin
  update lotes_estoque set status = 'descartado', quantidade_atual = 0 where id = p_lote_id
  returning insumo_id, quantidade_inicial into v_insumo, v_qtd;
  insert into estoque_movimentacoes(insumo_id, tipo, quantidade, motivo, lote_id)
  values (v_insumo, 'ajuste', v_qtd, 'descarte: ' || p_justificativa, p_lote_id);
end $$;

-- baixa definitiva: FEFO entre lotes ACEITOS e não vencidos; abre/consome lote.
create or replace function dar_baixa_plano(p_planejamento_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r record; l record; v_rem numeric; v_take numeric;
  v_short jsonb := '[]'::jsonb;
begin
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

-- =====================================================================
-- RLS + grants nas tabelas novas
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['fornecedores','locais','pedidos_compra','pedidos_compra_itens','auditoria'] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('create policy authenticated_all_%1$s on public.%1$I for all to authenticated using (true) with check (true);', t);
    execute format('create policy anon_read_%1$s on public.%1$I for select to anon using (true);', t);
  end loop;
end $$;

-- service_role precisa de privilégios diretos nas tabelas (RPCs são definer,
-- mas o app também escreve direto via service_role). Re-concede tudo.
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

grant execute on function receber_lote(bigint,numeric,date,numeric,text,text,bigint,text,text) to authenticated, service_role;
grant execute on function aceitar_lote(bigint,text,text)    to authenticated, service_role;
grant execute on function bloquear_lote(bigint,text)        to authenticated, service_role;
grant execute on function desbloquear_lote(bigint)          to authenticated, service_role;
grant execute on function descartar_lote(bigint,text)       to authenticated, service_role;
