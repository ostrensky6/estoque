# Ambiente oficial do Kontrol

Este repositório local oficial fica em `D:\Aplicativos\Kontrol`.

## Identidade

- App: Kontrol
- Produção: https://kontrol-gia.vercel.app
- Admin: `ostrensky@ufpr.br`
- Papel do admin: `admin`

## GitHub

- Conta: `ostrensky6`
- Repositório: `ostrensky6/estoque`
- Origin: `https://github.com/ostrensky6/estoque.git`
- Branch alvo de produção: `main`
- Baseline estável usado para reconstrução limpa: commit `c0bcddc`

Observação: a pasta antiga `D:\Aplicativos\Estoque` está depreciada e não deve receber commits novos.

## Vercel

- Projeto: `kontrol-gia`
- Project ID: `prj_EnHPskP6CjuCv8UCzC6iXjQpcwQi`
- Scope: `ostrensky-s-projects`
- Team ID: `team_HYxJGUZ1QLz2P0H2U4l9Ayn8`
- Dashboard: https://vercel.com/ostrensky-s-projects/kontrol-gia
- URL de produção: https://kontrol-gia.vercel.app
- Domínio default: https://kontrol-gia-nine.vercel.app

Não usar o slug antigo `ostrenskys-projects-17ce406b`.

## Supabase

- Projeto: `estoque`
- Project ref: `hhxwdcwphitfxywbgtju`
- Região: `sa-east-1`
- API URL: https://hhxwdcwphitfxywbgtju.supabase.co
- Dashboard: https://supabase.com/dashboard/project/hhxwdcwphitfxywbgtju
- Pooler host: `aws-1-sa-east-1.pooler.supabase.com`
- Pooler port: `5432`
- Pooler user: `postgres.hhxwdcwphitfxywbgtju`
- Database: `postgres`

## Segurança

Não registrar em arquivos versionados:

- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_AUTH_ADMIN_KEY`
- `DATABASE_URL`
- `POSTGRES_URL`
- Senhas do banco

Para testes puramente front-end, usar o modo mock/e2e ou apenas `NEXT_PUBLIC_*`.
