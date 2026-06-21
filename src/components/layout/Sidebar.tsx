"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { SideNav, type NavGroup } from "@/components/layout/SideNav";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { sair } from "@/lib/actions/auth";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { APP_NAME, APP_VERSION, APP_YEAR } from "@/config/app";

const PAPEL_LABEL: Record<string, string> = {
  tecnico: "Técnico",
  coordenador: "Coordenador",
  gestor: "Gestor",
  admin: "Admin",
};
const SIDEBAR_COLLAPSED_STORAGE_KEY = "kontrol:sidebar:collapsed";

type Perfil = { nome: string | null; email: string | null; papel: string } | null;

function abrirPaletaComandos() {
  window.dispatchEvent(new Event("kontrol:open-command-palette"));
}

/** Conteúdo da barra (logo + navegação + rodapé), reutilizado no rail e no drawer. */
function SidebarContent({
  groups,
  perfil,
  userEmail,
  onNavigate,
  onCollapse,
}: {
  groups: NavGroup[];
  perfil: Perfil;
  userEmail: string | null;
  onNavigate?: () => void;
  onCollapse?: () => void;
}) {
  return (
    <>
      <Link
        href="/"
        onClick={onNavigate}
        className="flex items-center justify-center border-b border-slate-100 px-4 py-5 dark:border-zinc-900"
      >
        <Image
          src="/logos/kontrol-app.png"
          alt="Kontrol App"
          width={1448}
          height={1086}
          className="h-auto w-48 max-w-full object-contain"
          priority
          unoptimized
        />
      </Link>

      <div className="border-b border-slate-100 px-3 py-2.5 dark:border-zinc-900">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={abrirPaletaComandos}
            className="h-8 min-w-0 flex-1 justify-start gap-2 border-slate-200 bg-white text-sm text-slate-500 shadow-none hover:text-slate-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="min-w-0 flex-1 truncate text-left">Buscar ou executar</span>
            <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              Ctrl K
            </kbd>
          </Button>
          {onCollapse && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onCollapse}
              aria-label="Colapsar menu"
              title="Colapsar menu"
              className="hidden h-8 w-8 shrink-0 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100 md:inline-flex"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <SideNav groups={groups} onNavigate={onNavigate} />

      <div className="border-t border-slate-100 px-5 py-3 dark:border-zinc-900">
        <p className="truncate text-xs font-medium text-slate-600 dark:text-slate-300">
          {perfil?.nome || perfil?.email || userEmail}
        </p>
        <div className="mt-1.5 flex items-center justify-between">
          {perfil?.papel && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
              {PAPEL_LABEL[perfil.papel] ?? perfil.papel}
            </span>
          )}
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <form action={sair}>
              <button className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-zinc-800">
                Sair
              </button>
            </form>
          </div>
        </div>
      </div>

      <footer className="border-t border-slate-100 px-4 py-3 dark:border-zinc-900">
        <div className="flex items-center justify-center gap-4">
          <Image
            src="/logos/gia.svg"
            alt="GIA"
            width={1767}
            height={1434}
            className="h-10 w-auto object-contain opacity-80 dark:opacity-100 dark:brightness-0 dark:invert"
            unoptimized
          />
          <span className="h-9 w-px bg-slate-200 dark:bg-zinc-800" aria-hidden="true" />
          <Image
            src="/logos/atgc.svg"
            alt="ATGC"
            width={250}
            height={250}
            className="h-10 w-auto object-contain opacity-90"
            unoptimized
          />
        </div>
        <p className="mt-2 text-center text-[11px] font-medium leading-tight text-slate-600 dark:text-zinc-300">
          {APP_NAME}
        </p>
        <p className="text-center text-[10px] leading-tight text-slate-500 dark:text-zinc-400">
          Uma parceria GIA &amp; ATGC
        </p>
        <p className="mt-0.5 text-center text-[10px] leading-tight text-slate-500 dark:text-zinc-400">
          Versão {APP_VERSION} · {APP_YEAR}
        </p>
      </footer>
    </>
  );
}

