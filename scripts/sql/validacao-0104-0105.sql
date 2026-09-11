-- =====================================================================
-- Validação das migrations 0104 e 0105 contra um banco real.
--
-- Ambiente: banco LOCAL descartável de testes. Nunca apontar para o
-- projeto remoto.
--
--   supabase db reset --local
--   docker exec -i supabase_db_<project_id> psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 -f scripts/sql/validacao-0104-0105.sql
--
-- Cada bloco imprime PASSOU/FALHOU. As identidades usam papéis reais via
-- `set local role authenticated` + claims de JWT — nunca acesso
-- administrativo para simular o usuário.
-- =====================================================================

\pset pager off
\set QUIET on

-- ---------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','authenticated','authenticated','tecnico@teste.local','x',now(),now(),now()),
  ('00000000-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222','authenticated','authenticated','coord@teste.local','x',now(),now(),now())
on conflict (id) do nothing;

update perfis set papel='tecnico'     where id='11111111-1111-1111-1111-111111111111';
update perfis set papel='coordenador' where id='22222222-2222-2222-2222-222222222222';

create or replace function _como(p_papel text) returns void language plpgsql as $f$
begin
  if p_papel = 'tecnico' then
    perform set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","email":"tecnico@teste.local"}', true);
  else
    perform set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","email":"coord@teste.local"}', true);
  end if;
end $f$;

create table if not exists _t_planos (rotulo text primary key, id bigint);
create table if not exists _t_demanda (rotulo text primary key, id bigint);
truncate _t_planos; truncate _t_demanda;

with novos as (
  insert into planejamento (nome, status_operacional)
  values ('Plano limpo','rascunho'), ('Plano com reserva','rascunho'), ('Plano reservado','reservado')
  returning id, nome
)
insert into _t_planos (rotulo, id)
select case nome when 'Plano limpo' then 'limpo'
                 when 'Plano com reserva' then 'com_reserva'
                 else 'reservado' end, id
from novos;

insert into planejamento_itens (planejamento_id, codigo_analise, n_amostras)
select (select id from _t_planos where rotulo='limpo'), codigo, 5 from analises limit 1;

insert into reservas_estoque (planejamento_id, insumo_id, quantidade, status)
select (select id from _t_planos where rotulo='com_reserva'), id, 1, 'reservado' from insumos limit 1;

-- =====================================================================
-- P1 — exclusão de planejamento
-- =====================================================================

-- T0: reprodução controlada do defeito anterior (revertida por rollback)
do $$
declare v_id bigint; v_linhas int;
begin
  select id into v_id from _t_planos where rotulo='limpo';
  execute 'drop trigger trg_bloquear_exclusao_direta_planejamento on planejamento';
  set local role authenticated; perform _como('tecnico');
  delete from planejamento where id = v_id;
  get diagnostics v_linhas = row_count;
  reset role;
  raise notice 'T0 pre-0104 (reproducao)      | % | tecnico apagou % linha(s)',
    case when v_linhas > 0 then 'DEFEITO REPRODUZIDO' else 'nao reproduzido' end, v_linhas;
  raise exception 'rollback proposital';
exception when others then
  if sqlerrm <> 'rollback proposital' then raise notice 'T0 erro inesperado: %', sqlerrm; end if;
end $$;

-- T1: técnico, DELETE direto
do $$
declare v_id bigint;
begin
  select id into v_id from _t_planos where rotulo='limpo';
  set local role authenticated; perform _como('tecnico');
  delete from planejamento where id = v_id;
  reset role;
  raise notice 'T1 tecnico DELETE direto      | FALHOU: exclusao passou';
exception when others then
  reset role;
  raise notice 'T1 tecnico DELETE direto      | PASSOU: bloqueado (%)', sqlstate;
end $$;

