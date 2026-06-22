import "server-only";

import { papelAtual, temPapel, usuarioAtual, type Papel } from "@/lib/auth/roles";

/**
 * Permissões de integridade de cadastros.
 *
 * O Kontrol resolve autorização pelo papel do usuário (`@/lib/auth/roles`). Em
 * vez de espalhar checagens de papel hard-coded (`gestor+`) pelos call sites,
 * declaramos aqui uma POLÍTICA data-driven: cada permissão nomeada mapeia para o
 * papel mínimo exigido. Isso espelha o padrão de `@/lib/orcamento/governanca` e
 * deixa a matriz auditável em um só lugar — quando a tabela `permissoes_papel`
 * (sistema de permissões dinâmico, ver docs) for incorporada a este branch,
 * basta trocar a implementação de {@link temPermissaoIntegridade} sem mexer nos
 * call sites.
 */
export type PermissaoIntegridade =
  | "cadastros.integridade.visualizar"
  | "cadastros.integridade.corrigir"
  | "cadastros.integridade.override";

export type PoliticaPermissaoIntegridade = {
  permissao: PermissaoIntegridade;
  titulo: string;
  descricao: string;
  papelMinimo: Papel;
};

export const PERMISSOES_INTEGRIDADE: PoliticaPermissaoIntegridade[] = [
  {
    permissao: "cadastros.integridade.visualizar",
    titulo: "Visualizar integridade",
    descricao:
      "Consultar o painel de integridade dos cadastros e o status (pronta/alerta/bloqueada) por análise.",
    // Coordenadores operam cadastros e orçamentos: precisam enxergar o status
    // para entender por que uma análise aparece desabilitada. Leitura de um
    // painel de governança é de baixo risco e operacionalmente necessária.
    papelMinimo: "coordenador",
  },
  {
    permissao: "cadastros.integridade.corrigir",
    titulo: "Corrigir cadastros",
    descricao:
      "Acessar os atalhos de correção dos cadastros que originam as inconsistências.",
    papelMinimo: "coordenador",
  },
  {
    permissao: "cadastros.integridade.override",
    titulo: "Override de análise bloqueada",
    descricao:
      "Incluir excepcionalmente uma análise bloqueada em um cálculo/orçamento, com justificativa obrigatória e registro em auditoria.",
    // Override é privilegiado: só gestor+ pode liberar custo técnico que o
    // validador classificou como incorreto.
    papelMinimo: "gestor",
  },
];

export function politicaIntegridade(permissao: PermissaoIntegridade): PoliticaPermissaoIntegridade {
  const politica = PERMISSOES_INTEGRIDADE.find((item) => item.permissao === permissao);
  if (!politica) throw new Error(`Permissão de integridade sem política: ${permissao}`);
  return politica;
}

/** true quando o usuário atual tem a permissão de integridade pedida. */
export async function temPermissaoIntegridade(permissao: PermissaoIntegridade): Promise<boolean> {
  return temPapel(politicaIntegridade(permissao).papelMinimo);
}

/** Lança um erro descritivo quando a permissão de integridade não é satisfeita. */
export async function exigirPermissaoIntegridade(permissao: PermissaoIntegridade): Promise<void> {
  if (await temPermissaoIntegridade(permissao)) return;
  const politica = politicaIntegridade(permissao);
  const atual = await papelAtual();
  throw new Error(
    `Sem permissão para ${politica.titulo.toLowerCase()} (${permissao}). Papel atual: ${atual}. Exigido: ${politica.papelMinimo} ou superior.`,
  );
}

/** Identidade do usuário atual, para carimbar overrides/auditoria. */
export async function identidadeAtual(): Promise<{ id: string | null; email: string | null }> {
  const u = await usuarioAtual();
  return { id: u?.id ?? null, email: u?.email ?? null };
}
