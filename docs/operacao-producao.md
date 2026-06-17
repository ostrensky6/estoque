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
- Fluxo atual: deploy MANUAL via Vercel CLI (`vercel --prod`). A conexao Vercel<->GitHub NAO esta configurada (no dashboard aparece "Connect Git Repository"), entao push em `main` NAO dispara deploy automatico ainda.

## Hospedagem - Vercel

- Conta/time: `Ostrensky's projects` (plano Hobby) - conta de acesso `ostrensky5@gmail.com`
- Escopo CLI/API (slug): `ostrensky-s-projects`
- Org/Team ID: `team_HYxJGUZ1QLz2P0H2U4l9Ayn8`
- Projeto: `kontrol-gia` (Project ID `prj_EnHPskP6CjuCv8UCzC6iXjQpcwQi`)
- Dashboard: https://vercel.com/ostrensky-s-projects/kontrol-gia
- Framework preset: Next.js (Turbopack, Next 16)
- Build command: padrao Next.js (`npm run build`)
- Output directory: padrao Next.js
- Production URL: https://kontrol-gia.vercel.app (alias ativo; dominio default do projeto = `kontrol-gia-nine.vercel.app`)
- Deploy: `vercel --prod --yes --token <TOKEN> --scope ostrensky-s-projects`, com `NODE_EXTRA_CA_CERTS` apontando para o PEM dos root CAs do Windows (proxy/cert local quebra o TLS do Node 20). Login interativo trava no shell -> usar `--token`.
- Variaveis de ambiente configuradas em producao (Production scope):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

### Pendencias Vercel

- ⚠️ "Vercel Authentication" (Deployment Protection) esta LIGADA -> a URL publica retorna HTTP 401 (pagina "Authentication Required"). Precisa ser desligada em Project -> Settings -> Deployment Protection para o app ficar acessivel ao publico (a auth propria do Kontrol assume o controle de acesso).
- Conectar o repo GitHub `ostrensky6/estoque` ao projeto para habilitar auto-deploy em `main`.
- ⚠️ Historico: em 2026-06-17 a producao foi migrada de uma conta Vercel antiga (`ostrensky2`, que tinha o projeto `kontrol` no time `team_3VzNcrJwgnFwqLL9JzMmcFs8`). Essa conta/projeto foi APAGADA pelo usuario, liberando o dominio `kontrol-gia.vercel.app`. Nao confundir o `kontrol` antigo (extinto) com o `kontrol-gia` atual.

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

## Observacoes de seguranca

- Nao registrar senha Postgres, senha de usuario ou `service_role` em arquivos versionados.
- Se algum segredo tiver sido colado em chat, issue, commit ou documento, rotacionar no Supabase e atualizar as variaveis do host.
- A conta Supabase correta de producao e `ostrensky6@gmail.com`; nao misturar com a conta dos projetos BioLog/WaiOra.