-- T2: técnico, via RPC
do $$
declare v_id bigint;
begin
  select id into v_id from _t_planos where rotulo='limpo';
  set local role authenticated; perform _como('tecnico');
  perform excluir_planejamento_rascunho(v_id);
  reset role;
  raise notice 'T2 tecnico via RPC            | FALHOU: exclusao passou';
exception when others then
  reset role;
  raise notice 'T2 tecnico via RPC            | PASSOU: bloqueado (%)', sqlstate;
end $$;

-- T3: tentativa de forjar o marcador transacional
do $$
declare v_id bigint;
begin
  select id into v_id from _t_planos where rotulo='limpo';
  set local role authenticated; perform _como('coordenador');
  perform set_config('app.planejamento_exclusao','permitida', true);
  delete from planejamento where id = v_id;
  reset role;
  raise notice 'T3 marcador forjado           | FALHOU: marcador explorado';
exception when others then
  reset role;
  raise notice 'T3 marcador forjado           | PASSOU: bloqueado (%)', sqlstate;
end $$;

-- T4: coordenador, plano com dependência
do $$
declare v_id bigint;
begin
  select id into v_id from _t_planos where rotulo='com_reserva';
  set local role authenticated; perform _como('coordenador');
  perform excluir_planejamento_rascunho(v_id);
  reset role;
  raise notice 'T4 coord + dependencia        | FALHOU: excluiu plano com reserva';
exception when others then
  reset role;
  raise notice 'T4 coord + dependencia        | PASSOU: bloqueado (%)', sqlstate;
end $$;

-- T5: coordenador, plano fora de rascunho
do $$
declare v_id bigint;
begin
  select id into v_id from _t_planos where rotulo='reservado';
  set local role authenticated; perform _como('coordenador');
  perform excluir_planejamento_rascunho(v_id);
  reset role;
  raise notice 'T5 coord + nao-rascunho       | FALHOU: excluiu plano reservado';
exception when others then
  reset role;
  raise notice 'T5 coord + nao-rascunho       | PASSOU: bloqueado (%)', sqlstate;
end $$;

-- T6: coordenador, rascunho elegível + T7 trilha de auditoria com ator
do $$
declare v_id bigint; v_res jsonb; v_restante int; v_itens int; v_ator text;
begin
  select id into v_id from _t_planos where rotulo='limpo';
  set local role authenticated; perform _como('coordenador');
  select excluir_planejamento_rascunho(v_id) into v_res;
  reset role;
  select count(*) into v_restante from planejamento where id=v_id;
  select count(*) into v_itens from planejamento_itens where planejamento_id=v_id;
  select usuario into v_ator from auditoria
   where tabela='planejamento' and acao='delete' and registro_id=v_id::text
   order by id desc limit 1;
  raise notice 'T6 coord + rascunho elegivel  | % | retorno=%',
    case when v_restante=0 and v_itens=0 then 'PASSOU' else 'FALHOU' end, v_res;
  raise notice 'T7 trilha de auditoria        | % | ator registrado=%',
    case when v_ator is not null then 'PASSOU' else 'FALHOU' end, coalesce(v_ator,'(nulo)');
exception when others then
  reset role;
  raise notice 'T6/T7                         | FALHOU (%) %', sqlstate, left(sqlerrm,60);
end $$;

-- =====================================================================
-- C1 — demanda + grupos + associações em transação única
-- =====================================================================

