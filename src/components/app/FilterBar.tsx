import { cn } from "@/lib/utils";

/** Linha padrão de busca/filtros/ações acima de listas. */
export function FilterBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("flex flex-wrap items-center gap-2", className)}>{children}</div>;
}
