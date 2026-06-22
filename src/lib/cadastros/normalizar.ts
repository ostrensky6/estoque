/**
 * Normalização de textos, códigos e unidades dos cadastros técnicos.
 *
 * Funções PURAS e serializáveis (sem imports de servidor) — usadas tanto no
 * backend (write-time, validador de integridade) quanto, se necessário, no
 * cliente. A regra do plano é NÃO confiar apenas no frontend: toda escrita de
 * cadastro técnico deve passar por estas funções no servidor.
 *
 * Princípios:
 *  - Preserva o texto histórico (display); produz uma CHAVE normalizada para
 *    comparação/relacionamento. Nunca reescreve dados antigos silenciosamente.
 *  - Determinística: a mesma entrada produz sempre a mesma saída.
 */

// Faixa de marcas diacríticas combinantes (U+0300–U+036F). Declarada via
// code points para manter o arquivo-fonte 100% ASCII e evitar corrupção de
// encoding em toolchains/sistemas diferentes.
const DIACRITICOS = new RegExp("[\\u0300-\\u036f]", "g");

function removerAcentos(valor: string): string {
  return valor.normalize("NFD").replace(DIACRITICOS, "");
}

/** trim + colapsa espaços internos + normaliza Unicode para forma composta (NFC). */
export function normalizarTexto(valor: string | null | undefined): string {
  if (valor == null) return "";
  return valor.normalize("NFC").replace(/\s+/g, " ").trim();
}

/**
 * Chave de comparação insensível a caixa, acento e espaços.
 * Usada para detectar nomes/códigos equivalentes (ex.: grupos de escolha
 * duplicados por espaço final ou caixa diferente). NÃO substitui o valor
 * exibido — serve apenas para comparar.
 */
export function chaveComparacao(valor: string | null | undefined): string {
  return removerAcentos(normalizarTexto(valor).toLocaleLowerCase("pt-BR"));
}

/**
 * Código canônico de análise.
 *
 * Os códigos da planilha variam em caixa (`Illumina_Sh` vs `illumina_sh`,
 * `qPCR_F` vs `qpcr_f`). O código É a PK de `analises` e alvo de FKs, então
 * NÃO pode ser reescrito sem migração coordenada. Esta função produz a chave
 * canônica usada para detectar variações e, futuramente, alimentar a tabela de
 * mapeamento de normalização.
 *
 * Regras conservadoras:
 *  - trim + Unicode NFC;
 *  - colapsa espaços e os converte em `_`;
 *  - remove caracteres fora de [A-Za-z0-9_];
 *  - caixa preservada NÃO é confiável → comparação é case-insensitive via
 *    {@link chaveComparacaoCodigo}.
 */
export function codigoCanonico(codigo: string | null | undefined): string {
  return normalizarTexto(codigo)
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9_]/g, "");
}

/** Chave de comparação de códigos de análise (case-insensitive, sem acento). */
export function chaveComparacaoCodigo(codigo: string | null | undefined): string {
  return chaveComparacao(codigoCanonico(codigo));
}

// =====================================================================
// Catálogo controlado de unidades
// =====================================================================

/** Unidades canônicas reconhecidas no custeio. */
export type UnidadeCanonica =
  | "uL"
  | "mL"
  | "L"
  | "ng"
  | "ug"
  | "mg"
  | "g"
  | "un"
  | "reacao"
  | "cx"
  | "pct"
  | "conjunto"
  | "kit";

/**
 * Mapa de variações textuais → unidade canônica.
 * Chave: forma de comparação (minúscula, sem acento, sem espaço/ponto).
 * Preserva o texto histórico; o valor canônico é usado nos cálculos futuros.
 *
 * Observação: o micro pode vir como U+00B5 (µ, "micro sign") ou U+03BC (μ,
 * "greek small letter mu"). `removerAcentos`/NFD não os unifica, então ambas as
 * formas estão mapeadas explicitamente.
 */
const EQUIVALENCIAS_UNIDADE: Record<string, UnidadeCanonica> = {
  // microlitro
  ul: "uL",
  "µl": "uL",
  "μl": "uL",
  microlitro: "uL",
  microlitros: "uL",
  // mililitro
  ml: "mL",
  mililitro: "mL",
  mililitros: "mL",
  // litro
  l: "L",
  lt: "L",
  litro: "L",
  litros: "L",
  // massa
  ng: "ng",
  ug: "ug",
  "µg": "ug",
  "μg": "ug",
  micrograma: "ug",
  mg: "mg",
  miligrama: "mg",
  g: "g",
  grama: "g",
  gramas: "g",
  // unidades discretas
  un: "un",
  und: "un",
  unid: "un",
  unidade: "un",
  unidades: "un",
  uni: "un",
  pc: "un",
  peca: "un",
  pecas: "un",
  // reações (consumo por reação de PCR etc.)
  reacao: "reacao",
  reacoes: "reacao",
  rxn: "reacao",
  rx: "reacao",
  // embalagens
  cx: "cx",
  caixa: "cx",
  caixas: "cx",
  pct: "pct",
  pacote: "pct",
  pacotes: "pct",
  conjunto: "conjunto",
  conjuntos: "conjunto",
  kit: "kit",
  kits: "kit",
};

/** Reduz uma unidade a uma forma de comparação estável. */
function chaveUnidade(unidade: string | null | undefined): string {
  const base = normalizarTexto(unidade)
    .toLocaleLowerCase("pt-BR")
    .replace(/\.$/, "") // remove ponto final de abreviação (un. -> un)
    .replace(/\s+/g, "");
  return removerAcentos(base);
}

/**
 * Resolve a unidade canônica de um texto livre.
 * Retorna `null` quando não há equivalência conhecida — nesse caso o chamador
 * deve preservar o texto original e sinalizar para revisão, NUNCA assumir.
 */
export function normalizarUnidade(
  unidade: string | null | undefined,
): UnidadeCanonica | null {
  const chave = chaveUnidade(unidade);
  if (!chave) return null;
  return EQUIVALENCIAS_UNIDADE[chave] ?? null;
}

/** true quando duas unidades textuais representam a mesma unidade canônica. */
export function unidadesEquivalentes(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const ca = normalizarUnidade(a);
  const cb = normalizarUnidade(b);
  if (ca && cb) return ca === cb;
  // fallback conservador: comparação textual estável
  return chaveUnidade(a) === chaveUnidade(b);
}

// =====================================================================
// Modo de cobrança
// =====================================================================

export type ModoCobranca = "por_amostra" | "por_execucao";

export const MODOS_COBRANCA: readonly ModoCobranca[] = [
  "por_amostra",
  "por_execucao",
] as const;

/**
 * Valida o modo de cobrança SEM inventar classificação.
 * `null`/desconhecido retorna `null` (pendente) — o plano proíbe tratar `null`
 * como sinônimo de `por_amostra`.
 */
export function normalizarModoCobranca(
  valor: string | null | undefined,
): ModoCobranca | null {
  const chave = chaveComparacao(valor).replace(/\s+/g, "_");
  if (chave === "por_amostra") return "por_amostra";
  if (chave === "por_execucao") return "por_execucao";
  return null;
}
