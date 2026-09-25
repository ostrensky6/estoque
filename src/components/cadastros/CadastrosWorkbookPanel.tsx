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
const LIMITE_MENSAGENS = 50;

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
      inalterados: acc.inalterados + item.inalterados,
      ignorados: acc.ignorados + item.ignorados,
      avisos: acc.avisos + item.avisos.length,
    }),
    { inseridos: 0, atualizados: 0, inalterados: 0, ignorados: 0, avisos: 0 },
  );
  const erros = state.resumo?.flatMap((item) => item.erros.map((erro) => `${item.aba} · ${erro}`)) ?? [];
  const avisos = state.resumo?.flatMap((item) => item.avisos.map((aviso) => `${item.aba} · ${aviso}`)) ?? [];

  return (
    <Card className="mt-6">
      <CardHeader className="gap-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Todos os cadastros</CardTitle>
            <CardDescription>
              Baixe a planilha XLSX (uma aba por cadastro e instruções), preencha e importe. A
              importação só adiciona e atualiza: nada é excluído, e células vazias mantêm o valor atual.
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
          <p
            role={state.ok ? "status" : "alert"}
            className={state.ok ? "mt-4 text-sm text-muted-foreground" : "mt-4 text-sm text-destructive"}
          >
            {state.message}
          </p>
        )}

        {totais && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="secondary">{totais.inseridos} inseridos</Badge>
            <Badge variant="secondary">{totais.atualizados} atualizados</Badge>
            <Badge variant="muted">{totais.inalterados} sem alteração</Badge>
            <Badge variant={totais.ignorados ? "secondary" : "muted"} className={totais.ignorados ? "text-destructive" : undefined}>
              {totais.ignorados} com erro
            </Badge>
            <Badge variant={totais.avisos ? "secondary" : "muted"}>{totais.avisos} avisos</Badge>
          </div>
        )}

        {state.resumo && (
          <div className="mt-4 overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead className="bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Aba</th>
                  <th className="px-3 py-2 font-medium">Inseridos</th>
                  <th className="px-3 py-2 font-medium">Atualizados</th>
                  <th className="px-3 py-2 font-medium">Sem alteração</th>
                  <th className="px-3 py-2 font-medium">Com erro</th>
                </tr>
              </thead>
              <tbody>
                {state.resumo.map((item) => (
                  <tr key={item.aba} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{item.aba}</td>
                    <td className="px-3 py-2">{item.inseridos}</td>
                    <td className="px-3 py-2">{item.atualizados}</td>
                    <td className="px-3 py-2">{item.inalterados}</td>
                    <td className="px-3 py-2">{item.ignorados}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {erros.length > 0 && (
          <details className="mt-4 rounded-md border border-border p-3 text-xs" open>
            <summary className="cursor-pointer font-medium text-destructive">
              Erros ({erros.length}) — estas linhas não foram importadas
            </summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              {erros.slice(0, LIMITE_MENSAGENS).map((erro, index) => (
                <li key={index}>{erro}</li>
              ))}
              {erros.length > LIMITE_MENSAGENS && <li>… e mais {erros.length - LIMITE_MENSAGENS}.</li>}
            </ul>
          </details>
        )}

        {avisos.length > 0 && (
          <details className="mt-3 rounded-md border border-border p-3 text-xs">
            <summary className="cursor-pointer font-medium">Avisos ({avisos.length})</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              {avisos.slice(0, LIMITE_MENSAGENS).map((aviso, index) => (
                <li key={index}>{aviso}</li>
              ))}
              {avisos.length > LIMITE_MENSAGENS && <li>… e mais {avisos.length - LIMITE_MENSAGENS}.</li>}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
