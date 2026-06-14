import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { sair } from "@/lib/actions/auth";
import { SideNav, type NavGroup } from "@/components/layout/SideNav";

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
  description: "Custeio de análises e controle de estoque do laboratório",
};

const PAPEL_LABEL: Record<string, string> = {
  tecnico: "Técnico",
  coordenador: "Coordenador",
  gestor: "Gestor",
  admin: "Admin",
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
        ...(ehAdmin ? [{ href: "/usuarios", label: "Papéis e permissões", desc: "técnico, coordenador, gestor e admin" }] : []),
      ],
    },
  ];

  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="app-canvas min-h-dvh text-slate-900 dark:bg-zinc-950 dark:text-slate-100"
        suppressHydrationWarning
      >
        {user ? (
          <div className="flex min-h-dvh flex-col md:flex-row">
            <aside className="flex shrink-0 flex-col border-b border-slate-200/80 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950 md:sticky md:top-0 md:h-dvh md:w-64 md:border-b-0 md:border-r md:shadow-[1px_0_0_0_rgba(15,23,42,0.04),4px_0_24px_-12px_rgba(15,23,42,0.12)]">
              <Link
                href="/"
                className="border-b border-slate-100 px-5 py-4 dark:border-zinc-900"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Image
                      src="/logos/kontrol-app.png"
                      alt=""
                      width={979}
                      height={979}
                      className="h-8 w-8 shrink-0 rounded-lg object-contain shadow-sm"
                    />
                    <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">
                      Kontrol App
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Image src="/logos/gia.svg" alt="Instituto GIA" width={1767} height={1434} className="h-6 w-auto max-w-10 object-contain" />
                    <span className="h-6 w-px bg-slate-200 dark:bg-zinc-800" aria-hidden="true" />
                    <Image src="/logos/atgc.svg" alt="ATGC" width={250} height={250} className="h-7 w-auto object-contain" />
                  </span>
                </span>
              </Link>
              <SideNav groups={grupos} />
              <div className="border-t border-slate-100 px-5 py-3 dark:border-zinc-900">
                <p className="truncate text-xs font-medium text-slate-600 dark:text-slate-300">
                  {perfil?.nome || perfil?.email || user.email}
                </p>
                <div className="mt-1.5 flex items-center justify-between">
                  {perfil?.papel && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {PAPEL_LABEL[perfil.papel] ?? perfil.papel}
                    </span>
                  )}
                  <form action={sair}>
                    <button className="rounded px-2 py-1 text-xs font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-zinc-800">
                      Sair
                    </button>
                  </form>
                </div>
              </div>
            </aside>
            <div className="min-w-0 flex-1">{children}</div>
          </div>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
