const MODALIDADES_LABORATORIO = new Set([
  "analises",
  "analises_projeto",
  "projeto_com_analises",
  "projeto_analises_custos",
]);

const MODALIDADES_PROJETO = new Set([
  "projeto",
  "analises_projeto",
  "projeto_com_analises",
  "projeto_analises_custos",
]);

export function normalizarModalidadeOrcamento(modalidade?: string | null) {
  if (modalidade === "analises_projeto") return "projeto_com_analises";
  if (modalidade === "projeto_analises_custos") return "projeto_com_analises";
  if (modalidade === "projeto_com_analises") return "projeto_com_analises";
  if (modalidade === "projeto") return "projeto";
  return "analises";
}

// Rótulos de exibição; códigos legados caem na forma canônica equivalente.
const ROTULOS_MODALIDADE: Record<string, string> = {
  analises: "Apenas análises laboratoriais",
  projeto: "Apenas projeto",
  projeto_com_analises: "Projeto com análises laboratoriais",
};

export function rotuloModalidade(modalidade?: string | null) {
  if (!modalidade) return "—";
  const conhecida = MODALIDADES_LABORATORIO.has(modalidade) || MODALIDADES_PROJETO.has(modalidade);
  return conhecida ? ROTULOS_MODALIDADE[normalizarModalidadeOrcamento(modalidade)] : modalidade;
}

export function modalidadeExigeLaboratorio(modalidade?: string | null) {
  return MODALIDADES_LABORATORIO.has(modalidade ?? "analises");
}

export function modalidadeExigeProjeto(modalidade?: string | null) {
  return MODALIDADES_PROJETO.has(modalidade ?? "analises");
}

