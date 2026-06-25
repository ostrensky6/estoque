import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { ExportOrcamentoFinalButtons } from "@/components/orcamento/ExportOrcamentoFinalButtons";
import { PrintButton } from "@/components/orcamento/PrintButton";
import { cancelarVersaoFinal, duplicarVersaoFinal } from "@/lib/actions/orcamento-historico";
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
    instituicao?: string | null;
    responsavel_interno?: string | null;
    data_solicitacao?: string | null;
    prazo_esperado?: string | null;
    modalidade?: string | null;
    matriz_amostra?: string | null;
    quantidade_amostras_estimada?: number | null;
    prazo_tecnico_dias?: number | null;
    escopo_preliminar?: string | null;
    descricao?: string | null;
    observacoes?: string | null;
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
    .select("id, titulo, cliente_nome, cliente_cnpj, cliente_contato, instituicao, responsavel_interno, data_solicitacao, prazo_esperado, modalidade, matriz_amostra, quantidade_amostras_estimada, prazo_tecnico_dias, escopo_preliminar, descricao, observacoes")
    .eq("id", versao.demanda_id)
    .single();

  const demanda = { ...(demandaAtual ?? {}), ...(snapshot.demanda ?? {}) };
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
    emitido_em: formatDateTime(versao.criado_em),
    validade: formatDate(versao.valido_ate),
    validade_dias: Number(versao.validade_dias ?? 0),
    escopo: demanda?.escopo_preliminar || demanda?.descricao || null,
    condicoes: condicoesComerciais(versao),
    responsavel: "ATGC Genética Ambiental",
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
  const composicaoCliente = consolidarComposicaoCliente(exportItens);
  const statusLabel = STATUS[versao.status] ?? versao.status;
  const modoInternoHref = "#modo-interno";

  return (
    <div className="min-h-dvh bg-transparent font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="print-area mx-auto max-w-6xl px-6 py-10">
        <div className="no-print flex flex-wrap items-center justify-between gap-3">
          <Breadcrumbs
            items={[
              { label: "Orçamentos não finalizados", href: "/orcamento/demandas" },
              { label: demanda?.titulo ?? `Orçamento #${versao.demanda_id}`, href: `/orcamento/demandas/${versao.demanda_id}` },
              { label: versao.numero },
            ]}
          />
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={modoInternoHref}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Modo interno
            </a>
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
              Voltar ao orçamento
            </Link>
            <PrintButton />
          </div>
        </div>

        <section className="mt-4 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60 print:border-0 print:shadow-none">
          <div className="border-b border-zinc-200 bg-zinc-950 px-6 py-5 text-white dark:border-zinc-800">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200">
                  ATGC Genética Ambiental
                </p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight">Proposta comercial</h1>
                <p className="mt-1 text-sm text-zinc-300">{demanda?.titulo ?? `Orçamento #${versao.demanda_id}`}</p>
              </div>
              <div className="text-right text-sm">
                <p className="text-xs uppercase tracking-wide text-zinc-400">Número</p>
                <p className="mt-1 text-lg font-semibold">{versao.numero}</p>
                <p className="mt-1 text-zinc-300">v{versao.versao} · {statusLabel}</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
              <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Dados do cliente</h2>
                <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                  <Campo titulo="Cliente" valor={demanda?.cliente_nome ?? "—"} />
                  <Campo titulo="CNPJ/CPF" valor={demanda?.cliente_cnpj ?? "—"} />
                  <Campo titulo="Contato" valor={demanda?.cliente_contato ?? "—"} />
                  <Campo titulo="Instituição" valor={demanda?.instituicao ?? "—"} />
                  <Campo titulo="Responsável interno" valor={demanda?.responsavel_interno ?? "—"} />
                  <Campo titulo="Data da solicitação" valor={formatDate(demanda?.data_solicitacao ?? null)} />
                  <Campo titulo="Modalidade" valor={demanda?.modalidade ?? "—"} />
                  <Campo titulo="Prazo esperado" valor={formatDate(demanda?.prazo_esperado ?? null)} />
                  <Campo titulo="Emitido em" valor={formatDateTime(versao.criado_em)} />
                  <Campo titulo="Válido até" valor={formatDate(versao.valido_ate)} />
                </dl>
              </section>

              <aside className="rounded-lg border border-brand-200 bg-brand-50 p-4 dark:border-brand-900 dark:bg-brand-950/30">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">Total da proposta</p>
                <p className="mt-3 text-3xl font-semibold tabular-nums text-brand-800 dark:text-brand-200">
                  {brl(Number(versao.total_final ?? 0))}
                </p>
                <p className="mt-2 text-sm text-brand-700 dark:text-brand-300">
                  Validade de {Number(versao.validade_dias ?? 0)} dias a partir da emissão.
                </p>
              </aside>
            </div>

            <section className="mt-6 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Escopo resumido</h2>
              <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                <Campo titulo="Matriz/amostra" valor={demanda?.matriz_amostra ?? "—"} />
                <Campo
                  titulo="Qtd. amostras"
                  valor={demanda?.quantidade_amostras_estimada ? String(demanda.quantidade_amostras_estimada) : "—"}
                />
                <Campo
                  titulo="Prazo técnico"
                  valor={demanda?.prazo_tecnico_dias ? `${demanda.prazo_tecnico_dias} dias` : "—"}
                />
              </dl>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <TextoDemanda titulo="Escopo preliminar" valor={demanda?.escopo_preliminar} />
                <TextoDemanda titulo="Descrição do orçamento" valor={demanda?.descricao} />
              </div>
              {demanda?.observacoes && (
                <TextoDemanda titulo="Observações gerais" valor={demanda.observacoes} className="mt-4" />
              )}
            </section>

            <section className="mt-6 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Composição comercial</h2>
                <p className="mt-1 text-xs text-zinc-500">Valores de cliente, sem exposição de custo interno.</p>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Grupo</th>
                    <th className="px-4 py-3">Descrição</th>
                    <th className="px-4 py-3 text-right">Qtd.</th>
                    <th className="px-4 py-3">Unidade</th>
                    <th className="px-4 py-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {composicaoCliente.map((item) => (
                    <tr key={`${item.grupo}-${item.descricao}`}>
                      <td className="px-4 py-3 font-medium">{item.grupo}</td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{item.descricao}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{item.quantidade}</td>
                      <td className="px-4 py-3 text-zinc-500">{item.unidade ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{brl(item.subtotal)}</td>
                    </tr>
                  ))}
                  {composicaoCliente.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-5 text-center text-sm text-zinc-400">
                        Nenhum item preservado no snapshot da proposta.
                      </td>
                    </tr>
                  )}
                  <tr className="bg-zinc-50 font-semibold dark:bg-zinc-950/50">
                    <td colSpan={4} className="px-4 py-3 text-right">Total final</td>
                    <td className="px-4 py-3 text-right tabular-nums">{brl(Number(versao.total_final ?? 0))}</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section className="mt-6 grid gap-4 md:grid-cols-3">
              <BlocoDocumento titulo="Condições comerciais">
                {condicoesComerciais(versao)}
              </BlocoDocumento>
              <BlocoDocumento titulo="Prazos e validade">
                Emitido em {formatDateTime(versao.criado_em)} e válido até {formatDate(versao.valido_ate)}.
              </BlocoDocumento>
              <BlocoDocumento titulo="Responsável">
                ATGC Genética Ambiental · orçamento emitido a partir do snapshot #{versao.id}.
              </BlocoDocumento>
            </section>
          </div>
        </section>

        <section id="modo-interno" className="mt-6 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60 print:hidden">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-400">
                Modo interno
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">Custos, parâmetros e auditoria</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Snapshot preservado na emissão. Esta área não precisa entrar no documento enviado ao cliente.
              </p>
            </div>
            <div className="no-print flex flex-wrap gap-2">
              <form action={duplicarVersaoFinal}>
                <input type="hidden" name="versao_id" value={versao.id} />
                <input type="hidden" name="validade_dias" value={versao.validade_dias ?? 30} />
                <button className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
                  Duplicar versão
                </button>
              </form>
              {versao.status !== "cancelado" && (
                <form action={cancelarVersaoFinal} className="flex gap-2">
                  <input type="hidden" name="versao_id" value={versao.id} />
                  <input type="hidden" name="motivo" value="Cancelamento a partir do detalhe da versão final." />
                  <button className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30">
                    Cancelar
                  </button>
                </form>
              )}
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

