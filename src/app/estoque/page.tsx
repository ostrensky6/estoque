import { createClient } from "@/lib/supabase/server";
import { temPapel } from "@/lib/auth/roles";
import { ReceberLoteButton } from "@/components/estoque/ReceberLote";
import { LoteAcoes } from "@/components/estoque/LoteAcoes";

export const dynamic = "force-dynamic";

const LOTE_STATUS: Record<string, { label: string; cls: string }> = {
  quarentena: { label: "Quarentena", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" },
  aceito: { label: "Aceito", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" },
  em_uso: { label: "Em uso", cls: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300" },
  bloqueado: { label: "Bloqueado", cls: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300" },
  consumido: { label: "Consumido", cls: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800" },
  descartado: { label: "Descartado", cls: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800" },
};

const fmt = (v: number | null) =>
  (v ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

type Alerta = {
  tipo: string;
  insumo_id: number;
  especificacao: string | null;
  validade: string | null;
  valor: number | null;
  referencia: number | null;
};

const ALERTA_META: Record<string, { label: string; cls: string }> = {
  reposicao: { label: "Repor", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" },
  vencimento: { label: "Vence em breve", cls: "bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300" },
  vencido: { label: "Vencido", cls: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300" },
};

export default async function EstoquePage() {
  const supabase = await createClient();
  const [{ data: saldo }, { data: alertas }, { data: lotes }] = await Promise.all([
    supabase.from("v_estoque_saldo").select("*").order("especificacao"),
    supabase.from("v_alertas_estoque").select("*"),
    supabase
      .from("lotes_estoque")
      .select("id, codigo_lote, validade, quantidade_atual, status, insumos(especificacao, unidade)")
      .not("status", "in", "(consumido,descartado)")
      .order("validade", { nullsFirst: false }),
  ]);
  const [podeAceitar, podeGerir] = await Promise.all([
    temPapel("coordenador"),
    temPapel("gestor"),
  ]);

  const al = (alertas ?? []) as Alerta[];
  const porTipo = {
    reposicao: al.filter((a) => a.tipo === "reposicao"),
    vencimento: al.filter((a) => a.tipo === "vencimento"),
    vencido: al.filter((a) => a.tipo === "vencido"),
  };

  return (
    <div className="min-h-dvh bg-transparent font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Estoque</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Saldo por reagente (em mãos · reservado · disponível) e alertas de
          reposição e vencimento. Lotes consumidos por FEFO.
        </p>

        {/* Alertas */}
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {(["reposicao", "vencimento", "vencido"] as const).map((t) => (
            <div
              key={t}
              className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-center justify-between">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ALERTA_META[t].cls}`}>
                  {ALERTA_META[t].label}
                </span>
                <span className="text-2xl font-semibold tabular-nums">{porTipo[t].length}</span>
              </div>
              <ul className="mt-2 space-y-0.5 text-xs text-zinc-500">
                {porTipo[t].slice(0, 4).map((a, i) => (
                  <li key={i} className="truncate" title={a.especificacao ?? ""}>
                    {a.especificacao}
                    {a.validade ? ` · vence ${a.validade}` : ""}
                  </li>
                ))}
                {porTipo[t].length === 0 && <li className="text-zinc-400">Nenhum</li>}
              </ul>
            </div>
          ))}
        </div>

        {/* Saldo */}
        <div className="mt-8 overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-transparent text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60">
              <tr>
                <th className="px-4 py-3 text-left">Reagente</th>
                <th className="px-4 py-3 text-left">Un.</th>
                <th className="px-4 py-3 text-right">Em mãos</th>
                <th className="px-4 py-3 text-right">Quarentena</th>
                <th className="px-4 py-3 text-right">Reservado</th>
                <th className="px-4 py-3 text-right">Disponível</th>
                <th className="px-4 py-3 text-right">Ponto repos.</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {saldo?.map((s) => {
                const repor = (s.ponto_reposicao ?? 0) > 0 && (s.disponivel ?? 0) <= (s.ponto_reposicao ?? 0);
                const semEstoque = (s.em_maos ?? 0) <= 0;
                return (
                  <tr key={s.insumo_id} className="hover:bg-transparent dark:hover:bg-zinc-800/40">
                    <td className="px-4 py-2.5 max-w-xs truncate" title={s.especificacao ?? ""}>
                      {s.especificacao}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-500">{s.unidade ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmt(s.em_maos)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-amber-600 dark:text-amber-400">
                      {(s.em_quarentena ?? 0) > 0 ? fmt(s.em_quarentena) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-zinc-500">{fmt(s.reservado)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">{fmt(s.disponivel)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-zinc-500">
                      {(s.ponto_reposicao ?? 0) > 0 ? fmt(s.ponto_reposicao) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {repor ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                          Repor
                        </span>
                      ) : semEstoque ? (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800">
                          Sem estoque
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                          OK
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <ReceberLoteButton
                        insumoId={s.insumo_id as number}
                        especificacao={s.especificacao ?? ""}
                        unidade={s.unidade}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-zinc-400">
          {saldo?.length ?? 0} reagentes · defina o ponto de reposição em
          Cadastros → Insumos para ativar os alertas.
        </p>

        {/* Lotes (rastreabilidade + estados) */}
        <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Lotes em estoque
        </h2>
        <p className="mt-1 text-xs text-zinc-400">
          Material recebido entra em <b>quarentena</b> e só fica disponível após
          aceitação. Consumo por FEFO (vence antes, sai antes).
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-transparent text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60">
              <tr>
                <th className="px-4 py-3 text-left">Reagente</th>
                <th className="px-4 py-3 text-left">Lote</th>
                <th className="px-4 py-3 text-left">Validade</th>
                <th className="px-4 py-3 text-right">Saldo</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {(lotes ?? []).map((l) => {
                const ins = l.insumos as { especificacao: string | null; unidade: string | null } | null;
                const st = LOTE_STATUS[l.status] ?? { label: l.status, cls: "bg-zinc-100" };
                const vencido = l.validade != null && new Date(l.validade) < new Date();
                return (
                  <tr key={l.id} className="hover:bg-transparent dark:hover:bg-zinc-800/40">
                    <td className="px-4 py-2.5 max-w-xs truncate" title={ins?.especificacao ?? ""}>{ins?.especificacao}</td>
                    <td className="px-4 py-2.5 text-zinc-500">{l.codigo_lote ?? "—"}</td>
                    <td className={`px-4 py-2.5 ${vencido ? "font-medium text-red-600" : "text-zinc-500"}`}>
                      {l.validade ?? "—"}{vencido ? " ⚠" : ""}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {fmt(l.quantidade_atual)} {ins?.unidade ?? ""}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <LoteAcoes
                        loteId={l.id as number}
                        status={l.status}
                        podeAceitar={podeAceitar}
                        podeGerir={podeGerir}
                      />
                    </td>
                  </tr>
                );
              })}
              {(lotes ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-400">
                    Nenhum lote em estoque. Use “+ Lote” na tabela acima para receber.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
