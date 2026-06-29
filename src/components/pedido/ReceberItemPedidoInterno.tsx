"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Camera, Keyboard, Loader2, PackageCheck, ScanLine } from "lucide-react";

import { receberItemPedidoInterno } from "@/lib/actions/pedidos-internos";
import {
  resolverCodigoRecebimentoInterno,
  type ResultadoScannerRecebimento,
} from "@/lib/actions/scanner";
import type { FormState } from "@/lib/actions/cadastros";
import {
  iniciarLeitorCamera,
  type ScannerCameraControls,
} from "@/components/scanner/zxing-adapter";

type Insumo = { id: number; especificacao: string | null; unidade: string | null };

export type ItemRecebivel = {
  id: number;
  pedidoId: number;
  especificacao: string;
  quantidade: number;
  unidade: string | null;
  insumoId: number | null;
  fornecedorSugerido: string | null;
  orcamentoPrevio: number | null;
};

export function ReceberItemPedidoInterno({
  item,
  insumos,
}: {
  item: ItemRecebivel;
  insumos: Insumo[];
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [state, setState] = useState<FormState>({ ok: false });
  const [recebimentoPending, startRecebimentoTransition] = useTransition();
  const [scanPending, startScanTransition] = useTransition();
  // "" = escolher existente; "novo" = cadastrar pela especificação.
  const [modo, setModo] = useState<"" | "novo">(item.insumoId ? "" : "");
  const [insumoId, setInsumoId] = useState(item.insumoId ? String(item.insumoId) : "");
  const [codigoLote, setCodigoLote] = useState("");
  const [validade, setValidade] = useState("");
  const [codigoScanner, setCodigoScanner] = useState("");
  const [resultadoScanner, setResultadoScanner] = useState<ResultadoScannerRecebimento | null>(null);
  const [cameraStatus, setCameraStatus] = useState<"parada" | "iniciando" | "ativa" | "erro">("parada");
  const [cameraMessage, setCameraMessage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<ScannerCameraControls | null>(null);

  function pararCamera(status: "parada" | "erro" = "parada") {
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

  function action(formData: FormData) {
    startRecebimentoTransition(async () => {
      const res = await receberItemPedidoInterno({ ok: false }, formData);
      setState(res);
      if (res.ok) {
        setAberto(false);
        pararCamera();
        router.refresh();
      }
    });
  }

  function aplicarResultadoScan(resultado: ResultadoScannerRecebimento) {
    setResultadoScanner(resultado);
    if (!resultado.ok || !resultado.encontrado) return;

    setModo("");
    setInsumoId(String(resultado.insumoId));
    if (resultado.loteCodigo) setCodigoLote(resultado.loteCodigo);
    if (resultado.validade) setValidade(resultado.validade);
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

  const inp =
    "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-leaf-500 focus:outline-none focus:ring-1 focus:ring-leaf-500 dark:border-zinc-700 dark:bg-zinc-950";
  const scanInput =
    "h-9 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-leaf-500 focus:outline-none focus:ring-1 focus:ring-leaf-500 dark:border-zinc-700 dark:bg-zinc-950";

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-1.5 rounded-md bg-leaf-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-leaf-500"
      >
        <PackageCheck className="h-3.5 w-3.5" />
        Receber
      </button>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 text-left">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              if (!recebimentoPending && !scanPending) {
                pararCamera();
                setAberto(false);
              }
            }}
          />
          <div className="relative max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h3 className="text-base font-semibold">Receber item</h3>
            <p className="mt-1 text-xs text-zinc-500">
              {item.especificacao}
              {item.unidade ? ` · ${item.unidade}` : ""}
            </p>
            <p className="mt-2 rounded-md bg-leaf-50 px-3 py-2 text-xs text-leaf-800 dark:bg-leaf-950/30 dark:text-leaf-300">
              Ao confirmar, a quantidade entra em estoque como um lote do insumo escolhido e o item sai
              do módulo de recebimento. O lote entra no insumo escolhido.
            </p>

            <section className="mt-4 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="inline-flex items-center gap-2 text-sm font-semibold">
                  <ScanLine className="h-4 w-4 text-leaf-600 dark:text-leaf-300" />
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
                  className="inline-flex items-center gap-1.5 rounded-md bg-leaf-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-leaf-500 disabled:opacity-50"
                >
                  {scanPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Resolver
                </button>
              </div>

              {resultadoScanner && (
                <div
                  className={`mt-3 rounded-md px-3 py-2 text-xs ${
                    resultadoScanner.ok && resultadoScanner.encontrado
                      ? "bg-leaf-50 text-leaf-800 dark:bg-leaf-950/30 dark:text-leaf-300"
                      : "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                  }`}
                >
                  <p>{resultadoScanner.message}</p>
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
              <input type="hidden" name="pedido_interno_id" value={item.pedidoId} />

              <div className="col-span-2">
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  Insumo de estoque <span className="text-red-500">*</span>
                </label>
                <div className="mt-1 flex gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setModo("")}
                    className={`rounded-md px-2 py-1 ${modo === "" ? "bg-leaf-600 text-white" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"}`}
                  >
                    Existente
                  </button>
                  <button
                    type="button"
                    onClick={() => setModo("novo")}
                    className={`rounded-md px-2 py-1 ${modo === "novo" ? "bg-leaf-600 text-white" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"}`}
                  >
                    Cadastrar novo
                  </button>
                </div>
                {modo === "" ? (
                  <select
                    name="insumo_id"
                    value={insumoId}
                    onChange={(event) => setInsumoId(event.target.value)}
                    className={inp}
                  >
                    <option value="">— selecione —</option>
                    {insumos.map((insumo) => (
                      <option key={insumo.id} value={insumo.id}>
                        {insumo.especificacao}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    name="novo_insumo"
                    defaultValue={item.especificacao}
                    placeholder="Especificação do novo insumo"
                    required
                    className={inp}
                  />
                )}
              </div>

              {modo === "novo" && (
                <>
                  <div className="col-span-1">
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                      Categoria de compra <span className="text-red-500">*</span>
                    </label>
                    <select name="categoria_compra" defaultValue="" required className={inp}>
                      <option value="">Selecione</option>
                      <option value="critico">Crítico</option>
                      <option value="operacional">Operacional</option>
                      <option value="eventual">Eventual</option>
                    </select>
                  </div>
                  <div className="col-span-1">
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                      Fator de conversão <span className="text-red-500">*</span>
                    </label>
                    <input
                      name="fator_conversao"
                      type="number"
                      step="any"
                      min="0.000001"
                      defaultValue="1"
                      required
                      className={inp}
                    />
                  </div>
                </>
              )}

              <div className="col-span-1">
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  Quantidade <span className="text-red-500">*</span>
                </label>
                <input
                  name="quantidade"
                  type="number"
                  step="any"
                  min="0"
                  defaultValue={item.quantidade}
                  className={inp}
                />
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  Unidade {modo === "novo" && <span className="text-red-500">*</span>}
                </label>
                <input name="unidade" defaultValue={item.unidade ?? ""} required={modo === "novo"} className={inp} />
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
              <div className="col-span-1">
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Código do lote</label>
                <input
                  name="codigo"
                  type="text"
                  value={codigoLote}
                  onChange={(event) => setCodigoLote(event.target.value)}
                  className={inp}
                />
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  Custo unitário (R$) {modo === "novo" && <span className="text-red-500">*</span>}
                </label>
                <input
                  name="custo"
                  type="number"
                  step="0.0001"
                  min={modo === "novo" ? "0.0001" : "0"}
                  defaultValue={item.orcamentoPrevio ?? ""}
                  required={modo === "novo"}
                  className={inp}
                />
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Fornecedor</label>
                <input name="fornecedor" type="text" defaultValue={item.fornecedorSugerido ?? ""} className={inp} />
              </div>

              {state.message && !state.ok && (
                <p className="col-span-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
                  {state.message}
                </p>
              )}

              <div className="col-span-2 mt-1 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    pararCamera();
                    setAberto(false);
                  }}
                  className="rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  disabled={recebimentoPending || scanPending}
                  className="rounded-md bg-leaf-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-leaf-500 disabled:opacity-50"
                >
                  {recebimentoPending ? "Recebendo…" : "Confirmar recebimento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
