import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import type { NavGroup } from "@/components/layout/SideNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kontrol App",
  description: "Custeio de análises, orçamento e controle de estoque do laboratório",
};

const ORDEM = ["tecnico", "coordenador", "gestor", "admin"];

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let perfil: { nome: string | null; email: string | null; papel: string } | null = null;
  if (user) {
    const { data } = await supabase
      .from("perfis")
      .select("nome, email, papel")
      .eq("id", user.id)
      .single();
    perfil = data;
  }

  const nivel = perfil ? ORDEM.indexOf(perfil.papel) : -1;
  const ehGestor = nivel >= ORDEM.indexOf("gestor");
  const ehAdmin = perfil?.papel === "admin";

  const grupos: NavGroup[] = [
    {
      title: "Análises",
      accent: "emerald",
      links: [
        { href: "/analises", label: "Painel de análises", desc: "base técnica da operação" },
        { href: "/analises", label: "Catálogo de análises", desc: "código, finalidade e matriz" },
        { href: "/analises", label: "Protocolos/etapas", desc: "atividades, tempos e gargalos" },
        { href: "/insumos", label: "Consumo por análise", desc: "reagentes, controles e perdas" },
        { href: "/analises", label: "Lotes/sublotes analíticos", desc: "rodadas e capacidade do protocolo" },
        { href: "/custeio", label: "Custeio por análise", desc: "custo técnico e preço base" },
        { href: "/custeio", label: "Capacidade operacional", desc: "amostras, execuções e gargalos" },
      ],
    },
    {
      title: "Estoque",
      accent: "blue",
      links: [
        { href: "/estoque", label: "Visão de estoque", desc: "saldos, lotes e rastreio" },
        { href: "/cadastros/insumos", label: "Insumos", desc: "materiais e políticas de reposição" },
        { href: "/estoque", label: "Lotes", desc: "validade, status e localização" },
        { href: "/planejamento", label: "Reservas", desc: "compromissos de consumo" },
        { href: "/planejamento", label: "Planejamento de demanda", desc: "demanda e reserva de insumos" },
        { href: "/compras", label: "Compras e reposição", desc: "solicitações e recebimentos" },
        { href: "/estoque", label: "Alertas", desc: "reposição, quarentena e vencimento" },
      ],
    },
    {
      title: "Orçamento",
      accent: "amber",
      links: [
        { href: "/orcamento/demandas", label: "Demandas/Propostas", desc: "entrada antes do orçamento formal" },
        { href: "/orcamento", label: "Orçamentos", desc: "análises, projetos ou ambos" },
        { href: "/orcamento/projetos", label: "Detalhes de projetos", desc: "custos, rubricas e cronograma" },
        { href: "/orcamento/parametros", label: "Parâmetros econômicos", desc: "margens, impostos e fundos" },
      ],
    },
    {
      title: "Cadastros",
      accent: "violet",
      links: [
        { href: "/cadastros/clientes", label: "Clientes" },
        { href: "/cadastros/projetos", label: "Projetos" },
        { href: "/cadastros/fornecedores", label: "Fornecedores" },
        { href: "/cadastros/equipamentos", label: "Equipamentos" },
        { href: "/cadastros/tecnicos", label: "Técnicos" },
        { href: "/cadastros/locais", label: "Locais" },
        { href: "/cadastros/overhead", label: "Overhead" },
        { href: "/cadastros", label: "Outros cadastros-base" },
      ],
    },
    {
      title: "Governança",
      accent: "slate",
      links: [
        ...(ehGestor ? [{ href: "/auditoria", label: "Auditoria", desc: "trilha de alterações" }] : []),
        ...(ehAdmin ? [{ href: "/usuarios", label: "Usuários", desc: "perfis e acesso" }] : []),
        ...(ehAdmin
          ? [{ href: "/usuarios", label: "Papéis e permissões", desc: "técnico, coordenador, gestor e admin" }]
          : []),
      ],
    },
  ];

  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="app-canvas min-h-dvh text-slate-900 dark:bg-zinc-950 dark:text-slate-100">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {user ? (
            <div className="md:flex md:min-h-dvh">
              <Sidebar groups={grupos} perfil={perfil} userEmail={user.email ?? null} />
              <div className="min-w-0 flex-1">{children}</div>
              <CommandPalette groups={grupos} />
            </div>
          ) : (
            children
          )}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
