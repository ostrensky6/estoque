# Como executar o preflight em um banco real (somente-leitura)

Arquivo alvo: [`scripts/sql/preflight-orcamentos-duplicidades.sql`](../../scripts/sql/preflight-orcamentos-duplicidades.sql)
Entrega A / Fase 3. **Comece sempre por homologação**, se existir. Só rode em
produção depois de validar em homologação.

> ⚠️ Este preflight **não altera dados**. Ele roda dentro de uma transação
> `READ ONLY` que termina em `ROLLBACK`. Ainda assim, prefira homologação.

---

## 0. Antes de começar

- Tenha em mãos a connection string do banco-alvo (homologação primeiro).
  No Supabase: **Project Settings → Database → Connection string** (modo
  `Session`/`psql`). Nunca cole a string em local público.
- Confirme que está apontando para o ambiente certo (homologação ≠ produção).
- Não rode `npm run prod:*` nem nada que escreva.

---

## 1. Rodando pelo **Supabase SQL Editor**

O SQL Editor mostra **apenas o último result set** de cada execução. Por isso,
rode em duas partes.

### 1a. Bloco RESUMO (uma execução)
1. Abra **SQL Editor → New query**.
2. Cole **somente** o trecho do arquivo que vai de `begin;` até o primeiro
   `rollback;` (o bloco "RESUMO"). Ele já contém
   `begin; set transaction read only; … rollback;`.
3. Clique **Run**.
4. Resultado: uma tabela com colunas `id, severidade, descricao, ocorrencias`
   (linhas A1…A14). **Exporte** (ver seção 5).

### 1b. Consultas de DETALHE (uma de cada vez)
1. No fim do arquivo há blocos comentados `-- A1 — …`, `-- A2 — …`, etc.
2. Para cada verificação **com `ocorrencias > 0`** no resumo, copie a consulta de
   detalhe correspondente, **descomente** (remova os `-- ` do início das linhas)
   e, para garantir read-only, **envolva** assim:
   ```sql
   begin;
   set transaction read only;
   <cole aqui a consulta de detalhe>
   rollback;
   ```
3. Rode e exporte cada resultado.
4. A15 (numeração de migrations) usa
   `supabase_migrations.schema_migrations`; rode-a também.

> Por que assim: o Editor não mostra múltiplos result sets numa execução só.
> Rodar o RESUMO e depois cada DETALHE garante que você vê tudo.

---

## 2. Rodando por **psql** (recomendado — mostra TODOS os resultados)

```bash
# Substitua pela connection string de HOMOLOGAÇÃO:
export DATABASE_URL="postgres://...:...@...:5432/postgres"

# Executa o arquivo inteiro (RESUMO + transação read-only + rollback):
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/sql/preflight-orcamentos-duplicidades.sql
```

Para capturar a saída em arquivo (ver seção 5):
```bash
psql "$DATABASE_URL" -f scripts/sql/preflight-orcamentos-duplicidades.sql \
  > preflight-resultado.txt 2>&1
```

Para as consultas de DETALHE, rode cada uma individualmente, por exemplo:
```bash
psql "$DATABASE_URL" -c "begin; set transaction read only;
  select demanda_id, count(*) qtd, array_agg(id order by id) orcamentos
    from orcamentos
   where demanda_id is not null and coalesce(status,'')<>'cancelado'
     and coalesce(status_operacional,'')<>'cancelado'
   group by demanda_id having count(*)>1 order by qtd desc;
  rollback;"
```

---

## 3. Como confirmar que a transação está em READ ONLY

- **No psql**, dentro da mesma sessão/transação, rode:
  ```sql
  begin;
  set transaction read only;
  show transaction_read_only;   -- deve retornar:  on
  rollback;
  ```
