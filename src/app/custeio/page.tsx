import { calcularTodas, carregarSimuladorCusteio } from "@/lib/costing/loader";
import { CusteioTable, type CusteioRow } from "@/components/custeio/CusteioTable";
import { CusteioSimulator } from "@/components/custeio/CusteioSimulator";
import { formatCurrency as brl } from "@/lib/formatters";

export const dynamic = "force-dynamic";

export default async function CusteioPage() {
  const { breakdowns, params, valorHoraPessoal, custoHoraOverhead } =
    await calcularTodas();
  const simulador = await carregarSimuladorCusteio();
  const codigosAtivos = new Set(simulador.analises.map((analise) => analise.codigo));

  const fatoresPct = (
    params.margem_lucro +
    params.impostos +
    params.taxas +
    params.fundo_reserva +
    params.fundo_investimento
  ).toFixed(1);
  const linhas: CusteioRow[] = breakdowns
    .filter((b) => codigosAtivos.has(b.codigo))
    .map((b) => ({
      codigo: b.codigo,
      lote: b.lote,
      reagentes: b.reagentes,
      equipamento: b.equipamento,
      pessoal: b.pessoal,
      custoAnalitico: b.custoAnalitico,
      overhead: b.overhead,
      custoTotal: b.custoTotal,
      preco: b.preco,
    }));

  return (
    <div className="min-h-dvh bg-transparent font-sans text-foreground">
      <main className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">
          Custeio por análise
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Custo analítico por amostra (reagentes + equipamento + pessoal),
          overhead e preço. Cenário: lote = tamanho da execução-gargalo · fatores
          de preço somando {fatoresPct}%.
        </p>
        <p className="mt-1 text-xs text-muted-foreground/80">
          valor-hora pessoal {brl(valorHoraPessoal)} · custo-hora overhead{" "}
          {brl(custoHoraOverhead)}
        </p>

        <div className="mt-8">
          <CusteioTable rows={linhas} />
        </div>

        <CusteioSimulator
          analises={simulador.analises}
          params={simulador.params}
          valorHoraPessoal={simulador.valorHoraPessoal}
          custoHoraOverhead={simulador.custoHoraOverhead}
        />

        <p className="mt-4 text-xs text-muted-foreground/80">
          Premissas a validar: lote padrão = execução-gargalo; itens
          &quot;por_execucao&quot; rateados pelo lote; grupo_escolha usa a opção
          mais barata por enquanto. Preço = custo total × (1 + fatores).
        </p>
      </main>
    </div>
  );
}
