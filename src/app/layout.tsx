import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import type { NavGroup } from "@/components/layout/SideNav";
import { Sidebar } from "@/components/layout/Sidebar";
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
  title: "Lab Custos & Estoque",
  description: "Custeio de análises e controle de estoque do laboratório",
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
        { href: "/parametros", label: "Parâmetros", desc: "fatores de preço e constantes" },
        ...(ehGestor ? [{ href: "/auditoria", label: "Auditoria" }] : []),
        ...(ehAdmin ? [{ href: "/usuarios", label: "Usuários" }] : []),
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
