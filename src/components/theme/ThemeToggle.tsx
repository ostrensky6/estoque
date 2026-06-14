"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

/**
 * Alterna claro/escuro. Os ícones são mostrados por CSS (variante `dark:`),
 * então não há estado nem mismatch de hidratação — a classe `.dark` que o
 * next-themes injeta antes da pintura já decide qual ícone aparece.
 */
export function ThemeToggle() {
  const { setTheme } = useTheme();

  return (
    <button
      type="button"
      aria-label="Alternar tema claro/escuro"
      onClick={() =>
        setTheme(document.documentElement.classList.contains("dark") ? "light" : "dark")
      }
      className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-zinc-800 dark:hover:text-slate-200"
    >
      <Sun className="hidden h-4 w-4 dark:block" />
      <Moon className="h-4 w-4 dark:hidden" />
      <span className="sr-only">Alternar tema</span>
    </button>
  );
}
