import { calcularTodas, carregarSimuladorCusteio } from "@/lib/costing/loader";
import { CusteioTable, type CusteioRow } from "@/components/custeio/CusteioTable";
import { CusteioSimulator } from "@/components/custeio/CusteioSimulator";
import { formatCurrency as brl } from "@/lib/formatters";

export const dynamic = "force-dynamic";

export default async function CusteioPage() {
  const { breakdowns, params, valorHoraPessoal, custoHoraOverhead } =
    await calcularTodas();
  const simulador = await carregarSimuladorCusteio();

  const fatoresPct = (
    params.margem_lucro +
    params.impostos +
    params.taxas +
    params.fundo_reserva +
    params.fundo_investimento
  ).toFixed(1);
  const linhas: CusteioRow[] = breakdowns.map((b) => ({
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
    <div className="min-h-dvh bg-transparent font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">
          Custeio por análise
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Custo analítico por amostra (reagentes + equipamento + pessoal),
          overhead e preço. Cenário: lote = tamanho da execução-gargalo · fatores
          de preço somando {fatoresPct}%.
        </p>
        <p className="mt-1 text-xs text-zinc-400">
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

        <p className="mt-4 text-xs text-zinc-400">
          Premissas a validar: lote padrão = execução-gargalo; itens
          &quot;por_execucao&quot; rateados pelo lote; grupo_escolha usa a opção
          mais barata por enquanto. Preço = custo total × (1 + fatores).
        </p>
      </main>
    </div>
  );
}
