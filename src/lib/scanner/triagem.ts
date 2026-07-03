import {
  normalizarCodigo,
  resolverIdentificadorInterno,
  type EntidadeTipo,
} from "@/lib/scanner/identificadores";
import { parseRotaCurtaKontrol } from "@/lib/scanner/resolver";

export type TriagemCadastroInput = {
  codigo: string;
  codigoNormalizado: string;
  formato: "kontrol_interno" | "url_kontrol" | "desconhecido";
  tipoSugerido: EntidadeTipo | null;
  dadosExtraidos: Record<string, unknown>;
};

export function prepararTriagemCadastro(codigo: string): TriagemCadastroInput {
  const codigoLimpo = codigo.trim();
  const codigoNormalizado = normalizarCodigo(codigoLimpo);
  const rotaCurta = parseRotaCurtaKontrol(codigoLimpo);
  if (rotaCurta) {
    return {
      codigo: codigoLimpo,
      codigoNormalizado,
      formato: "url_kontrol",
      tipoSugerido: rotaCurta.tipo,
      dadosExtraidos: {
        origem: "rota_curta",
        entidade_tipo: rotaCurta.tipo,
        entidade_id: rotaCurta.id,
      },
    };
  }

  const interno = resolverIdentificadorInterno(codigoLimpo);
  if (interno) {
    return {
      codigo: codigoLimpo,
      codigoNormalizado,
      formato: "kontrol_interno",
      tipoSugerido: interno.entidadeTipo,
      dadosExtraidos: {
        origem: "codigo_interno",
        entidade_tipo: interno.entidadeTipo,
        entidade_id: interno.entidadeId,
      },
    };
  }

  return {
    codigo: codigoLimpo,
    codigoNormalizado,
    formato: "desconhecido",
    tipoSugerido: null,
    dadosExtraidos: {},
  };
}
