# Release Candidate: Módulo Orçamentos (Pilha PR #3 → PR #12)

Este documento descreve o Release Candidate (RC) do módulo de Orçamentos, consolidando a pilha de Pull Requests empilhados do PR #3 ao PR #12. Ele serve como especificação técnica de integração e atesta a integridade do pacote para homologação em ambiente de Staging.

---

## 1. Mapeamento da Pilha Completa de PRs

A pilha de entregas está organizada sequencialmente da seguinte forma, com cada PR construído sobre o anterior, partindo da branch `main`:

| PR # | Branch de Origem | Objetivo Principal | Arquivos Principais / Entregas |
| :--- | :--- | :--- | :--- |
| **PR #3** | `claude/focused-neumann-ba2323` | **Reorganização de Navegação e Rotas**: Reduz a navegação a 5 destinos baseados na proposta/demanda e implementa o stepper condicional na UI. | `src/config/navigation.ts`<br>`src/app/orcamento/page.tsx`<br>`src/app/orcamento/demandas/page.tsx`<br>`src/app/orcamento/demandas/[id]/page.tsx` |
| **PR #4** | `claude/fase1-2-modalidade-unica` | **Modalidade Canônica Única**: Introduz a modalidade `projeto_com_analises` na UI e no stepper condicional, unificando fluxos. | `src/lib/orcamento/orcamento-economico.ts`<br>`src/lib/orcamento/etapas-proposta.ts`<br>`supabase/migrations/0045_modalidade_projeto_com_analises.sql` |
| **PR #5** | `claude/preflight-orcamentos-fase3` | **Preflight Somente Leitura**: Cria automação de detecção de duplicidades por script SQL executado via workflow no GitHub. | `scripts/sql/preflight-orcamentos-duplicidades.sql`<br>`.github/workflows/orcamento-preflight-readonly.yml` |
| **PR #6** | `claude/fase4-engine-economica` | **DEC-ORC-001 (Política Economica)**: Inventário de engines e políticas econômicas de cálculo e regras canônicas do simulador comercial. | `docs/orcamento/DEC-ORC-001-politica-economica.md`<br>`src/lib/orcamento/proposta-final.ts` |
| **PR #7** | `claude/fase4-engine-autoritativa` | **Engine Econômica Autoritativa**: Aplicação do Gross-Up parametrizado único em TypeScript para laboratórios e projetos. | `src/lib/orcamento/engine-economica.ts`<br>`src/lib/orcamento/proposta-final.test.ts` |
| **PR #8** | `claude/fase10-proposta-final` | **Aba Proposta Final Redesenhada**: Interface de usuário da proposta comercial final, listando totais com Gross-Up e alertando custos zero. | `src/app/orcamento/final/[id]/page.tsx`<br>`src/components/orcamento/ExportOrcamentoFinalButtons.tsx` |
| **PR #9** | `claude/fase10-exports-proposta-final` | **Exports Reconciliados**: Reconciliação dos relatórios XLS/DOC/PDF exportados com a engine econômica autoritativa e valores de tela. | `src/lib/orcamento/final-exporters.ts`<br>`src/lib/orcamento/proposta-final-export.ts` |
| **PR #10** | `claude/fase5-idempotencia-ciclo-vida` | **Idempotência e Ciclo de Vida**: Proteção contra duplicidade na criação de módulos e congelamento de edições de orçamentos enviados/aprovados. | `src/lib/orcamento/garantir-modulos.ts`<br>`src/lib/orcamento/ciclo-vida-modulo.ts` |
| **PR #11** | `claude/fase9-emissao-transacional` | **Emissão Final Transacional por RPC**: Persistência atômica da versão final emitida sob lock por demanda (`FOR UPDATE`) no PostgreSQL. | `supabase/migrations/0046_emitir_orcamento_final_transacional.sql`<br>`src/lib/actions/demandas.ts`<br>`src/lib/supabase/database.types.ts` |
| **PR #12** | `claude/rls-permissoes-orcamentos-fase11` | **RLS, Permissões e Validações por Papel**: Endurecimento de permissões, Server Actions e RLS baseados na matriz programática de governança. | `supabase/migrations/0047_rls_permissoes_orcamentos.sql`<br>`src/lib/orcamento/permissoes.ts`<br>`src/lib/security/rls-policies.test.ts` |

