import { calcularTodas } from "@/lib/costing/loader";

export const dynamic = "force-dynamic";

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function CusteioPage() {
  const { breakdowns, params, valorHoraPessoal, custoHoraOverhead } =
    await calcularTodas();

  const fatoresPct = (
    params.margem_lucro +
    params.impostos +
    params.taxas +
    params.fundo_reserva +
    params.fundo_investimento
  ).toFixed(1);

  return (
    <div className="min-h-dvh bg-zinc-50 font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
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

        <div className="mt-8 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-right text-sm">
            <thead className="bg-zinc-100 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2 text-left">Análise</th>
                <th className="px-3 py-2">Lote</th>
                <th className="px-3 py-2">Reagentes</th>
                <th className="px-3 py-2">Equip.</th>
                <th className="px-3 py-2">Pessoal</th>
                <th className="px-3 py-2 font-semibold">Custo analítico</th>
                <th className="px-3 py-2">Overhead</th>
                <th className="px-3 py-2">Custo total</th>
                <th className="px-3 py-2 font-semibold">Preço</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {breakdowns.map((b) => (
                <tr key={b.codigo}>
                  <td className="px-3 py-2 text-left font-medium">{b.codigo}</td>
                  <td className="px-3 py-2 text-zinc-500">{b.lote}</td>
                  <td className="px-3 py-2">{brl(b.reagentes)}</td>
                  <td className="px-3 py-2">{brl(b.equipamento)}</td>
                  <td className="px-3 py-2">{brl(b.pessoal)}</td>
                  <td className="px-3 py-2 font-semibold">
                    {brl(b.custoAnalitico)}
                  </td>
                  <td className="px-3 py-2">{brl(b.overhead)}</td>
                  <td className="px-3 py-2">{brl(b.custoTotal)}</td>
                  <td className="px-3 py-2 font-semibold text-emerald-700 dark:text-emerald-400">
                    {brl(b.preco)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-zinc-400">
          Premissas a validar: lote padrão = execução-gargalo; itens
          &quot;por_execucao&quot; rateados pelo lote; grupo_escolha usa a opção
          mais barata por enquanto. Preço = custo total × (1 + fatores).
        </p>
      </main>
    </div>
  );
}
