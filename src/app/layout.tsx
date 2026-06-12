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
      links: [
        { href: "/orcamento", label: "Orçamentos", desc: "cliente, análises e valor final" },
        { href: "/custeio", label: "Custeio por análise", desc: "tabela de custos e preços" },
        { href: "/analises", label: "Análises", desc: "painel técnico e materiais" },
      ],
    },
    {
      title: "Estoque",
      links: [
        { href: "/planejamento", label: "Planejamento", desc: "demanda e reserva de insumos" },
        { href: "/estoque", label: "Estoque", desc: "saldo, lotes e alertas" },
        { href: "/compras", label: "Compras", desc: "reposição e pedidos" },
      ],
    },
    {
      title: "Configuração",
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
      <body className="min-h-dvh bg-zinc-50 dark:bg-zinc-950">
        {user ? (
          <div className="flex min-h-dvh flex-col md:flex-row">
            <aside className="flex shrink-0 flex-col border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 md:sticky md:top-0 md:h-dvh md:w-60 md:border-b-0 md:border-r">
              <Link
                href="/"
                className="block border-b border-zinc-100 px-5 py-4 font-semibold tracking-tight dark:border-zinc-900"
              >
                Lab Custos &amp; Estoque
              </Link>
              <SideNav groups={grupos} />
              <div className="border-t border-zinc-100 px-5 py-3 dark:border-zinc-900">
                <p className="truncate text-xs text-zinc-500">
                  {perfil?.nome || perfil?.email || user.email}
                </p>
                <div className="mt-1 flex items-center justify-between">
                  {perfil?.papel && (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {PAPEL_LABEL[perfil.papel] ?? perfil.papel}
                    </span>
                  )}
                  <form action={sair}>
                    <button className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800">
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