function CollapsedSidebar({
  groups,
  onExpand,
}: {
  groups: NavGroup[];
  onExpand: () => void;
}) {
  return (
    <aside className="hidden shrink-0 flex-col border-r border-slate-200/80 bg-white md:sticky md:top-0 md:flex md:h-dvh md:w-14 md:items-center md:shadow-[1px_0_0_0_rgba(15,23,42,0.04),4px_0_24px_-12px_rgba(15,23,42,0.12)] dark:border-zinc-800 dark:bg-zinc-950">
      <Link
        href="/"
        className="flex h-14 w-full items-center justify-center border-b border-slate-100 dark:border-zinc-900"
        title="Inicio"
        aria-label="Inicio"
      >
        <Image
          src="/logos/kontrol-app.png"
          alt="Kontrol App"
          width={1448}
          height={1086}
          className="h-9 w-9 object-contain"
          priority
          unoptimized
        />
      </Link>

      <div className="flex w-full flex-col items-center gap-1 border-b border-slate-100 px-2 py-2 dark:border-zinc-900">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onExpand}
          aria-label="Expandir menu"
          title="Expandir menu"
          className="h-10 w-10 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={abrirPaletaComandos}
          aria-label="Buscar ou executar"
          title="Buscar ou executar"
          className="h-10 w-10 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>

      <SideNav groups={groups} collapsed />

      <div className="flex w-full flex-col items-center gap-1 border-t border-slate-100 px-2 py-3 dark:border-zinc-900">
        <ThemeToggle />
        <form action={sair}>
          <button
            type="submit"
            aria-label="Sair"
            title="Sair"
            className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-red-300"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </form>
      </div>
    </aside>
  );
}

export function Sidebar({
  groups,
  perfil,
  userEmail,
}: {
  groups: NavGroup[];
  perfil: Perfil;
  userEmail: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const fechar = () => setOpen(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true");
    } catch {
      // Preferimos o estado inicial deterministico se a preferencia local falhar.
    }
  }, []);

  function atualizarCollapsed(next: boolean) {
    setCollapsed(next);
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(next));
    } catch {
      // Persistencia da preferencia visual e opcional.
    }
  }

  return (
    <>
      {/* Barra superior (só mobile) */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 py-2.5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950 md:hidden">
        <Button
          type="button"
          aria-label="Abrir menu"
          onClick={() => setOpen(true)}
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-slate-600 dark:text-slate-300"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <Link
          href="/"
          className="flex items-center gap-2 font-bold tracking-tight text-slate-900 dark:text-slate-100"
        >
          <Image
            src="/logos/kontrol-app.png"
            alt="Kontrol App"
            width={1448}
            height={1086}
            className="h-9 w-auto max-w-32 object-contain"
            priority
            unoptimized
          />
        </Link>
        <Button
          type="button"
          aria-label="Buscar ou executar ação"
          onClick={abrirPaletaComandos}
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-slate-600 dark:text-slate-300"
        >
          <Search className="h-5 w-5" />
        </Button>
      </div>

      {/* Rail estática (desktop) */}
      {collapsed ? (
        <CollapsedSidebar groups={groups} onExpand={() => atualizarCollapsed(false)} />
      ) : (
        <aside className="hidden shrink-0 flex-col border-r border-slate-200/80 bg-white md:sticky md:top-0 md:flex md:h-dvh md:w-60 md:shadow-[1px_0_0_0_rgba(15,23,42,0.04),4px_0_24px_-12px_rgba(15,23,42,0.12)] dark:border-zinc-800 dark:bg-zinc-950">
          <SidebarContent
            groups={groups}
            perfil={perfil}
            userEmail={userEmail}
            onCollapse={() => atualizarCollapsed(true)}
          />
        </aside>
      )}

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent
          className="left-0 right-auto w-[18rem] max-w-[86vw] border-l-0 border-r border-border bg-white p-0 dark:bg-zinc-950 md:hidden"
          showCloseButton
        >
          <DrawerTitle className="sr-only">Menu de navegação</DrawerTitle>
          <DrawerDescription className="sr-only">
            Acesse módulos do Kontrol App e ações rápidas.
          </DrawerDescription>
          <SidebarContent
            groups={groups}
            perfil={perfil}
            userEmail={userEmail}
            onNavigate={fechar}
          />
        </DrawerContent>
      </Drawer>
    </>
  );
}
