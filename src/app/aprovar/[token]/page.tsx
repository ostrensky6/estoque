import { aprovarOrcamentoPublico } from "@/lib/actions/orcamento-projetos";
import { formatCurrency as brl } from "@/lib/formatters";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SnapshotParametro = {
  key?: string;
  label?: string;
  nominalRate?: number;
  amount?: number;
};

type SnapshotPublico = {
  demanda?: {
    titulo?: string | null;
    cliente_nome?: string | null;
    responsavel_interno?: string | null;
    escopo_preliminar?: string | null;
    descricao?: string | null;
    observacoes?: string | null;
  };
  orcamentos_analises?: Array<{
    orcamento_itens?: Array<{ id?: number }>;
  }>;
  orcamentos_projeto?: Array<{
    orcamento_projeto_analises?: Array<{ id?: number }>;
    orcamento_projeto_custos?: Array<{ id?: number }>;
  }>;
  consolidado?: {
    totalLaboratorioCusto?: number;
    totalProjetoCusto?: number;
    totalFinal?: number;
    parametrosProjeto?: SnapshotParametro[];
  };
};

type PayloadPublico = {
  snapshot: SnapshotPublico;
  versao: {
    id: number;
    numero: string;
    versao: number;
    status: string;
    valido_ate: string | null;
    total_final: number;
  };
  aprovado_em: string | null;
  aprovado_por: string | null;
};

export default async function AprovacaoPublicaPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ler_orcamento_publico", {
    p_token: token,
  });
  const payload = !error ? (data as PayloadPublico | null) : null;

  if (!payload?.snapshot || !payload.versao) {
    return <LinkIndisponivel />;
  }

  const snapshot = payload.snapshot;
  const demanda = snapshot.demanda;
  const consolidado = snapshot.consolidado;
  const subtotal =
    Number(consolidado?.totalLaboratorioCusto ?? 0) +
    Number(consolidado?.totalProjetoCusto ?? 0);
  const totalFinal = Number(payload.versao.total_final ?? consolidado?.totalFinal ?? 0);
  const parametros = consolidado?.parametrosProjeto ?? [];
  const itensLaboratorio = (snapshot.orcamentos_analises ?? []).reduce(
    (total, orcamento) => total + (orcamento.orcamento_itens?.length ?? 0),
    0,
  );
  const itensProjeto = (snapshot.orcamentos_projeto ?? []).reduce(
    (total, orcamento) =>
      total +
      (orcamento.orcamento_projeto_analises?.length ?? 0) +
      (orcamento.orcamento_projeto_custos?.length ?? 0),
    0,
  );
  const aprovado = Boolean(payload.aprovado_em);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 font-sans text-foreground sm:px-6 sm:py-8">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-400">
          Proposta de orçamento — ATGC Genética Ambiental
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">
          {demanda?.titulo ?? payload.versao.numero}
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {payload.versao.numero} · versão {payload.versao.versao}
        </p>

        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <Linha rotulo="Cliente" valor={demanda?.cliente_nome} />
          <Linha rotulo="Responsável" valor={demanda?.responsavel_interno} />
          <Linha rotulo="Validade" valor={payload.versao.valido_ate} />
          <Linha rotulo="Status" valor={payload.versao.status} />
        </dl>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Resumo rotulo="Subtotal de custos" valor={subtotal} />
          <Resumo rotulo="Total final" valor={totalFinal} destaque />
        </div>

        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Composição congelada
          </h2>
          <dl className="mt-2 grid gap-3 text-sm sm:grid-cols-2">
            <Linha rotulo="Itens laboratoriais" valor={String(itensLaboratorio)} />
            <Linha rotulo="Itens de projeto" valor={String(itensProjeto)} />
          </dl>
          {parametros.length > 0 && (
            <div className="mt-3 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-right text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Parâmetro</th>
                    <th className="px-3 py-2">Percentual</th>
                    <th className="px-3 py-2">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {parametros.map((parametro, index) => (
                    <tr key={`${parametro.key ?? parametro.label ?? "parametro"}-${index}`}>
                      <td className="px-3 py-2 text-left font-medium">
                        {parametro.label ?? parametro.key ?? "Parâmetro"}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {Number(parametro.nominalRate ?? 0).toLocaleString("pt-BR")}%
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {brl(Number(parametro.amount ?? 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {(demanda?.escopo_preliminar || demanda?.descricao || demanda?.observacoes) && (
          <section className="mt-6 text-sm">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Escopo e observações
            </h2>
            <p className="mt-1 whitespace-pre-wrap leading-6 text-foreground">
              {demanda.escopo_preliminar ?? demanda.descricao ?? demanda.observacoes}
            </p>
          </section>
        )}

        <div className="mt-8 border-t border-border pt-6">
          {query.erro && (
            <p className="mb-3 rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger-strong">
              Não foi possível concluir a aprovação. O link está indisponível.
            </p>
          )}
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
              <div className="min-w-56 flex-1">
                <label className="block text-xs font-medium text-muted-foreground">
                  Seu nome (para registro da aprovação)
                </label>
                <input
                  name="nome"
                  placeholder="Nome de quem aprova"
                  className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                />
              </div>
              <button className="rounded-md bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-500">
                Aprovar orçamento
              </button>
            </form>
          )}
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground/80">
        Documento gerado pelo Kontrol — ATGC. Valores em reais (BRL).
      </p>
    </main>
  );
}

function LinkIndisponivel() {
  return (
    <main className="mx-auto max-w-lg px-6 py-24 text-center font-sans">
      <h1 className="text-xl font-semibold text-foreground">Link indisponível</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Este link de aprovação é inválido, expirou ou foi revogado. Solicite um
        novo link ao responsável pelo orçamento.
      </p>
    </main>
  );
}

function Resumo({
  rotulo,
  valor,
  destaque = false,
}: {
  rotulo: string;
  valor: number;
  destaque?: boolean;
}) {
  return (
    <div
      className={
        destaque
          ? "rounded-lg border border-brand-200 bg-brand-50 p-4 dark:border-brand-900 dark:bg-brand-950/30"
          : "rounded-lg border border-border bg-muted/50 p-4"
      }
    >
      <p className="text-xs font-medium text-muted-foreground">{rotulo}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{brl(valor)}</p>
    </div>
  );
}

function Linha({
  rotulo,
  valor,
}: {
  rotulo: string;
  valor: string | null | undefined;
}) {
  return (
    <div className="flex gap-2">
      <dt className="text-muted-foreground">{rotulo}:</dt>
      <dd className="font-medium">{valor ?? "—"}</dd>
    </div>
  );
}
