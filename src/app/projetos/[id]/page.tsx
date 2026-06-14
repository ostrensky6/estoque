import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { calcularOrcamentoProjetoLegacy } from "@/lib/project-budget/legacy";

export const dynamic = "force-dynamic";

const moeda = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function fmtData(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("pt-BR");
}

const STATUS_PROJETO: Record<string, { label: string; cls: string }> = {
  proposto: { label: "Proposto", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" },
  ativo: { label: "Ativo", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" },
  concluido: { label: "Concluído", cls: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300" },
  cancelado: { label: "Cancelado", cls: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800" },
};

const STATUS_ORC: Record<string, { label: string; cls: string }> = {
  rascunho: { label: "Rascunho", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" },
  enviado: { label: "Enviado", cls: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300" },
  aprovado: { label: "Aprovado", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" },
  recusado: { label: "Recusado", cls: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800" },
};

const STATUS_COMPRA: Record<string, { label: string; cls: string }> = {
  solicitado: { label: "Solicitado", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" },
  aprovado: { label: "Aprovado", cls: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300" },
  enviado: { label: "Enviado", cls: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300" },
  em_transito: { label: "Em trânsito", cls: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300" },
  recebido: { label: "Recebido", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" },
  cancelado: { label: "Cancelado", cls: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800" },
};

function Badge({ map, status }: { map: Record<string, { label: string; cls: string }>; status: string }) {
  const s = map[status] ?? { label: status, cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800" };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${s.cls}`}>
      {s.label}
    </span>
  );
}

function Kpi({ label, valor, hint }: { label: string; valor: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{valor}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-400 dark:text-zinc-500">{hint}</p>}
    </div>
  );
}

const cardCls =
  "rounded-lg border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900";
const thCls =
  "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400";
const tdCls = "px-3 py-2 text-sm text-slate-700 dark:text-zinc-200";

export default async function ProjetoHubPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idRaw } = await params;
  const id = Number(idRaw);
  if (!Number.isFinite(id)) notFound();

  const supabase = await createClient();

  const { data: projeto } = await supabase
    .from("projetos")
    .select("id, nome, cliente_id, coordenador, status, data_inicio, data_fim, descricao")
    .eq("id", id)
    .single();

  if (!projeto) notFound();

  const [
    { data: cliente },
    { data: orcamentos },
    { data: orcProjetos },
    { data: planos },
    { data: compras },
    { data: demandas },
    { data: fornecedores },
  ] = await Promise.all([
    projeto.cliente_id != null
      ? supabase.from("clientes").select("id, nome").eq("id", projeto.cliente_id).single()
      : Promise.resolve({ data: null }),
    supabase
      .from("orcamentos")
      .select("id, tipo, status, data_orcamento, orcamento_itens(n_amostras, preco_unitario)")
      .eq("projeto_id", id)
      .order("criado_em", { ascending: false }),
    supabase
      .from("orcamento_projetos")
      .select(
        "id, titulo, status, data_orcamento, margem_lucro, impostos, impostos_legacy, incubacao, reserva, investimentos, lucro, orcamento_projeto_analises(n_amostras, preco_unitario), orcamento_projeto_custos(rubrica, quantidade, preco_unitario, meses_selecionados)",
      )
      .eq("projeto_id", id)
      .order("criado_em", { ascending: false }),
    supabase
      .from("planejamento")
      .select("id, nome, data_alvo, criado_em, planejamento_itens(n_amostras)")
      .eq("projeto_id", id)
      .order("criado_em", { ascending: false }),
    supabase
      .from("pedidos_compra")
      .select("id, status, data_solicitacao, fornecedor_id, pedidos_compra_itens(quantidade, custo_unitario_estimado)")
      .eq("projeto_id", id)
      .order("criado_em", { ascending: false }),
    supabase
      .from("demandas_propostas")
      .select("id, titulo, status, data_solicitacao")
      .eq("projeto_id", id)
      .order("criado_em", { ascending: false }),
    supabase.from("fornecedores").select("id, nome"),
  ]);

  const fornecedorNome = new Map((fornecedores ?? []).map((f) => [f.id, f.nome]));

  // --- Orçamentos (dois modelos) unificados em linhas com total ---
  type OrcLinha = { key: string; href: string; titulo: string; tipo: string; data: string; status: string; total: number };

  const orcAnalises: OrcLinha[] = (orcamentos ?? []).map((o) => {
    const itens = o.orcamento_itens ?? [];
    const total = itens.reduce(
      (a, it) => a + Number(it.preco_unitario) * Number(it.n_amostras),
      0,
    );
    return {
      key: `a-${o.id}`,
      href: `/orcamento/${o.id}`,
      titulo: `Orçamento ${o.id}`,
      tipo: o.tipo ?? "analises",
      data: o.data_orcamento ?? "",
      status: o.status,
      total,
    };
  });

  const orcProjetoLinhas: OrcLinha[] = (orcProjetos ?? []).map((o) => {
    const analises = (o.orcamento_projeto_analises ?? []).map((it) => ({
      rubrica: "MC",
      quantidade: Number(it.n_amostras),
      preco_unitario: Number(it.preco_unitario),
      meses_selecionados: [] as number[],
    }));
    const custos = (o.orcamento_projeto_custos ?? []).map((c) => ({
      rubrica: c.rubrica,
      quantidade: Number(c.quantidade),
      preco_unitario: Number(c.preco_unitario),
      meses_selecionados: c.meses_selecionados,
    }));
    const calculo = calcularOrcamentoProjetoLegacy([...analises, ...custos], {
      impostos_legacy: Number(o.impostos_legacy ?? o.impostos ?? 0),
      incubacao: Number(o.incubacao ?? 0),
      reserva: Number(o.reserva ?? 0),
      investimentos: Number(o.investimentos ?? 0),
      lucro: Number(o.lucro ?? o.margem_lucro ?? 0),
    });
    return {
      key: `p-${o.id}`,
      href: `/orcamento/projetos/${o.id}`,
      titulo: o.titulo ?? `Projeto ${o.id}`,
      tipo: "projeto",
      data: o.data_orcamento ?? "",
      status: o.status,
      total: calculo.grossTotal,
    };
  });

  const orcLinhas = [...orcAnalises, ...orcProjetoLinhas];
  const orcadoAprovado = orcLinhas
    .filter((o) => o.status === "aprovado")
    .reduce((a, o) => a + o.total, 0);

  // --- Compras: valor comprometido (estimado), exceto cancelados ---
  const comprasLinhas = (compras ?? []).map((c) => {
    const total = (c.pedidos_compra_itens ?? []).reduce(
      (a, it) => a + Number(it.quantidade) * Number(it.custo_unitario_estimado ?? 0),
      0,
    );
    return {
      id: c.id,
      status: c.status,
      data: c.data_solicitacao,
      fornecedor: c.fornecedor_id != null ? fornecedorNome.get(c.fornecedor_id) ?? "—" : "—",
      itens: (c.pedidos_compra_itens ?? []).length,
      total,
    };
  });
  const comprometidoCompras = comprasLinhas
    .filter((c) => c.status !== "cancelado")
    .reduce((a, c) => a + c.total, 0);

  const planosLinhas = (planos ?? []).map((p) => ({
    id: p.id,
    nome: p.nome ?? `Plano ${p.id}`,
    dataAlvo: p.data_alvo,
    amostras: (p.planejamento_itens ?? []).reduce((a, it) => a + Number(it.n_amostras), 0),
    itens: (p.planejamento_itens ?? []).length,
  }));

  return (
    <div className="min-h-dvh bg-transparent font-sans text-slate-900 dark:bg-zinc-950 dark:text-slate-100">
      <main className="mx-auto max-w-6xl px-6 py-10">
        {/* Breadcrumb */}
        <nav className="text-sm text-slate-500 dark:text-zinc-400">
          <Link href="/projetos" className="hover:underline">Projetos</Link>
          <span className="mx-1.5">/</span>
          <span className="text-slate-700 dark:text-zinc-200">{projeto.nome}</span>
        </nav>

        {/* Header */}
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{projeto.nome}</h1>
              <Badge map={STATUS_PROJETO} status={projeto.status} />
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
              {cliente?.nome ? `Cliente: ${cliente.nome}` : "Sem cliente vinculado"}
              {projeto.coordenador ? ` · Coordenador: ${projeto.coordenador}` : ""}
              {projeto.data_inicio || projeto.data_fim
                ? ` · ${fmtData(projeto.data_inicio)} → ${fmtData(projeto.data_fim)}`
                : ""}
            </p>
            {projeto.descricao && (
              <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-zinc-300">{projeto.descricao}</p>
            )}
          </div>
          <Link
            href="/cadastros/projetos"
            className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
          >
            Editar cadastro
          </Link>
        </div>

        {/* KPIs */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Orçado (aprovado)" valor={moeda(orcadoAprovado)} hint={`${orcLinhas.length} orçamento(s)`} />
          <Kpi label="Comprometido em compras" valor={moeda(comprometidoCompras)} hint={`${comprasLinhas.length} pedido(s)`} />
          <Kpi label="Planejamentos" valor={String(planosLinhas.length)} hint={`${planosLinhas.reduce((a, p) => a + p.amostras, 0)} amostras`} />
          <Kpi label="Demandas" valor={String((demandas ?? []).length)} hint="entradas do projeto" />
        </div>

        {/* Orçamentos */}
        <section className="mt-8">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Orçamentos</h2>
            <Link href="/orcamento" className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400">Ver todos</Link>
          </div>
          <div className={`${cardCls} overflow-x-auto`}>
            {orcLinhas.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-slate-400 dark:text-zinc-500">Nenhum orçamento vinculado a este projeto.</p>
            ) : (
              <table className="min-w-full">
                <thead className="border-b border-slate-100 dark:border-zinc-800">
                  <tr>
                    <th className={thCls}>Documento</th>
                    <th className={thCls}>Tipo</th>
                    <th className={thCls}>Data</th>
                    <th className={thCls}>Status</th>
                    <th className={`${thCls} text-right`}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {orcLinhas.map((o) => (
                    <tr key={o.key} className="border-b border-slate-50 last:border-b-0 hover:bg-slate-50 dark:border-zinc-800/50 dark:hover:bg-zinc-800/40">
                      <td className={tdCls}><Link href={o.href} className="font-medium text-emerald-700 hover:underline dark:text-emerald-400">{o.titulo}</Link></td>
                      <td className={tdCls}>{o.tipo}</td>
                      <td className={tdCls}>{fmtData(o.data)}</td>
                      <td className={tdCls}><Badge map={STATUS_ORC} status={o.status} /></td>
                      <td className={`${tdCls} text-right tabular-nums`}>{moeda(o.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Planejamentos */}
        <section className="mt-8">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Planejamentos</h2>
            <Link href="/planejamento" className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400">Ver todos</Link>
          </div>
          <div className={`${cardCls} overflow-x-auto`}>
            {planosLinhas.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-slate-400 dark:text-zinc-500">Nenhum planejamento vinculado a este projeto.</p>
            ) : (
              <table className="min-w-full">
                <thead className="border-b border-slate-100 dark:border-zinc-800">
                  <tr>
                    <th className={thCls}>Plano</th>
                    <th className={thCls}>Data-alvo</th>
                    <th className={`${thCls} text-right`}>Análises</th>
                    <th className={`${thCls} text-right`}>Amostras</th>
                  </tr>
                </thead>
                <tbody>
                  {planosLinhas.map((p) => (
                    <tr key={p.id} className="border-b border-slate-50 last:border-b-0 hover:bg-slate-50 dark:border-zinc-800/50 dark:hover:bg-zinc-800/40">
                      <td className={tdCls}><Link href={`/planejamento/${p.id}`} className="font-medium text-emerald-700 hover:underline dark:text-emerald-400">{p.nome}</Link></td>
                      <td className={tdCls}>{fmtData(p.dataAlvo)}</td>
                      <td className={`${tdCls} text-right tabular-nums`}>{p.itens}</td>
                      <td className={`${tdCls} text-right tabular-nums`}>{p.amostras}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Compras */}
        <section className="mt-8">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Compras</h2>
            <Link href="/compras" className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400">Ver todas</Link>
          </div>
          <div className={`${cardCls} overflow-x-auto`}>
            {comprasLinhas.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-slate-400 dark:text-zinc-500">Nenhum pedido de compra vinculado a este projeto.</p>
            ) : (
              <table className="min-w-full">
                <thead className="border-b border-slate-100 dark:border-zinc-800">
                  <tr>
                    <th className={thCls}>Pedido</th>
                    <th className={thCls}>Fornecedor</th>
                    <th className={thCls}>Data</th>
                    <th className={thCls}>Status</th>
                    <th className={`${thCls} text-right`}>Itens</th>
                    <th className={`${thCls} text-right`}>Estimado</th>
                  </tr>
                </thead>
                <tbody>
                  {comprasLinhas.map((c) => (
                    <tr key={c.id} className="border-b border-slate-50 last:border-b-0 hover:bg-slate-50 dark:border-zinc-800/50 dark:hover:bg-zinc-800/40">
                      <td className={tdCls}><Link href={`/compras/${c.id}`} className="font-medium text-emerald-700 hover:underline dark:text-emerald-400">Pedido {c.id}</Link></td>
                      <td className={tdCls}>{c.fornecedor}</td>
                      <td className={tdCls}>{fmtData(c.data)}</td>
                      <td className={tdCls}><Badge map={STATUS_COMPRA} status={c.status} /></td>
                      <td className={`${tdCls} text-right tabular-nums`}>{c.itens}</td>
                      <td className={`${tdCls} text-right tabular-nums`}>{moeda(c.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Demandas */}
        {(demandas ?? []).length > 0 && (
          <section className="mt-8">
            <h2 className="mb-2 text-lg font-semibold tracking-tight">Demandas / Propostas</h2>
            <div className={`${cardCls} overflow-x-auto`}>
              <table className="min-w-full">
                <thead className="border-b border-slate-100 dark:border-zinc-800">
                  <tr>
                    <th className={thCls}>Título</th>
                    <th className={thCls}>Data</th>
                    <th className={thCls}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(demandas ?? []).map((d) => (
                    <tr key={d.id} className="border-b border-slate-50 last:border-b-0 hover:bg-slate-50 dark:border-zinc-800/50 dark:hover:bg-zinc-800/40">
                      <td className={tdCls}><Link href={`/orcamento/demandas/${d.id}`} className="font-medium text-emerald-700 hover:underline dark:text-emerald-400">{d.titulo}</Link></td>
                      <td className={tdCls}>{fmtData(d.data_solicitacao)}</td>
                      <td className={tdCls}>{d.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
