import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { gargalo, horasBancadaPorAmostra, type Etapa } from "@/lib/costing/engine";

export const dynamic = "force-dynamic";

const num = (v: number | null) =>
  (v ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const brl = (v: number | null) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}

const COBRANCA: Record<string, string> = {
  por_execucao: "Por execução",
  por_amostra: "Por amostra",
};

export default async function AnaliseDetalhe({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo: codigoRaw } = await params;
  const codigo = decodeURIComponent(codigoRaw);
  const supabase = await createClient();

  const { data: analise } = await supabase
    .from("analises")
    .select("codigo, nome, descricao, ativo")
    .eq("codigo", codigo)
    .single();
  if (!analise) notFound();

  const [{ data: etapas }, { data: equip }, { data: insumos }] = await Promise.all([
    supabase
      .from("etapas")
      .select("*")
      .eq("codigo_analise", codigo)
      .order("ordem", { nullsFirst: false }),
    supabase
      .from("equipamento_analise")
      .select("peso_alocacao, equipamentos(nome, quantidade)")
      .eq("codigo_analise", codigo),
    supabase
      .from("insumo_analise")
      .select(
        "nome_etapa, nome_atividade, especificacao_insumo, grupo_escolha, quantidade_por_amostra, unidade, modo_cobranca, insumos(custo_unitario, unidade)",
      )
      .eq("codigo_analise", codigo)
      .order("nome_etapa"),
  ]);

  const etapasT = (etapas ?? []) as unknown as Etapa[];
  const g = gargalo(etapasT);
  const tempoBancada = horasBancadaPorAmostra(etapasT);
  const tempoMaquina = (etapas ?? []).reduce(
    (a, e) => a + Number(e.tempo_maquina_h ?? 0),
    0,
  );
  const prazo = Math.max(0, ...(etapas ?? []).map((e) => Number(e.dia_fim_max ?? 0)));
  const gargaloEtapa = (etapas ?? []).find((e) => e.tipo_limitacao);

  return (
    <div className="min-h-dvh bg-transparent font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Link href="/analises" className="text-xs text-zinc-500 hover:underline">
          ← Análises
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">{analise.codigo}</h1>
          {analise.ativo ? (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
              Ativa
            </span>
          ) : (
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-500 dark:bg-zinc-800">
              Inativa
            </span>
          )}
        </div>
        {analise.nome && <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{analise.nome}</p>}
        {analise.descricao && <p className="mt-1 text-sm text-zinc-500">{analise.descricao}</p>}

        {/* Dados técnicos — capacidade e tempos */}
        <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Dados técnicos
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Amostras por dia"
            value={g.amostrasDia > 0 ? num(g.amostrasDia) : "—"}
            hint={
              g.execucoesDia > 0
                ? `${num(g.execucoesDia)} exec/dia × ${num(g.amostrasPorExecucao)} amostras`
                : "definido pelo gargalo"
            }
          />
          <Stat
            label="Tempo de bancada"
            value={tempoBancada > 0 ? `${num(tempoBancada)} h` : "—"}
            hint="por amostra"
          />
          <Stat
            label="Tempo de máquina"
            value={tempoMaquina > 0 ? `${num(tempoMaquina)} h` : "—"}
            hint="somando as etapas"
          />
          <Stat
            label="Prazo de entrega"
            value={prazo > 0 ? `${prazo} dias` : "—"}
            hint={gargaloEtapa?.tipo_limitacao ? `gargalo: ${gargaloEtapa.tipo_limitacao}` : "estimado"}
          />
        </div>

        {/* Etapas */}
        <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-right text-sm">
            <thead className="border-b border-zinc-200 bg-transparent text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60">
              <tr>
                <th className="px-3 py-2.5 text-left">Etapa</th>
                <th className="px-3 py-2.5 text-left">Atividade</th>
                <th className="px-3 py-2.5">Exec/dia</th>
                <th className="px-3 py-2.5">Amostras/exec</th>
                <th className="px-3 py-2.5">T. máquina (h)</th>
                <th className="px-3 py-2.5">T. bancada (h)</th>
                <th className="px-3 py-2.5 text-left">Limitação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {(etapas ?? []).map((e) => (
                <tr key={e.id} className={e.atividade_opcional ? "text-zinc-400" : ""}>
                  <td className="px-3 py-2 text-left">{e.nome_etapa}</td>
                  <td className="px-3 py-2 text-left">
                    {e.nome_atividade}
                    {e.atividade_opcional && (
                      <span className="ml-1 text-[10px] uppercase text-zinc-400">opcional</span>
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{num(e.execucoes_por_dia)}</td>
                  <td className="px-3 py-2 tabular-nums">{num(e.amostras_por_execucao)}</td>
                  <td className="px-3 py-2 tabular-nums">{num(e.tempo_maquina_h)}</td>
                  <td className="px-3 py-2 tabular-nums">{num(e.tempo_bancada_h)}</td>
                  <td className="px-3 py-2 text-left text-zinc-500">{e.tipo_limitacao ?? "—"}</td>
                </tr>
              ))}
              {(etapas ?? []).length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-zinc-400">
                    Sem etapas cadastradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Equipamentos */}
        <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Equipamentos necessários
        </h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-right text-sm">
            <thead className="border-b border-zinc-200 bg-transparent text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60">
              <tr>
                <th className="px-3 py-2.5 text-left">Equipamento</th>
                <th className="px-3 py-2.5">Qtd.</th>
                <th className="px-3 py-2.5">Peso de alocação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {(equip ?? []).map((eq, i) => {
                const e = eq.equipamentos as { nome: string; quantidade: number | null } | null;
                return (
                  <tr key={i}>
                    <td className="px-3 py-2 text-left font-medium">{e?.nome ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{num(e?.quantidade ?? null)}</td>
                    <td className="px-3 py-2 tabular-nums text-zinc-500">
                      {num(eq.peso_alocacao)}
                    </td>
                  </tr>
                );
              })}
              {(equip ?? []).length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-8 text-center text-zinc-400">
                    Nenhum equipamento associado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Materiais / insumos */}
        <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Materiais e quantidades por amostra
        </h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-right text-sm">
            <thead className="border-b border-zinc-200 bg-transparent text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60">
              <tr>
                <th className="px-3 py-2.5 text-left">Etapa / atividade</th>
                <th className="px-3 py-2.5 text-left">Material</th>
                <th className="px-3 py-2.5">Qtd./amostra</th>
                <th className="px-3 py-2.5 text-left">Un.</th>
                <th className="px-3 py-2.5 text-left">Cobrança</th>
                <th className="px-3 py-2.5">Custo unit.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {(insumos ?? []).map((it, i) => {
                const ins = it.insumos as { custo_unitario: number | null; unidade: string | null } | null;
                return (
                  <tr key={i}>
                    <td className="px-3 py-2 text-left text-zinc-500">
                      {it.nome_etapa}
                      <span className="block text-[11px] text-zinc-400">{it.nome_atividade}</span>
                    </td>
                    <td className="px-3 py-2 text-left">
                      {it.especificacao_insumo ?? "—"}
                      {it.grupo_escolha && (
                        <span className="ml-1 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800">
                          grupo: {it.grupo_escolha}
                        </span>
                      )}
                      {!ins && (
                        <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                          sem cadastro no estoque
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{num(it.quantidade_por_amostra)}</td>
                    <td className="px-3 py-2 text-left text-zinc-500">
                      {it.unidade ?? ins?.unidade ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-left text-zinc-500">
                      {it.modo_cobranca ? COBRANCA[it.modo_cobranca] ?? it.modo_cobranca : "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-zinc-500">
                      {ins?.custo_unitario != null ? brl(ins.custo_unitario) : "—"}
                    </td>
                  </tr>
                );
              })}
              {(insumos ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-zinc-400">
                    Nenhum material associado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-zinc-400">
          Quantidades por amostra; itens “por execução” (kits/placas/flow cell)
          são cobrados pela embalagem e diluídos no lote — veja o custo final em{" "}
          <Link href="/custeio" className="underline">Custeio</Link>.
        </p>
      </main>
    </div>
  );
}
