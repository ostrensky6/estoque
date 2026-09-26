import "server-only";
import { headers } from "next/headers";
import { normalizarOrigem } from "./urls";

function ehLocal(origem: string) {
  const host = new URL(origem).hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
}

/**
 * Origem pública do Kontrol para montar links absolutos (etiquetas QR).
 * Usa NEXT_PUBLIC_SITE_URL quando configurada com um endereço real; senão deduz
 * do próprio pedido (x-forwarded-host / host), o que também funciona na rede local.
 */
export async function origemPublicaKontrol(): Promise<string | null> {
  const env = normalizarOrigem(process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL);
  if (env && !ehLocal(env)) return env;

  try {
    const h = await headers();
    const host = (h.get("x-forwarded-host") ?? h.get("host"))?.split(",")[0]?.trim();
    if (host) {
      const proto =
        h.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
        (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
      const daRequisicao = normalizarOrigem(`${proto}://${host}`);
      if (daRequisicao) return daRequisicao;
    }
  } catch {
    // fora de um pedido (ex.: build): cai no valor do ambiente
  }
  return env;
}
