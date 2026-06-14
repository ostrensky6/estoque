"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  aceitarLote,
  bloquearLote,
  desbloquearLote,
  descartarLote,
} from "@/lib/actions/estoque";

type Acao = (fd: FormData) => Promise<{ ok: boolean; message?: string }>;

export function LoteAcoes({
  loteId,
  status,
  podeAceitar,
  podeGerir,
}: {
  loteId: number;
  status: string;
  podeAceitar: boolean;
  podeGerir: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [modal, setModal] = useState<null | "bloquear" | "descartar">(null);
  const [motivo, setMotivo] = useState("");

  function fd(extra: Record<string, string> = {}) {
    const f = new FormData();
    f.set("lote_id", String(loteId));
    for (const [k, v] of Object.entries(extra)) f.set(k, v);
    return f;
  }
  function run(action: Acao, extra: Record<string, string> = {}) {
    start(async () => {
      await action(fd(extra));
      setModal(null);
      setMotivo("");
      router.refresh();
    });
  }

  const btn = "rounded px-2 py-1 text-xs font-medium disabled:opacity-50";

  return (
    <span className="inline-flex flex-wrap gap-1">
      {status === "quarentena" && podeAceitar && (
        <button disabled={pending} onClick={() => run(aceitarLote)} className={`${btn} text-brand-700 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-950/30`}>
          Aceitar
        </button>
      )}
      {(status === "aceito" || status === "em_uso") && podeGerir && (
        <button disabled={pending} onClick={() => setModal("bloquear")} className={`${btn} text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30`}>
          Bloquear
        </button>
      )}
      {status === "bloqueado" && podeGerir && (
        <button disabled={pending} onClick={() => run(desbloquearLote)} className={`${btn} text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30`}>
          Desbloquear
        </button>
      )}
      {status !== "consumido" && status !== "descartado" && podeGerir && (
        <button disabled={pending} onClick={() => setModal("descartar")} className={`${btn} text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30`}>
          Descartar
        </button>
      )}
      {!podeAceitar && !podeGerir && status === "quarentena" && (
        <span className="text-xs text-zinc-400">aguardando aceitação</span>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 text-left">
          <div className="absolute inset-0 bg-black/40" onClick={() => !pending && setModal(null)} />
          <div className="relative w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h3 className="text-base font-semibold">
              {modal === "bloquear" ? "Bloquear lote" : "Descartar lote"}
            </h3>
            <p className="mt-1 text-xs text-zinc-500">
              {modal === "bloquear"
                ? "Informe o motivo do bloqueio (não conformidade, recall, investigação…)."
                : "Informe a justificativa do descarte. O saldo será zerado."}
            </p>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              className="mt-3 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setModal(null)} disabled={pending} className="rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">
                Cancelar
              </button>
              <button
                disabled={pending || !motivo.trim()}
                onClick={() =>
                  modal === "bloquear"
                    ? run(bloquearLote, { motivo })
                    : run(descartarLote, { justificativa: motivo })
                }
                className={`rounded-md px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50 ${modal === "bloquear" ? "bg-amber-600 hover:bg-amber-500" : "bg-red-600 hover:bg-red-500"}`}
              >
                {pending ? "…" : modal === "bloquear" ? "Bloquear" : "Descartar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </span>
  );
}
