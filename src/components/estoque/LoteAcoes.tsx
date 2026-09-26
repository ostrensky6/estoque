"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  aceitarLote,
  ajustarSaldoLote,
  bloquearLote,
  desbloquearLote,
  descartarLote,
  estornarRecebimentoLote,
} from "@/lib/actions/estoque";
import type { FormState } from "@/lib/actions/cadastros";
import { DarBaixaDialog } from "@/components/estoque/DarBaixaDialog";
import { HelpTip } from "@/components/common/HelpTip";
import type { ModeloQuantidadeLote } from "@/lib/estoque/baixa";

type Acao = (fd: FormData) => Promise<{ ok: boolean; message?: string }>;
type ActionState = (prev: FormState, fd: FormData) => Promise<FormState>;

export function LoteAcoes({
  loteId,
  codigoLote = `LOTE-${loteId}`,
  status,
  quantidadeAtual,
  unidade,
  critico,
  validade = null,
  rotuloBaixa = "Baixa",
  reservado = 0,
  modeloQuantidade = "LEGADO",
  estornoDiretoPermitido = false,
  podeAceitar,
  podeGerir,
}: {
  loteId: number;
  codigoLote?: string;
  status: string;
  quantidadeAtual: number;
  unidade: string;
  critico: boolean;
  /** validade efetiva (aaaa-mm-dd) */
  validade?: string | null;
  vencido?: boolean;
  /** texto do botão de baixa (na página do lote: "Dar baixa") */
  rotuloBaixa?: string;
  reservado?: number;
  modeloQuantidade?: ModeloQuantidadeLote;
  estornoDiretoPermitido?: boolean;
  /** coordenador ou acima: aceita lotes e ajusta saldo (ajustar_saldo_lote exige coordenador) */
  podeAceitar: boolean;
  /** gestor ou acima: bloqueia/desbloqueia e descarta */
  podeGerir: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const executando = useRef(false);
  const [modal, setModal] = useState<null | "aceitar" | "estornar" | "bloquear" | "descartar" | "ajuste">(null);
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
    if (executando.current) return;
    executando.current = true;
    start(async () => {
      try {
        const res = await action(fd(extra));
        setState(res);
        if (res.ok) {
          setModal(null);
          setMotivo("");
          setQuantidade("");
          setResponsavel("");
          setState({ ok: false });
          router.refresh();
        }
      } catch (error) {
        setState({
          ok: false,
          message: error instanceof Error ? error.message : "Não foi possível concluir a ação.",
        });
      } finally {
        executando.current = false;
      }
    });
  }
  function runState(action: ActionState, extra: Record<string, string>) {
    if (executando.current) return;
    executando.current = true;
    start(async () => {
      try {
        const res = await action({ ok: false }, fd(extra));
        setState(res);
        if (res.ok) {
          setModal(null);
          setMotivo("");
          setQuantidade("");
          setResponsavel("");
          router.refresh();
        }
      } catch (error) {
        setState({
          ok: false,
          message: error instanceof Error ? error.message : "Não foi possível concluir a ação.",
        });
      } finally {
        executando.current = false;
      }
    });
  }

  const btn = "rounded px-2 py-1 text-xs font-medium disabled:opacity-50";
  const loteAtivo = status === "aceito" || status === "em_uso";
  const emEmbalagens = modeloQuantidade === "EMBALAGEM_FECHADA";

  return (
    <span className="inline-flex flex-wrap gap-1">
      {status === "quarentena" && podeAceitar && (
        <>
          <button disabled={pending} onClick={() => setModal("aceitar")} className={`${btn} text-brand-700 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-950/30`}>
            Aceitar
          </button>
          {estornoDiretoPermitido && (
            <button disabled={pending} onClick={() => setModal("estornar")} className={`${btn} text-danger-strong hover:bg-danger-soft`}>
              Estornar entrada
            </button>
          )}
        </>
      )}
      {(status === "aceito" || status === "em_uso") && podeGerir && (
        <button disabled={pending} onClick={() => setModal("bloquear")} className={`${btn} text-warning-strong hover:bg-warning-soft`}>
          Bloquear
        </button>
      )}
      {/* vencido também: o diálogo só aceita o motivo Vencimento (0117) */}
      {loteAtivo && (
        <DarBaixaDialog
          lotes={[{ id: loteId, codigoLote, validade, quantidadeAtual, reservado, modeloQuantidade, status }]}
          unidade={unidade}
          triggerLabel={rotuloBaixa}
          triggerClassName={`${btn} text-danger-strong hover:bg-danger-soft`}
        />
      )}
      {loteAtivo && podeAceitar && (
        <button disabled={pending} onClick={() => setModal("ajuste")} className={`${btn} text-info-strong hover:bg-info-soft`}>
          Ajustar
        </button>
      )}
      {status === "bloqueado" && podeGerir && (
        <button aria-busy={pending} disabled={pending} onClick={() => run(desbloquearLote)} className={`${btn} text-info-strong hover:bg-info-soft`}>
          {pending ? "Desbloqueando…" : "Desbloquear"}
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
      {state.message && !state.ok && !modal && (
        <span role="alert" className="basis-full rounded-md bg-danger-soft px-3 py-2 text-sm text-danger-strong">
          {state.message}
        </span>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 text-left">
          <div className="absolute inset-0 bg-black/40" onClick={() => !pending && setModal(null)} />
          <div className="relative w-full max-w-sm rounded-xl bg-card p-5 shadow-xl">
            <div className="flex items-center gap-1">
              <h3 className="text-base font-semibold">
                {modal === "aceitar"
                  ? "Aceitar lote"
                  : modal === "estornar"
                    ? "Estornar entrada"
                  : modal === "bloquear"
                  ? "Bloquear lote"
                  : modal === "descartar"
                    ? "Descartar lote"
                    : "Ajustar saldo"}
              </h3>
              {modal === "estornar" && (
                <HelpTip title="Estorno de entrada">
                  <p>
                    Corrige uma entrada lançada por engano <b>sem apagar o histórico</b>: um movimento
                    compensatório zera o saldo do lote.
                  </p>
                  <p>Só aparece para lotes em quarentena que não vieram de um pedido.</p>
                </HelpTip>
              )}
              {modal === "ajuste" && (
                <HelpTip title="Ajuste de saldo">
                  <p>
                    Use quando a contagem física não bate com o sistema. O novo saldo substitui o
                    atual e a <b>diferença</b> fica registrada com o motivo.
                  </p>
                </HelpTip>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {modal === "aceitar"
                ? critico
                  ? "Material crítico precisa de responsável e critério de aceite antes de ficar disponível."
                  : "Registre a liberação do lote para uso."
                : modal === "estornar"
                  ? "O saldo do lote será zerado; o histórico é mantido."
                : modal === "bloquear"
                ? "Informe o motivo do bloqueio (não conformidade, recall, investigação…)."
                : modal === "descartar"
                  ? "Informe a justificativa do descarte. O saldo será zerado."
                  : `Informe o saldo contado no inventário. Saldo atual: ${quantidadeAtual} ${emEmbalagens ? "embalagem(ns)" : unidade}.`}
            </p>
            {modal === "ajuste" && (
              <div className="mt-3">
                <label htmlFor={`lote-${loteId}-saldo-contado`} className="block text-xs font-medium text-muted-foreground">
                  Saldo contado{emEmbalagens ? " (embalagens inteiras)" : ""}
                </label>
                <input
                  id={`lote-${loteId}-saldo-contado`}
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  type="number"
                  step={emEmbalagens ? 1 : "any"}
                  min="0"
                  className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm font-medium text-brand-700 dark:text-brand-300"
                />
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
                modal === "aceitar" ? "Critério de aceite" : "Motivo"
              }
              className="mt-3 w-full rounded-md border border-input bg-card px-3 py-2 text-sm font-medium text-brand-700 dark:text-brand-300"
            />
            {state.errors?.motivo && <p className="mt-1 text-xs text-danger-strong">{state.errors.motivo}</p>}
            {state.message && !state.ok && (
              <p role="alert" className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger-strong">
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
                aria-busy={pending}
                disabled={
                  pending ||
                  (modal !== "aceitar" && !motivo.trim()) ||
                  (modal === "aceitar" && critico && (!motivo.trim() || !responsavel.trim())) ||
                  (modal === "ajuste" && !quantidade)
                }
                onClick={() => {
                  if (modal === "aceitar") run(aceitarLote, { criterio: motivo, responsavel });
                  if (modal === "estornar") runState(estornarRecebimentoLote, { motivo });
                  if (modal === "bloquear") run(bloquearLote, { motivo });
                  if (modal === "descartar") run(descartarLote, { justificativa: motivo });
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
                  ? "Processando…"
                   : modal === "aceitar"
                     ? "Aceitar"
                   : modal === "estornar"
                     ? "Confirmar estorno"
                   : modal === "bloquear"
                    ? "Bloquear"
                    : modal === "descartar"
                      ? "Descartar"
                      : "Ajustar saldo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </span>
  );
}
