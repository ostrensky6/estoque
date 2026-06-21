# Resíduo técnico — hydration mismatch `caret-color: transparent`

Data: 2026-06-21
Status: investigado, root cause identificada, fix proposto (não aplicado).

## Sintoma

Ao rodar o e2e (`e2e/orcamento-parametros.spec.ts`) o dev server emite aviso de
hidratação:

```
A tree hydrated but some attributes of the server rendered HTML didn't match the
client properties. ... It can also happen if the client has a browser extension
installed which messes with the HTML before React loaded.
```

O diff aponta `style={{caret-color:"transparent"}}` em `<input>` do formulário da
demanda (`titulo`, `cliente_nome`, `cliente_cnpj`, `cliente_contato`, ...).

Não quebra teste nem build. É ruído de console em dev.

## Root cause

`caret-color` NÃO existe no código-fonte (`grep -rin caret src/` → nenhum match).
O estilo é **injetado em runtime por um form-filler / gerenciador de senha** nos
campos **antes** da hidratação do React, exatamente o cenário que o próprio time
já documentou em `src/components/ui/input.tsx`:

```ts
// Evita que gerenciadores de senha (LastPass/1Password/Dashlane) injetem
// ícones nos campos antes da hidratação, o que gera mismatch SSR↔cliente.
data-lpignore="true"
data-1p-ignore=""
data-form-type="other"
```

O componente compartilhado `Input` já tem esses guards. Os formulários que usam
`<input className={inp}>` **cru** (demanda, e demais páginas com `const inp`) NÃO
têm — por isso só esses campos sofrem o mismatch.

A mudança recente de cor (§8.2) NÃO causa isso: a `className` casa SSR↔cliente; só
o `style` injetado externamente diverge.

## Fix proposto (quando virar prioridade)

Opção A (preferida, alinhada ao padrão do time): rotear os inputs crus pelo
componente guardado `@/components/ui/input` (`Input`), que já traz
`data-lpignore`/`data-1p-ignore`/`data-form-type`.

Opção B (mínima, por campo): adicionar os mesmos `data-*` guards aos `<input>`
crus dos formulários (demanda primeiro, depois compras/planejamento/análises).

Opção C (band-aid React): `suppressHydrationWarning` nos inputs afetados — apenas
silencia o aviso, não impede a injeção visual; usar só se A/B forem custosos.

## Verificação do fix

Reaplicar e rodar `npx playwright test e2e/orcamento-parametros.spec.ts` e
confirmar que `.next/dev/logs/next-development.log` não contém mais o erro de
hidratação com `caret-color` para os inputs corrigidos.
