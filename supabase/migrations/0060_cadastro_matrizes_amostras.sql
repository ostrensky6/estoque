-- Cadastro canonico de matrizes/tipos de amostra usados nas demandas de orcamento.
create table if not exists matrizes_amostras (
  id bigserial primary key,
  codigo text not null unique,
  nome text not null,
  descricao text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

insert into matrizes_amostras (codigo, nome, descricao, ativo)
values
  ('Hemolinfa', 'Hemolinfa', 'Amostra de hemolinfa.', true),
  ('Tecido', 'Tecido', 'Material de tecido animal ou vegetal.', true),
  ('Água', 'Água', 'Amostra líquida ambiental.', true),
  ('Sedimento', 'Sedimento', 'Sedimento ou material particulado.', true),
  ('DNA extraído', 'DNA extraído', 'DNA já extraído entregue para processamento.', true),
  ('RNA extraído', 'RNA extraído', 'RNA já extraído entregue para processamento.', true),
  ('Outro material biológico', 'Outro material biológico', 'Material biológico não enquadrado nas matrizes padrão.', true)
on conflict (codigo) do update
set
  nome = excluded.nome,
  descricao = excluded.descricao,
  ativo = excluded.ativo;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'demanda_grupos_amostras_tipo_matriz_fkey'
      and conrelid = 'demanda_grupos_amostras'::regclass
  ) then
    alter table demanda_grupos_amostras
      add constraint demanda_grupos_amostras_tipo_matriz_fkey
      foreign key (tipo_matriz)
      references matrizes_amostras(codigo)
      on update cascade
      on delete restrict
      not valid;
  end if;
end $$;

grant select on matrizes_amostras to anon, authenticated;
grant insert, update, delete on matrizes_amostras to authenticated;
grant all on matrizes_amostras to service_role;
grant usage, select on sequence matrizes_amostras_id_seq to anon, authenticated, service_role;

alter table matrizes_amostras enable row level security;

drop policy if exists rls_read_matrizes_amostras on matrizes_amostras;
create policy rls_read_matrizes_amostras on matrizes_amostras
  for select to authenticated using (true);

drop policy if exists rls_coordenador_insert_matrizes_amostras on matrizes_amostras;
create policy rls_coordenador_insert_matrizes_amostras on matrizes_amostras
  for insert to authenticated with check (papel_minimo('coordenador'));

drop policy if exists rls_coordenador_update_matrizes_amostras on matrizes_amostras;
create policy rls_coordenador_update_matrizes_amostras on matrizes_amostras
  for update to authenticated using (papel_minimo('coordenador')) with check (papel_minimo('coordenador'));

drop policy if exists rls_coordenador_delete_matrizes_amostras on matrizes_amostras;
create policy rls_coordenador_delete_matrizes_amostras on matrizes_amostras
  for delete to authenticated using (papel_minimo('coordenador'));
