"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
    >
      Imprimir / PDF
    </button>
  );
}