function condicoesComerciais(versao: { valido_ate: string | null; validade_dias: number | null }) {
  return `Valores válidos até ${formatDate(versao.valido_ate)}. Alterações de escopo, quantidade de amostras, premissas técnicas ou cronograma podem exigir nova versão da proposta.`;
}

function consolidarComposicaoCliente(
  itens: Array<{ grupo: string; descricao: string; quantidade: number; unidade?: string | null; subtotal: number }>,
) {
  const mapa = new Map<string, { grupo: string; descricao: string; quantidade: number; unidade?: string | null; subtotal: number }>();
  for (const item of itens) {
    const grupo = item.grupo.startsWith("Projeto") ? "Projeto" : item.grupo;
    const chave = `${grupo}-${item.descricao}-${item.unidade ?? ""}`;
    const atual = mapa.get(chave) ?? {
      grupo,
      descricao: item.descricao,
      quantidade: 0,
      unidade: item.unidade,
      subtotal: 0,
    };
    atual.quantidade += Number(item.quantidade ?? 0);
    atual.subtotal += Number(item.subtotal ?? 0);
    mapa.set(chave, atual);
  }
  return [...mapa.values()];
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

function TextoDemanda({ titulo, valor, className = "" }: { titulo: string; valor?: string | null; className?: string }) {
  return (
    <div className={`rounded-md bg-zinc-50 p-3 dark:bg-zinc-950/50 ${className}`}>
      <h3 className="text-xs font-medium text-zinc-500">{titulo}</h3>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-zinc-700 dark:text-zinc-300">{valor || "—"}</p>
    </div>
  );
}

function BlocoDocumento({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">{titulo}</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{children}</p>
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
