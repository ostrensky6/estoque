import Link from "next/link";
import { QrCode } from "@/components/common/QrCode";
import { gerarUrlCurtaKontrol } from "@/lib/scanner/urls";
import { createClientUntyped } from "@/lib/supabase/server";
import { formatDate, formatNumber as fmt } from "@/lib/formatters";

export const dynamic = "force-dynamic";

type SearchParams = {
  tipo?: string;
  id?: string;
};

type LoteEtiqueta = {
  id: number;
  codigo_lote: string | null;
  validade: string | null;
  quantidade_atual: number | null;
  status: string | null;
  insumos: { especificacao: string | null; unidade: string | null } | { especificacao: string | null; unidade: string | null }[] | null;
};

type EquipamentoUnidadeEtiqueta = {
  id: number;
  codigo_patrimonio: string | null;
  numero_serie: string | null;
  equipamento_id: number;
  equipamentos: { nome: string | null } | { nome: string | null }[] | null;
};

function asOne<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function idFiltro(value: string | undefined) {
  if (!value || !/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function filtroTipo(value: string | undefined): "todos" | "lotes" | "equipamentos" {
  if (value === "lotes" || value === "equipamentos") return value;
  return "todos";
}

function LabelShell({ children }: { children: React.ReactNode }) {
  return (
    <article className="break-inside-avoid rounded-md border border-zinc-300 bg-white p-3 text-zinc-950 shadow-sm print:border-zinc-900 print:shadow-none">
      {children}
    </article>
  );
}

export default async function EtiquetasPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const tipo = filtroTipo(params.tipo);
  const id = idFiltro(params.id);
  const supabase = await createClientUntyped();

  const carregarLotes = tipo === "todos" || tipo === "lotes";
  const carregarEquipamentos = tipo === "todos" || tipo === "equipamentos";

  const [{ data: lotesData }, { data: equipamentosData }] = await Promise.all([
    carregarLotes
      ? supabase
          .from("lotes_estoque")
          .select("id, codigo_lote, validade, quantidade_atual, status, insumos(especificacao, unidade)")
          .neq("status", "consumido")
          .order("id", { ascending: true })
      : Promise.resolve({ data: [] }),
    carregarEquipamentos
      ? supabase
          .from("equipamento_unidades")
          .select("id, codigo_patrimonio, numero_serie, equipamento_id, equipamentos(nome)")
          .order("id", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  const lotes = ((lotesData ?? []) as unknown as LoteEtiqueta[])
    .filter((lote) => tipo !== "lotes" || id == null || lote.id === id);
  const equipamentos = ((equipamentosData ?? []) as unknown as EquipamentoUnidadeEtiqueta[])
    .filter((unidade) => tipo !== "equipamentos" || id == null || unidade.id === id);
  const total = lotes.length + equipamentos.length;

  return (
    <div className="min-h-dvh bg-transparent font-sans text-zinc-900 dark:text-zinc-100">
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .label-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10mm; }
          @page { size: A4; margin: 12mm; }
        }
      `}</style>
      <main className="mx-auto max-w-7xl px-6 py-10 print:max-w-none print:px-0 print:py-0">
        <div className="no-print flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Estoque · Identificação interna
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              Etiquetas internas
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-zinc-500">
              Impressão simples de QR interno para lotes e unidades patrimoniais. Esta página é somente leitura.
            </p>
          </div>
          <span className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900">
            Use Ctrl+P para imprimir
          </span>
        </div>

        <div className="no-print mt-6 flex flex-wrap gap-2 text-sm">
          <Link href="/etiquetas" className={`rounded-md border px-3 py-1.5 ${tipo === "todos" ? "border-brand-400 bg-brand-50 text-brand-700" : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"}`}>
            Todas
          </Link>
          <Link href="/etiquetas?tipo=lotes" className={`rounded-md border px-3 py-1.5 ${tipo === "lotes" ? "border-brand-400 bg-brand-50 text-brand-700" : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"}`}>
            Lotes
          </Link>
          <Link href="/etiquetas?tipo=equipamentos" className={`rounded-md border px-3 py-1.5 ${tipo === "equipamentos" ? "border-brand-400 bg-brand-50 text-brand-700" : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"}`}>
            Equipamentos
          </Link>
          <span className="rounded-md bg-zinc-100 px-3 py-1.5 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {total} etiqueta(s)
          </span>
        </div>

        <section className="label-grid mt-6 grid gap-4 md:grid-cols-2 print:mt-0">
          {lotes.map((lote) => {
            const insumo = asOne(lote.insumos);
            const url = gerarUrlCurtaKontrol("lote", lote.id);
            return (
              <LabelShell key={`lote-${lote.id}`}>
                <div className="flex gap-3">
                  <QrCode value={url} label={`QR do lote ${lote.id}`} size={112} className="shrink-0 rounded bg-white" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Lote</p>
                    <h2 className="mt-1 truncate text-base font-semibold" title={insumo?.especificacao ?? undefined}>
                      {insumo?.especificacao ?? `Lote #${lote.id}`}
                    </h2>
                    <dl className="mt-2 grid gap-1 text-xs">
                      <div><dt className="inline text-zinc-500">ID Kontrol: </dt><dd className="inline font-medium">#{lote.id}</dd></div>
                      <div><dt className="inline text-zinc-500">Lote: </dt><dd className="inline font-mono">{lote.codigo_lote ?? "—"}</dd></div>
                      <div><dt className="inline text-zinc-500">Validade: </dt><dd className="inline">{formatDate(lote.validade)}</dd></div>
                      <div><dt className="inline text-zinc-500">Saldo: </dt><dd className="inline">{fmt(lote.quantidade_atual)} {insumo?.unidade ?? ""}</dd></div>
                    </dl>
                    <p className="mt-2 break-all font-mono text-[11px] text-zinc-600">{url}</p>
                    <Link href={`/etiquetas?tipo=lotes&id=${lote.id}`} className="no-print mt-2 inline-block text-xs font-medium text-brand-700 hover:underline">
                      Imprimir somente esta
                    </Link>
                  </div>
                </div>
              </LabelShell>
            );
          })}

          {equipamentos.map((unidade) => {
            const equipamento = asOne(unidade.equipamentos);
            const url = gerarUrlCurtaKontrol("equipamento_unidade", unidade.id);
            return (
              <LabelShell key={`equipamento-${unidade.id}`}>
                <div className="flex gap-3">
                  <QrCode value={url} label={`QR da unidade ${unidade.id}`} size={112} className="shrink-0 rounded bg-white" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Equipamento</p>
                    <h2 className="mt-1 truncate text-base font-semibold" title={equipamento?.nome ?? undefined}>
                      {equipamento?.nome ?? `Equipamento #${unidade.equipamento_id}`}
                    </h2>
                    <dl className="mt-2 grid gap-1 text-xs">
                      <div><dt className="inline text-zinc-500">ID Kontrol: </dt><dd className="inline font-medium">#{unidade.id}</dd></div>
                      <div><dt className="inline text-zinc-500">Patrimônio: </dt><dd className="inline font-mono">{unidade.codigo_patrimonio ?? "—"}</dd></div>
                      <div><dt className="inline text-zinc-500">Série: </dt><dd className="inline font-mono">{unidade.numero_serie ?? "—"}</dd></div>
                    </dl>
                    <p className="mt-2 break-all font-mono text-[11px] text-zinc-600">{url}</p>
                    <Link href={`/etiquetas?tipo=equipamentos&id=${unidade.id}`} className="no-print mt-2 inline-block text-xs font-medium text-brand-700 hover:underline">
                      Imprimir somente esta
                    </Link>
                  </div>
                </div>
              </LabelShell>
            );
          })}

          {total === 0 && (
            <div className="rounded-md border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
              Nenhuma etiqueta encontrada para o filtro atual.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
