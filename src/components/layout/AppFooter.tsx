import Image from "next/image";
import Link from "next/link";

import { KontrolLogo } from "@/components/brand/KontrolLogo";
import { APP_VERSION, APP_YEAR } from "@/config/app";

const links = [
  { href: "/privacidade", label: "Privacidade" },
  { href: "/termos", label: "Termos" },
  { href: "/suporte", label: "Suporte" },
];

export function AppFooter() {
  return (
    <footer
      aria-label="Informações institucionais"
      className="border-t border-border/70 bg-card"
    >
      <div className="app-topnav-container py-5">
        <div className="flex flex-col items-center gap-5 text-center md:flex-row md:justify-between md:text-left">
          <div className="flex flex-col items-center gap-2 md:items-start">
            <KontrolLogo
              alt="Kontrol"
              className="h-auto w-28 max-w-full object-contain"
            />
            <p className="text-xs font-medium text-muted-foreground">
              Uma parceria GIA &amp; ATGC
            </p>
            <p className="text-[11px] text-muted-foreground">
              Versão {APP_VERSION} · {APP_YEAR}
            </p>
          </div>

          <div className="flex items-center justify-center gap-4" aria-hidden="true">
            <Image
              src="/logos/gia.svg"
              alt=""
              width={1767}
              height={1434}
              className="h-9 w-auto object-contain opacity-80 dark:opacity-100"
              unoptimized
            />
            <Image
              src="/logos/atgc.svg"
              alt=""
              width={250}
              height={250}
              className="h-9 w-auto object-contain opacity-90"
              unoptimized
            />
          </div>
        </div>

        <nav
          aria-label="Links institucionais"
          className="mt-5 flex flex-wrap items-center justify-center gap-x-2 border-t border-border/70 pt-2 md:justify-start"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex min-h-11 items-center rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
