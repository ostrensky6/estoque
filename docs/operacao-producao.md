# Kontrol - Operacao de Producao

## App em producao

- App: Kontrol
- URL primaria: https://kontrol-gia.vercel.app
- URL anterior Netlify: https://estoque-gia.netlify.app
- Login administrador: `ostrensky@ufpr.br`
- Papel: `admin`
- Senha do usuario admin: armazenada no Supabase Auth / gerenciador de senhas, nao versionar.

## Codigo

- Repositorio: https://github.com/ostrensky6/estoque
- Conta GitHub: `ostrensky6`
- Branch de producao: `main`
- Fluxo: push em `main` deve gerar deploy automatico quando o projeto estiver conectado ao host de producao.

## Hospedagem - Vercel

- Conta/time: `Ostrensky's projects`
- Escopo CLI/API: `ostrenskys-projects-17ce406b`
- Projeto: `kontrol`
- Dashboard: https://vercel.com/ostrenskys-projects-17ce406b/kontrol
- Framework preset: Next.js
- Build command: padrao Next.js (`npm run build`)
- Output directory: padrao Next.js
- Production URL: https://kontrol-gia.vercel.app
- Variaveis de ambiente configuradas em producao:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

## Hospedagem anterior - Netlify

- URL anterior: https://estoque-gia.netlify.app
- Login Netlify: "Continue with GitHub" como `ostrensky6`
- Time: `Ostrensky's projects`
- Projeto: `estoque-gia`
- Status: substituido pela hospedagem Vercel do projeto `kontrol`.
- Variaveis que estavam configuradas:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SECRETS_SCAN_OMIT_KEYS`

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
- Chave anon/public: configurar como `NEXT_PUBLIC_SUPABASE_ANON_KEY` no host.
- Chave service role: configurar como `SUPABASE_SERVICE_ROLE_KEY` no host. Nunca versionar.
- Senha Postgres: armazenada no gerenciador de senhas. Nunca versionar.

## Observacoes de seguranca

- Nao registrar senha Postgres, senha de usuario ou `service_role` em arquivos versionados.
- Se algum segredo tiver sido colado em chat, issue, commit ou documento, rotacionar no Supabase e atualizar as variaveis do host.
- A conta Supabase correta de producao e `ostrensky6@gmail.com`; nao misturar com a conta dos projetos BioLog/WaiOra.
