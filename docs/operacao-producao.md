# Kontrol - Operacao de Producao

## App em producao

- App: Kontrol
- URL primaria: https://kontrol-lac.vercel.app
- Login administrador: `ostrensky@ufpr.br`
- Papel: `admin`
- Senha do usuario admin: armazenada no Supabase Auth / gerenciador de senhas, nao versionar.

## Codigo

- Repositorio: https://github.com/ostrensky6/estoque
- Conta GitHub: `ostrensky6`
- Branch de producao: `main`
- Fluxo atual: Vercel conectado ao GitHub. Push em `main` dispara deploy de producao no projeto novo.

## Hospedagem - Vercel

- Conta/time: `Gia` (plano Hobby) - conta de acesso `planktonsma@gmail.com`
- Conta Vercel operacional: `planktonsma@gmail.com`
- Projeto: `kontrol`
- Dashboard: https://vercel.com/giaufpr/kontrol
- Framework preset: Next.js (Turbopack, Next 16)
- Build command: padrao Next.js (`npm run build`)
- Output directory: padrao Next.js
- Production URL: https://kontrol-lac.vercel.app
- Deploy: automatico por push em `main`, ou redeploy manual pelo painel da Vercel (`Gia` -> `kontrol` -> `Deployments`).
- Variaveis de ambiente configuradas em producao (Production scope):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `NEXT_PUBLIC_SITE_URL`

### Estado Vercel

- Variaveis de ambiente de producao configuradas no projeto novo.
- Supabase Auth configurado para aceitar a nova URL de producao.
- Producao validada em `https://kontrol-lac.vercel.app/login`.
- Nao usar projetos Vercel antigos para novos deploys.

## Banco de dados - Supabase producao

- Conta: `ostrensky6@gmail.com`
- Projeto: `estoque`
- Project ref: `hhxwdcwphitfxywbgtju`
- Regiao: `sa-east-1`
- API URL: https://hhxwdcwphitfxywbgtju.supabase.co
- Pooler IPv4:
  - Host: `aws-1-sa-east-1.pooler.supabase.com`
  - Porta: `5432`
  - User: `postgres.hhxwdcwphitfxywbgtju`
  - Database: `postgres`
- Chave anon/public: configurar como `NEXT_PUBLIC_SUPABASE_ANON_KEY` no host. Usa o novo formato de chave do Supabase: `sb_publishable_...` (Settings -> API Keys -> Publishable key).
- Chave service role: configurar como `SUPABASE_SERVICE_ROLE_KEY` no host. Usa o novo formato `sb_secret_...` (Settings -> API Keys -> Secret keys). Nunca versionar; rotacionar se exposta.
- Senha Postgres: armazenada no gerenciador de senhas. Nunca versionar.

## Checklist operacional

1. Antes de features que dependam de schema novo, aplicar as migrations pendentes no Supabase producao (`hhxwdcwphitfxywbgtju`).
2. No projeto Vercel (`Gia` -> `kontrol`), manter configurado:
   - `NEXT_PUBLIC_SUPABASE_URL=https://hhxwdcwphitfxywbgtju.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key do Supabase>`
   - `SUPABASE_SERVICE_ROLE_KEY=<secret/service role key do Supabase>`
   - `NEXT_PUBLIC_SITE_URL=https://kontrol-lac.vercel.app`
3. No Supabase Auth, manter Site URL/Redirect URLs para `https://kontrol-lac.vercel.app`.
4. Para publicar, fazer push na branch `main` ou redeploy manual na Vercel.
5. Validar login, `/pedido`, detalhe de pedido com Etapa 11 e `/recebimento`.

## Observacoes de seguranca

- Nao registrar senha Postgres, senha de usuario ou `service_role` em arquivos versionados.
- Se algum segredo tiver sido colado em chat, issue, commit ou documento, rotacionar no Supabase e atualizar as variaveis do host.
- A conta Supabase correta de producao e `ostrensky6@gmail.com`; nao misturar com a conta dos projetos BioLog/WaiOra.
