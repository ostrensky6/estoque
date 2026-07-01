-- Atualiza a oferta comercial do catalogo de analises sem apagar historico.
-- O campo analises.ativo e o marcador ja usado pelo app para listas ofereciveis.

update analises
set
  nome = case codigo
    when 'Eletrof_vir_hem' then 'Eletroforese hemolinfa'
    when 'Eletrof_vir_tec' then 'Eletroforese tecido'
    when 'Illumina_16S_AC' then '16S alta cobertura'
    when 'Illumina_Sh' then 'Shotgun'
    when 'RTqPCR_RNA_virus_H' then 'RT-qPCR virus hemolinfa'
    when 'RTqPCR_RNA_virus_T' then 'RT-qPCR virus tecidos'
    when 'Sanger' then 'Sanger'
    when 'qPCR_F' then 'qPCR com filtracao'
    when 'qPCR_SF' then 'qPCR sem filtracao'
    else nome
  end,
  nome_simplificado = case codigo
    when 'Eletrof_vir_hem' then 'Eletroforese hemolinfa'
    when 'Eletrof_vir_tec' then 'Eletroforese tecido'
    when 'Illumina_16S_AC' then '16S alta cobertura'
    when 'Illumina_Sh' then 'Shotgun'
    when 'RTqPCR_RNA_virus_H' then 'RT-qPCR virus hemolinfa'
    when 'RTqPCR_RNA_virus_T' then 'RT-qPCR virus tecidos'
    when 'Sanger' then 'Sanger'
    when 'qPCR_F' then 'qPCR com filtracao'
    when 'qPCR_SF' then 'qPCR sem filtracao'
    else nome_simplificado
  end,
  descricao = case codigo
    when 'Eletrof_vir_hem' then 'Gel para hemolinfa'
    when 'Eletrof_vir_tec' then 'Gel para tecido'
    when 'Illumina_16S_AC' then 'Sequenciamento focado em microbioma, com alta cobertura'
    when 'Illumina_Sh' then 'Sequenciamento shotgun, com qualquer marcador'
    when 'RTqPCR_RNA_virus_H' then 'PCR em tempo real de virus 1'
    when 'RTqPCR_RNA_virus_T' then 'PCR em tempo real de virus 2'
    when 'Sanger' then 'Sequenciamento Sanger'
    when 'qPCR_F' then 'PCR em tempo real com filtracao'
    when 'qPCR_SF' then 'PCR em tempo real sem filtracao'
    else descricao
  end,
  status = case codigo
    when 'Eletrof_vir_hem' then 'Ativo - ainda e feito'
    when 'Eletrof_vir_tec' then 'Ativo - ainda e feito'
    when 'Illumina_16S_AC' then 'Ativo - oferecivel; manter alta cobertura'
    when 'Illumina_Sh' then 'Ativo - TODO tecnico: revisar quantificacao de insumos'
    when 'RTqPCR_RNA_virus_H' then 'Ativo - ainda e feito'
    when 'RTqPCR_RNA_virus_T' then 'Ativo - ainda e feito'
    when 'Sanger' then 'Ativo - ainda pode ser oferecido'
    when 'qPCR_F' then 'Ativo - ainda e feito'
    when 'qPCR_SF' then 'Ativo - ainda e feito'
    else status
  end,
  ativo = true
where codigo in (
  'Eletrof_vir_hem',
  'Eletrof_vir_tec',
  'Illumina_16S_AC',
  'Illumina_Sh',
  'RTqPCR_RNA_virus_H',
  'RTqPCR_RNA_virus_T',
  'Sanger',
  'qPCR_F',
  'qPCR_SF'
);

update analises
set
  status = case codigo
    when 'Illumina_16S_BC' then 'Inativo - nao oferecer: baixa cobertura nao vale a pena'
    when 'Illumina_DNA_P_AC' then 'Inativo - nao oferecer'
    when 'Illumina_DNA_P_BC' then 'Inativo - nao oferecer'
    when 'Illumina_Sh_qPCR' then 'Experimental - em avaliacao; nao oferecer em orcamentos'
    else status
  end,
  ativo = false
where codigo in (
  'Illumina_16S_BC',
  'Illumina_DNA_P_AC',
  'Illumina_DNA_P_BC',
  'Illumina_Sh_qPCR'
);
