"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { AlertCircle, Camera, Keyboard, Loader2, ScanLine } from "lucide-react";
import { resolverCodigoEscaneado } from "@/lib/actions/scanner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { iniciarLeitorCamera, type ScannerCameraControls } from "./zxing-adapter";

const initialState = { ok: false, message: "" };

type StatusCamera = "parada" | "iniciando" | "ativa" | "erro";

export function ScannerModal() {
  const [open, setOpen] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<StatusCamera>("parada");
  const [cameraMessage, setCameraMessage] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [state, formAction, pending] = useActionState(resolverCodigoEscaneado, initialState);
  const videoRef = useRef<HTMLVideoElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const controlsRef = useRef<ScannerCameraControls | null>(null);

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

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      pararCamera("parada");
      setCodigo("");
      setCameraMessage(null);
    }
  }

  async function iniciarCamera() {
    const video = videoRef.current;
    if (!video) return;

    pararCamera("iniciando");
    setCameraStatus("iniciando");
    setCameraMessage(null);

    try {
      controlsRef.current = await iniciarLeitorCamera(video, (codigoLido) => {
        setCodigo(codigoLido);
        window.setTimeout(() => formRef.current?.requestSubmit(), 0);
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

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 h-10 gap-2 border-brand-200 bg-white shadow-lg print:hidden dark:border-brand-900 dark:bg-zinc-950"
      >
        <ScanLine className="h-4 w-4 text-brand-600 dark:text-brand-300" />
        <span>Escanear</span>
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Escanear codigo</DialogTitle>
            <DialogDescription>
              Leia um QR interno do Kontrol ou cole um codigo manualmente.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-950 dark:border-zinc-800">
              <video
                ref={videoRef}
                muted
                playsInline
                className="aspect-video w-full bg-slate-950 object-cover"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={iniciarCamera}
                disabled={cameraStatus === "iniciando" || pending}
              >
                {cameraStatus === "iniciando" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
                Usar camera
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => pararCamera()}
                disabled={cameraStatus === "parada" || pending}
              >
                Parar camera
              </Button>
              <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-zinc-900 dark:text-zinc-300">
                {cameraStatus === "ativa"
                  ? "Camera ativa"
                  : cameraStatus === "iniciando"
                    ? "Iniciando camera"
                    : "Entrada manual disponivel"}
              </span>
            </div>

            {cameraMessage && (
              <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {cameraMessage}
              </p>
            )}

            <form ref={formRef} action={formAction} className="grid gap-2">
              <label className="text-sm font-medium text-slate-700 dark:text-zinc-200" htmlFor="scanner-codigo">
                Codigo ou URL curta
              </label>
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <Keyboard className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="scanner-codigo"
                    name="codigo"
                    value={codigo}
                    onChange={(event) => setCodigo(event.target.value)}
                    autoComplete="off"
                    inputMode="text"
                    className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-brand-950/50"
                    placeholder="KONTROL:LOTE:123 ou /s/lote/123"
                  />
                </div>
                <Button type="submit" disabled={pending || codigo.trim().length === 0}>
                  {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Resolver
                </Button>
              </div>
            </form>

            {!state.ok && state.message && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">
                {state.message}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
