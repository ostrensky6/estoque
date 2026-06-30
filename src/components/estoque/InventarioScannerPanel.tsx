"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Camera, Keyboard, Loader2, ScanLine } from "lucide-react";

import { registrarContagemInventario } from "@/lib/actions/inventario";
import {
  resolverCodigoInventario,
  type ResultadoScannerInventario,
} from "@/lib/actions/scanner";
import {
  iniciarLeitorCamera,
  type ScannerCameraControls,
} from "@/components/scanner/zxing-adapter";
import { calcularDivergenciaInventario } from "@/lib/inventario/contagem";
import type { FormState } from "@/lib/actions/cadastros";

type StatusCamera = "parada" | "iniciando" | "ativa" | "erro";

export type InventarioCicloOpcao = {
  id: number;
  nome: string;
};

export type InventarioLocalOpcao = {
  id: number;
  nome: string;
};

export type InventarioLoteOpcao = {
  id: number;
  codigoLote: string | null;
  quantidadeAtual: number;
  localId: number | null;
  localNome: string | null;
  insumoDescricao: string | null;
  unidade: string | null;
};

export function InventarioScannerPanel({
  ciclos,
  locais,
  lotes,
}: {
  ciclos: InventarioCicloOpcao[];
  locais: InventarioLocalOpcao[];
  lotes: InventarioLoteOpcao[];
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<ScannerCameraControls | null>(null);
  const [scanPending, startScanTransition] = useTransition();
  const [submitPending, startSubmitTransition] = useTransition();
  const [codigoScanner, setCodigoScanner] = useState("");
  const [resultadoScanner, setResultadoScanner] = useState<ResultadoScannerInventario | null>(null);
  const [cameraStatus, setCameraStatus] = useState<StatusCamera>("parada");
  const [cameraMessage, setCameraMessage] = useState<string | null>(null);
  const [cicloId, setCicloId] = useState(ciclos[0]?.id ? String(ciclos[0].id) : "");
  const [localId, setLocalId] = useState("");
  const [loteId, setLoteId] = useState("");
  const [quantidadeContada, setQuantidadeContada] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [state, setState] = useState<FormState>({ ok: false });

  const loteSelecionado = useMemo(
    () => lotes.find((lote) => String(lote.id) === loteId) ?? null,
    [loteId, lotes],
  );
  const quantidadeSistema = loteSelecionado?.quantidadeAtual ?? 0;
  const quantidadeNumero = quantidadeContada === "" ? Number.NaN : Number(quantidadeContada);
  const divergencia = Number.isFinite(quantidadeNumero)
    ? calcularDivergenciaInventario(quantidadeSistema, quantidadeNumero)
    : null;

  function pararCamera(status: StatusCamera = "parada") {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setCameraStatus(status);
  }

  useEffect(() => {
    return () => {
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, []);

  function aplicarLote(lote: InventarioLoteOpcao) {
    setLoteId(String(lote.id));
    setQuantidadeContada(String(lote.quantidadeAtual));
    if (lote.localId) setLocalId(String(lote.localId));
  }

  function aplicarResultado(resultado: ResultadoScannerInventario) {
    setResultadoScanner(resultado);
    if (!resultado.ok || !resultado.encontrado) return;

    if (resultado.tipo === "local") {
      setLocalId(String(resultado.id));
      return;
    }

    aplicarLote({
      id: resultado.id,
      codigoLote: resultado.loteCodigo,
      quantidadeAtual: resultado.quantidadeAtual,
      localId: resultado.localId,
      localNome: resultado.localNome,
      insumoDescricao: resultado.insumoDescricao,
      unidade: resultado.unidade,
    });
  }

  function resolverScanner(codigo: string) {
    const codigoLimpo = codigo.trim();
    if (!codigoLimpo) {
      setResultadoScanner({ ok: false, message: "Informe um codigo para resolver." });
      return;
    }

    startScanTransition(async () => {
      const resultado = await resolverCodigoInventario(codigoLimpo);
      aplicarResultado(resultado);
    });
  }

  async function iniciarCamera() {
    const video = videoRef.current;
    if (!video) return;

    pararCamera();
    setCameraStatus("iniciando");
    setCameraMessage(null);

    try {
      controlsRef.current = await iniciarLeitorCamera(video, (codigoLido) => {
        setCodigoScanner(codigoLido);
        resolverScanner(codigoLido);
      });
      setCameraStatus("ativa");
    } catch (error) {
      setCameraStatus("erro");
      setCameraMessage(
        error instanceof Error
          ? error.message
          : "Nao foi possivel acessar a camera. Use a entrada manual.",
      );
    }
  }

  function salvarContagem(formData: FormData) {
    setState({ ok: false });
    startSubmitTransition(async () => {
      const result = await registrarContagemInventario({ ok: false }, formData);
      setState(result);
      if (result.ok) {
        setJustificativa("");
        router.refresh();
      }
    });
  }

  const inp =
    "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-950";

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
          <ScanLine className="h-4 w-4 text-brand-600 dark:text-brand-300" />
          Contagem por scanner
        </h2>
        <span className="rounded-md bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {cameraStatus === "ativa"
            ? "Camera ativa"
            : cameraStatus === "iniciando"
              ? "Iniciando camera"
              : "Manual disponivel"}
        </span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <div>
          <div className="overflow-hidden rounded-md border border-zinc-200 bg-zinc-950 dark:border-zinc-800">
            <video ref={videoRef} muted playsInline className="aspect-video w-full bg-zinc-950 object-cover" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={iniciarCamera}
              disabled={cameraStatus === "iniciando" || scanPending || submitPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
            >
              {cameraStatus === "iniciando" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Camera className="h-3.5 w-3.5" />
              )}
              Usar camera
            </button>
            <button
              type="button"
              onClick={() => pararCamera()}
              disabled={cameraStatus === "parada" || submitPending}
              className="rounded-md px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Parar camera
            </button>
          </div>

          {cameraMessage && (
            <p className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {cameraMessage}
            </p>
          )}

          <div className="mt-3 flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Keyboard className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <input
                value={codigoScanner}
                onChange={(event) => setCodigoScanner(event.target.value)}
                className={`${inp} mt-0 pl-8`}
                placeholder="/s/local/1, /s/lote/123 ou codigo interno"
              />
            </div>
            <button
              type="button"
              onClick={() => resolverScanner(codigoScanner)}
              disabled={scanPending || submitPending || codigoScanner.trim().length === 0}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-500 disabled:opacity-50"
            >
              {scanPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Resolver
            </button>
          </div>

          {resultadoScanner && (
            <div
              className={`mt-3 rounded-md px-3 py-2 text-xs ${
                resultadoScanner.ok && resultadoScanner.encontrado
                  ? "bg-brand-50 text-brand-800 dark:bg-brand-950/30 dark:text-brand-300"
                  : "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
              }`}
            >
              <p>{resultadoScanner.message}</p>
              {resultadoScanner.ok && resultadoScanner.encontrado && resultadoScanner.tipo === "lote" && (
                <p className="mt-1 font-medium">
                  {resultadoScanner.insumoDescricao ?? `Lote #${resultadoScanner.id}`}
                  {resultadoScanner.loteCodigo ? ` · ${resultadoScanner.loteCodigo}` : ""}
                </p>
              )}
              {resultadoScanner.ok && resultadoScanner.encontrado && resultadoScanner.tipo === "local" && (
                <p className="mt-1 font-medium">{resultadoScanner.nome ?? `Local #${resultadoScanner.id}`}</p>
              )}
              {resultadoScanner.ok && !resultadoScanner.encontrado && (
                <Link href={resultadoScanner.triagemUrl} className="mt-1 inline-block font-medium underline">
                  Abrir triagem
                </Link>
              )}
            </div>
          )}
        </div>

        <form action={salvarContagem} className="grid gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Campanha</label>
            <select
              name="ciclo_id"
              value={cicloId}
              onChange={(event) => setCicloId(event.target.value)}
              required
              className={inp}
            >
              <option value="">Selecione</option>
              {ciclos.map((ciclo) => (
                <option key={ciclo.id} value={ciclo.id}>
                  {ciclo.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Local</label>
            <select
              name="local_id"
              value={localId}
              onChange={(event) => setLocalId(event.target.value)}
              className={inp}
            >
              <option value="">Sem local</option>
              {locais.map((local) => (
                <option key={local.id} value={local.id}>
                  {local.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Lote</label>
            <select
              name="lote_id"
              value={loteId}
              onChange={(event) => {
                const lote = lotes.find((item) => String(item.id) === event.target.value);
                if (lote) aplicarLote(lote);
                else setLoteId("");
              }}
              required
              className={inp}
            >
              <option value="">Selecione</option>
              {lotes.map((lote) => (
                <option key={lote.id} value={lote.id}>
                  #{lote.id} {lote.codigoLote ? `· ${lote.codigoLote}` : ""} · {lote.insumoDescricao ?? "Insumo"}
                </option>
              ))}
            </select>
          </div>

          {loteSelecionado && (
            <p className="rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-950/40 dark:text-zinc-300">
              Sistema: <b>{loteSelecionado.quantidadeAtual}</b> {loteSelecionado.unidade ?? ""}
              {loteSelecionado.localNome ? ` · ${loteSelecionado.localNome}` : ""}
            </p>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Quantidade contada</label>
            <input
              name="quantidade_contada"
              type="number"
              min="0"
              step="any"
              value={quantidadeContada}
              onChange={(event) => setQuantidadeContada(event.target.value)}
              required
              className={inp}
            />
          </div>

          {divergencia && (
            <p
              className={`rounded-md px-3 py-2 text-xs ${
                divergencia.temDivergencia
                  ? "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                  : "bg-brand-50 text-brand-800 dark:bg-brand-950/30 dark:text-brand-300"
              }`}
            >
              Divergência: <b>{divergencia.divergencia}</b>
              {divergencia.temDivergencia ? " · justificativa obrigatoria" : " · sem divergencia"}
            </p>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Justificativa</label>
            <textarea
              name="justificativa"
              rows={3}
              value={justificativa}
              onChange={(event) => setJustificativa(event.target.value)}
              required={Boolean(divergencia?.temDivergencia)}
              className={inp}
            />
            {state.errors?.justificativa && (
              <p className="mt-1 text-xs text-red-600">{state.errors.justificativa}</p>
            )}
          </div>

          {state.message && (
            <p
              className={`rounded-md px-3 py-2 text-sm ${
                state.ok
                  ? "bg-brand-50 text-brand-800 dark:bg-brand-950/30 dark:text-brand-300"
                  : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
              }`}
            >
              {state.message}
            </p>
          )}

          <button
            disabled={submitPending || ciclos.length === 0}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
          >
            {submitPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Registrar contagem
          </button>
        </form>
      </div>
    </section>
  );
}
