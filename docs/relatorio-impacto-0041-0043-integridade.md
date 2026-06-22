# Relatório de impacto — migrações 0041–0043 (integridade de cadastros)

> Conforme `AGENTS.md` (regra 11) e o protocolo de migração: migrações
> **aditivas**, validadas em banco **local populado**, sem `DROP`/`TRUNCATE`/
> remoção de coluna/RLS/triggers. **Não aplicadas em produção** neste trabalho.

## Escopo

| Migração | Efeito | Tipo |
|----------|--------|------|
| `0041_insumo_analise_integridade.sql` | `insumo_analise`: + `ativo`, `obrigatorio`, `estado_integridade`, `revisado_em`, `revisado_por`, `motivo_inativacao`; check de domínio de `modo_cobranca` (NOT VALID, permite NULL) | Colunas + constraint |
| `0042_insumo_analise_etapa_id.sql` | `insumo_analise`: + `etapa_id` (FK→`etapas.id`, índice); preenche correspondências **inequívocas**; view `vw_insumo_analise_etapa_ambiguos` | Coluna + FK + UPDATE de preenchimento + view |
| `0043_orcamento_item_snapshot_laboratorio.sql` | nova tabela `orcamento_item_snapshot` (composição integral + override) com RLS + auditoria | Tabela nova |

## Validação no banco local (seed populado: 11 análises, 343 insumo_analise, 107 etapas)

- Aplicação das três migrações: **sucesso**.
- Reaplicação (idempotência): **sucesso** (todas usam `if not exists` / guards `pg_constraint`).
- `0042`: **325** vínculos preenchidos automaticamente (inequívocos); **18**
  permanecem `etapa_id IS NULL` e aparecem em `vw_insumo_analise_etapa_ambiguos`
  (duplicidade real de etapas — ex.: `Illumina_Sh` "Montagem de biblioteca").
- `database.types.ts` atualizado **cirurgicamente** (apenas as adições), porque
  o banco local está atrás de migrações de produção e uma regeneração completa
  removeria tipos válidos.

## Decisões não destrutivas

1. **`modo_cobranca` continua NULLABLE.** O check é `NULL OR IN (...)`, criado
   `NOT VALID`: não varre as 321 linhas nulas, permite editar linhas ainda
   pendentes e barra apenas valores **não-nulos inválidos**. A regra "ausente =
   bloqueio" é aplicada na **aplicação** (guard de custeio). O aperto para
   `NOT NULL` fica para migração posterior, após resolver os nulos com evidência.
2. **Nada é convertido por inferência.** Quantidade zero, modo ausente e
   vínculos ambíguos NÃO são "consertados" automaticamente — vão para relatório.
3. **`etapa_id` só recebe correspondências inequívocas.** Ambíguos ficam nulos,
   nunca escolhidos arbitrariamente.
4. **Snapshot é a fonte de leitura histórica.** Orçamentos antigos não devem ser
   recompostos com cadastros atuais (a engine mantém o fallback só para leitura).

## Plano de aplicação em produção (pendente, exige acesso de escrita)

1. Backup lógico das tabelas afetadas (`insumo_analise`, e a nova tabela).
2. Rodar `scripts/sql/preflight-integridade-cadastros.sql` (READ ONLY) em prod
   para o retrato real antes/depois.
3. Aplicar `0041`→`0042`→`0043` em janela controlada.
4. Conferir `vw_insumo_analise_etapa_ambiguos` e tratar manualmente.
5. Regenerar `database.types.ts` a partir de produção.
6. Revisar RLS das novas colunas/tabela (herdada de `authenticated`).

## Rollback

- `0041`/`0042`: `ALTER TABLE insumo_analise DROP COLUMN ...` (após backup) e
  `DROP CONSTRAINT`/`DROP VIEW` — colunas aditivas, sem perda de dados legados.
- `0043`: `DROP TABLE orcamento_item_snapshot` (exportar antes, se houver dados).
