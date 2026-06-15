import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ExecutiveCharts } from "@/components/dashboard/ExecutiveCharts";
import { formatCompactCurrency, formatNumber } from "@/lib/formatters";

export const dynamic = "force-dynamic";

type Tom = "brand" | "blue" | "amber" | "red" | "slate";

type EstoqueSaldo = {
  insumo_id: number;
  especificacao: string | null;
  unidade: string | null;
  em_maos: number | null;
  em_quarentena: number | null;
  reservado: number | null;
  disponivel: number | null;
  ponto_reposicao: number | null;
  estoque_seguranca: number | null;
  categoria_compra: string | null;
};

type AlertaEstoque = {
  tipo: string;
  insumo_id: number;
  especificacao: string | null;
  validade: string | null;
  valor: number | null;
  referencia: number | null;
};

type PedidoCompra = {
  id: number;
  status: string;
  data_solicitacao: string | null;
  projeto: string | null;
};

type DashboardExecutivo = {
  valor_estoque_ativo: number | null;
  valor_vencendo_horizonte: number | null;
  lotes_vencendo_horizonte: number | null;
  orcamentos_rascunho: number | null;
  orcamentos_enviados: number | null;
  orcamentos_aprovados: number | null;
  orcamentos_perdidos: number | null;
  margem_media_pct: number | null;
  compras_abertas_valor: number | null;
  gasto_por_projeto_mes: unknown;
};

type Notificacao = {
  id: number;
  tipo: string;
  titulo: string;
  corpo: string | null;
  criado_em: string;
};

const TONS: Record<
  Tom,
  {
    dot: string;
    panel: string;
    badge: string;
    badgeText: string;
    border: string;
    link: string;
  }
> = {
  brand: {
    dot: "bg-brand-500",
    panel: "border-brand-200 bg-brand-50/60 dark:border-brand-900/50 dark:bg-brand-950/20",
    badge: "bg-brand-100 dark:bg-brand-950/50",
    badgeText: "text-brand-800 dark:text-brand-300",
    border: "border-brand-300",
    link: "text-brand-700 hover:text-brand-800 dark:text-brand-300",
  },
  blue: {
    dot: "bg-blue-500",
    panel: "border-blue-200 bg-blue-50/60 dark:border-blue-900/50 dark:bg-blue-950/20",
    badge: "bg-blue-100 dark:bg-blue-950/50",
    badgeText: "text-blue-800 dark:text-blue-300",
    border: "border-blue-300",
    link: "text-blue-700 hover:text-blue-800 dark:text-blue-300",
  },
  amber: {
    dot: "bg-amber-500",
    panel: "border-amber-200 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/20",
    badge: "bg-amber-100 dark:bg-amber-950/50",
    badgeText: "text-amber-900 dark:text-amber-300",
    border: "border-amber-300",
    link: "text-amber-800 hover:text-amber-900 dark:text-amber-300",
  },
  red: {
    dot: "bg-red-500",
    panel: "border-red-200 bg-red-50/80 dark:border-red-900/50 dark:bg-red-950/20",
    badge: "bg-red-100 dark:bg-red-950/50",
    badgeText: "text-red-800 dark:text-red-300",
    border: "border-red-300",
    link: "text-red-700 hover:text-red-800 dark:text-red-300",
  },
  slate: {
    dot: "bg-slate-400",
    panel: "border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900",
    badge: "bg-slate-100 dark:bg-zinc-800",
    badgeText: "text-slate-700 dark:text-zinc-300",
    border: "border-slate-200",
    link: "text-slate-700 hover:text-slate-950 dark:text-zinc-300",
  },
};

const pct = (parte: number, total: number) =>
  total > 0 ? `${Math.round((parte / total) * 100)}%` : "0%";

