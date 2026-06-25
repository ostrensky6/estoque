import Link from "next/link";

import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { ConfirmActionButton } from "@/components/common/ConfirmActionButton";
import {
  atualizarOrcamentosFinaisVencidos,
  cancelarVersaoFinal,
  duplicarVersaoFinal,
} from "@/lib/actions/orcamento-historico";
import { formatCurrency as brl, formatDate, formatDateTime } from "@/lib/formatters";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

type SearchParams = {
  texto?: string;
  status?: string;
  cliente?: string;
  responsavel?: string;
  modalidade?: string;
  emitido_de?: string;
  emitido_ate?: string;
  validade_de?: string;
  validade_ate?: string;
  valor_min?: string;
  valor_max?: string;
  comparar?: string;
};

type DemandaHistorico = {
  id: number;
  titulo: string | null;
  cliente_nome: string | null;
  responsavel_interno: string | null;
  modalidade: string | null;
};

type SnapshotParametro = {
  key?: string;
  label?: string;
  nominalRate?: number;
  amount?: number;
};

type SnapshotFinal = {
  demanda?: {
    titulo?: string | null;
    cliente_nome?: string | null;
    responsavel_interno?: string | null;
    modalidade?: string | null;
  };
  consolidado?: {
    totalLaboratorioCusto?: number;
    totalLaboratorioPreco?: number;
    totalProjetoCusto?: number;
    totalProjetoFinal?: number;
    totalFinal?: number;
    markupProjeto?: number;
    parametrosProjeto?: SnapshotParametro[];
    origens?: Array<{ campo?: string; titulo?: string; regra?: string; valor?: number }>;
  };
  orcamentos_analises?: Array<{ id?: number; orcamento_itens?: unknown[] }>;
  orcamentos_projeto?: Array<{ id?: number; orcamento_projeto_custos?: unknown[]; orcamento_projeto_analises?: unknown[] }>;
};

type VersaoFinal = {
  id: number;
  demanda_id: number;
  versao: number;
  numero: string;
  status: string;
  validade_dias: number;
  valido_ate: string | null;
  total_final: number;
  total_laboratorio_custo: number;
  total_laboratorio_preco: number;
  total_projeto_custo: number;
  total_projeto_final: number;
  criado_por: string | null;
  criado_em: string;
  duplicada_de_id: number | null;
  cancelado_em: string | null;
  cancelado_motivo: string | null;
  snapshot: Json;
  demandas_propostas?: DemandaHistorico | null;
};

type VersaoComAnterior = VersaoFinal & { anterior: VersaoFinal | null };

const statusOptions = [
  ["", "Todos"],
  ["emitido", "Emitido"],
  ["enviado", "Enviado ao cliente"],
  ["aprovado", "Aprovado"],
  ["rejeitado", "Rejeitado"],
  ["recusado", "Recusado"],
  ["vencido", "Vencido"],
  ["substituido", "Substituído"],
  ["cancelado", "Cancelado"],
  ["convertido_projeto", "Convertido em projeto"],
] as const;

const atalhosStatus = [
  ["", "Todos"],
  ["emitido", "Emitidos"],
  ["enviado", "Enviados ao cliente"],
  ["aprovado", "Aprovados"],
  ["rejeitado", "Rejeitados"],
  ["cancelado", "Cancelados"],
  ["substituido", "Substituídos"],
  ["convertido_projeto", "Convertidos em projeto"],
] as const;

