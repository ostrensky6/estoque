import Link from "next/link";
import { ArrowRight, Bell, ClipboardList, PackageSearch, ShoppingCart, TestTube2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ExecutiveCharts } from "@/components/dashboard/ExecutiveCharts";
import { formatCompactCurrency, formatDate, formatNumber } from "@/lib/formatters";
import { papelAtual } from "@/lib/auth/roles";
import { permiteMinRole, type Role } from "@/config/modules";
import { statusInfo } from "@/components/app/status";
import { HelpLegend, HelpTip } from "@/components/common/HelpTip";
import { PageShell } from "@/components/app/PageShell";
import { PageHeader } from "@/components/app/PageHeader";
import { SectionCard } from "@/components/app/SectionCard";
import { StatCard } from "@/components/app/StatCard";
import { StatusBadge } from "@/components/app/StatusBadge";
import { EmptyState } from "@/components/app/EmptyState";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

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

const pct = (parte: number, total: number) =>
  total > 0 ? `${Math.round((parte / total) * 100)}%` : "0%";

function AcaoRapida({
  href,
  titulo,
  desc,
  icon: Icon,
}: {
  href: string;
  titulo: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      href={href}
      className="group flex min-w-52 flex-1 items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-xs transition-colors hover:bg-muted/50"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors group-hover:text-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">{titulo}</span>
        <span className="block truncate text-xs text-muted-foreground">{desc}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function JornadaCard({
  titulo,
  subtitulo,
  ajuda,
  badge,
  passos,
}: {
  titulo: string;
  subtitulo: string;
  ajuda?: React.ReactNode;
  badge: React.ReactNode;
  passos: Array<{ titulo: string; desc: string; href: string }>;
}) {
  return (
    <SectionCard
      title={titulo}
      description={
        ajuda ? (
          <span className="flex items-center gap-1">
            {subtitulo}
            <HelpTip title={`Jornada de ${titulo.toLowerCase()}`}>{ajuda}</HelpTip>
          </span>
        ) : (
          subtitulo
        )
      }
      actions={badge}
      contentClassName="grid gap-2"
    >
      {passos.map((p, i) => (
        <Link
          key={p.href}
          href={p.href}
          className="group flex gap-3 rounded-md border border-border/70 p-3 transition-colors hover:bg-muted/50"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
            {i + 1}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium text-foreground group-hover:text-primary">
              {p.titulo}
            </span>
            <span className="block text-xs leading-snug text-muted-foreground">{p.desc}</span>
          </span>
        </Link>
      ))}
    </SectionCard>
  );
}

function ListaProblemas({
  titulo,
  href,
  vazio,
  itens,
}: {
  titulo: string;
  href: string;
  vazio: string;
  itens: Array<{ titulo: string; meta: string }>;
}) {
  return (
    <SectionCard
      title={titulo}
      actions={
        <Link href={href} aria-label={`Ver todos: ${titulo}`} className="text-xs font-semibold text-primary hover:underline">
          Ver todos
        </Link>
      }
      contentClassName="p-3 sm:p-3"
    >
      {itens.length > 0 ? (
        <ul className="space-y-2">
          {itens.map((item, i) => (
            <li key={`${item.titulo}-${i}`} className="rounded-md bg-muted/50 px-3 py-2">
              <div className="truncate text-sm font-medium text-foreground" title={item.titulo}>
                {item.titulo}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">{item.meta}</div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="Tudo em dia" description={vazio} className="py-4" />
      )}
    </SectionCard>
  );
}

export default async function Home() {
  const supabase = await createClient();
  const papelPromise = papelAtual();
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

  const papel = await papelPromise;
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
  const alertasSemValidade = alertas.filter((a) => a.tipo === "sem_validade");
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

  const statusGeralTom =
    alertasVencidos.length > 0 || semDisponivel.length > 0
      ? "vencido"
      : alertas.length > 0
        ? "reposicao"
        : "ativo";
  const statusGeral =
    alertas.length > 0
      ? `${alertas.length} ${alertas.length === 1 ? "alerta ativo" : "alertas ativos"}`
      : pedidos.length > 0
        ? `${pedidos.length} ${pedidos.length === 1 ? "compra em andamento" : "compras em andamento"}`
        : "estoque sem alertas";

  return (
    <PageShell>
      <PageHeader
        title="Painel de decisão operacional"
        description="O que precisa de compra, aceite, baixa ou revisão hoje."
        help={
          <HelpTip title="Painel de decisão">
            <p>
              Junta orçamento, planejamento, estoque e compras numa só tela, para você ver{" "}
              <b>o que resolver</b> antes que vire problema na bancada.
            </p>
            <HelpLegend
              items={[
                { tom: "critico", rotulo: "Crítico", texto: "vencido ou sem saldo disponível." },
                { tom: "atencao", rotulo: "Atenção", texto: "abaixo do ponto de reposição ou vencendo." },
                { tom: "info", rotulo: "Em andamento", texto: "compras abertas ou lotes em quarentena." },
              ]}
            />
          </HelpTip>
        }
        meta={<StatusBadge status={statusGeralTom} label={statusGeral} />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="muted">{nAnalises ?? 0} análises ativas</Badge>
            <Badge variant="muted">{nPlanos ?? 0} planejamentos</Badge>
            <Badge variant="muted">{saldo.length} insumos monitorados</Badge>
          </div>
        }
      />

      <section aria-label="Atenção de hoje" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Reposição"
          value={alertasReposicao.length}
          detail="abaixo do ponto configurado"
          tone={alertasReposicao.length ? "warning" : "neutral"}
        />
        <StatCard
          label="Vencidos"
          value={alertasVencidos.length + alertasSemValidade.length}
          detail="vencidos ou críticos sem validade"
          tone={alertasVencidos.length + alertasSemValidade.length ? "danger" : "neutral"}
        />
        <StatCard
          label="Sem disponível"
          value={semDisponivel.length}
          detail={`${pct(semDisponivel.length, saldo.length)} dos insumos`}
          tone={semDisponivel.length ? "danger" : "neutral"}
        />
        <StatCard
          label="Pedidos abertos"
          value={pedidos.length}
          detail="solicitados, aprovados ou enviados"
          tone={pedidos.length ? "info" : "neutral"}
        />
      </section>

      <section className="flex flex-wrap gap-3" aria-label="Ações rápidas">
        <AcaoRapida href="/orcamento/demandas/nova" titulo="Novo orçamento" desc="Montar análises e preço" icon={TestTube2} />
        <AcaoRapida href="/planejamento" titulo="Planejar campanha" desc="Reservas e consumo" icon={ClipboardList} />
        <AcaoRapida href="/estoque" titulo="Revisar estoque" desc="Saldos, lotes e validade" icon={PackageSearch} />
        <AcaoRapida href="/compras" titulo="Abrir compras" desc="Reposição e recebimento" icon={ShoppingCart} />
        <AcaoRapida href="/notificacoes" titulo="Notificações" desc="Pendências" icon={Bell} />
      </section>

      <section aria-label="Indicadores de estoque" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Comprar agora"
          value={criticosParaComprar.length}
          detail="itens abaixo do ponto de reposição"
          tone={criticosParaComprar.length ? "warning" : "neutral"}
        />
        <StatCard
          label="Vencendo"
          value={alertasVencimento.length}
          detail="lotes dentro da janela de vencimento"
          tone={alertasVencimento.length ? "warning" : "neutral"}
        />
        <StatCard
          label="Quarentena"
          value={emQuarentena.length}
          detail="insumos com saldo aguardando aceite"
          tone={emQuarentena.length ? "info" : "neutral"}
        />
        <StatCard
          label="Cobertura"
          value={pct(Math.max(0, saldo.length - semDisponivel.length), saldo.length)}
          detail="insumos com saldo disponível positivo"
        />
      </section>

      <SectionCard
        title="Dashboard executivo"
        description="Estoque, compras, margem e funil comercial em uma leitura rápida."
        actions={<Badge variant="muted">{notificacoes.length} notificações in-app</Badge>}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Estoque ativo"
            value={formatCompactCurrency(dashboard?.valor_estoque_ativo)}
            detail="saldo aceito/em uso valorizado"
            tone="brand"
          />
          <StatCard
            label="Vencendo"
            value={formatCompactCurrency(dashboard?.valor_vencendo_horizonte)}
            detail={`${dashboard?.lotes_vencendo_horizonte ?? 0} lotes no horizonte`}
            tone={(dashboard?.lotes_vencendo_horizonte ?? 0) > 0 ? "warning" : "neutral"}
          />
          <StatCard
            label="Compras abertas"
            value={formatCompactCurrency(dashboard?.compras_abertas_valor)}
            detail="valor estimado em pedidos abertos"
            tone="info"
          />
          <StatCard
            label="Margem média"
            value={`${formatNumber(dashboard?.margem_media_pct)}%`}
            detail="orçamentos com preço registrado"
          />
        </div>
        <div className="mt-4">
          <ExecutiveCharts gastos={gastos} funil={funil} />
        </div>
      </SectionCard>

      <section className="grid gap-4 lg:grid-cols-2" aria-label="Jornadas">
        <JornadaCard
          titulo="Orçamento"
          subtitulo="Do pedido do cliente à proposta emitida."
          ajuda={
            <p>
              O preço sai das análises escolhidas: <b>custos diretos</b> (reagentes, equipamento e
              pessoal), overhead e fatores comerciais. Tudo fica registrado na proposta.
            </p>
          }
          badge={<Badge variant="muted">{nAnalises ?? 0} análises ativas</Badge>}
          passos={[
            { href: "/orcamento/demandas/nova", titulo: "Novo orçamento", desc: "Cliente, amostras e análises em um só formulário." },
            { href: "/orcamento/demandas", titulo: "Orçamentos em andamento", desc: "Custos, revisão e emissão da proposta final." },
            { href: "/analises", titulo: "Análises", desc: "Revise capacidade, tempos, equipamentos e materiais por protocolo." },
            { href: "/orcamento/historico", titulo: "Histórico", desc: "Propostas emitidas, aprovadas ou encerradas." },
          ]}
        />
        <JornadaCard
          titulo="Estoque"
          subtitulo="Do planejamento à reposição."
          ajuda={
            <p>
              O plano calcula quanto de cada insumo será usado e <b>reserva os lotes</b>. A baixa
              segue o lote que vence primeiro, e a falta de saldo gera pedido de compra.
            </p>
          }
          badge={<StatusBadge status={statusGeralTom} label={statusGeral} />}
          passos={[
            { href: "/planejamento", titulo: "Planejamento", desc: "Calcule consumo por campanha e reserve material antes da execução." },
            { href: "/estoque", titulo: "Estoque e lotes", desc: "Veja saldo, validade, quarentena, bloqueios e rastreabilidade." },
            { href: "/compras", titulo: "Compras", desc: "Transforme alertas em solicitação, aprovação, envio e recebimento." },
          ]}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" aria-label="Pendências">
        <ListaProblemas
          titulo="Prioridade de compra"
          href="/compras"
          vazio="Nenhum insumo abaixo do ponto de reposição."
          itens={criticosParaComprar.slice(0, 5)}
        />
        <ListaProblemas
          titulo="Validade e uso"
          href="/estoque"
          vazio="Nenhum lote vencido ou vencendo dentro da janela."
          itens={[...alertasVencidos, ...alertasSemValidade, ...alertasVencimento].slice(0, 5).map((a) => ({
            titulo: a.especificacao ?? `Insumo #${a.insumo_id}`,
            meta: `${a.tipo === "vencido" ? "vencido" : a.tipo === "sem_validade" ? "sem validade cadastrada" : "vence em breve"}${a.validade ? ` · ${formatDate(a.validade)}` : ""} · saldo ${formatNumber(a.valor)}`,
          }))}
        />
        <ListaProblemas
          titulo="Compras em andamento"
          href="/compras"
          vazio="Nenhum pedido aberto no ciclo de compras."
          itens={pedidos.slice(0, 5).map((p) => ({
            titulo: `Pedido #${p.id}`,
            meta: `${statusInfo(p.status).label}${p.data_solicitacao ? ` · ${formatDate(p.data_solicitacao)}` : ""}${p.projeto ? ` · ${p.projeto}` : ""}`,
          }))}
        />
        <ListaProblemas
          titulo="Notificações"
          href="/notificacoes"
          vazio="Nenhuma notificação in-app pendente."
          itens={notificacoes.map((n) => ({
            titulo: n.titulo,
            meta: `${n.tipo}${n.corpo ? ` · ${n.corpo}` : ""}`,
          }))}
        />
      </section>

      <SectionCard
        title="Base de controle"
        description={
          <span className="flex items-center gap-1">
            Cadastros, qualidade dos dados, auditoria e usuários.
            <HelpTip title="Base de controle">
              <p>
                Cadastros, permissões e auditoria sustentam orçamento e estoque. Sem eles, custo,
                saldo e compra perdem a <b>rastreabilidade</b>.
              </p>
            </HelpTip>
          </span>
        }
        actions={<Badge variant="muted">governança</Badge>}
        contentClassName="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {(
          [
            ["Cadastros", "/cadastros", "Insumos, equipamentos, técnicos, fornecedores, locais e parâmetros."],
            ["Qualidade", "/cadastros/qualidade", "O que falta nos cadastros e distorce custo ou compra."],
            ["Auditoria", "/auditoria", "Quem alterou o quê, e quando.", "gestor"],
            ["Usuários", "/usuarios", "Papéis de técnico, coordenador, gestor e administrador.", "admin"],
          ] as Array<[string, string, string, Role?]>
        )
          .filter(([, , , minRole]) => permiteMinRole({ papel }, minRole))
          .map(([titulo, href, desc]) => (
          <Link
            key={href}
            href={href}
            className="rounded-md border border-border/70 bg-muted/40 p-3 transition-colors hover:bg-muted/70"
          >
            <span className="block text-sm font-semibold text-foreground">{titulo}</span>
            <span className="mt-1 block text-xs leading-snug text-muted-foreground">{desc}</span>
          </Link>
        ))}
      </SectionCard>
    </PageShell>
  );
}
