import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { ExportOrcamentoFinalButtons } from "@/components/orcamento/ExportOrcamentoFinalButtons";
import { PrintButton } from "@/components/orcamento/PrintButton";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency as brl, formatDate, formatDateTime } from "@/lib/formatters";
import type { Json } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

type SnapshotParametro = {
  key?: string;
  label?: string;
  nominalRate?: number;
  amount?: number;
};

type SnapshotConsolidado = {
  totalLaboratorioCusto?: number;
  totalLaboratorioPreco?: number;
  totalProjetoCusto?: number;
  totalProjetoFinal?: number;
  totalFinal?: number;
  parametrosProjeto?: SnapshotParametro[];
  markupProjeto?: number;
  pendencias?: string[];
  origens?: SnapshotOrigem[];
};

type SnapshotOrigem = {
  campo?: string;
  titulo?: string;
  origem?: string;
  regra?: string;
  valor?: number;
};

type SnapshotFinal = {
  demanda?: {
    id?: number;
    titulo?: string | null;
    cliente_nome?: string | null;
    cliente_cnpj?: string | null;
    cliente_contato?: string | null;
    modalidade?: string | null;
    escopo_preliminar?: string | null;
    descricao?: string | null;
  };
  orcamentos_analises?: SnapshotOrcamentoAnalises[];
  orcamentos_projeto?: SnapshotOrcamentoProjeto[];
  consolidado?: SnapshotConsolidado;
};

type SnapshotOrcamentoAnalises = {
  id?: number;
  status?: string | null;
  orcamento_itens?: SnapshotItemAnalise[];
};

type SnapshotItemAnalise = {
  id?: number;
  codigo_analise?: string | null;
  n_amostras?: number | null;
  custo_unitario?: number | null;
  preco_unitario?: number | null;
};

type SnapshotOrcamentoProjeto = {
  id?: number;
  status?: string | null;
  titulo?: string | null;
  orcamento_projeto_analises?: SnapshotItemAnalise[];
  orcamento_projeto_custos?: SnapshotItemProjeto[];
};

type SnapshotItemProjeto = {
  id?: number;
  rubrica?: string | null;
  categoria?: string | null;
  descricao?: string | null;
  quantidade?: number | null;
  unidade?: string | null;
  custo_unitario?: number | null;
  preco_unitario?: number | null;
  meses_selecionados?: number[] | null;
};

const STATUS: Record<string, string> = {
  emitido: "Emitido",
  substituido: "Substituído",
  cancelado: "Cancelado",
};

