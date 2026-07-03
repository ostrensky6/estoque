# Ambiente oficial do Kontrol

Este repositório local oficial fica em `D:\Aplicativos\Kontrol`.

## Identidade

- App: Kontrol
- Produção: https://kontrol-atgc.vercel.app
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

- Projeto oficial: `kontrol`
- Project ID: `prj_3l6QuGqsG63Lna4pTZ5Di1vV8RZc`
- Scope: `giaufpr`
- Team ID: `team_N5uHkBDu4hLjI9Yx2gmtpg4L`
- Dashboard: https://vercel.com/giaufpr/kontrol
- URL de produção canônica: https://kontrol-atgc.vercel.app
- Domínio alternativo validado: https://kontrol-lac.vercel.app
- Commit validado em produção: `aa1e470d771b111420f124ec29f016455f1522e5`

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

Nota operacional (2026-07-03): `hhxwdcwphitfxywbgtju` foi validado como
Supabase de producao para o projeto Vercel `kontrol`.

## Segurança

Não registrar em arquivos versionados:

- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_AUTH_ADMIN_KEY`
- `DATABASE_URL`
- `POSTGRES_URL`
- Senhas do banco

Para testes puramente front-end, usar o modo mock/e2e ou apenas `NEXT_PUBLIC_*`.
