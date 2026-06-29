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

export type ResultadoScannerRecebimento =
  | {
      ok: true;
      encontrado: true;
      codigo: string;
      tipo: "insumo" | "lote";
      id: number;
      insumoId: number;
      insumoDescricao: string | null;
      loteCodigo: string | null;
      validade: string | null;
      message: string;
    }
  | {
      ok: true;
      encontrado: false;
      codigo: string;
      triagemUrl: string;
      message: string;
    }
  | {
      ok: false;
      message: string;
    };

export type ResultadoScannerInventario =
  | {
      ok: true;
      encontrado: true;
      codigo: string;
      tipo: "local";
      id: number;
      nome: string | null;
      message: string;
    }
  | {
      ok: true;
      encontrado: true;
      codigo: string;
      tipo: "lote";
      id: number;
      loteCodigo: string | null;
      validade: string | null;
      quantidadeAtual: number;
      localId: number | null;
      localNome: string | null;
      insumoDescricao: string | null;
      unidade: string | null;
      message: string;
    }
  | {
      ok: true;
      encontrado: false;
      codigo: string;
      triagemUrl: string;
      message: string;
    }
  | {
      ok: false;
      message: string;
    };

export type ResultadoScannerPlanejamento =
  | {
      ok: true;
      encontrado: true;
      codigo: string;
      tipo: "lote";
      id: number;
      insumoId: number;
      loteCodigo: string | null;
      validade: string | null;
      validadeAposAbertura: string | null;
      quantidadeAtual: number;
      status: string;
      insumoDescricao: string | null;
      unidade: string | null;
      message: string;
    }
  | {
      ok: true;
      encontrado: false;
      codigo: string;
      triagemUrl: string;
      message: string;
    }
  | {
      ok: false;
      message: string;
    };

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

async function detalheRecebimento(tipo: EntidadeScanner, id: number) {
  const supabase = await createClientUntyped();

  if (tipo === "insumo") {
    const { data } = await supabase
      .from("insumos")
      .select("id, especificacao")
      .eq("id", id)
      .maybeSingle();

    if (!data?.id) return null;

    return {
      tipo: "insumo" as const,
      id: Number(data.id),
      insumoId: Number(data.id),
      insumoDescricao: data.especificacao ? String(data.especificacao) : null,
      loteCodigo: null,
      validade: null,
    };
  }

  if (tipo === "lote") {
    const { data } = await supabase
      .from("lotes_estoque")
      .select("id, codigo_lote, validade, insumo_id, insumos(especificacao)")
      .eq("id", id)
      .maybeSingle();
    const insumoId = Number(data?.insumo_id);
    if (!data?.id || !Number.isInteger(insumoId) || insumoId <= 0) return null;

    const insumoRaw = data.insumos as
      | { especificacao: string | null }
      | { especificacao: string | null }[]
      | null;
    const insumo = Array.isArray(insumoRaw) ? (insumoRaw[0] ?? null) : insumoRaw;

    return {
      tipo: "lote" as const,
      id: Number(data.id),
      insumoId,
      insumoDescricao: insumo?.especificacao ?? null,
      loteCodigo: data.codigo_lote ? String(data.codigo_lote) : null,
      validade: data.validade ? String(data.validade) : null,
    };
  }

  return null;
}