export default async function OrcamentoFinalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const versaoId = Number(id);
  const supabase = await createClient();

  const { data: versao } = await supabase
    .from("orcamento_final_versoes")
    .select("*")
    .eq("id", versaoId)
    .single();
  if (!versao) notFound();

  const snapshot = normalizarSnapshot(versao.snapshot);
  const { data: demandaAtual } = await supabase
    .from("demandas_propostas")
    .select("id, titulo, cliente_nome, cliente_cnpj, cliente_contato, modalidade, escopo_preliminar, descricao")
    .eq("id", versao.demanda_id)
    .single();

  const demanda = snapshot.demanda ?? demandaAtual;
  const consolidado = snapshot.consolidado ?? {};
  const origens = normalizarOrigens(consolidado, versao);
  const itensLaboratorio = (snapshot.orcamentos_analises ?? []).flatMap((orcamento) =>
    (orcamento.orcamento_itens ?? []).map((item) => ({
      ...item,
      origem: `Laboratório #${orcamento.id ?? "—"}`,
      status: orcamento.status ?? "—",
    })),
  );
  const custosProjeto = (snapshot.orcamentos_projeto ?? []).flatMap((orcamento) =>
    (orcamento.orcamento_projeto_custos ?? []).map((item) => ({
      ...item,
      origem: `Projeto #${orcamento.id ?? "—"}`,
      status: orcamento.status ?? "—",
    })),
  );
  const analisesProjeto = (snapshot.orcamentos_projeto ?? []).flatMap((orcamento) =>
    (orcamento.orcamento_projeto_analises ?? []).map((item) => ({
      ...item,
      origem: `Projeto #${orcamento.id ?? "—"}`,
      status: orcamento.status ?? "—",
    })),
  );
  const exportInfo = {
    numero: versao.numero,
    versao: Number(versao.versao),
    status: STATUS[versao.status] ?? versao.status,
    cliente_nome: demanda?.cliente_nome ?? null,
    cliente_cnpj: demanda?.cliente_cnpj ?? null,
    cliente_contato: demanda?.cliente_contato ?? null,
    demanda_titulo: demanda?.titulo ?? null,
    modalidade: demanda?.modalidade ?? null,
    validade: formatDate(versao.valido_ate),
    escopo: demanda?.escopo_preliminar || demanda?.descricao || null,
  };
  const exportResumo = {
    total_laboratorio_custo: Number(versao.total_laboratorio_custo ?? 0),
    total_laboratorio_preco: Number(versao.total_laboratorio_preco ?? 0),
    total_projeto_custo: Number(versao.total_projeto_custo ?? 0),
    total_projeto_final: Number(versao.total_projeto_final ?? 0),
    total_final: Number(versao.total_final ?? 0),
  };
  const exportItens = [
    ...itensLaboratorio.map((item) => ({
      grupo: "Laboratório",
      origem: item.origem,
      descricao: item.codigo_analise ?? "Análise",
      quantidade: Number(item.n_amostras ?? 0),
      unidade: "amostra",
      custo_unitario: Number(item.custo_unitario ?? 0),
      preco_unitario: Number(item.preco_unitario ?? 0),
      subtotal: Number(item.n_amostras ?? 0) * Number(item.preco_unitario ?? 0),
    })),
    ...custosProjeto.map((item) => ({
      grupo: `Projeto ${item.rubrica ?? "OU"}`,
      origem: item.origem,
      descricao: item.descricao ?? "Custo de projeto",
      quantidade: item.rubrica === "PE" && item.meses_selecionados?.length ? item.meses_selecionados.length : Number(item.quantidade ?? 0),
      unidade: item.rubrica === "PE" && item.meses_selecionados?.length ? "mes" : item.unidade,
      custo_unitario: Number(item.custo_unitario ?? item.preco_unitario ?? 0),
      preco_unitario: Number(item.custo_unitario ?? item.preco_unitario ?? 0),
      subtotal: subtotalProjetoSnapshot(item),
    })),
    ...analisesProjeto.map((item) => ({
      grupo: "Análise em projeto",
      origem: item.origem,
      descricao: item.codigo_analise ?? "Análise",
      quantidade: Number(item.n_amostras ?? 0),
      unidade: "amostra",
      custo_unitario: Number(item.custo_unitario ?? 0),
      preco_unitario: Number(item.custo_unitario ?? 0),
      subtotal: Number(item.n_amostras ?? 0) * Number(item.custo_unitario ?? 0),
    })),
  ];
  const exportOrigens = origens.map((origem) => ({
    titulo: origem.titulo ?? origem.campo ?? "Total",
    campo: origem.campo ?? "",
    origem: origem.origem ?? "Snapshot da emissão",
    regra: origem.regra ?? "Valor preservado na versão final emitida.",
    valor: Number(origem.valor ?? 0),
  }));

  return (
    <div className="min-h-dvh bg-transparent font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="print-area mx-auto max-w-5xl px-6 py-10">
        <div className="no-print flex flex-wrap items-center justify-between gap-3">
          <Breadcrumbs
            items={[
              { label: "Demandas/Propostas", href: "/orcamento/demandas" },
              { label: demanda?.titulo ?? `Demanda #${versao.demanda_id}`, href: `/orcamento/demandas/${versao.demanda_id}` },
              { label: versao.numero },
            ]}
          />
          <div className="flex flex-wrap items-center gap-2">
            <ExportOrcamentoFinalButtons
              info={exportInfo}
              resumo={exportResumo}
              itens={exportItens}
              origens={exportOrigens}
            />
            <Link
              href={`/orcamento/demandas/${versao.demanda_id}`}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Voltar à demanda
            </Link>
            <PrintButton />
          </div>
        </div>

        <section className="mt-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60 print:border-0 print:shadow-none">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-400">
                Orçamento final
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">{versao.numero}</h1>
              <p className="mt-1 text-sm text-zinc-500">
                Versão {versao.versao} · {STATUS[versao.status] ?? versao.status}
              </p>
            </div>
            <div className="text-right text-sm">
              <p className="font-medium">{brl(Number(versao.total_final ?? 0))}</p>
              <p className="text-zinc-500">Emitido em {formatDateTime(versao.criado_em)}</p>
              <p className="text-zinc-500">Válido até {formatDate(versao.valido_ate)}</p>
            </div>
          </div>

          <dl className="mt-6 grid gap-3 text-sm md:grid-cols-3">
            <Campo titulo="Cliente" valor={demanda?.cliente_nome ?? "—"} />
            <Campo titulo="CNPJ/CPF" valor={demanda?.cliente_cnpj ?? "—"} />
            <Campo titulo="Contato" valor={demanda?.cliente_contato ?? "—"} />
            <Campo titulo="Demanda" valor={demanda?.titulo ?? `#${versao.demanda_id}`} />
            <Campo titulo="Modalidade" valor={demanda?.modalidade ?? "—"} />
            <Campo titulo="Validade" valor={`${versao.validade_dias} dias`} />
          </dl>

          <div className="mt-6 grid gap-3 md:grid-cols-5">
            <Resumo titulo="Custo laboratório" valor={versao.total_laboratorio_custo} />
            <Resumo titulo="Preço laboratório" valor={versao.total_laboratorio_preco} />
            <Resumo titulo="Custo projeto" valor={versao.total_projeto_custo} />
            <Resumo titulo="Projeto final" valor={versao.total_projeto_final} />
            <Resumo titulo="Total final" valor={versao.total_final} destaque />
          </div>

          <section className="mt-6 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Escopo</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-700 dark:text-zinc-300">
              {demanda?.escopo_preliminar || demanda?.descricao || "—"}
            </p>
          </section>

          <section className="mt-6 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Parâmetros econômicos
              </h2>
              <span className="text-xs text-zinc-500">
                Markup projeto: {Number(consolidado.markupProjeto ?? 0).toLocaleString("pt-BR")}%
              </span>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              {(consolidado.parametrosProjeto ?? []).map((parametro) => (
                <div key={parametro.key ?? parametro.label} className="rounded-md bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-950/50">
                  <div className="flex items-center justify-between gap-2">
                    <span>{parametro.label ?? parametro.key}</span>
                    <span className="font-medium">{Number(parametro.nominalRate ?? 0).toLocaleString("pt-BR")}%</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">{brl(Number(parametro.amount ?? 0))}</p>
                </div>
              ))}
              {(consolidado.parametrosProjeto ?? []).length === 0 && (
                <p className="text-sm text-zinc-400">Sem parâmetros de projeto no snapshot.</p>
              )}
            </div>
          </section>

          <section className="mt-6 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Composição detalhada</h2>
            <div className="mt-4 space-y-5">
              <TabelaAnalisesSnapshot titulo="Análises laboratoriais" itens={itensLaboratorio} tipo="laboratorio" />
              <TabelaCustosSnapshot titulo="Custos próprios do projeto" itens={custosProjeto} />
              <TabelaAnalisesSnapshot titulo="Análises dentro de projeto" itens={analisesProjeto} tipo="projeto" />
            </div>
          </section>

          <section className="mt-6 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Origem e auditoria</h2>
            <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
              <Campo titulo="Snapshot" valor="Valores preservados na emissão" />
              <Campo titulo="Status da versão" valor={STATUS[versao.status] ?? versao.status} />
              <Campo titulo="Demanda origem" valor={`#${versao.demanda_id}`} />
            </div>
            <div className="mt-4 divide-y divide-zinc-100 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {origens.map((origem) => (
                <div key={origem.campo ?? origem.titulo} className="grid gap-2 px-3 py-3 text-sm md:grid-cols-[1fr_1.4fr_1.6fr_auto]">
                  <div>
                    <p className="font-medium">{origem.titulo ?? origem.campo}</p>
                    <p className="text-xs text-zinc-500">{origem.campo}</p>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-300">{origem.origem ?? "Snapshot da emissão"}</p>
                  <p className="text-zinc-600 dark:text-zinc-300">{origem.regra ?? "Valor preservado na versão final emitida."}</p>
                  <p className="font-semibold tabular-nums md:text-right">{brl(Number(origem.valor ?? 0))}</p>
                </div>
              ))}
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}

