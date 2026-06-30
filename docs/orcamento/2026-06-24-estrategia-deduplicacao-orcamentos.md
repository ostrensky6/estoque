# Estratégia de deduplicação — Orçamentos (PROPOSTA, sem execução)

Entrega A / Fase 3.

> **NENHUMA limpeza foi executada.** Este documento é a **proposta** de como
> deduplicar, para revisão e aprovação. A execução só ocorrerá depois, com os
> números reais do preflight e com backup. Nada aqui roda automaticamente.

## Princípios gerais (valem para todos os tipos)

1. **Backup antes de tudo.** `pg_dump` das tabelas do módulo + export CSV +
   contagem de linhas. **Se o backup falhar, não modifica nada.**
2. **Nunca recalcular versões finais históricas** nem reescrever snapshots.
3. **Arquivar/cancelar > apagar.** `DELETE` só em última instância, com backup,
   relatório e prova de ausência de dependências. Preferir `status='cancelado'`,
   `cancelado_em`, `cancelado_motivo` e (em versões) `substituido`.
4. **Remapear referências ANTES** de cancelar/arquivar o duplicado.
5. **Auditar cada decisão.** As tabelas já têm trigger `fn_auditoria`; além disso,
   registrar a decisão (registro canônico, perdedores, motivo) numa tabela de log
   de deduplicação (proposta: `orcamento_dedup_log`, migration aditiva).
6. **Proteções (constraints) só DEPOIS** de zerar as duplicidades — senão a
   migration falha sobre dados existentes.
7. **Reexecutar o preflight** ao final e comprovar **ocorrências = 0**.

### Ordem para escolher o registro canônico (desempate)
1. Registro **referenciado por uma versão final** (`orcamento_final_versoes.snapshot`).
2. Registro **aprovado/revisado** (`status='aprovado'` ou `status_operacional='revisado'`).
3. Registro **mais completo** (mais campos preenchidos).
4. Registro com **mais itens válidos** (custo > 0).
5. **Mais recente** (`criado_em`/`id` maior) como desempate final.

### Tabela de log proposta (aditiva, com rollback)
```sql
-- PROPOSTA (não aplicar agora):
create table if not exists orcamento_dedup_log (
  id              bigint generated always as identity primary key,
  tipo            text not null,            -- 'A1','A3',...
  tabela          text not null,
  registro_canonico_id  bigint,
  registros_perdedores  bigint[],
  acao            text not null,            -- 'remapeado','cancelado','arquivado','consolidado'
  motivo          text,
  executado_por   uuid references auth.users(id),
  executado_em    timestamptz not null default now(),
  detalhes        jsonb not null default '{}'::jsonb
);
-- Rollback: drop table orcamento_dedup_log; (após exportar)
```

---

## Por tipo de problema

### A1 — Demandas com >1 orçamento laboratorial ATIVO
- **Risco operacional:** dupla contagem de análises; ambiguidade de qual módulo é
  a fonte do total; emissão inconsistente.
- **Registro canônico:** ordem geral (referenciado por versão final → revisado →
  mais itens válidos → mais recente).
- **Preservar histórico:** os perdedores **não** são apagados; recebem
  `status='cancelado'` + `status_operacional='cancelado'`, mantendo os itens.
- **Remapear referências:** repontar `orcamento_parametros_aplicados.orcamento_laboratorial_id`
  e quaisquer snapshots/relatórios para o canônico **antes** de cancelar.
- **Cancelar/arquivar vs apagar:** cancelar (nunca apagar — há itens e auditoria).
- **Auditoria:** linha em `orcamento_dedup_log` (tipo `A1`) + trigger nativo.
- **Constraint depois:** índice único parcial
  `create unique index on orcamentos (demanda_id) where status <> 'cancelado' and status_operacional <> 'cancelado';`
- **Teste de resolução:** A1 do preflight retorna 0 linhas; teste de integração
  "gerarOrcamentoAnalisesDaDemanda não cria 2º módulo ativo" (idempotência, Fase 5).

### A2 — Demandas com >1 orçamento de projeto ATIVO
- **Risco:** idem A1 no projeto.
- **Canônico / histórico / remapeamento / auditoria:** idem A1, na tabela
  `orcamento_projetos`; remapear `orcamento_parametros_aplicados.orcamento_projeto_id`.
- **Constraint depois:**
  `create unique index on orcamento_projetos (demanda_id) where status <> 'cancelado';`
- **Teste:** A2 = 0; idempotência de `gerarOrcamentoProjetoDaDemanda`.

### A3 — Análises repetidas no mesmo orçamento laboratorial
- **Risco:** soma inflada (mesma análise contada N vezes).
- **Canônico:** a linha de menor `id` por `(orcamento_id, codigo_analise)`.
- **Histórico:** **consolidar** somando `n_amostras` na linha canônica
  (preservando o snapshot de `custo_unitario`/`preco_unitario`); registrar os
  valores originais no log.
