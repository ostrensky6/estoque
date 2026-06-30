import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { calcularTodas } from "@/lib/costing/loader";
import {
  calcularOrcamentoProjetoLegacy,
  type ProjetoBudgetItem,
  type ProjetoBudgetRates,
} from "@/lib/project-budget/legacy";
import { ParametrosEconomicosForm } from "@/components/orcamento/ParametrosEconomicosForm";
import {
  formatCurrency as brl,
  formatNumber,
  formatDateTime,
  APP_LOCALE,
} from "@/lib/formatters";

export const dynamic = "force-dynamic";

const pct = (v: number) =>
  `${v.toLocaleString(APP_LOCALE, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;

const PARAM_KEYS = [
  "dias_uteis_ano",
  "margem_lucro",
  "impostos",
  "taxas",
  "fundo_reserva",
  "fundo_investimento",
] as const;

type ParamKey = (typeof PARAM_KEYS)[number];
type PercentParamKey = Exclude<ParamKey, "dias_uteis_ano">;

type ProjetoAnalise = {
  n_amostras: number | null;
  custo_unitario: number | null;
};

type ProjetoCusto = {
  rubrica: string | null;
  quantidade: number | null;
  custo_unitario: number | null;
  preco_unitario: number | null;
  meses_selecionados: number[] | null;
};

type ProjetoResumo = {
  id: number;
  titulo: string | null;
  status: string | null;
  cliente_nome: string | null;
  data_orcamento: string | null;
  rates: ProjetoBudgetRates;
  itens: ProjetoBudgetItem[];
  analisesCount: number;
  custosCount: number;
};

type VersaoParametro = {
  id: number;
  escopo: string;
  orcamento_projeto_id: number | null;
  versao: number;
  origem: string;
  criado_em: string;
  criado_por: string | null;
  parametros: unknown;
};

const DEFAULTS: Record<ParamKey, number> = {
  dias_uteis_ano: 222,
  margem_lucro: 0,
  impostos: 0,
  taxas: 0,
  fundo_reserva: 0,
  fundo_investimento: 0,
};

const PARAMETROS_LAB: Array<{
  chave: PercentParamKey;
  label: string;
  origem: string;
}> = [
  { chave: "margem_lucro", label: "Margem/lucro", origem: "global" },
  { chave: "impostos", label: "Impostos", origem: "global" },
  { chave: "taxas", label: "Taxas", origem: "global" },
  { chave: "fundo_reserva", label: "Reserva", origem: "global" },
  { chave: "fundo_investimento", label: "Investimentos", origem: "global" },
];

export default async function ParametrosEconomicosPage() {
  const supabase = await createClient();
  const [{ data: parametros }, { data: versoes }, { data: orcamentosProjeto }, { breakdowns, params }] = await Promise.all([
    supabase.from("parametros").select("chave, valor, atualizado_em"),
    supabase
      .from("parametros_economicos_versoes")
      .select("id, escopo, orcamento_projeto_id, versao, origem, criado_em, criado_por, parametros")
      .order("criado_em", { ascending: false })
      .limit(12),
    supabase
      .from("orcamento_projetos")
      .select(
        "id, titulo, status, cliente_nome, data_orcamento, impostos, impostos_legacy, incubacao, reserva, investimentos, lucro, margem_lucro, orcamento_projeto_analises(n_amostras, custo_unitario), orcamento_projeto_custos(rubrica, quantidade, custo_unitario, preco_unitario, meses_selecionados)",
      )
      .order("criado_em", { ascending: false })
      .limit(8),
    calcularTodas(),
  ]);

  const valores = { ...DEFAULTS };
  const atualizadoEm = new Map<string, string>();
  for (const p of parametros ?? []) {
    if (PARAM_KEYS.includes(p.chave as ParamKey)) {
      valores[p.chave as ParamKey] = Number(p.valor);
      if (p.atualizado_em) atualizadoEm.set(p.chave, p.atualizado_em);
    }
  }

  const fatorTotal =
    params.margem_lucro +
    params.impostos +
    params.taxas +
    params.fundo_reserva +
    params.fundo_investimento;
  const custoMedio =
    breakdowns.length > 0
      ? breakdowns.reduce((acc, b) => acc + b.custoTotal, 0) / breakdowns.length
      : 0;
  const precoMedio =
    breakdowns.length > 0
      ? breakdowns.reduce((acc, b) => acc + b.preco, 0) / breakdowns.length
      : 0;
  const ultimaAtualizacao = [...atualizadoEm.values()].sort().at(-1);

  const analisesPreview = [...breakdowns]
    .sort((a, b) => b.preco - a.preco)
    .slice(0, 5);
  const impactoTotalLab = Math.max(0, precoMedio - custoMedio);
  const parametrosLab = PARAMETROS_LAB.map((parametro) => ({
    ...parametro,
    valor: valores[parametro.chave],
    impacto: custoMedio * (valores[parametro.chave] / 100),
    versao: versaoMaisRecente(versoes as VersaoParametro[] | null | undefined, "laboratorio_global"),
  }));

  const projetos = ((orcamentosProjeto ?? []) as unknown as ProjetoResumo[]).map((orcamento) => {
    const analises = (orcamento as unknown as { orcamento_projeto_analises?: ProjetoAnalise[] | null })
      .orcamento_projeto_analises ?? [];
    const custos = (orcamento as unknown as { orcamento_projeto_custos?: ProjetoCusto[] | null })
      .orcamento_projeto_custos ?? [];
    const itens: ProjetoBudgetItem[] = [
      ...analises.map((item) => ({
        rubrica: "ST",
        quantidade: Number(item.n_amostras ?? 0),
        preco_unitario: Number(item.custo_unitario ?? 0),
      })),
      ...custos.map((item) => ({
        rubrica: item.rubrica,
        quantidade: item.quantidade,
        preco_unitario: Number(item.custo_unitario ?? item.preco_unitario ?? 0),
        meses_selecionados: item.meses_selecionados,
      })),
    ];
    return {
      id: orcamento.id,
      titulo: orcamento.titulo,
      status: orcamento.status,
      cliente_nome: orcamento.cliente_nome,
      data_orcamento: orcamento.data_orcamento,
      rates: {
        impostos_legacy: Number(orcamento.rates?.impostos_legacy ?? (orcamento as unknown as { impostos_legacy?: number | null }).impostos_legacy ?? (orcamento as unknown as { impostos?: number | null }).impostos ?? 0),
        incubacao: Number(orcamento.rates?.incubacao ?? (orcamento as unknown as { incubacao?: number | null }).incubacao ?? 0),
        reserva: Number(orcamento.rates?.reserva ?? (orcamento as unknown as { reserva?: number | null }).reserva ?? 0),
        investimentos: Number(orcamento.rates?.investimentos ?? (orcamento as unknown as { investimentos?: number | null }).investimentos ?? 0),
        lucro: Number(orcamento.rates?.lucro ?? (orcamento as unknown as { lucro?: number | null }).lucro ?? (orcamento as unknown as { margem_lucro?: number | null }).margem_lucro ?? 0),
      },
      itens,
      analisesCount: analises.length,
      custosCount: custos.length,
    };
  });
  const projetosCalculados = projetos.map((projeto) => ({
    ...projeto,
    calculo: calcularOrcamentoProjetoLegacy(projeto.itens, projeto.rates),
  }));
  const totalProjetoCusto = projetosCalculados.reduce((acc, projeto) => acc + projeto.calculo.subtotal, 0);
  const totalProjetoFinal = projetosCalculados.reduce((acc, projeto) => acc + projeto.calculo.grossTotal, 0);
  const impactoProjeto = Math.max(0, totalProjetoFinal - totalProjetoCusto);
  const parametrosProjeto = somarParametrosProjeto(projetosCalculados);
  const projetosInvalidos = projetosCalculados.filter((projeto) => projeto.calculo.validationError);

  const card =
    "rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900";

  return (
    <div className="min-h-dvh bg-transparent font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link
              href="/orcamento"
              className="text-xs text-zinc-500 hover:underline"
            >
              Orçamentos
            </Link>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              Parâmetros econômicos
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-zinc-500">
              Cockpit financeiro para conferir custos recebidos, percentuais,
              fórmula, impacto e versões antes de recalcular ou emitir novas
              propostas.
            </p>
          </div>
          <Link
            href="/custeio"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Ver custeio
          </Link>
        </div>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className={card}>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Fator econômico total
            </p>
            <p className="mt-2 text-2xl font-semibold text-brand-700 dark:text-brand-400">
              {pct(fatorTotal)}
            </p>
          </div>
          <div className={card}>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Dias úteis/ano
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {formatNumber(params.dias_uteis_ano)}
            </p>
          </div>
          <div className={card}>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Impacto laboratório
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {brl(impactoTotalLab)}
            </p>
          </div>
          <div className={card}>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Impacto projeto
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {brl(impactoProjeto)}
            </p>
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.1fr]">
          <PainelCustos
            titulo="Custos recebidos"
            itens={[
              ["Laboratório", brl(custoMedio), `${breakdowns.length} análise(s) no catálogo calculado`],
              ["Projeto", brl(totalProjetoCusto), `${projetosCalculados.length} orçamento(s) recentes considerados`],
              ["Consolidado", brl(custoMedio + totalProjetoCusto), "base de simulação antes dos parâmetros"],
            ]}
          />
          <div className={card}>
            <h2 className="text-sm font-semibold">Fórmula e validação</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <InfoParametro label="Laboratório" value={`Preço = custo x (1 + ${pct(fatorTotal)})`} />
              <InfoParametro label="Projeto" value="Total = custo / (1 - soma dos percentuais)" />
              <InfoParametro label="Base laboratório" value={`${brl(custoMedio)} -> ${brl(precoMedio)}`} />
              <InfoParametro label="Base projeto" value={`${brl(totalProjetoCusto)} -> ${brl(totalProjetoFinal)}`} />
            </div>
            <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs leading-5 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-300">
              {projetosInvalidos.length > 0 ? (
                <span className="font-medium text-red-600 dark:text-red-300">
                  {projetosInvalidos.length} orçamento(s) de projeto têm gross-up inválido e precisam de revisão antes de emissão.
                </span>
              ) : (
                <span>
                  Gross-up de projeto validado nos orçamentos recentes: a soma de impostos,
                  incubação, reserva, investimentos e lucro fica abaixo de 100%.
                </span>
              )}
            </div>
          </div>
        </section>

        {ultimaAtualizacao && (
          <p className="mt-3 text-xs text-zinc-400">
            Última atualização:{" "}
            {formatDateTime(ultimaAtualizacao)}
          </p>
        )}

        <section className="mt-8">
          <div className="mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Premissas de orçamento
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Alterações valem para novos cálculos e para orçamentos
              recalculados. Orçamentos já emitidos mantêm o snapshot salvo até
              você usar “Recalcular preços”.
            </p>
          </div>
          <ParametrosEconomicosForm valores={valores} />
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-2">
          <TabelaParametros
            titulo="Impacto dos parâmetros globais"
            subtitulo="Simulação sobre o custo médio calculado do catálogo laboratorial."
            linhas={parametrosLab.map((parametro) => [
              parametro.label,
              pct(parametro.valor),
              "%",
              parametro.origem,
              parametro.versao,
              brl(parametro.impacto),
            ])}
          />
          <TabelaParametros
            titulo="Impacto dos parâmetros de projeto"
            subtitulo="Soma dos impactos nos orçamentos de projeto recentes."
            linhas={parametrosProjeto.map((parametro) => [
              parametro.label,
              pct(parametro.percentualMedio),
              "%",
              "projeto",
              versaoMaisRecente(versoes as VersaoParametro[] | null | undefined, "projeto"),
              brl(parametro.impacto),
            ])}
          />
        </section>

        <section tabIndex={0} aria-label="Orçamentos de projeto considerados" className="mt-8 overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <h2 className="text-sm font-semibold">Orçamentos de projeto considerados</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Leitura recente para validar base, itens, fator de gross-up e bloqueios.
            </p>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Projeto</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3 text-right">Itens</th>
                <th className="px-4 py-3 text-right">Custo</th>
                <th className="px-4 py-3 text-right">Gross-up</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Validação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {projetosCalculados.map((projeto) => (
                <tr key={projeto.id}>
                  <td className="px-4 py-3">
                    <Link href={`/orcamento/projetos/${projeto.id}`} className="font-medium text-brand-700 hover:underline dark:text-brand-300">
                      #{projeto.id} {projeto.titulo ?? "Sem título"}
                    </Link>
                    <p className="mt-0.5 text-xs text-zinc-500">{projeto.status ?? "sem status"}</p>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{projeto.cliente_nome ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-500">{projeto.analisesCount + projeto.custosCount}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-500">{brl(projeto.calculo.subtotal)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-500">
                    {pct(projeto.calculo.markupRate)} · {projeto.calculo.grossUpFactor.toFixed(4).replace(".", ",")}x
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{brl(projeto.calculo.grossTotal)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                      projeto.calculo.validationError
                        ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300"
                        : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                    }`}>
                      {projeto.calculo.validationError || "Válido"}
                    </span>
                  </td>
                </tr>
              ))}
              {projetosCalculados.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-5 text-sm text-zinc-400">
                    Nenhum orçamento de projeto recente encontrado para simulação.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="mt-8 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <h2 className="text-sm font-semibold">Versões de parâmetros</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Snapshots criados ao salvar parâmetros globais ou parâmetros econômicos de projeto.
            </p>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {(versoes ?? []).map((versao) => (
              <div key={versao.id} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[1.1fr_0.5fr_0.8fr_1fr_1fr_1.2fr]">
                <span className="font-medium">
                  {versao.escopo === "laboratorio_global" ? "Laboratório global" : "Projeto"}
                </span>
                <span>v{versao.versao}</span>
                <span>{versao.orcamento_projeto_id ? `Projeto #${versao.orcamento_projeto_id}` : "Global"}</span>
                <span>{versao.origem}</span>
                <span className="text-zinc-500">{formatDateTime(versao.criado_em)}</span>
                <span className="text-zinc-500">{resumirPayloadVersao((versao as VersaoParametro).parametros)}</span>
              </div>
            ))}
            {(versoes ?? []).length === 0 && (
              <p className="px-4 py-5 text-sm text-zinc-400">
                Nenhuma versão registrada ainda. O próximo salvamento criará o primeiro snapshot.
              </p>
            )}
          </div>
        </section>

        <section tabIndex={0} aria-label="Prévia de impacto" className="mt-8 overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <h2 className="text-sm font-semibold">Prévia de impacto</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Cinco análises com maior preço atual usando estes parâmetros.
            </p>
          </div>
          <table className="w-full text-right text-sm">
            <thead className="text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 text-left">Análise</th>
                <th className="px-4 py-3">Custo total</th>
                <th className="px-4 py-3">Fatores</th>
                <th className="px-4 py-3">Preço</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {analisesPreview.map((b) => (
                <tr key={b.codigo}>
                  <td className="px-4 py-2.5 text-left font-medium">
                    {b.codigo}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-zinc-500">
                    {brl(b.custoTotal)}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-zinc-500">
                    {pct(b.fatores * 100)}
                  </td>
                  <td className="px-4 py-2.5 font-semibold tabular-nums text-brand-700 dark:text-brand-400">
                    {brl(b.preco)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}

function InfoParametro({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-zinc-50 p-2 dark:bg-zinc-950/50">
      <p className="text-zinc-400">{label}</p>
      <p className="mt-1 font-medium text-zinc-700 dark:text-zinc-200">{value}</p>
    </div>
  );
}

function PainelCustos({
  titulo,
  itens,
}: {
  titulo: string;
  itens: Array<[string, string, string]>;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold">{titulo}</h2>
      <div className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
        {itens.map(([label, valor, detalhe]) => (
          <div key={label} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
            <div>
              <p className="text-sm font-medium">{label}</p>
              <p className="mt-1 text-xs text-zinc-500">{detalhe}</p>
            </div>
            <p className="text-right text-sm font-semibold tabular-nums">{valor}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TabelaParametros({
  titulo,
  subtitulo,
  linhas,
}: {
  titulo: string;
  subtitulo: string;
  linhas: string[][];
}) {
  return (
    <section tabIndex={0} aria-label={titulo} className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="text-sm font-semibold">{titulo}</h2>
        <p className="mt-1 text-xs text-zinc-500">{subtitulo}</p>
      </div>
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-4 py-3">Campo</th>
            <th className="px-4 py-3 text-right">Valor</th>
            <th className="px-4 py-3">Unidade</th>
            <th className="px-4 py-3">Origem</th>
            <th className="px-4 py-3">Versão</th>
            <th className="px-4 py-3 text-right">Impacto</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {linhas.map((linha) => (
            <tr key={`${linha[0]}-${linha[3]}`}>
              <td className="px-4 py-3 font-medium">{linha[0]}</td>
              <td className="px-4 py-3 text-right tabular-nums text-zinc-500">{linha[1]}</td>
              <td className="px-4 py-3 text-zinc-500">{linha[2]}</td>
              <td className="px-4 py-3 text-zinc-500">{linha[3]}</td>
              <td className="px-4 py-3 text-zinc-500">{linha[4]}</td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums">{linha[5]}</td>
            </tr>
          ))}
          {linhas.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-5 text-sm text-zinc-400">
                Sem dados suficientes para calcular impacto.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

function versaoMaisRecente(
  versoes: VersaoParametro[] | null | undefined,
  escopo: "laboratorio_global" | "projeto",
) {
  const versao = (versoes ?? []).find((item) => item.escopo === escopo);
  return versao ? `v${versao.versao}` : "sem snapshot";
}

function somarParametrosProjeto(
  projetos: Array<{ calculo: ReturnType<typeof calcularOrcamentoProjetoLegacy> }>,
) {
  const mapa = new Map<string, { label: string; impacto: number; percentual: number; count: number }>();
  for (const projeto of projetos) {
    for (const parametro of projeto.calculo.economicParameters) {
      const atual = mapa.get(parametro.key) ?? {
        label: parametro.label,
        impacto: 0,
        percentual: 0,
        count: 0,
      };
      atual.impacto += parametro.amount;
      atual.percentual += parametro.nominalRate;
      atual.count += 1;
      mapa.set(parametro.key, atual);
    }
  }
  return [...mapa.values()].map((item) => ({
    label: item.label,
    impacto: item.impacto,
    percentualMedio: item.count > 0 ? item.percentual / item.count : 0,
  }));
}

function resumirPayloadVersao(payload: unknown) {
  if (!payload || typeof payload !== "object") return "sem payload";
  const record = payload as Record<string, unknown>;
  const entradas = Object.entries(record)
    .filter(([, value]) => typeof value === "number" || typeof value === "string")
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${String(value)}`);
  return entradas.length > 0 ? entradas.join(" · ") : "payload estruturado";
}
