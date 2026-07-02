import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { gargalo, horasBancadaPorAmostra, type Etapa } from "@/lib/costing/engine";
import { calcularTodas } from "@/lib/costing/loader";
import { formatCurrency, formatNumber } from "@/lib/formatters";

export const dynamic = "force-dynamic";

type AnaliseCatalogo = {
  codigo: string;
  nome: string | null;
  nome_simplificado: string | null;
  descricao: string | null;
  status: string | null;
  ativo: boolean;
  ofertavel: boolean;
};

type DiagnosticoAnalise = {
  analise: AnaliseCatalogo;
  nEtapas: number;
  nInsumos: number;
  nEquipamentos: number;
  tempoBancada: number;
  amostrasDia: number;
  preco: number | null;
  avisos: string[];
};

const card =
  "rounded-lg border border-border bg-card p-4 shadow-sm";
const subtle = "text-sm text-muted-foreground";

function statusTextualIndicaRevisao(status: string | null) {
  return /experimental|experimento|revis|avali|pend|todo/i.test(status ?? "");
}

function grupoDaAnalise(analise: AnaliseCatalogo) {
  if (!analise.ativo) return "inativas";
  if (statusTextualIndicaRevisao(analise.status)) return "revisao";
  return analise.ofertavel ? "ofertaveis" : "ativas_nao_ofertaveis";
}

function rotuloPrincipal(analise: AnaliseCatalogo) {
  return analise.nome_simplificado || analise.nome || analise.codigo;
}

function badgeAtivo(ativo: boolean) {
  return ativo
    ? "bg-success-soft text-success-strong ring-success-strong/30"
    : "bg-muted text-muted-foreground ring-border";
}

