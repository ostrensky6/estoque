import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DemandasTable, type DemandaRow } from "@/components/orcamento/DemandasTable";
import { avaliarCompletudeDemanda } from "@/lib/orcamento/demanda-completude";
import {
  modalidadeExigeProjeto,
  normalizarModalidadeOrcamento,
} from "@/lib/orcamento/orcamento-economico";
import { carregarLinhasOrcamentos, type OrcamentoFila } from "@/lib/orcamento/orcamentos-listagem";

export const dynamic = "force-dynamic";

const MODALIDADES: Record<string, string> = {
  analises: "Análises laboratoriais",
  projeto: "Projeto sem análises",
  projeto_com_analises: "Projeto com análises",
  analises_projeto: "Projeto com análises",
  projeto_analises_custos: "Projeto com análises",
};

const STATUS: Record<string, { label: string; cls: string }> = {
  nova: { label: "Nova", cls: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300" },
  em_analise: { label: "Em análise", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" },
  orcada: { label: "Orçada", cls: "bg-brand-100 text-brand-800 dark:bg-brand-950/50 dark:text-brand-300" },
  aprovada: { label: "Aprovada", cls: "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300" },
  recusada: { label: "Recusada", cls: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800" },
  cancelada: { label: "Cancelada", cls: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300" },
};

export default async function DemandasPage({
  searchParams,
}: {
  searchParams?: Promise<{ filtro?: string }>;
}) {
  const filtro = (await searchParams)?.filtro;
  const supabase = await createClient();
  const [{ data: demandas }, { data: projetos }, { data: analisesSolicitadas }, linhasOrcamentos] = await Promise.all([
    supabase
      .from("demandas_propostas")
      .select("id, titulo, cliente_id, cliente_nome, modalidade, status, prioridade, data_solicitacao, prazo_esperado, projeto_id, descricao, escopo_preliminar, matriz_amostra, quantidade_amostras_estimada, prazo_tecnico_dias, criado_em")
      .order("criado_em", { ascending: false }),
    supabase.from("projetos").select("id, nome").order("nome"),
    supabase.from("demanda_analises").select("demanda_id"),
    carregarLinhasOrcamentos(),
  ]);
  const projetoNome = new Map((projetos ?? []).map((p) => [p.id, p.nome]));
  const analisesPorDemanda = new Map<number, number>();
  for (const item of analisesSolicitadas ?? []) {
    const demandaId = Number(item.demanda_id);
    analisesPorDemanda.set(demandaId, (analisesPorDemanda.get(demandaId) ?? 0) + 1);
  }
  const orcamentosPorDemanda = new Map<number, OrcamentoFila[]>();
  for (const linha of linhasOrcamentos) {
    if (!linha.demandaId) continue;
    const atuais = orcamentosPorDemanda.get(linha.demandaId) ?? [];
    atuais.push(linha);
    orcamentosPorDemanda.set(linha.demandaId, atuais);
  }
  const linhasTodas: DemandaRow[] = (demandas ?? []).map((d) => {
    const st = STATUS[d.status] ?? { label: d.status, cls: "" };
    const completude = avaliarCompletudeDemanda({
      ...d,
      analises_solicitadas: analisesPorDemanda.get(Number(d.id)) ?? 0,
    });
    const documentos = orcamentosPorDemanda.get(Number(d.id)) ?? [];
    const estado = estadoFluxoDemanda({
      demandaId: Number(d.id),
      modalidade: d.modalidade,
      projetoId: d.projeto_id,
      completa: completude.completa,
      documentos,
    });
    return {
      id: d.id as number,
      titulo: d.titulo ?? "Demanda sem título",
      cliente: d.cliente_nome ?? "—",
      modalidade: d.modalidade,
      modalidadeLabel: MODALIDADES[normalizarModalidadeOrcamento(d.modalidade)] ?? d.modalidade,
      projeto: d.projeto_id ? projetoNome.get(d.projeto_id) ?? "—" : "—",
      prazo: d.prazo_esperado ?? "—",
      prioridade: d.prioridade ?? "—",
      dataSolicitacao: d.data_solicitacao ?? "—",
      status: d.status,
      statusLabel: st.label,
      completudeLabel: completude.completa ? "Pronta" : `${completude.faltante}% faltante`,
      completa: completude.completa,
      fluxoStatus: estado.fluxoStatus,
      etapaAtual: estado.etapaAtual,
      proximaAcao: estado.proximaAcao,
      proximaHref: estado.proximaHref,
      totalEmAberto: estado.totalEmAberto,
    };
  });
  const linhas = filtro === "em_elaboracao"
    ? linhasTodas.filter((linha) => linha.fluxoStatus !== "Proposta concluída" && linha.fluxoStatus !== "Proposta em revisão")
    : linhasTodas;
  return (
    <div className="min-h-dvh bg-transparent font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-400">
              Entrada comercial
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Orçamentos não finalizados</h1>
            <p className="mt-1 max-w-3xl text-sm text-zinc-500">
              Acesse e complete orçamentos ainda em preenchimento, com custos pendentes, em revisão ou aguardando proposta final.
            </p>
          </div>
          <Link
            href="/orcamento/demandas/nova"
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500"
          >
            + Novo Orçamento
          </Link>
        </div>

        <div className="mt-6">
          <DemandasTable rows={linhas} />
        </div>
      </main>
    </div>
  );
}

function estadoFluxoDemanda({
  demandaId,
  modalidade,
  projetoId,
  completa,
  documentos,
}: {
  demandaId: number;
  modalidade?: string | null;
  projetoId?: number | null;
  completa: boolean;
  documentos: OrcamentoFila[];
}) {
  const exigeProjeto = modalidadeExigeProjeto(modalidade) || Boolean(projetoId);
  const projeto = documentos.find((documento) => documento.origem === "projeto");
  const final = documentos.find((documento) => documento.origem === "final");
  const totalEmAberto = documentos
    .filter((documento) => documento.grupo === "em_elaboracao" || documento.grupo === "revisao")
    .reduce((total, documento) => total + Number(documento.total ?? 0), 0);

  if (final && ["emitido", "aprovado", "vencido"].includes(final.status)) {
    return {
      fluxoStatus: "Proposta concluída",
      etapaAtual: final.etapaAtual ?? "Proposta final",
      proximaAcao: "Abrir proposta",
      proximaHref: final.href,
      totalEmAberto: Number(final.total ?? totalEmAberto),
    };
  }
  if (!completa) {
    return {
      fluxoStatus: "Demanda criada",
      etapaAtual: "Dados da demanda",
      proximaAcao: "Completar demanda",
      proximaHref: `/orcamento/demandas/${demandaId}?etapa=demanda`,
      totalEmAberto,
    };
  }
  if (exigeProjeto && (!projeto || projeto.etapaAtual === "Custos pendentes")) {
    return {
      fluxoStatus: "Orçamento de projeto pendente",
      etapaAtual: projeto?.etapaAtual ?? "Projeto",
      proximaAcao: projeto ? "Continuar projeto" : "Iniciar projeto",
      proximaHref: `/orcamento/demandas/${demandaId}?etapa=projeto`,
      totalEmAberto,
    };
  }
  if (documentos.some((documento) => documento.grupo === "revisao")) {
    return {
      fluxoStatus: "Proposta em revisão",
      etapaAtual: "Revisão",
      proximaAcao: "Revisar proposta",
      proximaHref: `/orcamento/demandas/${demandaId}?etapa=final`,
      totalEmAberto,
    };
  }
  return {
    fluxoStatus: "Proposta final pendente",
    etapaAtual: "Proposta final",
    proximaAcao: "Preparar proposta",
    proximaHref: `/orcamento/demandas/${demandaId}?etapa=final`,
    totalEmAberto,
  };
}
