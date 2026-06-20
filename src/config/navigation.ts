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
    linksGovernanca.push({
      href: "/auditoria",
      label: "Auditoria",
      desc: "trilha de alterações e eventos",
      icon: "History",
    });
  }

  if (ehAdmin) {
    linksGovernanca.push(
      {
        href: "/governanca/configuracoes",
        label: "Configurações",
        desc: "backups e parâmetros do sistema",
        icon: "Settings",
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
          label: "Análises/Lab.",
          desc: "propostas com análises e projetos",
          icon: "DollarSign",
          shortcut: "O",
        },
        {
          href: "/orcamento/projetos",
          label: "Projetos",
          desc: "custos, rubricas e cronograma",
          icon: "DollarSign",
        },
        {
          href: "/orcamento/parametros",
          label: "Parâmetros econômicos",
          desc: "margens, impostos e fundos",
          icon: "SlidersHorizontal",
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
