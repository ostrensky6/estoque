/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef, useState, useTransition } from "react";
import { ImagePlus, Trash2 } from "lucide-react";

import { removerAssinaturaUsuario, salvarAssinaturaUsuario } from "@/lib/actions/usuarios";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/actions/cadastros";

const initial: FormState = { ok: false, message: "" };

async function removerFundoClaro(file: File) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a imagem.");

  ctx.drawImage(bitmap, 0, 0);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const brilho = (r + g + b) / 3;
    const pertoDeBranco = brilho > 228 && Math.max(r, g, b) - Math.min(r, g, b) < 32;
    if (pertoDeBranco) {
      const distancia = Math.min(255, Math.max(0, brilho - 228) * 9);
      data[i + 3] = 255 - distancia;
    }
  }

  ctx.putImageData(image, 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => (result ? resolve(result) : reject(new Error("PNG inválido."))), "image/png");
  });
  const dataUrl = canvas.toDataURL("image/png");
  return { dataUrl, file: new File([blob], "assinatura.png", { type: "image/png" }) };
}

export function AssinaturaUsuarioForm({
  userId,
  assinaturaUrl,
  assinaturaPath,
}: {
  userId: string;
  assinaturaUrl?: string | null;
  assinaturaPath?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(assinaturaUrl ?? "");
  const [mensagem, setMensagem] = useState("");
  const [pending, startTransition] = useTransition();

  async function selecionar(file: File | null) {
    if (!file) return;
    if (file.type !== "image/png") {
      setMensagem("Envie um arquivo PNG.");
      return;
    }
    setMensagem("Processando fundo...");
    try {
      const processed = await removerFundoClaro(file);
      setPreview(processed.dataUrl);
      const fd = new FormData();
      fd.set("id", userId);
      fd.set("assinatura_data_url", processed.dataUrl);
      fd.set("assinatura", processed.file);
      startTransition(async () => {
        const res = await salvarAssinaturaUsuario(initial, fd);
        setMensagem(res.message ?? "");
      });
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : "Não foi possível processar o PNG.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function remover() {
    const fd = new FormData();
    fd.set("id", userId);
    fd.set("assinatura_path", assinaturaPath ?? "");
    startTransition(async () => {
      const res = await removerAssinaturaUsuario(initial, fd);
      if (res.ok) setPreview("");
      setMensagem(res.message ?? "");
    });
  }

  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-16 w-36 items-center justify-center rounded-md border border-dashed border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950">
          {preview ? (
            <img src={preview} alt="Assinatura do usuário" className="max-h-14 max-w-32 object-contain" />
          ) : (
            <span className="text-[10px] text-zinc-400">Sem assinatura</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png"
            className="sr-only"
            onChange={(event) => selecionar(event.target.files?.[0] ?? null)}
          />
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => inputRef.current?.click()}>
            <ImagePlus className="h-4 w-4" />
            PNG
          </Button>
          {preview && (
            <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={remover}>
              <Trash2 className="h-4 w-4" />
              Remover
            </Button>
          )}
        </div>
      </div>
      {mensagem && <p className="mt-2 text-xs text-zinc-500">{mensagem}</p>}
    </div>
  );
}
