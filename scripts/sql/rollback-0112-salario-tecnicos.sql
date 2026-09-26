-- Recuperacao da 0112, ensaiada somente em clone descartavel.
-- Em producao, copiar para a PROXIMA migration livre, revisar e aplicar pelo
-- fluxo normal. Nunca executar SQL avulso, apagar o ledger 0112, reaplicar
-- migrations antigas ou restaurar backup sobre dados vivos.
-- ATENCAO: reabre a leitura direta de tecnicos.valor_mes e do preco PE do
-- catalogo para qualquer usuario autenticado (estado anterior a 0112).
-- Nao altera linhas de tecnicos, catalogo, perfis, permissoes_categorias ou
-- auditoria (a chave tecnicos.salario.ver e as linhas gravadas permanecem).
-- O app precisa voltar para a versao anterior junto, pois chama as RPCs abaixo.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
begin
  if to_regprocedure('kontrol_private.pode_ver_salario()') is null
    or to_regprocedure('public.tecnicos_remuneracao()') is null then
    raise exception 'Rollback 0112: migration ausente';
  end if;
end $$;

drop policy auditoria_salario_restrito on public.auditoria;
drop trigger aud_tecnicos on public.tecnicos;
drop trigger trg_tecnicos_proteger_salario on public.tecnicos;
drop trigger trg_catalogo_proteger_preco_pe on public.orcamento_projeto_catalogo;

-- Estado anterior: SELECT de tabela para anon/authenticated (0002).
grant select on public.tecnicos to anon, authenticated;
grant select on public.orcamento_projeto_catalogo to anon, authenticated;

-- RESTRICT aborta e reverte toda a transacao se houver dependencia nao prevista.
drop function public.orcamento_projeto_catalogo_listar() restrict;
drop function public.valor_hora_pessoal_total() restrict;
drop function public.tecnicos_remuneracao() restrict;
drop function public.tem_permissao(text) restrict;
drop function kontrol_private.fn_auditoria_tecnicos() restrict;
drop function kontrol_private.fn_catalogo_proteger_preco_pe() restrict;
drop function kontrol_private.fn_tecnicos_proteger_salario() restrict;
drop function kontrol_private.pode_ver_salario() restrict;
drop function kontrol_private.tem_permissao_efetiva(text) restrict;
commit;