- **Remapear:** não há FKs filhas; só consolidação numérica.
- **Cancelar/arquivar vs apagar:** após consolidar e logar, as linhas redundantes
  podem ser removidas **com backup** (são itens puros sem dependências) — ou
  zeradas (`n_amostras` → mantida só na canônica). Preferir manter log.
- **Auditoria:** `orcamento_dedup_log` (tipo `A3`, detalhes com valores antes).
- **Constraint depois:**
  `create unique index on orcamento_itens (orcamento_id, codigo_analise);`
- **Teste:** A3 = 0; teste unitário "rejeita item duplicado no mesmo orçamento".

### A4 — Mesma análise em laboratório × análises-de-projeto (mesma demanda)
- **Risco:** dupla contagem entre as duas fontes numa proposta nova (Fase 4).
- **Canônico:** a **fonte canônica** é `orcamentos`/`orcamento_itens`
  (Fase 4); `orcamento_projeto_analises` fica só para compatibilidade/leitura.
- **Histórico:** propostas antigas **não** são recalculadas; a regra vale para
  propostas novas. Para legados, manter como está e marcar via adapter.
- **Remapear:** ao migrar para a fonte canônica, garantir que a análise não fique
  nas duas fontes da **mesma proposta nova**.
- **Cancelar/arquivar vs apagar:** não apagar legado; bloquear duplicação no
  fluxo novo (validação de servidor).
- **Auditoria:** `orcamento_dedup_log` (tipo `A4`).
- **Constraint depois:** regra de aplicação (validação) + adapter; não há
  constraint cross-table trivial — usar trigger/check de aplicação na Fase 4.
- **Teste:** A4 = 0 para propostas novas; teste "mesma análise não entra nas duas
  fontes".

### A5 — Custos de catálogo repetidos no mesmo orçamento de projeto
- **Risco:** duplicidade de rubrica (pode ser **legítima** — repetição intencional).
- **Canônico:** decisão **caso a caso**; se indevido, manter a linha de menor `id`.
- **Histórico:** consolidar quantidades quando indevido; logar.
- **Remapear:** sem FKs filhas.
- **Cancelar/arquivar vs apagar:** com backup, após confirmação humana de que é
  duplicidade (não repetição legítima).
- **Auditoria:** `orcamento_dedup_log` (tipo `A5`).
- **Constraint depois:** **condicional** — só se o negócio confirmar que não há
  repetição legítima. Caso contrário, **não** criar unicidade aqui.
- **Teste:** A5 = 0 (ou documentar as repetições aceitas).

### A6 — Versões finais emitidas com módulos cancelados no snapshot
- **Risco:** total final reflete módulo cancelado depois.
- **Canônico:** N/A (não se deduplica versão histórica).
- **Histórico:** **não recalcular**; apenas **sinalizar/anotar**.
- **Remapear:** nenhum; corrigir o **fluxo de emissão** (Fase 9) para travar
  módulos cancelados antes de emitir.
- **Cancelar/arquivar vs apagar:** nada se apaga; opcionalmente anotar
  `cancelado_motivo`/observação na versão se a política exigir reemissão.
- **Auditoria:** registrar a observação.
- **Constraint depois:** validação na emissão (Fase 9), não constraint de tabela.
- **Teste:** novo fluxo de emissão rejeita módulo cancelado; A6 não cresce.

### A7 — Números de versão final duplicados
- **Risco:** numeração comercial ambígua.
- **Esperado:** **0** (protegido por `UNIQUE(numero)`). Se aparecer, investigar
  bypass do constraint (ex.: import direto).
- **Demais campos:** N/A — tratar como incidente, não dedup rotineira.
- **Constraint:** já existe; reforçar.
- **Teste:** A7 = 0.

### A8 — Mais de uma versão VIGENTE (emitida) por demanda
- **Risco:** duas propostas "válidas" simultâneas.
- **Canônico:** a versão de **maior `versao`** permanece `emitido`.
- **Histórico:** as anteriores viram `substituido` (preservadas, não apagadas).
- **Remapear:** repontar `orcamento_parametros_aplicados.orcamento_final_versao_id`
  se necessário; manter o vínculo histórico.
- **Cancelar/arquivar vs apagar:** `status='substituido'` (nunca apagar).
- **Auditoria:** `orcamento_dedup_log` (tipo `A8`).
- **Constraint depois:**
  `create unique index on orcamento_final_versoes (demanda_id) where status = 'emitido';`
- **Teste:** A8 = 0; teste de emissão transacional "1 vigente por demanda" (Fase 9).

### A9 — Parâmetros aplicados duplicados por versão final
- **Risco:** snapshot econômico ambíguo da mesma versão.
- **Canônico:** o registro cujo `total_final` bate com o da versão; desempate por
  `criado_em` mais recente.
- **Histórico:** arquivar os perdedores (não apagar) — manter para auditoria.
- **Remapear:** nenhum filho.
- **Auditoria:** `orcamento_dedup_log` (tipo `A9`).
- **Constraint depois:**
  `create unique index on orcamento_parametros_aplicados (orcamento_final_versao_id) where orcamento_final_versao_id is not null;`
