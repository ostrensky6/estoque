# Preflight automatizado via GitHub Actions (somente-leitura)

Para você **não** precisar rodar nada manualmente no Supabase. O workflow executa
o diagnóstico **somente-leitura** do módulo Orçamentos e publica os resultados.

> Nenhuma limpeza é executada. O SQL roda em transação `READ ONLY` e termina em
> `ROLLBACK`. Nenhum dado é alterado.

---

## 1. Secrets que você precisa criar

No GitHub: **Settings → Secrets and variables → Actions → New repository secret**.

| Secret | Conteúdo | Obrigatório |
|---|---|---|
| `SUPABASE_DB_URL_HOMOLOGACAO` | connection string do banco de **homologação** (`postgres://usuario:senha@host:5432/postgres`) | **sim** (comece por aqui) |
| `SUPABASE_DB_URL_PRODUCAO` | connection string de **produção** | opcional (só se for rodar em produção) |

Onde achar a string no Supabase: **Project Settings → Database → Connection string**
(modo `URI`/`Session`). Use a connection string com **usuário de leitura** se você
tiver um; o workflow já força read-only, mas usar credencial de leitura é uma
camada extra de segurança.

> Os secrets **nunca** aparecem nos logs: o workflow não imprime a string e o
> GitHub mascara secrets automaticamente.

## 2. Como disparar o workflow manualmente

1. Aba **Actions** → workflow **“Orçamento Preflight (READ ONLY)”**.
2. Botão **Run workflow**.
3. Preencha os inputs:
   - **environment:** `homologacao` (recomendado primeiro) ou `producao`.
   - **confirm_readonly:** digite exatamente `READ_ONLY_ROLLBACK`
     (se errar, o workflow falha de propósito).
   - **pr_number:** `5` (para comentar o resultado no PR #5) — ou em branco para
     não comentar.
4. **Run workflow**.

## 3. Qual ambiente escolher primeiro

**Sempre `homologacao` primeiro.** Só rode em `producao` depois de validar em
homologação — mesmo sendo somente-leitura, é boa prática.

## 4. Onde baixar os artifacts

Na página da run do workflow, seção **Artifacts**, baixe
`orcamento-preflight-<ambiente>`. Contém, por timestamp:
- `preflight-resultado.txt` — output bruto do `psql -f`;
- `preflight-resultados.json` — resultados estruturados (RESUMO + amostras);
- `preflight-resumo.md` — relatório legível;
- `detalhes/A*.csv` — uma planilha por verificação;
- `plan-dedup-dry-run.md` — plano de deduplicação (dry-run, nada executado).

## 5. Como colar os resultados de volta no PR

O workflow **já comenta** no PR (input `pr_number`) com status, timestamp,
ambiente, ocorrências por severidade e a confirmação de READ ONLY + ROLLBACK.
Se quiser detalhar, baixe o artifact e cole o `preflight-resumo.md` (ou preencha
[`2026-06-24-preflight-relatorio-modelo.md`](2026-06-24-preflight-relatorio-modelo.md)).

## 6. Como confirmar que nada foi alterado

- O comentário no PR e o `preflight-resumo.md` mostram **READ ONLY confirmado: sim**
  e **terminou em ROLLBACK: sim**.
- O log da run mostra `transaction_read_only = on` antes de qualquer consulta.
- O runner roda com `PGOPTIONS=-c default_transaction_read_only=on` (o banco
  **rejeita** qualquer escrita) e o validador estático bloqueia verbos de escrita.
- Opcional: compare a contagem de linhas das tabelas antes/depois (idênticas) — o
  preflight não escreve nada.

## 7. Rodar localmente (opcional, se você tiver psql + acesso)

```bash
# valida read-only sem banco:
node scripts/sql/verify-preflight-readonly.mjs

# executa (exige DATABASE_URL; sem ele, falha sem usar produção):
DATABASE_URL="postgres://...HOMOLOGACAO..." PREFLIGHT_ENV=homologacao \
  node scripts/sql/run-preflight-orcamentos.mjs

# gera o plano dry-run a partir do último resultado (não toca no banco):
node scripts/sql/plan-dedup-orcamentos-dry-run.mjs
```

> Sem `DATABASE_URL`, o runner **falha com mensagem clara** e **não** tenta
> usar produção.

## 8. O que isto NÃO faz

- Não executa limpeza, não cria migration de limpeza, não aplica constraints,
  não faz merge, não altera produção. É só diagnóstico read-only + plano dry-run.
