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
        desc: "acessos, assinaturas e matriz de permissões",
        icon: "UserCog",
      },
    );
  }

  const groups: NavGroup[] = [
    {
      title: "Cadastros",
      accent: "violet",
      icon: "Database",
      links: [
        {
          href: "/cadastros",
          label: "Cadastros",
          desc: "dados mestres e bases operacionais",
          icon: "LayoutGrid",
          shortcut: "D",
        },
      ],
    },
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
          label: "Orçamentos não finalizados",
          desc: "continuar orçamentos pendentes",
          icon: "Inbox",
          shortcut: "O",
        },
        {
          href: "/orcamento/historico",
          label: "Histórico de orçamentos",
          desc: "consulta de versões concluídas",
          icon: "History",
        },
        {
          href: "/orcamento/fundos",
          label: "Fundos e taxas",
          desc: "recebimentos, impostos e fundos",
          icon: "DollarSign",
        },
      ],
    },
    {
      title: "Ajuda",
      accent: "blue",
      icon: "LifeBuoy",
      links: [
        {
          href: "/ajuda",
          label: "Central de Ajuda",
          desc: "orientações de todos os módulos do app",
          icon: "LifeBuoy",
        },
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
