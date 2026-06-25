# Diagnóstico — emissão da proposta final (Fase 9)

Data: 2026-06-24 · Nenhum dado alterado. Migration NÃO aplicada em banco real.

## 1. Fluxo atual de `emitirOrcamentoFinalDaDemanda` (antes)

Sequência de operações **independentes** (sem transação):

1. lê a demanda (`demandas_propostas`);
2. valida completude (TS);
3. lê módulos (`orcamentos` + itens, `orcamento_projetos` + custos/análises);
4. lê a última versão (`max(versao)`) — **no TypeScript**;
5. calcula economia (engine autoritativa `consolidarOrcamentoFinal`);
6. valida pronto / custo zero (TS);
7. **define a próxima versão no TS** (`ultimaVersao + 1`);
8. **UPDATE** versões vigentes → `substituido`;
9. **INSERT** nova versão (`orcamento_final_versoes`);
10. **INSERT** parâmetros aplicados (`orcamento_parametros_aplicados`);
11. **UPDATE** demanda → `orcada`;
12. **registra evento** (`registrarEvento`, função TS **fora** de qualquer transação).

## 2. Riscos do fluxo atual

| Risco | Consequência |
|---|---|
| Falha após (8) e antes de (9) | versão anterior fica `substituido` e **não há nova vigente** (demanda sem proposta vigente) |
| Falha após (9) e antes de (10) | versão **sem** parâmetros aplicados |
| Falha após (9) e antes de (11) | versão emitida mas demanda **não** marcada `orcada` |
| Duas emissões simultâneas | ambas leem `max(versao)` igual → tentam a mesma versão (o `UNIQUE(demanda_id,versao)` rejeita uma, mas a outra já pode ter feito o `substituido`, deixando estado inconsistente) |
| Duas versões vigentes | janela entre `substituido` e novo `insert` por concorrência |
| Evento/auditoria fora da transação | emissão pode gravar e o evento falhar (ou vice-versa) — histórico inconsistente |
| Snapshot calculado antes de outra alteração | itens podem mudar entre o cálculo (5) e a gravação (9) |
| Emissão com duplicidade histórica | módulos duplicados entram no snapshot sem checagem |
| Emissão com módulo bloqueado por integridade | nada impedia a emissão sob duplicidade |

## 3. Arquitetura transacional adotada (híbrida)

Como a engine econômica autoritativa está em **TypeScript** (`engine-economica.ts`),
**não** duplicamos a fórmula em SQL:

- **(A) TypeScript** calcula e valida com a engine autoritativa (completude, módulo
  revisado, custo zero, parâmetros inválidos, **duplicidade ativa**). Aborta
  **antes** da RPC se houver pendência.
- **(B) RPC PostgreSQL** `emitir_orcamento_final_transacional` recebe o payload
  **já calculado/validado** e faz **apenas a persistência atômica**, em **uma
  transação** com **lock por demanda (`FOR UPDATE`)**:
  1. bloqueia a demanda e confere existência;
  2. confere ausência de duplicidade ativa (lab/projeto);
  3. **calcula a próxima versão sob lock**;
  4. marca a vigente anterior como `substituido`;
  5. insere a nova versão;
  6. insere os parâmetros aplicados (se houver);
  7. atualiza a demanda → `orcada` (apenas de `nova`/`em_analise`);
  8. registra o evento em `eventos_status` **dentro** da transação;
  9. retorna `{ id, numero, versao }`.

Qualquer falha aborta tudo (nada parcial). A **próxima versão** deixa de ser
calculada no TypeScript.

### RPC criada
`emitir_orcamento_final_transacional(p_demanda_id, p_validade_dias, p_total_*,
p_snapshot jsonb, p_parametros jsonb, p_criado_por uuid, p_usuario_email text)`
— migration `supabase/migrations/0046_emitir_orcamento_final_transacional.sql`
(aditiva, com rollback documentado no cabeçalho).

## 4. Concorrência

- **Lock por demanda** (`select … for update`) serializa emissões concorrentes da
  mesma demanda; a próxima versão é calculada **sob o lock**, eliminando a corrida
  de versão.
- Uma única versão vigente por demanda é garantida no **escopo da transação**
  (substituir + inserir atômicos).
- A **constraint definitiva** "uma versão vigente por demanda" depende do
  preflight/limpeza (índice único parcial `where status='emitido'`) e fica como
  **pendência pós-limpeza** (não aplicada nesta fase).

## 5. Auditoria

- O evento foi **movido para dentro da transação** (insert direto em
  `eventos_status` na RPC), eliminando a auditoria fora da transação.
- Os triggers `fn_auditoria` em `orcamento_final_versoes` e
  `orcamento_parametros_aplicados` continuam disparando (auditoria por linha).
- Limitação: o `usuario` do evento é passado como e-mail pelo TS
  (`p_usuario_email`); a RPC não resolve o usuário por conta própria.

## 6. Compatibilidade histórica

- Versões antigas **não** são recalculadas; snapshots antigos **não** alterados.
- `/orcamento/final/[id]` continua lendo versões antigas (modo legado já tratado
  nas fases anteriores).
- A emissão nova grava o snapshot da engine autoritativa (Política A).

## 7. Ordem de rollout (importante)

A migration `0046` **precisa ser aplicada antes** de implantar o código novo da
action (que chama a RPC). **Não foi aplicada em banco real nesta entrega.**

## 8. Pendências conhecidas

- **Validação integrada de atomicidade/concorrência** exige banco de
  homologação (testes aqui são de **contrato**, com `supabase.rpc` mockado).
- **Constraint** "uma vigente por demanda" e demais índices únicos: pós-limpeza.
- Regeneração dos tipos do Supabase (`database.types.ts`) após aplicar a migration;
  nesta entrega a função foi declarada manualmente nos tipos para o build.