-- C1-T1: criar como técnico
do $$
declare v_res jsonb; v_cod text;
begin
  select codigo into v_cod from analises limit 1;
  set local role authenticated; perform _como('tecnico');
  select salvar_demanda_com_grupos(null,
    jsonb_build_object('titulo','Demanda C1','modalidade','analises'),
    jsonb_build_array(
      jsonb_build_object('chave','grupo-1','identificacao','Ponto A','tipo_matriz','Água','quantidade_amostras',12),
      jsonb_build_object('chave','grupo-2','identificacao','Ponto B','tipo_matriz','Sedimento','quantidade_amostras',8)),
    jsonb_build_array(
      jsonb_build_object('codigo_analise',v_cod,'quantidade_amostras',12,'grupo_chave','grupo-1'),
      jsonb_build_object('codigo_analise',v_cod,'quantidade_amostras',8,'grupo_chave','grupo-2'))
  ) into v_res;
  reset role;
  insert into _t_demanda values ('d',(v_res->>'demanda_id')::bigint);
  raise notice 'C1-T1 criar (tecnico)         | % | %',
    case when (v_res->>'grupos')::int=2 and (v_res->>'analises')::int=2 then 'PASSOU' else 'FALHOU' end, v_res;
exception when others then
  reset role; raise notice 'C1-T1 criar (tecnico)         | FALHOU (%) %', sqlstate, left(sqlerrm,60);
end $$;

-- C1-T2: reabrir — grupos e associações persistiram
do $$
declare v_id bigint; v_grupos int; v_assoc int;
begin
  select id into v_id from _t_demanda where rotulo='d';
  select count(*) into v_grupos from demanda_grupos_amostras where demanda_id=v_id;
  select count(*) into v_assoc from demanda_analises where demanda_id=v_id and grupo_amostra_id is not null;
  raise notice 'C1-T2 reabrir                 | % | grupos=% associacoes=%',
    case when v_grupos=2 and v_assoc=2 then 'PASSOU' else 'FALHOU' end, v_grupos, v_assoc;
end $$;

-- C1-T3: editar preservando o id do grupo mantido
do $$
declare v_id bigint; v_g1 bigint; v_res jsonb; v_cod text; v_depois bigint;
begin
  select id into v_id from _t_demanda where rotulo='d';
  select codigo into v_cod from analises limit 1;
  select id into v_g1 from demanda_grupos_amostras where demanda_id=v_id and identificacao='Ponto A';
  set local role authenticated; perform _como('tecnico');
  select salvar_demanda_com_grupos(v_id,
    jsonb_build_object('titulo','Demanda C1 editada'),
    jsonb_build_array(jsonb_build_object('chave','g1','id',v_g1,'identificacao','Ponto A revisado','tipo_matriz','Água','quantidade_amostras',15)),
    jsonb_build_array(jsonb_build_object('codigo_analise',v_cod,'quantidade_amostras',15,'grupo_chave','g1'))
  ) into v_res;
  reset role;
  select id into v_depois from demanda_grupos_amostras where demanda_id=v_id;
  raise notice 'C1-T3 editar                  | % | id preservado: % -> %',
    case when v_depois = v_g1 then 'PASSOU' else 'FALHOU' end, v_g1, v_depois;
exception when others then
  reset role; raise notice 'C1-T3 editar                  | FALHOU (%) %', sqlstate, left(sqlerrm,60);
end $$;

-- C1-T4: falha na criação desfaz tudo
do $$
declare v_cod text; v_orfas int; v_orfaos int;
begin
  select codigo into v_cod from analises limit 1;
  begin
    set local role authenticated; perform _como('tecnico');
    perform salvar_demanda_com_grupos(null,
      jsonb_build_object('titulo','Demanda que deve sumir','modalidade','analises'),
      jsonb_build_array(jsonb_build_object('chave','g','identificacao','Ponto X','quantidade_amostras',5)),
      jsonb_build_array(jsonb_build_object('codigo_analise',v_cod,'quantidade_amostras',5,'grupo_chave','INEXISTENTE')));
    reset role;
  exception when others then reset role;
  end;
  select count(*) into v_orfas from demandas_propostas where titulo='Demanda que deve sumir';
  select count(*) into v_orfaos from demanda_grupos_amostras where identificacao='Ponto X';
  raise notice 'C1-T4 rollback criacao        | % | demanda orfa=% grupo orfao=%',
    case when v_orfas=0 and v_orfaos=0 then 'PASSOU' else 'FALHOU' end, v_orfas, v_orfaos;
