# Auditoria de UI/UX do Kontrol — 25/09/2026

## 0. Escopo, método e limitações

**Base auditada.** Branch `main` no commit `a8f96a5` (versão 1.0.9). É o mesmo commit do `main` do
repositório oficial `D:\Aplicativos\Kontrol`. O checkout de `D:` está no branch
`codex/bugs-relatorio-20260919`, com alterações não commitadas em `CrudShell`, `ReceberLote`,
`cadastros`, `estoque` e `insumos`. **Essas alterações não foram avaliadas.**

**Método.**

1. Li o código das 60 rotas em `src/app` e dos componentes de `src/components`, com leitura
   integral das telas mais complexas.
2. Executei o app localmente em **modo simulado** (`PLAYWRIGHT_MOCK_SUPABASE=1`, o mesmo usado
   pelos testes E2E), sem tocar no banco real. Percorri as telas em 1440×900 e em 375×812,
   nos temas claro e escuro.
3. Rodei varreduras automáticas no código: textos longos, rótulos de formulário, confirmações,
   uso do design system, `title=` usado só no hover, avisos (`toast`) e páginas de erro.
4. Para servir de referência, examinei o recurso de explicação do projeto Sanepar
   (`D:\Aplicativos\Sanepar\web`).

**Marcadores usados nas tabelas**

- **[O]**: observado no app em execução.
- **[C]**: constatado no código.
- **[H]**: hipótese que depende de medição ou de teste com usuários.
- Prioridade: **P0** (bloqueia uma tarefa ou gera um resultado errado), **P1** (alto impacto),
  **P2** (médio), **P3** (acabamento).
- Esforço: **P** (horas), **M** (1 a 3 dias), **G** (mais de 3 dias).

**Limitações. Os pontos abaixo não foram avaliados como tela real.**

- **Detalhes sem dados na simulação.** Planejamento, pedido interno, compra, lote, versão final
  emitida, aprovação pública (`/aprovar/[token]`), inventário, etiquetas e triagem do scanner
  foram avaliados **somente pelo código**.
- **Desempenho real.** Não medi, pois não acessei produção. Os pontos de desempenho aparecem
  como [H].
- **Perfis técnico, coordenador e gestor.** A simulação só oferece o perfil admin. O que cada
  papel enxerga foi deduzido de `config/modules.ts` e das guardas das páginas.
- **Leitor de tela.** Não usei leitor de tela real. A acessibilidade foi avaliada pelo código,
  pela árvore de acessibilidade e pelo foco de teclado.
- **Usuários reais.** Não houve teste com usuários. Métricas de tempo por tarefa ficam como
  recomendação (seção 6).

---

## 1. Diagnóstico geral

O Kontrol tem uma boa base visual: marca clara, tokens de cor semânticos, modo escuro, paleta de
comandos (Ctrl K), link para pular ao conteúdo, foco visível global e componentes de design system
(`PageShell`, `PageHeader`, `SectionCard`, `StatCard`, `EmptyState`). Os problemas vêm
principalmente de **crescimento por camadas**. Cada fase acrescentou telas, avisos e navegações sem
consolidar as anteriores. Estes são os dez problemas principais, em ordem de impacto:

1. **O orçamento de projeto ficou sem tela de edição (P0, [O][C]).** O commit `587bed4`
   (24/06/2026) trocou o editor `/orcamento/projetos/[id]` (1.186 linhas: rubricas, pessoal,
   viagens, anexos, link público, salvar como modelo) por um redirecionamento para
   `/orcamento/demandas/[id]?etapa=projeto`. Essa etapa só **lista** o orçamento de projeto, e o
   botão "Abrir" aponta de novo para a rota redirecionada. **O usuário fica em ciclo e não
   consegue editar custos de projeto.** Confirmei no navegador. As ações `adicionarCustoProjeto`,
   `salvarViagensProjeto`, `criarLinkPublico`, `adicionarAnexoProjeto` e outras não têm mais
   nenhuma tela que as chame. Os componentes `FormPessoal`, `FormRubricaGenerica`,
   `EmissaoFinalForm` e `ParametrosDemandaGrossUp` (cerca de 2.600 linhas) ficaram órfãos. A
   Central de Ajuda continua descrevendo esses recursos.
2. **A navegação é redundante e tem destinos falsos.** Na barra superior de Orçamentos, as abas
   "Dashboard" e "Orçamentos não finalizados" levam à mesma tela. Dentro de uma demanda, as duas
   aparecem ativas ao mesmo tempo, e em Parâmetros a aba ativa é "Dashboard". Na página inicial,
   três dos cinco passos da jornada "Orçamento" caem na mesma lista. Operação mostra uma barra
   com uma única aba, e Custeio e Insumos ficam escondidos dela.
3. **O vocabulário muda a cada tela.** O mesmo objeto se chama "Orçamentos não finalizados"
   (menu), "Propostas" (título), "Nova demanda" (cartão e botão), "Novo Orçamento" (menu),
   "Demanda/Proposta" (detalhe) e "Entrada comercial" (legenda). Há dois conjuntos de status na
   mesma tela: o funil mostra "Em elaboração/Em revisão/Emitidas" e os filtros mostram
   "Nova/Em análise/Orçada". Os dois fluxos de etapas têm nomes e quantidades diferentes (6 e 5
   etapas).
