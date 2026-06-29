"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { usuarioAtual } from "@/lib/auth/roles";
import { createClientUntyped } from "@/lib/supabase/server";
import {
  destinoScanner,
  entidadeScannerParaTipo,
  entidadeTipoRotaCurta,
  parseRotaCurtaKontrol,
  type EntidadeScanner,
} from "@/lib/scanner/resolver";
import {
  normalizarCodigo,
  resolverIdentificadorInterno,
} from "@/lib/scanner/identificadores";
import type { FormState } from "./cadastros";

function texto(formData: FormData, chave: string) {
  return String(formData.get(chave) ?? "").trim();
}

const TABELAS_ENTIDADE: Record<EntidadeScanner, string> = {
  lote: "lotes_estoque",
  insumo: "insumos",
  equipamento: "equipamentos",
  equipamento_unidade: "equipamento_unidades",
  local: "locais",
};

const resolverSchema = z.object({
  codigo: z.string().trim().min(1, "Codigo obrigatorio."),
});

type ResultadoScan = "encontrado" | "nao_encontrado" | "erro";

async function registrarEventoScan(args: {
  codigo: string;
  formato?: string | null;
  tipo?: EntidadeScanner | null;
  id?: number | null;
  resultado: ResultadoScan;
  acao?: string;
  contexto?: Record<string, unknown>;
}) {
  try {
    const usuario = await usuarioAtual();
    const supabase = await createClientUntyped();
    await supabase.from("scan_eventos").insert({
      codigo: args.codigo,
      formato: args.formato ?? null,
      entidade_tipo: args.tipo ? entidadeScannerParaTipo(args.tipo) : null,
      entidade_id: args.id ?? null,
      acao: args.acao ?? "buscar",
      resultado: args.resultado,
      contexto: {
        ...args.contexto,
        codigo_normalizado: normalizarCodigo(args.codigo),
      },
      usuario: usuario?.email ?? usuario?.id ?? null,
    });
  } catch {
    // Registro de auditoria nao deve bloquear a resolucao/redirect principal.
  }
}

export async function entidadeEscaneavelExiste(
  tipo: EntidadeScanner,
  id: number,
) {
  if (!Number.isInteger(id) || id <= 0) return false;
  const supabase = await createClientUntyped();
  const { data } = await supabase
    .from(TABELAS_ENTIDADE[tipo])
    .select("id")
    .eq("id", id)
    .maybeSingle();

  return Boolean(data);
}

async function resolverCodigo(codigo: string): Promise<{
  tipo: EntidadeScanner;
  id: number;
  formato: string;
} | null> {
  const rota = parseRotaCurtaKontrol(codigo);
  if (rota) return { ...rota, formato: "url_kontrol" };

  const supabase = await createClientUntyped();
  const { data } = await supabase
    .from("identificadores")
    .select("entidade_tipo, entidade_id, formato")
    .eq("codigo_normalizado", normalizarCodigo(codigo))
    .eq("ativo", true)
    .maybeSingle();

  const tipo = data?.entidade_tipo ? entidadeTipoRotaCurta(String(data.entidade_tipo)) : null;
  const id = Number(data?.entidade_id);
  if (tipo && Number.isInteger(id) && id > 0) {
    return {
      tipo,
      id,
      formato: data?.formato ? String(data.formato) : "identificador",
    };
  }

  const interno = resolverIdentificadorInterno(codigo);
  const tipoInterno = interno ? entidadeTipoRotaCurta(interno.entidadeTipo) : null;
  if (interno && tipoInterno) {
    return {
      tipo: tipoInterno,
      id: interno.entidadeId,
      formato: "kontrol_interno",
    };
  }

  return null;
}

export async function resolverCodigoEscaneado(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = resolverSchema.safeParse({
    codigo: texto(formData, "codigo") || texto(formData, "valor_lido"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Codigo invalido." };
  }

  const { codigo } = parsed.data;
  const resolvido = await resolverCodigo(codigo);
  if (!resolvido) {
    await registrarEventoScan({
      codigo,
      resultado: "nao_encontrado",
      contexto: { origem: "resolver_codigo" },
    });
    return { ok: false, message: "Codigo desconhecido." };
  }

  const existe = await entidadeEscaneavelExiste(resolvido.tipo, resolvido.id);
  await registrarEventoScan({
    codigo,
    formato: resolvido.formato,
    tipo: resolvido.tipo,
    id: resolvido.id,
    resultado: existe ? "encontrado" : "nao_encontrado",
    contexto: { origem: "resolver_codigo" },
  });

  if (!existe) return { ok: false, message: "Entidade nao encontrada." };
  redirect(destinoScanner(resolvido.tipo, resolvido.id));
}

export async function abrirLeituraGlobal(formData: FormData): Promise<void> {
  const valor = texto(formData, "valor_lido");
  if (!valor) return;

  await resolverCodigoEscaneado({ ok: false }, formData);
}
