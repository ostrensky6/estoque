"use client";

import { useState } from "react";
import { FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type {
  OrcamentoFinalExportInfo,
  OrcamentoFinalExportItem,
  OrcamentoFinalExportOrigem,
  OrcamentoFinalExportResumo,
} from "@/lib/orcamento/final-exporters";

type Props = {
  info: OrcamentoFinalExportInfo;
  resumo: OrcamentoFinalExportResumo;
  itens: OrcamentoFinalExportItem[];
  origens: OrcamentoFinalExportOrigem[];
};

export function ExportOrcamentoFinalButtons({ info, resumo, itens, origens }: Props) {
  const [carregando, setCarregando] = useState<"xlsx" | "docx" | null>(null);

  async function exportar(formato: "xlsx" | "docx") {
    if (carregando) return;
    setCarregando(formato);
    try {
      const mod = await import("@/lib/orcamento/final-exporters");
      if (formato === "xlsx") {
        await mod.exportOrcamentoFinalXlsx(info, resumo, itens, origens);
      } else {
        await mod.exportOrcamentoFinalDocx(info, resumo, itens, origens);
      }
      toast.success(`Orçamento final exportado em ${formato.toUpperCase()}.`);
    } catch (erro) {
      console.error(erro);
      toast.error("Não foi possível gerar o arquivo. Tente novamente.");
    } finally {
      setCarregando(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={carregando !== null}
        onClick={() => exportar("xlsx")}
      >
        <FileSpreadsheet aria-hidden />
        {carregando === "xlsx" ? "Gerando..." : "XLSX"}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={carregando !== null}
        onClick={() => exportar("docx")}
      >
        <FileText aria-hidden />
        {carregando === "docx" ? "Gerando..." : "DOCX"}
      </Button>
    </div>
  );
}
