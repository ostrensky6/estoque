"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { Download, Upload } from "lucide-react";
import { importarCadastrosWorkbook, type ImportCadastrosState } from "@/lib/actions/cadastros";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const initialState: ImportCadastrosState = { ok: false };

export function CadastrosWorkbookPanel() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(importarCadastrosWorkbook, initialState);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  const totais = state.resumo?.reduce(
    (acc, item) => ({
      inseridos: acc.inseridos + item.inseridos,
      atualizados: acc.atualizados + item.atualizados,
      removidos: acc.removidos + item.removidos,
      ignorados: acc.ignorados + item.ignorados,
      erros: acc.erros + item.erros.length,
      bloqueados: acc.bloqueados + item.naoRemovidosPorVinculo.length,
    }),
    { inseridos: 0, atualizados: 0, removidos: 0, ignorados: 0, erros: 0, bloqueados: 0 },
  );

  return (
    <Card className="mt-6">
      <CardHeader className="gap-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Todos os cadastros</CardTitle>
            <CardDescription>
              Baixe ou importe uma planilha XLSX única, com uma aba por cadastro.
            </CardDescription>
          </div>
          <Button asChild variant="outline">
            <Link href="/cadastros/export">
              <Download />
              Baixar XLSX
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={action} className="flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1">
            <Label htmlFor="cadastros-xlsx">Planilha preenchida</Label>
            <Input
              id="cadastros-xlsx"
              name="arquivo"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="mt-1"
              required
            />
          </div>
          <Button type="submit" disabled={pending}>
            <Upload />
            {pending ? "Importando..." : "Importar XLSX"}
          </Button>
        </form>

        {state.message && (
          <p className={state.ok ? "mt-4 text-sm text-muted-foreground" : "mt-4 text-sm text-destructive"}>
            {state.message}
          </p>
        )}

        {totais && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="secondary">{totais.inseridos} inseridos</Badge>
            <Badge variant="secondary">{totais.atualizados} atualizados</Badge>
            <Badge variant="secondary">{totais.removidos} removidos</Badge>
            <Badge variant={totais.ignorados ? "secondary" : "muted"} className={totais.ignorados ? "text-destructive" : undefined}>
              {totais.ignorados} ignorados
            </Badge>
            <Badge variant={totais.bloqueados ? "secondary" : "muted"}>
              {totais.bloqueados} não removidos por vínculo
            </Badge>
            <Badge variant={totais.erros ? "secondary" : "muted"} className={totais.erros ? "text-destructive" : undefined}>
              {totais.erros} erros
            </Badge>
          </div>
        )}

        {state.resumo && (
          <div className="mt-4 overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Aba</th>
                  <th className="px-3 py-2 font-medium">Inseridos</th>
                  <th className="px-3 py-2 font-medium">Atualizados</th>
                  <th className="px-3 py-2 font-medium">Removidos</th>
                  <th className="px-3 py-2 font-medium">Ignorados</th>
                  <th className="px-3 py-2 font-medium">Observações</th>
                </tr>
              </thead>
              <tbody>
                {state.resumo.map((item) => (
                  <tr key={item.aba} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{item.aba}</td>
                    <td className="px-3 py-2">{item.inseridos}</td>
                    <td className="px-3 py-2">{item.atualizados}</td>
                    <td className="px-3 py-2">{item.removidos}</td>
                    <td className="px-3 py-2">{item.ignorados}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {[...item.naoRemovidosPorVinculo, ...item.erros].slice(0, 3).join(" ") || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
