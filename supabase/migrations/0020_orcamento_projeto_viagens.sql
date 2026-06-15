-- =====================================================================
-- Viagens e diárias (rubrica VD): parâmetros de viagem por orçamento de
-- projeto, usados para calcular automaticamente as quantidades das linhas VD
-- (diárias, hospedagem, combustível, pedágios, passagens, locação de veículo).
-- =====================================================================

alter table orcamento_projetos
  add column if not exists travel_inputs jsonb not null default '{}'::jsonb;
