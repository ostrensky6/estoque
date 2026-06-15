import { createClient } from "@/lib/supabase/server";
import { aprovarOrcamentoPublico } from "@/lib/actions/orcamento-projetos";
import {
  calcularOrcamentoProjetoLegacy,
  RUBRICAS_PROJETO,
} from "@/lib/project-budget/legacy";
import { formatCurrency as brl } from "@/lib/formatters";

export const dynamic = "force-dynamic";

type OrcamentoPublico = {
  id: number;
  titulo: string | null;
  cliente_nome: string | null;
  status: string | null;
  data_orcamento: string | null;
  validade_dias: number | null;
  responsavel: string | null;
  coordenador: string | null;
  escopo: string | null;
  cronograma: string | null;
  observacoes: string | null;
  impostos_legacy: number | null;
  impostos: number | null;
  incubacao: number | null;
  reserva: number | null;
  investimentos: number | null;
  lucro: number | null;
  margem_lucro: number | null;
};
type AnalisePub = { codigo_analise: string; n_amostras: number; custo_unitario: number };
type CustoPub = {
  rubrica: string | null;
  descricao: string;
  quantidade: number;
  unidade: string | null;
  preco_unitario: number;
  meses_selecionados: number[] | null;
};
type Payload = {
  orcamento: OrcamentoPublico | null;
  analises: AnalisePub[];
  custos: CustoPub[];
  aprovado_em: string | null;
  aprovado_por: string | null;
};

export default async function AprovacaoPublicaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("ler_orcamento_publico", { p_token: token });
  const payload = (data ?? null) as Payload | null;

  if (!payload || !payload.orcamento) {
    return (
      <main className="mx-auto max-w-lg px-6 py-24 text-center font-sans">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Link indisponível
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Este link de aprovação é inválido, expirou ou foi revogado. Solicite um
          novo link ao responsável pelo orçamento.
        </p>
      </main>
    );
  }

  const orc = payload.orcamento;
  const analises = payload.analises ?? [];
  const custos = payload.custos ?? [];

  // Mesma regra do editor: análises entram pelo CUSTO; markup uma única vez.
  const itensLegacy = [
    ...custos,
    ...analises.map((a) => ({
      rubrica: "MC",
      quantidade: Number(a.n_amostras),
      preco_unitario: Number(a.custo_unitario),
      meses_selecionados: [],
    })),
  ];
  const calculo = calcularOrcamentoProjetoLegacy(itensLegacy, {
    impostos_legacy: Number(orc.impostos_legacy ?? orc.impostos ?? 0),
    incubacao: Number(orc.incubacao ?? 0),
    reserva: Number(orc.reserva ?? 0),
    investimentos: Number(orc.investimentos ?? 0),
    lucro: Number(orc.lucro ?? orc.margem_lucro ?? 0),
  });

  const aprovado = Boolean(payload.aprovado_em);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10 font-sans text-zinc-900 dark:text-zinc-100">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-400">
          Proposta de orçamento — ATGC Genética Ambiental
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{orc.titulo}</h1>
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <Linha rotulo="Cliente" valor={orc.cliente_nome} />
          <Linha rotulo="Responsável" valor={orc.responsavel} />
          <Linha rotulo="Coordenador" valor={orc.coordenador} />
          <Linha rotulo="Data" valor={orc.data_orcamento} />
        </dl>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
            <p className="text-xs font-medium text-zinc-500">Subtotal (base)</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{brl(calculo.subtotal)}</p>
          </div>
          <div className="rounded-lg border border-brand-200 bg-brand-50 p-4 dark:border-brand-900 dark:bg-brand-950/30">
            <p className="text-xs font-medium text-zinc-500">Total final</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{brl(calculo.grossTotal)}</p>
          </div>
        </div>

        <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Composição por rubrica
        </h2>
        <div className="mt-2 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-right text-sm">
            <thead className="text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2 text-left">Rubrica</th>
                <th className="px-3 py-2">Itens</th>
                <th className="px-3 py-2">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {calculo.summaries
                .filter((s) => s.count > 0 || s.total > 0)
                .map((s) => (
                  <tr key={s.code}>
                    <td className="px-3 py-2 text-left font-medium">
                      {s.code} · {RUBRICAS_PROJETO[s.code as keyof typeof RUBRICAS_PROJETO] ?? s.code}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{s.count}</td>
                    <td className="px-3 py-2 tabular-nums">{brl(s.total)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {(orc.escopo || orc.cronograma) && (
          <div className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
            {orc.escopo && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Escopo</h3>
                <p className="mt-1 whitespace-pre-wrap leading-6 text-zinc-700 dark:text-zinc-300">{orc.escopo}</p>
              </div>
            )}
            {orc.cronograma && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Cronograma</h3>
                <p className="mt-1 whitespace-pre-wrap leading-6 text-zinc-700 dark:text-zinc-300">{orc.cronograma}</p>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-800">
          {aprovado ? (
            <div className="rounded-lg bg-leaf-50 px-4 py-3 text-sm text-leaf-800 dark:bg-leaf-950/40 dark:text-leaf-200">
              ✓ Orçamento aprovado{payload.aprovado_por ? ` por ${payload.aprovado_por}` : ""}
              {payload.aprovado_em
                ? ` em ${new Date(payload.aprovado_em).toLocaleString("pt-BR")}`
                : ""}
              .
            </div>
          ) : (
            <form action={aprovarOrcamentoPublico} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="token" value={token} />
              <div className="flex-1 min-w-56">
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  Seu nome (para registro da aprovação)
                </label>
                <input
                  name="nome"
                  placeholder="Nome de quem aprova"
                  className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                />
              </div>
              <button className="rounded-md bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-500">
                Aprovar orçamento
              </button>
            </form>
          )}
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-zinc-400">
        Documento gerado pelo Kontrol — ATGC. Valores em reais (BRL).
      </p>
    </main>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div className="flex gap-2">
      <dt className="text-zinc-500">{rotulo}:</dt>
      <dd className="font-medium">{valor ?? "—"}</dd>
    </div>
  );
}
