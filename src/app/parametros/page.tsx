import { createClient } from "@/lib/supabase/server";
import { ParametrosForm } from "@/components/parametros/ParametrosForm";

export const dynamic = "force-dynamic";

export default async function ParametrosPage() {
  const supabase = await createClient();
  const { data: params } = await supabase
    .from("parametros")
    .select("chave, valor, unidade, descricao")
    .order("chave");

  return (
    <div className="min-h-dvh bg-transparent font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Parâmetros de custeio</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Constantes globais que dirigem o cálculo. Os <b>fatores de preço</b> transformam o custo
          em preço de venda; alterá-los recalcula o custeio e os novos orçamentos imediatamente.
        </p>

        <div className="mt-8">
          <ParametrosForm
            params={(params ?? []).map((p) => ({
              chave: p.chave,
              valor: Number(p.valor),
              unidade: p.unidade,
              descricao: p.descricao,
            }))}
          />
        </div>
      </main>
    </div>
  );
}