function Badge({ children, tom }: { children: React.ReactNode; tom: Tom }) {
  const t = TONS[tom];
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${t.badge} ${t.badgeText}`}>
      {children}
    </span>
  );
}

function Kpi({
  label,
  valor,
  detalhe,
  tom,
}: {
  label: string;
  valor: string | number;
  detalhe: string;
  tom: Tom;
}) {
  const t = TONS[tom];
  return (
    <div className={`rounded-lg border p-4 ${t.panel}`}>
      <div className="flex items-center gap-2 text-xs font-medium uppercase text-slate-500 dark:text-zinc-400">
        <span className={`h-2 w-2 rounded-full ${t.dot}`} />
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
        {valor}
      </div>
      <p className="mt-1 text-xs leading-snug text-slate-600 dark:text-zinc-400">{detalhe}</p>
    </div>
  );
}

function JornadaCard({
  tom,
  titulo,
  subtitulo,
  badge,
  passos,
}: {
  tom: Tom;
  titulo: string;
  subtitulo: string;
  badge: string;
  passos: Array<{ titulo: string; desc: string; href: string }>;
}) {
  const t = TONS[tom];
  return (
    <section className={`rounded-lg border bg-white shadow-sm dark:bg-zinc-900 ${t.border}`}>
      <div className={`h-1 rounded-t-lg ${t.dot}`} />
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{titulo}</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-zinc-400">{subtitulo}</p>
          </div>
          <Badge tom={tom}>{badge}</Badge>
        </div>
        <div className="mt-5 grid gap-2">
          {passos.map((p, i) => (
            <Link
              key={p.href}
              href={p.href}
              className="group flex gap-3 rounded-lg border border-slate-200 bg-white p-3 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950/40 dark:hover:bg-zinc-900"
            >
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${t.badge} ${t.badgeText}`}>
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className={`block text-sm font-semibold ${t.link}`}>{p.titulo}</span>
                <span className="block text-xs leading-snug text-slate-500 dark:text-zinc-400">{p.desc}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function ListaProblemas({
  titulo,
  href,
  tom,
  vazio,
  itens,
}: {
  titulo: string;
  href: string;
  tom: Tom;
  vazio: string;
  itens: Array<{ titulo: string; meta: string }>;
}) {
  const t = TONS[tom];
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-950 dark:text-white">{titulo}</h3>
        <Link href={href} className={`text-xs font-semibold ${t.link}`}>
          abrir
        </Link>
      </div>
      <ul className="mt-3 space-y-2">
        {itens.length > 0 ? (
          itens.map((item, i) => (
            <li key={`${item.titulo}-${i}`} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/40">
              <div className="truncate text-sm font-medium text-slate-900 dark:text-zinc-100" title={item.titulo}>
                {item.titulo}
              </div>
              <div className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">{item.meta}</div>
            </li>
          ))
        ) : (
          <li className="rounded-md border border-slate-100 bg-slate-50 px-3 py-4 text-sm text-slate-500 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">
            {vazio}
          </li>
        )}
      </ul>
    </section>
  );
}

