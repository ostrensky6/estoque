"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";

import type {
  AnaliseIntegridade,
  Gravidade,
  Problema,
  StatusIntegridade,
} from "@/lib/cadastros/validar-integridade";

const STATUS_META: Record<
  StatusIntegridade,
  { label: string; classe: string; Icone: typeof CheckCircle2 }
> = {
  PRONTA: {
    label: "Pronta",
    classe:
      "border-leaf-200 bg-leaf-50 text-leaf-800 dark:border-leaf-900 dark:bg-leaf-950/40 dark:text-leaf-300",
    Icone: CheckCircle2,
  },
  COM_ALERTAS: {
    label: "Com alertas",
    classe:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
    Icone: AlertTriangle,
  },
  BLOQUEADA: {
    label: "Bloqueada",
    classe:
      "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
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

type FiltroStatus = "TODAS" | StatusIntegridade;

const ORDEM_STATUS: Record<StatusIntegridade, number> = { BLOQUEADA: 0, COM_ALERTAS: 1, PRONTA: 2 };

function ProblemaRow({ p }: { p: Problema }) {
  const grav = GRAVIDADE_META[p.gravidade];
  return (
    <li className="flex flex-col gap-1 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${grav.classe}`}>{grav.label}</span>
        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-zinc-800 dark:text-zinc-300">
          {CADASTRO_LABEL[p.cadastro]}
        </span>
        {p.campo ? (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600 dark:bg-zinc-900 dark:text-zinc-400">
            {p.campo}
            {p.valorAtual ? `: ${p.valorAtual}` : ""}
          </span>
        ) : null}
        {p.origem ? <span className="text-xs text-slate-500">{p.origem}</span> : null}
      </div>
      <p className="font-medium text-slate-800 dark:text-zinc-200">{p.mensagem}</p>
      <p className="text-xs text-slate-500 dark:text-zinc-400">→ {p.acaoRecomendada}</p>
      {p.link ? (
        <Link href={p.link} className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300">
          Corrigir cadastro
        </Link>
      ) : null}
    </li>
  );
}

function AnaliseCard({ a, problemas }: { a: AnaliseIntegridade; problemas: Problema[] }) {
  const meta = STATUS_META[a.status];
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{a.nome ?? a.codigo}</h3>
          <p className="text-xs text-slate-500">
            {a.codigo}
            {a.ativo ? "" : " · inativa"}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold ${meta.classe}`}>
          <meta.Icone className="h-3.5 w-3.5" aria-hidden="true" />
          {meta.label}
        </span>
      </div>
      {problemas.length ? (
        <ul className="mt-3 space-y-2">
          {problemas.map((p, i) => (
            <ProblemaRow key={`${p.codigo}-${i}`} p={p} />
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-500">Sem inconsistências detectadas.</p>
      )}
    </div>
  );
}

export function IntegridadeView({ analises }: { analises: AnaliseIntegridade[] }) {
  const [status, setStatus] = useState<FiltroStatus>("TODAS");
  const [cadastro, setCadastro] = useState<string>("");
  const [tipo, setTipo] = useState<string>("");

  // opções de filtro derivadas dos dados reais
  const { cadastros, tipos } = useMemo(() => {
    const cads = new Set<string>();
    const tps = new Set<string>();
    for (const a of analises) {
      for (const p of a.problemas) {
        cads.add(p.cadastro);
        tps.add(p.codigo);
      }
    }
    return { cadastros: [...cads].sort(), tipos: [...tps].sort() };
  }, [analises]);

  const visiveis = useMemo(() => {
    return analises
      .filter((a) => (status === "TODAS" ? true : a.status === status))
      .map((a) => {
        const problemas = a.problemas.filter(
          (p) => (!cadastro || p.cadastro === cadastro) && (!tipo || p.codigo === tipo),
        );
        return { a, problemas };
      })
      // quando há filtro de cadastro/tipo, só mostra análises com problema correspondente
      .filter(({ problemas, a }) => {
        if (!cadastro && !tipo) return true;
        return problemas.length > 0 || a.problemas.length === 0;
      })
      .sort(
        (x, y) =>
          ORDEM_STATUS[x.a.status] - ORDEM_STATUS[y.a.status] ||
          x.a.codigo.localeCompare(y.a.codigo),
      );
  }, [analises, status, cadastro, tipo]);

  const btn = (ativo: boolean) =>
    `rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
      ativo
        ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300"
        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
    }`;

  return (
    <>
      <section className="mt-6 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {(["TODAS", "PRONTA", "COM_ALERTAS", "BLOQUEADA"] as FiltroStatus[]).map((s) => (
            <button key={s} type="button" onClick={() => setStatus(s)} className={btn(status === s)}>
              {s === "TODAS" ? "Todas" : STATUS_META[s].label}
            </button>
          ))}
        </div>
        <select
          aria-label="Cadastro de origem"
          value={cadastro}
          onChange={(e) => setCadastro(e.target.value)}
          className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-zinc-800 dark:bg-zinc-900"
        >
          <option value="">Todos os cadastros</option>
          {cadastros.map((c) => (
            <option key={c} value={c}>
              {CADASTRO_LABEL[c as Problema["cadastro"]] ?? c}
            </option>
          ))}
        </select>
        <select
          aria-label="Tipo de problema"
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-zinc-800 dark:bg-zinc-900"
        >
          <option value="">Todos os tipos</option>
          {tipos.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <span className="ml-auto text-xs text-slate-500">{visiveis.length} análise(s)</span>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        {visiveis.map(({ a, problemas }) => (
          <AnaliseCard key={a.codigo} a={a} problemas={problemas} />
        ))}
        {visiveis.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma análise para os filtros selecionados.</p>
        ) : null}
      </section>
    </>
  );
}
