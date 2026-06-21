# Relatorio de impacto - migration 0040

Data: 2026-06-21

## Migration

- Arquivo: `supabase/migrations/0040_orcamento_parametros_aplicados.sql`
- Objetivo: criar a tabela `public.orcamento_parametros_aplicados` para persistir snapshots dos parametros economicos aplicados na emissao do orcamento final.

## Backups logicos gerados antes da aplicacao

- Schema remoto: `output/supabase-remote-schema-backup-20260621-110355.sql`
- Dados publicos remotos: `output/supabase-remote-public-data-backup-20260621-110417.sql`

Observacao: o dump de dados emitiu avisos de chaves estrangeiras circulares em `locais` e `orcamento_final_versoes`; para restauracao completa de dados, usar restore controlado com triggers/constraints tratadas conforme orientacao do `pg_dump`.

## Impacto esperado

- Mudanca aditiva: cria uma nova tabela, indices, RLS, grant para `service_role` e trigger de auditoria.
- Nao remove tabelas, colunas, politicas RLS existentes ou triggers de auditoria existentes.
- Nao altera dados historicos de orcamentos, demandas, projetos, estoque, compras ou planejamento.
- A tabela nova referencia `demandas_propostas`, `orcamentos`, `orcamento_projetos`, `orcamento_final_versoes` e `auth.users` com `on delete set null` onde aplicavel.
- A trigger `aud_orcamento_parametros_aplicados` depende da funcao existente `fn_auditoria()`.

## Validacao pre-migration

- `scripts/verify-production-target.ps1 -AllowNonMain` confirmou:
  - Supabase linkado no projeto `hhxwdcwphitfxywbgtju`.
  - migrations sem versoes duplicadas.
  - Vercel local linkado no projeto esperado.
- `supabase migration list --linked` mostrou producao alinhada de `0001` a `0039` e `0040` pendente.

## Plano de rollback

Como a migration e aditiva, o rollback preferencial e funcional:

1. Pausar qualquer release que grave em `orcamento_parametros_aplicados`.
2. Exportar os dados da tabela nova, se ja houver registros:
   `supabase db dump --linked --data-only --schema public --file output/orcamento-parametros-aplicados-rollback.sql`
3. Se a tabela precisar ser removida, executar em janela controlada:
   `drop table if exists public.orcamento_parametros_aplicados;`
4. Confirmar que os snapshots em `orcamento_final_versoes` continuam disponiveis, pois o fluxo atual ainda os preserva.
5. Validar novamente `supabase migration list --linked` e registrar a acao no historico operacional.

## Validacao pos-migration esperada

- `supabase migration list --linked` deve mostrar `0040` aplicada no remoto.
- Consultar `information_schema.tables` para confirmar `public.orcamento_parametros_aplicados`.
- Consultar `pg_policies` para confirmar `authenticated_all_orcamento_parametros_aplicados`.
- Consultar `pg_trigger` para confirmar `aud_orcamento_parametros_aplicados`.

## Validacao pos-migration executada

- `supabase db push --linked` aplicou `0040_orcamento_parametros_aplicados.sql` no remoto.
- `supabase migration list --linked` confirmou `0040` em Local e Remote.
- Dump de schema pos-migration: `output/supabase-post-0040-schema-check.sql`.
- Conferencia no dump confirmou:
  - tabela `public.orcamento_parametros_aplicados`;
  - indices de demanda, laboratorio, projeto e versao final;
  - trigger `aud_orcamento_parametros_aplicados`;
  - policy `authenticated_all_orcamento_parametros_aplicados`;
  - RLS habilitada;
  - grants para `anon`, `authenticated` e `service_role` conforme schema remoto.
