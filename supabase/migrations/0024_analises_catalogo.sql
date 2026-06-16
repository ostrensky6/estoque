-- 0024_analises_catalogo.sql
-- Catálogo simplificado das análises no módulo Análises.
--  1) Acrescenta colunas descritivas (nome_simplificado, status) à tabela `analises`.
--     O booleano `ativo` (usado no custeio) permanece intacto.
--  2) Popula nome_simplificado / descricao / status das análises vigentes.
--  3) Remove 3 análises descontinuadas (nunca executadas), preservando
--     histórico de orçamento/planejamento (exclusão guardada por FK).

-- ---------- 1) Colunas -------------------------------------------------
alter table analises add column if not exists nome_simplificado text;
alter table analises add column if not exists status            text;

comment on column analises.nome_simplificado is 'Nome amigável exibido no catálogo do módulo Análises';
comment on column analises.status is 'Situação descritiva da análise (texto livre): Ativo, Revisar, Nunca feito; pode ser oferecido, etc.';

-- ---------- 2) Dados das análises vigentes -----------------------------
update analises set nome_simplificado = 'Eletroforese hemolinfa', descricao = 'Gel para hemolinfa',                                                              status = 'Ainda é feito'                   where codigo = 'Eletrof_vir_hem';
update analises set nome_simplificado = 'Eletroforese tecido',    descricao = 'Gel para tecido',                                                                 status = 'Ainda é feito'                   where codigo = 'Eletrof_vir_tec';
update analises set nome_simplificado = '16S alta cobertura',     descricao = 'Sequenciamento focado em microbioma, com alta cobertura',                          status = 'Nunca feito; pode ser oferecido' where codigo = 'Illumina_16S_AC';
update analises set nome_simplificado = 'Shotgun',                descricao = 'Sequenciamento shotgun, com qualquer marcador',                                    status = 'Revisar'                         where codigo = 'Illumina_Sh';
update analises set nome_simplificado = 'Shotgun com qPCR',       descricao = 'Shotgun substituindo algumas etapas por qPCR para otimização de tempo e custo',     status = 'Ainda não testado'               where codigo = 'Illumina_Sh_qPCR';
update analises set nome_simplificado = 'qPCR com filtração',     descricao = 'PCR em tempo real com filtração',                                                  status = 'Ativo'                           where codigo = 'qPCR_F';
update analises set nome_simplificado = 'qPCR sem filtração',     descricao = 'PCR em tempo real sem filtração',                                                  status = 'Ativo'                           where codigo = 'qPCR_SF';
update analises set nome_simplificado = 'RT-qPCR vírus hemolinfa', descricao = 'PCR em tempo real de vírus 1',                                                    status = 'Ativo'                           where codigo = 'RTqPCR_RNA_virus_H';
update analises set nome_simplificado = 'RT-qPCR vírus tecidos',  descricao = 'PCR em tempo real de vírus 2',                                                      status = 'Ativo'                           where codigo = 'RTqPCR_RNA_virus_T';
update analises set nome_simplificado = 'Sanger',                 descricao = 'Sequenciamento Sanger',                                                            status = 'Ainda pode ser oferecido'        where codigo = 'Sanger';

-- ---------- 3) Exclusão guardada das análises descontinuadas -----------
-- Códigos: Illumina_16S_BC, Illumina_DNA_P_AC, Illumina_DNA_P_BC.
-- Só remove se NÃO houver histórico em orçamentos/planejamento; nesse caso
-- limpa apenas os dados de receita (etapas/equipamentos/materiais).
do $$
declare
  cod text;
  refs int;
begin
  foreach cod in array array['Illumina_16S_BC','Illumina_DNA_P_AC','Illumina_DNA_P_BC'] loop
    if not exists (select 1 from analises where codigo = cod) then
      continue;
    end if;

    select
      (select count(*) from orcamento_itens            where codigo_analise = cod)
    + (select count(*) from orcamento_projeto_analises where codigo_analise = cod)
    + (select count(*) from planejamento_itens         where codigo_analise = cod)
    into refs;

    if refs > 0 then
      raise warning 'Análise % mantida: possui % referência(s) em orçamento/planejamento (histórico preservado).', cod, refs;
      continue;
    end if;

    -- dependentes de receita (catálogo) — sem histórico
    delete from insumo_analise      where codigo_analise = cod;
    delete from equipamento_analise where codigo_analise = cod;
    delete from etapas              where codigo_analise = cod;
    delete from analises            where codigo = cod;
    raise notice 'Análise % removida.', cod;
  end loop;
end $$;
