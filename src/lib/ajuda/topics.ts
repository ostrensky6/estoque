// Central de Ajuda — orientações de uso de todos os módulos do Kontrol.
// Fonte única do conteúdo de ajuda; a tela /ajuda e a busca consomem estes tópicos.

export type AjudaSecao = {
  /** Título da seção (ex.: "Para que serve", "Passo a passo", "Boas práticas"). */
  titulo: string;
  /** Itens da seção, exibidos como lista. */
  itens: string[];
};

export type AjudaTopico = {
  /** Identificador estável para busca/seleção. */
  id: string;
  /** Título do módulo/assunto. */
  titulo: string;
  /** Grupo do menu lateral ao qual pertence. */
  grupo: string;
  /** Rota para abrir o módulo diretamente (quando aplicável). */
  href?: string;
  /** Resumo de uma linha. */
  resumo: string;
  /** Parágrafo de introdução, mais completo. */
  intro: string;
  /** Seções com orientações detalhadas. */
  secoes: AjudaSecao[];
  /** Palavras-chave extras para a busca. */
  termos?: string[];
};

export const AJUDA_TOPICOS: AjudaTopico[] = [
  // ───────────────────────────── Operação ─────────────────────────────
  {
    id: "analises",
    titulo: "Análises",
    grupo: "Operação",
    href: "/analises",
    resumo: "Catálogo técnico das análises: finalidade, matriz e método.",
    intro:
      "O módulo de Análises é o catálogo central de tudo o que o laboratório oferece. Cada análise cadastrada aqui vira a base para o cálculo de custo, para o planejamento de demanda e para os orçamentos. Manter este catálogo correto e completo é o primeiro passo para que todo o restante do sistema produza números confiáveis.",
    secoes: [
      {
        titulo: "Para que serve",
        itens: [
          "Reunir, em um só lugar, todas as análises que o laboratório executa, com sua identificação técnica.",
          "Servir de referência para custeio, planejamento e orçamentos — todos puxam dados daqui.",
          "Padronizar finalidade, matriz (tipo de amostra) e método de cada ensaio.",
        ],
      },
      {
        titulo: "Passo a passo",
        itens: [
          "Cadastre uma nova análise informando nome, finalidade e a matriz a que se aplica.",
          "Defina o método utilizado — ele orienta os insumos e o tempo técnico associados.",
          "Revise periodicamente o catálogo para retirar análises descontinuadas e atualizar métodos.",
        ],
      },
      {
        titulo: "Boas práticas",
        itens: [
          "Use nomes consistentes e evite duplicar análises que são essencialmente a mesma.",
          "Antes de criar um orçamento novo, confirme que a análise está cadastrada e atualizada.",
          "Toda alteração relevante fica registrada na Auditoria — use isso para acompanhar mudanças.",
        ],
      },
    ],
    termos: ["ensaio", "exame", "catálogo", "método", "matriz"],
  },
  {
    id: "insumos-por-analise",
    titulo: "Insumos por análise",
    grupo: "Operação",
    href: "/insumos",
    resumo: "Reagentes, controles e perdas que compõem cada análise.",
    intro:
      "Aqui você define a 'receita' de cada análise: quais reagentes e materiais ela consome, em que quantidade, quantos controles entram e qual a perda esperada. Essa composição é o que permite ao Custeio calcular o custo técnico real e ao Planejamento prever a demanda de estoque com precisão.",
    secoes: [
      {
        titulo: "Para que serve",
        itens: [
          "Descrever o consumo de insumos de cada análise, item a item.",
          "Incluir controles de qualidade e a perda percentual típica do processo.",
          "Alimentar o custo técnico (Custeio) e a previsão de consumo (Planejamento).",
        ],
      },
      {
        titulo: "Passo a passo",
        itens: [
          "Selecione a análise e adicione cada insumo com a quantidade consumida por amostra.",
          "Informe os controles necessários por corrida/lote de amostras.",
          "Defina a perda percentual esperada — o sistema ajusta o consumo previsto por cima dela.",
        ],
      },
      {
        titulo: "Boas práticas",
        itens: [
          "Mantenha as quantidades por amostra, não por lote, para o cálculo escalar corretamente.",
          "Revise a perda percentual com base no histórico real — isso evita falta ou sobra de estoque.",
          "Vincule sempre ao insumo cadastrado, para que estoque e custo conversem entre si.",
        ],
      },
    ],
    termos: ["reagente", "consumo", "perda", "controle", "receita"],
  },
  {
    id: "custeio",
    titulo: "Custeio",
    grupo: "Operação",
    href: "/custeio",
    resumo: "Custo técnico, overhead e preço base por análise.",
    intro:
      "O Custeio transforma a receita de insumos, a mão de obra e o overhead em um custo por análise e em um preço base. É também onde você simula cenários — trocar lotes, comparar grupos de insumos — para entender o impacto no custo antes de fechar um orçamento.",
    secoes: [
      {
        titulo: "Para que serve",
        itens: [
          "Calcular o custo total de cada análise: insumos + mão de obra + overhead.",
          "Gerar o preço base que será usado nos orçamentos.",
          "Simular cenários e medir o efeito de mudanças de custo antes de decidir.",
        ],
      },
      {
        titulo: "Passo a passo",
        itens: [
          "Abra a análise e confira a composição de custo já calculada a partir dos insumos.",
          "Use a simulação para trocar lotes ou comparar grupos de insumos alternativos.",
          "Confirme a margem aplicada e gere o preço base para orçamento.",
        ],
      },
      {
        titulo: "Boas práticas",
        itens: [
          "Sempre valide a margem antes de exportar um preço para proposta.",
          "Reavalie o custo quando preços de insumos mudarem significativamente.",
          "Compare cenários lado a lado em vez de alterar valores 'no olho'.",
        ],
      },
    ],
    termos: ["custo", "preço", "margem", "overhead", "simulação", "cenário"],
  },

  // ──────────────────────────── Suprimentos ────────────────────────────
  {
    id: "estoque",
    titulo: "Estoque",
    grupo: "Suprimentos",
    href: "/estoque",
    resumo: "Saldos, lotes, validade, quarentena e reposição.",
    intro:
      "O Estoque controla os saldos de insumos por lote, com validade, rastreio e quarentena. É daqui que sai o consumo das análises e é aqui que você decide o que precisa ser reposto. O bom uso da quarentena e da regra FEFO evita usar lote errado e reduz perdas por vencimento.",
    secoes: [
      {
        titulo: "Para que serve",
        itens: [
          "Acompanhar saldos por insumo e por lote, com data de validade.",
          "Controlar a quarentena: lotes recebidos só podem ser usados após liberação.",
          "Apontar o que está abaixo do ponto de reposição e precisa de compra.",
        ],
      },
      {
        titulo: "Passo a passo",
        itens: [
          "Ao receber um lote, registre-o e mantenha-o em quarentena até a conferência.",
          "Libere (aceite) o lote para que ele fique disponível para consumo.",
          "Consuma seguindo FEFO — o que vence primeiro sai primeiro.",
          "Compare o ponto de reposição atual com o sugerido para abrir pedidos de compra.",
        ],
      },
      {
        titulo: "Boas práticas",
        itens: [
          "Não pule a quarentena: usar lote não conferido compromete a rastreabilidade.",
          "Fique atento aos itens vencendo — priorize o consumo deles.",
          "Use o rastreio para saber em quais análises um lote foi utilizado.",
        ],
      },
    ],
    termos: ["saldo", "lote", "validade", "quarentena", "fefo", "reposição", "rastreio"],
  },
  {
    id: "planejamento",
    titulo: "Planejamento",
    grupo: "Suprimentos",
    href: "/planejamento",
    resumo: "Demanda, reservas e consumo previsto de insumos.",
    intro:
      "O Planejamento projeta a demanda de insumos a partir das análises que você pretende executar. Com base no número de amostras, controles e repetições, o sistema calcula o consumo previsto, cria reservas no estoque e ajuda a antecipar compras — evitando tanto a falta quanto o excesso.",
    secoes: [
      {
        titulo: "Para que serve",
        itens: [
          "Transformar um conjunto de análises previstas em demanda concreta de insumos.",
          "Reservar estoque para o que está planejado, evitando consumo conflitante.",
          "Antecipar compras com base no consumo previsto.",
        ],
      },
      {
        titulo: "Passo a passo",
        itens: [
          "Crie um plano e adicione as análises com nº de amostras, controles e repetições.",
          "Revise a demanda de insumos calculada e as reservas geradas no estoque.",
          "Acompanhe a execução e dê baixa no consumo quando as análises forem realizadas.",
        ],
      },
      {
        titulo: "Boas práticas",
        itens: [
          "Mantenha o plano realista — superestimar reserva trava estoque desnecessariamente.",
          "Libere reservas que não serão usadas para devolver saldo ao estoque.",
          "Use o plano como gatilho para abrir Pedidos internos de compra com antecedência.",
        ],
      },
    ],
    termos: ["demanda", "reserva", "previsão", "plano", "consumo"],
  },
  {
    id: "pedido",
    titulo: "Pedido",
    grupo: "Suprimentos",
    href: "/pedido",
    resumo: "Demandas internas para compra, antes da compra formal.",
    intro:
      "O módulo Pedido é a porta de entrada das demandas internas de compra do laboratório. É onde a equipe registra o que precisa (materiais ou serviços), antes de virar uma compra formal. Cada pedido tem numeração própria, passa por validação e segue um fluxo de etapas até ser encaminhado para a compra de fato.",
    secoes: [
      {
        titulo: "Para que serve",
        itens: [
          "Registrar a necessidade de materiais e serviços antes da compra formal.",
          "Organizar a fila de pedidos com numeração sequencial única (Nº 0001, 0002…), que nunca se repete.",
          "Conduzir cada pedido por etapas: rascunho, validação, formalização e encaminhamento.",
        ],
      },
      {
        titulo: "Criando e consultando",
        itens: [
          "Preencha a demanda inicial (título, projeto, urgência, fonte provável e justificativa) e clique em 'Novo pedido'.",
          "Na lista, o botão 'Itens (N)' abre um resumo rápido do que está sendo solicitado, sem precisar abrir o pedido.",
          "A coluna 'Nº' mostra o número sequencial do pedido; clique para abrir o detalhe completo.",
        ],
      },
      {
        titulo: "Editando itens e o pedido",
        itens: [
          "Em 'Materiais e serviços', use 'Adicionar item' para incluir cada material/serviço (especificação, modelo, volume, quantidade e orçamento prévio).",
          "Cada item tem 'Editar' (abre um formulário preenchido) e 'Remover'.",
          "Itens ficam livres para alteração em rascunho/ajuste; coordenador ou superior também pode alterá-los nas demais etapas, exceto quando o pedido está cancelado ou concluído.",
          "No topo do pedido, 'Editar' altera os dados gerais e 'Excluir' apaga o pedido inteiro (apenas coordenador+).",
        ],
      },
      {
        titulo: "Fluxo de aprovação",
        itens: [
          "Envie para validação quando o pedido estiver completo; pendências aparecem destacadas.",
          "Após validado, formalize em Compras para gerar o pedido formal.",
          "Acompanhe documentos, comunicações, aprovações e a linha do tempo dentro do pedido.",
        ],
      },
    ],
    termos: ["solicitação", "demanda interna", "material", "serviço", "compra", "numeração", "itens", "editar", "excluir"],
  },
  {
    id: "compras",
    titulo: "Compras",
    grupo: "Suprimentos",
    href: "/compras",
    resumo: "Solicitação, aprovação, envio e recebimento de pedidos.",
    intro:
      "Compras cuida do ciclo formal de aquisição: da solicitação à entrada do material no estoque. Ele recebe pedidos vindos do módulo Pedido ou de reposição automática, organiza a aprovação e o envio ao fornecedor, e registra o recebimento — que alimenta a quarentena no Estoque.",
    secoes: [
      {
        titulo: "Para que serve",
        itens: [
          "Conduzir o ciclo de compra: solicitação → aprovação → envio → recebimento.",
          "Centralizar pedidos formais, inclusive os gerados por reposição automática.",
          "Registrar a entrada de itens, que segue para conferência no Estoque.",
        ],
      },
      {
        titulo: "Passo a passo",
        itens: [
          "Revise as solicitações e os rascunhos automáticos de reposição.",
          "Aprove e envie o pedido ao fornecedor.",
          "Ao chegar, receba os itens pelo próprio pedido para dar entrada no estoque.",
          "Confira a quarentena após o recebimento antes de liberar o uso.",
        ],
      },
      {
        titulo: "Boas práticas",
        itens: [
          "Aproveite os rascunhos automáticos para não esquecer reposições críticas.",
          "Receba sempre pelo pedido — assim o rastreio do lote fica completo.",
          "Cheque divergências de quantidade no recebimento antes de fechar o pedido.",
        ],
      },
    ],
    termos: ["fornecedor", "recebimento", "aprovação", "pedido de compra"],
  },

  // ───────────────────────────── Orçamentos ────────────────────────────
  {
    id: "orcamento-demandas",
    titulo: "Demandas / Propostas",
    grupo: "Orçamentos",
    href: "/orcamento/demandas",
    resumo: "Entrada de pedidos de cliente antes do orçamento formal.",
    intro:
      "Este é o estágio inicial do funil comercial: registrar e qualificar a demanda do cliente antes de transformá-la em um orçamento formal. Serve para não perder oportunidades e para reunir as informações necessárias (escopo, prazo, contato) que vão alimentar a proposta.",
    secoes: [
      {
        titulo: "Para que serve",
        itens: [
          "Captar o pedido do cliente antes da proposta formal.",
          "Qualificar a demanda com escopo, prazo e dados de contato.",
          "Servir de origem para o orçamento de Análises/Lab. ou de Projetos.",
        ],
      },
      {
        titulo: "Passo a passo",
        itens: [
          "Registre a demanda com o que o cliente solicitou e o contexto.",
          "Complemente com escopo e prazo para viabilizar o orçamento.",
          "Converta a demanda qualificada em uma proposta formal quando pronta.",
        ],
      },
    ],
    termos: ["lead", "cliente", "proposta", "demanda comercial"],
  },
  {
    id: "orcamento-analises",
    titulo: "Orçamento de Análises/Lab.",
    grupo: "Orçamentos",
    href: "/orcamento",
    resumo: "Propostas com análises e projetos, com snapshot de custo e preço.",
    intro:
      "Aqui você monta a proposta comercial com base nas análises e seus preços. O orçamento guarda um 'retrato' (snapshot) do custo e do preço no momento da emissão, para que aprovações futuras não sejam afetadas por mudanças posteriores de custo. Ao ser aprovado, pode gerar um planejamento de execução.",
    secoes: [
      {
        titulo: "Para que serve",
        itens: [
          "Elaborar propostas com análises e quantidades, usando o preço do Custeio.",
          "Congelar custo e preço no momento da emissão (snapshot).",
          "Conectar a venda à execução, gerando planejamento na aprovação.",
        ],
      },
      {
        titulo: "Passo a passo",
        itens: [
          "Inclua as análises e as quantidades desejadas na proposta.",
          "Revise os parâmetros econômicos (margens, impostos) antes de emitir.",
          "Emita a proposta e, ao aprovar, gere o planejamento correspondente.",
        ],
      },
      {
        titulo: "Boas práticas",
        itens: [
          "Confira o snapshot antes de enviar — ele é o que vale para o cliente.",
          "Garanta que os parâmetros econômicos estejam atualizados antes de emitir em lote.",
        ],
      },
    ],
    termos: ["proposta", "preço", "snapshot", "aprovação", "venda"],
  },
  {
    id: "orcamento-projetos",
    titulo: "Orçamento de Projetos",
    grupo: "Orçamentos",
    href: "/orcamento/projetos",
    resumo: "Custos, rubricas e cronograma de projetos.",
    intro:
      "O orçamento de Projetos é voltado a propostas mais estruturadas, organizadas por rubricas (materiais, serviços, diárias, equipamentos) e com cronograma. Suporta templates reutilizáveis, anexos por orçamento e links públicos de aprovação, facilitando a negociação com órgãos e instituições.",
    secoes: [
      {
        titulo: "Para que serve",
        itens: [
          "Estruturar projetos por rubricas e fases, com custos e cronograma.",
          "Reaproveitar estruturas com templates para projetos semelhantes.",
          "Compartilhar o orçamento para aprovação externa via link público.",
        ],
      },
      {
        titulo: "Passo a passo",
        itens: [
          "Crie o projeto e organize os itens por rubrica.",
          "Use um template como ponto de partida quando fizer sentido.",
          "Anexe documentos e gere o link público de aprovação quando for negociar.",
        ],
      },
      {
        titulo: "Boas práticas",
        itens: [
          "Mantenha rubricas padronizadas para comparar projetos com facilidade.",
          "Versione anexos por orçamento para preservar o histórico de negociação.",
        ],
      },
    ],
    termos: ["projeto", "rubrica", "cronograma", "diárias", "template", "aprovação"],
  },
  {
    id: "orcamento-parametros",
    titulo: "Parâmetros econômicos",
    grupo: "Orçamentos",
    href: "/orcamento/parametros",
    resumo: "Margens, impostos e fundos aplicados aos orçamentos.",
    intro:
      "Os parâmetros econômicos definem as regras financeiras que o sistema aplica ao calcular preços: margens de lucro, impostos e fundos institucionais. Por afetarem todos os novos orçamentos, devem ser revisados com cuidado, especialmente antes de campanhas comerciais ou mudanças de política de preço.",
    secoes: [
      {
        titulo: "Para que serve",
        itens: [
          "Centralizar margens, impostos e fundos usados no cálculo de preço.",
          "Garantir consistência de preços entre todos os orçamentos.",
        ],
      },
      {
        titulo: "Boas práticas",
        itens: [
          "Revise os parâmetros antes de emitir orçamentos em lote.",
          "Lembre-se: mudanças aqui afetam novos orçamentos, não os já emitidos (que têm snapshot).",
          "Documente o motivo de alterações relevantes — elas ficam na Auditoria.",
        ],
      },
    ],
    termos: ["margem", "imposto", "fundo", "preço", "parâmetro"],
  },

  // ────────────────────────────── Cadastros ────────────────────────────
  {
    id: "cadastros",
    titulo: "Cadastros",
    grupo: "Cadastros",
    href: "/cadastros",
    resumo: "Bases de apoio: projetos, clientes, insumos, equipamentos e mais.",
    intro:
      "Os Cadastros são as bases de apoio que sustentam todo o app: projetos, clientes, insumos, equipamentos, fornecedores, técnicos, locais e overhead. Como praticamente todos os outros módulos consultam esses dados, mantê-los corretos e sem duplicidade é essencial para a confiabilidade de estoque, custeio e orçamentos.",
    secoes: [
      {
        titulo: "O que você cadastra aqui",
        itens: [
          "Projetos e clientes que aparecem em pedidos e orçamentos.",
          "Insumos e suas políticas de reposição, usados por estoque e custeio.",
          "Equipamentos, fornecedores, técnicos, locais e taxas de overhead.",
        ],
      },
      {
        titulo: "Passo a passo",
        itens: [
          "Acesse o cadastro desejado pelo menu ou por 'Todos os cadastros'.",
          "Crie ou edite o registro com os campos solicitados.",
          "Revise periodicamente para corrigir duplicidades e dados desatualizados.",
        ],
      },
      {
        titulo: "Boas práticas",
        itens: [
          "Evite duplicar fornecedores, insumos ou clientes — isso polui relatórios.",
          "Mantenha as políticas de reposição dos insumos atualizadas para a sugestão de compra funcionar.",
        ],
      },
    ],
    termos: ["cadastro", "projeto", "cliente", "fornecedor", "equipamento", "técnico", "local", "overhead"],
  },

  // ───────────────────────────── Governança ────────────────────────────
  {
    id: "auditoria",
    titulo: "Auditoria",
    grupo: "Governança",
    href: "/auditoria",
    resumo: "Trilha de alterações e eventos do sistema (gestor+).",
    intro:
      "A Auditoria é a trilha completa de quem alterou o quê e quando, em toda a base. Ela existe para garantir rastreabilidade e conformidade: qualquer criação, edição ou exclusão relevante fica registrada com o usuário responsável. É a primeira parada quando algo muda e ninguém sabe explicar por quê.",
    secoes: [
      {
        titulo: "Para que serve",
        itens: [
          "Mostrar o histórico de alterações e eventos do sistema.",
          "Associar cada mudança ao usuário que a executou.",
          "Apoiar investigações e exigências de conformidade.",
        ],
      },
      {
        titulo: "Como usar",
        itens: [
          "Filtre por entidade, período ou usuário para localizar um evento.",
          "Use a trilha para reconstruir a sequência de mudanças de um registro.",
        ],
      },
    ],
    termos: ["log", "trilha", "histórico", "evento", "alteração"],
  },
  {
    id: "backups",
    titulo: "Backups",
    grupo: "Governança",
    href: "/governanca/backups",
    resumo: "Cópias do app local e do banco em nuvem (admin).",
    intro:
      "O módulo de Backups concentra as cópias de segurança da aplicação e do banco. É a sua rede de proteção contra perdas: mantenha uma rotina de backup e, principalmente, gere uma cópia antes de qualquer mudança grande ou migração.",
    secoes: [
      {
        titulo: "Para que serve",
        itens: [
          "Acompanhar e gerar backups do banco e da aplicação.",
          "Reduzir o risco de perda de dados em falhas ou mudanças.",
        ],
      },
      {
        titulo: "Boas práticas",
        itens: [
          "Faça backup antes de migrações, atualizações ou operações em massa.",
          "Verifique periodicamente se as cópias estão sendo geradas como esperado.",
        ],
      },
    ],
    termos: ["backup", "cópia", "restauração", "segurança"],
  },
  {
    id: "usuarios",
    titulo: "Usuários e permissões",
    grupo: "Governança",
    href: "/usuarios",
    resumo: "Papéis técnico, coordenador, gestor e admin (admin).",
    intro:
      "Aqui você gerencia quem acessa o sistema e o que cada um pode fazer. O papel atribuído define o nível de permissão, numa hierarquia crescente. Ações sensíveis — como excluir registros ou aprovar etapas — exigem papel de coordenador ou superior.",
    secoes: [
      {
        titulo: "Hierarquia de papéis",
        itens: [
          "Técnico: operação do dia a dia (registrar, adicionar itens, executar tarefas básicas).",
          "Coordenador: valida, aprova e pode editar/excluir em mais situações.",
          "Gestor: visão de governança, incluindo Auditoria.",
          "Admin: controle total, incluindo usuários e backups.",
        ],
      },
      {
        titulo: "Como usar",
        itens: [
          "Crie o usuário e atribua o papel adequado à função dele.",
          "Revise os papéis quando alguém mudar de responsabilidade.",
          "Lembre-se de que muitas ações sensíveis exigem coordenador ou superior.",
        ],
      },
    ],
    termos: ["usuário", "papel", "permissão", "perfil", "acesso", "rls"],
  },

  // ─────────────────────────────── Geral ───────────────────────────────
  {
    id: "navegacao-geral",
    titulo: "Navegação e atalhos",
    grupo: "Geral",
    resumo: "Como circular pelo app com rapidez e produtividade.",
    intro:
      "Algumas ferramentas atravessam todo o app e ajudam você a trabalhar mais rápido: o menu lateral agrupado por área, a busca de comandos (Command Palette), os filtros das tabelas e o tema claro/escuro. Dominar esses recursos reduz cliques e torna o uso diário muito mais fluido.",
    secoes: [
      {
        titulo: "Recursos de navegação",
        itens: [
          "Menu lateral: acessa os módulos, organizados por área (Operação, Suprimentos, etc.).",
          "Command Palette: busca de comandos para navegar rápido pelo teclado.",
          "Tabelas com busca e filtros: encontre registros nas filas sem rolar tudo.",
          "Tema claro/escuro: acompanha o sistema e pode ser alternado.",
        ],
      },
      {
        titulo: "Dicas de produtividade",
        itens: [
          "Use a busca de cada tabela em vez de procurar manualmente.",
          "Aprenda os atalhos dos módulos mais usados para abrir tudo pelo teclado.",
          "Esta Central de Ajuda também está acessível pelo botão flutuante de ajuda.",
        ],
      },
    ],
    termos: ["atalho", "command palette", "busca", "tema", "navegação", "menu"],
  },
];

export const AJUDA_GRUPOS = [
  "Operação",
  "Suprimentos",
  "Orçamentos",
  "Cadastros",
  "Governança",
  "Geral",
] as const;
