"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { NAV_ICONS } from "@/components/layout/SideNav";
import type { AppModule, ModuleChild } from "@/config/modules";
import { cn } from "@/lib/utils";

function childIsActive(child: ModuleChild, pathname: string, exactActiveHref?: string) {
  if (exactActiveHref) return child.href === exactActiveHref;
  return pathname === child.href || pathname.startsWith(child.href + "/");
}

export function ModuleTopNavClient({
  appModule,
  items,
}: {
  appModule: AppModule;
  items: ModuleChild[];
}) {
  const pathname = usePathname();
  const exactActiveHref = items.find((child) => child.href === pathname)?.href;

  return (
    <nav
      aria-label={`Navegacao de ${appModule.label}`}
      className="border-b border-border bg-card/90 py-2 backdrop-blur"
    >
      <div className="app-topnav-container flex gap-2 overflow-x-auto">
        {items.map((child) => {
          const ativo = childIsActive(child, pathname, exactActiveHref);
          const Icon = child.icon ? NAV_ICONS[child.icon] : undefined;
          return (
            <Button
              key={child.href}
              asChild
              size="sm"
              variant={ativo ? "default" : "outline"}
              className={cn(
                "shrink-0 gap-2",
                !ativo && "app-nav-level-2 dark:bg-card dark:hover:bg-primary/10",
              )}
            >
              <Link href={child.href} aria-current={ativo ? "page" : undefined} title={child.desc}>
                {Icon && <Icon className="h-3.5 w-3.5" />}
                <span>{child.label}</span>
              </Link>
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
