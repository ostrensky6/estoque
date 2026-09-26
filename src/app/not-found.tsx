import Link from "next/link";
import { SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="app-page-container">
      <div className="mx-auto mt-10 max-w-lg rounded-xl border border-border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <SearchX className="h-5 w-5" aria-hidden />
        </div>
        <h1 className="mt-4 text-lg font-semibold">Página não encontrada</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          O endereço não existe ou o registro foi removido. Use o menu ou volte ao início.
        </p>
        <div className="mt-5 flex justify-center">
          <Button asChild>
            <Link href="/">Ir para o início</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
