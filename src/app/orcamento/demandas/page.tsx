import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { criarDemanda } from "@/lib/actions/demandas";
import { DemandasTable, type DemandaRow } from "@/components/orcamento/DemandasTable";
import { avaliarCompletudeDemanda } from "@/lib/orcamento/demanda-completude";
import { carregarLinhasOrcamentos } from "@/lib/orcamento/orcamentos-listagem";
import { resumirFunilPropostas } from "@/lib/orcamento/funil-propostas";
import { PageShell } from "@/components/app/PageShell";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionCard } from "@/components/app/SectionCard";
import { StatCard } from "@/components/app/StatCard";

export const dynamic = "force-dynamic";

// Rótulos de exibição (inclui legados para leitura de dados antigos).
const MODALIDADES: Record<string, string> = {
  analises: "Apenas análises",
  projeto: "Apenas projeto",
  projeto_com_analises: "Projeto com análises",
  analises_projeto: "Análises dentro de projeto",
  projeto_analises_custos: "Projeto com análises e custos próprios",
};

// Novos cadastros usam somente as três modalidades canônicas.
const MODALIDADES_NOVAS: Array<[string, string]> = [
  ["analises", MODALIDADES.analises],
  ["projeto", MODALIDADES.projeto],
  ["projeto_com_analises", MODALIDADES.projeto_com_analises],
];

const STATUS: Record<string, string> = {
  nova: "Nova",
  em_analise: "Em análise",
  orcada: "Orçada",
  aprovada: "Aprovada",
  recusada: "Recusada",
  cancelada: "Cancelada",
};

export default async function DemandasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusFiltro } = await searchParams;
  const supabase = await createClient();
  const [{ data: demandas }, { data: clientes }, { data: projetos }, linhasFunil] =
    await Promise.all([
      supabase
        .from("demandas_propostas")
        .select("id, titulo, cliente_id, cliente_nome, modalidade, status, prioridade, data_solicitacao, prazo_esperado, projeto_id, descricao, escopo_preliminar, matriz_amostra, quantidade_amostras_estimada, prazo_tecnico_dias, criado_em")
        .order("criado_em", { ascending: false }),
      supabase.from("clientes").select("id, nome").eq("ativo", true).order("nome"),
      supabase.from("projetos").select("id, nome").order("nome"),
      carregarLinhasOrcamentos(),
    ]);
  const resumoFunil = resumirFunilPropostas(linhasFunil);
  const projetoNome = new Map((projetos ?? []).map((p) => [p.id, p.nome]));
  const linhas: DemandaRow[] = (demandas ?? []).map((d) => {
    const completude = avaliarCompletudeDemanda(d);
    return {
      id: d.id as number,
      titulo: d.titulo ?? "Demanda sem título",
      cliente: d.cliente_nome ?? "—",
      modalidade: d.modalidade,
      modalidadeLabel: MODALIDADES[d.modalidade] ?? d.modalidade,
      projeto: d.projeto_id ? projetoNome.get(d.projeto_id) ?? "—" : "—",
      prazo: d.prazo_esperado ?? "—",
      prioridade: d.prioridade ?? "—",
      dataSolicitacao: d.data_solicitacao ?? "—",
      status: d.status,
      statusLabel: STATUS[d.status] ?? d.status,
      completudeLabel: completude.completa ? "Pronta" : `${completude.faltante}% faltante`,
      completa: completude.completa,
    };
  });
  const linhasFiltradas = statusFiltro
    ? linhas.filter((linha) => linha.status === statusFiltro)
    : linhas;
  // §8.2: campo de entrada com texto em azul institucional.
  const inp =
    "rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-brand-700 dark:text-brand-300";

  return (
    <PageShell>
      <PageHeader
        breadcrumbs={[{ label: "Orçamento" }, { label: "Propostas" }]}
        title="Propostas"
        description="Crie e acompanhe propostas comerciais. A partir daqui o fluxo segue para orçamento de análises, orçamento de projeto ou composição híbrida."
      />

      <section className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6" aria-label="Funil de propostas">
        {[
          { label: "Em elaboração", valor: resumoFunil.emElaboracao },
          { label: "Em revisão", valor: resumoFunil.revisao },
          { label: "Emitidas", valor: resumoFunil.emitidas },
          { label: "Aprovadas", valor: resumoFunil.aprovadas },
          { label: "Recusadas", valor: resumoFunil.recusadas },
          { label: "Concluídas", valor: resumoFunil.concluidas },
        ].map((item) => (
          <StatCard key={item.label} label={item.label} value={item.valor.toLocaleString("pt-BR")} />
        ))}
      </section>

      <SectionCard title="Nova demanda" description="Registre a entrada comercial antes do orçamento formal.">
        <form action={criarDemanda} className="grid gap-3 md:grid-cols-4 md:items-end">
          <div className="md:col-span-2">
            <label htmlFor="titulo" className="block text-xs font-medium text-muted-foreground">Título da demanda</label>
            <input id="titulo" name="titulo" placeholder="Ex.: Sequenciamento de amostras ambientais" className={`${inp} mt-1 w-full`} />
          </div>
          <div>
            <label htmlFor="cliente_id" className="block text-xs font-medium text-muted-foreground">Cliente</label>
            <select id="cliente_id" name="cliente_id" defaultValue="" className={`${inp} mt-1 w-full`}>
              <option value="">Cliente livre</option>
              {(clientes ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="modalidade" className="block text-xs font-medium text-muted-foreground">Modalidade</label>
            <select id="modalidade" name="modalidade" defaultValue="analises" className={`${inp} mt-1 w-full`}>
              {MODALIDADES_NOVAS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="cliente_nome" className="block text-xs font-medium text-muted-foreground">Cliente livre</label>
            <input id="cliente_nome" name="cliente_nome" placeholder="Nome do cliente/instituição se não estiver cadastrado" className={`${inp} mt-1 w-full`} />
          </div>
          <div>
            <label htmlFor="matriz_amostra" className="block text-xs font-medium text-muted-foreground">Matriz/amostra</label>
            <input id="matriz_amostra" name="matriz_amostra" placeholder="Ex.: água, solo, tecido" className={`${inp} mt-1 w-full`} />
          </div>
          <div>
            <label htmlFor="quantidade_amostras_estimada" className="block text-xs font-medium text-muted-foreground">Qtd. amostras</label>
            <input id="quantidade_amostras_estimada" name="quantidade_amostras_estimada" type="number" min="1" step="1" className={`${inp} mt-1 w-full`} />
          </div>
          <div>
            <label htmlFor="projeto_id" className="block text-xs font-medium text-muted-foreground">Projeto</label>
            <select id="projeto_id" name="projeto_id" defaultValue="" className={`${inp} mt-1 w-full`}>
              <option value="">Sem projeto</option>
              {(projetos ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>
          <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            Nova demanda
          </button>
        </form>
      </SectionCard>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/orcamento/demandas"
          className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
            !statusFiltro
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          Todas
        </Link>
        {Object.entries(STATUS).map(([value, label]) => (
          <Link
            key={value}
            href={`/orcamento/demandas?status=${value}`}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFiltro === value
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      <DemandasTable rows={linhasFiltradas} />
    </PageShell>
  );
}
