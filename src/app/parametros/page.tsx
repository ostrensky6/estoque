import { createClient } from "@/lib/supabase/server";
import { ParametrosForm } from "@/components/parametros/ParametrosForm";
import { HelpFormula, HelpTip } from "@/components/common/HelpTip";

export const dynamic = "force-dynamic";

export default async function ParametrosPage() {
  const supabase = await createClient();
  const { data: params } = await supabase
    .from("parametros")
    .select("chave, valor, unidade, descricao")
    .order("chave");

  return (
    <div className="min-h-dvh bg-transparent font-sans text-foreground">
      <main className="app-page-container">
        <div className="flex items-center gap-1">
          <h1 className="text-xl font-semibold tracking-tight">Parâmetros de custeio</h1>
          <HelpTip title="Parâmetros de custeio">
            <p>
              Valores que valem para o laboratório inteiro. Os <b>fatores de preço</b> (margem,
              impostos, taxas e fundos) transformam o custo em preço de venda.
            </p>
            <p>Ao salvar, o custeio e os novos orçamentos passam a usar os novos valores na hora.</p>
            <HelpFormula>preço = custo × (1 + soma dos fatores)</HelpFormula>
          </HelpTip>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Alterar um fator recalcula custos e preços imediatamente.
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
