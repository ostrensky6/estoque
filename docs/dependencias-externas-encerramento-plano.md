# Dependências externas para encerrar o plano operacional

Este registro separa trabalho ainda executável no repositório de condições que
dependem de ambiente, credenciais ou pessoas autorizadas. Não é autorização
para alterar ambientes remotos.

## Homologação e produção

| Dependência | Por que é externa | Evidência necessária para encerrar |
|---|---|---|
| Ambiente Supabase de homologação formalmente identificado | A documentação existente proíbe usar refs legados ou não confirmados; a escolha do ambiente exige autoridade operacional | Ref, URL e responsável de homologação confirmados; backup lógico registrado |
| Execução do roteiro funcional por papéis reais | Depende de usuários e dados de teste no ambiente homologado | Matriz preenchida de `docs/homologacao-fluxo-operacional-20260711.md` |
| Promoção/produção | Exige responsável com permissão de deploy e confirmação de janela | `npm run prod:check` aprovado contra alvo oficial e evidência de release |

## Alertas e observabilidade

| Dependência | Por que é externa | Evidência necessária para encerrar |
|---|---|---|
| Destinatários reais e domínio de e-mail | O código não deve inventar destinatários ou disparar e-mail para terceiros | Lista de papéis/destinatários e domínio aprovados |
| Credenciais de provedor de e-mail | Segredo operacional não deve ser criado nem exposto no repositório | Secret configurado no ambiente de homologação e teste de entrega controlado |
| DSN/conta de observabilidade | Sentry/PostHog dependem de conta e governança de dados | DSN/keys fornecidos e política de retenção aprovada |

## Gates locais

- Em 2026-07-18, `supabase db reset --no-seed` aplicou as 98 migrations em banco local limpo e `supabase db lint --local --level warning` terminou sem erros de schema.
- Em 2026-07-18, `npm run typecheck`, `npm run lint`, a suíte com 294 testes unitários e o build de produção passaram.
- A rota `/cadastros/qualidade` foi adicionada ao gate de acessibilidade E2E.
- Em 2026-07-18, a suíte Playwright contra o build de produção passou com 24/24 cenários; os 12 cenários de acessibilidade AA incluem `/cadastros/qualidade`.
- O modo explícito `E2E_REUSE_SERVER=1` permanece disponível para testes locais de leitura que precisem reutilizar um servidor existente.

## Regra de encerramento

O plano de código pode ser considerado implementado quando os gates locais e
de CI estiverem verdes. A homologação e a produção só podem ser consideradas
concluídas após as evidências externas acima; até lá, não executar mutações
remotas nem alegar aprovação de ambiente.
