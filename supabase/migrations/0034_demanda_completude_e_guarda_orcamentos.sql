-- =====================================================================
-- Demandas: criterios minimos e guarda contra orcamentos sem demanda.
--
-- Migration aditiva e nao destrutiva. Campos novos sao opcionais para
-- preservar historico; a regra de obrigatoriedade entra no fluxo da aplicacao.
-- Os triggers bloqueiam somente novas insercoes sem demanda_id.
-- Rollback seguro: remover triggers/funcoes e colunas novas apos exportar
-- eventuais snapshots, se necessario.
-- =====================================================================

alter table demandas_propostas
  add column if not exists matriz_amostra text,
  add column if not exists quantidade_amostras_estimada integer
    check (quantidade_amostras_estimada is null or quantidade_amostras_estimada > 0),
  add column if not exists prazo_tecnico_dias integer
    check (prazo_tecnico_dias is null or prazo_tecnico_dias > 0),
  add column if not exists completude_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists completude_atualizada_em timestamptz;

create or replace function fn_orcamentos_exigem_demanda()
returns trigger
language plpgsql
as $$
begin
  if new.demanda_id is null then
    raise exception 'Novos orcamentos devem estar vinculados a uma demanda/proposta.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_orcamentos_exigem_demanda on orcamentos;
create trigger trg_orcamentos_exigem_demanda
  before insert on orcamentos
  for each row execute function fn_orcamentos_exigem_demanda();

drop trigger if exists trg_orcamento_projetos_exigem_demanda on orcamento_projetos;
create trigger trg_orcamento_projetos_exigem_demanda
  before insert on orcamento_projetos
  for each row execute function fn_orcamentos_exigem_demanda();
