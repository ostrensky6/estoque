import { createClientUntyped } from "@/lib/supabase/server";
import { temPapel } from "@/lib/auth/roles";
import { criarCicloInventario } from "@/lib/actions/inventario";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import {
  InventarioScannerPanel,
  type InventarioCicloOpcao,
  type InventarioLocalOpcao,
  type InventarioLoteOpcao,
} from "@/components/estoque/InventarioScannerPanel";
import { InventarioAjusteButton } from "@/components/estoque/InventarioAjusteButton";

export const dynamic = "force-dynamic";

type ContagemRow = {
  id: number;
  ciclo_id: number;
  lote_id: number;
  quantidade_sistema: number;
  quantidade_contada: number;
  divergencia: number;
  justificativa: string | null;
  ajuste_aplicado: boolean;
  contado_em: string;
  inventario_ciclos: { nome: string | null } | null;
  locais: { nome: string | null } | null;
  lotes_estoque: {
    codigo_lote: string | null;
    insumos: { especificacao: string | null; unidade: string | null } | null;
  } | null;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export default async function InventarioPage() {
  const supabase = await createClientUntyped();
  const podeCriar = await temPapel("coordenador");
  const podeAjustar = await temPapel("gestor");

  const [{ data: ciclos }, { data: locais }, { data: lotes }, { data: contagens }] = await Promise.all([
    supabase
      .from("inventario_ciclos")
      .select("id, nome")
      .eq("status", "aberto")
      .order("criado_em", { ascending: false }),
    supabase.from("locais").select("id, nome").order("nome"),
    supabase
      .from("lotes_estoque")
      .select("id, codigo_lote, quantidade_atual, local_id, locais(nome), insumos(especificacao, unidade)")
      .not("status", "in", "(consumido,descartado)")
      .order("id", { ascending: false }),
    supabase
      .from("inventario_contagens")
      .select("id, ciclo_id, lote_id, quantidade_sistema, quantidade_contada, divergencia, justificativa, ajuste_aplicado, contado_em, inventario_ciclos(nome), locais(nome), lotes_estoque(codigo_lote, insumos(especificacao, unidade))")
      .order("contado_em", { ascending: false })
      .limit(25),
  ]);

  const ciclosOpcoes: InventarioCicloOpcao[] = (ciclos ?? []).map((ciclo) => ({
    id: Number(ciclo.id),
    nome: ciclo.nome ? String(ciclo.nome) : `Inventário #${ciclo.id}`,
  }));
  const locaisOpcoes: InventarioLocalOpcao[] = (locais ?? []).map((local) => ({
    id: Number(local.id),
    nome: local.nome ? String(local.nome) : `Local #${local.id}`,
  }));
  const lotesOpcoes: InventarioLoteOpcao[] = (lotes ?? []).map((lote) => {
    const localRaw = lote.locais as { nome: string | null } | { nome: string | null }[] | null;
    const local = Array.isArray(localRaw) ? (localRaw[0] ?? null) : localRaw;
    const insumoRaw = lote.insumos as
      | { especificacao: string | null; unidade: string | null }
      | { especificacao: string | null; unidade: string | null }[]
      | null;
    const insumo = Array.isArray(insumoRaw) ? (insumoRaw[0] ?? null) : insumoRaw;

    return {
      id: Number(lote.id),
      codigoLote: lote.codigo_lote ? String(lote.codigo_lote) : null,
      quantidadeAtual: Number(lote.quantidade_atual ?? 0),
      localId: lote.local_id == null ? null : Number(lote.local_id),
      localNome: local?.nome ?? null,
      insumoDescricao: insumo?.especificacao ?? null,
      unidade: insumo?.unidade ?? null,
    };
  });

  async function criarCiclo(formData: FormData) {
    "use server";
    await criarCicloInventario({ ok: false }, formData);
  }

  return (
    <div className="min-h-dvh bg-transparent font-sans text-foreground">
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <Breadcrumbs items={[{ label: "Estoque", href: "/estoque" }, { label: "Inventário" }]} />
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Inventário cíclico</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Abra uma campanha, escaneie local e lote, registre a quantidade contada e aplique ajuste
              somente depois de justificar divergências.
            </p>
          </div>
          {podeCriar && (
            <form action={criarCiclo} className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-card p-3 shadow-sm">
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Campanha</label>
                <input
                  name="nome"
                  placeholder="Inventário semanal"
                  className="mt-1 rounded-md border border-input bg-card px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Local</label>
                <select
                  name="local_id"
                  defaultValue=""
                  className="mt-1 rounded-md border border-input bg-card px-3 py-2 text-sm"
                >
                  <option value="">Todos</option>
                  {locaisOpcoes.map((local) => (
                    <option key={local.id} value={local.id}>
                      {local.nome}
                    </option>
                  ))}
                </select>
              </div>
              <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                Criar
              </button>
            </form>
          )}
        </div>

        <div className="mt-8">
          <InventarioScannerPanel ciclos={ciclosOpcoes} locais={locaisOpcoes} lotes={lotesOpcoes} />
        </div>

        <section className="mt-8 rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Contagens recentes</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Campanha</th>
                  <th className="px-4 py-3 text-left">Lote</th>
                  <th className="px-4 py-3 text-left">Local</th>
                  <th className="px-4 py-3 text-right">Sistema</th>
                  <th className="px-4 py-3 text-right">Contado</th>
                  <th className="px-4 py-3 text-right">Dif.</th>
                  <th className="px-4 py-3 text-left">Justificativa</th>
                  <th className="px-4 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {((contagens ?? []) as unknown as ContagemRow[]).map((contagem) => {
                  const ciclo = firstRelation(contagem.inventario_ciclos);
                  const local = firstRelation(contagem.locais);
                  const lote = firstRelation(contagem.lotes_estoque);
                  const insumo = firstRelation(lote?.insumos);
                  const divergente = Math.abs(Number(contagem.divergencia ?? 0)) > 0.000001;
                  return (
                    <tr key={contagem.id}>
                      <td className="px-4 py-3">{ciclo?.nome ?? `#${contagem.ciclo_id}`}</td>
                      <td className="max-w-xs truncate px-4 py-3" title={insumo?.especificacao ?? ""}>
                        #{contagem.lote_id}
                        {lote?.codigo_lote ? ` · ${lote.codigo_lote}` : ""}
                        {insumo?.especificacao ? ` · ${insumo.especificacao}` : ""}
                      </td>
                      <td className="px-4 py-3">{local?.nome ?? "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{Number(contagem.quantidade_sistema)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{Number(contagem.quantidade_contada)}</td>
                      <td className={`px-4 py-3 text-right tabular-nums ${divergente ? "text-warning-strong" : "text-brand-700 dark:text-brand-300"}`}>
                        {Number(contagem.divergencia)}
                      </td>
                      <td className="max-w-xs truncate px-4 py-3" title={contagem.justificativa ?? ""}>
                        {contagem.justificativa ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {contagem.ajuste_aplicado ? (
                          <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-800 dark:bg-brand-950/50 dark:text-brand-300">
                            Ajustado
                          </span>
                        ) : divergente && podeAjustar ? (
                          <InventarioAjusteButton contagemId={contagem.id} />
                        ) : (
                          <span className="text-xs text-muted-foreground/80">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {(contagens ?? []).length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground/80">
                      Nenhuma contagem registrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
