# Fase 3 — Resumo executivo do PR #5 + checklist de execução do preflight

Data: 2026-06-24 · Status: **diagnóstico preparado; nenhuma limpeza autorizada**

---

## 1. Resumo executivo (PR #5)

**O que foi entregue**
- Script de **preflight somente-leitura** (`scripts/sql/preflight-orcamentos-duplicidades.sql`)
  com 15 verificações (A1–A15): duplicidades de orçamento laboratorial/projeto,
  análises repetidas, duplicação laboratório×análises-de-projeto, custos de
  catálogo repetidos, versões finais inconsistentes, parâmetros aplicados
  duplicados, órfãos, modalidades legadas×canônica, status incompatíveis, custo
  zero, divergência total×snapshot e conflito de numeração de migrations.
- **Teste** que comprova read-only (`scripts/sql/verify-preflight-readonly.mjs`).
- **Documentação:** relatório do preflight, instruções de execução, **modelo de
  relatório** para preencher e **estratégia de deduplicação** por tipo (risco,
  registro canônico, histórico, remapeamento, auditoria, constraint e teste).

**O que foi comprovado**
- O script é **somente-leitura**: roda em `begin; set transaction read only; … rollback;`
  e não contém `INSERT/UPDATE/DELETE/TRUNCATE/DROP/ALTER/CREATE/GRANT/COMMIT`.
  Teste estático: **✓ aprovado**.
- App íntegro: `vitest` **120/120**, `tsc --noEmit` limpo, `eslint` limpo, `next build` OK.
- **Conflito de numeração resolvido:** migration renumerada `0041 → 0045`
  (0041–0044 já usadas por outras branches).

**O que ainda NÃO foi executado**
- O preflight **não rodou contra banco real** (sem credenciais neste ambiente).
- **Nenhuma limpeza**, nenhuma migration de limpeza, nenhuma constraint nova,
  nenhum dado alterado, nenhum merge.

**Riscos que permanecem**
- Duplicidades/inconsistências reais ainda **desconhecidas** até rodar o preflight.
- Validação visual/funcional dos previews bloqueada por autenticação (Vercel SSO,
  login Supabase).
- Colisões de numeração entre **outras** branches (ex.: 0037/0038 em `bold-morse`)
  continuam a existir — fora do escopo desta entrega, apenas registrado.

**Por que não se pode limpar dados automaticamente agora**
- Sem os números reais não há como eleger registro canônico nem dimensionar impacto.
- Limpeza exige **backup lógico + relatório + log de auditoria + remapeamento de
  referências + rollback**, e só após **sua aprovação explícita**.
- Apagar/alterar dados sem isso violaria as regras de segurança do projeto
  (sem `DELETE` sem backup; preservar histórico; nada destrutivo em produção).

---

## 2. Checklist operacional — rodar o preflight em **homologação**

> Comece por **homologação**. Só rode em produção depois de validar em homologação.
> O script não altera dados, mas a prudência vale mesmo assim.

### Opção A — Supabase SQL Editor

1. **Arquivo a abrir:** `scripts/sql/preflight-orcamentos-duplicidades.sql`
   (copie o conteúdo para o SQL Editor).
2. **Rodar primeiro — bloco RESUMO:** copie do `begin;` (no topo) até o primeiro
   `rollback;`. Clique **Run**. Saída: tabela `id, severidade, descricao, ocorrencias`
   (A1…A14).
3. **Exportar o RESUMO:** botão **Download CSV** no result set (ou copie a tabela).
4. **Rodar os DETALHES:** para cada linha do resumo com `ocorrencias > 0`, vá ao
   fim do arquivo, ache o bloco comentado correspondente (`-- A1 — …` etc.),
   **descomente** e envolva assim para garantir read-only:
   ```sql
   begin;
   set transaction read only;
   <consulta de detalhe>
   rollback;
   ```
   Rode e **Download CSV** de cada um. Rode também **A15** (`schema_migrations`).
5. **Verificar `transaction_read_only = on`:**
   ```sql
   begin;
   set transaction read only;
   show transaction_read_only;   -- deve retornar: on
   rollback;
   ```