- **Teste:** A9 = 0.

### A10 — Registros órfãos (módulos sem demanda; parâmetros sem versão)
- **Risco:** dados fora do fluxo; ruído em relatórios.
- **Canônico:** N/A — decidir **vincular** à demanda correta ou **arquivar**.
- **Histórico:** preservar; vincular quando a demanda for identificável.
- **Remapear:** preencher `demanda_id` quando houver evidência.
- **Cancelar/arquivar vs apagar:** **não** `DELETE` sem backup + relatório +
  prova de ausência de dependências.
- **Auditoria:** `orcamento_dedup_log` (tipo `A10`).
- **Constraint depois:** avaliar tornar `demanda_id` obrigatório **após** sanar
  órfãos (migration aditiva com `not valid` + `validate constraint`).
- **Teste:** A10 = 0.

### A11 — Modalidades legadas e canônica coexistindo
- **Risco:** inconsistência de modalidade entre linhas.
- **Canônico:** `projeto_com_analises` (canônica); legadas
  `analises_projeto`/`projeto_analises_custos` → normalizadas.
- **Histórico:** o código já trata legadas == canônica (helpers de
  `orcamento-economico.ts`); a normalização não muda semântica.
- **Remapear:** `update` de normalização **já previsto** na migration **0045**
  (aditiva, backfill) — a aplicar no rollout, **não** agora.
- **Cancelar/arquivar vs apagar:** N/A (é normalização de valor, não dedup de linha).
- **Auditoria:** trigger nativo na `demandas_propostas`.
- **Constraint depois:** o `check` ampliado da 0045; futuramente, opcional remover
  as legadas do `check` após backfill 100% (migration separada, com rollback).
- **Teste:** A11 = 0 após backfill; testes de modalidade canônica (já no PR #4).

### A12 — Status incompatíveis (demanda/módulos/proposta)
- **Risco:** o funil não reflete a realidade.
- **Canônico:** N/A — é **reconciliação de status**, não dedup.
- **Histórico:** ajustar status conforme a regra de **ciclo de vida** (Fase 8),
  preservando datas/auditoria.
- **Remapear:** nenhum; corrigir status com base na evidência (existência de
  módulo/versão).
- **Cancelar/arquivar vs apagar:** nada se apaga.
- **Auditoria:** trigger nativo + log da reconciliação.
- **Constraint depois:** validações de transição de status no servidor (Fase 8).
- **Teste:** A12 = 0; testes de máquina de estados (Fase 8).

### A13 — Itens com custo zero sem justificativa
- **Risco:** emissão com custo/preço zerado sem aprovação (Fase 7).
- **Canônico:** N/A — é **completude/política**, não dedup.
- **Histórico:** não alterar valores históricos; exigir justificativa no fluxo novo.
- **Remapear:** nenhum.
- **Cancelar/arquivar vs apagar:** nada se apaga; **bloquear emissão** com item
  custo ≤ 0 salvo flag de isenção + justificativa + responsável + aprovação (Fase 7).
- **Auditoria:** registrar isenções com responsável.
- **Constraint depois:** `check`/validação de emissão (Fase 7), não na linha do item
  (zero pode ser legítimo com isenção).
- **Teste:** A13 = 0 (ou todos com isenção registrada); teste "emissão bloqueada
  com custo zero sem isenção".

### A14 — Total final que não reconcilia com o snapshot
- **Risco:** página/PDF/banco divergem do snapshot.
- **Canônico:** N/A — é **bug de cálculo/engine**, não dedup.
- **Histórico:** **não** reescrever snapshots históricos.
- **Remapear:** nenhum; investigar e unificar a engine (Fase 6 — `DEC-ORC-001`).
- **Cancelar/arquivar vs apagar:** nada se apaga.
- **Auditoria:** registrar as versões divergentes para a análise da Fase 6.
- **Constraint depois:** teste de reconciliação no pipeline (validação financeira),
  não constraint de tabela.
- **Teste:** A14 = 0 para versões **novas**; casos financeiros canônicos (Fase 6).

---

## Sequência de execução (quando aprovado)

1. Backup + export + contagens (abortar se backup falhar).
2. Para cada tipo com ocorrências: eleger canônico → **remapear** → cancelar/
   arquivar/consolidar → **logar** em `orcamento_dedup_log`.
3. Aplicar as **proteções** (índices únicos parciais) — só após zerar.
4. **Reexecutar o preflight** e anexar prova de **0** nas verificações tratadas.
5. Anexar consulta que demonstre **ausência de órfãos** (A10 = 0).

## Próximos passos

- Receber o relatório preenchido (números reais).
- Converter esta proposta em um **plano executável** com migrations aditivas
  (log + constraints) e scripts de remapeamento idempotentes, **cada um com
  rollback**, para revisão — **antes** de qualquer execução.
