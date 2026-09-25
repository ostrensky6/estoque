# Auditoria do relatório de bugs v5 e correções: 25/09/2026

Branch integrado: `claude/kontrol-bugs-audit-integrado`, criado sobre o branch da auditoria de UI/UX
(`claude/kontrol-ui-ux-audit-9dd16c`, commit `1768328`) e somado ao trabalho desta auditoria
(`claude/kontrol-bugs-audit-6c0947`). As duas sessões resolveram os itens 7, 10 e 12 em paralelo. Na
integração ficaram as versões da outra sessão para a baixa (item 10) e o salário (item 12), com um acréscimo
nosso: a baixa de lote vencido.

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
| 8. Sem campo de lote | O lote inicial recebia sempre o código automático `CAD-xxxx`. A função de entrada com número de lote (`registrar_entrada_manual_embalagens`) não era chamada em nenhuma tela. | **Número do lote** no cadastro (migration 0113). Na edição, a seção **Lotes em estoque** mostra lote, validade e saldo, com atalhos para entrada e saída. Na entrada, insumos contados em embalagens usam a função própria, que aceita o número do lote. |
| 9. Não dá para criar nem excluir análises | As ações existiam, mas nenhuma tela as chamava. "Inativar" era um link discreto e sem volta. A exclusão apagava a receita antes de falhar por causa do histórico. A permissão "Editar análises" não tinha efeito. | **Nova análise** (em branco ou cópia) e, no menu da linha, **Duplicar** e **Excluir**. Na ficha: **Inativar/Reativar** e **Ofertar/Retirar da oferta**. Cópia e exclusão rodam numa única transação (0116). A exclusão é recusada quando a análise já foi usada. Quem recebe "Editar análises" passa a poder editar (0114). |
| 10. Sem saída avulsa | A baixa existia só por lote, sem motivo estruturado e sem botão no celular. Em lotes de embalagem fechada, ela tirava o saldo restante da contagem. Lotes vencidos não podiam sair. | **Dar baixa** (outra sessão, 0110): por lote ou por insumo, com motivo, sugestão FEFO, respeito a reservas e números inteiros para embalagens. Acréscimos desta auditoria: lote vencido sai com o motivo **Vencimento**, e perdas e vencimentos não inflam a previsão de consumo (0117). A ação aparece no celular, na edição do insumo e na página do lote. |
| 11. Planilha só baixa no computador | O botão era um `<Link>` do Next apontando para uma rota de arquivo, sem nenhum retorno enquanto o arquivo era gerado. A planilha por cadastro existia, mas não tinha botão. | `DownloadButton`: mostra "Gerando…", baixa o arquivo pelo navegador e informa o erro quando falha. Botões **Planilha de insumos** no Estoque e **Planilha** em cada cadastro. |
| 12. Salário visível a todos | Qualquer usuário autenticado lia `tecnicos.valor_mes` (política `using (true)`), na tela, na planilha e direto pela API. | Versão da outra sessão (0112): permissão **Ver salário dos técnicos** (padrão: somente administrador; configurável por papel e por usuário). Sem ela, o banco nega a coluna, gatilhos impedem alterar o salário, a tela e a planilha mostram **XXX** e o custeio usa só o total agregado. Nesta auditoria, o custeio também esconde o valor-hora de pessoal. |

## 3. Novos achados e correções por módulo

Legenda: **P0**: dado errado, perda de dado ou tarefa bloqueada; **P1**: alto impacto; **P2**: acabamento.

### 3.1 Transversais

| Prio | Achado | Correção |
|---|---|---|
| P0 | Datas de calendário apareciam **um dia antes**, inclusive na proposta do cliente: `"2026-10-25"` era lido como meia-noite UTC e mostrado no fuso de São Paulo. | `formatDate` trata `AAAA-MM-DD` como data local. Teste em `src/lib/formatters.test.ts`. |
| P0 | Salvar ou excluir mostrava "Atualizado"/"Excluído" quando o banco recusava a operação sem erro (RLS afeta 0 linhas). O problema aparecia em cadastros, análises e parâmetros. | As escritas conferem as linhas afetadas e mostram "Nada foi alterado…". |
| P1 | Não havia `error.tsx` nem `not-found.tsx`: qualquer erro abria a tela genérica do Next. | Telas de erro e de página não encontrada com "Tentar de novo". |
| P1 | Textos longos e técnicos fixos na tela ("snapshot", "engine", nomes de tabela). | Componente `HelpTip` ("?"), com legenda colorida (`HelpLegend`), exemplo (`HelpExample`) e fórmula (`HelpFormula`). Cerca de 60 textos foram movidos para ele. O "?" fica ao lado do título, fora do nome acessível. |
| P2 | Rótulos sem `htmlFor` nos formulários de cadastro; formulário de 2 colunas no celular. | Rótulos ligados aos campos, `aria-invalid`/`aria-describedby` e 1 coluna no celular. |

