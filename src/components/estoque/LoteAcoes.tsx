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
  critico,
  podeAceitar,
  podeGerir,
}: {
  loteId: number;
  status: string;
  quantidadeAtual: number;
  unidade: string;
  critico: boolean;
  podeAceitar: boolean;
  podeGerir: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [modal, setModal] = useState<null | "aceitar" | "bloquear" | "descartar" | "baixa" | "ajuste">(null);
  const [motivo, setMotivo] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [responsavel, setResponsavel] = useState("");
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
      setResponsavel("");
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
        setResponsavel("");
        router.refresh();
      }
    });
  }

  const btn = "rounded px-2 py-1 text-xs font-medium disabled:opacity-50";
  const loteAtivo = status === "aceito" || status === "em_uso";

  return (
    <span className="inline-flex flex-wrap gap-1">
      {status === "quarentena" && podeAceitar && (
        <button disabled={pending} onClick={() => setModal("aceitar")} className={`${btn} text-brand-700 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-950/30`}>
          Aceitar
        </button>
      )}
      {(status === "aceito" || status === "em_uso") && podeGerir && (
        <button disabled={pending} onClick={() => setModal("bloquear")} className={`${btn} text-warning-strong hover:bg-warning-soft`}>
          Bloquear
        </button>
      )}
      {loteAtivo && (
        <button disabled={pending} onClick={() => setModal("baixa")} className={`${btn} text-danger-strong hover:bg-danger-soft`}>
          Baixa
        </button>
      )}
      {loteAtivo && podeGerir && (
        <button disabled={pending} onClick={() => setModal("ajuste")} className={`${btn} text-info-strong hover:bg-info-soft`}>
          Ajustar
        </button>
      )}
      {status === "bloqueado" && podeGerir && (
        <button disabled={pending} onClick={() => run(desbloquearLote)} className={`${btn} text-info-strong hover:bg-info-soft`}>
          Desbloquear
        </button>
      )}
      {status !== "consumido" && status !== "descartado" && podeGerir && (
        <button disabled={pending} onClick={() => setModal("descartar")} className={`${btn} text-danger-strong hover:bg-danger-soft`}>
          Descartar
        </button>
      )}
      {!podeAceitar && !podeGerir && status === "quarentena" && (
        <span className="text-xs text-muted-foreground/80">aguardando aceitação</span>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 text-left">
          <div className="absolute inset-0 bg-black/40" onClick={() => !pending && setModal(null)} />
          <div className="relative w-full max-w-sm rounded-xl bg-card p-5 shadow-xl">
            <h3 className="text-base font-semibold">
              {modal === "aceitar"
                ? "Aceitar lote"
                : modal === "bloquear"
                ? "Bloquear lote"
                : modal === "descartar"
                  ? "Descartar lote"
                  : modal === "baixa"
                    ? "Baixa manual"
                    : "Ajustar saldo"}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {modal === "aceitar"
                ? critico
                  ? "Material crítico precisa de responsável e critério de aceite antes de ficar disponível."
                  : "Registre a liberação do lote para uso."
                : modal === "bloquear"
                ? "Informe o motivo do bloqueio (não conformidade, recall, investigação…)."
                : modal === "descartar"
                  ? "Informe a justificativa do descarte. O saldo será zerado."
                  : modal === "baixa"
                    ? `Registre consumo extra, perda ou uso fora de plano. Saldo atual: ${quantidadeAtual} ${unidade}.`
                    : `Informe o saldo contado no inventário. Saldo atual: ${quantidadeAtual} ${unidade}.`}
            </p>
            {(modal === "baixa" || modal === "ajuste") && (
              <div className="mt-3">
                <label className="block text-xs font-medium text-muted-foreground">
                  {modal === "baixa" ? "Quantidade a baixar" : "Saldo contado"}
                </label>
                <input
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  type="number"
                  step="any"
                  min="0"
                  max={modal === "baixa" ? quantidadeAtual : undefined}
                  className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm font-medium text-brand-700 dark:text-brand-300"
                />
                {state.errors?.quantidade && <p className="mt-1 text-xs text-danger-strong">{state.errors.quantidade}</p>}
                {state.errors?.quantidade_nova && <p className="mt-1 text-xs text-danger-strong">{state.errors.quantidade_nova}</p>}
              </div>
            )}
            {modal === "aceitar" && (
              <div className="mt-3">
                <label className="block text-xs font-medium text-muted-foreground">
                  Responsável {critico && <span className="text-danger-strong">*</span>}
                </label>
                <input
                  value={responsavel}
                  onChange={(e) => setResponsavel(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm font-medium text-brand-700 dark:text-brand-300"
                />
              </div>
            )}
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              placeholder={
                modal === "aceitar"
                  ? "Critério de aceite"
                  : modal === "baixa"
                    ? "Ex.: consumo extra, perda, quebra..."
                    : "Motivo"
              }
              className="mt-3 w-full rounded-md border border-input bg-card px-3 py-2 text-sm font-medium text-brand-700 dark:text-brand-300"
            />
            {state.errors?.motivo && <p className="mt-1 text-xs text-danger-strong">{state.errors.motivo}</p>}
            {state.message && !state.ok && (
              <p className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger-strong">
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
                  setResponsavel("");
                }}
                disabled={pending}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                disabled={
                  pending ||
                  (modal !== "aceitar" && !motivo.trim()) ||
                  (modal === "aceitar" && critico && (!motivo.trim() || !responsavel.trim())) ||
                  ((modal === "baixa" || modal === "ajuste") && !quantidade)
                }
                onClick={() => {
                  if (modal === "aceitar") run(aceitarLote, { criterio: motivo, responsavel });
                  if (modal === "bloquear") run(bloquearLote, { motivo });
                  if (modal === "descartar") run(descartarLote, { justificativa: motivo });
                  if (modal === "baixa") runState(baixarManualLote, { motivo, quantidade });
                  if (modal === "ajuste") runState(ajustarSaldoLote, { motivo, quantidade_nova: quantidade });
                }}
                className={`rounded-md px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50 ${
                  modal === "bloquear"
                    ? "bg-warning-strong hover:bg-warning-strong/90"
                    : modal === "aceitar"
                      ? "bg-brand-600 hover:bg-brand-500"
                    : modal === "ajuste"
                      ? "bg-primary hover:bg-primary/90"
                      : "bg-destructive hover:bg-destructive/90"
                }`}
              >
                {pending
                  ? "…"
                  : modal === "aceitar"
                    ? "Aceitar"
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