async function detalheInventario(tipo: EntidadeScanner, id: number) {
  const supabase = await createClientUntyped();

  if (tipo === "local") {
    const { data } = await supabase
      .from("locais")
      .select("id, nome")
      .eq("id", id)
      .maybeSingle();

    if (!data?.id) return null;

    return {
      tipo: "local" as const,
      id: Number(data.id),
      nome: data.nome ? String(data.nome) : null,
    };
  }

  if (tipo === "lote") {
    const { data } = await supabase
      .from("lotes_estoque")
      .select("id, codigo_lote, validade, quantidade_atual, local_id, locais(nome), insumos(especificacao, unidade)")
      .eq("id", id)
      .maybeSingle();

    if (!data?.id) return null;

    const localRaw = data.locais as { nome: string | null } | { nome: string | null }[] | null;
    const local = Array.isArray(localRaw) ? (localRaw[0] ?? null) : localRaw;
    const insumoRaw = data.insumos as
      | { especificacao: string | null; unidade: string | null }
      | { especificacao: string | null; unidade: string | null }[]
      | null;
    const insumo = Array.isArray(insumoRaw) ? (insumoRaw[0] ?? null) : insumoRaw;

    return {
      tipo: "lote" as const,
      id: Number(data.id),
      loteCodigo: data.codigo_lote ? String(data.codigo_lote) : null,
      validade: data.validade ? String(data.validade) : null,
      quantidadeAtual: Number(data.quantidade_atual ?? 0),
      localId: data.local_id == null ? null : Number(data.local_id),
      localNome: local?.nome ?? null,
      insumoDescricao: insumo?.especificacao ?? null,
      unidade: insumo?.unidade ?? null,
    };
  }

  return null;
}

async function detalhePlanejamento(tipo: EntidadeScanner, id: number) {
  if (tipo !== "lote") return null;
  const supabase = await createClientUntyped();
  const { data } = await supabase
    .from("lotes_estoque")
    .select("id, codigo_lote, validade, validade_apos_abertura, quantidade_atual, status, insumo_id, insumos(especificacao, unidade)")
    .eq("id", id)
    .maybeSingle();

  const insumoId = Number(data?.insumo_id);
  if (!data?.id || !Number.isInteger(insumoId) || insumoId <= 0) return null;

  const insumoRaw = data.insumos as
    | { especificacao: string | null; unidade: string | null }
    | { especificacao: string | null; unidade: string | null }[]
    | null;
  const insumo = Array.isArray(insumoRaw) ? (insumoRaw[0] ?? null) : insumoRaw;

  return {
    tipo: "lote" as const,
    id: Number(data.id),
    insumoId,
    loteCodigo: data.codigo_lote ? String(data.codigo_lote) : null,
    validade: data.validade ? String(data.validade) : null,
    validadeAposAbertura: data.validade_apos_abertura ? String(data.validade_apos_abertura) : null,
    quantidadeAtual: Number(data.quantidade_atual ?? 0),
    status: String(data.status ?? ""),
    insumoDescricao: insumo?.especificacao ?? null,
    unidade: insumo?.unidade ?? null,
  };
}

export async function resolverCodigoRecebimentoInterno(
  codigoRaw: string,
): Promise<ResultadoScannerRecebimento> {
  const parsed = resolverSchema.safeParse({ codigo: codigoRaw });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Codigo invalido." };
  }

  const { codigo } = parsed.data;
  const resolvido = await resolverCodigo(codigo);
  if (!resolvido) {
    await registrarEventoScan({
      codigo,
      resultado: "nao_encontrado",
      acao: "recebimento_interno",
      contexto: { origem: "recebimento_interno" },
    });
    return {
      ok: true,
      encontrado: false,
      codigo,
      triagemUrl: `/scanner/desconhecido?codigo=${encodeURIComponent(codigo)}`,
      message: "Codigo nao encontrado. Encaminhe para triagem antes de receber.",
    };
  }

  const detalhe = await detalheRecebimento(resolvido.tipo, resolvido.id);
  await registrarEventoScan({
    codigo,
    formato: resolvido.formato,
    tipo: resolvido.tipo,
    id: resolvido.id,
    resultado: detalhe ? "encontrado" : "nao_encontrado",
    acao: "recebimento_interno",
    contexto: { origem: "recebimento_interno" },
  });

  if (!detalhe) {
    return {
      ok: true,
      encontrado: false,
      codigo,
      triagemUrl: `/scanner/desconhecido?codigo=${encodeURIComponent(codigo)}`,
      message:
        resolvido.tipo === "insumo" || resolvido.tipo === "lote"
          ? "Entidade escaneada nao esta disponivel para recebimento."
          : "Este codigo nao aponta para insumo ou lote recebivel.",
    };
  }

  return {
    ok: true,
    encontrado: true,
    codigo,
    ...detalhe,
    message:
      detalhe.tipo === "lote"
        ? "Lote identificado. Confira os campos antes de confirmar."
        : "Insumo identificado. Confira os campos antes de confirmar.",
  };
}

