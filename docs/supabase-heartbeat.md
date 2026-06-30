# Rotina de Manutenção Operacional: Supabase Heartbeat via Vercel Cron

Este documento registra a especificação, estrutura e operação da rotina técnica implementada para evitar a inatividade e consequente pausa do banco de dados do Supabase Free.

---

## Objetivo

Para projetos Supabase no plano gratuito, após uma semana sem atividade/conexões ativas, o projeto é pausado. Para garantir que o ambiente permaneça ativo e disponível, esta rotina técnica executa uma pequena operação real de escrita e leitura de forma periódica e automatizada, servindo também como auditoria da integridade do backend.

---

## Estrutura de Banco de Dados

Foi adicionada uma tabela dedicada para esta finalidade, com as seguintes propriedades:

- **Nome**: `public.system_heartbeat`
- **Segurança (RLS)**: Habilitado.
- **Permissões**:
  - `anon` e `authenticated` têm todo o acesso revogado por padrão (`revoke all`).
  - Apenas o papel administrativo `service_role` (backend seguro) tem permissão de leitura e escrita (`grant all`).

### Estrutura da Tabela (`public.system_heartbeat`)

```sql
create table if not exists public.system_heartbeat (
  id text primary key,
  app text not null,
  updated_at timestamptz not null default now(),
  environment text,
  deployment_url text,
  status text not null default 'ok',
  details jsonb not null default '{}'::jsonb
);
```

### Registro Inicial

A tabela é inicializada de forma idempotente com o seguinte registro de controle:
- `id`: `'kontrol-prod'`
- `app`: `'Kontrol'`
- `status`: `'ok'`

---

## Endpoint do Cron (`/api/cron/supabase-heartbeat`)

- **Caminho**: `src/app/api/cron/supabase-heartbeat/route.ts`
- **Operação**:
  - Aceita apenas requisições `GET`.
  - Exige autenticação por Bearer Token via cabeçalho `Authorization: Bearer ${CRON_SECRET}`.
  - Se a chave estiver ausente ou incorreta, retorna `401 Unauthorized`.
  - Executa um `upsert` no registro com ID `'kontrol-prod'`, atualizando o campo `updated_at`, o ambiente, a URL de deployment e os detalhes da execução.

---

## Configuração do Cron na Vercel

A automação é disparada através do **Vercel Cron**.
O arquivo de configuração `vercel.json` na raiz define a execução periódica:

- **Frequência**: 2 vezes por semana (segunda e quinta-feira, às 10:00 UTC).
- **Configuração (`vercel.json`)**:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/cron/supabase-heartbeat",
      "schedule": "0 10 * * 1,4"
    }
  ]
}
```

---

## Variáveis de Ambiente Necessárias

No painel de controle do projeto na Vercel, as seguintes variáveis devem estar configuradas no ambiente de Produção:

1. `CRON_SECRET`: Chave secreta de autenticação gerada pela Vercel ou configurada manualmente. Deve ser mantida em sigilo.
2. `NEXT_PUBLIC_SUPABASE_URL`: A URL da API do projeto Supabase.
3. `SUPABASE_SERVICE_ROLE_KEY`: Chave de bypass RLS que permite ao endpoint atualizar a tabela no banco de dados. **Esta chave nunca deve ser exposta no frontend.**

---

## Auditoria e Auditoria de Segurança

1. **Acesso Externo**: Tentativas de acesso pelo navegador ou por terceiros sem a chave `CRON_SECRET` resultam em código `401 Unauthorized`.
2. **Uso de Chaves**: A chave `SUPABASE_SERVICE_ROLE_KEY` é usada apenas no servidor através do endpoint dinâmico do Next.js. Nenhum componente React ou frontend tem acesso a ela.
3. **Sem Efeitos Colaterais**: A rotina manipula exclusivamente a tabela `public.system_heartbeat`. Nenhuma tabela de negócio (estoque, compras, orçamentos) é afetada por essa manutenção.