4. **Há texto demais, e técnico demais.** Encontrei **95 textos com mais de 90 caracteres**
   visíveis permanentemente. Muitos são notas de engenharia expostas ao usuário: "snapshot",
   "engine atual", "modo legado", "Política A", "execução-gargalo", `grupo_escolha`, e até
   **nomes de tabelas do banco** (`insumo_analise + custo_unitario padrão`,
   `equipamento_analise + depreciação`). Há também planos de produto dentro da tela ("Proposta
   incremental: ficha read-only, versionamento…").
5. **Os indicadores sobrecarregam as telas e às vezes se contradizem.** A página inicial tem 12
   cartões de KPI, e Suprimentos tem 16. "Reposição" e "Comprar agora" medem quase a mesma coisa
   com fontes diferentes. Estoque mostra "Repor 1" e Controle de Estoque mostra "Reposição 0"
   para o mesmo item. "Cobertura" vale "% de insumos com saldo" na página inicial e "dias de
   consumo" no Estoque. O funil de Propostas soma 3 enquanto a lista mostra 1 registro.
6. **O design system foi pouco adotado.** `PageShell` aparece em **3 de 60** páginas, e
   `PageHeader` em cerca de 12. Existem pelo menos **6 padrões de "etapas"** (demanda, orçamento
   laboratorial, planejamento, pedido, âncoras de Suprimentos, abas da ficha de análise),
   **4 implementações de janela de confirmação**, **3 estilos de cartão de KPI** e **2 estilos
   de campo de formulário**.
7. **Os formulários são pouco acessíveis e visualmente pesados.** **158 rótulos** não estão
   ligados ao campo (`<label>` sem `htmlFor`/`id`), concentrados na demanda, no orçamento, no
   pedido e no planejamento. Clicar no rótulo não foca o campo, e o leitor de tela não anuncia o
   nome. Cada rótulo obrigatório leva "OBRIGATÓRIO" em vermelho e caixa alta. Há uma legenda de
   cinco tipos de campo ("Editável, Herdado, Calculado, Operacional, Bloqueado após emissão"), e
   todos os campos editáveis têm borda azul de 2 px, o que faz tudo parecer destacado.
8. **Ações irreversíveis ficam sem confirmação e o retorno das ações é irregular.** "Emitir
   versão final", "Marcar revisado" (que bloqueia a edição) e "Cancelar pedido" em Compras
   executam com um clique. Avisos de sucesso ou erro (`toast`) aparecem em apenas 4 arquivos, e
   a maioria das ações só recarrega a tela. Não existe `error.tsx` nem `not-found.tsx`.
9. **Dados aparecem sem tratamento.** Status aparecem crus (`enviado`, `em_analise`,
   `calibracao_vencida`), datas em formato ISO (`2026-06-21`), abreviações crípticas
   ("R R$ 20,00 · E R$ 0,00 · P · O") e textos sem acento em telas inteiras (ficha de análise,
   scanner): "Analises", "Preco", "nao", "codigo". Também há erros de concordância, como
   "1 alertas ativos".
10. **No celular, as ações ficam longe.** Os KPIs ocupam uma coluna cada, e o conteúdo útil
    começa a vários toques de rolagem. Na demanda, as etapas começam a cerca de 1,6 tela do topo,
    depois de 12 blocos de informação. Várias tabelas escondem a coluna de ações fora da área
    visível, mesmo em 1440 px. Mensagens de "sem dados" centralizadas dentro de tabelas largas
    ficam cortadas (Histórico, Fundos).

**Benefício esperado.** Corrigir os itens 1, 2, 3 e 8 destrava tarefas e elimina erros de
decisão. Os itens 4 e 5 reduzem o tempo de leitura. Os itens 6, 7, 9 e 10 dão consistência e
acessibilidade, e a lupa (seção 2) é o mecanismo que permite cortar texto sem perder informação.

---

## 2. A "lupa" explicativa: referência Sanepar e adaptação ao Kontrol

### 2.1 Como o Sanepar faz (examinado)

- `web/src/modules/results/components/results-interpretation-help.tsx` define um botão de
  **44×44 px** com ícone `CircleHelp` ("?"), `aria-label` igual ao título,
  `aria-haspopup="dialog"` e foco visível. O componente é usado em 23 pontos.
- `web/src/components/results-review-dialog.tsx` usa `<dialog>` nativo com `showModal()`. O
  diálogo prende o foco, fecha com Esc e com clique fora, devolve o foco ao botão e trava a
  rolagem da página.
- `web/src/components/page-header.tsx` tem uma propriedade `help` que posiciona o "?" logo após
  o título. A regra está documentada no código: "Uma linha de contexto. Explicações longas vão
  para o ícone de ajuda".
- **Convenção.** O ícone fica sempre depois do título do bloco que explica, e o conteúdo tem de
  1 a 3 parágrafos curtos, cada um com o termo em negrito no início.

**Observação importante.** No Sanepar, a "lupa" é visualmente um **"?" (CircleHelp)**, não uma
lupa de fato. No Kontrol, o ícone de lupa (`Search`) já significa **buscar**: botão "Buscar ou
executar" na barra lateral, botão de busca no celular e campos de busca das tabelas. Usar lupa
para "explicar" criaria ambiguidade.
**Recomendação:** manter o nome interno "lupa", mas usar o ícone **`CircleHelp`**, como no
Sanepar. Se a identidade visual exigir uma lupa, usar `ZoomIn` (lupa com "+"), que é
distinguível de `Search`, e **nunca** o mesmo ícone da busca.

### 2.2 Especificação proposta para o Kontrol

O Kontrol já tem Radix `Popover` e `Dialog` (`src/components/ui/popover.tsx` e `dialog.tsx`).
Proponho reaproveitá-los em vez de copiar o `<dialog>` do Sanepar:

| Variante | Quando usar | Comportamento |
|---|---|---|
| `Lupa` (popover) | Campo, coluna ou indicador, com 1 a 3 frases | Abre por clique, toque, Enter ou Espaço. Fecha com Esc, com clique fora ou no botão "Fechar". Não bloqueia a página. O foco vai para o conteúdo e volta ao ícone. |
| `Lupa variante="dialogo"` | "Como ler este bloco" ou fórmula com 2 a 4 parágrafos | Diálogo modal (Radix Dialog), com título e botão "Fechar explicação". |

**Requisitos de acessibilidade e interação**

- `<button type="button">` com `aria-label="Explicação: {rótulo}"`, `aria-expanded` e
  `aria-controls`, feitos pelo Radix.
- Área de toque mínima de 44×44 px, obtida com margem negativa (`-my-2`, como no Sanepar) para
  não aumentar a altura da linha.
- **Nunca** abrir só pelo hover. `title=` pode existir, mas como complemento.
- Fica **fora** do `<label>`, logo depois dele. Dentro do rótulo, o clique ativaria o campo.
- O conteúdo tem no máximo cerca de 280 caracteres na variante popover. Um link "Saiba mais"
  leva à Central de Ajuda quando houver tópico correspondente.
- Cor `text-muted-foreground` com hover em `text-primary`, para ter peso visual menor que o
  rótulo.

**Conteúdo centralizado.** Criar `src/lib/ajuda/lupas.ts` com entradas no formato
`{ id, titulo, texto, saibaMais? }`. Assim os textos são revisados em um só lugar, reaproveitados
em telas diferentes (por exemplo, "Disponível" aparece em 5 telas) e coerentes com
`src/lib/ajuda/topics.ts`.

**Esboço** (ilustrativo, a ajustar na implementação):

```tsx
// src/components/app/Lupa.tsx
export function Lupa({ id }: { id: LupaId }) {
  const { titulo, texto, saibaMais } = LUPAS[id];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label={`Explicação: ${titulo}`}
          className="-my-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:text-primary">
          <CircleHelp aria-hidden className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="max-w-xs p-3 text-sm" role="dialog" aria-label={titulo}>
        <p className="font-medium">{titulo}</p>
        <p className="mt-1 text-muted-foreground">{texto}</p>
        {saibaMais && <Link href={saibaMais}>Saiba mais</Link>}
      </PopoverContent>
    </Popover>
  );
}
```

`PageHeader` e `SectionCard` ganham a propriedade `help`, e `StatCard` e os cabeçalhos do
`DataTable` ganham a propriedade `lupa`.

### 2.3 Regras de uso (para não "espalhar lupas")

- **Usar** em quatro casos:
  - termos do domínio que não são óbvios (FEFO, gross-up, quarentena, cobertura);
  - indicadores calculados ("Disponível", "Ponto sugerido", "Fator de gross-up");
  - regras que explicam **por que** algo está bloqueado ou liberado;
  - leitura de gráficos e fórmulas.
- **Não usar** quando o rótulo basta: Nome, E-mail, CNPJ/CPF, Data, Prioridade, Observações,
  Fornecedor.
- **Não esconder na lupa** erros, bloqueios, consequências de ações irreversíveis, prazos e
  campos obrigatórios. Esses itens continuam visíveis, em uma frase curta. A lupa só complementa.
- No máximo **uma lupa por cabeçalho de seção**. Em tabela, apenas nas colunas calculadas.
- **Botão flutuante "?" (`ContextHelp`).** Hoje ele fica em todas as telas com texto genérico por
  prefixo de rota ("Engine de custo por análise…") e cobre conteúdo no celular. Proposta:
  substituí-lo pela lupa no título de cada página ("Como funciona esta tela") e manter a Central
  de Ajuda no menu.

---

## 3. Problemas por módulo e tela

### 3.1 Estrutura global (menu lateral, barra superior, cabeçalhos)

| # | Problema observado | Impacto para o usuário | Melhoria proposta | Prior. / Esforço |
|---|---|---|---|---|
| G1 | [O][C] As abas "Dashboard" (`/orcamento`) e "Orçamentos não finalizados" levam à mesma tela. Em `/orcamento/demandas/1` as duas ficam ativas, e em `/orcamento/parametros` a ativa é "Dashboard" (`ModuleTopNavClient` usa `startsWith`). | O usuário não sabe onde está e clica em duas abas que fazem o mesmo. | Remover a aba "Dashboard" enquanto não houver painel próprio. Calcular a aba ativa pelo **prefixo mais longo**. | P1 / P |
| G2 | [O] Em Operação, a barra superior tem uma única aba ("Análises"). Custeio e Insumos por análise têm `showInTopNav:false`. Em `/custeio` nenhuma aba fica ativa. | Custeio e Insumos só são encontrados pela busca (Ctrl K). Uma barra com uma aba é ruído. | Mostrar Análises, Insumos por análise e Custeio como abas. Com uma única aba, ocultar a barra (`hideWhenSingle`). | P1 / P |
| G3 | [O] Suprimentos tem 7 abas, mas a página do módulo (`/suprimentos`) não é uma delas, e ao entrar pelo menu nenhuma aba fica ativa. "Estoque" e "Controle de Estoque" têm descrições quase iguais. | Duas portas para o mesmo assunto e nenhuma indicação de onde se está. | Primeira aba "Visão geral" (`/suprimentos`). Unificar Estoque e Controle (ver 3.7). | P1 / M |
| G4 | [O] A barra de Cadastros tem 14 abas e transborda na horizontal ("Ove…" cortado), e a tela inicial ainda tem abas internas (Todos/Comercial/Custos/Materiais). | Navegação por rolagem lateral, sem indicação de que há mais abas. | Na barra, só "Todos os cadastros" e "Qualidade". Os cadastros individuais ficam no índice agrupado. Alternativa: um seletor "Ir para cadastro". | P2 / P |
| G5 | [C] Cadastros aparece antes de Operação no menu. Governança fica depois de Ajuda. | A ordem não segue a frequência de uso: dados mestres são tarefa eventual. | Ordem sugerida: Início, Orçamentos, Suprimentos, Operação, Cadastros, Governança. Ajuda vai para o rodapé do menu. | P3 / P |
| G6 | [O] Há um item "Início" só no menu recolhido (logo). Não existe item "Início" no menu expandido. | Voltar ao painel depende de saber que o logo é clicável. | Adicionar "Início" como primeiro item. | P2 / P |
| G7 | [C] Cabeçalhos são montados de 4 formas: `PageHeader`, `<h1>` solto, rótulo "Suprimentos · Estoque e equipamentos" ou "Demanda/Proposta" em caixa alta, e migalhas (breadcrumb) presentes só em algumas telas. | A hierarquia muda a cada tela, e o olho procura o título em lugares diferentes. | Todas as páginas com `PageShell` e `PageHeader` (migalhas, título, uma linha de contexto, `help`, ações). | P2 / M |
| G8 | [O] O botão flutuante "?" cobre conteúdo e ações no celular e tem texto genérico. O indicador do Next em modo dev também sobrepõe o nome do usuário (só em dev). | Tampa botões e traz ajuda pouco útil. | Ver 2.3: substituir pela lupa do título. | P2 / P |
| G9 | [O] O campo de busca do menu mostra "Buscar …" truncado e a dica "Ctrl K" ocupa espaço. | Rótulo ilegível. | Texto "Buscar" com a dica `Ctrl K` só no hover ou foco, ou reduzir o espaçamento. | P3 / P |

### 3.2 Início (painel)

| # | Problema observado | Impacto | Melhoria proposta | Prior. / Esforço |
|---|---|---|---|---|
| I1 | [O] 12 cartões de KPI em três faixas. "Reposição" e "Comprar agora" são quase iguais (fontes diferentes: `v_alertas_estoque` e cálculo local). "Vencendo" aparece duas vezes (quantidade e R$). | Leitura lenta e números que parecem contraditórios. | Uma faixa de **4 KPIs de ação**: Comprar, Vencidos/vencendo, Quarentena, Pedidos em andamento. Os valores em R$ vão para a seção "Visão executiva", recolhível. | P1 / M |
| I2 | [C] Na jornada "Orçamento", os passos "Análises/Lab." (`/orcamento`), "Projetos" (`/orcamento/projetos`) e "Proposta final" (`/orcamento/revisao`) redirecionam para a mesma lista. | Três cliques levam ao mesmo lugar, e o usuário perde confiança no mapa. | Reduzir a jornada a passos com destino real, ou trocar os cartões de jornada por "Minhas pendências". | P1 / P |
| I3 | [C] O bloco "Base de controle" mostra o link "Usuários" a todos os perfis, mas `/usuarios` exige admin. | Técnicos caem numa tela sem acesso. | Filtrar os links por papel (`permiteMinRole`), como o menu já faz. | P2 / P |
| I4 | [O] "1 alertas ativos", "Acoes rapidas", "Reposicao e recebimento", "Pendencias in-app". | Aparência de descuido. | Pluralização e acentuação (ver seção 4). | P2 / P |
| I5 | [C] Listas mostram status crus (`solicitado`) e datas ISO (`2026-06-21`). O link do cartão diz "abrir", em minúsculas. | Leitura técnica. | `StatusBadge` com rótulo, `formatDate` e link "Ver todos". | P2 / P |
| I6 | [O] No celular, 12 cartões empilhados em uma coluna antecedem as listas de pendências. | Muita rolagem até o que exige ação. | KPIs em 2 colunas no celular (`grid-cols-2`). Pendências logo após os KPIs. | P2 / P |

### 3.3 Orçamentos: lista e entrada

| # | Problema observado | Impacto | Melhoria proposta | Prior. / Esforço |
|---|---|---|---|---|
| O1 | [O] O objeto tem seis nomes: menu "Orçamentos não finalizados", migalha "Orçamento › Propostas", título "Propostas", cartão e botão "Nova demanda", menu "Novo Orçamento", detalhe "Demanda/Proposta". | O usuário não sabe se "demanda", "proposta" e "orçamento" são coisas diferentes e cria registros no lugar errado. | Definir um glossário (Onda 0). Sugestão: **Orçamento** é o processo (lista e novo); **Proposta** é o documento emitido (versão final). "Demanda" sai da interface. | P1 / M |
| O2 | [O] Duas formas de criar: formulário rápido "Nova demanda" no topo da lista e página completa "Novo Orçamento". O formulário rápido tem um seletor "Cliente" com a opção "Cliente livre" e, ao lado, outro campo chamado "Cliente livre". | Caminhos duplicados, cadastro incompleto (a completude cai) e ambiguidade no cliente. | Remover o formulário rápido e deixar um botão primário "Novo orçamento" no cabeçalho. No formulário completo, um único campo "Cliente" com busca e a opção "+ Cliente não cadastrado", que mostra o campo de nome. | P1 / M |
| O3 | [O] Seis cartões de funil (Em elaboração, Em revisão…) usam outra classificação que os filtros da lista (Nova, Em análise, Orçada…). O funil soma 3 e a lista tem 1 registro. | Números que não batem geram desconfiança. | Uma única classificação de status. Cada cartão do funil filtra a lista ao ser clicado. | P1 / M |
| O4 | [O] Os filtros de status aparecem duas vezes: botões "Todas/Nova/…" e o seletor "Status: todos" do `DataTable`. | Redundância, e os dois filtros podem ficar em conflito. | Manter só os botões (ou só o seletor). | P2 / P |
| O5 | [C] `DemandaForm`: 23 rótulos sem ligação com o campo. Selo "Obrigatório" em caixa alta vermelha em cada campo, legenda de 5 tipos de campo e borda de 2 px em todos os editáveis. | Formulário pesado. O leitor de tela não anuncia os campos. | `htmlFor`/`id` em todos os rótulos. Obrigatório com "*" e uma nota "* obrigatório". Remover a legenda: o campo calculado fica em texto somente leitura, sem parecer campo. Borda de 1 px e destaque só no foco. | P1 / M |
| O6 | [C] O status é editável na criação e as opções diferem entre as telas: há "Enviada" na criação e "Recusada" na edição. | Estados inconsistentes e status manual contradizendo o fluxo. | Status deve ser consequência do fluxo (emitir, aprovar, recusar) e não um campo livre. | P1 / M |
| O7 | [C] O catálogo de análises corta os resultados em 30 (`slice(0, 30)`) sem avisar. A lista tem altura de até 56rem. | Análises "somem" na busca. | Mostrar "30 de N — refine a busca" ou paginar. Altura máxima em torno de 24rem. | P1 / P |
| O8 | [C] Não há como **remover** um grupo de amostras depois de adicionado (só "Adicionar tipo de amostra"). | Um grupo adicionado por engano fica no orçamento. | Botão "Remover grupo", com confirmação se houver análises no grupo. | P1 / P |
| O9 | [C] Aviso amarelo permanente sobre "Compatibilidade por matriz…" e uma tabela-resumo de 10 colunas que repete a tabela de cada grupo. | Repetição e alerta que deixa de ser notado. | Uma única tabela por grupo. O resumo fica em 4 KPIs. O aviso vira uma frase curta com lupa (seção 5). | P2 / M |
| O10 | [C] Os ícones de lixeira e lápis só têm `title` (sem `aria-label`). | Botões sem nome para leitor de tela. | `aria-label="Remover {código}"`. | P1 / P |

### 3.4 Orçamentos: tela da demanda (área de trabalho)

| # | Problema observado | Impacto | Melhoria proposta | Prior. / Esforço |
|---|---|---|---|---|
| D1 | [O][C] **Etapa "Custos do projeto" sem editor.** "Abrir orçamento de projeto" e "Abrir" levam a `/orcamento/projetos/{id}`, que redireciona para a mesma etapa. | **Tarefa bloqueada**: não é possível lançar rubricas, pessoal, viagens, anexos ou link de aprovação. | Restaurar o editor como conteúdo da etapa "Custos do projeto", sem sair da demanda. **Seguir `docs/migracao-orcamento-projetos-protocolo.md`**: diagnóstico comparativo antes do código, pois se trata de funcionalidade herdada do app antigo. Até lá, ocultar o botão "Abrir" em ciclo e exibir um aviso honesto. | **P0** / G |
| D2 | [O] O cabeçalho tem 12 blocos de informação e 3 textos longos antes das etapas. No celular, as etapas começam a cerca de 1,6 tela do topo. | O usuário rola para chegar ao trabalho, e o conteúdo repete o formulário da etapa 1. | Cabeçalho compacto: título, cliente, modalidade, status, total e **próxima ação** (um botão). O restante fica na etapa "Dados". | P1 / M |
| D3 | [O] Status em branco ou cru ("Status:" vazio no teste; código usa `demanda.status`). Na tabela aparecem `enviado`, `revisado` e "Nao se aplica". | Leitura técnica e estado incompreensível. | `StatusBadge` com rótulos do glossário. Acentos. | P2 / P |
| D4 | [C] Etapas desabilitadas continuam sendo links (`aria-disabled` com `href` válido). | Clique leva a uma etapa inaplicável, e a tela volta para "demanda" sem explicar. | Etapas inaplicáveis como texto não clicável, com lupa "Por que não se aplica". | P2 / P |
| D5 | [C] A etapa 1 abre com "Próximos módulos", "Custos vinculados", "Fluxo recomendado" (texto fixo) e "Pendências por etapa" **antes** do formulário de dados. | A tarefa principal (preencher dados) fica no fim da página. | Formulário primeiro. Pendências como faixa única no topo. "Fluxo recomendado" sai (as próprias etapas já são o fluxo). | P2 / M |
| D6 | [C] **"Emitir versão final" sem confirmação** (gera versão numerada e imutável). Quando está desabilitado, o motivo aparece mais abaixo, em "Pendências e bloqueios". | Emissão acidental. O botão cinza não explica o bloqueio. | Janela de confirmação com o resumo "Emitir proposta nº X, total R$ Y, válida por Z dias?". Com o botão desabilitado, mostrar o motivo **ao lado** ("2 pendências — ver"). | **P1** / P |
| D7 | [C] A etapa final tem 7 blocos, e "Resumo executivo" e "Resumo econômico" repetem o subtotal técnico. As fórmulas aparecem em texto corrido ("valor comercial = total final × participação técnica · reconciliado", "Política A", "modo legado"). | Excesso de leitura na hora de decidir. | Total final em destaque, depois composição e pendências. Fórmulas e políticas vão para lupas (seção 5). Detalhamento interno continua recolhido. | P2 / M |
| D8 | [C] 21 rótulos sem ligação com o campo no formulário "Dados da demanda". "Cliente cadastrado" e "Cliente livre" aparecem lado a lado. | Mesmo problema de O2 e O5. | Mesma solução. | P1 / P |

### 3.5 Orçamentos: laboratorial, proposta final, histórico, fundos, parâmetros, modelos, governança

| # | Problema observado | Impacto | Melhoria proposta | Prior. / Esforço |
|---|---|---|---|---|
| L1 | [O] Três navegações empilhadas no orçamento laboratorial: barra do módulo, "Fluxo da proposta" (5 etapas, com nomes diferentes da demanda) e abas internas (Identificação/Análises/…/Histórico). | Não fica claro em que nível se está. As etapas da demanda (6) e as do laboratório (5) não correspondem. | Um componente único de **Etapas**, com os mesmos nomes em toda a proposta. As abas internas viram seções com títulos. | P1 / M |
| L2 | [O][C] Texto orienta "Use **Recalcular preços**", mas o botão se chama **"Aplicar e recalcular"** (também em Parâmetros). | O usuário procura um botão que não existe. | Padronizar para "Recalcular preços" (texto e botão). | P1 / P |
| L3 | [O] "Composição técnica por bloco" mostra nomes de tabelas (`insumo_analise + custo_unitario padrão`) e blocos zerados (R$ 0,00) enquanto o subtotal é R$ 740,00. | Parece erro de cálculo. Jargão de banco. | Coluna "Origem" em linguagem de negócio. Quando o detalhamento não existe (versão anterior), mostrar "Sem detalhamento nesta versão" em vez de zeros. | P1 / P |
| L4 | [O] O catálogo mostra "R R$ 20,00 · E R$ 0,00 · P R$ 0,00 · O R$ 0,00" e "Visível, fora do subtotal" em cada linha não incluída. Todas as análises ativas são listadas. | Abreviações ilegíveis e lista longa. | Mostrar só a composição da linha incluída, com lupa na coluna. Filtro "Só incluídas" ativo por padrão. Estado "Não incluída". | P2 / M |
| L5 | [C] "Marcar revisado" bloqueia a edição sem confirmação. A consequência aparece em texto abaixo do botão. | Bloqueio acidental. | Confirmação com a consequência ("Depois disso, a edição fica bloqueada"). | P1 / P |
| L6 | [O] "Linha do tempo" diz "(salve mudando o status acima para gerar eventos)". | Instrução técnica e confusa. | "Mudanças de status aparecem aqui." | P3 / P |
| H1 | [O] Histórico: 11 campos de filtro e 10 botões de status sempre abertos, mais um seletor de status duplicado. A tabela tem 12 colunas ou mais, e a mensagem "sem resultados" fica cortada à direita. | Tela intimidante. A mensagem de vazio fica invisível. | Busca, status e período visíveis. "Mais filtros" recolhível. `EmptyState` fora da área rolável. | P2 / M |
| F1 | [O] Fundos: tabela de 9 colunas ou mais com rolagem lateral e mensagem de vazio cortada. | Mesma situação de H1. | Mesma solução. Colunas secundárias em linha expansível. | P2 / M |
| P1 | [O] Parâmetros: descrição de 137 caracteres ("Cockpit financeiro…") e aviso de 150. Os quatro KPIs misturam percentual, dias e R$. | Leitura lenta num assunto que já é difícil. | Descrição de uma linha e fórmula na lupa. Aviso curto e visível (é consequência): "Vale para novos cálculos. Propostas já emitidas só mudam se recalculadas." | P2 / P |
| P2 | [O] Parâmetros não aparece na barra do módulo (`showInTopNav:false`). | Difícil de achar. | Mostrar para gestor e admin. | P2 / P |
| M1 | [C] Modelos e Governança de orçamento com textos de implementação ("origem importada preservada", "procedência auditável", "trilha de controles"). | O usuário não entende o propósito da tela. | Uma linha de contexto em linguagem de tarefa. Detalhes na lupa. | P3 / P |

### 3.6 Suprimentos (visão geral)

| # | Problema observado | Impacto | Melhoria proposta | Prior. / Esforço |
|---|---|---|---|---|
| S1 | [O] 16 cartões de KPI, 9 botões de âncora em duas linhas e 8 seções com tabelas de até 10 colunas. | Painel de difícil leitura, sem hierarquia do que é urgente. | Faixa com **5 KPIs de ação** (Pedidos aguardando decisão, Compras atrasadas, A receber, Quarentena, Vencendo). Os demais ficam em "Ver detalhes". Cada KPI leva à tela filtrada, não à âncora. | P1 / M |
| S2 | [O] O cartão de KPI (rótulo à esquerda, número pequeno à direita, borda colorida) é diferente de `StatCard`. | Inconsistência visual entre os painéis. | Usar `StatCard`. | P2 / P |
| S3 | [C] Status crus nas tabelas: `compra.status`, `lote.status`, `equip.status_operacional` e `n.tipo`. | Leitura técnica (`calibracao_vencida`). | Rótulos e `StatusBadge`. | P2 / P |
| S4 | [C] Tabela de pedidos com 10 colunas (Docs, Modalidade, Recebido, Pendências…). | Rolagem lateral. | 5 colunas: Pedido, Projeto, Etapa, Próxima ação, Pendências. As demais ficam no detalhe. | P2 / P |

### 3.7 Estoque e Controle de Estoque

| # | Problema observado | Impacto | Melhoria proposta | Prior. / Esforço |
|---|---|---|---|---|
| E1 | [O] Duas telas para o mesmo assunto, com números divergentes: Estoque mostra "Repor 1" e Controle mostra "Reposição 0" + "Sem estoque 1" para o mesmo insumo. Os KPIs têm estilos diferentes. | O usuário não sabe em qual confiar. | Unificar em "Estoque", com as visões "Por insumo", "Por lote" e "Gráfico" (como no Controle) e um único conjunto de KPIs com regras explícitas (lupas). | P1 / G |
| E2 | [O] A tabela de saldos tem 12 colunas, e a coluna **Ações** fica fora da área visível em 1440 px. | A ação principal fica escondida atrás da rolagem lateral. | Fixar a coluna de ações à direita (`sticky`) ou mover as ações para o menu "⋯" na primeira coluna. Colunas secundárias no modo "Detalhado". | P1 / M |
| E3 | [O] Parágrafos explicativos acima e abaixo das tabelas ("Os saldos são calculados…", "previsão usa consumo dos últimos 90 dias…", "Material recebido entra em quarentena… FEFO…"). | Texto que ninguém lê repetido em toda visita. | Mover para lupas nas colunas Disponível, Ponto sugerido, Cobertura e Estado (seção 5). | P2 / P |
| E4 | [C] "Cobertura" significa "dias de consumo" no Estoque e "% de insumos com saldo" na página inicial. | Mesmo termo com dois significados. | Página inicial: "Insumos com saldo". Estoque: "Cobertura (dias)". | P2 / P |
| E5 | [O] O gráfico "Alertas ativos" vazio mostra eixo e rótulo sem dados. | Ruído. | `EmptyState` quando não há alertas. | P3 / P |
| E6 | [O] No celular, 5 cartões de alerta de largura total antes de qualquer tabela. | Muita rolagem. | Cartões em 2 colunas, ou uma faixa rolável. | P2 / P |
| E7 | [C] Equipamentos e Etiquetas dizem "Esta página é somente leitura e serve de base para identificação patrimonial futura". | Texto de roteiro de produto. | "Unidades de equipamento cadastradas." | P3 / P |

### 3.8 Planejamento, Pedido interno, Compras, Recebimento e Notificações

| # | Problema observado | Impacto | Melhoria proposta | Prior. / Esforço |
|---|---|---|---|---|
| C1 | [O] Compras tem dois avisos, cada um com o **mesmo botão** "Gerar pedidos de reposição", e um formulário "Nova solicitação" com seletores sem texto de opção ("—"). O texto "Solicitação → aprovação → recebimento" contradiz "A reposição deve nascer como pedido interno". | Dois caminhos de compra e dúvida sobre qual seguir. | Um aviso único ("Reposição sugerida para N insumos" e botão). Deixar claro que **compra começa por Pedido**. A solicitação direta vira ação secundária, só para quem tem permissão. | P1 / M |
| C2 | [C] **"Cancelar pedido" (Compras) executa com um clique**, sem confirmação nem motivo. O Pedido interno exige motivo, o que é bom. | Cancelamento acidental. | Confirmação com motivo, como no Pedido interno. | P1 / P |
| C3 | [O] Pedido: lista com 13 colunas. A mensagem vazia diz "Registre a demanda acima", mas não há formulário acima. | Mensagem enganosa e rolagem lateral. | "Nenhum pedido ainda." com o botão "Novo pedido". Tabela com 6 colunas. | P2 / P |
| C4 | [C] O detalhe do pedido tem 13 seções numa página longa (Etapas, Itens, Conferência, Análise administrativa, Referências, Checklist, Documentos, Registrar documento, Comunicações…). O cabeçalho mostra `tipo_demanda` com "/" no lugar de "_" e urgência crua. | Difícil achar a próxima ação. | Cabeçalho com a **próxima ação e o responsável**. Abas "Itens / Documentos / Comunicação / Histórico". Etapas com o componente único. | P2 / G |
| C5 | [C] Detalhe do planejamento: 3 avisos amarelos longos e data alvo em ISO. A navegação por âncoras tem estilo próprio. | Mesmo padrão de sobrecarga. | Avisos curtos (bloqueios visíveis, explicação na lupa). `formatDate`. Componente único de Etapas. | P2 / M |
| C6 | [C] Iniciar planejamento ("baixa definitiva") tem confirmação, o que é bom, mas é um modal próprio, diferente dos outros 3. | Comportamento de teclado e foco diferente em cada modal. | Unificar em `ConfirmDialog` (Radix): foco preso, Esc fecha, título e consequência. | P2 / M |
| C7 | [O] Recebimento: descrição de 142 caracteres. | Leitura. | "Itens a receber de pedidos e compras." A regra de quarentena e parcial vai para a lupa. | P3 / P |

### 3.9 Operação: Análises, ficha, Insumos por análise, Custeio

| # | Problema observado | Impacto | Melhoria proposta | Prior. / Esforço |
|---|---|---|---|---|
| A1 | [O] Ficha da análise inteira sem acentos ("Analises", "Ofertavel", "Preco", "Ficha tecnica", "Historico", "Descricao", "Execucoes/dia"), assim como o scanner. | Aparência de rascunho. | Revisão ortográfica (lista na seção 4). | P1 / P |
| A2 | [O] O título da ficha é o **código** (`Illumina_Sh`, repetido na migalha e no título), e o nome ("Shotgun") fica em segundo plano. | Identificação mais lenta. | Título = nome. Código em fonte mono como metadado. | P2 / P |
| A3 | [O] O campo de status é texto livre e usado como anotação ("Ativo - TODO tecnico: revisar quantificacao…"), exibido como selo. | Selos gigantes com texto interno ("TODO"). | Separar "Situação" (lista) de "Nota interna" (texto). A nota fica na aba Histórico. | P2 / M |
| A4 | [C] Blocos com planos de produto na tela ("Proposta incremental: ficha read-only, versionamento…", 172 caracteres; "O cadastro atual ainda nao possui versionamento…", 259 caracteres). | Texto sem ação possível para o usuário. | Remover da interface e registrar em `docs/`. Se relevante, uma lupa: "Mudanças na receita valem para novos cálculos." | P2 / P |
| A5 | [O] A lista de análises tem um botão azul "Gerenciar ficha" em cada linha (9 botões primários), e a coluna Alertas quebra o texto verticalmente. | Excesso de peso visual e leitura difícil. | Nome clicável como link, ou botão fantasma "Abrir". Alerta como ícone com contagem e lupa. | P2 / P |
| A6 | [O] Custeio: descrição técnica ("lote = tamanho da execução-gargalo · fatores de preço somando 100.0%") e premissas com nomes de campo (`por_execucao`, `grupo_escolha`). | Jargão. | Linha curta e lupa "Como o custo é calculado" (seção 5). | P2 / P |

### 3.10 Cadastros

| # | Problema observado | Impacto | Melhoria proposta | Prior. / Esforço |
|---|---|---|---|---|
| K1 | [O] O índice abre com a importação de planilha XLSX em destaque, antes dos cartões de cadastro. | Uma ação em massa e arriscada ganha o maior destaque. Quem só quer abrir "Clientes" rola a tela. | Cartões primeiro. "Importar/Exportar planilha" vira ação secundária no cabeçalho, com confirmação do impacto antes de importar. | P2 / P |
| K2 | [O] Cada cartão tem 2 a 3 linhas de descrição técnica ("custo diário por depreciação linear pela vida útil + manutenção"). | Excesso de texto num índice. | Descrição de uma linha. A regra de custo vai para a lupa dentro do cadastro. | P3 / P |
| K3 | [O] Insumos: texto permanente de 205 caracteres sobre "Quantidade = embalagens fechadas…". | Informação importante, mas longa. | Lupa na coluna "Quantidade" com o texto e o exemplo. Manter visível só "Quantidade em embalagens fechadas". | P2 / P |
| K4 | [C] `CrudShell` com 1.025 linhas. As alterações pendentes no checkout de `D:` não foram avaliadas. | — | Revisar novamente após a integração do branch `codex/bugs-relatorio-20260919`. | — |

### 3.11 Governança e Usuários

| # | Problema observado | Impacto | Melhoria proposta | Prior. / Esforço |
|---|---|---|---|---|
| U1 | [O] Permissões editáveis em dois lugares: "Tabela de permissões por categoria" (Usuários) e "Privilégios" (matriz por papel). | O usuário não sabe qual prevalece. | Uma tela "Permissões". Em Usuários, apenas ajustes individuais. | P1 / M |
| U2 | [C] Privilégios exibe nota técnica de 219 caracteres sobre RLS e papéis históricos. | Texto de implementação. | Remover, ou deixar na lupa para admin. | P3 / P |
| U3 | [C] Backups: "Execute scripts\install-windows-backup-tasks.ps1 no computador do administrador…". | Instrução técnica para um público não técnico. | Mostrar só o estado ("Último backup: …"). A instrução vai para a lupa ou para a documentação. | P3 / P |
| U4 | [C] Auditoria: "Imutável — gravada automaticamente pelo banco." | Aceitável. | Encurtar e mover para a lupa. | P3 / P |

### 3.12 Ajuda

| # | Problema observado | Impacto | Melhoria proposta | Prior. / Esforço |
|---|---|---|---|---|
| J1 | [C] O tópico "Orçamento de Projetos" descreve rubricas, anexos, templates e link público, recursos sem tela desde o commit `587bed4`. O tópico "Análises" fala em cadastrar "finalidade e matriz", campos que a ficha não tem. | Ajuda desatualizada gera frustração. | Revisar a Central junto com o glossário (Onda 0) e ligar cada tópico às lupas (`saibaMais`). | P1 / M |
| J2 | [O] A Central é boa (busca, grupos, "Abrir módulo"), mas o texto de introdução é longo. | — | Manter, e usar como fonte de "Saiba mais". | P3 / P |

### 3.13 Transversal: formulários, retorno das ações, acessibilidade e responsividade

| # | Problema observado | Impacto | Melhoria proposta | Prior. / Esforço |
|---|---|---|---|---|
| T1 | [C] 158 rótulos sem ligação com o campo. Os piores: `DemandaForm` (23), demanda/[id] (21), pedido/[id] (15), planejamento/[id] (13), orcamento/[id] (13). | Falha de acessibilidade (WCAG 1.3.1 e 4.1.2). O clique no rótulo não foca o campo. | Componente `Campo` (label, controle, descrição, erro) com `useId`. Ampliar `e2e/a11y.spec.ts`, que hoje cobre 12 rotas e **não** inclui demanda, pedido, planejamento e recebimento. | P1 / M |
| T2 | [C] 4 implementações de confirmação. `ConfirmActionButton` é uma `div` sem `role="dialog"`, sem foco preso e sem Esc. | Teclado e leitor de tela se perdem. | `ConfirmDialog` único sobre o Radix Dialog. | P1 / M |
| T3 | [C] `toast` usado em 4 arquivos. A maioria das ações apenas revalida a tela. | O usuário não sabe se salvou. | Padrão: sucesso gera `toast` curto ("Orçamento salvo"); erro gera mensagem junto ao campo ou ao bloco, com `aria-live`. | P1 / M |
| T4 | [C] Não há `error.tsx` nem `not-found.tsx`. | Erro de servidor mostra a página padrão do Next, sem saída. | Páginas de erro com "Tentar de novo" e "Voltar ao início". | P2 / P |
| T5 | [C] 72 atributos `title=` usados como explicação, que só aparecem no hover (por exemplo, a descrição das abas do módulo). | Inacessível no toque e no teclado. | Informação essencial vai para o texto ou para a lupa. | P2 / P |
| T6 | [O] Mensagens de vazio centralizadas dentro de tabelas com rolagem lateral ficam cortadas. | O usuário vê uma tabela vazia sem explicação. | `DataTable` renderiza o `EmptyState` fora da área rolável. | P2 / P |
| T7 | [O][C] Datas em ISO e status crus em várias telas. | Leitura técnica. | Sempre `formatDate` e `StatusBadge`. Regra de lint ou revisão. | P2 / M |
| T8 | [C] Dois estilos de campo (borda de 2 px azul no `DemandaForm` e de 1 px nos demais) e botões montados à mão com classes em vez de `ui/button`. | Inconsistência visual. | Usar `ui/input` e `ui/button` em todo o app. | P2 / M |
| T9 | [H] Páginas `force-dynamic` com muitas consultas paralelas. `/orcamento/demandas/nova` executa `calcularTodas()` (custeio de todas as análises) a cada abertura, e `/suprimentos` carrega todas as entidades do módulo. | Possível lentidão para abrir as telas. | **Medir** o tempo de resposta do servidor (TTFB) em produção antes de otimizar. Se passar de cerca de 1 s, usar cache ou uma consulta sob demanda. | P2 / M |

---

## 4. Textos atuais e versões sugeridas

| Onde | Texto atual | Sugestão | Observação |
|---|---|---|---|
| Início, título e descrição | "Painel de decisão operacional" / "Orçamento, planejamento, estoque e compras no mesmo fluxo de decisão. Este painel mostra o que precisa de compra, aceite, baixa ou revisão antes de virar problema operacional." (175) | "Início" / "O que precisa de ação hoje." | Restante na lupa do título |
| Início, selo | "1 alertas ativos" | "1 alerta ativo" | Pluralização |
| Início, ações | "Reposicao e recebimento" · "Pendencias in-app" · "Acoes rapidas" | "Reposição e recebimento" · "Pendências" · "Ações rápidas" | Acentos |
| Início, link | "abrir" | "Ver todos" | |
| Orçamentos, lista | "Propostas" / "Crie e acompanhe propostas comerciais. A partir daqui o fluxo segue para orçamento de análises, orçamento de projeto ou composição híbrida." (139) | "Orçamentos" / "Orçamentos em andamento." | Conforme glossário |
| Orçamentos, cartão | "Nova demanda — Registre a entrada comercial antes do orçamento formal." | (remover o cartão) Botão "Novo orçamento" | O2 |
| Novo orçamento | "Preencha o orçamento inteiro uma única vez. Estes dados seguem para laboratório, projeto e proposta final." | "Os dados abaixo são usados em todas as etapas do orçamento." | |
| Novo orçamento, aviso | "Compatibilidade por matriz ainda não possui relação oficial no banco. A matriz da demanda é informativa; confirme tecnicamente antes de emitir." | Visível: "Confirme se as análises servem para esta matriz." + lupa | A ação continua visível |
| Novo orçamento, coluna | "Quantidade de amostras para esta análise" | "Amostras" | |
| Novo orçamento, vazio | "Não existem análises ativas cadastradas ou você não possui permissão para visualizar este catálogo." | Separar: "Nenhuma análise ativa cadastrada." ou "Você não tem permissão para ver o catálogo." | Uma causa por mensagem |
| Demanda, módulos | "Orçamento laboratorial: saneamento necessário" | "Há orçamentos laboratoriais duplicados. Peça revisão ao gestor." | Diz o que fazer |
| Demanda, etapa final | "O preço laboratorial (snapshot) é apenas referência operacional e NÃO entra no fechamento da proposta (Política A)." | Lupa: ver L-11 na seção 5 | Sai do texto fixo |
| Demanda, histórico | "Versões emitidas antes da engine atual mantêm seus snapshots originais (modo legado) e não são recalculadas." | "Versões antigas mantêm os valores da época da emissão." | |
| Demanda, composição | "valor comercial = total final × participação técnica · reconciliado" | Selo "Conferido ✓" + lupa | |
| Demanda, pendências | "Divergência de reconciliação entre composição e total final — revisar itens." | "A soma dos itens não bate com o total. Revise os itens." | Continua visível (é bloqueio) |
| Orçamento lab. | "Os parâmetros de custo mudaram desde a emissão. Use “Recalcular preços” para atualizar os valores deste orçamento." | "Os custos-base mudaram. Clique em **Recalcular preços** para atualizar." | Botão com o mesmo nome (L2) |
| Orçamento lab., origem | "insumo_analise + custo_unitario padrão" · "equipamento_analise + depreciação/manutenção" | "Receita da análise × custo padrão do insumo" · "Custo diário do equipamento" | Sem nomes de tabela |
| Orçamento lab., catálogo | "R R$ 20,00 · E R$ 0,00 · P R$ 0,00 · O R$ 0,00" / "Visível, fora do subtotal" | "Reagentes R$ 20,00 · Equip. R$ 0,00 · Pessoal R$ 0,00 · Overhead R$ 0,00" / "Não incluída" | |
| Orçamento lab., linha do tempo | "Transições de status registradas (salve mudando o status acima para gerar eventos)." | "Mudanças de status aparecem aqui." | |
| Parâmetros | "Cockpit financeiro para conferir custos recebidos, percentuais, fórmula, impacto e versões antes de recalcular ou emitir novas propostas." | "Percentuais usados para formar o preço das propostas." | |
| Parâmetros, aviso | "Alterações valem para novos cálculos e para orçamentos recalculados. Orçamentos já emitidos mantêm o snapshot salvo até você usar “Recalcular preços”." | "Vale para novos cálculos. Propostas emitidas só mudam se recalculadas." | Consequência continua visível |
| Histórico | "Área de consulta para registros fechados. Versões finais preservam snapshot técnico, parâmetros e valores emitidos." | "Propostas emitidas, aprovadas ou encerradas." | |
| Suprimentos | "Central operacional de planejamento, reservas, pedidos internos, compras, recebimento, quarentena e rastreabilidade." | "Pendências de estoque, pedidos e compras." | |
| Compras, aviso | "A reposição deve nascer como pedido interno estruturado. Depois de validado, o pedido tramita para a compra formal e recebimento." | "Reposição sugerida para N insumos." [Gerar pedido de reposição] + lupa | Remove o botão duplicado |
| Compras, confirmação | "O sistema criará rascunhos de compra para insumos com reposição sugerida, descontando o que já estiver em pedido aberto. Revise os rascunhos em Compras antes de prosseguir com a compra." (185) | "Criar rascunhos para N insumos? O que já está em pedido aberto é descontado. Você revisa antes de enviar." | Consequência mantida |
| Pedido, vazio | "Nenhum pedido interno. Registre a demanda acima." | "Nenhum pedido ainda." [Novo pedido] | |
| Estoque | "Saldo por reagente (em mãos · reservado · disponível) e alertas de reposição e vencimento. Lotes consumidos por FEFO." | "Saldos, lotes e validades." | FEFO e disponível nas lupas |
| Estoque, custo | "Padrão para simulação; médio ponderado dos lotes liberados para previsão; custo real preservado por lote no consumo." | "Diferença entre custo padrão e custo médio dos lotes." + lupa | |
| Custeio | "Premissas a validar: lote padrão = execução-gargalo; itens "por_execucao" rateados pelo lote; grupo_escolha usa a opção mais barata por enquanto…" | Lupa "Como o custo é calculado" (L-18) | |
| Análise, ficha | "O cadastro atual ainda nao possui versionamento de protocolo nem snapshot tecnico por orcamento…" (259) | (remover) ou lupa: "Mudanças na receita valem para novos cálculos." | Nota de engenharia |
| Análise, alerta | "Analise ativa com status textual de revisao." | "Análise ativa com observação pendente de revisão." | Acentos e clareza |
| Scanner, triagem | "Resolva leituras pendentes vinculando o codigo a uma entidade existente, criando um insumo minimo por transacao segura ou arquivando a triagem. Nenhum lote recebido ou fluxo operacional e criado aqui." (200) | "Vincule o código a um cadastro, crie um insumo mínimo ou arquive." + lupa "Nada aqui cria lote nem movimenta estoque." | |
| Usuários | "Cadastre acessos, mantenha pré-aprovados, assinaturas e permissões por categoria. Técnico, coordenador, gestor e administrador têm matrizes editáveis por usuário." (162) | "Acessos, assinaturas e permissões." | |
| Usuários, criar | "O usuário é criado já com acesso, usando uma senha provisória. No primeiro acesso ele é obrigado a definir uma senha definitiva. As permissões iniciais seguem a categoria escolhida." | "Será gerada uma senha provisória, trocada no primeiro acesso. Permissões iniciais: as da categoria." | Consequência mantida |
| Privilégios | "O banco atual mantém quatro papéis. O papel administrativo histórico não foi recriado…" (219) | "Defina o que cada papel pode fazer." | Nota técnica sai |
| Diversos | "Nao se aplica", "pronto para emissao", "concluida", "Laboratorio", "Parametros", "Inicio", "Navegacao principal" | "Não se aplica", "Pronto para emissão", "Concluída", "Laboratório", "Parâmetros", "Início", "Navegação principal" | Inclui `aria-label` |

---

## 5. Onde inserir lupas e o que dizer

Os textos seguem as regras do código: `engine-economica.ts` e a view `v_estoque_saldo` na
migration `0109`.

| ID | Local | Texto da lupa |
|---|---|---|
| L-1 | Início, título | **O que é este painel.** Mostra o que pede ação hoje: insumos para comprar, lotes vencendo ou em quarentena e pedidos em andamento. Clique em um número para ver os itens. |
| L-2 | KPI "Disponível" / coluna Disponível (Estoque, Controle, Novo orçamento, Planejamento) | **Disponível.** Saldo dos lotes aceitos e dentro da validade, menos o que já está reservado para planejamentos. Lotes em quarentena, bloqueados ou vencidos não entram. |
| L-3 | Coluna "Em mãos" | **Em mãos.** Tudo o que está nos lotes liberados (aceitos ou em uso), mesmo que já reservado. |
| L-4 | Coluna/KPI "Quarentena" | **Quarentena.** Material recebido que ainda não foi conferido. Só passa a contar como disponível depois de aceito no lote. |
| L-5 | Cabeçalho da tabela de lotes, "FEFO" | **FEFO — vence primeiro, sai primeiro.** Nas baixas, o Kontrol consome primeiro o lote com a validade mais próxima. |
| L-6 | Coluna "Ponto sugerido" | **Ponto sugerido.** Quantidade em que vale a pena pedir de novo, calculada pelo consumo dos últimos 90 dias, pelo prazo de entrega (lead time) e pelo estoque de segurança. Para fixar um valor, edite o insumo em Cadastros. |
| L-7 | Coluna "Cobertura (dias)" | **Cobertura.** Por quantos dias o saldo disponível dura no ritmo de consumo recente. |
| L-8 | KPI "Repor" / "Comprar agora" | **Repor.** Insumos cujo saldo disponível chegou ao ponto de reposição. |
| L-9 | Estoque, "Custo de estoque vigente" | **Custo vigente.** Compara o custo padrão do cadastro (usado em simulações) com o custo médio dos lotes liberados. O custo real de cada lote é preservado quando ele é consumido. |
| L-10 | Parâmetros e proposta, "Fator de gross-up" | **Fator de gross-up.** Multiplicador que inclui impostos, taxas, reservas e lucro no preço. É calculado como 1 ÷ (1 − soma dos percentuais). Ex.: percentuais somando 20% → fator 1,25. A soma precisa ficar abaixo de 100%. |
| L-11 | Proposta final, "Total final" | **Como o total é formado.** Custo técnico do laboratório + custo direto do projeto, multiplicados pelo fator de gross-up. O preço de tabela do laboratório é só referência e não entra na conta. |
| L-12 | Proposta final, "Composição da proposta" | **Composição.** Distribui o total final entre os itens conforme a participação de cada um no custo técnico. "Conferido" indica que a soma dos itens bate com o total. |
| L-13 | Proposta final, "Validade (dias)" | **Validade.** Número de dias em que a proposta emitida vale para o cliente, contados da emissão. |
| L-14 | Etapas da demanda, etapa "Não se aplica" | **Por que não se aplica.** A modalidade escolhida não exige esta etapa. Ex.: "Apenas análises" não tem custos de projeto. Para mudar, altere a modalidade em Dados. |
| L-15 | Demanda, selo "X% faltante" | **Completude.** Percentual de campos obrigatórios ainda vazios. As etapas seguintes só são liberadas quando os dados estão completos. |
| L-16 | Novo orçamento, "Lotes previstos" e "Prazo técnico" | **Lotes e prazo.** A análise roda em lotes de tamanho fixo. O prazo usa a capacidade diária da etapa mais lenta. |
| L-17 | Novo orçamento, aviso de matriz | **Por que confirmar a matriz.** O Kontrol ainda não sabe quais análises servem para cada tipo de amostra. Confira com o responsável técnico antes de emitir. |
| L-18 | Custeio, título | **Como o custo é calculado.** Reagentes por amostra + custos por execução divididos pelas amostras do lote + equipamento, pessoal e overhead pelas horas de bancada. O preço aplica os fatores sobre o custo. |
| L-19 | Custeio, gráfico "Custo por número de amostras" | **Como ler.** Os degraus aparecem quando uma nova execução precisa ser aberta. O custo por amostra cai à medida que o lote enche. |
| L-20 | Orçamento lab., "Recalcular preços" | **Recalcular.** Atualiza este orçamento com os custos e parâmetros atuais. Versões já emitidas não mudam. |
| L-21 | Orçamento lab., "Marcar revisado" | **Revisado.** Congela os custos laboratoriais para liberar a proposta final. Para alterar depois, é preciso reabrir. |
| L-22 | Parâmetros, cada percentual (Impostos, Incubação, Reserva, Investimentos, Lucro) | Uma frase por item. Ex.: **Incubação.** Percentual repassado à incubadora sobre o valor final da proposta. *(Validar com a área financeira.)* |
| L-23 | Pedido interno, "Etapas do processo" | **Etapas.** Cada etapa tem um responsável. A próxima ação e quem deve executá-la aparecem no topo do pedido. |
| L-24 | Compras, "Reposição via pedido" | **Por que via pedido interno.** A compra precisa de validação do coordenador e de fonte de recurso. O pedido gerado já traz os itens sugeridos para revisão. |
| L-25 | Recebimento | **Recebimento.** Cada chegada vira um lote em quarentena. Em recebimento parcial, o item continua pendente até completar a quantidade. |
| L-26 | Planejamento, "Iniciar" | **Iniciar.** Dá baixa definitiva nos lotes reservados. Faça isso quando a análise começar de fato. |
| L-27 | Cadastros › Insumos, coluna "Quantidade" | **Quantidade.** Número de embalagens fechadas (frascos, pacotes, kits), e não o volume. Ex.: 3 frascos de 500 mL = 3. Vem dos lotes; para corrigir, abra o insumo. |
| L-28 | Scanner, triagem | **Triagem.** Leituras de códigos não reconhecidos. Resolver aqui não cria lote nem movimenta estoque. |

**Onde não colocar lupa:** Título, Cliente, CNPJ/CPF, Contato, Instituição, Datas, Prioridade,
Observações, Fornecedor, Projeto, E-mail, Nome e botões de ação óbvios (Salvar, Cancelar).

**O que continua visível (não vai para a lupa):**

- os motivos de bloqueio da emissão;
- "Emissão bloqueada: itens com custo zero sem justificativa";
- o erro de soma dos parâmetros acima de 100%;
- as consequências das confirmações (baixa definitiva, descarte, cancelamento);
- as mensagens de erro de formulário.

---

## 6. Sequência recomendada de implementação

A ordem considera impacto, esforço e dependências. Cada onda pode ser entregue sozinha.

**Onda 0 — Decisões (1 a 2 dias, sem código). Destrava as ondas 2 a 4.**

1. **Glossário único** (Orçamento, Proposta, Pedido, Compra) e tabela de status com rótulos. Bloqueia O1, O3, O6, D3, J1.
2. Escolha do ícone da lupa (recomendo `CircleHelp`, seção 2.1).
3. **Orçamento de projeto (D1).** Abrir o diagnóstico comparativo exigido por
   `docs/migracao-orcamento-projetos-protocolo.md`. Decidir se o editor volta como etapa da
   demanda ou como tela própria, e quais recursos (link público, anexos, modelos) seguem vivos.
   Os componentes órfãos servem de ponto de partida.

**Onda 1 — Correções rápidas de alto impacto (P0/P1, esforço P; cerca de 1 semana). Sem dependências.**

- D1 provisório: remover "Abrir" em ciclo e mostrar o aviso "Edição de custos de projeto indisponível temporariamente".
- G1, G2, I2, I3: abas ativas corretas, abas de Operação e links da página inicial.
- L2: botão "Recalcular preços" com o mesmo nome em texto e botão.
- D6, L5, C2: confirmação em Emitir, Marcar revisado e Cancelar compra.
- O7, O8, O10: aviso do limite de 30, remover grupo e `aria-label` nos ícones.
- I4, A1, textos da seção 4 marcados como "Acentos": revisão ortográfica completa.
- T6: mensagem de vazio fora da rolagem.

*Benefício:* elimina ciclos e botões falsos, erros irreversíveis por clique acidental e a aparência de descuido.

**Onda 2 — Lupa e redução de texto (cerca de 1 semana). Depende da Onda 0.**

- Componente `Lupa` e `src/lib/ajuda/lupas.ts`. Propriedade `help` em `PageHeader` e
  `SectionCard`, e `lupa` em `StatCard` e cabeçalhos do `DataTable`.
- Aplicar as 28 lupas da seção 5 e os textos da seção 4.
- Retirar o botão flutuante `ContextHelp` e ligar as lupas à Central de Ajuda (J1).

*Benefício:* telas mais curtas sem perda de informação, e explicação no ponto de dúvida.

**Onda 3 — Padronização de componentes (1 a 2 semanas). Depende da Onda 2 para os cabeçalhos.**

- T1: componente `Campo` e rótulos ligados em todos os formulários. Ampliar `e2e/a11y.spec.ts`
  para demanda, orçamento laboratorial, pedido, planejamento, recebimento e histórico.
- T2: `ConfirmDialog` único. T3: padrão de `toast` e de erro. T4: `error.tsx` e `not-found.tsx`.
- G7: `PageShell` e `PageHeader` em todas as páginas. `StatCard` único (S2). `StatusBadge` e
  `formatDate` em todo o app (T7). `ui/input` e `ui/button` (T8).
- Componente único de **Etapas** (L1, C4, C5, D4).

*Benefício:* mesmo comportamento em todas as telas e acessibilidade no teclado e no leitor de tela.

**Onda 4 — Reorganização das telas densas (2 a 3 semanas). Depende das Ondas 0 e 3.**

- Início (I1, I6), Suprimentos (S1, S4), cabeçalho e ordem da demanda (D2, D5, D7) e lista de orçamentos (O2, O3, O4).
- Estoque unificado (E1, E2, E4), detalhe do pedido em abas (C4), filtros do Histórico e Fundos (H1, F1).
- Formulário de orçamento (O5, O6, O9) e Compras (C1).
- Restauração do editor de projeto (D1 definitivo), conforme o plano aprovado na Onda 0.

*Benefício:* menos rolagem e decisões mais rápidas; o foco vai para a próxima ação.

**Onda 5 — Medição e validação (contínua).**

- T9: medir o tempo de resposta (TTFB) de `/orcamento/demandas/nova`, `/suprimentos`,
  `/orcamento/demandas/[id]` e `/estoque` em produção. Otimizar só o que passar de cerca de 1 s.
- Teste rápido com 3 a 5 usuários e 4 tarefas: criar orçamento com 2 grupos de amostras; emitir
  proposta; gerar pedido de reposição; receber um item. Medir tempo, erros e pedidos de ajuda
  antes e depois das Ondas 2 a 4.
- Reavaliar as alterações do branch `codex/bugs-relatorio-20260919` após a integração (K4).

---

## 7. Apêndice: evidências e reprodução

- **Texto longo.** 95 ocorrências com 90 caracteres ou mais (varredura de nós de texto JSX e
  atributos `description/placeholder/title/...`).
- **Rótulos sem ligação com o campo.** 158 `<label>` com texto e sem `htmlFor`. Contra 35 com `htmlFor`.
- **Design system.** `PageShell` em `src/app/page.tsx`, `src/app/orcamento/demandas/page.tsx` e
  `src/app/notificacoes/page.tsx`.
- **Confirmações.** `ConfirmActionButton` em 8 arquivos. Modais próprios em `LoteAcoes`,
  `PlanoAcoes` e `UsuarioAcoes` (Radix). Sem confirmação: `emitirOrcamentoFinalDaDemanda`
  (`src/app/orcamento/demandas/[id]/page.tsx`), `cancelarPedido`
  (`src/components/compras/PedidoAcoes.tsx`) e "Marcar revisado" (`src/app/orcamento/[id]/page.tsx`).
- **Regressão do projeto.** `git show 587bed4 -- "src/app/orcamento/projetos/[id]/page.tsx"`.
  Os componentes órfãos não são importados por nenhuma rota:
  `grep -rn "FormPessoal\|FormRubricaGenerica\|EmissaoFinalForm\|ParametrosDemandaGrossUp" src --include=*.tsx | grep import`.
- **Execução em modo simulado.** `next dev` com `PLAYWRIGHT_MOCK_SUPABASE=1`,
  `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` e
  `NEXT_PUBLIC_SUPABASE_ANON_KEY=playwright-anon-key`, que são as mesmas variáveis do
  `playwright.config.ts`.
