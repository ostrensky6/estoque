import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  gerarOrcamentoAnalisesDaDemanda,
  gerarOrcamentoProjetoDaDemanda,
  salvarDemanda,
} from "@/lib/actions/demandas";

export const dynamic = "force-dynamic";

const MODALIDADES: Record<string, string> = {
  analises: "Apenas análises laboratoriais",
  projeto: "Apenas projeto",
  analises_projeto: "Análises dentro de projeto",
  projeto_analises_custos: "Projeto com custos próprios e análises laboratoriais",
};

export default async function DemandaDetalhe({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const demandaId = Number(id);
  const supabase = await createClient();

  const { data: demanda } = await supabase
    .from("demandas_propostas")
    .select("*")
    .eq("id", demandaId)
    .single();
  if (!demanda) notFound();

  const [{ data: clientes }, { data: projetos }, { data: orcamentos }, { data: orcProjetos }] =
    await Promise.all([
      supabase.from("clientes").select("id, nome").eq("ativo", true).order("nome"),
      supabase.from("projetos").select("id, nome").order("nome"),
      supabase.from("orcamentos").select("id, status, data_orcamento").eq("demanda_id", demandaId).order("id"),
      supabase.from("orcamento_projetos").select("id, status, data_orcamento, titulo").eq("demanda_id", demandaId).order("id"),
    ]);

  const inp =
    "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";
  const lbl = "block text-xs font-medium text-zinc-600 dark:text-zinc-300";

  return (
    <div className="min-h-dvh bg-transparent font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Link href="/orcamento/demandas" className="text-xs text-zinc-500 hover:underline">
          ← Demandas/Propostas
        </Link>

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
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-4">
            <Info titulo="Cliente" texto={demanda.cliente_nome} />
            <Info titulo="Contato" texto={demanda.cliente_contato} />
            <Info titulo="Solicitação" texto={demanda.data_solicitacao} />
            <Info titulo="Prazo esperado" texto={demanda.prazo_esperado} />
          </div>

          <div className="mt-6 grid gap-4 text-sm md:grid-cols-3">
            <Texto titulo="Descrição" texto={demanda.descricao} />
            <Texto titulo="Escopo preliminar" texto={demanda.escopo_preliminar} />
            <Texto titulo="Observações" texto={demanda.observacoes} />
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-semibold">Gerar orçamento</h2>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              A demanda continua existindo como registro de entrada. O orçamento gerado recebe os dados comuns.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <form action={gerarOrcamentoAnalisesDaDemanda}>
                <input type="hidden" name="demanda_id" value={demandaId} />
                <button className="rounded-md bg-brand-600 px-3 py-2 text-xs font-medium text-white hover:bg-brand-500">
                  Orçamento de análises
                </button>
              </form>
              <form action={gerarOrcamentoProjetoDaDemanda}>
                <input type="hidden" name="demanda_id" value={demandaId} />
                <button className="rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
                  Orçamento de projeto
                </button>
              </form>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-semibold">Orçamentos vinculados</h2>
            <div className="mt-3 space-y-2 text-sm">
              {(orcamentos ?? []).map((o) => (
                <Link key={o.id} href={`/orcamento/${o.id}`} className="block rounded-md bg-zinc-50 px-3 py-2 hover:bg-zinc-100 dark:bg-zinc-950/50 dark:hover:bg-zinc-800">
                  Análises #{o.id} · {o.status}
                </Link>
              ))}
              {(orcProjetos ?? []).map((o) => (
                <Link key={o.id} href={`/orcamento/projetos/${o.id}`} className="block rounded-md bg-zinc-50 px-3 py-2 hover:bg-zinc-100 dark:bg-zinc-950/50 dark:hover:bg-zinc-800">
                  Projeto #{o.id} · {o.status}
                </Link>
              ))}
              {(orcamentos ?? []).length === 0 && (orcProjetos ?? []).length === 0 && (
                <p className="text-xs text-zinc-400">Nenhum orçamento gerado a partir desta demanda.</p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-semibold">Fluxo recomendado</h2>
            <ol className="mt-3 space-y-2 text-xs leading-5 text-zinc-500">
              <li>1. Registrar demanda.</li>
              <li>2. Confirmar modalidade e projeto.</li>
              <li>3. Gerar orçamento correto.</li>
              <li>4. Planejar demanda e reservar estoque quando aprovado.</li>
            </ol>
          </div>
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
