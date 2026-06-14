import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Tom = "emerald" | "blue";

const TOM: Record<
  Tom,
  {
    bar: string;
    chipBg: string;
    chipText: string;
    hover: string;
    numBg: string;
    numText: string;
    numHover: string;
  }
> = {
  emerald: {
    bar: "bg-emerald-500",
    chipBg: "bg-emerald-100",
    chipText: "text-emerald-700",
    hover: "hover:border-emerald-300 hover:bg-emerald-50/50",
    numBg: "bg-emerald-50",
    numText: "text-emerald-700",
    numHover: "group-hover:bg-emerald-600 group-hover:text-white",
  },
  blue: {
    bar: "bg-blue-500",
    chipBg: "bg-blue-100",
    chipText: "text-blue-700",
    hover: "hover:border-blue-300 hover:bg-blue-50/50",
    numBg: "bg-blue-50",
    numText: "text-blue-700",
    numHover: "group-hover:bg-blue-600 group-hover:text-white",
  },
};

function Passo({
  numero,
  href,
  titulo,
  desc,
  extra,
  tom,
}: {
  numero: number;
  href: string;
  titulo: string;
  desc: string;
  extra?: React.ReactNode;
  tom: Tom;
}) {
  const t = TOM[tom];
  return (
    <Link
      href={href}
      className={`group flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 transition-colors ${t.hover} dark:border-zinc-800 dark:bg-zinc-900`}
    >
      <span
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${t.numBg} ${t.numText} ${t.numHover} dark:bg-zinc-800 dark:text-zinc-300`}
      >
        {numero}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
          {titulo}
        </span>
        <span className="block text-xs leading-snug text-slate-500">{desc}</span>
        {extra}
      </span>
    </Link>
  );
}

export default async function Home() {
  const supabase = await createClient();
  const [
    { count: nAnalises },
    { data: alertas },
    { count: nPlanos },
    { count: nPedidosAbertos },
  ] = await Promise.all([
    supabase.from("analises").select("*", { count: "exact", head: true }).eq("ativo", true),
    supabase.from("v_alertas_estoque").select("tipo"),
    supabase.from("planejamento").select("*", { count: "exact", head: true }),
    supabase
      .from("pedidos_compra")
      .select("*", { count: "exact", head: true })
      .in("status", ["solicitado", "aprovado", "enviado"]),
  ]);

  const nAlertas = alertas?.length ?? 0;
  const nRepor = (alertas ?? []).filter((a) => a.tipo === "reposicao").length;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 font-sans text-slate-900 dark:text-slate-100">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
        Lab Custos &amp; Estoque
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
        Dois fluxos independentes:{" "}
        <b className="font-semibold text-emerald-700 dark:text-emerald-400">Orçamento</b>{" "}
        (da demanda do cliente ao preço final) e{" "}
        <b className="font-semibold text-blue-700 dark:text-blue-400">Estoque</b>{" "}
        (do planejamento à reposição).
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Bloco Orçamento */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-900/5 dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="h-1 bg-emerald-500" />
          <div className="p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Orçamento
              </h2>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                {nAnalises ?? 0} análises ativas
              </span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
              Da demanda do cliente até o valor final: reagentes + equipamento +
              pessoal → custo analítico → overhead → fatores → preço.
            </p>
            <div className="mt-4 space-y-2">
              <Passo
                tom="emerald"
                numero={1}
                href="/orcamento"
                titulo="Orçamentos"
                desc="Cadastre cliente e análises solicitadas; gere o documento com a cascata de custos até o valor final."
              />
              <Passo
                tom="emerald"
                numero={2}
                href="/analises"
                titulo="Análises"
                desc="Painel técnico: capacidade, tempos, equipamentos e materiais de cada análise."
              />
              <Passo
                tom="emerald"
                numero={3}
                href="/custeio"
                titulo="Custeio por análise"
                desc="Tabela de referência: custo analítico, overhead e preço de cada análise."
              />
            </div>
          </div>
        </section>

        {/* Bloco Estoque */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-900/5 dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="h-1 bg-blue-500" />
          <div className="p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                Estoque
              </h2>
              {nAlertas > 0 ? (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                  {nAlertas} alertas
                </span>
              ) : (
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                  sem alertas
                </span>
              )}
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
              Ciclo completo: planejar análises → reservar insumos → consumir por
              FEFO → repor o que vai faltar.
            </p>
            <div className="mt-4 space-y-2">
              <Passo
                tom="blue"
                numero={1}
                href="/planejamento"
                titulo="Planejamento"
                desc="Planeje as análises, calcule a demanda de insumos e reserve o estoque."
                extra={
                  <span className="mt-0.5 block text-[11px] font-medium text-slate-400">
                    {nPlanos ?? 0} planos criados
                  </span>
                }
              />
              <Passo
                tom="blue"
                numero={2}
                href="/estoque"
                titulo="Estoque"
                desc="Saldo por reagente, lotes, validade e alertas de reposição/vencimento."
              />
              <Passo
                tom="blue"
                numero={3}
                href="/compras"
                titulo="Compras"
                desc="Sugestões do que comprar e ciclo solicitação → aprovação → recebimento."
                extra={
                  <span className="mt-0.5 block text-[11px] font-medium text-slate-400">
                    {nPedidosAbertos ?? 0} pedidos em aberto
                    {nRepor > 0 ? ` · ${nRepor} itens abaixo do ponto de reposição` : ""}
                  </span>
                }
              />
            </div>
          </div>
        </section>
      </div>

      {/* Bloco Configuração */}
      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-900/5 dark:border-zinc-800 dark:bg-zinc-900/60">
        <div className="h-1 bg-slate-300 dark:bg-slate-600" />
        <div className="p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100">
            <span className="h-2 w-2 rounded-full bg-slate-400" />
            Configuração
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
            Dados-base que alimentam os dois fluxos.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Link
              href="/parametros"
              className="rounded-lg border border-slate-200 bg-white p-3 text-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50/50 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <span className="block font-semibold text-slate-900 dark:text-slate-100">Parâmetros</span>
              <span className="block text-xs text-slate-500">
                Fatores de preço (margem, impostos, fundos) e constantes do custeio.
              </span>
            </Link>
            <Link
              href="/cadastros"
              className="rounded-lg border border-slate-200 bg-white p-3 text-sm transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <span className="block font-semibold text-slate-900 dark:text-slate-100">Cadastros</span>
              <span className="block text-xs text-slate-500">
                Equipamentos, insumos, técnicos, overhead, fornecedores.
              </span>
            </Link>
            <Link
              href="/parametros"
              className="rounded-lg border border-slate-200 bg-white p-3 text-sm transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <span className="block font-semibold text-slate-900 dark:text-slate-100">Parâmetros</span>
              <span className="block text-xs text-slate-500">
                Fatores de preço (margem, impostos, fundos) e bases de rateio.
              </span>
            </Link>
            <Link
              href="/auditoria"
              className="rounded-lg border border-slate-200 bg-white p-3 text-sm transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <span className="block font-semibold text-slate-900 dark:text-slate-100">Auditoria</span>
              <span className="block text-xs text-slate-500">
                Histórico de alterações com usuário responsável.
              </span>
            </Link>
            <Link
              href="/usuarios"
              className="rounded-lg border border-slate-200 bg-white p-3 text-sm transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <span className="block font-semibold text-slate-900 dark:text-slate-100">Usuários</span>
              <span className="block text-xs text-slate-500">
                Perfis e papéis (técnico, coordenador, gestor, admin).
              </span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
