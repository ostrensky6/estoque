<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:project-budget-migration-rules -->
# Migração do app antigo de orçamento de projetos

Qualquer trabalho para importar, migrar, adaptar ou substituir funcionalidades do app antigo `orcamento-projetos` dentro do Kontrol deve seguir obrigatoriamente o protocolo em `docs/migracao-orcamento-projetos-protocolo.md`.

Regras de bloqueio:

- Não implementar a migração antes de entregar diagnóstico comparativo do app antigo e do Kontrol atual.
- Não tratar a migração como recriação visual de telas.
- Não descartar funcionalidades, cadastros, parâmetros, regras de cálculo ou dados do app antigo sem justificativa técnica documentada.
- Não criar estrutura paralela se uma estrutura compatível já existir no Kontrol.
- Não executar alterações destrutivas de banco sem backup lógico, relatório de impacto, plano de rollback e validação pós-migração.
- Não usar `DROP TABLE`, `TRUNCATE`, remoção de colunas com dados, remoção de RLS, remoção de triggers de auditoria ou sobrescrita de migrations antigas no contexto dessa migração.

O app antigo deve ser absorvido pelo Kontrol sem perda de histórico, regras de negócio, permissões, auditoria ou dados.
<!-- END:project-budget-migration-rules -->
