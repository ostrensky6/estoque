import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { gargalo, horasBancadaPorAmostra, type Etapa } from "@/lib/costing/engine";
import { ConfirmActionButton } from "@/components/common/ConfirmActionButton";
import { Combobox } from "@/components/ui/combobox";
import {
  atualizarAnalise,
  duplicarAnalise,
  excluirAnalise,
  adicionarEtapa,
  atualizarEtapa,
  removerEtapa,
  adicionarEquipamento,
  removerEquipamento,
  adicionarMaterial,
  atualizarMaterial,
  removerMaterial,
} from "@/lib/actions/receita";
import { formatNumber as num } from "@/lib/formatters";

export const dynamic = "force-dynamic";

const inp =
  "rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950";
const lbl = "block text-[10px] uppercase tracking-wide text-zinc-400";

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

  const [{ data: etapas }, { data: equipLinhas }, { data: materiais }, { data: equipamentos }, { data: insumos }] =
    await Promise.all([
      supabase.from("etapas").select("*").eq("codigo_analise", codigo).order("ordem", { nullsFirst: false }),
      supabase
        .from("equipamento_analise")
        .select("id, peso_alocacao, equipamento_id, equipamentos(nome, quantidade)")
        .eq("codigo_analise", codigo),
      supabase
        .from("insumo_analise")
        .select("id, nome_etapa, nome_atividade, especificacao_insumo, grupo_escolha, quantidade_por_amostra, unidade, modo_cobranca, insumo_id, insumos(custo_unitario, unidade)")
        .eq("codigo_analise", codigo)
        .order("nome_etapa"),
      supabase.from("equipamentos").select("id, nome").order("nome"),
      supabase.from("insumos").select("id, especificacao, nome_item, unidade").order("especificacao"),
    ]);

  const etapasT = (etapas ?? []) as unknown as Etapa[];
  const g = gargalo(etapasT);
  const tempoBancada = horasBancadaPorAmostra(etapasT);
  const prazo = Math.max(0, ...(etapas ?? []).map((e) => Number(e.dia_fim_max ?? 0)));

  const equipOptions = (equipamentos ?? []).map((e) => ({ value: String(e.id), label: e.nome }));
  const insumoOptions = (insumos ?? []).map((i) => ({
    value: String(i.id),
    label: i.especificacao || i.nome_item || `Insumo ${i.id}`,
    hint: i.nome_item ?? undefined,
  }));

  return (
    <div className="min-h-dvh bg-transparent font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Link href="/analises" className="text-xs text-zinc-500 hover:underline">
          ← Análises
        </Link>

        {/* Cabeçalho editável */}
        <section className="mt-2 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold tracking-tight">{analise.codigo}</h1>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${analise.ativo ? "bg-brand-100 text-brand-800 dark:bg-brand-950/50 dark:text-brand-300" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"}`}>
              {analise.ativo ? "Ativa" : "Inativa"}
            </span>
          </div>
          <form action={atualizarAnalise} className="mt-3 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="codigo" value={analise.codigo} />
            <div className="sm:col-span-2">
              <label className={lbl}>Nome</label>
              <input name="nome" defaultValue={analise.nome ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div className="sm:col-span-2">
              <label className={lbl}>Descrição</label>
              <textarea name="descricao" rows={2} defaultValue={analise.descricao ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="ativo" defaultChecked={analise.ativo} className="h-4 w-4" />
              Ativa
            </label>
            <div className="sm:col-span-2">
              <button className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900">
                Salvar dados
              </button>
            </div>
          </form>
        </section>

        {/* Dados técnicos (calculados) */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Amostras/dia" value={g.amostrasDia > 0 ? num(g.amostrasDia) : "—"} hint="gargalo" />
          <Stat label="T. bancada" value={tempoBancada > 0 ? `${num(tempoBancada)} h` : "—"} hint="por amostra" />
          <Stat label="Exec/dia" value={g.execucoesDia > 0 ? num(g.execucoesDia) : "—"} hint={`${num(g.amostrasPorExecucao)} amostras/exec`} />
          <Stat label="Prazo" value={prazo > 0 ? `${prazo} dias` : "—"} hint="dia_fim_max" />
        </div>

        {/* Etapas */}
        <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-zinc-500">Etapas</h2>
        <div className="mt-3 space-y-2">
          {(etapas ?? []).map((e) => (
            <form key={e.id} action={atualizarEtapa} className="grid grid-cols-2 gap-2 rounded-lg border border-zinc-200 bg-white p-3 sm:grid-cols-12 dark:border-zinc-800 dark:bg-zinc-900">
              <input type="hidden" name="id" value={e.id} />
              <input type="hidden" name="codigo_analise" value={codigo} />
              <div className="sm:col-span-3"><label className={lbl}>Etapa</label><input name="nome_etapa" defaultValue={e.nome_etapa} className={`${inp} mt-1 w-full`} /></div>
              <div className="sm:col-span-3"><label className={lbl}>Atividade</label><input name="nome_atividade" defaultValue={e.nome_atividade} className={`${inp} mt-1 w-full`} /></div>
              <div className="sm:col-span-1"><label className={lbl}>Exec/dia</label><input name="execucoes_por_dia" type="number" step="any" defaultValue={e.execucoes_por_dia ?? ""} className={`${inp} mt-1 w-full`} /></div>
              <div className="sm:col-span-1"><label className={lbl}>Am/exec</label><input name="amostras_por_execucao" type="number" step="any" defaultValue={e.amostras_por_execucao ?? ""} className={`${inp} mt-1 w-full`} /></div>
              <div className="sm:col-span-1"><label className={lbl}>T.máq</label><input name="tempo_maquina_h" type="number" step="any" defaultValue={e.tempo_maquina_h ?? ""} className={`${inp} mt-1 w-full`} /></div>
              <div className="sm:col-span-1"><label className={lbl}>T.banc</label><input name="tempo_bancada_h" type="number" step="any" defaultValue={e.tempo_bancada_h ?? ""} className={`${inp} mt-1 w-full`} /></div>
              <div className="sm:col-span-2"><label className={lbl}>Limitação</label><input name="tipo_limitacao" defaultValue={e.tipo_limitacao ?? ""} className={`${inp} mt-1 w-full`} /></div>
              <label className="flex items-center gap-1.5 text-xs sm:col-span-3"><input type="checkbox" name="atividade_opcional" defaultChecked={e.atividade_opcional} className="h-4 w-4" />opcional</label>
              <div className="col-span-2 flex items-end justify-end gap-2 sm:col-span-9">
                <button className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">Salvar</button>
                <button formAction={removerEtapa} className="rounded-md px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">Remover</button>
              </div>
            </form>
          ))}
          {(etapas ?? []).length === 0 && <p className="text-sm text-zinc-400">Sem etapas. Adicione abaixo.</p>}
        </div>
        <form action={adicionarEtapa} className="mt-2 flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
          <input type="hidden" name="codigo_analise" value={codigo} />
          <div><label className={lbl}>Etapa</label><input name="nome_etapa" className={`${inp} mt-1 w-40`} /></div>
          <div><label className={lbl}>Atividade</label><input name="nome_atividade" className={`${inp} mt-1 w-40`} /></div>
          <div><label className={lbl}>Exec/dia</label><input name="execucoes_por_dia" type="number" step="any" className={`${inp} mt-1 w-20`} /></div>
          <div><label className={lbl}>Am/exec</label><input name="amostras_por_execucao" type="number" step="any" className={`${inp} mt-1 w-20`} /></div>
          <div><label className={lbl}>T.máq</label><input name="tempo_maquina_h" type="number" step="any" className={`${inp} mt-1 w-20`} /></div>
          <div><label className={lbl}>T.banc</label><input name="tempo_bancada_h" type="number" step="any" className={`${inp} mt-1 w-20`} /></div>
          <button className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-500">+ Etapa</button>
        </form>

        {/* Equipamentos */}
        <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-zinc-500">Equipamentos</h2>
        <div className="mt-3 space-y-2">
          {(equipLinhas ?? []).map((eq) => {
            const e = eq.equipamentos as { nome: string; quantidade: number | null } | null;
            return (
              <form key={eq.id} action={removerEquipamento} className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900">
                <input type="hidden" name="id" value={eq.id} />
                <input type="hidden" name="codigo_analise" value={codigo} />
                <span><span className="font-medium">{e?.nome ?? "—"}</span><span className="text-zinc-500"> · peso {num(eq.peso_alocacao)}</span></span>
                <button className="text-xs text-red-600 hover:underline">Remover</button>
              </form>
            );
          })}
          {(equipLinhas ?? []).length === 0 && <p className="text-sm text-zinc-400">Nenhum equipamento associado.</p>}
        </div>
        <form action={adicionarEquipamento} className="mt-2 flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
          <input type="hidden" name="codigo_analise" value={codigo} />
          <div><label className={lbl}>Equipamento</label><div className="w-64"><Combobox name="equipamento_id" placeholder="Selecione…" searchPlaceholder="Buscar…" emptyText="Nenhum." options={equipOptions} /></div></div>
          <div><label className={lbl}>Peso</label><input name="peso_alocacao" type="number" step="any" defaultValue="1" className={`${inp} mt-1 w-24`} /></div>
          <button className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-500">+ Equipamento</button>
        </form>

        {/* Materiais */}
        <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-zinc-500">Materiais (por amostra)</h2>
        <div className="mt-3 space-y-2">
          {(materiais ?? []).map((m) => (
            <form key={m.id} action={atualizarMaterial} className="grid grid-cols-2 gap-2 rounded-lg border border-zinc-200 bg-white p-3 sm:grid-cols-12 dark:border-zinc-800 dark:bg-zinc-900">
              <input type="hidden" name="id" value={m.id} />
              <input type="hidden" name="codigo_analise" value={codigo} />
              <div className="sm:col-span-4"><label className={lbl}>Especificação</label><input name="especificacao_insumo" defaultValue={m.especificacao_insumo ?? ""} className={`${inp} mt-1 w-full`} /></div>
              <div className="sm:col-span-3">
                <label className={lbl}>Insumo (estoque)</label>
                <select name="insumo_id" defaultValue={m.insumo_id ?? ""} className={`${inp} mt-1 w-full`}>
                  <option value="">— sem vínculo</option>
                  {(insumos ?? []).map((i) => (
                    <option key={i.id} value={i.id}>{i.especificacao || i.nome_item || `Insumo ${i.id}`}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-1"><label className={lbl}>Qtd/am</label><input name="quantidade_por_amostra" type="number" step="any" defaultValue={m.quantidade_por_amostra ?? ""} className={`${inp} mt-1 w-full`} /></div>
              <div className="sm:col-span-1"><label className={lbl}>Un.</label><input name="unidade" defaultValue={m.unidade ?? ""} className={`${inp} mt-1 w-full`} /></div>
              <div className="sm:col-span-2">
                <label className={lbl}>Cobrança</label>
                <select name="modo_cobranca" defaultValue={m.modo_cobranca ?? ""} className={`${inp} mt-1 w-full`}>
                  <option value="">—</option>
                  <option value="por_amostra">Por amostra</option>
                  <option value="por_execucao">Por execução</option>
                </select>
              </div>
              <div className="sm:col-span-1"><label className={lbl}>Grupo</label><input name="grupo_escolha" defaultValue={m.grupo_escolha ?? ""} className={`${inp} mt-1 w-full`} /></div>
              <div className="col-span-2 flex items-end justify-end gap-2 sm:col-span-12">
                <button className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">Salvar</button>
                <button formAction={removerMaterial} className="rounded-md px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">Remover</button>
              </div>
            </form>
          ))}
          {(materiais ?? []).length === 0 && <p className="text-sm text-zinc-400">Nenhum material. Adicione abaixo.</p>}
        </div>
        <form action={adicionarMaterial} className="mt-2 flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
          <input type="hidden" name="codigo_analise" value={codigo} />
          <input type="hidden" name="nome_etapa" value="—" />
          <input type="hidden" name="nome_atividade" value="—" />
          <div><label className={lbl}>Especificação</label><input name="especificacao_insumo" className={`${inp} mt-1 w-48`} /></div>
          <div><label className={lbl}>Insumo</label><div className="w-56"><Combobox name="insumo_id" placeholder="Selecione…" searchPlaceholder="Buscar insumo…" emptyText="Nenhum." options={insumoOptions} /></div></div>
          <div><label className={lbl}>Qtd/am</label><input name="quantidade_por_amostra" type="number" step="any" className={`${inp} mt-1 w-24`} /></div>
          <div><label className={lbl}>Un.</label><input name="unidade" className={`${inp} mt-1 w-20`} /></div>
          <div>
            <label className={lbl}>Cobrança</label>
            <select name="modo_cobranca" defaultValue="por_amostra" className={`${inp} mt-1 w-32`}>
              <option value="por_amostra">Por amostra</option>
              <option value="por_execucao">Por execução</option>
            </select>
          </div>
          <button className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-500">+ Material</button>
        </form>

        <p className="mt-3 text-xs text-zinc-400">
          As mudanças aqui recalculam o <Link href="/custeio" className="underline">Custeio</Link> automaticamente.
        </p>

        {/* Duplicar / excluir */}
        <section className="mt-8 grid gap-4 border-t border-zinc-200 pt-6 sm:grid-cols-2 dark:border-zinc-800">
          <form action={duplicarAnalise} className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-sm font-semibold">Duplicar análise</h3>
            <p className="mt-1 text-xs text-zinc-500">Copia etapas, equipamentos e materiais para um novo código.</p>
            <input type="hidden" name="origem" value={codigo} />
            <input name="novo_codigo" placeholder="Novo código" className={`${inp} mt-2 w-full`} required />
            <input name="novo_nome" placeholder="Novo nome (opcional)" className={`${inp} mt-2 w-full`} />
            <button className="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500">Duplicar</button>
          </form>
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-sm font-semibold">Excluir análise</h3>
            <p className="mt-1 text-xs text-zinc-500">Remove a análise e toda a receita (etapas, equipamentos, materiais).</p>
            <div className="mt-3">
              <ConfirmActionButton
                action={excluirAnalise}
                fields={{ codigo }}
                trigger="Excluir análise"
                titulo="Excluir análise"
                mensagem={`Excluir a análise “${analise.codigo}” e toda a sua receita? Esta ação não pode ser desfeita.`}
                confirmLabel="Excluir análise"
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}
