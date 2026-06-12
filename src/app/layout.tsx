import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { sair } from "@/lib/actions/auth";

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

const linkCls =
  "rounded px-3 py-1.5 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800";

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

  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {user && (
          <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <nav className="mx-auto flex max-w-6xl items-center gap-1 px-6 py-3 text-sm">
              <Link href="/" className="mr-4 font-semibold">
                Lab Custos &amp; Estoque
              </Link>
              <Link href="/custeio" className={linkCls}>Custeio</Link>
              <Link href="/planejamento" className={linkCls}>Planejamento</Link>
              <Link href="/estoque" className={linkCls}>Estoque</Link>
              <Link href="/compras" className={linkCls}>Compras</Link>
              <Link href="/insumos" className={linkCls}>Insumos</Link>
              <Link href="/cadastros" className={linkCls}>Cadastros</Link>
              {ehGestor && (
                <Link href="/auditoria" className={linkCls}>Auditoria</Link>
              )}
              {ehAdmin && (
                <Link href="/usuarios" className={linkCls}>Usuários</Link>
              )}

              <div className="ml-auto flex items-center gap-3">
                <span className="text-xs text-zinc-500">
                  {perfil?.nome || perfil?.email || user.email}
                  {perfil?.papel && (
                    <span className="ml-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {PAPEL_LABEL[perfil.papel] ?? perfil.papel}
                    </span>
                  )}
                </span>
                <form action={sair}>
                  <button className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800">
                    Sair
                  </button>
                </form>
              </div>
            </nav>
          </header>
        )}
        {children}
      </body>
    </html>
  );
}
