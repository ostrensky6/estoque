import Link from "next/link";
import { QrCode } from "@/components/common/QrCode";
import { gerarUrlCurtaKontrol } from "@/lib/scanner/urls";
import { createClientUntyped } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SearchParams = {
  tab?: string;
  scan?: string;
};

type UnidadeEquipamento = {
  id: number;
  equipamento_id: number;
  codigo_patrimonio: string | null;
  numero_serie: string | null;
  fabricante: string | null;
  modelo: string | null;
  status_operacional: string;
  ativo: boolean;
  observacoes: string | null;
  equipamentos: { nome: string | null } | { nome: string | null }[] | null;
  locais: { nome: string | null } | { nome: string | null }[] | null;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  operacional: { label: "Operacional", cls: "bg-brand-100 text-brand-800 dark:bg-brand-950/50 dark:text-brand-300" },
  em_manutencao: { label: "Em manutencao", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" },
  calibracao_pendente: { label: "Calibracao pendente", cls: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300" },
  calibracao_vencida: { label: "Calibracao vencida", cls: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300" },
  reservado: { label: "Reservado", cls: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200" },
  inativo: { label: "Inativo", cls: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" },
  descartado: { label: "Descartado", cls: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" },
};

function asOne<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function statusMeta(status: string, ativo: boolean) {
  if (!ativo) return STATUS.inativo;
  return STATUS[status] ?? { label: status, cls: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200" };
}

export default async function EquipamentosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { scan } = await searchParams;
  const scanId = scan != null && /^\d+$/.test(scan) ? Number(scan) : null;
  const supabase = await createClientUntyped();

  const query = supabase
    .from("equipamento_unidades")
    .select("id, equipamento_id, codigo_patrimonio, numero_serie, fabricante, modelo, status_operacional, ativo, observacoes, equipamentos(nome), locais(nome)")
    .order("id", { ascending: true });

  const { data } = scanId ? await query.eq("id", scanId) : await query;
  const unidades = (data ?? []) as unknown as UnidadeEquipamento[];

  return (
    <div className="min-h-dvh bg-transparent font-sans text-slate-900 dark:text-slate-100">
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Estoque · Patrimonio fisico
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              Equipamentos físicos
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-zinc-500">
              Lista mínima de unidades patrimoniais cadastradas. Esta página é somente leitura e serve de base para identificação patrimonial futura.
            </p>
          </div>
          <Link
            href="/cadastros/equipamentos"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900"
          >
            Cadastro de tipos
          </Link>
        </div>

        {scanId && (
          <div className="mt-5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200">
            Exibindo unidade escaneada #{scanId}. Esta visualização não altera status, manutenção, calibração ou operação.
            <Link href="/estoque/equipamentos?tab=unidades" className="ml-2 font-medium underline">
              Ver todas
            </Link>
          </div>
        )}

        <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-transparent text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-4 py-3 text-left">ID</th>
                <th className="px-4 py-3 text-left">Equipamento/tipo</th>
                <th className="px-4 py-3 text-left">Patrimônio</th>
                <th className="px-4 py-3 text-left">Série</th>
                <th className="px-4 py-3 text-left">Fabricante/modelo</th>
                <th className="px-4 py-3 text-left">Local</th>
                <th className="px-4 py-3 text-left">Situação</th>
                <th className="px-4 py-3 text-left">QR interno</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {unidades.map((unidade) => {
                const equipamento = asOne(unidade.equipamentos);
                const local = asOne(unidade.locais);
                const meta = statusMeta(unidade.status_operacional, unidade.ativo);
                const destacado = scanId === unidade.id;
                const urlCurta = gerarUrlCurtaKontrol("equipamento_unidade", unidade.id);

                return (
                  <tr
                    key={unidade.id}
                    className={destacado ? "bg-blue-50/70 dark:bg-blue-950/20" : ""}
                  >
                    <td className="px-4 py-3 font-mono text-xs">#{unidade.id}</td>
                    <td className="px-4 py-3 font-medium">
                      {equipamento?.nome ?? `Equipamento #${unidade.equipamento_id}`}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {unidade.codigo_patrimonio ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {unidade.numero_serie ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {[unidade.fabricante, unidade.modelo].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {local?.nome ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.cls}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="inline-grid max-w-48 gap-2 rounded-md border border-zinc-200 bg-white p-2 text-xs shadow-sm dark:border-zinc-700 dark:bg-zinc-950">
                        <QrCode
                          value={urlCurta}
                          label={`QR da unidade ${unidade.id}`}
                          size={84}
                          className="rounded bg-white"
                        />
                        <div className="space-y-0.5">
                          <p className="font-medium text-zinc-900 dark:text-zinc-100">
                            ID Kontrol #{unidade.id}
                          </p>
                          <p className="truncate text-zinc-500" title={equipamento?.nome ?? undefined}>
                            {equipamento?.nome ?? `Equipamento #${unidade.equipamento_id}`}
                          </p>
                          <p className="font-mono text-[11px] text-zinc-500">
                            {unidade.codigo_patrimonio ?? "Sem patrimonio"}
                          </p>
                          {unidade.numero_serie && (
                            <p className="font-mono text-[11px] text-zinc-500">
                              Série {unidade.numero_serie}
                            </p>
                          )}
                          <p className="break-all font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                            {urlCurta}
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {unidades.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-zinc-400">
                    {scanId ? `Nenhuma unidade encontrada para #${scanId}.` : "Nenhuma unidade patrimonial cadastrada."}
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
