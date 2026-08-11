import Link from "next/link";
import type { ReactNode } from "react";

export function InstitutionalPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="app-page-container">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-primary transition-colors hover:bg-muted"
        >
          <span aria-hidden="true">←</span>
          <span className="ml-2">Voltar ao Kontrol</span>
        </Link>

        <article className="mt-4 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <header>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Kontrol
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          </header>

          <div className="mt-8 space-y-6">{children}</div>
        </article>
      </div>
    </main>
  );
}
