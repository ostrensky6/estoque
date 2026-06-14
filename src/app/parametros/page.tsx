import { createClient } from "@/lib/supabase/server";
import { ParametrosForm, type Param } from "@/components/parametros/ParametrosForm";

export const dynamic = "force-dynamic";

export default async function ParametrosPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("parametros")
    .select("chave, valor, unidade, descricao")
    .order("chave");

  const params: Param[] = (data ?? []).map((p) => ({
    chave: p.chave,
    valor: Number(p.valor),
    unidade: p.unidade,
    descricao: p.descricao,
  }));

  return (
    <main className="mx-auto max-w-3xl px-6 py-10 font-sans text-slate-900 dark:text-slate-100">
      <h1 className="text-2xl font-bold tracking-tight">Parâmetros de custeio</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
        Constantes que alimentam todo o cálculo de custo e preço. Os{" "}
        <b className="font-semibold text-emerald-700 dark:text-emerald-400">
          fatores de preço
        </b>{" "}
        transformam o custo em preço de venda; os{" "}
        <b className="font-semibold">parâmetros operacionais</b> ajustam as bases
        de rateio. Alterar qualquer valor recalcula custeio, orçamentos e análises.
      </p>

      {params.length === 0 ? (
        <p className="mt-8 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          Nenhum parâmetro encontrado no banco.
        </p>
      ) : (
        <ParametrosForm params={params} />
      )}
    </main>
  );
}