### 3.2 Suprimentos

| Prio | Achado | Correção |
|---|---|---|
| P0 | No celular, os cartões do Estoque não tinham nenhum botão (Aceitar, Saída, Entrada…). | `DataTable` ganhou ações no cartão; o título leva à página do lote. |
| P0 | A página do lote (destino do QR) não tinha ações. | `LoteAcoes` na página do lote, com as permissões corretas. |
| P0 | O QR codificava um caminho relativo (`/s/lote/12`), que a câmera do celular lê como texto. | O QR passa a ter a URL completa. Em produção, definir `NEXT_PUBLIC_SITE_URL`. |
| P0 | O descarte registrava `quantidade_inicial` em vez do saldo, sem custo, e aceitava lote já descartado. | Migration 0115. |
| P1 | "+ Entrada" criava lote de volume em insumo contado em embalagens, misturando os dois modelos e travando "Corrigir quantidade". | A entrada segue o modelo do insumo. |
| P1 | Ações de pedidos e compras lançavam erro (tela de erro) ou engoliam falhas. Faltavam revalidações de tela. | As ações devolvem mensagens (`FormComMensagem`), conferem erros e revalidam as telas afetadas. |
| P1 | O scanner redirecionava com `?scan=`, mas os cadastros só liam `?focus=`. | Os redirecionamentos passam a usar `?focus=`. |
| P2 | Status crus (`em_analise`), datas ISO, textos sem acento no scanner, "Ctrl+P" desenhado como botão. | Rótulos, `formatDate`, acentos e `PrintButton`. |

### 3.3 Operação, cadastros e administração

| Prio | Achado | Correção |
|---|---|---|
| P0 | Permissões individuais sem efeito para análises (item 9). | Migrations 0114 e 0116. |
| P1 | `/projetos` mostrava "—" como responsável: lia `coordenador`, mas o cadastro edita `responsavel`. | Usa `responsavel`, com fallback. |
| P1 | `/projetos`, `/parametros`, `/estoque/inventario`, `/etiquetas` e `/scanner/triagem` não tinham entrada no menu. | Entradas no menu e na busca (Ctrl K). |
| P1 | O planejamento oferecia análises inativas. | Filtro `ativo = true`. |
| P1 | A matriz de privilégios, ao desmarcar tudo, voltava ao padrão. | Campo `permissoes_presentes` incluído. |
| P2 | O botão de ajuda flutuante cobria ações e avisos no celular. | No celular, a ajuda abre pelo "?" da barra superior. |

### 3.4 Orçamento

| Prio | Achado | Correção |
|---|---|---|
| P0 | A proposta emitida quebrava quando faltava a instituição, e o formulário novo não gravava instituição, responsável, data de solicitação nem prazo. | Os campos são gravados. A proposta mostra um aviso e usa GIA/UFPR como padrão, em vez de quebrar. |
| P0 | Fundos mostrava 0 em impostos, incubação, reserva e investimento para toda proposta emitida. | Lê o valor nominal salvo na emissão. Os testes agora usam o formato real. |
| P0 | O Histórico quebrava para quem está abaixo de coordenador e gravava no banco a cada abertura. | "Vencida" é calculada na leitura; a gravação não derruba mais a tela. |
| P0 | Proposta "Apenas análises" saía pelo custo técnico, com 0% de impostos e lucro, sem aviso. | A etapa "Parâmetros" ganhou o editor dos 5 percentuais (impostos, incubação, reserva, investimentos, lucro), com prévia pela mesma engine da emissão. Sem orçamento de projeto, os percentuais ficam na proposta (0118); sem nada salvo, valem os padrões de Parâmetros de custeio. A confirmação só aparece se todos os percentuais forem zero. |
| P1 | A página pública de aprovação mostrava ao cliente o custo interno, o lucro e a reserva. A marca ATGC era fixa. | O cliente vê só os itens, o total, a validade e as condições. A marca vem da instituição. |
| P1 | Cancelar a proposta não pedia confirmação; os botões de edição apareciam em módulos travados; exclusões ignoravam erros. | Confirmação, botões ocultos e erros verificados. |
| P1 | No campo de quantidade do grupo, digitar 5 depois de apagar virava 15, e a quantidade não chegava às análises do grupo. | Corrigido. |
| P1 | O CSV do Histórico abria com acentos quebrados e decimais com ponto no Excel. | CSV com BOM, vírgula decimal e datas dd/mm/aaaa. |
| P1 | "Usar modelo" criava um orçamento de projeto órfão e caía num ciclo de redirecionamentos. | Oculto até a migração do orçamento de projetos. O código foi mantido. |
| P2 | Módulos cancelados entravam nos totais. As barras de etapas passavam por baixo do cabeçalho no celular. Classe CSS inválida. | Corrigidos. |

