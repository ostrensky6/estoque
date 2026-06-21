import { NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type DemandaHistorico = {
  id: number;
  titulo: string | null;
  cliente_nome: string | null;
  responsavel_interno: string | null;
  modalidade: string | null;
};

type VersaoFinal = {
  id: number;
  demanda_id: number;
  versao: number;
  numero: string;
  status: string;
  valido_ate: string | null;
  total_final: number;
  total_laboratorio_custo: number;
  total_laboratorio_preco: number;
  total_projeto_custo: number;
  total_projeto_final: number;
  criado_por: string | null;
  criado_em: string;
  demandas_propostas?: DemandaHistorico | null;
};

export async function GET(request: NextRequest) {
  const filtros = Object.fromEntries(request.nextUrl.searchParams.entries());
  const supabase = await createClient();
  const { data } = await supabase
    .from("orcamento_final_versoes")
    .select(
      "id, demanda_id, versao, numero, status, valido_ate, total_final, total_laboratorio_custo, total_laboratorio_preco, total_projeto_custo, total_projeto_final, criado_por, criado_em, demandas_propostas(id, titulo, cliente_nome, responsavel_interno, modalidade)",
    )
    .order("criado_em", { ascending: false });

  const linhas = filtrar((data ?? []) as VersaoFinal[], filtros).map((item) => {
    const demanda = item.demandas_propostas;
    const custoTotal = Number(item.total_laboratorio_custo ?? 0) + Number(item.total_projeto_custo ?? 0);
    return [
      item.numero,
      item.versao,
      item.status,
      demanda?.titulo ?? `Demanda ${item.demanda_id}`,
      demanda?.cliente_nome ?? "",
      demanda?.modalidade ?? "",
      demanda?.responsavel_interno ?? item.criado_por ?? "",
      item.criado_em,
      item.valido_ate ?? "",
      custoTotal,
      item.total_laboratorio_preco,
      item.total_projeto_final,
      item.total_final,
    ];
  });

  const csv = [
    [
      "numero",
      "versao",
      "status",
      "demanda",
      "cliente",
      "modalidade",
      "responsavel",
      "criado_em",
      "validade",
      "custo_total",
      "preco_laboratorio",
      "preco_projeto",
      "preco_final",
    ],
    ...linhas,
  ]
    .map((row) => row.map(csvCell).join(";"))
    .join("\r\n");

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="historico-orcamentos.csv"`,
    },
  });
}

function filtrar(versoes: VersaoFinal[], filtros: Record<string, string>) {
  const texto = (valor: string | null | undefined) => (valor ?? "").toLocaleLowerCase("pt-BR");
  const inclui = (valor: string | null | undefined, filtro: string | undefined) =>
    !filtro || texto(valor).includes(texto(filtro));
  const dataMin = (valor: string, min?: string) => !min || valor.slice(0, 10) >= min;
  const dataMax = (valor: string, max?: string) => !max || valor.slice(0, 10) <= max;
  const numeroMin = (valor: number, min?: string) => !min || valor >= Number(min);
  const numeroMax = (valor: number, max?: string) => !max || valor <= Number(max);

  return versoes.filter((item) => {
    const demanda = item.demandas_propostas;
    return (
      (!filtros.status || item.status === filtros.status) &&
      inclui(demanda?.cliente_nome, filtros.cliente) &&
      inclui(demanda?.responsavel_interno ?? item.criado_por, filtros.responsavel) &&
      inclui(demanda?.modalidade, filtros.modalidade) &&
      dataMin(item.criado_em, filtros.emitido_de) &&
      dataMax(item.criado_em, filtros.emitido_ate) &&
      (!item.valido_ate || dataMin(item.valido_ate, filtros.validade_de)) &&
      (!item.valido_ate || dataMax(item.valido_ate, filtros.validade_ate)) &&
      numeroMin(Number(item.total_final ?? 0), filtros.valor_min) &&
      numeroMax(Number(item.total_final ?? 0), filtros.valor_max)
    );
  });
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}
