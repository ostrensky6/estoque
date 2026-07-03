"use client";

export type ScannerCameraControls = {
  stop: () => void;
};

export async function iniciarLeitorCamera(
  video: HTMLVideoElement,
  onCodigoLido: (codigo: string) => void,
): Promise<ScannerCameraControls> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera indisponivel neste navegador.");
  }

  const { BrowserMultiFormatReader } = await import("@zxing/browser");
  const reader = new BrowserMultiFormatReader();

  const controls = await reader.decodeFromVideoDevice(
    undefined,
    video,
    (result, _error, activeControls) => {
      const codigo = result?.getText().trim();
      if (!codigo) return;

      activeControls.stop();
      onCodigoLido(codigo);
    },
  );

  return {
    stop: () => controls.stop(),
  };
}