## 4. Migrations (aplicar em produção antes ou junto do deploy)

Todas são aditivas: não removem tabelas, colunas, dados, RLS nem gatilhos de auditoria. A sequência 0001 a
0117 foi aplicada num banco local limpo, e os cenários principais foram exercitados com técnico,
coordenador e gestor.

| Migration | Origem | Conteúdo |
|---|---|---|
| `0110_baixa_manual_embalagens.sql` | outra sessão | "Dar baixa" por embalagens e guardas na baixa por volume. |
| `0111_planejamento_edicao_exclusao.sql` | outra sessão | Editar, excluir e cancelar planos. |
| `0112_salario_tecnicos_permissao.sql` | outra sessão | Salário protegido por permissão; `tem_permissao_efetiva`. |
| `0113_lote_no_cadastro.sql` | esta auditoria | `criar_insumo_com_quantidade` aceita `codigo_lote`. Rollback: recriar a função da 0109. |
| `0114_permissao_editar_analises.sql` | esta auditoria | Escrita em análises: coordenador+ **ou** `analises.editar`. O rollback está no cabeçalho. |
| `0115_corrigir_descarte_lote.sql` | esta auditoria | Descarte registra o saldo atual, com custo e categoria; cria `categoria_saida`. Rollback: recriar a função da 0014. |
| `0116_catalogo_analises_transacional.sql` | esta auditoria | `duplicar_analise` e `excluir_analise_sem_historico`. Rollback: `drop function` das duas. |
| `0118_parametros_economicos_proposta.sql` | esta auditoria | Percentuais econômicos na própria proposta (colunas `param_*`, soma < 100%). Rollback: `drop column` das cinco colunas novas. |
| `0117_baixa_lote_vencido.sql` | esta auditoria | Baixa de lote vencido com o motivo "Vencimento"; perdas gravadas como `ajuste`. Rollback: recriar as funções da 0110. |

Até as migrations serem aplicadas, o app degrada com segurança:
- as ações que dependem das funções novas mostram "migration pendente" ou uma mensagem de erro clara.

**Conflito de numeração.** O checkout principal (`G:\Aplicativos\Kontrol`, branch
`codex/bugs-relatorio-20260919`) tem trabalho **não commitado** com `0109_estabilizar_…` e `0110_…`, que
redesenha o mesmo modelo de embalagens abertas e fechadas. Antes de juntar os dois trabalhos, é preciso
decidir qual modelo vale. Lá os números 0109 e 0110 colidem com os deste branch.

## 5. Pendências conhecidas

- **Custeio.** O valor-hora de pessoal agregado ainda chega ao navegador pelo simulador. Com um único técnico,
  ele equivale ao salário por hora. Para esconder de fato, o simulador precisa calcular no servidor.
- **Proposta mista (laboratório + projeto).** Os percentuais continuam no orçamento de projeto. Unificar tudo
  na proposta depende da migração do orçamento de projetos (protocolo próprio).
- **`ler_orcamento_publico`.** A função devolve o snapshot inteiro ao servidor. A página não o expõe, mas o
  ideal é o banco devolver só campos seguros para o cliente.
- **Permissões individuais.** `estoque.movimentar`, `estoque.lote.aceitar` e outras ainda não são
  verificadas; as telas e o banco usam o papel. Os mapas de permissão de cada usuário são gravados completos,
  então mudar o padrão do papel não alcança quem já existe.
- **Altura do cabeçalho móvel (57 px).** Está fixa em duas barras de etapas; deveria ser uma variável de CSS.
