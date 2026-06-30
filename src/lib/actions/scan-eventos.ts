"use server";

import { z } from "zod";
import { usuarioAtual } from "@/lib/auth/roles";
import { createClientUntyped } from "@/lib/supabase/server";
import {
  formatoIdentificadorInterno,
  isEntidadeTipo,
  normalizarCodigo,
} from "@/lib/scanner/identificadores";
import type { EntidadeTipo } from "@/lib/scanner/identificadores";
import type { FormState } from "./cadastros";

const scanEventoSchema = z.object({
  codigo: z.string().trim().min(1, "Codigo obrigatorio."),
  formato: z.string().trim().min(1).nullable().optional(),
  entidade_tipo: z.string().trim().min(1).nullable().optional(),
  entidade_id: z.number().int().positive().nullable().optional(),
  acao: z.string().trim().min(1).default("buscar"),
  resultado: z.enum(["encontrado", "nao_encontrado", "erro", "criado", "atualizado"]),
  contexto: z.record(z.string(), z.unknown()).default({}),
});

function texto(formData: FormData, chave: string) {
  return String(formData.get(chave) ?? "").trim();
}

function textoOuNull(formData: FormData, chave: string) {
  return texto(formData, chave) || null;
}

function numeroOuNull(formData: FormData, chave: string) {
  const raw = texto(formData, chave);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function contextoFromFormData(formData: FormData): Record<string, unknown> {
  const contexto = texto(formData, "contexto");
  if (!contexto) return {};

  try {
    const parsed = JSON.parse(contexto);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return { contexto_invalido: contexto };
  }
}

export async function registrarScanEvento(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const entidadeTipo = textoOuNull(formData, "entidade_tipo");
  if (entidadeTipo && !isEntidadeTipo(entidadeTipo)) {
    return { ok: false, message: "Tipo de entidade invalido." };
  }

  const codigo = texto(formData, "codigo") || texto(formData, "valor_lido");
  const formatoInformado = textoOuNull(formData, "formato");
  const parsed = scanEventoSchema.safeParse({
    codigo,
    formato: formatoInformado ?? formatoIdentificadorInterno(codigo),
    entidade_tipo: entidadeTipo,
    entidade_id: numeroOuNull(formData, "entidade_id"),
    acao: texto(formData, "acao") || "buscar",
    resultado: texto(formData, "resultado") || "nao_encontrado",
    contexto: contextoFromFormData(formData),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Evento invalido." };
  }

  const data = parsed.data;
  const usuario = await usuarioAtual();
  const supabase = await createClientUntyped();
  const { error } = await supabase.from("scan_eventos").insert({
    codigo: data.codigo,
    formato: data.formato ?? null,
    entidade_tipo: data.entidade_tipo as EntidadeTipo | null,
    entidade_id: data.entidade_id ?? null,
    acao: data.acao,
    resultado: data.resultado,
    contexto: {
      ...data.contexto,
      codigo_normalizado: normalizarCodigo(data.codigo),
    },
    usuario: usuario?.email ?? usuario?.id ?? null,
  });

  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Evento de scan registrado." };
}
