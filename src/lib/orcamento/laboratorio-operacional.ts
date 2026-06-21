import type { Breakdown } from "@/lib/costing/engine";
import type { Json } from "@/lib/supabase/database.types";

export type ItemLaboratorioOperacional = {
  codigo_analise: string;
  n_amostras: number | string | null;
  custo_unitario: number | string | null;
  preco_unitario: number | string | null;
};

export type StatusLaboratorioOperacional = "pendente" | "preenchido" | "revisado" | "cancelado";

export function statusOperacionalLaboratorio(args: {
  statusDocumento?: string | null;
  quantidadeItens: number;
}): StatusLaboratorioOperacional {
  if (args.statusDocumento === "cancelado") return "cancelado";
  if (["enviado", "aprovado"].includes(args.statusDocumento ?? "")) return "revisado";
  return args.quantidadeItens > 0 ? "preenchido" : "pendente";
}

export function montarSnapshotLaboratorio(
  itens: ItemLaboratorioOperacional[],
  breakdowns: Pick<Breakdown, "codigo" | "reagentes" | "equipamento" | "pessoal" | "overhead" | "custoTotal" | "preco">[],
): Json {
  const porCodigo = new Map(breakdowns.map((item) => [item.codigo, item]));
  const totais = {
    reagentes: 0,
    materiais: 0,
    equipamentos: 0,
    mao_obra: 0,
    terceiros: 0,
    overhead: 0,
    custo: 0,
    preco: 0,
    amostras: 0,
  };
  const linhas = itens.map((item) => {
    const quantidade = Number(item.n_amostras ?? 0);
    const breakdown = porCodigo.get(item.codigo_analise);
    const reagentes = Number(breakdown?.reagentes ?? 0) * quantidade;
    const equipamentos = Number(breakdown?.equipamento ?? 0) * quantidade;
    const maoObra = Number(breakdown?.pessoal ?? 0) * quantidade;
    const overhead = Number(breakdown?.overhead ?? 0) * quantidade;
    const custo = Number(item.custo_unitario ?? breakdown?.custoTotal ?? 0) * quantidade;
    const preco = Number(item.preco_unitario ?? breakdown?.preco ?? 0) * quantidade;
    totais.reagentes += reagentes;
    totais.materiais += reagentes;
    totais.equipamentos += equipamentos;
    totais.mao_obra += maoObra;
    totais.overhead += overhead;
    totais.custo += custo;
    totais.preco += preco;
    totais.amostras += quantidade;
    return {
      codigo_analise: item.codigo_analise,
      quantidade,
      reagentes,
      materiais: reagentes,
      equipamentos,
      mao_obra: maoObra,
      terceiros: 0,
      overhead,
      custo,
      preco,
    };
  });

  return {
    gerado_em: new Date().toISOString(),
    totais,
    linhas,
  };
}