- **Prova adicional** (opcional): tente um write dentro da transação read-only —
  ele **deve falhar**:
  ```sql
  begin;
  set transaction read only;
  -- O comando abaixo DEVE retornar erro "cannot execute INSERT in a read-only transaction":
  insert into demandas_propostas (titulo) values ('__teste_readonly__');
  rollback;
  ```
  Se o `insert` retornar erro, está comprovado que nenhuma escrita é possível.
  (Esse teste é só de demonstração; o preflight em si **não** contém `insert`.)

## 4. Como confirmar que terminou em ROLLBACK

- O arquivo termina o bloco principal com `rollback;`. No psql, a saída mostra
  `ROLLBACK` ao final do bloco.
- Confirme que **nada** foi persistido: rode, **fora de qualquer transação**, a
  contagem de linhas antes e depois (seção 6). Os números devem ser idênticos.
- Não deve aparecer `COMMIT` em nenhum momento. (O teste estático
  `node scripts/sql/verify-preflight-readonly.mjs` garante que o arquivo não
  contém `commit`.)

---

## 5. Como exportar os resultados

**psql → CSV** (por consulta):
```bash
psql "$DATABASE_URL" -c "\copy (
  <SELECT do RESUMO sem begin/rollback>
) to 'preflight-resumo.csv' with csv header"
```
> `\copy` grava no **cliente** (sua máquina), é leitura no servidor — não escreve
> no banco.

**psql → texto completo:**
```bash
psql "$DATABASE_URL" -f scripts/sql/preflight-orcamentos-duplicidades.sql > preflight-resultado.txt 2>&1
```

**Supabase SQL Editor:** botão **Download CSV** (ou **Export → CSV**) em cada
result set.

---

## 6. Como comprovar que NENHUMA escrita foi feita

Antes e depois de rodar o preflight, registre as contagens (são SELECTs):
```sql
select 'orcamentos' t, count(*) n from orcamentos
union all select 'orcamento_itens', count(*) from orcamento_itens
union all select 'orcamento_projetos', count(*) from orcamento_projetos
union all select 'orcamento_projeto_custos', count(*) from orcamento_projeto_custos
union all select 'orcamento_projeto_analises', count(*) from orcamento_projeto_analises
union all select 'orcamento_final_versoes', count(*) from orcamento_final_versoes
union all select 'orcamento_parametros_aplicados', count(*) from orcamento_parametros_aplicados
union all select 'demandas_propostas', count(*) from demandas_propostas
order by t;
```
As contagens **antes** e **depois** devem ser **idênticas**. Opcionalmente,
confira que a trilha de auditoria não ganhou linhas de `UPDATE/DELETE/INSERT` no
intervalo (as tabelas têm trigger `fn_auditoria`).

---

## 7. O que você deve me devolver

Para eu propor a estratégia de deduplicação com números reais, envie:

1. O **RESUMO** completo (A1…A14) — CSV ou texto.
2. Para cada linha do resumo com `ocorrencias > 0`, o **DETALHE** correspondente.
3. O resultado de **A15** (`schema_migrations`).
4. As **contagens antes/depois** (seção 6), provando que nada mudou.
5. Em qual ambiente rodou (**homologação** ou produção) e a data/hora.

Cole tudo no modelo:
[`2026-06-24-preflight-relatorio-modelo.md`](2026-06-24-preflight-relatorio-modelo.md).

---

## 8. Quais consultas são RESUMO e quais são DETALHE

- **RESUMO:** o único bloco `begin … select … from resumo order by id; rollback;`
  no topo do arquivo. Uma linha por verificação (A1…A14).
- **DETALHE:** os blocos comentados ao final (`-- A1 — …` … `-- A15 — …`). Cada um
  retorna as linhas ofensoras de uma verificação. Rode só os que o resumo apontou.

---

## 9. Limitações

- O preflight **não foi executado** contra banco real a partir do ambiente de
  desenvolvimento da IA (sem credenciais Supabase). Por isso estas instruções —
  a execução real depende de acesso que **você** controla.
- O operador JSON `?` (consulta A14) pode ser interpretado como placeholder por
  alguns drivers; em `psql` e no SQL Editor funciona normalmente.
