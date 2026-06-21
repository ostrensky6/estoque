"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  aceitarLote,
  ajustarSaldoLote,
  baixarManualLote,
  bloquearLote,
  desbloquearLote,
  descartarLote,
} from "@/lib/actions/estoque";
import type { FormState } from "@/lib/actions/cadastros";

type Acao = (fd: FormData) => Promise<{ ok: boolean; message?: string }>;
type ActionState = (prev: FormState, fd: FormData) => Promise<FormState>;

export function LoteAcoes({
  loteId,
  status,
  quantidadeAtual,
  unidade,
  podeAceitar,
  podeGerir,
}: {
  loteId: number;
  status: string;
  quantidadeAtual: number;
  unidade: string;
  podeAceitar: boolean;
  podeGerir: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [modal, setModal] = useState<null | "bloquear" | "descartar" | "baixa" | "ajuste">(null);
  const [motivo, setMotivo] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [state, setState] = useState<FormState>({ ok: false });

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
      setQuantidade("");
      setState({ ok: false });
      router.refresh();
    });
  }
  function runState(action: ActionState, extra: Record<string, string>) {
    start(async () => {
      const res = await action({ ok: false }, fd(extra));
      setState(res);
      if (res.ok) {
        setModal(null);
        setMotivo("");
        setQuantidade("");
        router.refresh();
      }
    });
  }

  const btn = "rounded px-2 py-1 text-xs font-medium disabled:opacity-50";
  const loteAtivo = status === "aceito" || status === "em_uso";

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
      {loteAtivo && (
        <button disabled={pending} onClick={() => setModal("baixa")} className={`${btn} text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30`}>
          Baixa
        </button>
      )}
      {loteAtivo && podeGerir && (
        <button disabled={pending} onClick={() => setModal("ajuste")} className={`${btn} text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30`}>
          Ajustar
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
              {modal === "bloquear"
                ? "Bloquear lote"
                : modal === "descartar"
                  ? "Descartar lote"
                  : modal === "baixa"
                    ? "Baixa manual"
                    : "Ajustar saldo"}
            </h3>
            <p className="mt-1 text-xs text-zinc-500">
              {modal === "bloquear"
                ? "Informe o motivo do bloqueio (não conformidade, recall, investigação…)."
                : modal === "descartar"
                  ? "Informe a justificativa do descarte. O saldo será zerado."
                  : modal === "baixa"
                    ? `Registre consumo extra, perda ou uso fora de plano. Saldo atual: ${quantidadeAtual} ${unidade}.`
                    : `Informe o saldo contado no inventário. Saldo atual: ${quantidadeAtual} ${unidade}.`}
            </p>
            {(modal === "baixa" || modal === "ajuste") && (
              <div className="mt-3">
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  {modal === "baixa" ? "Quantidade a baixar" : "Saldo contado"}
                </label>
                <input
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  type="number"
                  step="any"
                  min="0"
                  max={modal === "baixa" ? quantidadeAtual : undefined}
                  className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                />
                {state.errors?.quantidade && <p className="mt-1 text-xs text-red-600">{state.errors.quantidade}</p>}
                {state.errors?.quantidade_nova && <p className="mt-1 text-xs text-red-600">{state.errors.quantidade_nova}</p>}
              </div>
            )}
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              placeholder={modal === "baixa" ? "Ex.: consumo extra, perda, quebra..." : "Motivo"}
              className="mt-3 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            {state.errors?.motivo && <p className="mt-1 text-xs text-red-600">{state.errors.motivo}</p>}
            {state.message && !state.ok && (
              <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
                {state.message}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  setModal(null);
                  setState({ ok: false });
                  setMotivo("");
                  setQuantidade("");
                }}
                disabled={pending}
                className="rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <button
                disabled={pending || !motivo.trim() || ((modal === "baixa" || modal === "ajuste") && !quantidade)}
                onClick={() => {
                  if (modal === "bloquear") run(bloquearLote, { motivo });
                  if (modal === "descartar") run(descartarLote, { justificativa: motivo });
                  if (modal === "baixa") runState(baixarManualLote, { motivo, quantidade });
                  if (modal === "ajuste") runState(ajustarSaldoLote, { motivo, quantidade_nova: quantidade });
                }}
                className={`rounded-md px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50 ${
                  modal === "bloquear"
                    ? "bg-amber-600 hover:bg-amber-500"
                    : modal === "ajuste"
                      ? "bg-blue-600 hover:bg-blue-500"
                      : "bg-red-600 hover:bg-red-500"
                }`}
              >
                {pending
                  ? "…"
                  : modal === "bloquear"
                    ? "Bloquear"
                    : modal === "descartar"
                      ? "Descartar"
                      : modal === "baixa"
                        ? "Registrar baixa"
                        : "Ajustar saldo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </span>
  );
}
