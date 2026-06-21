export type ModuloOperacionalStatus = "nao_exigido" | "pendente" | "preenchido" | "revisado";

export type ModuloOperacional = {
  status: ModuloOperacionalStatus;
  label: string;
  faltante: number;
  pendencias: string[];
};

const STATUS_REVISADOS = new Set(["enviado", "aprovado"]);

export function avaliarModuloOperacional(args: {
  exigido: boolean;
  quantidadeItens: number;
  statusDocumento?: string | null;
  pendenciaSemItens: string;
}) {
  if (!args.exigido) {
    return {
      status: "nao_exigido",
      label: "Não exigido",
      faltante: 0,
      pendencias: ["não exigido para esta modalidade"],
    } satisfies ModuloOperacional;
  }

  if (args.quantidadeItens <= 0) {
    return {
      status: "pendente",
      label: "Pendente",
      faltante: 100,
      pendencias: [args.pendenciaSemItens],
    } satisfies ModuloOperacional;
  }

  if (STATUS_REVISADOS.has(args.statusDocumento ?? "")) {
    return {
      status: "revisado",
      label: "Revisado",
      faltante: 0,
      pendencias: ["revisado"],
    } satisfies ModuloOperacional;
  }

  return {
    status: "preenchido",
    label: "Preenchido",
    faltante: 50,
    pendencias: ["revisar e marcar como enviado ou aprovado"],
  } satisfies ModuloOperacional;
}