export default async function Home() {
  const supabase = await createClient();
  const [
    { count: nAnalises },
    { data: alertasRaw },
    { data: saldoRaw },
    { count: nPlanos },
    { data: pedidosRaw },
    { data: dashboardRaw },
    { data: notificacoesRaw },
  ] = await Promise.all([
    supabase.from("analises").select("*", { count: "exact", head: true }).eq("ativo", true),
    supabase.from("v_alertas_estoque").select("*"),
    supabase.from("v_estoque_saldo").select("*").order("especificacao"),
    supabase.from("planejamento").select("*", { count: "exact", head: true }),
    supabase
      .from("pedidos_compra")
      .select("id, status, data_solicitacao, projeto")
      .in("status", ["solicitado", "aprovado", "enviado"])
      .order("criado_em", { ascending: false }),
    supabase.from("v_dashboard_executivo").select("*").maybeSingle(),
    supabase
      .from("notificacoes")
      .select("id, tipo, titulo, corpo, criado_em")
      .eq("status", "nao_lida")
      .order("criado_em", { ascending: false })
      .limit(5),
  ]);

  const alertas = (alertasRaw ?? []) as AlertaEstoque[];
  const saldo = (saldoRaw ?? []) as EstoqueSaldo[];
  const pedidos = (pedidosRaw ?? []) as PedidoCompra[];
  const dashboard = dashboardRaw as DashboardExecutivo | null;
  const notificacoes = (notificacoesRaw ?? []) as Notificacao[];
  const gastos = Array.isArray(dashboard?.gasto_por_projeto_mes)
    ? (dashboard.gasto_por_projeto_mes as Array<{ mes: string; projeto: string; gasto: number }>)
    : [];
  const funil = [
    { status: "Rascunho", total: Number(dashboard?.orcamentos_rascunho ?? 0) },
    { status: "Enviado", total: Number(dashboard?.orcamentos_enviados ?? 0) },
    { status: "Aprovado", total: Number(dashboard?.orcamentos_aprovados ?? 0) },
    { status: "Perdido", total: Number(dashboard?.orcamentos_perdidos ?? 0) },
  ];

  const alertasReposicao = alertas.filter((a) => a.tipo === "reposicao");
  const alertasVencimento = alertas.filter((a) => a.tipo === "vencimento");
  const alertasVencidos = alertas.filter((a) => a.tipo === "vencido");
  const semDisponivel = saldo.filter((s) => (s.disponivel ?? 0) <= 0);
  const emQuarentena = saldo.filter((s) => (s.em_quarentena ?? 0) > 0);
  const criticosParaComprar = saldo
    .filter((s) => (s.ponto_reposicao ?? 0) > 0 && (s.disponivel ?? 0) <= (s.ponto_reposicao ?? 0))
    .map((s) => ({
      titulo: s.especificacao ?? `Insumo #${s.insumo_id}`,
      meta: `disp. ${formatNumber(s.disponivel)} ${s.unidade ?? ""} · ponto ${formatNumber(s.ponto_reposicao)} · sugerido ${formatNumber(
        Math.max(0, (s.ponto_reposicao ?? 0) + (s.estoque_seguranca ?? 0) - (s.disponivel ?? 0)),
      )}`,
      peso: (s.categoria_compra === "critico" ? 100000 : 0) + Math.max(0, (s.ponto_reposicao ?? 0) - (s.disponivel ?? 0)),
    }))
    .sort((a, b) => b.peso - a.peso);

  const prioridadeTom: Tom = alertasVencidos.length > 0 || semDisponivel.length > 0 ? "red" : alertas.length > 0 ? "amber" : "blue";
  const statusGeral =
    alertas.length > 0
      ? `${alertas.length} alertas ativos`
      : pedidos.length > 0
        ? `${pedidos.length} compras em andamento`
        : "estoque sem alertas";

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 font-sans text-slate-900 dark:text-slate-100 sm:px-6">
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <div>
          <div className="flex items-center gap-3">
            <Image
              src="/logos/kontrol-app.png"
              alt="Kontrol App"
              width={1448}
              height={1086}
              className="h-auto w-40 shrink-0 object-contain sm:w-48"
              priority
              unoptimized
            />
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                Painel de decisão operacional
              </h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
                Orçamento, planejamento, estoque e compras no mesmo fluxo de decisão.
              </p>
            </div>
          </div>
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-slate-700 dark:text-zinc-300">
            O Kontrol transforma a demanda do laboratório em preço, reserva de insumos,
            consumo por FEFO e reposição. Esta abertura também é o painel de atenção:
            mostra o que precisa de compra, aceite, baixa ou revisão antes de virar
            problema operacional.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Badge tom={prioridadeTom}>{statusGeral}</Badge>
            <Badge tom="brand">{nAnalises ?? 0} análises ativas</Badge>
            <Badge tom="blue">{nPlanos ?? 0} planejamentos</Badge>
            <Badge tom="slate">{saldo.length} insumos monitorados</Badge>
          </div>
        </div>

        <div className={`rounded-lg border p-5 shadow-sm ${TONS[prioridadeTom].panel}`}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase text-slate-600 dark:text-zinc-300">
              Atenção de hoje
            </h2>
            <Badge tom={prioridadeTom}>{alertas.length + semDisponivel.length} pontos</Badge>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Kpi label="Reposição" valor={alertasReposicao.length} detalhe="abaixo do ponto configurado" tom="amber" />
            <Kpi label="Vencidos" valor={alertasVencidos.length} detalhe="lotes aceitos com validade vencida" tom="red" />
            <Kpi label="Sem disponível" valor={semDisponivel.length} detalhe={`${pct(semDisponivel.length, saldo.length)} dos insumos`} tom="red" />
            <Kpi label="Pedidos" valor={pedidos.length} detalhe="solicitados, aprovados ou enviados" tom="blue" />
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Comprar agora" valor={criticosParaComprar.length} detalhe="itens abaixo do ponto de reposição" tom={criticosParaComprar.length ? "amber" : "brand"} />
        <Kpi label="Vencendo" valor={alertasVencimento.length} detalhe="lotes dentro da janela de vencimento" tom={alertasVencimento.length ? "amber" : "brand"} />
        <Kpi label="Quarentena" valor={emQuarentena.length} detalhe="insumos com saldo aguardando aceite" tom={emQuarentena.length ? "blue" : "brand"} />
        <Kpi label="Cobertura" valor={pct(Math.max(0, saldo.length - semDisponivel.length), saldo.length)} detalhe="insumos com saldo disponível positivo" tom="slate" />
      </section>

      <section className="mt-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Dashboard executivo</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
              Estoque, compras, margem e funil comercial em uma leitura rápida.
            </p>
          </div>
          <Badge tom="blue">{notificacoes.length} notificações in-app</Badge>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Estoque ativo" valor={formatCompactCurrency(dashboard?.valor_estoque_ativo)} detalhe="saldo aceito/em uso valorizado" tom="brand" />
          <Kpi label="Vencendo" valor={formatCompactCurrency(dashboard?.valor_vencendo_horizonte)} detalhe={`${dashboard?.lotes_vencendo_horizonte ?? 0} lotes no horizonte`} tom={(dashboard?.lotes_vencendo_horizonte ?? 0) > 0 ? "amber" : "brand"} />
          <Kpi label="Compras abertas" valor={formatCompactCurrency(dashboard?.compras_abertas_valor)} detalhe="valor estimado em pedidos abertos" tom="blue" />
          <Kpi label="Margem média" valor={`${formatNumber(dashboard?.margem_media_pct)}%`} detalhe="orçamentos com snapshot de preço" tom="slate" />
        </div>
        <div className="mt-4">
          <ExecutiveCharts gastos={gastos} funil={funil} />
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <JornadaCard
          tom="brand"
          titulo="Orçamento"
          subtitulo="Da solicitação do cliente ao preço final, com análises, custos diretos, overhead e fatores comerciais documentados."
          badge={`${nAnalises ?? 0} análises ativas`}
          passos={[
            { href: "/orcamento/demandas", titulo: "Demandas/Propostas", desc: "Registre a entrada comercial antes do orçamento formal." },
            { href: "/orcamento", titulo: "Análises/Lab.", desc: "Monte demandas, vincule análises e calcule custos e preços." },
            { href: "/orcamento/projetos", titulo: "Projetos", desc: "Inclua rubricas, custos próprios e cronograma do projeto." },
            { href: "/analises", titulo: "Análises", desc: "Revise capacidade, tempos, equipamentos e materiais por protocolo." },
            { href: "/orcamento/parametros", titulo: "Parâmetros econômicos", desc: "Ajuste margens, impostos, fundos e bases de rateio." },
          ]}
        />
        <JornadaCard
          tom="blue"
          titulo="Estoque"
          subtitulo="Do planejamento à reposição: calcula demanda, reserva insumos, baixa por FEFO e aciona compras quando o saldo fica insuficiente."
          badge={statusGeral}
          passos={[
            { href: "/planejamento", titulo: "Planejamento", desc: "Calcule consumo por campanha e reserve material antes da execução." },
            { href: "/estoque", titulo: "Estoque e lotes", desc: "Veja saldo, validade, quarentena, bloqueios e rastreabilidade." },
            { href: "/compras", titulo: "Compras", desc: "Transforme alertas em solicitação, aprovação, envio e recebimento." },
          ]}
        />
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-4">
        <ListaProblemas
          titulo="Prioridade de compra"
          href="/compras"
          tom="amber"
          vazio="Nenhum insumo abaixo do ponto de reposição."
          itens={criticosParaComprar.slice(0, 5)}
        />
        <ListaProblemas
          titulo="Validade e uso"
          href="/estoque"
          tom={alertasVencidos.length ? "red" : "amber"}
          vazio="Nenhum lote vencido ou vencendo dentro da janela."
          itens={[...alertasVencidos, ...alertasVencimento].slice(0, 5).map((a) => ({
            titulo: a.especificacao ?? `Insumo #${a.insumo_id}`,
            meta: `${a.tipo === "vencido" ? "vencido" : "vence em breve"}${a.validade ? ` · ${a.validade}` : ""} · saldo ${formatNumber(a.valor)}`,
          }))}
        />
        <ListaProblemas
          titulo="Compras em andamento"
          href="/compras"
          tom="blue"
          vazio="Nenhum pedido aberto no ciclo de compras."
          itens={pedidos.slice(0, 5).map((p) => ({
            titulo: `Pedido #${p.id}`,
            meta: `${p.status}${p.data_solicitacao ? ` · ${p.data_solicitacao}` : ""}${p.projeto ? ` · ${p.projeto}` : ""}`,
          }))}
        />
        <ListaProblemas
          titulo="Notificações"
          href="/compras"
          tom="slate"
          vazio="Nenhuma notificação in-app pendente."
          itens={notificacoes.map((n) => ({
            titulo: n.titulo,
            meta: `${n.tipo}${n.corpo ? ` · ${n.corpo}` : ""}`,
          }))}
        />
      </section>

      <section className="mt-8 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Base de controle</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
              Cadastros, permissões e auditoria sustentam os dois fluxos: sem isso,
              custo, estoque e compra perdem rastreabilidade.
            </p>
          </div>
          <Badge tom="slate">governança</Badge>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            ["Cadastros", "/cadastros", "Insumos, equipamentos, técnicos, fornecedores, locais e parâmetros."],
            ["Auditoria", "/auditoria", "Trilha de alterações para saldo, lote, compra, orçamento e cadastros."],
            ["Usuários", "/usuarios", "Papéis de técnico, coordenador, gestor e administrador."],
          ].map(([titulo, href, desc]) => (
            <Link
              key={href}
              href={href}
              className="rounded-lg border border-slate-200 bg-slate-50 p-3 transition-colors hover:border-slate-300 hover:bg-white dark:border-zinc-800 dark:bg-zinc-950/40 dark:hover:bg-zinc-900"
            >
              <span className="block text-sm font-semibold text-slate-900 dark:text-zinc-100">{titulo}</span>
              <span className="mt-1 block text-xs leading-snug text-slate-500 dark:text-zinc-400">{desc}</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
