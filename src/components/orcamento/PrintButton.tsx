"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
    >
      Imprimir / PDF
    </button>
  );
}