---

## 2. Diagnóstico da Integridade da Pilha

Realizamos as seguintes verificações formais na árvore de código da branch ativa `claude/rls-permissoes-orcamentos-fase11`:

1. **Empilhamento Linear**: A branch está empilhada linearmente sobre as anteriores. O histórico de commits comprova a sequência limpa (`PR #12` -> `PR #11` -> `PR #10` -> `PR #9` -> `PR #8` -> `PR #7` -> `PR #6` -> `PR #5` -> `PR #4` -> `PR #3` -> `main`).
2. **Working Tree Limpo**: Não há modificações locais pendentes ou arquivos modificados e não comitados pertencentes ao Release Candidate.
3. **Isolamento de Arquivos Locais**: Os arquivos untracked correspondentes a desenvolvimentos paralelos de outras fases (`0041`, `0042`, `0043` e views/testes associados) estão isolados e não interferem nas importações ou dependências do código do Release Candidate.
4. **Coerência de `database.types.ts`**: O arquivo de tipos regenerados do Supabase reflete perfeitamente a RPC `emitir_orcamento_final_transacional` adicionada na migração `0046`.
5. **Prevenção de Colisões nas Migrations**: Todas as migrations na pilha possuem numeração incremental única (`0045` -> `0046` -> `0047`), sem duplicidades ou colisões.

---

## 3. Tabela de Migrations do Release Candidate

Abaixo está o cronograma e tabela descritiva das novas migrations PostgreSQL que integram este Release Candidate. **Nenhuma migração foi aplicada contra o banco de produção real.**

| Número | Arquivo | Objetivo da Migration | Aditiva? | Altera Dados Existentes? | Exige Rollback Documentado? | Pode ser aplicada em Homologação? | Dependências | Ordem de Aplicação |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **0045** | `0045_modalidade_projeto_com_analises.sql` | Altera check de modalidade para aceitar `projeto_com_analises` e realiza backfill das linhas legadas. | Sim (Check e Update) | Sim (Backfill das linhas legadas em `demandas_propostas`) | Sim (Incluso e descrito no cabeçalho da migration) | Sim | Nenhuma | 1ª |
| **0046** | `0046_emitir_orcamento_final_transacional.sql` | Cria a RPC `emitir_orcamento_final_transacional` para gravação de versão final sob lock concorrente. | Sim (Apenas cria função) | Não | Sim (Incluso e descrito no cabeçalho da migration) | Sim | `0045` | 2ª |
| **0047** | `0047_rls_permissoes_orcamentos.sql` | Remove políticas `authenticated_all`, endurece RLS por papel e securiza a execução da RPC de emissão. | Sim (Políticas e Grants) | Não | Sim (Incluso e descrito no cabeçalho da migration) | Sim | `0046` | 3ª |

### Validações de Bloqueio das Migrations
* **Sem Migrations de Limpeza Destrutivas**: Nenhuma migração de limpeza lógica/física foi criada.
* **Sem Restrições Definitivas do Preflight**: Nenhuma constraint definitiva foi aplicada às tabelas com duplicidade no histórico de produção. Apenas as regras ativas de bloqueio de concorrência na criação de novos registros foram definidas.
* **Sem Recálculo Histórico**: Não há alteração de snapshots antigos, preservando a imutabilidade das propostas já fechadas.
* **Rollbacks Documentados**: Todas as 3 migrations possuem scripts de reversão (`down`) detalhados em seus cabeçalhos.
