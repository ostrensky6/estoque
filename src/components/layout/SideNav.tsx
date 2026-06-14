"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type Accent = "emerald" | "blue" | "amber" | "violet" | "slate";
export type NavLink = { href: string; label: string; desc?: string };
export type NavGroup = { title: string; accent: Accent; links: NavLink[] };

const ACCENT: Record<
  Accent,
  { dot: string; header: string; activeBg: string; activeText: string; bar: string; hover: string }
> = {
  emerald: {
    dot: "bg-emerald-500",
    header: "text-emerald-700 dark:text-emerald-400",
    activeBg: "bg-emerald-50 dark:bg-emerald-950/40",
    activeText: "text-emerald-900 dark:text-emerald-200",
    bar: "bg-emerald-500",
    hover: "hover:bg-emerald-50/70 dark:hover:bg-emerald-950/30",
  },
  amber: {
    dot: "bg-amber-500",
    header: "text-amber-700 dark:text-amber-400",
    activeBg: "bg-amber-50 dark:bg-amber-950/40",
    activeText: "text-amber-900 dark:text-amber-200",
    bar: "bg-amber-500",
    hover: "hover:bg-amber-50/70 dark:hover:bg-amber-950/30",
  },
  violet: {
    dot: "bg-violet-500",
    header: "text-violet-700 dark:text-violet-400",
    activeBg: "bg-violet-50 dark:bg-violet-950/40",
    activeText: "text-violet-900 dark:text-violet-200",
    bar: "bg-violet-500",
    hover: "hover:bg-violet-50/70 dark:hover:bg-violet-950/30",
  },
  blue: {
    dot: "bg-blue-500",
    header: "text-blue-700 dark:text-blue-400",
    activeBg: "bg-blue-50 dark:bg-blue-950/40",
    activeText: "text-blue-900 dark:text-blue-200",
    bar: "bg-blue-500",
    hover: "hover:bg-blue-50/70 dark:hover:bg-blue-950/30",
  },
  slate: {
    dot: "bg-slate-400",
    header: "text-slate-600 dark:text-slate-400",
    activeBg: "bg-slate-100 dark:bg-slate-800/50",
    activeText: "text-slate-900 dark:text-slate-100",
    bar: "bg-slate-400",
    hover: "hover:bg-slate-100/70 dark:hover:bg-slate-800/30",
  },
};

export function SideNav({
  groups,
  onNavigate,
}: {
  groups: NavGroup[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
      {groups.map((g) => {
        const c = ACCENT[g.accent];
        const destacarTitulo = ["Análises", "Estoque", "Orçamento"].includes(g.title);
        return (
          <section
            key={g.title}
            className="rounded-lg border border-slate-200/80 bg-white/50 p-2 shadow-[0_1px_0_rgba(15,23,42,0.03)] dark:border-zinc-800/90 dark:bg-zinc-950/40"
          >
            <h3
              className={`flex items-center gap-2 px-2 py-1 text-[13px] ${
                destacarTitulo ? "font-extrabold" : "font-bold"
              } uppercase tracking-wide ${c.header}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
              {g.title}
            </h3>
            <ul className="mt-2 space-y-0.5">
              {g.links.map((l) => {
                const ativo =
                  pathname === l.href || pathname.startsWith(l.href + "/");
                return (
                  <li key={`${l.href}:${l.label}`}>
                    <Link
                      href={l.href}
                      onClick={onNavigate}
                      className={`relative block rounded-md py-1.5 pl-3.5 pr-2 text-sm transition-colors ${
                        ativo
                          ? `${c.activeBg} font-semibold ${c.activeText}`
                          : `font-medium text-slate-600 dark:text-slate-300 ${c.hover}`
                      }`}
                    >
                      {ativo && (
                        <span
                          className={`absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full ${c.bar}`}
                        />
                      )}
                      {l.label}
                      {l.desc && (
                        <span className="mt-0.5 block text-[11px] font-normal leading-tight text-slate-400 dark:text-slate-500">
                          {l.desc}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </nav>
  );
}
