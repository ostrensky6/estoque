import type { Metadata } from "next";
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
  title: "Lab Custos & Estoque",
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
      title: "Orçamento",
      accent: "emerald",
      links: [
        { href: "/orcamento", label: "Orçamentos", desc: "cliente, análises e valor final" },
        { href: "/custeio", label: "Custeio por análise", desc: "tabela de custos e preços" },
        { href: "/analises", label: "Análises", desc: "painel técnico e materiais" },
      ],
    },
    {
      title: "Estoque",
      accent: "blue",
      links: [
        { href: "/planejamento", label: "Planejamento", desc: "demanda e reserva de insumos" },
        { href: "/estoque", label: "Estoque", desc: "saldo, lotes e alertas" },
        { href: "/compras", label: "Compras", desc: "reposição e pedidos" },
      ],
    },
    {
      title: "Configuração",
      accent: "slate",
      links: [
        { href: "/cadastros", label: "Cadastros", desc: "equipamentos, insumos, técnicos…" },
        { href: "/insumos", label: "Consumo por análise", desc: "grupos e modo de cobrança" },
        ...(ehGestor ? [{ href: "/auditoria", label: "Auditoria" }] : []),
        ...(ehAdmin ? [{ href: "/usuarios", label: "Usuários" }] : []),
      ],
    },
  ];

  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="app-canvas min-h-dvh text-slate-900 dark:bg-zinc-950 dark:text-slate-100">
        {user ? (
          <div className="flex min-h-dvh flex-col md:flex-row">
            <aside className="flex shrink-0 flex-col border-b border-slate-200/80 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950 md:sticky md:top-0 md:h-dvh md:w-64 md:border-b-0 md:border-r md:shadow-[1px_0_0_0_rgba(15,23,42,0.04),4px_0_24px_-12px_rgba(15,23,42,0.12)]">
              <Link
                href="/"
                className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4 dark:border-zinc-900"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-blue-600 text-sm font-bold text-white shadow-sm">
                  L
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    Lab Custos
                  </span>
                  <span className="text-[11px] font-medium text-slate-400">
                    Custeio &amp; Estoque
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
