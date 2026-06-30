"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Camera, Keyboard, Loader2, ScanLine } from "lucide-react";

import { receberItemPedido } from "@/lib/actions/compras";
import {
  resolverCodigoRecebimentoInterno,
  type ResultadoScannerRecebimento,
} from "@/lib/actions/scanner";
import {
  iniciarLeitorCamera,
  type ScannerCameraControls,
} from "@/components/scanner/zxing-adapter";

type StatusCamera = "parada" | "iniciando" | "ativa" | "erro";

export type ItemCompraRecebivel = {
  id: number;
  pedidoId: number;
  quantidade: number;
  insumoId: number | null;
  insumoDescricao: string | null;
  unidade: string | null;
};

export function ScannerRecebimentoCompra({ item }: { item: ItemCompraRecebivel }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<ScannerCameraControls | null>(null);
  const [aberto, setAberto] = useState(false);
  const [recebimentoPending, startRecebimentoTransition] = useTransition();
  const [scanPending, startScanTransition] = useTransition();
  const [codigoScanner, setCodigoScanner] = useState("");
  const [codigoLote, setCodigoLote] = useState("");
  const [validade, setValidade] = useState("");
  const [resultadoScanner, setResultadoScanner] = useState<ResultadoScannerRecebimento | null>(null);
  const [aplicacaoMessage, setAplicacaoMessage] = useState<string | null>(null);
  const [erroRecebimento, setErroRecebimento] = useState<string | null>(null);
  const [cameraStatus, setCameraStatus] = useState<StatusCamera>("parada");
  const [cameraMessage, setCameraMessage] = useState<string | null>(null);

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

  function fechar() {
    if (recebimentoPending || scanPending) return;
    pararCamera();
    setAberto(false);
  }

  function aplicarResultadoScan(resultado: ResultadoScannerRecebimento) {
    setResultadoScanner(resultado);
    setAplicacaoMessage(null);

    if (!resultado.ok || !resultado.encontrado) return;

    if (item.insumoId && resultado.insumoId !== item.insumoId) {
      setAplicacaoMessage(
        `Codigo aponta para o insumo #${resultado.insumoId}, mas este item do pedido e do insumo #${item.insumoId}.`,
      );
      return;
    }

    if (resultado.tipo === "lote") {
      if (resultado.loteCodigo) setCodigoLote(resultado.loteCodigo);
      if (resultado.validade) setValidade(resultado.validade);
      setAplicacaoMessage("Lote compativel identificado. Confira os campos antes de confirmar.");
      return;
    }

    setAplicacaoMessage("Insumo compativel identificado. Confira quantidade, validade e codigo do lote.");
  }

  function resolverScanner(codigo: string) {
    const codigoLimpo = codigo.trim();
    if (!codigoLimpo) {
      setResultadoScanner({ ok: false, message: "Informe um codigo para resolver." });
      return;
    }

    startScanTransition(async () => {
      const resultado = await resolverCodigoRecebimentoInterno(codigoLimpo);
      aplicarResultadoScan(resultado);
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

  function action(formData: FormData) {
    setErroRecebimento(null);
    startRecebimentoTransition(async () => {
      try {
        await receberItemPedido(formData);
        pararCamera();
        setAberto(false);
        router.refresh();
      } catch (error) {
        setErroRecebimento(error instanceof Error ? error.message : "Nao foi possivel receber o item.");
      }
    });
  }

  const inp =
    "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-950";
  const scanInput =
    "h-9 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-950";

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-1.5 rounded bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-500"
      >
        <ScanLine className="h-3.5 w-3.5" />
        Receber
      </button>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 text-left">
          <div className="absolute inset-0 bg-black/40" onClick={fechar} />
          <div className="relative max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h3 className="text-base font-semibold">Receber item de compra</h3>
            <p className="mt-1 text-xs text-zinc-500">
              {item.insumoDescricao ?? `Insumo #${item.insumoId ?? "-"}`}
              {item.unidade ? ` · ${item.unidade}` : ""}
            </p>
            <p className="mt-2 rounded-md bg-brand-50 px-3 py-2 text-xs text-brand-800 dark:bg-brand-950/30 dark:text-brand-300">
              O scanner apenas preenche ou confere dados. O recebimento so acontece ao confirmar.
            </p>

            <section className="mt-4 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="inline-flex items-center gap-2 text-sm font-semibold">
                  <ScanLine className="h-4 w-4 text-brand-600 dark:text-brand-300" />
                  Escanear codigo
                </h4>
                <span className="rounded-md bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {cameraStatus === "ativa"
                    ? "Camera ativa"
                    : cameraStatus === "iniciando"
                      ? "Iniciando camera"
                      : "Manual disponivel"}
                </span>
              </div>

              <div className="mt-3 overflow-hidden rounded-md border border-zinc-200 bg-zinc-950 dark:border-zinc-800">
                <video ref={videoRef} muted playsInline className="aspect-video w-full bg-zinc-950 object-cover" />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={iniciarCamera}
                  disabled={cameraStatus === "iniciando" || scanPending || recebimentoPending}
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
                  disabled={cameraStatus === "parada" || recebimentoPending}
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
                    className={`${scanInput} pl-8`}
                    placeholder="KONTROL:INS:123, /s/lote/123 ou codigo do fornecedor"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => resolverScanner(codigoScanner)}
                  disabled={scanPending || recebimentoPending || codigoScanner.trim().length === 0}
                  className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-500 disabled:opacity-50"
                >
                  {scanPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Resolver
                </button>
              </div>

              {resultadoScanner && (
                <div
                  className={`mt-3 rounded-md px-3 py-2 text-xs ${
                    resultadoScanner.ok && resultadoScanner.encontrado && !aplicacaoMessage?.startsWith("Codigo aponta")
                      ? "bg-brand-50 text-brand-800 dark:bg-brand-950/30 dark:text-brand-300"
                      : "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                  }`}
                >
                  <p>{aplicacaoMessage ?? resultadoScanner.message}</p>
                  {resultadoScanner.ok && resultadoScanner.encontrado && (
                    <p className="mt-1 font-medium">
                      {resultadoScanner.insumoDescricao ?? `Insumo #${resultadoScanner.insumoId}`}
                      {resultadoScanner.loteCodigo ? ` · lote ${resultadoScanner.loteCodigo}` : ""}
                    </p>
                  )}
                  {resultadoScanner.ok && !resultadoScanner.encontrado && (
                    <Link href={resultadoScanner.triagemUrl} className="mt-1 inline-block font-medium underline">
                      Abrir triagem
                    </Link>
                  )}
                </div>
              )}
            </section>

            <form action={action} className="mt-4 grid grid-cols-2 gap-3">
              <input type="hidden" name="item_id" value={item.id} />
              <input type="hidden" name="pedido_id" value={item.pedidoId} />
              <div className="col-span-1">
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Quantidade</label>
                <input
                  name="quantidade_recebida"
                  type="number"
                  step="any"
                  min="0"
                  defaultValue={item.quantidade}
                  className={inp}
                />
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Validade</label>
                <input
                  name="validade"
                  type="date"
                  value={validade}
                  onChange={(event) => setValidade(event.target.value)}
                  className={inp}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Codigo do lote</label>
                <input
                  name="codigo"
                  type="text"
                  value={codigoLote}
                  onChange={(event) => setCodigoLote(event.target.value)}
                  className={inp}
                />
              </div>

              {erroRecebimento && (
                <p className="col-span-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
                  {erroRecebimento}
                </p>
              )}

              <div className="col-span-2 mt-1 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={fechar}
                  className="rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  disabled={recebimentoPending || scanPending}
                  className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
                >
                  {recebimentoPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Confirmar recebimento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
