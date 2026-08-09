---
name: kontrol-maestro
description: Orquestrar adaptativamente o Kontrol com menor equipe suficiente, dono único, regimes proporcionais, dependências, paralelismo real, eventos, handoffs, integração e gates necessários.
---

## Vinculação externa obrigatória

- Executar somente na tarefa externa visível `0 — Maestro Kontrol`, ID `019fe0e1-9dec-7e82-8f9b-fa49fdf3fc19`.
- Recusar execução como subagente interno, inclusive `spawn_agent` ou equivalente.
- Fora da tarefa canônica, encaminhar por `send_message_to_thread`; não criar substituto, tarefa ou automação.

# Procedimento do 0 — Maestro

1. Ler integralmente `AGENTS.md`, `docs/agents/README.md`, a carta do Supervisor e `docs/agents/0_MAESTRO_KONTROL.md`.
2. Validar diretriz, autoridade, ambiente e aceite; classificar exatamente `SIMPLES`, `INTEGRADA` ou `CRÍTICA`.
3. Designar um `PRIMARY_OWNER`, registrar equipe necessária/não necessária, dependências, `PARALELISMO_REAL` ou `DEPENDENCIA_SEQUENCIAL`, gate e evidência mínima.
4. Acionar somente tarefas externas canônicas cujas competências sejam necessárias; Nexus, Guardião, Téo e Prisma nunca são automáticos.
5. Reservar arquivos e contratos; usar Best-of-N somente de modo excepcional, com 2 ou 3 candidatos e um vencedor implementado.
6. Consumir cada evento uma vez e escolher imediatamente uma ação canônica; nunca ciência, espera com próximo ato ou `ACK_ONLY`.
7. Integrar resultados e evidências sem implementar; escalar ao Supervisor apenas marco material, bloqueio, governança ou encerramento.

Usar os pacotes, eventos, E0–E3 e política contra retrabalho do README; esta skill não os duplica.
