# Auditoria do relatório de bugs v5 e correções: 25/09/2026

Branch `claude/kontrol-bugs-audit-6c0947`, criado a partir do `main` em `a8f96a5` (versão 1.0.9).
Este trabalho corre em paralelo à auditoria de UI/UX de 25/09 (branch `claude/kontrol-ui-ux-audit-9dd16c`,
"Onda 1") e não repete o que ela cobre.

## 1. Método

1. **Leitura do relatório.** Li `Relatorio_Bugs_Kontrol_v5.docx` (itens 7 a 12) e reproduzi cada item no
   código e no banco.
2. **Auditoria estática.** Três revisões independentes: Suprimentos, Operação/Cadastros/Admin e Orçamento.
   Cada achado foi conferido no código antes de virar correção.
3. **Validação do banco.** Todas as migrations (0001 a 0114) foram aplicadas num PostgreSQL 18 local e
   descartável, com um ambiente mínimo que imita o Supabase (papéis, `auth.uid()`, storage e cron
   simulados). As funções novas foram exercitadas com usuários técnico, coordenador e gestor. O banco de
   produção não foi tocado.
4. **Testes.** Typecheck, lint, testes unitários (vitest) e E2E (Playwright, modo simulado).

## 2. Itens do relatório v5

| Item | Causa encontrada | Correção |
|---|---|---|
| 7. "Campo não reconhecido" ao criar insumo | O formulário calculava `custo_unitario` e o enviava para `criar_insumo_com_quantidade`. A função aceita só uma lista fechada de campos e recusa o resto. Um teste existente **exigia** o envio desse campo. | O app envia somente os campos aceitos (`src/lib/cadastros/insumo-rpc.ts`). O teste agora compara o que é enviado com a lista da migration mais recente, e quebra se as duas divergirem. |
| 8. Sem campo de lote | O lote inicial recebia sempre o código automático `CAD-xxxx`. A função de entrada com número de lote (`registrar_entrada_manual_embalagens`) não era chamada em nenhuma tela. | **Número do lote** no cadastro (migration 0111). Na edição, a seção **Lotes em estoque** mostra lote, validade e saldo, com atalhos para entrada e saída. Na entrada, insumos contados em embalagens usam a função própria, que aceita o número do lote. |
| 9. Não dá para criar nem excluir análises | As ações existiam, mas nenhuma tela as chamava. "Inativar" era um link discreto e sem volta. A exclusão apagava a receita antes de falhar por causa do histórico. A permissão "Editar análises" não tinha efeito. | **Nova análise** (em branco ou cópia) e, no menu da linha, **Duplicar** e **Excluir**. Na ficha: **Inativar/Reativar** e **Ofertar/Retirar da oferta**. Cópia e exclusão rodam numa única transação (0114). A exclusão é recusada quando a análise já foi usada. Quem recebe "Editar análises" passa a poder editar (0112). |
| 10. Sem saída avulsa | A baixa existia só por lote, sem motivo estruturado e sem botão no celular. Em lotes de embalagem fechada, ela tirava o saldo restante da contagem. Lotes vencidos não podiam sair. | **Saída** por insumo ou por lote, com motivo (uso fora de plano, perda, quebra, vencido, descarte, outro). Segue FEFO, respeita reservas, exige números inteiros para embalagens e não duplica se enviada duas vezes (0111). Perdas não inflam a previsão de consumo. Disponível no Estoque (também no celular), na edição do insumo e na página do lote. |
| 11. Planilha só baixa no computador | O botão era um `<Link>` do Next apontando para uma rota de arquivo, sem nenhum retorno enquanto o arquivo era gerado. A planilha por cadastro existia, mas não tinha botão. | `DownloadButton`: mostra "Gerando…", baixa o arquivo pelo navegador e informa o erro quando falha. Botões **Planilha de insumos** no Estoque e **Planilha** em cada cadastro. |
| 12. Salário visível a todos | Qualquer usuário autenticado lia `tecnicos.valor_mes` (política `using (true)`), na tela, na planilha e direto pela API. | Nova permissão **Ver remuneração da equipe** (padrão: gestor e administrador; configurável por papel e por usuário). Sem ela, a leitura da tabela é bloqueada no banco, a tela mostra **XXX** e fica só para consulta, a planilha sai mascarada e a importação dessa aba é ignorada. O custeio usa apenas o total agregado (0112). |

## 3. Novos achados e correções por módulo

Seções 3.1 a 3.4 abaixo.
