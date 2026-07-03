-- Garante que o formulario de demandas sempre ofereca o catalogo-base de analises.
-- Migration nao destrutiva: insere ausentes e atualiza metadados das existentes.
insert into analises (codigo, nome, nome_simplificado, descricao, status, ativo)
values
  ('Eletrof_vir_hem', 'Eletroforese hemolinfa', 'Eletroforese hemolinfa', 'Gel para hemolinfa', 'Ainda é feito', true),
  ('Eletrof_vir_tec', 'Eletroforese tecido', 'Eletroforese tecido', 'Gel para tecido', 'Ainda é feito', true),
  ('Illumina_16S_AC', '16S alta cobertura', '16S alta cobertura', 'Sequenciamento focado em microbioma, com alta cobertura', 'Nunca feito; pode ser oferecido', true),
  ('Illumina_16S_BC', 'Illumina_16S_BC', 'Illumina_16S_BC', 'Sequenciamento focado em microbioma, com baixa cobertura', 'Nunca feito; revisar oferta', true),
  ('Illumina_DNA_P_AC', 'Illumina_DNA_P_AC', 'Illumina_DNA_P_AC', 'Sequenciamento de DNA de parasito com alta cobertura', 'Nunca feito; revisar oferta', true),
  ('Illumina_DNA_P_BC', 'Illumina_DNA_P_BC', 'Illumina_DNA_P_BC', 'Sequenciamento de DNA de parasito com baixa cobertura', 'Nunca feito; revisar oferta', true),
  ('Illumina_Sh', 'Shotgun', 'Shotgun', 'Sequenciamento shotgun, com qualquer marcador', 'Revisar', true),
  ('Illumina_Sh_qPCR', 'Shotgun com qPCR', 'Shotgun com qPCR', 'Shotgun substituindo algumas etapas por qPCR para otimizacao de tempo e custo', 'Ainda não testado', true),
  ('RTqPCR_RNA_virus_H', 'RT-qPCR vírus hemolinfa', 'RT-qPCR vírus hemolinfa', 'PCR em tempo real de vírus 1', 'Ativo', true),
  ('RTqPCR_RNA_virus_T', 'RT-qPCR vírus tecidos', 'RT-qPCR vírus tecidos', 'PCR em tempo real de vírus 2', 'Ativo', true),
  ('Sanger', 'Sanger', 'Sanger', 'Sequenciamento Sanger', 'Ainda pode ser oferecido', true),
  ('qPCR_F', 'qPCR com filtração', 'qPCR com filtração', 'PCR em tempo real com filtração', 'Ativo', true),
  ('qPCR_SF', 'qPCR sem filtração', 'qPCR sem filtração', 'PCR em tempo real sem filtração', 'Ativo', true)
on conflict (codigo) do update
set
  nome = excluded.nome,
  nome_simplificado = excluded.nome_simplificado,
  descricao = excluded.descricao,
  status = excluded.status,
  ativo = true;
