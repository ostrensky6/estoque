import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ConfirmActionButton } from "@/components/common/ConfirmActionButton";
import { PrintButton } from "@/components/orcamento/PrintButton";
import { ExportProjetoButtons } from "@/components/orcamento/ExportProjetoButtons";
import type { ProjetoExportItem } from "@/lib/project-budget/exporters";
import {
  adicionarAnaliseProjeto,
  adicionarCustoCatalogoProjeto,
  adicionarCustoProjeto,
  criarLinkPublico,
  excluirOrcamentoProjeto,
  removerAnaliseProjeto,
  removerCustoProjeto,
  revogarLinkPublico,
  salvarComoTemplate,
  salvarOrcamentoProjeto,
  salvarViagensProjeto,
} from "@/lib/actions/orcamento-projetos";
import { headers } from "next/headers";
import { normalizarViagemInputs, type ViagemInputs } from "@/lib/project-budget/travel";
import {
  calcularOrcamentoProjetoLegacy,
  itemProjetoTotal,
  RUBRICAS_PROJETO,
} from "@/lib/project-budget/legacy";
import { gerarPlanejamentoDeOrcamentoProjeto } from "@/lib/actions/planejamento";
import { formatCurrency as brl } from "@/lib/formatters";

export const dynamic = "force-dynamic";

const CATEGORIAS: Record<string, string> = {
  mao_obra: "Mão de obra",
  deslocamento: "Deslocamento",
  equipamentos: "Equipamentos",
  terceiros: "Terceiros",
  materiais: "Materiais",
  outros: "Outros",
};

type Analise = {
  id: number;
  codigo_analise: string;
  n_amostras: number;
  custo_unitario: number;
  preco_unitario: number;
};

type Custo = {
  id: number;
  categoria: string;
  rubrica: string | null;
  descricao: string;
  quantidade: number;
  unidade: string | null;
  custo_unitario: number;
  preco_unitario: number;
  meses_selecionados: number[];
  catalogo_item_id: string | null;
};

