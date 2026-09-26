import { createClient } from "@/lib/supabase/server";
import { ParametrosForm } from "@/components/parametros/ParametrosForm";
import { HelpTip } from "@/components/common/HelpTip";

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
              Valores que valem para o <b>laboratório inteiro</b>: fatores de preço e bases de
              rateio usadas no custeio, no estoque e nos alertas.
            </p>
            <p>
              A <b>taxa de incubação (UFPR)</b> daqui é o padrão das novas propostas. A mensalidade
              fixa da incubação é custo fixo e fica em Cadastros → Overhead.
            </p>
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
