# Kontrol - Operacao de Producao

## App em producao

- App: Kontrol
- URL primaria: https://kontrol-gia.vercel.app
- Login administrador: `ostrensky@ufpr.br`
- Papel: `admin`
- Senha do usuario admin: armazenada no Supabase Auth / gerenciador de senhas, nao versionar.

## Codigo

- Repositorio: https://github.com/ostrensky6/estoque
- Conta GitHub: `ostrensky6`
- Branch de producao: `main`
- Fluxo atual: deploy manual pela Vercel CLI. O projeto ainda nao esta conectado ao GitHub para auto-deploy em `main`.

## Hospedagem - Vercel

- Conta/time: `Ostrensky's projects` (plano Hobby) - slug `ostrensky-s-projects`
- Org ID: `team_HYxJGUZ1QLz2P0H2U4l9Ayn8`
- Conta Vercel operacional: `ostrensky5@gmail.com`
- Projeto: `kontrol-gia`
- Project ID: `prj_EnHPskP6CjuCv8UCzC6iXjQpcwQi`
- Dashboard: https://vercel.com/ostrensky-s-projects/kontrol-gia
- Framework preset: Next.js (Turbopack, Next 16)
- Build command: padrao Next.js (`npm run build`)
- Output directory: padrao Next.js
- Production URL: https://kontrol-gia.vercel.app
- Dominio default do projeto: https://kontrol-gia-nine.vercel.app
- Deploy: manual via CLI com `vercel --prod --token <TOKEN> --scope ostrensky-s-projects`.
- Variaveis de ambiente configuradas em producao (Production scope):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_AUTH_ADMIN_KEY`
  - `NEXT_PUBLIC_SITE_URL`

### Estado Vercel

- Variaveis de ambiente de producao configuradas no projeto novo.
- Supabase Auth configurado para aceitar a nova URL de producao.
- Producao validada em `https://kontrol-gia.vercel.app/login`.
- Acesso publico bloqueado enquanto a Vercel Authentication estiver ligada em Deployment Protection.
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
- Chave anon/public: configurar como `NEXT_PUBLIC_SUPABASE_ANON_KEY` no host. Pode usar o formato novo `sb_publishable_...` (Settings -> API Keys -> Publishable key) ou o legacy anon JWT.
- Chave service/secret: configurar como `SUPABASE_SERVICE_ROLE_KEY` no host. Pode usar o formato novo `sb_secret_...` (Settings -> API Keys -> Secret keys) ou o legacy service_role JWT.
- Chave Auth Admin: configurar `SUPABASE_AUTH_ADMIN_KEY` com a chave legacy `service_role` JWT (Legacy API Keys). As operacoes de criar, suspender, excluir e resetar senha de usuarios usam Supabase Auth Admin e ainda precisam de JWT nesse fluxo.
- Senha Postgres: armazenada no gerenciador de senhas. Nunca versionar.

## Checklist operacional

1. Antes de features que dependam de schema novo, aplicar as migrations pendentes no Supabase producao (`hhxwdcwphitfxywbgtju`).
2. No projeto Vercel (`Gia` -> `kontrol`), manter configurado:
   - `NEXT_PUBLIC_SUPABASE_URL=https://hhxwdcwphitfxywbgtju.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key do Supabase>`
   - `SUPABASE_SERVICE_ROLE_KEY=<secret/service role key do Supabase>`
   - `SUPABASE_AUTH_ADMIN_KEY=<legacy service_role JWT do Supabase>`
   - `NEXT_PUBLIC_SITE_URL=https://kontrol-gia.vercel.app`
3. No Supabase Auth, manter Site URL/Redirect URLs para `https://kontrol-gia.vercel.app`.
4. Para publicar, usar deploy manual pela Vercel CLI no escopo `ostrensky-s-projects`.
5. Validar login, `/pedido`, detalhe de pedido com Etapa 11 e `/recebimento`.

## Observacoes de seguranca

- Nao registrar senha Postgres, senha de usuario ou `service_role` em arquivos versionados.
- Se algum segredo tiver sido colado em chat, issue, commit ou documento, rotacionar no Supabase e atualizar as variaveis do host.
- A conta Supabase correta de producao e `ostrensky6@gmail.com`; nao misturar com a conta dos projetos BioLog/WaiOra.
