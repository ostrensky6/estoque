import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { gargalo, horasBancadaPorAmostra, type Etapa } from "@/lib/costing/engine";

export const dynamic = "force-dynamic";

const num = (v: number) =>
  v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export default async function AnalisesPage() {
  const supabase = await createClient();
  const [
    { data: analises },
    { data: etapas },
    { data: insumoAnalise },
    { data: equipAnalise },
  ] = await Promise.all([
    supabase.from("analises").select("codigo, nome, descricao, ativo").order("codigo"),
    supabase.from("etapas").select("*"),
    supabase.from("insumo_analise").select("codigo_analise"),
    supabase.from("equipamento_analise").select("codigo_analise"),
  ]);

  const contar = (rows: { codigo_analise: string }[] | null, cod: string) =>
    (rows ?? []).filter((r) => r.codigo_analise === cod).length;

  const linhas = (analises ?? []).map((a) => {
    const etapasA = ((etapas ?? []) as Etapa[]).filter(
      (e) => (e as unknown as { codigo_analise: string }).codigo_analise === a.codigo,
    );
    const g = gargalo(etapasA);
    return {
      ...a,
      nEtapas: etapasA.length,
      amostrasDia: g.amostrasDia,
      execucoesDia: g.execucoesDia,
      tempoBancada: horasBancadaPorAmostra(etapasA),
      nInsumos: contar(insumoAnalise, a.codigo),
      nEquip: contar(equipAnalise, a.codigo),
    };
  });

  return (
    <div className="min-h-dvh bg-zinc-50 font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Análises</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Catálogo técnico das análises do laboratório. Clique para ver o painel
          completo: etapas, capacidade, equipamentos e materiais utilizados.
        </p>

        <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60">
              <tr>
                <th className="px-4 py-3 text-left">Análise</th>
                <th className="px-4 py-3 text-right">Etapas</th>
                <th className="px-4 py-3 text-right">Amostras/dia</th>
                <th className="px-4 py-3 text-right">Bancada (h/amostra)</th>
                <th className="px-4 py-3 text-right">Equip.</th>
                <th className="px-4 py-3 text-right">Materiais</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {linhas.map((l) => (
                <tr key={l.codigo} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/analises/${encodeURIComponent(l.codigo)}`}
                      className="font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                    >
                      {l.codigo}
                    </Link>
                    {l.nome && (
                      <span className="block text-xs text-zinc-400">{l.nome}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{l.nEtapas}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {l.amostrasDia > 0 ? num(l.amostrasDia) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-zinc-500">
                    {l.tempoBancada > 0 ? num(l.tempoBancada) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{l.nEquip}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{l.nInsumos}</td>
                  <td className="px-4 py-2.5 text-center">
                    {l.ativo ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                        Ativa
                      </span>
                    ) : (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800">
                        Inativa
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {linhas.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-zinc-400">
                    Nenhuma análise cadastrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
