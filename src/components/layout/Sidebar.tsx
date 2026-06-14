"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { SideNav, type NavGroup } from "@/components/layout/SideNav";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { sair } from "@/lib/actions/auth";

const PAPEL_LABEL: Record<string, string> = {
  tecnico: "Técnico",
  coordenador: "Coordenador",
  gestor: "Gestor",
  admin: "Admin",
};

type Perfil = { nome: string | null; email: string | null; papel: string } | null;

/** Conteúdo da barra (logo + navegação + rodapé), reutilizado no rail e no drawer. */
function SidebarContent({
  groups,
  perfil,
  userEmail,
  onNavigate,
}: {
  groups: NavGroup[];
  perfil: Perfil;
  userEmail: string | null;
  onNavigate?: () => void;
}) {
  return (
    <>
      <Link
        href="/"
        onClick={onNavigate}
        className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4 dark:border-zinc-900"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-blue-600 text-sm font-bold text-white shadow-sm">
          L
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Lab Custos
          </span>
          <span className="text-[11px] font-medium text-slate-400">Custeio &amp; Estoque</span>
        </span>
      </Link>

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
              <button className="rounded px-2 py-1 text-xs font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-zinc-800">
                Sair
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
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
  const fechar = () => setOpen(false);

  return (
    <>
      {/* Barra superior (só mobile) */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 py-2.5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950 md:hidden">
        <button
          type="button"
          aria-label="Abrir menu"
          onClick={() => setOpen(true)}
          className="rounded p-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-zinc-800"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link
          href="/"
          className="flex items-center gap-2 font-bold tracking-tight text-slate-900 dark:text-slate-100"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-blue-600 text-xs font-bold text-white">
            L
          </span>
          <span className="text-sm">Lab Custos</span>
        </Link>
        <ThemeToggle />
      </div>

      {/* Rail estática (desktop) */}
      <aside className="hidden shrink-0 flex-col border-r border-slate-200/80 bg-white md:sticky md:top-0 md:flex md:h-dvh md:w-64 md:shadow-[1px_0_0_0_rgba(15,23,42,0.04),4px_0_24px_-12px_rgba(15,23,42,0.12)] dark:border-zinc-800 dark:bg-zinc-950">
        <SidebarContent groups={groups} perfil={perfil} userEmail={userEmail} />
      </aside>

      {/* Drawer (mobile) */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={fechar}
          aria-hidden="true"
        />
      )}
      <aside
        className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-white shadow-xl transition-transform duration-200 ease-out md:hidden dark:bg-zinc-950"
        style={{ transform: open ? "translateX(0)" : "translateX(-100%)" }}
        aria-hidden={!open}
      >
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={fechar}
          className="absolute right-3 top-3.5 z-10 rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-zinc-800"
        >
          <X className="h-5 w-5" />
        </button>
        <SidebarContent
          groups={groups}
          perfil={perfil}
          userEmail={userEmail}
          onNavigate={fechar}
        />
      </aside>
    </>
  );
}
