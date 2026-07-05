# Hardening tecnico seguro - 2026-07-04

## Escopo

Hardening tecnico seguro do Kontrol, sem deploy e sem alteracoes de producao,
banco, migrations, Supabase, Vercel, variaveis de ambiente de producao,
autenticacao ou regras de negocio.

## Baseline inicial

- Branch inicial: `main`
- HEAD inicial: `a9156921315594182fd958baf6996346ff199390`
- Ultimo commit inicial: `a9156921 test(e2e): alinha catalogo de analises ao seletor`
- Branch de trabalho criada: `hardening/qualidade-seguranca-julho-2026`
- Node: `v20.19.4`
- npm: `10.8.2`

## Checks de baseline

- `npm run lint`: passou com 0 erros e 1 warning em `src/app/orcamento/final/[id]/page.tsx` por uso de `<img>`.
- `npm run test`: passou, 52 arquivos e 261 testes.
- `npm run build`: passou, build Next.js 16.2.9/Turbopack concluido.
- `npx playwright test`: passou, 23 testes e2e.
- `npm audit --audit-level=moderate`: encontrou 4 vulnerabilidades moderadas.

## Vulnerabilidades encontradas

### `postcss` via `next`

- Cadeia: `next@16.2.9 -> postcss@8.4.31`
- Vulnerabilidade: XSS via CSS stringify com `</style>` nao escapado.
- Severidade: moderada.
- `npm audit` sugere apenas `npm audit fix --force`, que instalaria
  `next@9.3.3`, uma mudanca quebradora e insegura para este app.
- Investigacao: `next@16.2.10` e `next@latest` ainda dependem de
  `postcss@8.4.31`.
- Decisao: risco aceito temporariamente. Nao corrigido nesta rodada por nao
  haver atualizacao segura sem downgrade/force.
- Recomendacao futura: monitorar novo patch do Next que atualize o PostCSS
  interno para `>=8.5.10` e aplicar em branch propria com leitura previa dos
  docs locais do Next 16 e suite completa.

### `uuid` via `exceljs`

- Cadeia: `exceljs@4.4.0 -> uuid@8.3.2`
- Vulnerabilidade: falta de bounds check em uso de `uuid` v3/v5/v6 quando
  `buf` e fornecido.
- Severidade: moderada.
- `npm audit` sugere apenas `npm audit fix --force`, que instalaria
  `exceljs@3.4.0`, uma mudanca quebradora/downgrade.
- Investigacao: `exceljs@latest` e `exceljs@4.4.0` dependem de `uuid@^8.3.0`.
- Decisao: risco aceito temporariamente. Nao corrigido nesta rodada por nao
  haver atualizacao segura sem downgrade/force.
- Recomendacao futura: monitorar nova versao do ExcelJS que remova a cadeia
  vulneravel ou avaliar substituicao controlada da biblioteca de XLSX em
  projeto separado, validando exportacoes de cadastros e orcamentos.

## Alteracoes seguras realizadas

- Documentado procedimento de recuperacao de ambiente local corrompido em
  `docs/operacao-producao.md`.
- Mantido `<img>` no logo da proposta final por participar da area
  `.print-area` e da renderizacao imprimivel/PDF. Foi adicionada excecao ESLint
  pontual e justificada no menor escopo possivel.

## Validacao final

- Branch final: `hardening/qualidade-seguranca-julho-2026`
- HEAD final: `a9156921315594182fd958baf6996346ff199390`
- `npm run lint`: passou sem erros e sem warnings.
- `npm run test`: passou, 52 arquivos e 261 testes.
- `npm run build`: passou, build Next.js 16.2.9/Turbopack concluido.
- `npx playwright test e2e/orcamento-pdf.spec.ts`: passou, 1 teste.
- `npx playwright test`: passou, 23 testes e2e.
- `npm audit --audit-level=moderate`: executado; permanece com 4
  vulnerabilidades moderadas aceitas temporariamente por nao haver correcao
  segura sem `--force`/downgrade quebrador.

Observacao operacional: uma primeira execucao de
`npx playwright test e2e/orcamento-pdf.spec.ts` foi iniciada em paralelo ao
build e falhou porque `.next` ainda nao existia. Apos o build, o mesmo comando
foi reexecutado e passou.

## Observabilidade minima - proposta tecnica

Implementacao de Sentry/PostHog exige chaves externas e deve ser feita em etapa
separada. Para manter seguranca, os eventos recomendados sao:

- erro de server action;
- falha de emissao;
- falha de exportacao;
- falha de login sem senha ou sem token;
- geracao de orcamento;
- recebimento de lote;
- criacao ou aprovacao de compra.

Nunca registrar:

- senha;
- tokens;
- `service_role`;
- `DATABASE_URL`;
- payload bruto de orcamento;
- dados sensiveis completos de cliente.

Variaveis opcionais sugeridas para etapa futura, sempre com placeholders e build
funcionando sem elas:

```env
SENTRY_DSN=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=
```

## Checklist manual de producao/staging

Executar manualmente antes de promover qualquer alteracao futura para producao:

- login;
- dashboard;
- orcamento/demandas;
- orcamento final/PDF;
- estoque;
- compras;
- usuarios;
- auditoria;
- governanca/backups.

## Declaracao de nao alteracao

Nesta rodada nao foram alterados banco, migrations, Supabase, Vercel, variaveis
de ambiente de producao, autenticacao, regras de negocio, deploy ou push.
