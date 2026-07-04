import { cn } from "@/lib/utils";

const WIDTHS = {
  default: "max-w-[1720px]",
  wide: "max-w-none",
  narrow: "max-w-5xl",
} as const;

export type PageShellWidth = keyof typeof WIDTHS;

/** Container padrão de página: largura, padding e ritmo vertical únicos no app. */
export function PageShell({
  width = "default",
  className,
  children,
}: {
  width?: PageShellWidth;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <main
      className={cn(
        "app-page-container space-y-5",
        WIDTHS[width],
        className,
      )}
    >
      {children}
    </main>
  );
}
