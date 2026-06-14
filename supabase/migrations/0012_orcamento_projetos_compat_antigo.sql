-- =====================================================================
-- Compatibilidade com o app antigo de orcamento de projetos.
-- Migration aditiva: nao remove tabelas, colunas, RLS ou triggers.
-- =====================================================================

create table orcamento_projeto_catalogo (
  id              text primary key,
  rubrica         text not null
                  check (rubrica in ('PE','MC','MP','ST','VD','OU')),
  descricao       text not null,
  unidade         text,
  preco_unitario  numeric not null default 0,
  categoria       text,
  ativo           boolean not null default true,
  valid_from      timestamptz,
  origem          text not null default 'kontrol'
                  check (origem in ('kontrol','orcamento_projetos_antigo')),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);
create index on orcamento_projeto_catalogo (rubrica);
create index on orcamento_projeto_catalogo (ativo);

create table orcamento_projeto_templates (
  id          bigint generated always as identity primary key,
  nome        text not null,
  descricao   text,
  itens       jsonb not null default '[]'::jsonb,
  parametros  jsonb not null default '{}'::jsonb,
  origem      text not null default 'kontrol'
              check (origem in ('kontrol','orcamento_projetos_antigo')),
  criado_em   timestamptz not null default now()
);

alter table orcamento_projetos
  add column numero text,
  add column cliente_email text,
  add column cliente_telefone text,
  add column cliente_endereco text,
  add column cliente_detalhes text,
  add column coordenador text,
  add column proprietario text,
  add column project_months integer not null default 12,
  add column impostos_legacy numeric not null default 0,
  add column incubacao numeric not null default 0,
  add column reserva numeric not null default 0,
  add column investimentos numeric not null default 0,
  add column lucro numeric not null default 0;

alter table orcamento_projeto_custos
  add column rubrica text
    check (rubrica in ('PE','MC','MP','ST','VD','OU')),
  add column catalogo_item_id text references orcamento_projeto_catalogo(id) on delete set null,
  add column meses_selecionados integer[] not null default '{}',
  add column origem text not null default 'manual'
    check (origem in ('manual','catalogo','template','orcamento_projetos_antigo'));

update orcamento_projeto_custos
   set rubrica = case categoria
     when 'mao_obra' then 'PE'
     when 'materiais' then 'MC'
     when 'equipamentos' then 'MP'
     when 'terceiros' then 'ST'
     when 'deslocamento' then 'VD'
     else 'OU'
   end
 where rubrica is null;

alter table orcamento_projeto_catalogo enable row level security;
alter table orcamento_projeto_templates enable row level security;

create policy authenticated_all_orcamento_projeto_catalogo on orcamento_projeto_catalogo
  for all to authenticated using (true) with check (true);
create policy authenticated_all_orcamento_projeto_templates on orcamento_projeto_templates
  for all to authenticated using (true) with check (true);

grant all on all tables in schema public to service_role;

create trigger aud_orcamento_projeto_catalogo after insert or update or delete on orcamento_projeto_catalogo
  for each row execute function fn_auditoria();
create trigger aud_orcamento_projeto_templates after insert or update or delete on orcamento_projeto_templates
  for each row execute function fn_auditoria();


-- Seed do catalogo importado do app antigo de orcamento de projetos.
insert into orcamento_projeto_catalogo
  (id, rubrica, descricao, unidade, preco_unitario, categoria, ativo, valid_from, origem)
