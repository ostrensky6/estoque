import type { NavGroup, NavLink } from "@/components/layout/SideNav";

const ORDEM_PAPEIS = ["tecnico", "coordenador", "gestor", "admin"];

export type NavigationProfile = {
  papel?: string | null;
} | null;

function nivelDoPapel(papel?: string | null) {
  return papel ? ORDEM_PAPEIS.indexOf(papel) : -1;
}

export function getNavigationGroups(perfil: NavigationProfile): NavGroup[] {
  const nivel = nivelDoPapel(perfil?.papel);
  const ehGestor = nivel >= ORDEM_PAPEIS.indexOf("gestor");
  const ehAdmin = perfil?.papel === "admin";
  const linksGovernanca: NavLink[] = [
    {
      href: "/ajuda",
      label: "Ajuda",
      desc: "orientações de todos os módulos do app",
      icon: "LifeBuoy",
    },
  ];

  if (ehGestor) {
    linksGovernanca.push(
      {
        href: "/auditoria",
        label: "Auditoria",
        desc: "trilha de alterações e eventos",
        icon: "History",
      },
      {
        href: "/governanca/integridade-cadastros",
        label: "Integridade dos cadastros",
        desc: "auditoria da cadeia de custeio (prontas, alertas, bloqueadas)",
        icon: "ShieldCheck",
      },
    );
  }

  if (ehAdmin) {
    linksGovernanca.push(
      {
        href: "/governanca/backups",
        label: "Backups",
        desc: "app local e banco em nuvem",
        icon: "ArchiveRestore",
      },
      {
        href: "/usuarios",
        label: "Usuários e permissões",
        desc: "papéis técnico, coordenador, gestor e admin",
        icon: "UserCog",
      },
    );
  }

  const groups: NavGroup[] = [
    {
      title: "Operação",
      accent: "brand",
      icon: "Activity",
      links: [
        {
          href: "/analises",
          label: "Análises",
          desc: "catálogo técnico, finalidade e matriz",
          icon: "FlaskConical",
          shortcut: "A",
        },
        {
          href: "/insumos",
          label: "Insumos por análise",
          desc: "reagentes, controles e perdas",
          icon: "TestTube2",
        },
        {
          href: "/custeio",
          label: "Custeio",
          desc: "custo técnico, overhead e preço base",
          icon: "Calculator",
          shortcut: "C",
        },
      ],
    },
    {
      title: "Suprimentos",
      accent: "blue",
      icon: "PackageSearch",
      links: [
        {
          href: "/estoque",
          label: "Estoque",
          desc: "saldos, lotes, validade e rastreio",
          icon: "Boxes",
          shortcut: "E",
        },
        {
          href: "/planejamento",
          label: "Planejamento",
          desc: "demanda, reservas e consumo previsto",
          icon: "CalendarClock",
          shortcut: "P",
        },
        {
          href: "/pedido",
          label: "Pedido",
          desc: "demandas internas para compra",
          icon: "ClipboardList",
        },
        {
          href: "/compras",
          label: "Compras",
          desc: "solicitações, pedidos e recebimento",
          icon: "ShoppingCart",
        },
        {
          href: "/recebimento",
          label: "Recebimento",
          desc: "itens de pedidos por estágio até a chegada",
          icon: "PackageCheck",
        },
        {
          href: "/notificacoes",
          label: "Notificações",
          desc: "faltas, vencimentos e reposições",
          icon: "Bell",
        },
      ],
    },
    {
      title: "Orçamentos",
      accent: "amber",
      icon: "FileText",
      links: [
        {
          href: "/orcamento/demandas",
          label: "Demandas/Propostas",
          desc: "entrada antes do orçamento formal",
          icon: "Inbox",
        },
        {
          href: "/orcamento",
          label: "Orçamentos",
          desc: "visão geral do funil operacional",
          icon: "DollarSign",
          shortcut: "O",
        },
        {
          href: "/orcamento/em-elaboracao",
          label: "Em elaboração",
          desc: "custos pendentes ou em preenchimento",
          icon: "ClipboardList",
        },
        {
          href: "/orcamento/revisao",
          label: "Prontos para revisão",
          desc: "módulos preenchidos para conferência",
          icon: "FileText",
        },
        {
          href: "/orcamento/emitidos",
          label: "Emitidos/enviados",
          desc: "versões finais ativas e vencidas",
          icon: "History",
        },
        {
          href: "/orcamento/decididos",
          label: "Aprovados/recusados",
          desc: "resultados e documentos cancelados",
          icon: "ShieldCheck",
        },
        {
          href: "/orcamento/historico",
          label: "Histórico de Orçamentos",
          desc: "versões, validade e comparação",
          icon: "History",
        },
        {
          href: "/orcamento/projetos",
          label: "Projetos",
          desc: "custos próprios por projeto",
          icon: "DollarSign",
        },
        {
          href: "/orcamento/parametros",
          label: "Parâmetros econômicos",
          desc: "margens, impostos e fundos",
          icon: "SlidersHorizontal",
        },
        {
          href: "/orcamento/modelos",
          label: "Modelos/Templates",
          desc: "templates e catálogo institucional",
          icon: "LayoutGrid",
        },
        {
          href: "/orcamento/governanca",
          label: "Governança",
          desc: "permissões, eventos e auditoria por campo",
          icon: "ShieldCheck",
        },
      ],
    },
    {
      title: "Cadastros",
      accent: "violet",
      icon: "Database",
      links: [
        { href: "/cadastros/projetos", label: "Projetos", icon: "FolderOpen" },
        { href: "/cadastros/clientes", label: "Clientes", icon: "Building2" },
        {
          href: "/cadastros/insumos",
          label: "Insumos",
          desc: "materiais e políticas de reposição",
          icon: "ClipboardList",
        },
        { href: "/cadastros/equipamentos", label: "Equipamentos", icon: "Microscope" },
        { href: "/cadastros/fornecedores", label: "Fornecedores", icon: "Truck" },
        { href: "/cadastros/tecnicos", label: "Técnicos", icon: "UsersRound" },
        { href: "/cadastros/locais", label: "Locais", icon: "MapPin" },
        { href: "/cadastros/overhead", label: "Overhead", icon: "Percent" },
        { href: "/cadastros", label: "Todos os cadastros", icon: "LayoutGrid" },
      ],
    },
    {
      title: "Governança",
      accent: "slate",
      icon: "ShieldCheck",
      links: linksGovernanca,
    },
  ];

  return groups.filter((group) => group.links.length > 0);
}
