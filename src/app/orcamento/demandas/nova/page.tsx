import Link from "next/link";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import {
  DemandaForm,
  type AnaliseCatalogoDemanda,
  type GrupoAmostraDemanda,
} from "@/components/orcamento/DemandaForm";
import { calcularTodas } from "@/lib/costing/loader";
import { createClient } from "@/lib/supabase/server";
import { calcularPrevisaoOperacionalDemanda } from "@/lib/orcamento/previsao-operacional";

export const dynamic = "force-dynamic";

export default async function NovaDemandaPage() {
  const supabase = await createClient();
  const [
    { data: clientes },
    { data: projetos },
    { data: analisesCatalogo },
    { data: etapasAnalises },
    { data: insumosAnalises },
    { data: saldoEstoque },
    { breakdowns },
  ] = await Promise.all([
    supabase.from("clientes").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("projetos").select("id, nome").order("nome"),
    supabase
      .from("analises")
      .select("codigo, nome, nome_simplificado, descricao, status, ativo")
      .eq("ativo", true)
      .order("codigo"),
    supabase
      .from("etapas")
      .select("codigo_analise, nome_etapa, nome_atividade, execucoes_por_dia, amostras_por_execucao"),
    (supabase as never as { from: (table: string) => { select: (columns: string) => Promise<{ data: Array<{
      codigo_analise: string;
      especificacao_insumo: string | null;
      unidade: string | null;
      quantidade_por_amostra: number | null;
      modo_cobranca: string | null;
      status_vinculo_insumo: string | null;
      insumo_id: number | null;
      insumos: { custo_unitario?: number | null } | null;
    }> | null }> } })
      .from("insumo_analise")
      .select("codigo_analise, especificacao_insumo, unidade, quantidade_por_amostra, modo_cobranca, status_vinculo_insumo, insumo_id, insumos(custo_unitario)"),
    (supabase as never as { from: (table: string) => { select: (columns: string) => Promise<{ data: Array<{ insumo_id: number; disponivel?: number | null }> | null }> } })
      .from("v_estoque_saldo")
      .select("insumo_id, disponivel"),
    calcularTodas(),
  ]);

  const quantidadeBase = 1;
  const analisesFormulario: AnaliseCatalogoDemanda[] = (analisesCatalogo ?? []).map((analise) => {
    const etapasDaAnalise = (etapasAnalises ?? []).filter((etapa) => etapa.codigo_analise === analise.codigo);
    const capacidades = etapasDaAnalise
      .map((etapa) => Number(etapa.execucoes_por_dia ?? 0) * Number(etapa.amostras_por_execucao ?? 0))
      .filter((capacidade) => capacidade > 0);
    const metodo = etapasDaAnalise[0]?.nome_etapa ?? etapasDaAnalise[0]?.nome_atividade ?? null;
    const unidade = (insumosAnalises ?? []).find((item) => item.codigo_analise === analise.codigo)?.unidade ?? "amostra";
    const previsaoBase = calcularPrevisaoOperacionalDemanda({
      analises: [{ codigo_analise: analise.codigo, quantidade_amostras: quantidadeBase }],
      etapas: etapasAnalises ?? [],
      insumos: insumosAnalises ?? [],
    })[0];
    return {
      codigo: analise.codigo,
      nome: analise.nome,
      nome_simplificado: analise.nome_simplificado,
      descricao: analise.descricao,
      status: analise.status ?? "Ativa",
      metodo,
      unidade,
      prazo_tecnico_dias: capacidades.length > 0 ? Math.max(1, Math.ceil(quantidadeBase / Math.min(...capacidades))) : null,
      matriz: null,
      custeio_disponivel: breakdowns.some((breakdown) => breakdown.codigo === analise.codigo && Number(breakdown.custoTotal) > 0),
      lote_padrao: previsaoBase?.lote_padrao ?? null,
      capacidade_dia: previsaoBase?.capacidade_dia ?? null,
      reagentes: (insumosAnalises ?? [])
        .filter((item) => item.codigo_analise === analise.codigo)
        .map((item) => {
          const saldo = (saldoEstoque ?? []).find((saldoItem) => Number(saldoItem.insumo_id) === Number(item.insumo_id));
          const disponivel = Number(saldo?.disponivel ?? 0);
          const custoUnitario = Number((item.insumos as { custo_unitario?: number | null } | null)?.custo_unitario ?? 0);
          return {
            especificacao: item.especificacao_insumo ?? "Insumo sem especificação",
            unidade: item.unidade ?? "un",
            quantidade_por_amostra: Number(item.quantidade_por_amostra ?? 0),
            custo_unitario: Number.isFinite(custoUnitario) ? custoUnitario : null,
            status_vinculo_insumo: item.status_vinculo_insumo,
            estoque_status: item.insumo_id == null ? "insumo não encontrado" : disponivel > 0 ? "suficiente" : "sem cadastro de saldo",
            modo_cobranca: item.modo_cobranca === "por_execucao" ? "por_execucao" as const : "por_amostra" as const,
          };
        })
        .filter((item) => item.quantidade_por_amostra > 0),
    };
  });

  const demandaNova = {
    id: 0,
    titulo: null,
    cliente_id: null,
    projeto_id: null,
    cliente_nome: null,
    cliente_cnpj: null,
    cliente_contato: null,
    instituicao: null,
    responsavel_interno: null,
    origem: null,
    data_solicitacao: null,
    prazo_esperado: null,
    matriz_amostra: null,
    quantidade_amostras_estimada: 1,
    prazo_tecnico_dias: null,
    modalidade: "analises",
    status: "nova",
    prioridade: "normal",
    descricao: null,
    escopo_preliminar: null,
    observacoes: null,
  };

  const gruposAmostras: GrupoAmostraDemanda[] = [{
    identificacao: "Grupo A",
    tipo_matriz: null,
    quantidade_amostras: 1,
    unidade: "amostras",
    observacao: null,
  }];

  return (
    <div className="min-h-dvh bg-transparent font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Breadcrumbs
              items={[
                { label: "Orçamentos não finalizados", href: "/orcamento/demandas" },
                { label: "Novo Orçamento" },
              ]}
            />
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-400">
              Entrada comercial
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Novo Orçamento</h1>
            <p className="mt-1 max-w-3xl text-sm text-zinc-500">
              Preencha o orçamento inteiro uma única vez. Estes dados seguem para laboratório, projeto e proposta final.
            </p>
          </div>
          <Link
            href="/orcamento/demandas"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Voltar à lista
          </Link>
        </div>

        <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <DemandaForm
            demanda={demandaNova}
            clientes={(clientes ?? []) as { id: number; nome: string }[]}
            projetos={(projetos ?? []) as { id: number; nome: string }[]}
            analises={analisesFormulario}
            gruposAmostras={gruposAmostras}
            analisesSelecionadas={[]}
            modo="completo"
          />
        </section>
      </main>
    </div>
  );
}