values
  ('MC-12', 'MC', 'Alcool', 'L', 380, 'Geral (coleta)', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MC-36', 'MC', 'Álcool etílico', 'litro', 130, 'Químicos e reagentes', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MC-32', 'MC', 'Balde', 'un', 50, 'Material plástico', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MC-13', 'MC', 'Caixa de armazenamento', 'un', 40, 'Geral (coleta)', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MC-14', 'MC', 'Caixa térmica', 'un', 150, 'Geral (coleta)', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MC-30', 'MC', 'Caixa térmica', 'un', 80, 'Material descartável', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MC-19', 'MC', 'Caneta permanente', 'un', 17, 'Geral (coleta)', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MC-1', 'MC', 'Combustível para gerador', 'L', 6, 'Combustível', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MC-2', 'MC', 'Descartáveis (luva, seringas, microtubos, ponteiras, máscaras, papel toalha, filtros, placas, etc)', 'conj', 12000, 'Descartáveis', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MC-4', 'MC', 'Desinfecção', 'un', 5000, 'Geral', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MC-3', 'MC', 'EPI', 'un', 4000, 'EPI', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MC-35', 'MC', 'Formol', 'litro', 20, 'Químicos e reagentes', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MC-17', 'MC', 'Frasco de spray', 'un', 10, 'Geral (coleta)', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MC-8', 'MC', 'Frascos de coleta (500 ml)', 'pct c/ 100', 1.9, 'Geral (coleta)', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MC-21', 'MC', 'Galão 5L', 'un', 15, 'Geral (coleta)', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MC-42', 'MC', 'Hi-Di™ Formamide for 3500 Dx/3500xl Dx Genetic Analyzers (CE-IVD)', 'un', 250, 'Químicos e reagentes (Sanger)', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MC-20', 'MC', 'Hipoclorito', 'galão 5 l', 20, 'Geral (coleta)', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MC-5', 'MC', 'Insumos de bioinformática', 'un', 25000, 'Geral', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MC-24', 'MC', 'Iscas para moscas', 'un', 300, 'Iscas para moscas', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MC-34', 'MC', 'Kits Bioanalyzer', 'un', 17, 'Químicos e reagentes', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MC-38', 'MC', 'Kits DNA', 'un', 6000, 'Químicos e reagentes (Bioanalyzer)', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MC-9', 'MC', 'Luva', 'cx', 40, 'Geral (coleta)', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MC-25', 'MC', 'Material de escritório', 'conj', 3000, 'Material de escritório', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MC-26', 'MC', 'Material de informática', 'Vários', 1000, 'Material de informática', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MC-27', 'MC', 'Material de limpeza', 'Vários', 3500, 'Material de limpeza', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MC-31', 'MC', 'Material para manutenção de animais', 'conj', 4000, 'Material para manutenção de animais', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MC-10', 'MC', 'Membrana', 'cx c/ 100', 300, 'Geral (coleta)', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MC-16', 'MC', 'Microtubos', 'pct c/ 500', 120, 'Geral (coleta)', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MC-28', 'MC', 'Microtubos', 'un', 120, 'Material descartável', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MC-6', 'MC', 'Papel toalha', 'fardo', 50, 'Geral', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MC-33', 'MC', 'Peixes para experimentos', 'unid', 1.8, 'Peixes', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MC-41', 'MC', 'PHIX', 'un', 3000, 'Químicos e reagentes (Sanger)', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MC-23', 'MC', 'Pinças', 'un', 40, 'Instrumental', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MC-11', 'MC', 'Pinças', 'un', 30, 'Geral (coleta)', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MC-7', 'MC', 'Pipeta de pasteur', 'pct 500', 200, 'Geral (coleta)', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MC-43', 'MC', 'Placa de sequenciamento', 'cx', 620, 'Químicos e reagentes (Sanger)', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MC-40', 'MC', 'POP 7', 'un', 1750, 'Químicos e reagentes (Sanger)', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MC-15', 'MC', 'Rack para microtubo', 'un', 30, 'Geral (coleta)', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MC-29', 'MC', 'Rack para microtubo', 'un', 40, 'Material descartável', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MC-39', 'MC', 'Reagentes', 'un', 150000, 'Químicos e reagentes (Geral)', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MC-37', 'MC', 'Reagentes e químicos - Outros', 'conj', 100000, 'Químicos e reagentes', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MC-46', 'MC', 'Redes de espera', 'un', 60, 'Redes', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MC-18', 'MC', 'Sacos plásticos', 'pct c/ 100', 150, 'Geral (coleta)', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MC-44', 'MC', 'Sequenciamento experimentos', 'un', 89000, 'Químicos e reagentes (Sequenciamento)', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MC-45', 'MC', 'Sequenciamento monitoramento', 'un', 545000, 'Químicos e reagentes (Sequenciamento)', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MC-47', 'MC', 'Tarrafa', 'un', 600, 'Redes', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MC-22', 'MC', 'Tesouras', 'un', 10, 'Instrumental', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MC-48', 'MC', 'Vidrarias', 'conj', 5000, 'Vidrarias', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MP-1', 'MP', 'Armadilhas para moscas', 'un', 150, 'Armadilhas', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MP-9', 'MP', 'Bomba a vácuo/carregador/bateria', 'un', 7500, 'Equipamento de campo', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MP-17', 'MP', 'Câmera Gopro', 'un', 3500, 'Midia', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MP-12', 'MP', 'Computador desktop', 'un', 9000, 'Informática', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MP-7', 'MP', 'Condutivímetro', 'un', 800, 'Equipamento de campo', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MP-18', 'MP', 'Dji Osmo Pocket', 'un', 2200, 'Midia', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MP-4', 'MP', 'EPI', 'un', 3000, 'EPI', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MP-16', 'MP', 'Estruturas para manutenção dos animais no laboratório', 'un', 6000, 'Manutenção dos animais', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MP-14', 'MP', 'Impressora', 'un', 1500, 'Informática', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MP-3', 'MP', 'Impressora de etiquetas', 'un', 1500, 'Dados', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MP-2', 'MP', 'Leitor de qr code', 'un', 500, 'Dados', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MP-11', 'MP', 'Mesa dobrável', 'un', 500, 'Equipamento de campo', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MP-15', 'MP', 'Monitor de 24 pol', 'un', 1500, 'Informática', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MP-6', 'MP', 'Oximetro', 'un', 8000, 'Equipamento de campo', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MP-5', 'MP', 'pHmetro de campo', 'un', 800, 'Equipamento de campo', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MP-10', 'MP', 'Sistema de filtração', 'un', 2690, 'Equipamento de campo', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MP-13', 'MP', 'SSD', 'un', 1250, 'Informática', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('MP-8', 'MP', 'Turbidímetro', 'un', 2500, 'Equipamento de campo', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('PE-1', 'PE', 'Aline Horodesky - Coordenador - Campo', 'mês', 5940, 'Doutora', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('PE-2', 'PE', 'Ana Helena Rohling - Auxiliar administrativo', 'mês', 13380, 'Técnica', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('PE-3', 'PE', 'Antonio Ostrensky - Coordenador – Laboratório de Genética', 'mês', 16800, 'Doutor', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('PE-6', 'PE', 'Giorgi Dal Pont - Pesquisador – Laboratório de Genética', 'mês', 5000, 'Doutor', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('PE-4', 'PE', 'Marcio Roberto Pie - Coordenador de genética ambiental', 'mês', 5200, 'Doutor', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('PE-7', 'PE', 'Nathieli Cozer - Pesquisador – Laboratório de Genética', 'mês', 5000, 'Doutora', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('PE-5', 'PE', 'Otto Samuel Mader Neto - Coordenador Geral', 'mês', 5200, 'Mestre', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('PE-8', 'PE', 'Paula Stika - Pesquisadora – Laboratório de Genética', 'mês', 3100, 'Superior', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('PE-10', 'PE', 'Sandra Ludwig - Pesquisador – Laboratório de Genética', 'mês', 16800, 'Doutor', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('PE-9', 'PE', 'Vilmar Biernaski - Campo', 'mês', 5000, 'Mestre', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('ST-1', 'ST', 'Assistente administrativo', 'Mensalidade', 2500, 'Assistente administrativo', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('ST-2', 'ST', 'Certificação', 'anual', 3500, 'Certificação', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('ST-3', 'ST', 'Contador', 'Mensalidade', 700, 'Assistência contábil', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('ST-5', 'ST', 'Envio de amostras', 'conj', 400, 'Envio de amostras', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('ST-17', 'ST', 'Envio de material', 'un', 2200, 'Transporte', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('ST-16', 'ST', 'Identificação sistemática+', 'un', 5000, 'Vinícius Abilhoa', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('ST-4', 'ST', 'Instalação de sistema UV', 'un', 12000, 'Serviços de eletricista', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('ST-18', 'ST', 'Locação de embarcação', 'un', 500, 'Coleta', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('ST-6', 'ST', 'Manutenção de veículo', 'anual', 3800, 'Manutenção de veículo', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('ST-7', 'ST', 'Manutenção site', 'anual', 3500, 'Manutenção site', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('ST-10', 'ST', 'Seguro', 'Seguro de vida', 80, 'Seguro', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('ST-8', 'ST', 'Seguro do laboratório', 'Anuidade', 6000, 'Seguro', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('ST-9', 'ST', 'Seguro Duster', 'Anuidade', 3000, 'Seguro', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('ST-12', 'ST', 'Sequenciamento Illumina experimentos', 'conj', 250, 'Sequenciamento de DNA', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('ST-11', 'ST', 'Sequenciamento Illumina monitoramento', 'conj', 500, 'Sequenciamento de DNA', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('ST-13', 'ST', 'Taxa de inscrição em eventos científicos', 'un', 1500, 'Taxa de inscrição em eventos científicos', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('ST-14', 'ST', 'Taxa fixa Inovação/UFPR', 'Mensalidade', 450, 'Taxas', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('ST-15', 'ST', 'Troca de filtros sistema de filtragem de água ultrapura', 'conj', 7000, 'Troca de filtros sistema de filtragem de água ultrapura', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('VD-1', 'VD', 'Alimentação', 'refeições', 130, 'Alimentação', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('VD-5', 'VD', 'Aluguel de veículo + taxa de limpeza + seguro', 'diárias', 390, 'Deslocamento', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('VD-3', 'VD', 'Combustível', 'L', 7.2, 'Deslocamento', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('VD-2', 'VD', 'Hospedagem', 'diárias de hotel', 250, 'Hospedagem', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('VD-6', 'VD', 'Pedágio', 'un', 25, 'Deslocamento', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo'),
  ('VD-4', 'VD', 'Seguro viagem', 'diárias', 15, 'Outros', true, '2026-06-13T12:22:16.869369-03:00', 'orcamento_projetos_antigo')
on conflict (id) do update set
  rubrica = excluded.rubrica,
  descricao = excluded.descricao,
  unidade = excluded.unidade,
  preco_unitario = excluded.preco_unitario,
  categoria = excluded.categoria,
  ativo = excluded.ativo,
  valid_from = excluded.valid_from,
  origem = excluded.origem,
  atualizado_em = now();
