# Módulo "Configurações" em Governança — painel de Backups

Data: 2026-06-20
Autor: brainstorming (Kontrol)

## Contexto

O app Kontrol já possui um painel de backups funcional em
`/governanca/backups`, acessível apenas a administradores, com:

- **Backup do aplicativo (manual):** zipa a versão localhost para
  `D:\Dropbox\Aplicativos\Kontrol\APP`, mantendo as 5 últimas versões.
- **Backup do banco da nuvem (automático):** `pg_dump` para
  `D:\Dropbox\Aplicativos\Kontrol\BD`, agendado pelo Agendador de Tarefas
  do Windows.

A solicitação atual é reorganizar isso sob um módulo **"Configurações"** em
Governança e ajustar a regra de retenção do banco. Trata-se de um
**restruturação + ajuste de retenção**, não de uma construção do zero.

## Decisões do usuário

1. **Estrutura:** renomear o módulo "Backups" para **"Configurações"**, que
   contém o painel de backups (mudança estrutural mínima).
2. **Horários do banco:** **manter os atuais (00:30 e 12:30)** — sem
   alteração de agendamento.
3. **Retenção do banco:** aplicar a regra mensal nova.

## Escopo da mudança

### 1. Navegação e rota

- `src/config/navigation.ts`: o link admin "Backups" passa a ser
  **"Configurações"**, ícone `Settings`, descrição
  "backups e parâmetros do sistema", `href` → `/governanca/configuracoes`.
- Mover a rota `src/app/governanca/backups/` → `src/app/governanca/configuracoes/`.
- A página passa a se chamar **"Configurações"**; o conteúdo atual (os dois
  cards + tabelas de versões/dumps) vira um **painel "Backups"** dentro dela,
  deixando o módulo pronto para futuras seções de configuração.

### 2. Backup do aplicativo

Sem mudança. Permanece manual, 5 versões, em `...\Kontrol\APP`
(`scripts/backup-app-local.ps1`, `executarBackupAplicativo`).

### 3. Agendamento do banco

Sem mudança. Permanece em **00:30 e 12:30**
(`scripts/install-windows-backup-tasks.ps1`). O texto da página que cita os
horários é mantido coerente com esses horários.

### 4. Retenção do banco (única mudança de regra)

Em `scripts/backup-database-cloud.ps1`, substituir a janela móvel de 30 dias
pela **limpeza mensal**:

- A cada execução, percorrer os dumps `kontrol-db-cloud-*.dump`.
- Apagar qualquer dump cujo **mês/ano seja anterior ao mês corrente** E cujo
  **dia não seja 1 nem 15**.
- Preservar para sempre os dumps dos dias **1 e 15** de qualquer mês.
- Não tocar em nada do **mês corrente**.

Comportamento resultante: ao virar o mês, na primeira execução do dia 1 os
backups do mês anterior são apagados (exceto dias 1 e 15). Idempotente e
seguro para rodar 2×/dia.

Atualizar o texto de "Retenção" no card do banco para refletir a nova regra
(ex.: "Mês anterior é apagado ao virar o mês; dias 1 e 15 preservados").

## Componentes afetados

| Arquivo | Mudança |
|---|---|
| `src/config/navigation.ts` | Link admin: "Backups" → "Configurações", href, ícone, desc |
| `src/app/governanca/backups/page.tsx` → `.../configuracoes/page.tsx` | Mover; título "Configurações"; backups como painel; texto de retenção/horário |
| `src/components/governanca/BackupAplicativoButton.tsx` | Sem mudança funcional (eventual ajuste de import path se necessário) |
| `src/lib/actions/backups.ts` | `revalidatePath` aponta para a nova rota `/governanca/configuracoes` |
| `scripts/backup-database-cloud.ps1` | Lógica de retenção: janela 30d → limpeza mensal |
| `scripts/backup-app-local.ps1` | Sem mudança |
| `scripts/install-windows-backup-tasks.ps1` | Sem mudança (horários mantidos) |

## Tratamento de erros

Mantém o comportamento atual: `obterResumoBackups` retorna `null` para
não-admin (página mostra "acesso restrito"); `executarBackupAplicativo`
retorna `{ ok, message }` e a UI exibe sucesso/erro. A limpeza de retenção
no script só roda **após** o `pg_dump` ter sucesso, evitando apagar dumps
antigos quando o novo falhou.

## Verificação

- `npm run lint` e `npm run build` validam a rota/nav/página (TS).
- `npm run test` continua passando.
- A lógica de retenção/agenda vive em PowerShell e roda na máquina do admin;
  validação real é a execução dos scripts nessa máquina. Sem mudança de
  agendamento, **não é necessário re-rodar** `install-windows-backup-tasks.ps1`.

## Fora de escopo

- Novas seções de configuração além de backups (o módulo fica preparado, mas
  vazio de outras configs por ora).
- Mudança nos horários do agendamento.
- Backup/restore automatizado a partir da UI além do já existente.
