import Link from "next/link";
import { calcularTodas, carregarSimuladorCusteio } from "@/lib/costing/loader";
import { CusteioAmostrasChart } from "@/components/custeio/CusteioAmostrasChart";
import { CusteioTable, type CusteioRow } from "@/components/custeio/CusteioTable";
import { CusteioSimulator } from "@/components/custeio/CusteioSimulator";
import { HelpExample, HelpFormula, HelpTip } from "@/components/common/HelpTip";
import { podeVerSalario } from "@/lib/auth/permissao-efetiva";
import { temPapel } from "@/lib/auth/roles";
import { formatCurrency as brl } from "@/lib/formatters";

export const dynamic = "force-dynamic";

export default async function CusteioPage() {
  const { breakdowns, params, valorHoraPessoal, custoHoraOverhead } =
    await calcularTodas();
  const simulador = await carregarSimuladorCusteio();
  const [verRemuneracao, podeAjustarFatores] = await Promise.all([
    podeVerSalario(),
    temPapel("gestor"),
  ]);
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
      <main className="app-page-container">
        <div className="flex items-center gap-1">
          <h1 className="text-xl font-semibold tracking-tight">Custeio por análise</h1>
          <HelpTip title="Como o custo é calculado">
            <p>
              Cada amostra soma <b>reagentes</b>, <b>equipamento</b> e <b>pessoal</b> (custo
              analítico). Depois entra o <b>overhead</b> (custos fixos do laboratório por hora de
              bancada) e, por fim, os fatores de preço.
            </p>
            <HelpFormula>preço = custo total × (1 + fatores)</HelpFormula>
            <p>
              Hoje os fatores somam <b>{fatoresPct}%</b>
              {verRemuneracao ? (
                <>
                  ; hora de pessoal <b>{brl(valorHoraPessoal)}</b>
                </>
              ) : null}
              ; hora de overhead <b>{brl(custoHoraOverhead)}</b>.
            </p>
          </HelpTip>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Custo e preço por amostra, com fatores de preço somando {fatoresPct}%.
          {podeAjustarFatores && (
            <>
              {" "}
              <Link href="/parametros" className="font-medium text-primary hover:underline">
                Ajustar fatores
              </Link>
            </>
          )}
        </p>

        <div className="mt-8">
          <CusteioTable rows={linhas} />
        </div>

        <CusteioAmostrasChart
          analises={simulador.analises}
          params={simulador.params}
          valorHoraPessoal={simulador.valorHoraPessoal}
          custoHoraOverhead={simulador.custoHoraOverhead}
        />

        <CusteioSimulator
          analises={simulador.analises}
          params={simulador.params}
          valorHoraPessoal={simulador.valorHoraPessoal}
          custoHoraOverhead={simulador.custoHoraOverhead}
        />

        <p className="mt-4 flex items-center gap-1 text-xs text-muted-foreground/80">
          Premissas do cálculo em revisão.
          <HelpTip title="Premissas a validar">
            <p>
              <b>Lote:</b> por padrão, é o número de amostras que cabem na etapa mais lenta da
              análise (a que limita a corrida).
            </p>
            <p>
              <b>Itens cobrados por corrida</b> (ex.: controle, calibração) são divididos entre as
              amostras do lote.
            </p>
            <p>
              <b>Itens alternativos</b> (quando a análise aceita um ou outro reagente): por
              enquanto entra o mais barato.
            </p>
            <HelpExample>
              Um controle de R$ 60 por corrida, com lote de 12 amostras, soma R$ 5 a cada amostra.
            </HelpExample>
          </HelpTip>
        </p>
      </main>
    </div>
  );
}
