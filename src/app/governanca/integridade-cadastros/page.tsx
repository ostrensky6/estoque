import Link from "next/link";
import { AlertTriangle, CheckCircle2, ShieldAlert, ShieldCheck } from "lucide-react";

import { temPapel } from "@/lib/auth/roles";
import { carregarIntegridadeCadastros } from "@/lib/cadastros/integridade-loader";
import type {
  AnaliseIntegridade,
  Gravidade,
  Problema,
  StatusIntegridade,
} from "@/lib/cadastros/validar-integridade";

export const dynamic = "force-dynamic";

const STATUS_META: Record<
  StatusIntegridade,
  { label: string; classe: string; Icone: typeof CheckCircle2 }
> = {
  PRONTA: {
    label: "Pronta",
    classe: "border-leaf-200 bg-leaf-50 text-leaf-800 dark:border-leaf-900 dark:bg-leaf-950/40 dark:text-leaf-300",
    Icone: CheckCircle2,
  },
  COM_ALERTAS: {
    label: "Com alertas",
    classe: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
    Icone: AlertTriangle,
  },
  BLOQUEADA: {
    label: "Bloqueada",
    classe: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
    Icone: ShieldAlert,
  },
};

const GRAVIDADE_META: Record<Gravidade, { label: string; classe: string }> = {
  bloqueio: { label: "Bloqueio", classe: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300" },
  alerta: { label: "Alerta", classe: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" },
  info: { label: "Info", classe: "bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300" },
};

const CADASTRO_LABEL: Record<Problema["cadastro"], string> = {
  analise: "Análise",
  etapa: "Etapa",
  insumo: "Insumo",
  equipamento: "Equipamento",
  pessoal: "Pessoal",
  overhead: "Overhead",
  parametro: "Parâmetro",
};

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

function ProblemaRow({ p }: { p: Problema }) {
  const grav = GRAVIDADE_META[p.gravidade];
  return (
    <li className="flex flex-col gap-1 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${grav.classe}`}>
          {grav.label}
        </span>
        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-zinc-800 dark:text-zinc-300">
          {CADASTRO_LABEL[p.cadastro]}
        </span>
        {p.origem ? <span className="text-xs text-slate-500">{p.origem}</span> : null}
      </div>
      <p className="font-medium text-slate-800 dark:text-zinc-200">{p.mensagem}</p>
      <p className="text-xs text-slate-500 dark:text-zinc-400">→ {p.acaoRecomendada}</p>
      {p.link ? (
        <Link href={p.link} className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300">
          Abrir cadastro
        </Link>
      ) : null}
    </li>
  );
}

function AnaliseCard({ a }: { a: AnaliseIntegridade }) {
  const meta = STATUS_META[a.status];
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{a.nome ?? a.codigo}</h3>
          <p className="text-xs text-slate-500">{a.codigo}{a.ativo ? "" : " · inativa"}</p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold ${meta.classe}`}
        >
          <meta.Icone className="h-3.5 w-3.5" aria-hidden="true" />
          {meta.label}
        </span>
      </div>
      {a.problemas.length ? (
        <ul className="mt-3 space-y-2">
          {a.problemas.map((p, i) => (
            <ProblemaRow key={`${p.codigo}-${i}`} p={p} />
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-500">Sem inconsistências detectadas.</p>
      )}
    </div>
  );
}

export default async function IntegridadeCadastrosPage() {
  const permitido = await temPapel("gestor");
  if (!permitido) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center font-sans">
        <p className="text-sm text-zinc-500">
          Acesso restrito. A integridade de cadastros é visível para gestor ou admin.
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

  // ordena: bloqueadas primeiro, depois com alertas, depois prontas
  const ordem: Record<StatusIntegridade, number> = { BLOQUEADA: 0, COM_ALERTAS: 1, PRONTA: 2 };
  const analises = [...resumo.analises].sort(
    (a, b) => ordem[a.status] - ordem[b.status] || a.codigo.localeCompare(b.codigo),
  );

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
        <ResumoCard titulo="Prontas" valor={resumo.prontas} classe={STATUS_META.PRONTA.classe} Icone={CheckCircle2} />
        <ResumoCard
          titulo="Com alertas"
          valor={resumo.comAlertas}
          classe={STATUS_META.COM_ALERTAS.classe}
          Icone={AlertTriangle}
        />
        <ResumoCard
          titulo="Bloqueadas"
          valor={resumo.bloqueadas}
          classe={STATUS_META.BLOQUEADA.classe}
          Icone={ShieldAlert}
        />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        {analises.map((a) => (
          <AnaliseCard key={a.codigo} a={a} />
        ))}
      </section>
    </main>
  );
}
