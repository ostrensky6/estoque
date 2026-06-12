import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function Passo({
  numero,
  href,
  titulo,
  desc,
  extra,
}: {
  numero: number;
  href: string;
  titulo: string;
  desc: string;
  extra?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-lg border border-zinc-200 bg-white p-3 transition-colors hover:border-emerald-300 hover:bg-emerald-50/40 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-800"
    >
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600 group-hover:bg-emerald-100 group-hover:text-emerald-800 dark:bg-zinc-800 dark:text-zinc-300">
        {numero}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{titulo}</span>
        <span className="block text-xs text-zinc-500">{desc}</span>
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
    <main className="mx-auto max-w-5xl px-6 py-10 font-sans text-zinc-900 dark:text-zinc-100">
      <h1 className="text-2xl font-semibold tracking-tight">
        Lab Custos &amp; Estoque
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        Dois fluxos independentes: <b>Orçamento</b> (da demanda do cliente ao
        preço final) e <b>Estoque</b> (do planejamento à reposição).
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Bloco Orçamento */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-semibold">Orçamento</h2>
            <span className="text-xs text-zinc-400">
              {nAnalises ?? 0} análises ativas
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Da demanda do cliente até o valor final: reagentes + equipamento +
            pessoal → custo analítico → overhead → fatores → preço.
          </p>
          <div className="mt-4 space-y-2">
            <Passo
              numero={1}
              href="/orcamento"
              titulo="Orçamentos"
              desc="Cadastre cliente e análises solicitadas; gere o documento com a cascata de custos até o valor final."
            />
            <Passo
              numero={2}
              href="/analises"
              titulo="Análises"
              desc="Painel técnico: capacidade, tempos, equipamentos e materiais de cada análise."
            />
            <Passo
              numero={3}
              href="/custeio"
              titulo="Custeio por análise"
              desc="Tabela de referência: custo analítico, overhead e preço de cada análise."
            />
          </div>
        </section>

        {/* Bloco Estoque */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-semibold">Estoque</h2>
            {nAlertas > 0 ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                {nAlertas} alertas
              </span>
            ) : (
              <span className="text-xs text-zinc-400">sem alertas</span>
            )}
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Ciclo completo: planejar análises → reservar insumos → consumir por
            FEFO → repor o que vai faltar.
          </p>
          <div className="mt-4 space-y-2">
            <Passo
              numero={1}
              href="/planejamento"
              titulo="Planejamento"
              desc="Planeje as análises, calcule a demanda de insumos e reserve o estoque."
              extra={
                <span className="mt-0.5 block text-[11px] text-zinc-400">
                  {nPlanos ?? 0} planos criados
                </span>
              }
            />
            <Passo
              numero={2}
              href="/estoque"
              titulo="Estoque"
              desc="Saldo por reagente, lotes, validade e alertas de reposição/vencimento."
            />
            <Passo
              numero={3}
              href="/compras"
              titulo="Compras"
              desc="Sugestões do que comprar e ciclo solicitação → aprovação → recebimento."
              extra={
                <span className="mt-0.5 block text-[11px] text-zinc-400">
                  {nPedidosAbertos ?? 0} pedidos em aberto
                  {nRepor > 0 ? ` · ${nRepor} itens abaixo do ponto de reposição` : ""}
                </span>
              }
            />
          </div>
        </section>
      </div>

      {/* Bloco Configuração */}
      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
        <h2 className="text-base font-semibold">Configuração</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Dados-base que alimentam os dois fluxos.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/cadastros"
            className="rounded-lg border border-zinc-200 bg-white p-3 text-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50/40 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-800"
          >
            <span className="block font-medium">Cadastros</span>
            <span className="block text-xs text-zinc-500">
              Equipamentos, insumos, técnicos, overhead, fornecedores.
            </span>
          </Link>
          <Link
            href="/auditoria"
            className="rounded-lg border border-zinc-200 bg-white p-3 text-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50/40 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-800"
          >
            <span className="block font-medium">Auditoria</span>
            <span className="block text-xs text-zinc-500">
              Histórico de alterações com usuário responsável.
            </span>
          </Link>
          <Link
            href="/usuarios"
            className="rounded-lg border border-zinc-200 bg-white p-3 text-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50/40 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-800"
          >
            <span className="block font-medium">Usuários</span>
            <span className="block text-xs text-zinc-500">
              Perfis e papéis (técnico, coordenador, gestor, admin).
            </span>
          </Link>
        </div>
      </section>
    </main>
  );
}
