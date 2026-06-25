# Roteiro e Checklist de Homologação: Módulo Orçamentos

Este roteiro estabelece as etapas e consultas necessárias para validar a integração completa do módulo de Orçamentos em ambiente de homologação (Staging), prevenindo qualquer impacto ou alteração de dados no ambiente produtivo real.

---

## 1. Passos Objetivos de Homologação (Passos A a M)

### A. Preparar Ambiente
1. Provisionar um schema/banco de dados Supabase de homologação (Staging) separado de produção.
2. Garantir que as variáveis de ambiente locais/CI estejam apontando para este banco de Staging (por exemplo, `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`).

### B. Aplicar Migrations em Homologação
1. Aplicar as migrations acumuladas na pilha de PRs (`0045`, `0046`, `0047`) em ordem sequencial no banco de Staging.
2. Executar via CLI do Supabase local ou console SQL.

### C. Regenerar `database.types.ts`
1. Caso ocorram mudanças em procedures ou tabelas adicionais durante o deploy, regenerar as tipagens TypeScript:
   ```bash
   npx supabase gen types typescript --project-id <projeto-staging-id> > src/lib/supabase/database.types.ts
   ```

### D. Configurar Secrets do Preflight
1. Configurar os segredos de CI/CD do GitHub Actions para a branch/repositório de teste:
   * `STAGING_SUPABASE_DB_URL`: String de conexão segura para rodar o preflight.

### E. Rodar Workflow do Preflight
1. Disparar manualmente ou via commit o workflow `.github/workflows/orcamento-preflight-readonly.yml` no ambiente de Staging.
2. Validar que ele executa com sucesso, gerando os artefatos de duplicidades sem falhas ou vazamento de connection string no log.

### F. Executar Testes Automatizados
1. Rodar os testes de regressão no ambiente de staging/mock local:
   ```bash
   npm test
   ```

### G. Executar Testes Funcionais Manuais
1. Executar os cenários de teste interativos detalhados no Checklist Funcional (Seção 2) utilizando o painel web local apontado para Staging.

### H. Validar Emissão Real
1. Iniciar o fluxo com uma demanda em rascunho, preencher as etapas laboratorial e de projetos.
2. Disparar o botão de **Emitir Proposta Final** e inspecionar a criação correta de registros em `orcamento_final_versoes`.

### I. Validar Permissões por Papel
1. Logar no Kontrol utilizando usuários com os papéis de `tecnico`, `coordenador`, `gestor` e `admin`.
2. Validar o correto bloqueio/liberação das ações na UI e nas Server Actions de acordo com a matriz de governança.

### J. Validar Exports
1. Exportar propostas nos formatos DOCX, XLSX e PDF a partir da interface e checar o exato batimento dos valores matemáticos e gross-up com os exibidos em tela.

### K. Validar Visual Desktop/Mobile
1. Testar a responsividade das páginas `/orcamento/demandas/[id]` e `/orcamento/final/[id]` utilizando o inspetor de dispositivos do Chrome (emulando larguras de mobile como iPhone e tablets).

### L. Registrar Evidências
1. Capturar e arquivar screenshots dos painéis de exportação de dados, logs de transações e logs da RPC de homologação.

### M. Decisão para Avançar para Produção
1. Apenas após a homologação manual, aprovação do checklist funcional com 100% de sucesso e aprovação dos testes de concorrência, emitir autorização formal para prosseguir para a fase de Limpeza/Deduplicação Real no ambiente de Produção.

---

## 2. Checklist Funcional de Homologação

Mapeamento dos cenários funcionais a serem validados e assinados pelos testadores:

| Cenário de Teste | Comportamento Esperado | Status |
| :--- | :--- | :--- |
| **Criar proposta apenas laboratorial** | O stepper pula a etapa de custos de projeto e a consolidação econômica calcula apenas o markup do laboratório. | `[ ]` |
| **Criar proposta apenas projeto** | O stepper pula a etapa laboratorial. O cálculo de markup do projeto executa com base na margem de lucro e impostos definidos. | `[ ]` |
| **Criar proposta combinada** | Ambas as abas (laboratório e projeto) são preenchidas e a consolidação gross-up soma corretamente ambos os custos operacionais. | `[ ]` |
| **Duplo clique em criar módulo não duplica** | O gating de idempotência do PR #10 redireciona para o módulo existente sem gerar um segundo ID ativo. | `[ ]` |
| **Módulo revisado não permite edição** | Ao abrir um orçamento enviado/aprovado, a UI desabilita edição de itens e a Server Action bloqueia payloads maliciosos. | `[ ]` |
| **Custo zero bloqueia emissão** | Itens com custo unitário zero sem justificativa cadastrada na aba de projetos impedem a consolidação e geram erro na aba Final. | `[ ]` |
| **Parâmetros econômicos corretos** | A alteração de premissas (ex. markup ou gross-up) reflete no cálculo do preço final aplicando as regras da engine autoritativa. | `[ ]` |
| **Emissão cria versão final** | A chamada de emissão gera um registro `v1` na tabela `orcamento_final_versoes` e atualiza a demanda para `orcada`. | `[ ]` |
| **Segunda emissão substitui a anterior** | Ao reemitir a proposta, a versão anterior é atualizada para o status `substituido`, e uma nova `v2` torna-se a vigente. | `[ ]` |
| **Falha simulada não deixa estado parcial** | Erro simulado durante a chamada da RPC causa o rollback de toda a escrita (demandas, status e histórico de auditoria intactos). | `[ ]` |
| **Usuário sem papel não emite** | Usuário anônimo ou sem o papel de `coordenador` (ou superior) é barrado no lado do servidor ao tentar disparar a emissão. | `[ ]` |
| **Usuário sem papel não altera parâmetros** | Apenas usuários com papel `gestor` (ou superior) podem salvar parâmetros econômicos globais/projetos. | `[ ]` |
| **Técnico faz apenas operações permitidas** | O técnico estruturador consegue criar orçamentos, cadastrar insumos e itens, mas não consegue revisar status ou emitir. | `[ ]` |
| **Coordenador/Gestor emite** | Usuários coordenador/gestor/admin realizam transições de revisão de módulos e disparam emissões com sucesso. | `[ ]` |
| **Export DOCX/XLSX confere com tela** | Os arquivos baixados contêm a mesma grade de valores de precificação e total consolidado com Gross-Up da aba Proposta Final. | `[ ]` |
| **Histórico preserva versão antiga** | A tabela `orcamento_final_versoes` mantém a integridade do snapshot original e parâmetros aplicados da versão anterior. | `[ ]` |
| **Deep links de etapa funcionam** | A navegação por `/orcamento/demandas/[id]?etapa=final` carrega e focaliza a aba final de forma direta e consistente. | `[ ]` |
| **Mobile não quebra layout** | O stepper do fluxo da proposta e as tabelas de itens quebram de forma responsiva sem gerar overflow horizontal em telas pequenas. | `[ ]` |
| **Preflight seguro** | A automação de detecção de duplicidades roda sem registrar credenciais de banco ou vazar dados de produção nos logs públicos. | `[ ]` |

---

## 3. Validação de Banco de Dados em Homologação (Staging)

Abaixo estão os comandos e scripts de validação de infraestrutura prontos para serem executados no ambiente de Staging.

### Comando para Aplicar Migrations (via Supabase CLI local)
```bash
supabase db push
```

### Comando para Testar Rollback de Migration (Ambiente Local/Descartável)
```bash
# Executa rollback das 3 migrations do RC aplicando seus scripts de rollback
supabase db reset
```

### Consultas SQL de Validação de Homologação

#### 1. Verificar se a RPC de emissão existe no banco de homologação:
```sql
select routine_schema, routine_name, data_type
  from information_schema.routines
 where routine_name = 'emitir_orcamento_final_transacional';
```

#### 2. Verificar os privilégios (Grants) concedidos para a RPC:
```sql
select grantee, privilege_type
  from information_schema.role_routine_grants
 where routine_name = 'emitir_orcamento_final_transacional';
-- Deve retornar apenas 'authenticated' e 'service_role' (anon/public devem ter sido revogados).
```

#### 3. Verificar as políticas de RLS ativas para o módulo de Orçamentos:
```sql
select tablename, policyname, permissive, roles, cmd, qual, with_check
  from pg_policies
 where tablename in (
   'orcamento_final_versoes',
   'orcamento_parametros_aplicados',
   'demanda_analises',
   'demanda_grupos_amostras',
   'eventos_status',
   'orcamento_projeto_anexos',
   'orcamento_projeto_links'
 )
 order by tablename, policyname;
```

#### 4. Consultar a regra de "Uma única versão vigente por demanda":
```sql
-- Verifica se existe alguma demanda com mais de um orçamento final em status 'emitido'
select demanda_id, count(*)
  from orcamento_final_versoes
 where status = 'emitido'
 group by demanda_id
having count(*) > 1;
-- Deve retornar vazio (0 linhas), atestando a integridade da substituição atômica.
```
