import "server-only";

import {
  carregarIntegridadeAnalise,
  carregarMapaIntegridade,
} from "./integridade-loader";
import {
  exigirPermissaoIntegridade,
  identidadeAtual,
} from "./permissoes";
import type {
  AnaliseIntegridade,
  Problema,
  StatusIntegridade,
} from "./validar-integridade";
import { registrarEvento, type Entidade } from "@/lib/actions/eventos";

/**
 * Guard operacional do custeio.
 *
 * Transforma o validador de integridade (puro) em uma trava real nos pontos que
 * geram custo/preço: inclusão de análise em orçamento/projeto, recálculo,
 * revisão do módulo laboratorial, emissão final e geração de planejamento.
 *
 * Princípio: uma análise `BLOQUEADA` (insumo obrigatório sem vínculo/custo, modo
 * de cobrança ausente, etc.) NÃO pode entrar normalmente — viraria custo zero
 * silencioso. A única forma de incluí-la é um OVERRIDE explícito: exige
 * permissão (`cadastros.integridade.override`), justificativa obrigatória,
 * identidade do usuário e registro em auditoria, além de carimbar o problema no
 * snapshot do caller. Não existe override silencioso.
 */

/** Causas de bloqueio de uma análise, prontas para mensagem ao usuário. */
function causasBloqueio(integridade: AnaliseIntegridade): string {
  const bloqueios = integridade.problemas.filter((p) => p.gravidade === "bloqueio");
  if (bloqueios.length === 0) return "motivo não especificado";
  return bloqueios
    .map((p) => (p.origem ? `${p.mensagem} (${p.origem})` : p.mensagem))
    .join(" | ");
}

/** Erro específico de inclusão de análise bloqueada — carrega a causa. */
export class AnaliseBloqueadaError extends Error {
  readonly codigos: string[];
  readonly problemas: Problema[];
  readonly status: StatusIntegridade;
  constructor(codigos: string[], status: StatusIntegridade, problemas: Problema[], mensagem: string) {
    super(mensagem);
    this.name = "AnaliseBloqueadaError";
    this.codigos = codigos;
    this.problemas = problemas;
    this.status = status;
  }
}

export type ContextoAuditoria = { entidade: Entidade; entidadeId: number };

/** Registro de override gravável em snapshot/auditoria. */
export type OverrideRegistro = {
  aplicado: true;
  justificativa: string;
  usuario_id: string | null;
  usuario_email: string | null;
  status: StatusIntegridade;
  problemas: Problema[];
  registrado_em: string;
};

export type ResultadoGuard = {
  codigo: string;
  status: StatusIntegridade;
  integridade: AnaliseIntegridade;
  override: OverrideRegistro | null;
};

function integridadeInexistente(codigo: string): AnaliseIntegridade {
  return {
    codigo,
    nome: null,
    ativo: false,
    status: "BLOQUEADA",
    custoCalculavel: false,
    problemas: [
      {
        codigo: "analise.inexistente",
        gravidade: "bloqueio",
        cadastro: "analise",
        mensagem: `Análise "${codigo}" não existe no catálogo — não pode ser custeada.`,
        acaoRecomendada: "Cadastrar a análise ou corrigir o código informado.",
      },
    ],
  };
}

/**
 * Garante que UMA análise pode entrar em cálculo/orçamento.
 *
 * - `PRONTA`/`COM_ALERTAS`: passa (o alerta deve ser exibido pela interface).
 * - `BLOQUEADA` sem override: lança {@link AnaliseBloqueadaError} com a causa.
 * - `BLOQUEADA` com override: exige permissão + justificativa, audita e registra.
 */
export async function assegurarAnaliseLiberada(args: {
  codigo: string;
  integridade?: AnaliseIntegridade | null;
  override?: { justificativa?: string | null } | null;
  auditoria?: ContextoAuditoria | null;
}): Promise<ResultadoGuard> {
  const { codigo } = args;
  const integridade =
    args.integridade ??
    (await carregarIntegridadeAnalise(codigo)) ??
    integridadeInexistente(codigo);

  if (integridade.status !== "BLOQUEADA") {
    return { codigo, status: integridade.status, integridade, override: null };
  }

  const justificativa = args.override?.justificativa?.trim();
  if (!justificativa) {
    throw new AnaliseBloqueadaError(
      [codigo],
      integridade.status,
      integridade.problemas,
      `Análise "${codigo}" está BLOQUEADA e não pode ser incluída: ${causasBloqueio(integridade)}. ` +
        `Corrija o cadastro ou solicite override com justificativa.`,
    );
  }

  // Override: permissão é obrigatória (sem permissão → falha aqui).
  await exigirPermissaoIntegridade("cadastros.integridade.override");
  const { id, email } = await identidadeAtual();
  const override: OverrideRegistro = {
    aplicado: true,
    justificativa,
    usuario_id: id,
    usuario_email: email,
    status: integridade.status,
    problemas: integridade.problemas.filter((p) => p.gravidade === "bloqueio"),
    registrado_em: new Date().toISOString(),
  };

  if (args.auditoria) {
    await registrarEvento(
      args.auditoria.entidade,
      args.auditoria.entidadeId,
      integridade.status,
      "override_integridade",
      `Override de análise bloqueada ${codigo} por ${email ?? id ?? "usuário"}: ` +
        `${justificativa} || causas: ${causasBloqueio(integridade)}`,
    );
  }

  return { codigo, status: integridade.status, integridade, override };
}

/**
 * Garante que um CONJUNTO de análises pode ser consolidado (emissão final,
 * planejamento, recálculo). Sem caminho de override em lote: override é um ato
 * deliberado no momento da inclusão. Aqui, se qualquer análise estiver
 * bloqueada, falha listando todas as causas.
 */
export async function assegurarAnalisesLiberadas(
  codigos: string[],
  opts: { mapa?: Map<string, AnaliseIntegridade> } = {},
): Promise<Map<string, AnaliseIntegridade>> {
  const unicos = [...new Set(codigos.filter(Boolean))];
  if (unicos.length === 0) return new Map();
  const mapa = opts.mapa ?? (await carregarMapaIntegridade());

  const bloqueadas: { codigo: string; integridade: AnaliseIntegridade }[] = [];
  for (const codigo of unicos) {
    const integridade = mapa.get(codigo) ?? integridadeInexistente(codigo);
    if (integridade.status === "BLOQUEADA") bloqueadas.push({ codigo, integridade });
  }

  if (bloqueadas.length > 0) {
    const detalhe = bloqueadas
      .map((b) => `${b.codigo}: ${causasBloqueio(b.integridade)}`)
      .join(" ; ");
    throw new AnaliseBloqueadaError(
      bloqueadas.map((b) => b.codigo),
      "BLOQUEADA",
      bloqueadas.flatMap((b) => b.integridade.problemas.filter((p) => p.gravidade === "bloqueio")),
      `${bloqueadas.length} análise(s) bloqueada(s) impedem a operação — ${detalhe}.`,
    );
  }

  return mapa;
}
