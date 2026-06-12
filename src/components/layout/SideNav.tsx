"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavLink = { href: string; label: string; desc?: string };
export type NavGroup = { title: string; links: NavLink[] };

export function SideNav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
      {groups.map((g) => (
        <div key={g.title}>
          <h3 className="px-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
            {g.title}
          </h3>
          <ul className="mt-1.5 space-y-0.5">
            {g.links.map((l) => {
              const ativo =
                pathname === l.href || pathname.startsWith(l.href + "/");
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className={`block rounded-md px-2 py-1.5 text-sm transition-colors ${
                      ativo
                        ? "bg-emerald-50 font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {l.label}
                    {l.desc && (
                      <span className="block text-[11px] font-normal text-zinc-400 dark:text-zinc-500">
                        {l.desc}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
