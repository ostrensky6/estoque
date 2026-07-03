import Link from "next/link";

import type { CadastroConfig } from "@/lib/cadastros/config";
import { Button } from "@/components/ui/button";

type Props = {
  cadastros: CadastroConfig[];
  activeSlug?: string;
};

export function CadastrosSubnav({ cadastros, activeSlug }: Props) {
  return (
    <nav
      aria-label="Cadastros"
      className="mt-6 flex gap-2 overflow-x-auto border-y border-border py-2"
    >
      <Button
        asChild
        size="sm"
        variant={activeSlug ? "secondary" : "default"}
        className="shrink-0"
      >
        <Link href="/cadastros">Todos os cadastros</Link>
      </Button>
      {cadastros.map((cadastro) => (
        <Button
          key={cadastro.slug}
          asChild
          size="sm"
          variant={cadastro.slug === activeSlug ? "default" : "secondary"}
          className="shrink-0"
        >
          <Link href={`/cadastros/${cadastro.slug}`}>{cadastro.titulo}</Link>
        </Button>
      ))}
    </nav>
  );
}
