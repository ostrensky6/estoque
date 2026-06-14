import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Barcode39 } from "@/components/common/Barcode39";
import { formatNumber as fmt, formatDate as fdata, formatCurrency } from "@/lib/formatters";

export const dynamic = "force-dynamic";

const LOTE_STATUS: Record<string, { label: string; cls: string }> = {
  quarentena: { label: "Quarentena", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" },
  aceito: { label: "Aceito", cls: "bg-brand-100 text-brand-800 dark:bg-brand-950/50 dark:text-brand-300" },
  em_uso: { label: "Em uso", cls: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300" },
  consumido: { label: "Consumido", cls: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800" },
  bloqueado: { label: "Bloqueado", cls: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300" },
  descartado: { label: "Descartado", cls: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800" },
};

const TIPO_MOV: Record<string, { label: string; cls: string }> = {
  entrada: { label: "Entrada", cls: "text-brand-700 dark:text-brand-400" },
  saida: { label: "Saída", cls: "text-red-700 dark:text-red-400" },
  ajuste: { label: "Ajuste", cls: "text-amber-700 dark:text-amber-400" },
};

function Campo({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[11px] uppercase tracking-wide text-zinc-400">{rotulo}</dt>
      <dd className="text-sm text-zinc-800 dark:text-zinc-100">{valor}</dd>
    </div>
  );
}

export default async function LoteDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id: idRaw } = await params;
  const id = Number(idRaw);
  if (!Number.isFinite(id)) notFound();
  const supabase = await createClient();

  const { data: lote } = await supabase
    .from("lotes_estoque")
    .select("*, insumos(especificacao, nome_item, unidade)")
    .eq("id", id)
    .single();
  if (!lote) notFound();

  const [{ data: movs }, { data: local }] = await Promise.all([
    supabase
      .from("estoque_movimentacoes")
      .select("id, tipo, quantidade, custo_unitario, data, motivo, referencia")
      .eq("lote_id", id)
      .order("data", { ascending: false })
      .order("id", { ascending: false }),
    lote.local_id != null
      ? supabase.from("locais").select("nome").eq("id", lote.local_id).single()
      : Promise.resolve({ data: null }),
  ]);

  const ins = lote.insumos as { especificacao: string | null; nome_item: string | null; unidade: string | null } | null;
  const unidade = ins?.unidade ?? "";
  const s = LOTE_STATUS[lote.status] ?? { label: lote.status, cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800" };
  const vencido = lote.validade != null && new Date(lote.validade) < new Date();

  // Rastreabilidade reversa: planos que consumiram este lote (referencia 'plano N')
  const planosConsumo = Array.from(
    new Set(
      (movs ?? [])
        .filter((m) => m.tipo === "saida" && /plano\s+\d+/i.test(m.referencia ?? ""))
        .map((m) => (m.referencia ?? "").match(/plano\s+(\d+)/i)?.[1])
        .filter((x): x is string => Boolean(x)),
    ),
  );

  const codigoEtiqueta = lote.codigo_lote || `LOTE-${lote.id}`;

  return (
    <div className="min-h-dvh bg-transparent font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto max-w-4xl px-6 py-10">
        <Link href="/estoque" className="no-print text-xs text-zinc-500 hover:underline">← Estoque</Link>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">Lote {codigoEtiqueta}</h1>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>{s.label}</span>
              {vencido && (
                <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-950/50 dark:text-red-300">
                  Vencido
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-zinc-500">{ins?.especificacao ?? ins?.nome_item ?? "—"}</p>
          </div>
        </div>

        {/* Etiqueta imprimível com código de barras */}
        <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-400">Etiqueta do lote</p>
              <p className="mt-1 text-sm font-medium">{ins?.especificacao ?? ins?.nome_item ?? "—"}</p>
              <p className="text-xs text-zinc-500">
                Validade: {fdata(lote.validade)} · Saldo: {fmt(lote.quantidade_atual)} {unidade}
              </p>
            </div>
            <div className="text-center">
              <Barcode39 value={codigoEtiqueta} height={52} />
              <p className="mt-0.5 font-mono text-xs tracking-widest text-zinc-700 dark:text-zinc-300">{codigoEtiqueta}</p>
            </div>
          </div>
        </section>

        {/* Dados do lote (inclui validade dupla) */}
        <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-zinc-500">Dados do lote</h2>
        <dl className="mt-3 grid grid-cols-2 gap-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:grid-cols-3 dark:border-zinc-800 dark:bg-zinc-900">
          <Campo rotulo="Validade (fabricante)" valor={<span className={vencido ? "font-medium text-red-600" : ""}>{fdata(lote.validade)}</span>} />
          <Campo rotulo="Data de abertura" valor={fdata(lote.data_abertura)} />
          <Campo rotulo="Validade após abertura" valor={fdata(lote.validade_apos_abertura)} />
          <Campo rotulo="Entrada" valor={fdata(lote.data_entrada)} />
          <Campo rotulo="Fornecedor" valor={lote.fornecedor ?? "—"} />
          <Campo rotulo="Nota fiscal" valor={lote.nota_fiscal ?? "—"} />
          <Campo rotulo="Local" valor={local?.nome ?? "—"} />
          <Campo rotulo="Qtd. inicial" valor={`${fmt(lote.quantidade_inicial)} ${unidade}`} />
          <Campo rotulo="Saldo atual" valor={`${fmt(lote.quantidade_atual)} ${unidade}`} />
          <Campo rotulo="Custo unitário" valor={lote.custo_unitario != null ? formatCurrency(lote.custo_unitario) : "—"} />
          <Campo rotulo="Resp. recebimento" valor={lote.responsavel_recebimento ?? "—"} />
          <Campo rotulo="Resp. liberação" valor={lote.responsavel_liberacao ?? "—"} />
          {lote.criterio_aceitacao && <Campo rotulo="Critério de aceitação" valor={lote.criterio_aceitacao} />}
          {lote.motivo_bloqueio && <Campo rotulo="Motivo do bloqueio" valor={lote.motivo_bloqueio} />}
        </dl>

        {/* Rastreabilidade reversa */}
        <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Rastreabilidade reversa
        </h2>
        <div className="mt-3 rounded-lg border border-zinc-200 bg-white p-4 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {planosConsumo.length === 0 ? (
            <p className="text-zinc-400">Este lote ainda não foi consumido por nenhum plano.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-zinc-500">Consumido pelos planos:</span>
              {planosConsumo.map((p) => (
                <Link
                  key={p}
                  href={`/planejamento/${p}`}
                  className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 hover:underline dark:bg-brand-950/30 dark:text-brand-300"
                >
                  Plano {p}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Histórico de movimentações */}
        <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-zinc-500">Histórico</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <table className="min-w-full text-sm">
            <thead className="border-b border-zinc-100 dark:border-zinc-800">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Data</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Tipo</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Qtd.</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Motivo</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Referência</th>
              </tr>
            </thead>
            <tbody>
              {(movs ?? []).map((m) => {
                const t = TIPO_MOV[m.tipo] ?? { label: m.tipo, cls: "" };
                return (
                  <tr key={m.id} className="border-b border-zinc-50 last:border-b-0 dark:border-zinc-800/50">
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300">{fdata(m.data)}</td>
                    <td className={`px-3 py-2 font-medium ${t.cls}`}>{t.label}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(m.quantidade)} {unidade}</td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300">{m.motivo ?? "—"}</td>
                    <td className="px-3 py-2 text-zinc-500">{m.referencia ?? "—"}</td>
                  </tr>
                );
              })}
              {(movs ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-zinc-400">Sem movimentações.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
