# Kontrol - Operacao de Producao

## App em producao

- App: Kontrol
- URL primaria/canonica: https://kontrol-atgc.vercel.app
- Login administrador: `ostrensky@ufpr.br`
- Papel: `admin`
- Senha do usuario admin: armazenada no Supabase Auth / gerenciador de senhas, nao versionar.
- Autenticacao: o app protege as rotas por Supabase Auth e redireciona acessos nao autenticados para `/login`.

## Codigo

- Repositorio: https://github.com/ostrensky6/estoque
- Conta GitHub: `ostrensky6`
- Branch de producao: `main`
- Fluxo atual: deploy automatico pela integracao GitHub/Vercel do projeto `kontrol` na branch `main`.
- Antes de publicar, rode `npm run prod:check`.

## Hospedagem - Vercel

- Conta/time: `Gia`
- Team ID: `team_N5uHkBDu4hLjI9Yx2gmtpg4L`
- Scope: `giaufpr`
- Projeto oficial: `kontrol`
- Project ID: `prj_3l6QuGqsG63Lna4pTZ5Di1vV8RZc`
- Dashboard: https://vercel.com/giaufpr/kontrol
- Framework preset: Next.js (Turbopack, Next 16)
- Build command: padrao Next.js (`npm run build`)
- Output directory: padrao Next.js
- Production URL canonica: https://kontrol-atgc.vercel.app
- Dominio alternativo validado: https://kontrol-lac.vercel.app
- Commit validado em producao: `aa1e470d771b111420f124ec29f016455f1522e5`
- Redeploy production validado: `dpl_7HcBoiUdAG2JHCrGF7ycj1SM2z5V`
- Deploy: preferir merge/push em `main` para acionar a integracao GitHub/Vercel. Deploy manual pela CLI/API deve ser excecao controlada, com `VERCEL_TOKEN` definido no ambiente e sem colar tokens em chat/logs.
- Se o Node local falhar com erro de certificado do proxy, configure `NODE_EXTRA_CA_CERTS` para a cadeia corporativa/local. Evite `NODE_TLS_REJECT_UNAUTHORIZED=0`, salvo diagnostico pontual.
- Variaveis de ambiente configuradas e verificadas em producao (Production scope):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`/`POSTGRES_URL` nao sao obrigatorias no Vercel: o runtime Next.js usa Supabase HTTP/SSR e nao faz conexao PostgreSQL direta. Essas variaveis aparecem apenas em scripts operacionais/preflight/backup fora do runtime.

### Estado Vercel

- Variaveis de ambiente de producao configuradas no projeto `kontrol`.
- Supabase Auth deve manter Site URL/Redirect URLs para `https://kontrol-atgc.vercel.app`.
- Producao validada em `https://kontrol-atgc.vercel.app/login`.

## Banco de dados - Supabase producao

- Conta: `ostrensky6@gmail.com`
- Projeto: `estoque`
- Project ref: `gkcjzwfsnoknxgpsumxi`
- Regiao: `sa-east-1`
- API URL: https://gkcjzwfsnoknxgpsumxi.supabase.co
- Pooler IPv4:
  - Host: `aws-1-sa-east-1.pooler.supabase.com`
  - Porta: `5432`
  - User: `postgres.gkcjzwfsnoknxgpsumxi`
  - Database: `postgres`
- Chave anon/public: configurar como `NEXT_PUBLIC_SUPABASE_ANON_KEY` no host. Pode usar o formato novo `sb_publishable_...` (Settings -> API Keys -> Publishable key) ou o legacy anon JWT.
- Chave service/secret: configurar como `SUPABASE_SERVICE_ROLE_KEY` no host. Pode usar o formato novo `sb_secret_...` (Settings -> API Keys -> Secret keys) ou o legacy service_role JWT.
- Status CLI esperado: linkado com `supabase link --project-ref gkcjzwfsnoknxgpsumxi`.
- Historico de migrations em producao: conferir sempre com `supabase migration list --linked` antes de qualquer operacao; nao assumir um intervalo fixo a partir da documentacao.
- Senha Postgres: armazenada no gerenciador de senhas. Nunca versionar.

Nota operacional (2026-07-04): `gkcjzwfsnoknxgpsumxi` e o Supabase atual
de producao do Kontrol no projeto Vercel `kontrol`.

### LEGADO / NAO USAR

- Project ref legado: `hhxwdcwphitfxywbgtju`
- API URL legada: https://hhxwdcwphitfxywbgtju.supabase.co
- Pooler user legado: `postgres.hhxwdcwphitfxywbgtju`
- Nao usar como producao, default, alvo esperado, homologacao ou exemplo ativo.

## Checklist operacional

1. Rode `npm run prod:check` antes de deploy ou `supabase db push`; ele bloqueia projeto Vercel errado, Supabase linkado no ref errado e migrations com prefixo duplicado.
2. Antes de features que dependam de schema novo, aplicar as migrations pendentes no Supabase producao (`gkcjzwfsnoknxgpsumxi`) somente depois de revisar `supabase migration list --linked`.
3. No projeto Vercel (`kontrol`), manter configurado:
   - `NEXT_PUBLIC_SUPABASE_URL=https://gkcjzwfsnoknxgpsumxi.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key do Supabase>`
   - `SUPABASE_SERVICE_ROLE_KEY=<secret/service role key do Supabase>`
4. No Supabase Auth, manter Site URL/Redirect URLs para `https://kontrol-atgc.vercel.app`.
5. Para publicar, usar o fluxo GitHub/Vercel em `main`; `npm run prod:deploy` e API Vercel ficam para excecoes controladas.
6. Validar login admin, `/`, `/analises`, `/orcamento`, `/orcamento/demandas`, `/estoque`, `/compras`, `/governanca/privilegios`, `/usuarios`, `/auditoria` e `/governanca/backups`.

## Observacoes de seguranca

- Nao registrar senha Postgres, senha de usuario ou `service_role` em arquivos versionados.
- Se algum segredo tiver sido colado em chat, issue, commit ou documento, rotacionar no Supabase e atualizar as variaveis do host.
- A conta Supabase correta de producao e `ostrensky6@gmail.com`; nao misturar com a conta dos projetos BioLog/WaiOra.