export async function resolverCodigoInventario(
  codigoRaw: string,
): Promise<ResultadoScannerInventario> {
  const parsed = resolverSchema.safeParse({ codigo: codigoRaw });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Codigo invalido." };
  }

  const { codigo } = parsed.data;
  const resolvido = await resolverCodigo(codigo);
  if (!resolvido) {
    await registrarEventoScan({
      codigo,
      resultado: "nao_encontrado",
      acao: "inventario",
      contexto: { origem: "inventario" },
    });
    return {
      ok: true,
      encontrado: false,
      codigo,
      triagemUrl: `/scanner/desconhecido?codigo=${encodeURIComponent(codigo)}`,
      message: "Codigo nao encontrado. Encaminhe para triagem antes de contar.",
    };
  }

  const detalhe = await detalheInventario(resolvido.tipo, resolvido.id);
  await registrarEventoScan({
    codigo,
    formato: resolvido.formato,
    tipo: resolvido.tipo,
    id: resolvido.id,
    resultado: detalhe ? "encontrado" : "nao_encontrado",
    acao: "inventario",
    contexto: { origem: "inventario" },
  });

  if (!detalhe) {
    return {
      ok: true,
      encontrado: false,
      codigo,
      triagemUrl: `/scanner/desconhecido?codigo=${encodeURIComponent(codigo)}`,
      message:
        resolvido.tipo === "local" || resolvido.tipo === "lote"
          ? "Entidade escaneada nao esta disponivel para inventario."
          : "Este codigo nao aponta para local ou lote contavel.",
    };
  }

  return {
    ok: true,
    encontrado: true,
    codigo,
    ...detalhe,
    message:
      detalhe.tipo === "local"
        ? "Local identificado para a contagem."
        : "Lote identificado. Informe a quantidade contada antes de salvar.",
  };
}

export async function resolverCodigoPlanejamento(
  codigoRaw: string,
): Promise<ResultadoScannerPlanejamento> {
  const parsed = resolverSchema.safeParse({ codigo: codigoRaw });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Codigo invalido." };
  }

  const { codigo } = parsed.data;
  const resolvido = await resolverCodigo(codigo);
  if (!resolvido) {
    await registrarEventoScan({
      codigo,
      resultado: "nao_encontrado",
      acao: "planejamento_conferencia",
      contexto: { origem: "planejamento_conferencia" },
    });
    return {
      ok: true,
      encontrado: false,
      codigo,
      triagemUrl: `/scanner/desconhecido?codigo=${encodeURIComponent(codigo)}`,
      message: "Codigo nao encontrado. Encaminhe para triagem antes da baixa.",
    };
  }

  const detalhe = await detalhePlanejamento(resolvido.tipo, resolvido.id);
  await registrarEventoScan({
    codigo,
    formato: resolvido.formato,
    tipo: resolvido.tipo,
    id: resolvido.id,
    resultado: detalhe ? "encontrado" : "nao_encontrado",
    acao: "planejamento_conferencia",
    contexto: { origem: "planejamento_conferencia" },
  });

  if (!detalhe) {
    return {
      ok: true,
      encontrado: false,
      codigo,
      triagemUrl: `/scanner/desconhecido?codigo=${encodeURIComponent(codigo)}`,
      message:
        resolvido.tipo === "lote"
          ? "Lote escaneado nao esta disponivel para conferencia."
          : "Este codigo nao aponta para um lote fisico.",
    };
  }

  return {
    ok: true,
    encontrado: true,
    codigo,
    ...detalhe,
    message: "Lote identificado. Confira se corresponde ao insumo esperado antes de registrar.",
  };
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
    redirect(`/scanner/desconhecido?codigo=${encodeURIComponent(codigo)}`);
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

  if (!existe) {
    redirect(`/scanner/desconhecido?codigo=${encodeURIComponent(codigo)}`);
  }
  redirect(destinoScanner(resolvido.tipo, resolvido.id));
}
