"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { usuarioAtual } from "@/lib/auth/roles";
import { createClientUntyped } from "@/lib/supabase/server";
import { prepararTriagemCadastro } from "@/lib/scanner/triagem";
import type { FormState } from "./cadastros";

function texto(formData: FormData, chave: string) {
  return String(formData.get(chave) ?? "").trim();
}

const triagemSchema = z.object({
  codigo: z.string().trim().min(1, "Codigo obrigatorio."),
});

export async function criarTriagemCodigoDesconhecido(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = triagemSchema.safeParse({
    codigo: texto(formData, "codigo"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Codigo invalido.",
    };
  }

  const triagem = prepararTriagemCadastro(parsed.data.codigo);
  let destino = "registrada";

  try {
    const usuario = await usuarioAtual();
    const supabase = await createClientUntyped();
    const { data: existente } = await supabase
      .from("cadastros_triagem")
      .select("id")
      .eq("codigo_normalizado", triagem.codigoNormalizado)
      .in("status", ["pendente", "em_analise"])
      .maybeSingle();

    if (existente?.id) {
      destino = "existente";
    } else {
      const { error } = await supabase.from("cadastros_triagem").insert({
        codigo: triagem.codigo,
        codigo_normalizado: triagem.codigoNormalizado,
        formato: triagem.formato,
        tipo_sugerido: triagem.tipoSugerido,
        dados_extraidos: triagem.dadosExtraidos,
        status: "pendente",
        criado_por: usuario?.email ?? usuario?.id ?? null,
      });

      if (error) {
        if ("code" in error && error.code === "23505") {
          destino = "existente";
        } else {
          return {
            ok: false,
            message: "Nao foi possivel registrar a triagem agora.",
          };
        }
      }
    }
  } catch {
    return {
      ok: false,
      message: "Nao foi possivel registrar a triagem agora.",
    };
  }

  redirect(
    `/scanner/desconhecido?codigo=${encodeURIComponent(triagem.codigo)}&triagem=${destino}`,
  );
}