export default async function AnalisesPage() {
  const supabase = await createClient();
  const [{ data: analises }, { data: etapas }, { data: insumosAnalise }, { data: equipamentosAnalise }] =
    await Promise.all([
      supabase
        .from("analises")
        .select("codigo, nome, nome_simplificado, descricao, status, ativo, ofertavel")
        .order("codigo"),
      supabase.from("etapas").select("*"),
      supabase
        .from("insumo_analise")
        .select("codigo_analise, insumo_id, quantidade_por_amostra, especificacao_insumo"),
      supabase.from("equipamento_analise").select("codigo_analise, equipamento_id"),
    ]);

  let custos = new Map<string, number>();
  try {
    const { breakdowns } = await calcularTodas();
    custos = new Map(breakdowns.map((b) => [b.codigo, b.preco]));
  } catch {
    custos = new Map();
  }

  const diagnosticos: DiagnosticoAnalise[] = ((analises ?? []) as AnaliseCatalogo[]).map((analise) => {
    const etapasDaAnalise = ((etapas ?? []) as Etapa[]).filter(
      (etapa) => (etapa as unknown as { codigo_analise: string }).codigo_analise === analise.codigo,
    );
    const insumosDaAnalise = (insumosAnalise ?? []).filter((linha) => linha.codigo_analise === analise.codigo);
    const equipamentosDaAnalise = (equipamentosAnalise ?? []).filter((linha) => linha.codigo_analise === analise.codigo);
    const g = gargalo(etapasDaAnalise);
    const avisos: string[] = [];

    if (etapasDaAnalise.length === 0) avisos.push("sem etapas");
    if (insumosDaAnalise.length === 0) avisos.push("sem materiais/insumos");
    if (equipamentosDaAnalise.length === 0) avisos.push("sem equipamentos");
    if (insumosDaAnalise.some((linha) => Number(linha.quantidade_por_amostra ?? 0) > 0 && !linha.insumo_id)) {
      avisos.push("material consumido sem vínculo com insumo de estoque");
    }
    if (analise.ativo && statusTextualIndicaRevisao(analise.status)) {
      avisos.push("ativa com status textual de revisão");
    }
    if (analise.ativo && !analise.ofertavel) avisos.push("ativa, mas fora da oferta comercial");
    if (analise.ativo && (custos.get(analise.codigo) ?? 0) <= 0) avisos.push("sem preço calculado");

    return {
      analise,
      nEtapas: etapasDaAnalise.length,
      nInsumos: insumosDaAnalise.length,
      nEquipamentos: equipamentosDaAnalise.length,
      tempoBancada: horasBancadaPorAmostra(etapasDaAnalise),
      amostrasDia: g.amostrasDia,
      preco: custos.get(analise.codigo) ?? null,
      avisos,
    };
  });

  const totalOfertaveis = diagnosticos.filter((item) => item.analise.ativo && item.analise.ofertavel);
  const ofertaveisSemRessalva = diagnosticos.filter((item) => grupoDaAnalise(item.analise) === "ofertaveis");
  const ofertaveisEmRevisao = diagnosticos.filter(
    (item) => item.analise.ativo && item.analise.ofertavel && statusTextualIndicaRevisao(item.analise.status),
  );

  const grupos = [
    {
      id: "ofertaveis",
      titulo: "Ofertaveis sem ressalva",
      descricao: "Analises com ativo=true e ofertavel=true, sem marcador textual de revisao.",
      itens: ofertaveisSemRessalva,
    },
    {
      id: "ativas_nao_ofertaveis",
      titulo: "Ativas, mas nao ofertaveis",
      descricao: "Cadastros operacionais ativos que nao devem entrar em novos orcamentos.",
      itens: diagnosticos.filter((item) => grupoDaAnalise(item.analise) === "ativas_nao_ofertaveis"),
    },
    {
      id: "revisao",
      titulo: "Experimentais ou em revisao",
      descricao: "Agrupamento visual por status textual; o card mostra se ainda esta ofertavel.",
      itens: diagnosticos.filter((item) => grupoDaAnalise(item.analise) === "revisao"),
    },
    {
      id: "inativas",
      titulo: "Inativas ou fora da oferta",
      descricao: "Analises com ativo=false, ainda visiveis para administracao e historico.",
      itens: diagnosticos.filter((item) => grupoDaAnalise(item.analise) === "inativas"),
    },
  ];

  return (
    <div className="min-h-dvh bg-transparent font-sans text-foreground">
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-semibold tracking-tight">Analises</h1>
          <p className={`mt-2 ${subtle}`}>
            Ficha tecnica operacional em modo somente leitura. Esta etapa reorganiza a visao do cadastro atual
            sem criar tabelas, aplicar migrations ou alterar regras de orcamento, estoque e compras.
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-5">
          <Stat label="Ofertaveis totais" value={String(totalOfertaveis.length)} />
          <Stat label="Ofertaveis sem ressalva" value={String(ofertaveisSemRessalva.length)} />
          <Stat label="Ofertaveis em revisao" value={String(ofertaveisEmRevisao.length)} />
          <Stat label="Ativas nao ofertaveis" value={String(grupos[1].itens.length)} />
          <Stat label="Inativas" value={String(grupos[3].itens.length)} />
        </div>

        <div className="mt-8 space-y-8">
          {grupos.map((grupo) => (
            <section key={grupo.id}>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {grupo.titulo}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">{grupo.descricao}</p>
                </div>
                <span className="text-xs font-medium text-muted-foreground">{grupo.itens.length} analises</span>
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {grupo.itens.map((item) => (
                  <AnaliseCard key={item.analise.codigo} item={item} />
                ))}
                {grupo.itens.length === 0 && (
                  <div className="rounded-lg border border-dashed border-input p-6 text-sm text-muted-foreground">
                    Nenhuma analise neste grupo.
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={card}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function AnaliseCard({ item }: { item: DiagnosticoAnalise }) {
  const { analise } = item;
  return (
    <Link href={`/analises/${encodeURIComponent(analise.codigo)}`} className={`${card} block hover:border-brand-300`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-medium text-muted-foreground">{analise.codigo}</p>
          <h3 className="mt-1 text-base font-semibold">{rotuloPrincipal(analise)}</h3>
          {analise.descricao && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{analise.descricao}</p>}
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${badgeAtivo(analise.ativo)}`}>
          {analise.ativo ? "Ativa" : "Inativa"}
        </span>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${analise.ofertavel ? "bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-950/40 dark:text-brand-300 dark:ring-brand-900" : "bg-muted text-muted-foreground ring-border"}`}>
          {analise.ofertavel ? "Ofertavel" : "Nao ofertavel"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <Mini label="Etapas" value={String(item.nEtapas)} />
        <Mini label="Insumos" value={String(item.nInsumos)} />
        <Mini label="Equip." value={String(item.nEquipamentos)} />
        <Mini label="Preco" value={item.preco != null && item.preco > 0 ? formatCurrency(item.preco) : "-"} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span>{item.amostrasDia > 0 ? `${formatNumber(item.amostrasDia)} amostras/dia` : "capacidade nao calculada"}</span>
        <span>{item.tempoBancada > 0 ? `${formatNumber(item.tempoBancada)} h bancada/amostra` : "tempo de bancada incompleto"}</span>
        {analise.status && <span>Status: {analise.status}</span>}
      </div>
      {item.avisos.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {item.avisos.map((aviso) => (
            <span key={aviso} className="rounded-full bg-warning-soft px-2 py-1 text-xs text-warning-strong">
              {aviso}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/50 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground/80">{label}</p>
      <p className="mt-0.5 font-medium tabular-nums">{value}</p>
    </div>
  );
}
