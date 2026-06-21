import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import {
  emitirOrcamentoFinalDaDemanda,
  gerarOrcamentoAnalisesDaDemanda,
  gerarOrcamentoProjetoDaDemanda,
  salvarDemanda,
} from "@/lib/actions/demandas";
import { avaliarCompletudeDemanda } from "@/lib/orcamento/demanda-completude";
import { avaliarModuloOperacional } from "@/lib/orcamento/modulo-status";
import { consolidarOrcamentoFinal } from "@/lib/orcamento/orcamento-final";
import { formatCurrency as brl, formatDateTime } from "@/lib/formatters";

export const dynamic = "force-dynamic";

const MODALIDADES: Record<string, string> = {
  analises: "Apenas análises laboratoriais",
  projeto: "Apenas projeto",
  analises_projeto: "Análises dentro de projeto",
  projeto_analises_custos: "Projeto com custos próprios e análises laboratoriais",
};

const MODALIDADES_COM_ANALISES = new Set(["analises", "analises_projeto", "projeto_analises_custos"]);
const MODALIDADES_COM_PROJETO = new Set(["projeto", "analises_projeto", "projeto_analises_custos"]);

type OrcamentoAnalisesResumo = {
  id: number;
  status: string;
  data_orcamento: string | null;
  orcamento_itens?: { id: number; n_amostras: number; custo_unitario: number; preco_unitario: number }[] | null;
};

type OrcamentoProjetoResumo = {
  id: number;
  status: string;
  data_orcamento: string | null;
  titulo: string | null;
  projeto_sem_custo_justificativa?: string | null;
  impostos: number | null;
  margem_lucro: number | null;
  impostos_legacy: number | null;
  incubacao: number | null;
  reserva: number | null;
  investimentos: number | null;
  lucro: number | null;
  orcamento_projeto_analises?: { id: number; n_amostras: number; custo_unitario: number; preco_unitario: number }[] | null;
  orcamento_projeto_custos?: {
    id: number;
    rubrica: string | null;
    quantidade: number;
    custo_unitario: number;
    preco_unitario: number;
    meses_selecionados: number[] | null;
  }[] | null;
};

