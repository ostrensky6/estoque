"use client";

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
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { moduleIsActive } from "@/config/modules";

export type Accent = "brand" | "blue" | "amber" | "violet" | "slate";
export const NAV_ICONS = {
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
  Wrench,
} satisfies Record<string, LucideIcon>;

export type NavIcon = keyof typeof NAV_ICONS;
export type NavLink = {
  href: string;
  label: string;
  desc?: string;
  icon?: NavIcon;
  shortcut?: string;
};
export type NavGroup = {
  title: string;
  accent: Accent;
  icon?: NavIcon;
  href?: string;
  desc?: string;
  activePaths?: string[];
  links: NavLink[];
};

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

  function grupoAtivo(group: NavGroup) {
    if (group.activePaths?.length) return moduleIsActive({ activePaths: group.activePaths }, pathname);
    const href = group.href ?? group.links[0]?.href;
    return Boolean(href && (pathname === href || pathname.startsWith(href + "/")));
  }

  if (collapsed) {
    return (
      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Navegacao compacta">
        <ul className="space-y-1">
          {groups.map((g) => {
            const ativo = grupoAtivo(g);
            const LinkIcone = g.icon ? NAV_ICONS[g.icon] : Activity;
            const href = g.href ?? g.links[0]?.href ?? "/";
            return (
              <li key={g.title}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  title={g.title}
                  aria-label={g.title}
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
          })}
        </ul>
      </nav>
    );
  }

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="Navegacao principal">
      {groups.map((g) => {
        const GrupoIcone = g.icon ? NAV_ICONS[g.icon] : Activity;
        const temLinkAtivo = grupoAtivo(g);
        const href = g.href ?? g.links[0]?.href ?? "/";
        return (
          <Link
            key={g.title}
            href={href}
            onClick={onNavigate}
            className={cn(
              "mb-1.5 flex items-center gap-2 rounded-md px-2.5 py-2.5 text-left transition-colors last:mb-0",
              temLinkAtivo
                ? "bg-brand-50 text-slate-950 ring-1 ring-brand-100 dark:bg-brand-950/30 dark:text-slate-100 dark:ring-brand-900/60"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-950 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-100",
            )}
          >
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border",
                temLinkAtivo
                  ? "border-brand-200 bg-white text-brand-700 dark:border-brand-900/70 dark:bg-zinc-950 dark:text-brand-300"
                  : "border-slate-200 bg-white text-slate-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-500",
              )}
            >
              <GrupoIcone className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold leading-5">{g.title}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
