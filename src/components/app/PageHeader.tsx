import { Breadcrumbs, type BreadcrumbItem } from "@/components/common/Breadcrumbs";
import { cn } from "@/lib/utils";

/** Cabeçalho padrão: breadcrumbs, h1 na escala fixa, meta (badges) e ações à direita. */
export function PageHeader({
  breadcrumbs,
  title,
  description,
  meta,
  actions,
  className,
}: {
  breadcrumbs?: BreadcrumbItem[];
  title: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("space-y-3", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
            {meta}
          </div>
          {description && (
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </header>
  );
}
