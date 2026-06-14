import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  InsumosAnaliseTable,
  type InsumoAnaliseRow,
} from "@/components/insumos/InsumosAnaliseTable";

export const dynamic = "force-dynamic";

export default async function InsumosPage({
  searchParams,
}: {
  searchParams: Promise<{ analise?: string }>;
}) {
  const { analise } = await searchParams;
  const supabase = await createClient();

  const { data: analises } = await supabase
    .from("analises")
    .select("codigo")
    .order("codigo");

  const atual = analise ?? analises?.[0]?.codigo ?? "";

  const { data: linhas } = await supabase
    .from("insumo_analise")
    .select(
      "id, nome_etapa, nome_atividade, especificacao_insumo, grupo_escolha, quantidade_por_amostra, modo_cobranca, insumos(custo_unitario)",
    )
    .eq("codigo_analise", atual)
    .order("id");

  // grupos de escolha já existentes (em todas as análises) p/ reaproveitar
  const { data: gruposRaw } = await supabase
    .from("insumo_analise")
    .select("grupo_escolha")
    .not("grupo_escolha", "is", null);
  const grupoOptions = [
    { value: "", label: "(nenhum)" },
    ...[
      ...new Set((gruposRaw ?? []).map((g) => g.grupo_escolha).filter(Boolean) as string[]),
    ]
      .sort()
      .map((g) => ({ value: g, label: g })),
  ];
  const rows: InsumoAnaliseRow[] = (linhas ?? []).map((l) => {
    const custo =
      (l.insumos as { custo_unitario: number | null } | null)
        ?.custo_unitario ?? 0;
    const modo = l.modo_cobranca ?? "";
    return {
      id: l.id as number,
      etapa: l.nome_etapa ?? "—",
      atividade: l.nome_atividade ?? "—",
      etapaAtividade: `${l.nome_etapa ?? ""} ${l.nome_atividade ?? ""}`.trim(),
      especificacao: l.especificacao_insumo ?? "",
      semInsumo: l.especificacao_insumo ? "não" : "sim",
      custoUnitario: Number(custo),
      quantidade: Number(l.quantidade_por_amostra ?? 0),
      grupoEscolha: l.grupo_escolha ?? "",
      modoCobranca: modo,
      modoCobrancaLabel: modo === "por_execucao" ? "por execução" : "por amostra",
    };
  });

  return (
    <div className="min-h-dvh bg-transparent font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">
          Insumos por análise
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Edite <b>grupo de escolha</b> (alternativas mutuamente exclusivas) e{" "}
          <b>modo de cobrança</b> (por amostra ou por execução). As mudanças
          recalculam o custeio.
        </p>

        <nav className="mt-6 flex flex-wrap gap-2">
          {analises?.map((a) => (
            <Link
              key={a.codigo}
              href={`/insumos?analise=${encodeURIComponent(a.codigo)}`}
              className={`rounded-full px-3 py-1 text-xs ${
                a.codigo === atual
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              {a.codigo}
            </Link>
          ))}
        </nav>

        <div className="mt-6">
          <InsumosAnaliseTable rows={rows} grupoOptions={grupoOptions} />
        </div>

        <p className="mt-4 text-xs text-zinc-400">
          {rows.length} linhas · análise {atual}
        </p>
      </main>
    </div>
  );
}