function subtotalProjetoSnapshot(item: SnapshotItemProjeto) {
  const unitario = Number(item.custo_unitario ?? item.preco_unitario ?? 0);
  if (item.rubrica === "PE" && item.meses_selecionados?.length) {
    return item.meses_selecionados.length * unitario;
  }
  return Number(item.quantidade ?? 0) * unitario;
}

function TabelaAnalisesSnapshot({
  titulo,
  itens,
  tipo,
}: {
  titulo: string;
  itens: Array<SnapshotItemAnalise & { origem: string; status: string }>;
  tipo: "laboratorio" | "projeto";
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">{titulo}</h3>
      <div className="mt-2 overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-right text-sm">
          <thead className="text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-2 text-left">Origem</th>
              <th className="px-3 py-2 text-left">Análise</th>
              <th className="px-3 py-2">Amostras</th>
              <th className="px-3 py-2">{tipo === "laboratorio" ? "Custo unit." : "Custo/amostra"}</th>
              <th className="px-3 py-2">{tipo === "laboratorio" ? "Preço unit." : "Preço snapshot"}</th>
              <th className="px-3 py-2">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {itens.map((item, index) => (
              <tr key={`${item.origem}-${item.id ?? index}`}>
                <td className="px-3 py-2 text-left text-zinc-500">{item.origem} · {item.status}</td>
                <td className="px-3 py-2 text-left font-medium">{item.codigo_analise ?? "—"}</td>
                <td className="px-3 py-2 tabular-nums">{Number(item.n_amostras ?? 0)}</td>
                <td className="px-3 py-2 tabular-nums">{brl(Number(item.custo_unitario ?? 0))}</td>
                <td className="px-3 py-2 tabular-nums">{brl(Number(item.preco_unitario ?? 0))}</td>
                <td className="px-3 py-2 font-semibold tabular-nums">
                  {brl(Number(item.n_amostras ?? 0) * Number((tipo === "laboratorio" ? item.preco_unitario : item.custo_unitario) ?? 0))}
                </td>
              </tr>
            ))}
            {itens.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-5 text-center text-xs text-zinc-400">
                  Nenhum item preservado no snapshot.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TabelaCustosSnapshot({
  titulo,
  itens,
}: {
  titulo: string;
  itens: Array<SnapshotItemProjeto & { origem: string; status: string }>;
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">{titulo}</h3>
      <div className="mt-2 overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-right text-sm">
          <thead className="text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-2 text-left">Origem</th>
              <th className="px-3 py-2 text-left">Rubrica</th>
              <th className="px-3 py-2 text-left">Descrição</th>
              <th className="px-3 py-2">Qtd.</th>
              <th className="px-3 py-2">Custo unit.</th>
              <th className="px-3 py-2">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {itens.map((item, index) => (
              <tr key={`${item.origem}-${item.id ?? index}`}>
                <td className="px-3 py-2 text-left text-zinc-500">{item.origem} · {item.status}</td>
                <td className="px-3 py-2 text-left">{item.rubrica ?? "OU"}</td>
                <td className="px-3 py-2 text-left font-medium">{item.descricao ?? "—"}</td>
                <td className="px-3 py-2 tabular-nums">{Number(item.quantidade ?? 0)}</td>
                <td className="px-3 py-2 tabular-nums">{brl(Number(item.custo_unitario ?? item.preco_unitario ?? 0))}</td>
                <td className="px-3 py-2 font-semibold tabular-nums">
                  {brl(Number(item.quantidade ?? 0) * Number(item.custo_unitario ?? item.preco_unitario ?? 0))}
                </td>
              </tr>
            ))}
            {itens.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-5 text-center text-xs text-zinc-400">
                  Nenhum item preservado no snapshot.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function normalizarOrigens(
  consolidado: SnapshotConsolidado,
  versao: {
    total_laboratorio_custo: number;
    total_laboratorio_preco: number;
    total_projeto_custo: number;
    total_projeto_final: number;
    total_final: number;
  },
) {
  if (consolidado.origens?.length) return consolidado.origens;
  return [
    {
      campo: "totalLaboratorioCusto",
      titulo: "Custo laboratório",
      origem: "Snapshot da emissão",
      regra: "Total preservado na versão final.",
      valor: Number(versao.total_laboratorio_custo ?? 0),
    },
    {
      campo: "totalLaboratorioPreco",
      titulo: "Preço laboratório",
      origem: "Snapshot da emissão",
      regra: "Total preservado na versão final.",
      valor: Number(versao.total_laboratorio_preco ?? 0),
    },
    {
      campo: "totalProjetoCusto",
      titulo: "Custo projeto",
      origem: "Snapshot da emissão",
      regra: "Total preservado na versão final.",
      valor: Number(versao.total_projeto_custo ?? 0),
    },
    {
      campo: "totalProjetoFinal",
      titulo: "Projeto final",
      origem: "Snapshot da emissão",
      regra: "Total preservado na versão final.",
      valor: Number(versao.total_projeto_final ?? 0),
    },
    {
      campo: "totalFinal",
      titulo: "Total final",
      origem: "Snapshot da emissão",
      regra: "Total preservado na versão final.",
      valor: Number(versao.total_final ?? 0),
    },
  ];
}

function normalizarSnapshot(snapshot: Json): SnapshotFinal {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return {};
  return snapshot as SnapshotFinal;
}

function Campo({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-950/50">
      <dt className="text-xs font-medium text-zinc-500">{titulo}</dt>
      <dd className="mt-1 font-medium">{valor}</dd>
    </div>
  );
}

function Resumo({ titulo, valor, destaque = false }: { titulo: string; valor: number; destaque?: boolean }) {
  return (
    <div className={`rounded-md border p-3 ${destaque ? "border-brand-200 bg-brand-50 dark:border-brand-900 dark:bg-brand-950/30" : "border-zinc-200 dark:border-zinc-800"}`}>
      <p className="text-xs font-medium text-zinc-500">{titulo}</p>
      <p className={`mt-1 text-base font-semibold tabular-nums ${destaque ? "text-brand-700 dark:text-brand-300" : ""}`}>
        {brl(Number(valor ?? 0))}
      </p>
    </div>
  );
}
