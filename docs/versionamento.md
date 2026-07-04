# Versionamento do app

A versao exibida na UI do Kontrol tem fonte unica em `src/config/app.ts`, na constante `APP_VERSION`.

Antes de preparar um commit de producao:

1. Execute `npm run version:bump`.
2. Confira se `src/config/app.ts` foi atualizado.
3. Rode `npm run version:check -- origin/main` para validar que a versao do PR e maior que a versao da branch base.
4. Rode `npm run lint`, `npm run build` e `npm run test`.

O script `npm run version:check` pode ser usado no CI. Por padrao ele compara contra `origin/main`, mas tambem aceita uma ref explicita:

```bash
npm run version:check -- origin/main
```

Em CI, tambem e possivel configurar `APP_VERSION_BASE_REF`:

```bash
APP_VERSION_BASE_REF=origin/main npm run version:check
```

Nao inclua bump automatico no build ou no deploy da Vercel. O incremento deve ser uma alteracao revisavel no PR.
