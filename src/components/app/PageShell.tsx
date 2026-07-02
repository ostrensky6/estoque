import { cn } from "@/lib/utils";

const WIDTHS = {
  default: "max-w-6xl",
  wide: "max-w-none",
  narrow: "max-w-3xl",
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
        "mx-auto w-full space-y-6 px-4 py-6 sm:px-6 sm:py-8",
        WIDTHS[width],
        className,
      )}
    >
      {children}
    </main>
  );
}