end $$;

-- C1-T5: falha na edição preserva o estado anterior
do $$
declare v_id bigint; v_cod text; v_titulo text; v_nome text;
begin
  select id into v_id from _t_demanda where rotulo='d';
  select codigo into v_cod from analises limit 1;
  begin
    set local role authenticated; perform _como('tecnico');
    perform salvar_demanda_com_grupos(v_id,
      jsonb_build_object('titulo','NAO DEVE PERSISTIR'),
      jsonb_build_array(jsonb_build_object('chave','g','identificacao','Substituto','quantidade_amostras',99)),
      jsonb_build_array(jsonb_build_object('codigo_analise',v_cod,'quantidade_amostras',1,'grupo_chave','fantasma')));
    reset role;
  exception when others then reset role;
  end;
  select titulo into v_titulo from demandas_propostas where id=v_id;
  select identificacao into v_nome from demanda_grupos_amostras where demanda_id=v_id;
  raise notice 'C1-T5 rollback edicao         | % | titulo=% grupo=%',
    case when v_titulo='Demanda C1 editada' and v_nome='Ponto A revisado' then 'PASSOU' else 'FALHOU' end,
    v_titulo, v_nome;
end $$;

-- C1-T6: p_grupos NULL preserva; '[]' remove (regressão da tela de detalhe)
do $$
declare v_id bigint; v_antes int; v_depois int; v_zerado int;
begin
  select id into v_id from _t_demanda where rotulo='d';
  select count(*) into v_antes from demanda_grupos_amostras where demanda_id=v_id;

  set local role authenticated; perform _como('tecnico');
  -- salvar sem enviar grupos (tela de detalhe) NAO pode apagar
  perform salvar_demanda_com_grupos(v_id, jsonb_build_object('titulo','Salvo sem grupos'), null, null);
  reset role;
  select count(*) into v_depois from demanda_grupos_amostras where demanda_id=v_id;

  set local role authenticated; perform _como('tecnico');
  -- array vazio explicito remove
  perform salvar_demanda_com_grupos(v_id, jsonb_build_object('titulo','Salvo sem grupos'), '[]'::jsonb, null);
  reset role;
  select count(*) into v_zerado from demanda_grupos_amostras where demanda_id=v_id;

  raise notice 'C1-T6 NULL preserva / [] remove | % | antes=% apos-null=% apos-vazio=%',
    case when v_antes > 0 and v_depois = v_antes and v_zerado = 0 then 'PASSOU' else 'FALHOU' end,
    v_antes, v_depois, v_zerado;
end $$;

-- =====================================================================
-- P2 — negação silenciosa da RLS
-- =====================================================================
do $$
declare v_cod text; v_linhas int; v_erro text := '(nenhum)'; v_ret int;
begin
  select codigo into v_cod from analises limit 1;
  set local role authenticated; perform _como('tecnico');
  begin
    delete from analises where codigo = v_cod;
    get diagnostics v_linhas = row_count;
  exception when others then v_erro := sqlstate; v_linhas := -1;
  end;
  reset role;
  raise notice 'P2-T1 DELETE negado (tecnico) | % | erro=% linhas=%',
    case when v_erro='(nenhum)' and v_linhas=0 then 'PASSOU: negacao silenciosa confirmada' else 'FALHOU' end,
    v_erro, v_linhas;

  set local role authenticated; perform _como('coordenador');
  with alvo as (update analises set nome=nome where codigo=v_cod returning 1) select count(*) into v_ret from alvo;
  reset role;
  raise notice 'P2-T2 UPDATE coordenador      | % | RETURNING devolveu % linha(s)',
    case when v_ret>0 then 'PASSOU (contraprova)' else 'FALHOU' end, v_ret;
end $$;

-- limpeza dos auxiliares
drop function if exists _como(text);
drop table if exists _t_planos;
drop table if exists _t_demanda;