export default async function HistoricoOrcamentosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await atualizarOrcamentosFinaisVencidos();

  const filtros = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("orcamento_final_versoes")
    .select(
      "id, demanda_id, versao, numero, status, validade_dias, valido_ate, total_final, total_laboratorio_custo, total_laboratorio_preco, total_projeto_custo, total_projeto_final, criado_por, criado_em, duplicada_de_id, cancelado_em, cancelado_motivo, snapshot, demandas_propostas(id, titulo, cliente_nome, responsavel_interno, modalidade)",
    )
    .order("criado_em", { ascending: false });

  const todas = ((data ?? []) as VersaoFinal[]).map((versao) => ({
    ...versao,
    anterior: encontrarAnterior((data ?? []) as VersaoFinal[], versao),
  }));
  const versoes = filtrarVersoes(todas, filtros);
  const comparada = todas.find((item) => item.id === Number(filtros.comparar));
  const exportHref = `/orcamento/historico/export?${new URLSearchParams(limparFiltros(filtros)).toString()}`;

  const emitidos = versoes.filter((item) => ["emitido", "enviado"].includes(item.status)).length;
  const aprovados = versoes.filter((item) => item.status === "aprovado").length;
  const cancelados = versoes.filter((item) => item.status === "cancelado").length;
  const totalHistorico = versoes.reduce((total, item) => total + Number(item.total_final ?? 0), 0);

  return (
    <div className="min-h-dvh bg-transparent font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto max-w-7xl px-6 py-10">
        <Breadcrumbs items={[{ label: "Orçamentos", href: "/orcamento" }, { label: "Histórico de Orçamentos" }]} />

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Histórico de Orçamentos</h1>
            <p className="mt-1 max-w-3xl text-sm text-zinc-500">
              Área de consulta para registros fechados. Versões finais preservam snapshot técnico, parâmetros e valores emitidos.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={exportHref} className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
              Exportar CSV
            </Link>
            <Link href="/orcamento/demandas/nova" className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-500">
              + Novo Orçamento
            </Link>
          </div>
        </div>

        <section className="mt-6 grid gap-3 sm:grid-cols-4">
          <Resumo titulo="Emitidos/enviados" valor={emitidos} />
          <Resumo titulo="Aprovados" valor={aprovados} />
          <Resumo titulo="Cancelados" valor={cancelados} />
          <Resumo titulo="Total filtrado" valor={totalHistorico} moeda />
        </section>

        <nav className="mt-6 flex flex-wrap gap-2" aria-label="Status do histórico">
          {atalhosStatus.map(([value, label]) => (
            <Link
              key={value || "todos"}
              href={value ? `/orcamento/historico?status=${value}` : "/orcamento/historico"}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                (filtros.status ?? "") === value
                  ? "border-brand-600 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-950/30 dark:text-brand-300"
                  : "border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <form className="mt-6 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
            <CampoFiltro label="Texto livre">
              <input name="texto" defaultValue={filtros.texto ?? ""} className={inputCls} placeholder="Número, título ou cliente" />
            </CampoFiltro>
            <CampoFiltro label="Status">
              <select name="status" defaultValue={filtros.status ?? ""} className={inputCls}>
                {statusOptions.map(([value, label]) => (
                  <option key={value || "todos"} value={value}>{label}</option>
                ))}
              </select>
            </CampoFiltro>
            <CampoFiltro label="Cliente">
              <input name="cliente" defaultValue={filtros.cliente ?? ""} className={inputCls} />
            </CampoFiltro>
            <CampoFiltro label="Responsável">
              <input name="responsavel" defaultValue={filtros.responsavel ?? ""} className={inputCls} />
            </CampoFiltro>
            <CampoFiltro label="Modalidade">
              <input name="modalidade" defaultValue={filtros.modalidade ?? ""} className={inputCls} />
            </CampoFiltro>
            <CampoFiltro label="Emitido de">
              <input name="emitido_de" type="date" defaultValue={filtros.emitido_de ?? ""} className={inputCls} />
            </CampoFiltro>
            <CampoFiltro label="Emitido até">
              <input name="emitido_ate" type="date" defaultValue={filtros.emitido_ate ?? ""} className={inputCls} />
            </CampoFiltro>
            <CampoFiltro label="Validade de">
              <input name="validade_de" type="date" defaultValue={filtros.validade_de ?? ""} className={inputCls} />
            </CampoFiltro>
            <CampoFiltro label="Validade até">
              <input name="validade_ate" type="date" defaultValue={filtros.validade_ate ?? ""} className={inputCls} />
            </CampoFiltro>
            <CampoFiltro label="Valor mínimo">
              <input name="valor_min" type="number" step="0.01" defaultValue={filtros.valor_min ?? ""} className={inputCls} />
            </CampoFiltro>
            <CampoFiltro label="Valor máximo">
              <input name="valor_max" type="number" step="0.01" defaultValue={filtros.valor_max ?? ""} className={inputCls} />
            </CampoFiltro>
            <div className="flex items-end gap-2 md:col-span-2">
              <button className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-500">
                Filtrar
              </button>
              <Link href="/orcamento/historico" className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
                Limpar
              </Link>
            </div>
          </div>
        </form>

        {comparada && (
          <ComparacaoLadoALado atual={comparada} anterior={comparada.anterior} />
        )}

        <section className="mt-6 overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full min-w-[1900px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-3 py-3">Número</th>
                <th className="px-3 py-3">Título</th>
                <th className="px-3 py-3">Cliente</th>
                <th className="px-3 py-3">Modalidade</th>
                <th className="px-3 py-3">Responsável</th>
                <th className="px-3 py-3">Criado em</th>
                <th className="px-3 py-3">Emissão/conclusão</th>
                <th className="px-3 py-3">Validade</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-right">Custo análises</th>
                <th className="px-3 py-3 text-right">Custo projeto</th>
                <th className="px-3 py-3 text-right">Subtotal custos</th>
                <th className="px-3 py-3 text-right">Taxas/impostos</th>
                <th className="px-3 py-3 text-right">Margem/lucro</th>
                <th className="px-3 py-3 text-right">Fundos/equip.</th>
                <th className="px-3 py-3 text-right">Preço final</th>
                <th className="px-3 py-3 text-right">Delta</th>
                <th className="px-3 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {versoes.map((item) => {
                const snapshot = normalizarSnapshot(item.snapshot);
                const composicao = composicaoEconomica(item, snapshot);
                return (
                  <tr key={item.id}>
                    <td className="px-3 py-3">
                      <Link href={`/orcamento/final/${item.id}`} className="font-medium text-primary hover:underline">
                        {item.numero}
                      </Link>
                      <p className="text-xs text-zinc-500">v{item.versao}{item.duplicada_de_id ? ` · duplicada de #${item.duplicada_de_id}` : ""}</p>
                    </td>
                    <td className="px-3 py-3">
                      <Link href={`/orcamento/demandas/${item.demanda_id}`} className="font-medium hover:underline">
                        {snapshot.demanda?.titulo ?? item.demandas_propostas?.titulo ?? `Demanda ${item.demanda_id}`}
                      </Link>
                    </td>
                    <td className="px-3 py-3">{snapshot.demanda?.cliente_nome ?? item.demandas_propostas?.cliente_nome ?? "Cliente não informado"}</td>
                    <td className="px-3 py-3"><Badge>{modalidadeLabel(snapshot.demanda?.modalidade ?? item.demandas_propostas?.modalidade)}</Badge></td>
                    <td className="px-3 py-3">
                      <p>{snapshot.demanda?.responsavel_interno ?? item.demandas_propostas?.responsavel_interno ?? item.criado_por ?? "—"}</p>
                      <p className="text-xs text-zinc-500">{item.criado_por ? `usuário ${item.criado_por}` : "sem usuário registrado"}</p>
                    </td>
                    <td className="px-3 py-3">{formatDateTime(item.criado_em)}</td>
                    <td className="px-3 py-3">{formatDateTime(item.criado_em)}</td>
                    <td className="px-3 py-3">
                      <p>{formatDate(item.valido_ate)}</p>
                      <p className="text-xs text-zinc-500">{item.validade_dias} dias</p>
                    </td>
                    <td className="px-3 py-3">
                      <Status status={item.status} />
                      {item.cancelado_motivo && <p className="mt-1 max-w-40 text-xs text-zinc-500">{item.cancelado_motivo}</p>}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{brl(composicao.custoAnalises)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{brl(composicao.custoProjeto)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{brl(composicao.subtotalCustos)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{brl(composicao.taxasImpostos)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{brl(composicao.margemLucro)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{brl(composicao.fundosInvestimentos)}</td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">{brl(Number(item.total_final ?? 0))}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {item.anterior ? (
                        <Comparacao atual={Number(item.total_final ?? 0)} anterior={Number(item.anterior.total_final ?? 0)} />
                      ) : (
                        <span className="text-zinc-400">primeira versão</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/orcamento/final/${item.id}`} className="text-xs text-brand-700 hover:underline dark:text-brand-300">
                          Detalhes/PDF
                        </Link>
                        <Link href={`/orcamento/historico?${new URLSearchParams({ ...limparFiltros(filtros), comparar: String(item.id) }).toString()}`} className="text-xs text-brand-700 hover:underline dark:text-brand-300">
                          Comparar
                        </Link>
                        <form action={duplicarVersaoFinal}>
                          <input type="hidden" name="versao_id" value={item.id} />
                          <input type="hidden" name="validade_dias" value={item.validade_dias || 30} />
                          <button className="text-xs text-brand-700 hover:underline dark:text-brand-300">Duplicar</button>
                        </form>
                        {!["cancelado", "substituido"].includes(item.status) && (
                          <ConfirmActionButton
                            action={cancelarVersaoFinal}
                            fields={{ versao_id: item.id, motivo: "Cancelamento operacional pelo histórico." }}
                            trigger="Cancelar"
                            titulo="Cancelar versão final"
                            mensagem={`Cancelar a versão ${item.numero}? O snapshot continuará preservado no histórico.`}
                            confirmLabel="Cancelar versão"
                            triggerClassName="text-xs text-red-600 hover:underline"
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {versoes.length === 0 && (
                <tr>
                  <td colSpan={18} className="px-3 py-10 text-center text-zinc-400">
                    Nenhuma versão final encontrada para os filtros atuais.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}

const inputCls =
  "mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";

function filtrarVersoes(versoes: VersaoComAnterior[], filtros: SearchParams) {
  const texto = (valor: string | null | undefined) => (valor ?? "").toLocaleLowerCase("pt-BR");
  const inclui = (valor: string | null | undefined, filtro: string | undefined) =>
    !filtro || texto(valor).includes(texto(filtro));
  const dataMin = (valor: string, min?: string) => !min || valor.slice(0, 10) >= min;
  const dataMax = (valor: string, max?: string) => !max || valor.slice(0, 10) <= max;
  const numeroMin = (valor: number, min?: string) => !min || valor >= Number(min);
  const numeroMax = (valor: number, max?: string) => !max || valor <= Number(max);

  return versoes.filter((item) => {
    const demanda = item.demandas_propostas;
    const snapshot = normalizarSnapshot(item.snapshot);
    const buscaLivre = [
      item.numero,
      demanda?.titulo,
      demanda?.cliente_nome,
      demanda?.responsavel_interno,
      demanda?.modalidade,
      snapshot.demanda?.titulo,
      snapshot.demanda?.cliente_nome,
      snapshot.demanda?.responsavel_interno,
      snapshot.demanda?.modalidade,
      item.status,
    ].join(" ");
    return (
      inclui(buscaLivre, filtros.texto) &&
      (!filtros.status || item.status === filtros.status) &&
      inclui(snapshot.demanda?.cliente_nome ?? demanda?.cliente_nome, filtros.cliente) &&
      inclui(snapshot.demanda?.responsavel_interno ?? demanda?.responsavel_interno ?? item.criado_por, filtros.responsavel) &&
      inclui(snapshot.demanda?.modalidade ?? demanda?.modalidade, filtros.modalidade) &&
      dataMin(item.criado_em, filtros.emitido_de) &&
      dataMax(item.criado_em, filtros.emitido_ate) &&
      (!item.valido_ate || dataMin(item.valido_ate, filtros.validade_de)) &&
      (!item.valido_ate || dataMax(item.valido_ate, filtros.validade_ate)) &&
      numeroMin(Number(item.total_final ?? 0), filtros.valor_min) &&
      numeroMax(Number(item.total_final ?? 0), filtros.valor_max)
    );
  });
}

function encontrarAnterior(versoes: VersaoFinal[], atual: VersaoFinal) {
  return versoes
    .filter((item) => item.demanda_id === atual.demanda_id && item.versao < atual.versao)
    .sort((a, b) => b.versao - a.versao)[0] ?? null;
}

function normalizarSnapshot(snapshot: Json): SnapshotFinal {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return {};
  return snapshot as SnapshotFinal;
}

function resumoParametros(snapshot: SnapshotFinal) {
  const markup = Number(snapshot.consolidado?.markupProjeto ?? 0);
  const params = snapshot.consolidado?.parametrosProjeto ?? [];
  if (params.length === 0 && markup === 0) return "sem parâmetros no snapshot";
  const nomes = params.slice(0, 3).map((item) => `${item.label ?? item.key}: ${Number(item.nominalRate ?? 0).toLocaleString("pt-BR")}%`);
  return [`markup ${markup.toLocaleString("pt-BR")}%`, ...nomes].join(" · ");
}

function composicaoEconomica(item: VersaoFinal, snapshot: SnapshotFinal) {
  const custoAnalises = Number(snapshot.consolidado?.totalLaboratorioCusto ?? item.total_laboratorio_custo ?? 0);
  const custoProjeto = Number(snapshot.consolidado?.totalProjetoCusto ?? item.total_projeto_custo ?? 0);
  const subtotalCustos = custoAnalises + custoProjeto;
  const parametros = snapshot.consolidado?.parametrosProjeto ?? [];
  const totalParametros = (predicado: (parametro: SnapshotParametro) => boolean) =>
    parametros
      .filter(predicado)
      .reduce((total, parametro) => total + Number(parametro.amount ?? 0), 0);
  const taxasImpostos = totalParametros((parametro) => {
    const chave = `${parametro.key ?? ""} ${parametro.label ?? ""}`.toLocaleLowerCase("pt-BR");
    return ["taxa", "imposto", "incubacao", "admin", "administr"].some((token) => chave.includes(token));
  });
  const margemLucro =
    totalParametros((parametro) => {
      const chave = `${parametro.key ?? ""} ${parametro.label ?? ""}`.toLocaleLowerCase("pt-BR");
      return ["margem", "lucro", "markup"].some((token) => chave.includes(token));
    }) || Math.max(0, Number(item.total_final ?? 0) - subtotalCustos - taxasImpostos);
  const fundosInvestimentos = totalParametros((parametro) => {
    const chave = `${parametro.key ?? ""} ${parametro.label ?? ""}`.toLocaleLowerCase("pt-BR");
    return ["fundo", "invest", "equip"].some((token) => chave.includes(token));
  });

  return {
    custoAnalises,
    custoProjeto,
    subtotalCustos,
    taxasImpostos,
    margemLucro,
    fundosInvestimentos,
  };
}

function modalidadeLabel(modalidade: string | null | undefined) {
  const labels: Record<string, string> = {
    analises: "Apenas análises laboratoriais",
    projeto: "Apenas projeto",
    analises_projeto: "Projeto com análises laboratoriais",
    projeto_analises_custos: "Projeto com análises laboratoriais",
  };
  return modalidade ? labels[modalidade] ?? modalidade : "—";
}

function limparFiltros(filtros: SearchParams) {
  return Object.fromEntries(
    Object.entries(filtros).filter(([, value]) => value !== undefined && value !== ""),
  ) as Record<string, string>;
}

function CampoFiltro({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-zinc-500">
      {label}
      {children}
    </label>
  );
}

function Resumo({ titulo, valor, moeda = false }: { titulo: string; valor: number; moeda?: boolean }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-medium text-zinc-500">{titulo}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{moeda ? brl(valor) : valor.toLocaleString("pt-BR")}</p>
    </div>
  );
}

function Comparacao({ atual, anterior }: { atual: number; anterior: number }) {
  const diferenca = atual - anterior;
  const percentual = anterior !== 0 ? (diferenca / anterior) * 100 : 0;
  const classe = diferenca > 0 ? "text-amber-700 dark:text-amber-300" : diferenca < 0 ? "text-brand-700 dark:text-brand-300" : "text-zinc-500";
  return (
    <div className={classe}>
      <p>{diferenca >= 0 ? "+" : ""}{brl(diferenca)}</p>
      <p className="text-xs">{percentual >= 0 ? "+" : ""}{percentual.toFixed(2).replace(".", ",")}%</p>
    </div>
  );
}

function ComparacaoLadoALado({ atual, anterior }: { atual: VersaoComAnterior; anterior: VersaoFinal | null }) {
  const snapAtual = normalizarSnapshot(atual.snapshot);
  const snapAnterior = anterior ? normalizarSnapshot(anterior.snapshot) : null;
  return (
    <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Comparação lado a lado</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {atual.numero} contra {anterior ? anterior.numero : "primeira versão da demanda"}.
          </p>
        </div>
        <Link href="/orcamento/historico" className="text-sm text-zinc-500 hover:underline">Fechar comparação</Link>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <PainelComparado titulo="Versão selecionada" versao={atual} snapshot={snapAtual} />
        {anterior ? (
          <PainelComparado titulo="Versão anterior" versao={anterior} snapshot={snapAnterior ?? {}} />
        ) : (
          <div className="rounded-lg border border-zinc-200 p-4 text-sm text-zinc-500 dark:border-zinc-800">
            Esta demanda não tem versão anterior para comparação.
          </div>
        )}
      </div>
      {anterior && (
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <Delta titulo="Laboratório" atual={atual.total_laboratorio_preco} anterior={anterior.total_laboratorio_preco} />
          <Delta titulo="Projeto" atual={atual.total_projeto_final} anterior={anterior.total_projeto_final} />
          <Delta titulo="Total" atual={atual.total_final} anterior={anterior.total_final} />
          <Delta titulo="Markup" atual={Number(snapAtual.consolidado?.markupProjeto ?? 0)} anterior={Number(snapAnterior?.consolidado?.markupProjeto ?? 0)} percentual />
        </div>
      )}
    </section>
  );
}

function PainelComparado({ titulo, versao, snapshot }: { titulo: string; versao: VersaoFinal; snapshot: SnapshotFinal }) {
  const analises = snapshot.orcamentos_analises?.reduce((total, item) => total + (item.orcamento_itens?.length ?? 0), 0) ?? 0;
  const custosProjeto = snapshot.orcamentos_projeto?.reduce(
    (total, item) => total + (item.orcamento_projeto_custos?.length ?? 0) + (item.orcamento_projeto_analises?.length ?? 0),
    0,
  ) ?? 0;
  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h3 className="text-sm font-semibold">{titulo}</h3>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <Info label="Número" value={`${versao.numero} · v${versao.versao}`} />
        <Info label="Status" value={versao.status} />
        <Info label="Criado em" value={formatDateTime(versao.criado_em)} />
        <Info label="Validade" value={formatDate(versao.valido_ate)} />
        <Info label="Itens laboratório" value={String(analises)} />
        <Info label="Itens projeto" value={String(custosProjeto)} />
        <Info label="Parâmetros" value={resumoParametros(snapshot)} wide />
        <Info label="Total" value={brl(Number(versao.total_final ?? 0))} wide />
      </dl>
    </div>
  );
}

function Delta({ titulo, atual, anterior, percentual = false }: { titulo: string; atual: number; anterior: number; percentual?: boolean }) {
  const delta = Number(atual ?? 0) - Number(anterior ?? 0);
  return (
    <div className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-950/50">
      <p className="text-xs font-medium text-zinc-500">{titulo}</p>
      <p className="mt-1 font-semibold tabular-nums">{percentual ? `${delta.toLocaleString("pt-BR")}%` : brl(delta)}</p>
    </div>
  );
}

function Info({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`rounded-md bg-zinc-50 p-2 dark:bg-zinc-950/50 ${wide ? "sm:col-span-2" : ""}`}>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{children}</span>;
}

function Status({ status }: { status: string }) {
  const labels: Record<string, string> = {
    emitido: "Emitido",
    enviado: "Enviado ao cliente",
    aprovado: "Aprovado",
    rejeitado: "Rejeitado",
    recusado: "Recusado",
    substituido: "Substituído",
    cancelado: "Cancelado",
    vencido: "Vencido",
    convertido_projeto: "Convertido em projeto",
  };
  const cls =
    ["emitido", "enviado"].includes(status)
      ? "bg-brand-100 text-brand-800 dark:bg-brand-950/50 dark:text-brand-300"
      : status === "aprovado" || status === "convertido_projeto"
        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
      : status === "vencido"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
        : ["cancelado", "rejeitado", "recusado"].includes(status)
          ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{labels[status] ?? status}</span>;
}
