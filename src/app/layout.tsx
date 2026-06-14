import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { ContextHelp } from "@/components/layout/ContextHelp";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";
import { getNavigationGroups } from "@/config/navigation";

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

  const grupos = getNavigationGroups(perfil);

  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="app-canvas min-h-dvh text-slate-900 dark:bg-zinc-950 dark:text-slate-100">
        <a href="#conteudo-principal" className="skip-link">
          Ir para o conteúdo principal
        </a>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {user ? (
            <div className="md:flex md:min-h-dvh">
              <Sidebar groups={grupos} perfil={perfil} userEmail={user.email ?? null} />
              <div id="conteudo-principal" tabIndex={-1} className="min-w-0 flex-1 outline-none">
                {children}
              </div>
              <CommandPalette groups={grupos} />
              <ContextHelp />
            </div>
          ) : (
            <div id="conteudo-principal" tabIndex={-1} className="outline-none">
              {children}
            </div>
          )}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
