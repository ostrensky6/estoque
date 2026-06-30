-- Relacao oficial entre analises laboratoriais e matrizes/tipos de amostra.
create table if not exists analises_matrizes_amostras (
  id bigserial primary key,
  codigo_analise text not null references analises(codigo) on update cascade on delete cascade,
  matriz_codigo text not null references matrizes_amostras(codigo) on update cascade on delete restrict,
  ativo boolean not null default true,
  observacao text,
  criado_em timestamptz not null default now(),
  unique (codigo_analise, matriz_codigo)
);

insert into analises_matrizes_amostras (codigo_analise, matriz_codigo, ativo)
select analises.codigo, matrizes_amostras.codigo, true
from analises
cross join matrizes_amostras
where analises.ativo is true
  and matrizes_amostras.ativo is true
on conflict (codigo_analise, matriz_codigo) do update
set ativo = excluded.ativo;

grant select on analises_matrizes_amostras to anon, authenticated;
grant insert, update, delete on analises_matrizes_amostras to authenticated;
grant all on analises_matrizes_amostras to service_role;
grant usage, select on sequence analises_matrizes_amostras_id_seq to anon, authenticated, service_role;

alter table analises_matrizes_amostras enable row level security;

drop policy if exists rls_read_analises_matrizes_amostras on analises_matrizes_amostras;
create policy rls_read_analises_matrizes_amostras on analises_matrizes_amostras
  for select to authenticated using (true);

drop policy if exists rls_coordenador_insert_analises_matrizes_amostras on analises_matrizes_amostras;
create policy rls_coordenador_insert_analises_matrizes_amostras on analises_matrizes_amostras
  for insert to authenticated with check (papel_minimo('coordenador'));

drop policy if exists rls_coordenador_update_analises_matrizes_amostras on analises_matrizes_amostras;
create policy rls_coordenador_update_analises_matrizes_amostras on analises_matrizes_amostras
  for update to authenticated using (papel_minimo('coordenador')) with check (papel_minimo('coordenador'));

drop policy if exists rls_coordenador_delete_analises_matrizes_amostras on analises_matrizes_amostras;
create policy rls_coordenador_delete_analises_matrizes_amostras on analises_matrizes_amostras
  for delete to authenticated using (papel_minimo('coordenador'));