export default async function DemandaDetalhe({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro_emissao?: string }>;
}) {
  const { id } = await params;
  const { erro_emissao: erroEmissao } = await searchParams;
  const demandaId = Number(id);
  const supabase = await createClient();

  const { data: demanda } = await supabase
    .from("demandas_propostas")
    .select("*")
    .eq("id", demandaId)
    .single();
  if (!demanda) notFound();

  const [{ data: clientes }, { data: projetos }, { data: orcamentos }, { data: orcProjetos }, { data: versoesFinais }] =
    await Promise.all([
      supabase.from("clientes").select("id, nome").eq("ativo", true).order("nome"),
      supabase.from("projetos").select("id, nome").order("nome"),
      supabase
        .from("orcamentos")
        .select("id, status, data_orcamento, orcamento_itens(id, n_amostras, custo_unitario, preco_unitario)")
        .eq("demanda_id", demandaId)
        .order("id"),
      supabase
        .from("orcamento_projetos")
        .select("id, status, data_orcamento, titulo, projeto_sem_custo_justificativa, impostos, margem_lucro, impostos_legacy, incubacao, reserva, investimentos, lucro, orcamento_projeto_analises(id, n_amostras, custo_unitario, preco_unitario), orcamento_projeto_custos(id, rubrica, quantidade, custo_unitario, preco_unitario, meses_selecionados)")
        .eq("demanda_id", demandaId)
        .order("id"),
      supabase
        .from("orcamento_final_versoes")
        .select("id, versao, numero, status, total_final, valido_ate, criado_em")
        .eq("demanda_id", demandaId)
        .order("versao", { ascending: false }),
    ]);

  const exigeAnalises = MODALIDADES_COM_ANALISES.has(demanda.modalidade);
  const exigeProjeto = MODALIDADES_COM_PROJETO.has(demanda.modalidade);
  const completudeDemanda = avaliarCompletudeDemanda(demanda);
  const orcamentosAnalises = ((orcamentos ?? []) as OrcamentoAnalisesResumo[]);
  const orcamentosProjeto = ((orcProjetos ?? []) as OrcamentoProjetoResumo[]);
  const itensAnalises = orcamentosAnalises.reduce((total, orcamento) => total + (orcamento.orcamento_itens?.length ?? 0), 0);
  const itensProjeto = orcamentosProjeto.reduce((total, orcamento) => total + (
    (orcamento.orcamento_projeto_custos?.length ?? 0) +
    (orcamento.orcamento_projeto_analises?.length ?? 0) +
    (orcamento.projeto_sem_custo_justificativa ? 1 : 0)
  ), 0);
  const statusAnalises = orcamentosAnalises.some((orcamento) => orcamento.status === "aprovado")
    ? "aprovado"
    : orcamentosAnalises.some((orcamento) => orcamento.status === "enviado")
      ? "enviado"
      : orcamentosAnalises[0]?.status;
  const statusProjeto = orcamentosProjeto.some((orcamento) => orcamento.status === "aprovado")
    ? "aprovado"
    : orcamentosProjeto.some((orcamento) => orcamento.status === "enviado")
      ? "enviado"
      : orcamentosProjeto[0]?.status;
  const moduloAnalises = avaliarModuloOperacional({
    exigido: exigeAnalises,
    quantidadeItens: itensAnalises,
    statusDocumento: statusAnalises,
    pendenciaSemItens: "adicionar ao menos uma análise com custo",
  });
  const moduloProjeto = avaliarModuloOperacional({
    exigido: exigeProjeto,
    quantidadeItens: itensProjeto,
    statusDocumento: statusProjeto,
    pendenciaSemItens: "adicionar ao menos um custo, análise de projeto ou justificativa",
  });
  const projetoReferencia = orcamentosProjeto.at(-1);
  const orcamentoFinal = consolidarOrcamentoFinal({
    laboratorioExigido: exigeAnalises,
    projetoExigido: exigeProjeto,
    laboratorioRevisado: moduloAnalises.status === "revisado" || moduloAnalises.status === "nao_exigido",
    projetoRevisado: moduloProjeto.status === "revisado" || moduloProjeto.status === "nao_exigido",
    itensLaboratorio: orcamentosAnalises.flatMap((orcamento) => orcamento.orcamento_itens ?? []),
    itensProjeto: [
      ...orcamentosProjeto.flatMap((orcamento) => (
        orcamento.orcamento_projeto_custos ?? []
      )),
      ...orcamentosProjeto.flatMap((orcamento) => (
        orcamento.orcamento_projeto_analises ?? []
      )).map((item) => ({
        rubrica: "MC",
        quantidade: Number(item.n_amostras),
        custo_unitario: Number(item.custo_unitario),
        preco_unitario: Number(item.preco_unitario),
        meses_selecionados: [],
      })),
    ],
    parametrosProjeto: {
      impostos_legacy: Number(projetoReferencia?.impostos_legacy ?? projetoReferencia?.impostos ?? 0),
      incubacao: Number(projetoReferencia?.incubacao ?? 0),
      reserva: Number(projetoReferencia?.reserva ?? 0),
      investimentos: Number(projetoReferencia?.investimentos ?? 0),
      lucro: Number(projetoReferencia?.lucro ?? projetoReferencia?.margem_lucro ?? 0),
    },
  });
  const modulosPendentes = [
    moduloAnalises.status === "pendente" ? "preencher custos laboratoriais" : null,
    moduloAnalises.status === "preenchido" ? "revisar custos laboratoriais" : null,
    moduloProjeto.status === "pendente" ? "preencher custos de projeto" : null,
    moduloProjeto.status === "preenchido" ? "revisar custos de projeto" : null,
  ].filter(Boolean) as string[];
  const podeConsolidar = modulosPendentes.length === 0;
  const etapas = [
    etapa("1. Demanda", completudeDemanda.completa, completudeDemanda.pendencias),
    etapaModulo("2. Custos laboratoriais", moduloAnalises),
    etapaModulo("2. Custos de projeto", moduloProjeto),
    etapa("3. Parametros economicos", podeConsolidar, modulosPendentes),
    etapa("4. Orcamento final", orcamentoFinal.pronto, orcamentoFinal.pendencias.length > 0 ? orcamentoFinal.pendencias : ["pronto para emissão formal"]),
  ];

  const inp =
    "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";
  const lbl = "block text-xs font-medium text-zinc-600 dark:text-zinc-300";

  return (
    <div className="min-h-dvh bg-transparent font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Breadcrumbs
          items={[
            { label: "Demandas/Propostas", href: "/orcamento/demandas" },
            { label: demanda.titulo },
          ]}
        />

        <section className="mt-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-400">
                Demanda/Proposta
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">{demanda.titulo}</h1>
              <p className="mt-1 text-sm text-zinc-500">
                {MODALIDADES[demanda.modalidade] ?? demanda.modalidade}
              </p>
            </div>
            <div className="text-right text-sm">
              <p className="font-medium">Nº {demanda.id}</p>
              <p className="text-zinc-500">Status: {demanda.status}</p>
              <p className="text-zinc-500">Prioridade: {demanda.prioridade}</p>
              <p className={completudeDemanda.completa ? "text-brand-700 dark:text-brand-300" : "text-amber-700 dark:text-amber-300"}>
                {completudeDemanda.completa ? "Demanda pronta" : `${completudeDemanda.faltante}% faltante`}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-4">
            <Info titulo="Cliente" texto={demanda.cliente_nome} />
            <Info titulo="Contato" texto={demanda.cliente_contato} />
            <Info titulo="Solicitação" texto={demanda.data_solicitacao} />
            <Info titulo="Prazo esperado" texto={demanda.prazo_esperado} />
            <Info titulo="Matriz/amostra" texto={demanda.matriz_amostra} />
            <Info titulo="Qtd. estimada" texto={demanda.quantidade_amostras_estimada ? String(demanda.quantidade_amostras_estimada) : null} />
            <Info titulo="Prazo técnico" texto={demanda.prazo_tecnico_dias ? `${demanda.prazo_tecnico_dias} dias` : null} />
            <Info titulo="Completude atualizada" texto={formatDateTime(demanda.completude_atualizada_em)} />
          </div>

          <div className="mt-6 grid gap-4 text-sm md:grid-cols-3">
            <Texto titulo="Descrição" texto={demanda.descricao} />
            <Texto titulo="Escopo preliminar" texto={demanda.escopo_preliminar} />
            <Texto titulo="Observações" texto={demanda.observacoes} />
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-semibold">Próximos módulos</h2>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              A modalidade da demanda controla quais módulos podem ser preenchidos.
            </p>
            {!completudeDemanda.completa && (
              <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                Complete a demanda antes de gerar módulos: {completudeDemanda.pendencias.join("; ")}.
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {exigeAnalises && completudeDemanda.completa ? (
                <form action={gerarOrcamentoAnalisesDaDemanda}>
                  <input type="hidden" name="demanda_id" value={demandaId} />
                  <button className="rounded-md bg-brand-600 px-3 py-2 text-xs font-medium text-white hover:bg-brand-500">
                    Custos laboratoriais
                  </button>
                </form>
              ) : exigeAnalises ? (
                <span className="rounded-md border border-amber-200 px-3 py-2 text-xs text-amber-700 dark:border-amber-900 dark:text-amber-300">
                  Complete a demanda
                </span>
              ) : (
                <span className="rounded-md border border-zinc-200 px-3 py-2 text-xs text-zinc-400 dark:border-zinc-800">
                  Laboratório não se aplica
                </span>
              )}
              {exigeProjeto && completudeDemanda.completa ? (
                <form action={gerarOrcamentoProjetoDaDemanda}>
                  <input type="hidden" name="demanda_id" value={demandaId} />
                  <button className="rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
                    Custos de projeto
                  </button>
                </form>
              ) : exigeProjeto ? (
                <span className="rounded-md border border-amber-200 px-3 py-2 text-xs text-amber-700 dark:border-amber-900 dark:text-amber-300">
                  Complete a demanda
                </span>
              ) : (
                <span className="rounded-md border border-zinc-200 px-3 py-2 text-xs text-zinc-400 dark:border-zinc-800">
                  Projeto não se aplica
                </span>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-semibold">Custos vinculados</h2>
            <div className="mt-3 space-y-2 text-sm">
              {orcamentosAnalises.map((o) => (
                <Link key={o.id} href={`/orcamento/${o.id}`} className="block rounded-md bg-zinc-50 px-3 py-2 hover:bg-zinc-100 dark:bg-zinc-950/50 dark:hover:bg-zinc-800">
                  Laboratório #{o.id} · {o.status} · {(o.orcamento_itens?.length ?? 0)} item(ns)
                </Link>
              ))}
              {orcamentosProjeto.map((o) => (
                <Link key={o.id} href={`/orcamento/projetos/${o.id}`} className="block rounded-md bg-zinc-50 px-3 py-2 hover:bg-zinc-100 dark:bg-zinc-950/50 dark:hover:bg-zinc-800">
                  Projeto #{o.id} · {o.status} · {(o.orcamento_projeto_custos?.length ?? 0) + (o.orcamento_projeto_analises?.length ?? 0)} item(ns)
                </Link>
              ))}
              {orcamentosAnalises.length === 0 && orcamentosProjeto.length === 0 && (
                <p className="text-xs text-zinc-400">Nenhum custo gerado a partir desta demanda.</p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-semibold">Fluxo recomendado</h2>
            <ol className="mt-3 space-y-2 text-xs leading-5 text-zinc-500">
              <li>1. Registrar demanda.</li>
              <li>2. Confirmar modalidade e projeto.</li>
              <li>3. Gerar o custo correto.</li>
              <li>4. Planejar demanda e reservar estoque quando aprovado.</li>
            </ol>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <ModuloCard titulo="Custos laboratoriais" modulo={moduloAnalises} itens={itensAnalises} />
          <ModuloCard titulo="Custos de projeto" modulo={moduloProjeto} itens={itensProjeto} />
        </section>

        <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold">Pendências por etapa</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-5">
            {etapas.map((item) => (
              <div key={item.titulo} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold">{item.titulo}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${item.inativa ? "bg-zinc-100 text-zinc-400 dark:bg-zinc-800" : item.faltante === 0 ? "bg-brand-100 text-brand-800 dark:bg-brand-950/50 dark:text-brand-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"}`}>
                    {item.inativa ? "n/a" : `${item.faltante}% faltante`}
                  </span>
                </div>
                <ul className="mt-2 space-y-1 text-xs leading-5 text-zinc-500">
                  {item.pendencias.map((pendencia) => (
                    <li key={pendencia}>{pendencia}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Orçamento final</h2>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Consolidação calculada a partir dos módulos vinculados à demanda.
              </p>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${orcamentoFinal.pronto ? "bg-brand-100 text-brand-800 dark:bg-brand-950/50 dark:text-brand-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"}`}>
              {orcamentoFinal.pronto ? "Pronto para emissão" : "Bloqueado"}
            </span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <ResumoFinal titulo="Custo laboratório" valor={orcamentoFinal.totalLaboratorioCusto} />
            <ResumoFinal titulo="Preço laboratório" valor={orcamentoFinal.totalLaboratorioPreco} />
            <ResumoFinal titulo="Custo projeto" valor={orcamentoFinal.totalProjetoCusto} />
            <ResumoFinal titulo="Total final" valor={orcamentoFinal.totalFinal} destaque />
          </div>

          {orcamentoFinal.pendencias.length > 0 ? (
            <div className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <p className="font-medium">Pendências para emissão:</p>
              <ul className="mt-1 list-disc pl-4">
                {orcamentoFinal.pendencias.map((pendencia) => (
                  <li key={pendencia}>{pendencia}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="mt-4 rounded-md bg-brand-50 px-3 py-2 text-xs leading-5 text-brand-900 dark:bg-brand-950/40 dark:text-brand-200">
              Módulos exigidos revisados. A versão final pode ser emitida e preservada no histórico.
            </div>
          )}

          {erroEmissao && (
            <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {erroEmissao}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <form action={emitirOrcamentoFinalDaDemanda} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="demanda_id" value={demandaId} />
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-zinc-400">Validade (dias)</label>
                <input
                  name="validade_dias"
                  type="number"
                  min="1"
                  step="1"
                  defaultValue="30"
                  className={`${inp} mt-1 w-28`}
                  disabled={!orcamentoFinal.pronto}
                />
              </div>
              <button
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-800"
                disabled={!orcamentoFinal.pronto}
              >
                Emitir versão final
              </button>
            </form>
          </div>

          <div className="mt-5 rounded-md border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
              <p className="text-xs font-semibold">Versões emitidas</p>
              <span className="text-xs text-zinc-400">{versoesFinais?.length ?? 0} versão(ões)</span>
            </div>
            <div className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
              {(versoesFinais ?? []).map((versao) => (
                <div key={versao.id} className="grid gap-2 px-3 py-2 md:grid-cols-5">
                  <Link href={`/orcamento/final/${versao.id}`} className="font-medium text-primary hover:underline">
                    {versao.numero}
                  </Link>
                  <span>v{versao.versao}</span>
                  <span>{versao.status}</span>
                  <span>{versao.valido_ate ?? "sem validade"}</span>
                  <span className="font-semibold tabular-nums md:text-right">{brl(Number(versao.total_final ?? 0))}</span>
                </div>
              ))}
              {(versoesFinais ?? []).length === 0 && (
                <p className="px-3 py-4 text-xs text-zinc-400">Nenhuma versão final emitida.</p>
              )}
            </div>
          </div>

          {exigeProjeto && (
            <div className="mt-4 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
              <p className="text-xs font-semibold">Parâmetros econômicos do projeto</p>
              <div className="mt-2 grid gap-2 text-xs text-zinc-500 md:grid-cols-3">
                {orcamentoFinal.parametrosProjeto.map((parametro) => (
                  <div key={parametro.key} className="flex justify-between gap-3 rounded bg-zinc-50 px-2 py-1.5 dark:bg-zinc-950/50">
                    <span>{parametro.label}</span>
                    <span className="font-medium text-zinc-700 dark:text-zinc-200">
                      {parametro.nominalRate.toLocaleString("pt-BR")}% · {brl(parametro.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold">Dados da demanda</h2>
          <form action={salvarDemanda} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input type="hidden" name="demanda_id" value={demandaId} />
            <div className="sm:col-span-2">
              <label className={lbl}>Título</label>
              <input name="titulo" defaultValue={demanda.titulo ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Cliente cadastrado</label>
              <select name="cliente_id" defaultValue={demanda.cliente_id ?? ""} className={`${inp} mt-1 w-full`}>
                <option value="">— cliente livre —</option>
                {(clientes ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Projeto</label>
              <select name="projeto_id" defaultValue={demanda.projeto_id ?? ""} className={`${inp} mt-1 w-full`}>
                <option value="">—</option>
                {(projetos ?? []).map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Cliente livre</label>
              <input name="cliente_nome" defaultValue={demanda.cliente_nome ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>CNPJ/CPF</label>
              <input name="cliente_cnpj" defaultValue={demanda.cliente_cnpj ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Contato</label>
              <input name="cliente_contato" defaultValue={demanda.cliente_contato ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Instituição</label>
              <input name="instituicao" defaultValue={demanda.instituicao ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Responsável interno</label>
              <input name="responsavel_interno" defaultValue={demanda.responsavel_interno ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Origem</label>
              <input name="origem" defaultValue={demanda.origem ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Data da solicitação</label>
              <input name="data_solicitacao" type="date" defaultValue={demanda.data_solicitacao ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Prazo esperado</label>
              <input name="prazo_esperado" type="date" defaultValue={demanda.prazo_esperado ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Matriz ou tipo de amostra</label>
              <input name="matriz_amostra" defaultValue={demanda.matriz_amostra ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Quantidade estimada de amostras</label>
              <input name="quantidade_amostras_estimada" type="number" min="1" step="1" defaultValue={demanda.quantidade_amostras_estimada ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Prazo técnico estimado (dias)</label>
              <input name="prazo_tecnico_dias" type="number" min="1" step="1" defaultValue={demanda.prazo_tecnico_dias ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Modalidade</label>
              <select name="modalidade" defaultValue={demanda.modalidade ?? "analises"} className={`${inp} mt-1 w-full`}>
                {Object.entries(MODALIDADES).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Status</label>
              <select name="status" defaultValue={demanda.status ?? "nova"} className={`${inp} mt-1 w-full`}>
                <option value="nova">Nova</option>
                <option value="em_analise">Em análise</option>
                <option value="orcada">Orçada</option>
                <option value="aprovada">Aprovada</option>
                <option value="recusada">Recusada</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Prioridade</label>
              <select name="prioridade" defaultValue={demanda.prioridade ?? "normal"} className={`${inp} mt-1 w-full`}>
                <option value="baixa">Baixa</option>
                <option value="normal">Normal</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Descrição da demanda</label>
              <textarea name="descricao" rows={4} defaultValue={demanda.descricao ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Escopo preliminar</label>
              <textarea name="escopo_preliminar" rows={4} defaultValue={demanda.escopo_preliminar ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div className="sm:col-span-2">
              <label className={lbl}>Observações</label>
              <textarea name="observacoes" rows={3} defaultValue={demanda.observacoes ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div className="sm:col-span-2">
              <button className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900">
                Salvar demanda
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}

function Info({ titulo, texto }: { titulo: string; texto: string | null }) {
  return (
    <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950/50">
      <p className="text-xs font-medium text-zinc-500">{titulo}</p>
      <p className="mt-1 text-sm font-medium">{texto || "—"}</p>
    </div>
  );
}

function Texto({ titulo, texto }: { titulo: string; texto: string | null }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{titulo}</h3>
      <p className="mt-1 whitespace-pre-wrap leading-6 text-zinc-700 dark:text-zinc-300">{texto || "—"}</p>
    </div>
  );
}

function ModuloCard({
  titulo,
  modulo,
  itens,
}: {
  titulo: string;
  modulo: ReturnType<typeof avaliarModuloOperacional>;
  itens: number;
}) {
  const cls =
    modulo.status === "revisado"
      ? "bg-brand-100 text-brand-800 dark:bg-brand-950/50 dark:text-brand-300"
      : modulo.status === "preenchido"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
        : modulo.status === "pendente"
          ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
          : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800";

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{titulo}</h2>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>
          {modulo.label}
        </span>
      </div>
      <p className="mt-2 text-xs text-zinc-500">{itens} item(ns) vinculados · {modulo.faltante}% faltante</p>
      <ul className="mt-3 space-y-1 text-xs leading-5 text-zinc-500">
        {modulo.pendencias.map((pendencia) => (
          <li key={pendencia}>{pendencia}</li>
        ))}
      </ul>
    </div>
  );
}

function ResumoFinal({ titulo, valor, destaque = false }: { titulo: string; valor: number; destaque?: boolean }) {
  return (
    <div className={`rounded-md border p-3 ${destaque ? "border-brand-200 bg-brand-50 dark:border-brand-900 dark:bg-brand-950/30" : "border-zinc-200 dark:border-zinc-800"}`}>
      <p className="text-xs font-medium text-zinc-500">{titulo}</p>
      <p className={`mt-1 text-base font-semibold tabular-nums ${destaque ? "text-brand-700 dark:text-brand-300" : ""}`}>
        {brl(valor)}
      </p>
    </div>
  );
}

function etapa(titulo: string, completa: boolean, pendencias: string[], inativa = false) {
  return {
    titulo,
    faltante: inativa || completa ? 0 : 100,
    inativa,
    pendencias: inativa
      ? ["não exigida para esta modalidade"]
      : completa
        ? ["concluída"]
        : pendencias,
  };
}

function etapaModulo(titulo: string, modulo: ReturnType<typeof avaliarModuloOperacional>) {
  return {
    titulo,
    faltante: modulo.faltante,
    inativa: modulo.status === "nao_exigido",
    pendencias: modulo.status === "revisado" ? ["concluída"] : modulo.pendencias,
  };
}
