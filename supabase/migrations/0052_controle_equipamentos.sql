-- 1. Unidades físicas de equipamentos (Nível 2)
create table if not exists equipamento_unidades (
  id bigint generated always as identity primary key,
  equipamento_id bigint references equipamentos(id) on delete cascade not null,
  codigo_patrimonio text unique,
  numero_serie text,
  fabricante text,
  modelo text,
  local_id bigint references locais(id) on delete set null,
  status_operacional varchar(30) not null default 'operacional'
    check (status_operacional in ('operacional', 'em_manutencao', 'calibracao_pendente', 'calibracao_vencida', 'reservado', 'inativo', 'descartado')),
  data_aquisicao date,
  custo_aquisicao numeric(12, 2),
  vida_util_anos numeric(5, 2),
  data_prevista_substituicao date,
  ativo boolean not null default true,
  observacoes text,
  criado_em timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table equipamento_unidades enable row level security;
drop policy if exists authenticated_all_equipamento_unidades on equipamento_unidades;
create policy authenticated_all_equipamento_unidades on equipamento_unidades
  for all to authenticated using (true) with check (true);

grant all on equipamento_unidades to authenticated, service_role;
grant usage, select on sequence equipamento_unidades_id_seq to authenticated, service_role;

-- 2. Planos periódicos de manutenção e calibração
create table if not exists equipamento_planos_manutencao (
  id bigint generated always as identity primary key,
  equipamento_id bigint references equipamentos(id) on delete cascade,
  equipamento_unidade_id bigint references equipamento_unidades(id) on delete cascade,
  tipo varchar(30) not null check (tipo in ('preventiva', 'calibracao', 'qualificacao', 'verificacao', 'limpeza_tecnica')),
  periodicidade_dias integer not null check (periodicidade_dias > 0),
  tolerancia_dias integer default 0 not null,
  obrigatorio boolean not null default true,
  descricao text,
  ativo boolean not null default true,
  criado_em timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint check_plano_nivel check (
    (equipamento_id is not null and equipamento_unidade_id is null) or
    (equipamento_id is null and equipamento_unidade_id is not null)
  )
);

alter table equipamento_planos_manutencao enable row level security;
drop policy if exists authenticated_all_planos_manutencao on equipamento_planos_manutencao;
create policy authenticated_all_planos_manutencao on equipamento_planos_manutencao
  for all to authenticated using (true) with check (true);

grant all on equipamento_planos_manutencao to authenticated, service_role;
grant usage, select on sequence equipamento_planos_manutencao_id_seq to authenticated, service_role;

-- 3. Ocorrências de manutenção/calibração por unidade física
create table if not exists equipamento_manutencoes (
  id bigint generated always as identity primary key,
  equipamento_unidade_id bigint references equipamento_unidades(id) on delete cascade not null,
  tipo varchar(30) not null check (tipo in ('preventiva', 'corretiva', 'calibracao', 'qualificacao', 'verificacao', 'limpeza_tecnica')),
  data_programada date not null,
  data_inicio date,
  data_conclusao date,
  proxima_data date,
  custo numeric(12, 2) default 0 not null,
  fornecedor_id bigint references fornecedores(id) on delete set null,
  tecnico_responsavel varchar(100),
  descricao text,
  resultado text,
  documento_laudo_url varchar(255),
  status varchar(20) default 'agendada' not null check (status in ('agendada', 'em_execucao', 'concluida', 'cancelada', 'vencida')),
  bloqueia_operacao boolean not null default false,
  ordem_servico text,
  numero_documento text,
  created_by uuid references auth.users(id) on delete set null,
  criado_em timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table equipamento_manutencoes enable row level security;
drop policy if exists authenticated_all_manutencoes on equipamento_manutencoes;
create policy authenticated_all_manutencoes on equipamento_manutencoes
  for all to authenticated using (true) with check (true);

grant all on equipamento_manutencoes to authenticated, service_role;
grant usage, select on sequence equipamento_manutencoes_id_seq to authenticated, service_role;

-- 4. Log de transição de status para auditoria operacional
create table if not exists equipamento_status_log (
  id bigint generated always as identity primary key,
  equipamento_unidade_id bigint references equipamento_unidades(id) on delete cascade not null,
  status_anterior varchar(30),
  status_novo varchar(30) not null,
  motivo varchar(255),
  usuario_id uuid references auth.users(id) on delete set null,
  criado_em timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table equipamento_status_log enable row level security;
drop policy if exists authenticated_all_status_log on equipamento_status_log;
create policy authenticated_all_status_log on equipamento_status_log
  for all to authenticated using (true) with check (true);

grant all on equipamento_status_log to authenticated, service_role;
grant usage, select on sequence equipamento_status_log_id_seq to authenticated, service_role;

-- 5. Trigger para geração de logs automáticos de alteração de status
create or replace function fn_log_equipamento_status_change()
returns trigger as $$
begin
  if (TG_OP = 'INSERT') or (OLD.status_operacional IS DISTINCT FROM NEW.status_operacional) then
    insert into equipamento_status_log (
      equipamento_unidade_id,
      status_anterior,
      status_novo,
      motivo,
      usuario_id
    ) values (
      NEW.id,
      case when TG_OP = 'UPDATE' then OLD.status_operacional else null end,
      NEW.status_operacional,
      'Alteração de status operacional',
      auth.uid()
    );
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

create trigger trg_log_equipamento_status_change
  after insert or update of status_operacional
  on equipamento_unidades
  for each row
  execute function fn_log_equipamento_status_change();
