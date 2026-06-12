-- =====================================================================
-- Fornecedores: cadastro completo (identificação fiscal, contato, endereço).
-- =====================================================================
alter table fornecedores
  add column if not exists cnpj        text,
  add column if not exists endereco    text,
  add column if not exists telefone    text,
  add column if not exists email       text,
  add column if not exists site        text,
  add column if not exists observacoes text;

-- Trilha de auditoria (mesma fn_auditoria dos demais cadastros sensíveis).
drop trigger if exists aud_fornecedores on fornecedores;
create trigger aud_fornecedores after insert or update or delete on fornecedores
  for each row execute function fn_auditoria();

grant all on all tables in schema public to service_role;