6. **Verificar que terminou em ROLLBACK:** o bloco do arquivo termina em
   `rollback;`. Confirme rodando as **contagens antes/depois** (passo abaixo) —
   devem ser idênticas. Não deve existir `commit` em lugar nenhum.

### Opção B — psql

1. **Definir a connection string de HOMOLOGAÇÃO** (não cole em local público):
   ```bash
   export DATABASE_URL="postgres://USUARIO:SENHA@HOST:5432/postgres"
   ```
2. **Comando completo (RESUMO + read-only + rollback), com log em arquivo:**
   ```bash
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
     -f scripts/sql/preflight-orcamentos-duplicidades.sql \
     > preflight-resultado.txt 2>&1
   ```
3. **Salvar logs / exportar CSV do RESUMO:**
   ```bash
   psql "$DATABASE_URL" -c "\copy (
     /* cole aqui o SELECT do RESUMO, sem begin/rollback */
   ) to 'preflight-resumo.csv' with csv header"
   ```
4. **Conferir ausência de escrita (contagens antes/depois — devem ser iguais):**
   ```bash
   psql "$DATABASE_URL" -c "
     select 'orcamentos' t, count(*) n from orcamentos
     union all select 'orcamento_itens', count(*) from orcamento_itens
     union all select 'orcamento_projetos', count(*) from orcamento_projetos
     union all select 'orcamento_projeto_custos', count(*) from orcamento_projeto_custos
     union all select 'orcamento_projeto_analises', count(*) from orcamento_projeto_analises
     union all select 'orcamento_final_versoes', count(*) from orcamento_final_versoes
     union all select 'orcamento_parametros_aplicados', count(*) from orcamento_parametros_aplicados
     union all select 'demandas_propostas', count(*) from demandas_propostas
     order by t;"
   ```
   Rode esse mesmo comando **antes** e **depois** do preflight — os números devem
   bater. (Prova adicional opcional: dentro de `begin; set transaction read only;`
   um `insert` de teste **deve falhar** com "cannot execute INSERT in a read-only
   transaction".)

### O que me devolver
- RESUMO (A1–A14), DETALHES das linhas com `ocorrencias > 0`, A15, e as contagens
  antes/depois. Cole no modelo
  [`2026-06-24-preflight-relatorio-modelo.md`](2026-06-24-preflight-relatorio-modelo.md).

---

## 3. Mensagem curta para o responsável pelo banco/Supabase

> **Assunto: rodar um script de diagnóstico (somente-leitura) no Orçamentos**
>
> Olá! Preciso rodar um script SQL de **diagnóstico** no banco (de preferência
> **homologação** primeiro) para inventariar duplicidades no módulo de Orçamentos.
>
> **O script é 100% somente-leitura e não altera nada:**
> - roda dentro de uma transação `READ ONLY` que termina em `ROLLBACK`;
> - **não** contém INSERT, UPDATE, DELETE, TRUNCATE, DROP, ALTER, CREATE, GRANT
>   nem COMMIT — só `SELECT`;
> - há um teste automatizado que comprova isso (`verify-preflight-readonly.mjs`).
>
> Ele só **lê e conta** registros e devolve um resumo de inconsistências. Nenhum
> dado é criado, alterado ou apagado; produção não é modificada. Posso rodar eu
> mesmo se você me der acesso de leitura em homologação, ou você roda colando o
> arquivo `scripts/sql/preflight-orcamentos-duplicidades.sql` no SQL Editor.
> Qualquer dúvida, sigo as instruções em `2026-06-24-preflight-instrucoes-execucao.md`.

---

## 4. Limites desta etapa (reafirmados)

- **Não** avançar para engine econômica, emissão transacional ou redesign da
  Proposta final.
- **Não** executar limpeza. **Não** criar migration de limpeza. **Não** aplicar
  constraints. **Não** fazer merge.
- Após este material, **parar e aguardar** os resultados reais do preflight.

## 5. Próxima entrega (após você devolver os resultados)
1. Interpretar os achados. 2. Priorizar riscos. 3. Propor estratégia de limpeza.
4. Separar o automatizável do que exige decisão manual. 5. Preparar
migration/rotina de limpeza **somente após sua aprovação explícita**.