export default async function OrcamentoProjetoDetalhe({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ novo_link?: string }>;
}) {
  const { id } = await params;
  const { novo_link: novoLink } = await searchParams;
  const orcId = Number(id);
  const supabase = await createClient();

  const { data: orc } = await supabase
    .from("orcamento_projetos")
    .select("*")
    .eq("id", orcId)
    .single();
  if (!orc) notFound();

  const [{ data: analisesItens }, { data: custosItens }, { data: analises }, { data: clientes }, { data: projetos }, { data: catalogo }] =
    await Promise.all([
      supabase
        .from("orcamento_projeto_analises")
        .select("id, codigo_analise, n_amostras, custo_unitario, preco_unitario")
        .eq("orcamento_projeto_id", orcId)
        .order("id"),
      supabase
        .from("orcamento_projeto_custos")
        .select("id, categoria, rubrica, descricao, quantidade, unidade, custo_unitario, preco_unitario, meses_selecionados, catalogo_item_id")
        .eq("orcamento_projeto_id", orcId)
        .order("rubrica")
        .order("categoria")
        .order("id"),
      supabase.from("analises").select("codigo").eq("ativo", true).order("codigo"),
      supabase.from("clientes").select("id, nome").eq("ativo", true).order("nome"),
      supabase.from("projetos").select("id, nome").order("nome"),
      supabase
        .from("orcamento_projeto_catalogo")
        .select("id, rubrica, descricao, unidade, preco_unitario, categoria")
        .eq("ativo", true)
        .order("rubrica")
        .order("descricao"),
    ]);

  const analisesProjeto = (analisesItens ?? []) as Analise[];
  const custosProjeto = (custosItens ?? []) as Custo[];
  // As análises entram no orçamento de projeto pelo CUSTO (sem markup): o
  // gross-up dos Parâmetros Econômicos aplica o markup uma única vez sobre todo
  // o subtotal. Usar o preço do custeio aqui causaria markup duplo.
  const totalLabCusto = analisesProjeto.reduce((a, it) => a + Number(it.custo_unitario) * Number(it.n_amostras), 0);
  const totalExtraPreco = custosProjeto.reduce((a, it) => a + itemProjetoTotal(it), 0);
  const itensLegacy = [
    ...custosProjeto,
    ...analisesProjeto.map((it) => ({
      rubrica: "MC",
      quantidade: Number(it.n_amostras),
      preco_unitario: Number(it.custo_unitario),
      meses_selecionados: [],
    })),
  ];
  const calculoProjeto = calcularOrcamentoProjetoLegacy(itensLegacy, {
    impostos_legacy: Number(orc.impostos_legacy ?? orc.impostos ?? 0),
    incubacao: Number(orc.incubacao ?? 0),
    reserva: Number(orc.reserva ?? 0),
    investimentos: Number(orc.investimentos ?? 0),
    lucro: Number(orc.lucro ?? orc.margem_lucro ?? 0),
  });
  const totalFinal = calculoProjeto.grossTotal;

  // Itens consolidados para export (mesma base mostrada na tela).
  const exportItens: ProjetoExportItem[] = [
    ...custosProjeto.map((it) => ({
      rubrica: it.rubrica ?? "OU",
      categoria: CATEGORIAS[it.categoria] ?? it.categoria,
      descricao: it.descricao,
      unidade: it.unidade,
      quantidade: Number(it.quantidade),
      preco_unitario: Number(it.preco_unitario),
      meses_selecionados: it.meses_selecionados ?? [],
      total: itemProjetoTotal(it),
    })),
    ...analisesProjeto.map((it) => ({
      rubrica: "MC",
      categoria: "Análises laboratoriais",
      descricao: it.codigo_analise,
      unidade: "amostra",
      quantidade: Number(it.n_amostras),
      preco_unitario: Number(it.custo_unitario),
      meses_selecionados: [],
      total: Number(it.custo_unitario) * Number(it.n_amostras),
    })),
  ];
  const exportInfo = {
    numero: orc.numero ?? null,
    titulo: orc.titulo ?? "",
    cliente_nome: orc.cliente_nome ?? null,
    cliente_cnpj: orc.cliente_cnpj ?? null,
    cliente_contato: orc.cliente_contato ?? null,
    coordenador: orc.coordenador ?? null,
    proprietario: orc.proprietario ?? null,
    responsavel: orc.responsavel ?? null,
    data_orcamento: orc.data_orcamento ?? null,
    status: orc.status ?? null,
    project_months: Number(orc.project_months ?? 12),
    escopo: orc.escopo ?? null,
    cronograma: orc.cronograma ?? null,
    observacoes: orc.observacoes ?? null,
  };

  const viagem: ViagemInputs = normalizarViagemInputs(
    (orc.travel_inputs ?? null) as Partial<ViagemInputs> | null,
  );

  const { data: links } = await supabase
    .from("orcamento_projeto_links")
    .select("id, criado_em, expira_em, revogado, aprovado_em, aprovado_por")
    .eq("orcamento_projeto_id", orcId)
    .order("criado_em", { ascending: false });

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  const linkNovoUrl = novoLink ? `${proto}://${host}/aprovar/${novoLink}` : null;

  const inp =
    "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";
  const lbl = "block text-xs font-medium text-zinc-600 dark:text-zinc-300";

  return (
    <div className="min-h-dvh bg-transparent font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="print-area mx-auto max-w-6xl px-6 py-10">
        <div className="no-print flex flex-wrap items-center justify-between gap-3">
          <Link href="/orcamento/projetos" className="text-xs text-zinc-500 hover:underline">
            ← Projetos
          </Link>
          <div className="flex items-center gap-2">
            {orc.status === "aprovado" && analisesProjeto.length > 0 && (
              <form action={gerarPlanejamentoDeOrcamentoProjeto}>
                <input type="hidden" name="orcamento_projeto_id" value={orcId} />
                <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500">
                  Gerar planejamento
                </button>
              </form>
            )}
            <ExportProjetoButtons info={exportInfo} itens={exportItens} calculo={calculoProjeto} />
            <PrintButton />
          </div>
        </div>

        <section className="mt-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60 print:border-0 print:shadow-none">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-400">
                Custos de projeto
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">{orc.titulo}</h1>
              <p className="mt-1 text-sm text-zinc-500">
                Proposta integrada: laboratório, equipe, logística, terceiros e cronograma.
              </p>
            </div>
            <div className="text-right text-sm">
              <p className="font-medium">Nº {orc.id}</p>
              <p className="text-zinc-500">Data: {orc.data_orcamento ?? "—"}</p>
              <p className="text-zinc-500">Status: {orc.status}</p>
            </div>
          </div>

          <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <div className="flex gap-2">
              <dt className="text-zinc-500">Cliente:</dt>
              <dd className="font-medium">{orc.cliente_nome ?? "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-zinc-500">CNPJ:</dt>
              <dd>{orc.cliente_cnpj ?? "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-zinc-500">Contato:</dt>
              <dd>{orc.cliente_contato ?? "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-zinc-500">Responsável:</dt>
              <dd>{orc.responsavel ?? "—"}</dd>
            </div>
          </dl>

          <div className="mt-6 grid gap-3 md:grid-cols-4">
            <Resumo titulo="Laboratório" valor={totalLabCusto} subtitulo="custo das análises (sem markup)" />
            <Resumo titulo="Custos do projeto" valor={totalExtraPreco} subtitulo="rubricas PE, MC, MP, ST, VD e OU" />
            <Resumo titulo="Gross-up" valor={totalFinal - calculoProjeto.subtotal} subtitulo={`${calculoProjeto.markupRate.toLocaleString("pt-BR")}% · fator ${calculoProjeto.grossUpFactor.toFixed(4).replace(".", ",")}x`} />
            <Resumo titulo="Total final" valor={totalFinal} subtitulo={`subtotal base ${brl(calculoProjeto.subtotal)}`} destaque />
          </div>

          {calculoProjeto.validationError && (
            <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {calculoProjeto.validationError}
            </p>
          )}

          <section className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Composição por rubrica
            </h2>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              {calculoProjeto.summaries.map((summary) => (
                <div key={summary.code} className="rounded-md bg-white p-3 text-sm dark:bg-zinc-900">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{summary.code} · {summary.label.replace(` (${summary.code})`, "")}</span>
                    <span className="text-xs text-zinc-400">{summary.count} itens</span>
                  </div>
                  <p className="mt-1 font-medium tabular-nums">{brl(summary.total)}</p>
                  <p className="text-xs text-zinc-500">{summary.finalShare.toFixed(2).replace(".", ",")}% do total final</p>
                </div>
              ))}
            </div>
          </section>

          {(orc.escopo || orc.cronograma || orc.observacoes) && (
            <div className="mt-6 grid gap-4 text-sm md:grid-cols-3">
              <TextoBloco titulo="Escopo" texto={orc.escopo} />
              <TextoBloco titulo="Cronograma" texto={orc.cronograma} />
              <TextoBloco titulo="Observações" texto={orc.observacoes} />
            </div>
          )}

          <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-zinc-500">Custos do laboratório</h2>
          <TabelaAnalises itens={analisesProjeto} orcId={orcId} />

          <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-zinc-500">Custos próprios do projeto</h2>
          <TabelaCustos itens={custosProjeto} orcId={orcId} />
        </section>

        <section className="no-print mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-semibold">Adicionar análise do laboratório</h2>
            <form action={adicionarAnaliseProjeto} className="mt-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="orcamento_projeto_id" value={orcId} />
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-zinc-400">Análise</label>
                <select name="codigo_analise" defaultValue="" className={inp}>
                  <option value="" disabled>Selecione…</option>
                  {(analises ?? []).map((a) => (
                    <option key={a.codigo} value={a.codigo}>{a.codigo}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-zinc-400">Amostras</label>
                <input name="n_amostras" type="number" min="1" step="1" defaultValue="1" className={`${inp} w-28`} />
              </div>
              <button className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500">
                Adicionar
              </button>
            </form>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-semibold">Adicionar custo do projeto</h2>
            <form action={adicionarCustoProjeto} className="mt-3 grid grid-cols-2 gap-2">
              <input type="hidden" name="orcamento_projeto_id" value={orcId} />
              <select name="categoria" defaultValue="mao_obra" className={inp}>
                {Object.entries(CATEGORIAS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <input name="descricao" placeholder="Descrição" className={inp} />
              <select name="rubrica" defaultValue="OU" className={inp}>
                {Object.entries(RUBRICAS_PROJETO).map(([value, label]) => (
                  <option key={value} value={value}>{value} · {label}</option>
                ))}
              </select>
              <input name="unidade" placeholder="unidade" className={inp} />
              <input name="quantidade" type="number" min="0.01" step="0.01" defaultValue="1" className={inp} />
              <input name="custo_unitario" type="number" min="0" step="0.01" placeholder="Custo unit." className={inp} />
              <input name="preco_unitario" type="number" min="0" step="0.01" placeholder="Preço unit." className={inp} />
              <button className="col-span-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500">
                Adicionar custo
              </button>
            </form>
          </div>
        </section>

        <section className="no-print mt-6 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold">Adicionar item do catálogo antigo</h2>
          <form action={adicionarCustoCatalogoProjeto} className="mt-3 grid gap-3 md:grid-cols-[1fr_8rem_auto] md:items-end">
            <input type="hidden" name="orcamento_projeto_id" value={orcId} />
            <div>
              <label className={lbl}>Item de catálogo</label>
              <select name="catalogo_item_id" defaultValue="" className={`${inp} mt-1 w-full`}>
                <option value="" disabled>Selecione...</option>
                {(catalogo ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.rubrica} · {item.descricao} · {brl(Number(item.preco_unitario))}/{item.unidade ?? "un"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Quantidade</label>
              <input name="quantidade" type="number" min="0.01" step="0.01" defaultValue="1" className={`${inp} mt-1 w-full`} />
            </div>
            <button className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500">
              Adicionar
            </button>
            <div className="md:col-span-3">
              <p className="text-xs font-medium text-zinc-500">Meses para itens de Pessoal (PE)</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Array.from({ length: Math.max(1, Number(orc.project_months ?? 12)) }, (_, index) => index + 1).map((mes) => (
                  <label key={mes} className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-xs dark:border-zinc-700">
                    <input type="checkbox" name="meses_selecionados" value={mes} className="h-3.5 w-3.5" />
                    {mes}
                  </label>
                ))}
              </div>
            </div>
          </form>
        </section>

        <section className="no-print mt-6 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold">Salvar como template</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Guarda os parâmetros econômicos, os parâmetros de viagem e as linhas
            de rubrica como modelo reutilizável. As análises de laboratório não
            entram no template.
          </p>
          <form action={salvarComoTemplate} className="mt-3 flex flex-wrap items-end gap-2">
            <input type="hidden" name="orcamento_projeto_id" value={orcId} />
            <div className="flex-1 min-w-48">
              <label className={lbl}>Nome do template</label>
              <input name="nome" placeholder="Ex.: Projeto de campo padrão" className={`${inp} mt-1 w-full`} />
            </div>
            <div className="flex-1 min-w-48">
              <label className={lbl}>Descrição (opcional)</label>
              <input name="descricao" className={`${inp} mt-1 w-full`} />
            </div>
            <button className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500">
              Salvar template
            </button>
          </form>
        </section>

        <section className="no-print mt-6 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold">Aprovação do cliente (link público)</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Gere um link read-only para o cliente revisar e aprovar sem login.
            O link só é exibido uma vez na criação — copie e guarde.
          </p>

          {linkNovoUrl && (
            <div className="mt-3 rounded-md border border-brand-200 bg-brand-50 p-3 text-sm dark:border-brand-900 dark:bg-brand-950/30">
              <p className="text-xs font-medium text-brand-800 dark:text-brand-200">
                Novo link gerado (copie agora):
              </p>
              <code className="mt-1 block break-all rounded bg-white px-2 py-1 text-xs dark:bg-zinc-950">
                {linkNovoUrl}
              </code>
            </div>
          )}

          <form action={criarLinkPublico} className="mt-3">
            <input type="hidden" name="orcamento_projeto_id" value={orcId} />
            <button className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500">
              Gerar link de aprovação
            </button>
          </form>

          {(links ?? []).length > 0 && (
            <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-3 py-2">Criado em</th>
                    <th className="px-3 py-2">Situação</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {(links ?? []).map((l) => {
                    const situacao = l.revogado
                      ? "Revogado"
                      : l.aprovado_em
                        ? `Aprovado${l.aprovado_por ? ` por ${l.aprovado_por}` : ""}`
                        : "Ativo";
                    return (
                      <tr key={l.id}>
                        <td className="px-3 py-2 tabular-nums text-zinc-500">
                          {l.criado_em ? new Date(l.criado_em).toLocaleString("pt-BR") : "—"}
                        </td>
                        <td className="px-3 py-2">{situacao}</td>
                        <td className="px-3 py-2 text-right">
                          {!l.revogado && !l.aprovado_em && (
                            <form action={revogarLinkPublico}>
                              <input type="hidden" name="orcamento_projeto_id" value={orcId} />
                              <input type="hidden" name="link_id" value={l.id} />
                              <button className="text-xs text-red-600 hover:underline">Revogar</button>
                            </form>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="no-print mt-6 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold">Viagens e diárias (rubrica VD)</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Defina os parâmetros da viagem e salve: as linhas de VD são
            recalculadas automaticamente conforme a descrição (diárias,
            hospedagem, combustível, pedágios, passagens, locação de veículo).
            O fator de risco soma dias extras a campo e hospedagem.
          </p>
          <form action={salvarViagensProjeto} className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <input type="hidden" name="orcamento_projeto_id" value={orcId} />
            <div>
              <label className={lbl}>Pessoas</label>
              <input name="pessoas" type="number" min="0" step="1" defaultValue={viagem.pessoas} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Dias de campo</label>
              <input name="dias_campo" type="number" min="0" step="1" defaultValue={viagem.dias_campo} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Fator de risco (dias)</label>
              <input name="fator_risco_dias" type="number" min="0" step="1" defaultValue={viagem.fator_risco_dias} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Diárias de hospedagem</label>
              <input name="diarias_hospedagem" type="number" min="0" step="1" defaultValue={viagem.diarias_hospedagem} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Quartos</label>
              <input name="quartos" type="number" min="0" step="1" defaultValue={viagem.quartos} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Veículos</label>
              <input name="veiculos" type="number" min="0" step="1" defaultValue={viagem.veiculos} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Distância (km)</label>
              <input name="distancia_km" type="number" min="0" step="0.1" defaultValue={viagem.distancia_km} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Consumo (km/L)</label>
              <input name="consumo_km_l" type="number" min="0" step="0.1" defaultValue={viagem.consumo_km_l} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Pedágios</label>
              <input name="pedagios" type="number" min="0" step="1" defaultValue={viagem.pedagios} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Passagens aéreas</label>
              <input name="passagens_aereas" type="number" min="0" step="1" defaultValue={viagem.passagens_aereas} className={`${inp} mt-1 w-full`} />
            </div>
            <div className="col-span-2 sm:col-span-3 lg:col-span-5">
              <button className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500">
                Salvar e recalcular VD
              </button>
            </div>
          </form>
        </section>

        <section className="no-print mt-6 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold">Dados do orçamento de projeto</h2>
          <form action={salvarOrcamentoProjeto} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input type="hidden" name="orcamento_projeto_id" value={orcId} />
            <div>
              <label className={lbl}>Número</label>
              <input name="numero" defaultValue={orc.numero ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Título</label>
              <input name="titulo" defaultValue={orc.titulo ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Status</label>
              <select name="status" defaultValue={orc.status ?? "rascunho"} className={`${inp} mt-1 w-full`}>
                <option value="rascunho">Rascunho</option>
                <option value="enviado">Enviado</option>
                <option value="aprovado">Aprovado</option>
                <option value="recusado">Recusado</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Projeto</label>
              <select name="projeto_id" defaultValue={orc.projeto_id ?? ""} className={`${inp} mt-1 w-full`}>
                <option value="">—</option>
                {(projetos ?? []).map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Cliente cadastrado</label>
              <select name="cliente_id" defaultValue={orc.cliente_id ?? ""} className={`${inp} mt-1 w-full`}>
                <option value="">— (manual)</option>
                {(clientes ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Cliente livre</label>
              <input name="cliente_nome" defaultValue={orc.cliente_nome ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>CNPJ</label>
              <input name="cliente_cnpj" defaultValue={orc.cliente_cnpj ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Contato</label>
              <input name="cliente_contato" defaultValue={orc.cliente_contato ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Telefone</label>
              <input name="cliente_telefone" defaultValue={orc.cliente_telefone ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>E-mail</label>
              <input name="cliente_email" defaultValue={orc.cliente_email ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div className="sm:col-span-2">
              <label className={lbl}>Endereço</label>
              <input name="cliente_endereco" defaultValue={orc.cliente_endereco ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Responsável</label>
              <input name="responsavel" defaultValue={orc.responsavel ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Coordenador</label>
              <input name="coordenador" defaultValue={orc.coordenador ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Proprietário</label>
              <input name="proprietario" defaultValue={orc.proprietario ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Data</label>
              <input name="data_orcamento" type="date" defaultValue={orc.data_orcamento ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Validade (dias)</label>
              <input name="validade_dias" type="number" min="0" step="1" defaultValue={orc.validade_dias ?? 30} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Margem do projeto (%)</label>
              <input name="margem_lucro" type="number" min="0" step="0.01" defaultValue={orc.margem_lucro ?? 0} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Impostos do projeto (%)</label>
              <input name="impostos" type="number" min="0" step="0.01" defaultValue={orc.impostos ?? 0} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Meses do projeto</label>
              <input name="project_months" type="number" min="1" step="1" defaultValue={orc.project_months ?? 12} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Impostos legacy (%)</label>
              <input name="impostos_legacy" type="number" min="0" step="0.01" defaultValue={orc.impostos_legacy ?? 0} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Incubação (%)</label>
              <input name="incubacao" type="number" min="0" step="0.01" defaultValue={orc.incubacao ?? 0} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Reserva (%)</label>
              <input name="reserva" type="number" min="0" step="0.01" defaultValue={orc.reserva ?? 0} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Investimentos (%)</label>
              <input name="investimentos" type="number" min="0" step="0.01" defaultValue={orc.investimentos ?? 0} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Lucro (%)</label>
              <input name="lucro" type="number" min="0" step="0.01" defaultValue={orc.lucro ?? 0} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Escopo</label>
              <textarea name="escopo" rows={4} defaultValue={orc.escopo ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Cronograma</label>
              <textarea name="cronograma" rows={4} defaultValue={orc.cronograma ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div className="sm:col-span-2">
              <label className={lbl}>Detalhes do cliente</label>
              <textarea name="cliente_detalhes" rows={3} defaultValue={orc.cliente_detalhes ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div className="sm:col-span-2">
              <label className={lbl}>Observações</label>
              <textarea name="observacoes" rows={3} defaultValue={orc.observacoes ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div className="sm:col-span-2">
              <button className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900">
                Salvar dados
              </button>
            </div>
          </form>
        </section>

        <div className="no-print mt-6">
          <ConfirmActionButton
            action={excluirOrcamentoProjeto}
            fields={{ orcamento_projeto_id: orcId }}
            trigger="Excluir orçamento de projeto"
            titulo="Excluir orçamento de projeto"
            mensagem={`Excluir o orçamento de projeto “${orc.titulo}”? Esta ação não pode ser desfeita.`}
            confirmLabel="Excluir orçamento de projeto"
          />
        </div>
      </main>
    </div>
  );
}

function Resumo({
  titulo,
  valor,
  subtitulo,
  destaque = false,
}: {
  titulo: string;
  valor: number;
  subtitulo: string;
  destaque?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-4 ${destaque ? "border-brand-200 bg-brand-50 text-brand-950 dark:border-brand-900 dark:bg-brand-950/30 dark:text-brand-100" : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/50"}`}>
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{titulo}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{brl(valor)}</p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{subtitulo}</p>
    </div>
  );
}

function TextoBloco({ titulo, texto }: { titulo: string; texto: string | null }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{titulo}</h3>
      <p className="mt-1 whitespace-pre-wrap leading-6 text-zinc-700 dark:text-zinc-300">{texto || "—"}</p>
    </div>
  );
}

function TabelaAnalises({ itens, orcId }: { itens: Analise[]; orcId: number }) {
  return (
    <div className="mt-2 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-right text-sm">
        <thead className="text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-3 py-2 text-left">Análise</th>
            <th className="px-3 py-2">Custo/amostra</th>
            <th className="px-3 py-2">Amostras</th>
            <th className="px-3 py-2">Subtotal (custo)</th>
            <th className="no-print px-3 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {itens.map((it) => (
            <tr key={it.id}>
              <td className="px-3 py-2 text-left font-medium">{it.codigo_analise}</td>
              <td className="px-3 py-2 tabular-nums">{brl(Number(it.custo_unitario))}</td>
              <td className="px-3 py-2 tabular-nums">{Number(it.n_amostras)}</td>
              <td className="px-3 py-2 font-semibold tabular-nums">{brl(Number(it.custo_unitario) * Number(it.n_amostras))}</td>
              <td className="no-print px-3 py-2">
                <form action={removerAnaliseProjeto}>
                  <input type="hidden" name="orcamento_projeto_id" value={orcId} />
                  <input type="hidden" name="item_id" value={it.id} />
                  <button className="text-xs text-red-600 hover:underline">Remover</button>
                </form>
              </td>
            </tr>
          ))}
          {itens.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-8 text-center text-zinc-400">
                Nenhuma análise vinculada.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function TabelaCustos({ itens, orcId }: { itens: Custo[]; orcId: number }) {
  const quantidadeLabel = (it: Custo) => {
    if (it.rubrica === "PE" && it.meses_selecionados?.length) {
      const totalMeses = it.meses_selecionados.length;
      return `${totalMeses} ${totalMeses === 1 ? "mês" : "meses"}`;
    }
    return `${Number(it.quantidade)} ${it.unidade ?? ""}`.trim();
  };

  return (
    <div className="mt-2 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-right text-sm">
        <thead className="text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-3 py-2 text-left">Categoria</th>
            <th className="px-3 py-2 text-left">Descrição</th>
            <th className="px-3 py-2">Qtd.</th>
            <th className="no-print px-3 py-2">Custo unit.</th>
            <th className="px-3 py-2">Preço unit.</th>
            <th className="px-3 py-2">Subtotal</th>
            <th className="no-print px-3 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {itens.map((it) => (
            <tr key={it.id}>
              <td className="px-3 py-2 text-left">{CATEGORIAS[it.categoria] ?? it.categoria}</td>
              <td className="px-3 py-2 text-left font-medium">{it.descricao}</td>
              <td className="px-3 py-2 tabular-nums">{quantidadeLabel(it)}</td>
              <td className="no-print px-3 py-2 tabular-nums text-zinc-500">{brl(Number(it.custo_unitario))}</td>
              <td className="px-3 py-2 tabular-nums">{brl(Number(it.preco_unitario))}</td>
              <td className="px-3 py-2 font-semibold tabular-nums">{brl(itemProjetoTotal(it))}</td>
              <td className="no-print px-3 py-2">
                <form action={removerCustoProjeto}>
                  <input type="hidden" name="orcamento_projeto_id" value={orcId} />
                  <input type="hidden" name="item_id" value={it.id} />
                  <button className="text-xs text-red-600 hover:underline">Remover</button>
                </form>
              </td>
            </tr>
          ))}
          {itens.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-8 text-center text-zinc-400">
                Nenhum custo próprio do projeto.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
