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
  const linksGovernanca: NavLink[] = [];

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
      accent: "emerald",
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
          href: "/compras",
          label: "Compras",
          desc: "solicitações, pedidos e recebimento",
          icon: "ShoppingCart",
        },
        {
          href: "/cadastros/insumos",
          label: "Cadastro de insumos",
          desc: "materiais e políticas de reposição",
          icon: "ClipboardList",
        },
      ],
    },
    {
      title: "Comercial",
      accent: "amber",
      icon: "FileText",
      links: [
        {
          href: "/projetos",
          label: "Projetos",
          desc: "visão 360° por projeto",
          icon: "LayoutDashboard",
        },
        {
          href: "/orcamento/demandas",
          label: "Demandas/Propostas",
          desc: "entrada antes do orçamento formal",
          icon: "Inbox",
        },
        {
          href: "/orcamento",
          label: "Orçamentos",
          desc: "propostas com análises e projetos",
          icon: "ReceiptText",
          shortcut: "O",
        },
        {
          href: "/orcamento/projetos",
          label: "Orçamentos de projetos",
          desc: "custos, rubricas e cronograma",
          icon: "FolderKanban",
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
        { href: "/cadastros/clientes", label: "Clientes", icon: "Building2" },
        { href: "/cadastros/projetos", label: "Projetos", icon: "FolderOpen" },
        { href: "/cadastros/fornecedores", label: "Fornecedores", icon: "Truck" },
        { href: "/cadastros/equipamentos", label: "Equipamentos", icon: "Microscope" },
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
