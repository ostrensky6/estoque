"use client";

import * as React from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

function nomeDoCabecalho(disposition: string | null, fallback: string) {
  if (!disposition) return fallback;
  const utf8 = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (utf8) return decodeURIComponent(utf8);
  return disposition.match(/filename="?([^";]+)"?/i)?.[1] ?? fallback;
}

/**
 * Baixa um arquivo gerado no servidor (XLSX, CSV) de forma confiável também no
 * celular: busca com a sessão, mostra "Gerando…" enquanto o servidor monta o
 * arquivo e informa o erro em vez de falhar em silêncio. Não usa <Link>, que
 * tentaria navegar pelo roteador do Next até uma rota de arquivo.
 */
export function DownloadButton({
  href,
  fileName,
  children = "Baixar planilha",
  variant = "outline",
  size,
  className,
}: {
  href: string;
  fileName: string;
  children?: React.ReactNode;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
}) {
  const [baixando, setBaixando] = React.useState(false);

  async function baixar() {
    if (baixando) return;
    setBaixando(true);
    try {
      const resposta = await fetch(href, { credentials: "same-origin", cache: "no-store" });
      if (!resposta.ok) {
        const texto = (await resposta.text().catch(() => "")).slice(0, 200);
        throw new Error(texto || `Falha ao gerar o arquivo (${resposta.status}).`);
      }
      const blob = await resposta.blob();
      const nome = nomeDoCabecalho(resposta.headers.get("content-disposition"), fileName);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = nome;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      // alguns navegadores móveis leem o blob depois do clique
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      toast.success("Arquivo gerado", { description: nome });
    } catch (erro) {
      toast.error("Não foi possível baixar o arquivo", {
        description: erro instanceof Error ? erro.message : undefined,
      });
    } finally {
      setBaixando(false);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={baixar}
      disabled={baixando}
      aria-busy={baixando || undefined}
    >
      {baixando ? <Loader2 className="animate-spin" /> : <Download />}
      {baixando ? "Gerando…" : children}
    </Button>
  );
}
