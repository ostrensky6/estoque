# Plano de Homologação Real e Checklist Operacional: Módulo Orçamentos

Este documento consolida o roteiro de execução, os comandos exatos de infraestrutura, os scripts de validação de banco de dados, os cenários funcionais e o modelo de matriz de evidências para a homologação controlada da pilha de Pull Requests (PR #3 a PR #12) no ambiente de **Staging (Homologação)**.

> [!IMPORTANT]
> **Avisos de Bloqueio Operacional:**
> - Nenhuma operação ou comando deste roteiro deve ser executado contra o ambiente de Produção.
> - Não fazer merge das branches.
> - O script de preflight em Staging deve rodar em modo estritamente **diagnóstico** (dry-run/readonly), sem realizar exclusão automática de dados ou alterações de chaves primárias.

---

## 1. Checklist Operacional Final (Passo a Passo)

### Passo 1: Preparação da Área de Trabalho (Git)
Execute o checkout e garanta a árvore limpa na branch do Release Candidate:
```bash
# Checkout da branch do Release Candidate
git checkout claude/rls-permissoes-orcamentos-fase11

# Verificar status da árvore de trabalho (deve estar com commits sincronizados com a origem)
git status
```

### Passo 2: Instalação e Build Estático
Certifique-se de instalar as dependências e rodar o build estático para garantir que não há erros de tipagem TypeScript ou bundles corrompidos:
```bash
# Instalação limpa de dependências
npm install

# Executar verificação estática
npx tsc --noEmit
npm run lint

# Compilação estática de produção (Next.js build)
npm run build
```

### Passo 3: Deploy das Migrations em Staging

> [!CAUTION]
> **PROIBIDO ENQUANTO O BLOQUEADOR `INFRA-001` ESTIVER ABERTO.**
> Verificado em 2026-06-25 (read-only): o CLI logado reporta como **LINKED** o projeto de **PRODUÇÃO** `hhxwdcwphitfxywbgtju`. Portanto, `supabase db push --linked` resolveria para **PRODUÇÃO** — o que é terminantemente proibido.
> - **NÃO** executar `supabase db push --linked`, `supabase db reset` remoto, `supabase link`, SQL remoto ou alteração de secrets.
> - Só é permitido executar este passo **depois** que o link remoto estiver comprovadamente apontando para um ambiente **Staging** formalmente identificado (ver checklist de retomada na seção 6 e o bloqueador `INFRA-001` em `2026-06-25-evidencias-homologacao-staging.md`).
> - Pré-condição obrigatória antes de rodar este passo: `supabase projects list` deve mostrar o **ref de Staging** marcado como `LINKED ●` e **NÃO** o ref de produção `hhxwdcwphitfxywbgtju`.

Configure as credenciais locais do Supabase CLI para apontar para o banco de Staging (Homologação) e execute a aplicação de migrações **(somente após desbloquear `INFRA-001`)**:
```bash
# (BLOQUEADO até INFRA-001 resolvido) Aplicar as migrations 0045, 0046, 0047 no banco de Staging
# Confirmar antes: `supabase projects list` deve marcar o ref de STAGING como LINKED (nunca hhxwdcwphitfxywbgtju).
supabase db push --linked
```

### Passo 4: Configuração de Secrets e Variáveis de Ambiente
Para rodar os workflows de preflight ou disparar os testes integrados locais contra Staging:
1. No GitHub, configure o secret:
   - `STAGING_SUPABASE_DB_URL`: String de conexão segura `postgresql://...` para o banco de homologação.
2. Localmente, no arquivo `.env.local` de homologação:
   - Certifique-se de que `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` apontam para o endpoint de Staging.

### Passo 5: Execução do Preflight em Modo Diagnóstico
Dispare o workflow do GitHub Actions `.github/workflows/orcamento-preflight-readonly.yml` apontado para o banco de Staging ou execute o script localmente via Node:
```bash
# Rodar o preflight em modo readonly diagnóstico contra o banco configurado
npm run preflight:check
```

### Passo 6: Execução de Testes Automatizados
```bash
# Rodar testes unitários e de integração locais (Vitest)
npm test

# Rodar os testes E2E e Acessibilidade (Playwright)
npm run test:e2e
```
*Nota: Se os testes E2E exigir login real em Staging, garanta que os usuários de teste de staging estejam previamente cadastrados.*

---

## 2. Comandos SQL de Verificação Pós-Migration

Execute estas consultas diretamente no console SQL do banco de Staging para auditar e atestar o sucesso do deploy das migrations:

### A. Confirmar Migrations Aplicadas
Verifica se as três novas migrations constam no registro de histórico do Supabase:
```sql
select id, version, statements, name, applied_at
  from supabase_migrations.schema_migrations
 where version in ('0045', '0046', '0047')
 order by version;
```

### B. Validar Aceitação da Modalidade Canônica (`projeto_com_analises`)
Verifica se a nova restrição de check de modalidade está ativa na tabela `demandas_propostas`:
```sql
-- Verifica a restrição de check ativa na tabela
select conname, pg_get_constraintdef(oid)
  from pg_constraint
 where conrelid = 'demandas_propostas'::regclass
   and conname = 'demandas_propostas_modalidade_check';
-- Deve conter 'projeto_com_analises' na lista de opções válidas.
```

### C. Verificar se a RPC de Emissão Transacional Existe
Garante que a Procedure criada na migration `0046` está compilada no banco:
```sql
select routine_schema, routine_name, data_type
  from information_schema.routines
 where routine_name = 'emitir_orcamento_final_transacional';
```

### D. Validar os Privilégios (Grants) Concedidos para a RPC
Audita os privilégios de execução. É crítico confirmar que `anon` (usuário não autenticado) e `public` não possuem grant de execução:
```sql
select routine_name, grantee, privilege_type
  from information_schema.role_routine_grants
 where routine_name = 'emitir_orcamento_final_transacional';

-- Apenas 'authenticated' e 'service_role' devem possuir privilégio de EXECUTE. 
-- Caso conste 'PUBLIC' ou 'anon', a segurança foi violada.
```

### E. Verificar se o RLS está Habilitado nas Tabelas do Módulo
Garante que a segurança em nível de linha está ativada:
```sql
select tablename, rowsecurity
  from pg_tables
 where tablename in (
    'orcamentos',
    'orcamento_final_versoes',
    'orcamento_parametros_aplicados',
    'demanda_analises',
    'eventos_status'
 );
-- Todas devem retornar 'true' in rowsecurity.
```

### F. Validar as Policies do Módulo Orçamentos
Verifica os critérios de RLS configurados na migration `0047`:
```sql
select tablename, policyname, roles, cmd, qual, with_check
  from pg_policies
 where tablename in (
    'orcamentos',
    'orcamento_final_versoes',
    'orcamento_parametros_aplicados'
 )
 order by tablename;
```

### G. Diagnóstico de Integridade: "Uma Única Versão Final Vigente"
Confirma se não existe nenhuma anomalia onde uma demanda possua mais de uma proposta ativa marcada como `emitido`:
```sql
select demanda_id, count(*)
  from orcamento_final_versoes
 where status = 'emitido'
 group by demanda_id
having count(*) > 1;
-- Deve retornar ZERO linhas se a integridade do banco estiver correta.
```

### H. Diagnóstico de Imutabilidade: Histórico Intocado
Garante que propostas em status não editáveis (enviadas/aprovadas) mantêm seus registros e parâmetros inalterados no banco:
```sql
select v.id as versao_id, v.demanda_id, v.status, count(p.id) as parametros_preservados
  from orcamento_final_versoes v
  left join orcamento_parametros_aplicados p on p.versao_id = v.id
 where v.status in ('emitido', 'substituido', 'cancelado')
 group by v.id, v.demanda_id, v.status;
-- Confirma a amarração correta entre versões passadas e parâmetros aplicados.
```

---

## 3. Sequência de Validação Funcional Manual

Execute os testes operacionais na interface da aplicação local conectada ao banco de Staging utilizando a seguinte sequência de cenários:

| ID | Cenário | Passos de Execução | Resultado Esperado |
| :--- | :--- | :--- | :--- |
| **01** | Proposta Apenas Laboratorial | Criar demanda com modalidade `analises` -> Preencher custos laboratório -> Ir para aba Parâmetros. | O stepper pula a etapa de custos de projeto. O markup incide apenas sobre as análises laboratoriais. |
| **02** | Proposta Apenas Projeto | Criar demanda com modalidade `projeto` -> Preencher rubricas de projeto -> Ir para aba Parâmetros. | O stepper pula a etapa laboratorial. O cálculo de markup incide apenas sobre os custos diretos do projeto. |
| **03** | Proposta Combinada | Criar demanda com modalidade `projeto_com_analises` -> Preencher ambas as abas de custo -> Ir para aba Parâmetros. | Ambas as abas de custos são preenchidas e somadas no painel. O Gross-Up único incide sobre o subtotal somado de custos. |
| **04** | Duplo clique em Criar | Navegar no hub de demandas -> Clicar duas vezes rapidamente no botão "Criar Orçamento". | O redirecionador de idempotência intercepta e abre o módulo já existente, sem duplicar o ID no banco. |
| **05** | Edição de Orçamento Revisado | Tentar editar custos ou parâmetros de um orçamento enviado/aprovado na UI e via Server Action. | A UI bloqueia inputs e a Server Action retorna erro de validação de estado (congelamento de ciclo de vida). |
| **06** | Custo Zero Bloqueando Emissão | Cadastrar item com custo operacional unitário R$ 0,00 sem justificativa preenchida -> Tentar emitir. | O sistema impede a emissão, bloqueia a consolidação e aponta alerta de custo zerado na tela. |
| **07** | Batimento de Parâmetros | Mudar margem de lucro nos parâmetros -> Inspecionar o Total Final. | O cálculo matemático bate exatamente com a fórmula autoritativa: `Total = Custos / (1 - Fatores)`. |
| **08** | Emissão Final (Versão 1) | Clicar em "Emitir Proposta Final" para uma demanda ativa. | Cria registro `v1` em `orcamento_final_versoes` com status `emitido` e atualiza a demanda para `orcada`. |
| **09** | Reemissão (Versão 2) | Alterar um custo -> Emitir novamente o mesmo orçamento. | A versão `v1` passa para o status `substituido` e uma nova `v2` torna-se a vigente (ativa) para aquela demanda. |
| **10** | Reconciliação do Export | Exportar os arquivos XLSX e DOCX de um orçamento emitido. | Os totais, subvalores e incidência de impostos nos arquivos exportados batem perfeitamente com os da tela. |
| **11** | Papel Técnico Sem Emissão | Logar como usuário com papel `tecnico` -> Tentar revisar ou emitir orçamento. | A interface oculta o botão de emissão e a Server Action retorna erro de permissão negada. |
| **12** | Coordenador/Gestor Emitindo | Logar como `coordenador` ou `gestor` -> Executar transição de status e emissão. | As operações executam com sucesso. Os eventos de status e logs de auditoria são registrados sob o ID do usuário. |
| **13** | Painel de Governança | Logar como `admin` -> Acessar `/orcamento/governanca`. | Acesso concedido para visualização de relatórios consolidados e logs de transações. |
| **14** | Deep Link de Etapa | Acessar diretamente a URL `/orcamento/demandas/1?etapa=final`. | A interface foca e abre a aba final de forma direta e consistente. |
| **15** | Responsividade (Desktop/Mobile) | Redimensionar a janela para 375px ou emular dispositivo móvel. | O stepper horizontal e as tabelas de custeio adaptam-se sem quebrar o layout nem causar transbordo (overflow) lateral. |

---

## 4. Modelo de Matriz de Evidências de Homologação

Os homologadores deverão registrar cada teste executado na tabela abaixo para consolidar a assinatura do release candidate:

| Data | Ambiente | Commit / Branch | Migration Aplicada? | Usuário / Papel | Cenário Testado | Resultado Esperado | Resultado Obtido | Evidência (Link/Print) | Status (OK/Falha) | Pendência |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| DD/MM | Staging | `claude/rls-permissoes...` | Sim (0045-0047) | `coord_test` | Emissão combinada | Versão v1 criada | *Preencher* | `print-emissao.png` | *Preencher* | — |
| DD/MM | Staging | `claude/rls-permissoes...` | Sim (0045-0047) | `tecnico_test` | Bloqueio de emissão | Retorna "Acesso Negado"| *Preencher* | `print-erro.png` | *Preencher* | — |
| ... | | | | | | | | | | |

---

## 5. Status da Pilha de Pull Requests e Governança

* **Status da Pilha PR #3 → PR #12:** Pronta e 100% testada de forma linear. Todos os testes unitários e de acessibilidade/integração estão passando.
* **Riscos Remanescentes:** O provisionamento do banco de Staging precisa corresponder exatamente ao schema de produção legado para evitar inconsistências nos dados de backfill legados durante a aplicação da migration `0045`.
* **Pendências que Bloqueiam o Merge:** Nenhuma pendência de código. Apenas a execução bem-sucedida das migrações e do checklist no ambiente de Staging.
* **Pendências pós-homologação (Follow-up):** Execução do plano de deduplicação lógica de dados reais em Produção (a ser disparado apenas após a homologação deste Release Candidate).
* **Garantia de Preservação:** 
  - Confirmamos que **nada foi aplicado no ambiente de produção**.
  - Confirmamos que **nenhum dado real foi alterado ou excluído**.
  - Confirmamos que **não houve merge** nas branches.
