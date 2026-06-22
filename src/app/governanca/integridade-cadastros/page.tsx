import Link from "next/link";
import { AlertTriangle, CheckCircle2, ShieldAlert, ShieldCheck } from "lucide-react";

import { temPermissaoIntegridade } from "@/lib/cadastros/permissoes";
import { carregarIntegridadeCadastros } from "@/lib/cadastros/integridade-loader";
import { IntegridadeView } from "./IntegridadeView";

export const dynamic = "force-dynamic";

function ResumoCard({
  titulo,
  valor,
  classe,
  Icone,
}: {
  titulo: string;
  valor: number;
  classe: string;
  Icone: typeof CheckCircle2;
}) {
  return (
    <div className={`rounded-lg border p-4 shadow-sm ${classe}`}>
      <div className="flex items-center gap-2">
        <Icone className="h-5 w-5" aria-hidden="true" />
        <span className="text-xs font-semibold uppercase tracking-wide">{titulo}</span>
      </div>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{valor}</p>
    </div>
  );
}

export default async function IntegridadeCadastrosPage() {
  const permitido = await temPermissaoIntegridade("cadastros.integridade.visualizar");
  if (!permitido) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center font-sans">
        <p className="text-sm text-zinc-500">
          Acesso restrito. A integridade de cadastros é visível para coordenador, gestor ou admin.
        </p>
        <Link
          href="/"
          className="mt-4 inline-flex rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Voltar
        </Link>
      </main>
    );
  }

  const resumo = await carregarIntegridadeCadastros();

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 font-sans text-slate-900 dark:text-slate-100 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Integridade dos cadastros</h1>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
            Auditoria automática da cadeia que alimenta o custeio. Análises bloqueadas têm
            condição que geraria custo técnico incorreto e não devem ser usadas em novos
            orçamentos sem correção (ou override administrativo justificado).
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Governança
        </span>
      </div>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ResumoCard
          titulo="Total"
          valor={resumo.total}
          classe="border-slate-200 bg-white text-slate-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
          Icone={ShieldCheck}
        />
        <ResumoCard
          titulo="Prontas"
          valor={resumo.prontas}
          classe="border-leaf-200 bg-leaf-50 text-leaf-800 dark:border-leaf-900 dark:bg-leaf-950/40 dark:text-leaf-300"
          Icone={CheckCircle2}
        />
        <ResumoCard
          titulo="Com alertas"
          valor={resumo.comAlertas}
          classe="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
          Icone={AlertTriangle}
        />
        <ResumoCard
          titulo="Bloqueadas"
          valor={resumo.bloqueadas}
          classe="border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
          Icone={ShieldAlert}
        />
      </section>

      <IntegridadeView analises={resumo.analises} />
    </main>
  );
}
