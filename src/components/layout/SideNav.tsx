"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArchiveRestore,
  Bell,
  Boxes,
  Building2,
  Calculator,
  CalendarClock,
  ChevronDown,
  ClipboardList,
  Database,
  DollarSign,
  FileText,
  FlaskConical,
  FolderOpen,
  History,
  Inbox,
  LayoutGrid,
  LifeBuoy,
  MapPin,
  Microscope,
  PackageCheck,
  PackageSearch,
  Percent,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  TestTube2,
  Truck,
  UserCog,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type Accent = "brand" | "blue" | "amber" | "violet" | "slate";
const ICONS = {
  Activity,
  ArchiveRestore,
  Bell,
  Boxes,
  Building2,
  Calculator,
  CalendarClock,
  ClipboardList,
  Database,
  DollarSign,
  FileText,
  FlaskConical,
  FolderOpen,
  History,
  Inbox,
  LayoutGrid,
  LifeBuoy,
  MapPin,
  Microscope,
  PackageCheck,
  PackageSearch,
  Percent,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  TestTube2,
  Truck,
  UserCog,
  UsersRound,
} satisfies Record<string, LucideIcon>;

export type NavIcon = keyof typeof ICONS;
export type NavLink = {
  href: string;
  label: string;
  desc?: string;
  icon?: NavIcon;
  shortcut?: string;
};
export type NavGroup = { title: string; accent: Accent; icon?: NavIcon; links: NavLink[] };

const OPEN_GROUPS_STORAGE_KEY = "kontrol:sidenav:open-groups";

export function SideNav({
  groups,
  onNavigate,
  collapsed = false,
}: {
  groups: NavGroup[];
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const pathname = usePathname();

  function estaAtivo(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  const activeGroups = groups.filter((g) => g.links.some((l) => estaAtivo(l.href))).map((g) => g.title);
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set(activeGroups));

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(OPEN_GROUPS_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!Array.isArray(saved)) return;

      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpenGroups(new Set(saved.filter((title) => typeof title === "string")));
    } catch {
      // Preferimos o estado inicial deterministico se a preferencia local falhar.
    }
  }, []);

  function alternarGrupo(title: string) {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      try {
        window.localStorage.setItem(OPEN_GROUPS_STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        // Persistencia da navegacao e um conforto, nao um requisito funcional.
      }
      return next;
    });
  }

  if (collapsed) {
    return (
      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Navegacao compacta">
        <ul className="space-y-1">
          {groups.flatMap((g) =>
            g.links.map((l) => {
              const ativo = estaAtivo(l.href);
              const LinkIcone = l.icon ? ICONS[l.icon] : g.icon ? ICONS[g.icon] : Activity;
              return (
                <li key={`${g.title}:${l.href}:${l.label}`}>
                  <Link
                    href={l.href}
                    onClick={onNavigate}
                    title={l.label}
                    aria-label={l.label}
                    className={cn(
                      "relative flex h-10 w-10 items-center justify-center rounded-md transition-colors",
                      ativo
                        ? "bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-200"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100",
                    )}
                  >
                    {ativo && (
                      <span
                        className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-brand-500"
                        aria-hidden="true"
                      />
                    )}
                    <LinkIcone className="h-4 w-4" />
                  </Link>
                </li>
              );
            }),
          )}
        </ul>
      </nav>
    );
  }

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-3">
      {groups.map((g) => {
        const GrupoIcone = g.icon ? ICONS[g.icon] : Activity;
        const temLinkAtivo = g.links.some((l) => estaAtivo(l.href));
        const aberto = openGroups.has(g.title) || temLinkAtivo;
        return (
          <section
            key={g.title}
            className="border-b border-slate-100 py-1.5 last:border-b-0 dark:border-zinc-900"
          >
            <button
              type="button"
              onClick={() => alternarGrupo(g.title)}
              aria-expanded={aberto}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-slate-50 dark:hover:bg-zinc-900",
                aberto || temLinkAtivo
                  ? "text-slate-900 dark:text-slate-100"
                  : "text-slate-500 dark:text-zinc-400",
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border",
                  temLinkAtivo
                    ? "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-900/70 dark:bg-brand-950/30 dark:text-brand-300"
                    : "border-slate-200 bg-white text-slate-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-500",
                )}
              >
                <GrupoIcone className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[10px] font-bold uppercase tracking-wide">
                  {g.title}
                </span>
                <span className="mt-0.5 block text-[10px] font-medium text-slate-500 dark:text-zinc-400">
                  {g.links.length} itens
                </span>
              </span>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-slate-400 transition-transform dark:text-zinc-500",
                  aberto && "rotate-180",
                )}
              />
            </button>
            {aberto && (
              <ul className="ml-5 space-y-0.5 border-l border-slate-200 py-1 pl-3 dark:border-zinc-800">
                {g.links.map((l) => {
                  const ativo = estaAtivo(l.href);
                  const LinkIcone = l.icon ? ICONS[l.icon] : undefined;
                  return (
                    <li key={`${l.href}:${l.label}`}>
                      <Link
                        href={l.href}
                        onClick={onNavigate}
                        className={cn(
                          "relative flex min-h-9 items-start gap-2 rounded-md py-1.5 pl-2.5 pr-2 transition-colors",
                          ativo
                            ? "bg-brand-50 font-semibold text-brand-950 dark:bg-brand-950/30 dark:text-brand-100"
                            : "font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-100",
                        )}
                      >
                        {ativo && (
                          <span
                            className="absolute -left-[13px] top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-brand-500"
                          />
                        )}
                        {LinkIcone && (
                          <LinkIcone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-current opacity-70" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] leading-5">{l.label}</span>
                          {ativo && l.desc && (
                            <span className="mt-0.5 block text-[11px] font-normal leading-tight text-slate-500 dark:text-zinc-500">
                              {l.desc}
                            </span>
                          )}
                        </span>
                        {l.shortcut && (
                          <kbd className="mt-0.5 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                            {l.shortcut}
                          </kbd>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </nav>
  );
}
