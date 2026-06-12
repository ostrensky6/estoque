import Link from "next/link";
import { notFound } from "next/navigation";
import { createClientUntyped } from "@/lib/supabase/server";
import { calcularTodas } from "@/lib/costing/loader";
import { PrintButton } from "@/components/orcamento/PrintButton";
import {
  salvarCabecalho,
  adicionarItemOrcamento,
  removerItemOrcamento,
  recalcularOrcamento,
  excluirOrcamento,
} from "@/lib/actions/orcamentos";

export const dynamic = "force-dynamic";

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Item = {
  id: number;
  codigo_analise: string;
  n_amostras: number;
  custo_unitario: number;
  preco_unitario: number;
};

export default async function OrcamentoDetalhe({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orcId = Number(id);
  const supabase = await createClientUntyped();

  const { data: orc } = await supabase
    .from("orcamentos")
    .select("*")
    .eq("id", orcId)
    .single();
  if (!orc) notFound();

  const [{ data: itensRaw }, { data: analises }, { breakdowns }, { data: clientes }, { data: projetos }] =
    await Promise.all([
      supabase
        .from("orcamento_itens")
        .select("id, codigo_analise, n_amostras, custo_unitario, preco_unitario")
        .eq("orcamento_id", orcId)
        .order("id"),
      supabase.from("analises").select("codigo").eq("ativo", true).order("codigo"),
      calcularTodas(),
      supabase.from("clientes").select("id, nome").eq("ativo", true).order("nome"),
      supabase.from("projetos").select("id, nome").order("nome"),
    ]);

  const projetoNome =
    orc.projeto_id != null
      ? (projetos ?? []).find((p) => p.id === orc.projeto_id)?.nome ?? null
      : null;

  const itens = (itensRaw ?? []) as Item[];
  const totalAmostras = itens.reduce((a, it) => a + Number(it.n_amostras), 0);
  const totalCusto = itens.reduce(
    (a, it) => a + Number(it.custo_unitario) * Number(it.n_amostras),
    0,
  );
  const totalPreco = itens.reduce(
    (a, it) => a + Number(it.preco_unitario) * Number(it.n_amostras),
    0,
  );

  // detecta itens cujo preço atual difere do snapshot (parâmetros mudaram)
  const precoAtual = new Map(breakdowns.map((b) => [b.codigo, b.preco]));
  const desatualizado = itens.some((it) => {
    const atual = precoAtual.get(it.codigo_analise);
    return atual != null && Math.abs(atual - Number(it.preco_unitario)) > 0.005;
  });

  const validade =
    orc.data_orcamento && orc.validade_dias
      ? new Date(
          new Date(orc.data_orcamento).getTime() +
            orc.validade_dias * 86400000,
        ).toLocaleDateString("pt-BR")
      : null;

  const inp =
    "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";
  const lbl = "block text-xs font-medium text-zinc-600 dark:text-zinc-300";

  return (
    <div className="min-h-dvh bg-transparent font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="print-area mx-auto max-w-4xl px-6 py-10">
        <div className="no-print flex items-center justify-between">
          <Link href="/orcamento" className="text-xs text-zinc-500 hover:underline">
            ← Orçamentos
          </Link>
          <div className="flex items-center gap-2">
            <PrintButton />
            <form action={recalcularOrcamento}>
              <input type="hidden" name="orcamento_id" value={orcId} />
              <button className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
                Recalcular preços
              </button>
            </form>
          </div>
        </div>

        {/* Documento imprimível */}
        <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60 print:border-0 print:shadow-none">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                Orçamento de análises
              </h1>
              <p className="text-sm text-zinc-500">
                Laboratório ATGC — Biologia Molecular
              </p>
            </div>
            <div className="text-right text-sm">
              <p className="font-medium">Nº {orc.id}</p>
              <p className="text-zinc-500">Data: {orc.data_orcamento ?? "—"}</p>
              {validade && (
                <p className="text-zinc-500">Válido até: {validade}</p>
              )}
            </div>
          </div>

          <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <div className="flex gap-2">
              <dt className="text-zinc-500">Cliente:</dt>
              <dd className="font-medium">{orc.cliente_nome}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-zinc-500">CNPJ:</dt>
              <dd>{orc.cliente_cnpj ?? "—"}</dd>
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <dt className="text-zinc-500">Endereço:</dt>
              <dd>{orc.cliente_endereco ?? "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-zinc-500">Contato:</dt>
              <dd>{orc.cliente_contato ?? "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-zinc-500">Responsável:</dt>
              <dd>{orc.responsavel ?? "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-zinc-500">Projeto:</dt>
              <dd>{projetoNome ?? "—"}</dd>
            </div>
          </dl>

          {/* Análises solicitadas */}
          <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Análises solicitadas
          </h2>
          <div className="mt-2 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-right text-sm">
              <thead className="bg-transparent text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/60">
                <tr>
                  <th className="px-3 py-2 text-left">Análise</th>
                  <th className="px-3 py-2">Custo/amostra</th>
                  <th className="px-3 py-2">Preço/amostra</th>
                  <th className="px-3 py-2">Amostras</th>
                  <th className="px-3 py-2">Subtotal</th>
                  <th className="px-3 py-2 no-print"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {itens.map((it) => (
                  <tr key={it.id}>
                    <td className="px-3 py-2 text-left font-medium">
                      {it.codigo_analise}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-zinc-500">
                      {brl(Number(it.custo_unitario))}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {brl(Number(it.preco_unitario))}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{Number(it.n_amostras)}</td>
                    <td className="px-3 py-2 font-semibold tabular-nums">
                      {brl(Number(it.preco_unitario) * Number(it.n_amostras))}
                    </td>
                    <td className="px-3 py-2 no-print">
                      <form action={removerItemOrcamento}>
                        <input type="hidden" name="orcamento_id" value={orcId} />
                        <input type="hidden" name="item_id" value={it.id} />
                        <button className="text-xs text-red-600 hover:underline">
                          Remover
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {itens.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-zinc-400">
                      Nenhuma análise. Adicione abaixo.
                    </td>
                  </tr>
                )}
              </tbody>
              {itens.length > 0 && (
                <tfoot className="border-t border-zinc-200 bg-transparent dark:border-zinc-800 dark:bg-zinc-900/60">
                  <tr>
                    <td className="px-3 py-2.5 text-left font-medium">Total</td>
                    <td className="px-3 py-2.5 tabular-nums text-zinc-500">
                      {brl(totalCusto)}
                    </td>
                    <td></td>
                    <td className="px-3 py-2.5 tabular-nums">{totalAmostras}</td>
                    <td className="px-3 py-2.5 text-base font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                      {brl(totalPreco)}
                    </td>
                    <td className="no-print"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {orc.observacoes && (
            <div className="mt-4 text-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Observações
              </p>
              <p className="mt-1 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                {orc.observacoes}
              </p>
            </div>
          )}
        </div>

        {desatualizado && (
          <p className="no-print mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            Os parâmetros de custo mudaram desde a emissão. Use “Recalcular
            preços” para atualizar os valores deste orçamento.
          </p>
        )}

        {/* Form: adicionar análise */}
        <section className="no-print mt-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold">Adicionar análise solicitada</h2>
          <form action={adicionarItemOrcamento} className="mt-3 flex flex-wrap items-end gap-2">
            <input type="hidden" name="orcamento_id" value={orcId} />
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-zinc-400">
                Análise
              </label>
              <select name="codigo_analise" className={inp} defaultValue="">
                <option value="" disabled>
                  Selecione…
                </option>
                {(analises ?? []).map((a) => (
                  <option key={a.codigo} value={a.codigo}>
                    {a.codigo}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-zinc-400">
                Nº de amostras
              </label>
              <input
                name="n_amostras"
                type="number"
                min="1"
                step="1"
                defaultValue="1"
                className={`${inp} w-28`}
              />
            </div>
            <button className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">
              Adicionar
            </button>
          </form>
        </section>

        {/* Form: cabeçalho / dados do cliente */}
        <section className="no-print mt-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold">Dados do cliente e do orçamento</h2>
          <form action={salvarCabecalho} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input type="hidden" name="orcamento_id" value={orcId} />
            <div>
              <label className={lbl}>Cliente cadastrado</label>
              <select name="cliente_id" defaultValue={orc.cliente_id ?? ""} className={`${inp} mt-1 w-full`}>
                <option value="">— (preencher manualmente abaixo)</option>
                {(clientes ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-zinc-400">
                Ao vincular, os dados do documento são preenchidos a partir do cadastro.
              </p>
            </div>
            <div>
              <label className={lbl}>Projeto</label>
              <select name="projeto_id" defaultValue={orc.projeto_id ?? ""} className={`${inp} mt-1 w-full`}>
                <option value="">—</option>
                {(projetos ?? []).map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={lbl}>Cliente (texto livre, se não cadastrado)</label>
              <input name="cliente_nome" defaultValue={orc.cliente_nome ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>CNPJ</label>
              <input name="cliente_cnpj" defaultValue={orc.cliente_cnpj ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Contato (e-mail / telefone)</label>
              <input name="cliente_contato" defaultValue={orc.cliente_contato ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div className="sm:col-span-2">
              <label className={lbl}>Endereço</label>
              <input name="cliente_endereco" defaultValue={orc.cliente_endereco ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Data do orçamento</label>
              <input name="data_orcamento" type="date" defaultValue={orc.data_orcamento ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Validade (dias)</label>
              <input name="validade_dias" type="number" min="0" step="1" defaultValue={orc.validade_dias ?? 30} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Responsável (laboratório)</label>
              <input name="responsavel" defaultValue={orc.responsavel ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className={lbl}>Status</label>
              <select name="status" defaultValue={orc.status ?? "rascunho"} className={`${inp} mt-1 w-full`}>
                <option value="rascunho">Rascunho</option>
                <option value="enviado">Enviado</option>
                <option value="aprovado">Aprovado</option>
                <option value="recusado">Recusado</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={lbl}>Observações</label>
              <textarea name="observacoes" rows={3} defaultValue={orc.observacoes ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div className="sm:col-span-2">
              <button className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900">
                Salvar dados
              </button>
            </div>
          </form>
        </section>

        <form action={excluirOrcamento} className="no-print mt-6">
          <input type="hidden" name="orcamento_id" value={orcId} />
          <button className="text-xs text-zinc-400 hover:text-red-600">
            Excluir orçamento
          </button>
        </form>
      </main>
    </div>
  );
}
