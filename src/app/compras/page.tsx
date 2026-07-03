import { createClient } from "@/lib/supabase/server";
import { criarPedido } from "@/lib/actions/compras";
import { ComprasTable, type CompraRow } from "@/components/compras/ComprasTable";
import { GerarReposicaoButton } from "@/components/compras/GerarReposicaoButton";
import { formatNumber as fmt } from "@/lib/formatters";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  solicitado: { label: "Solicitado", cls: "bg-warning-soft text-warning-strong" },
  aprovado: { label: "Aprovado", cls: "bg-info-soft text-info-strong" },
  enviado: { label: "Enviado", cls: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300" },
  recebido: { label: "Recebido", cls: "bg-brand-100 text-brand-800 dark:bg-brand-950/50 dark:text-brand-300" },
  cancelado: { label: "Cancelado", cls: "bg-muted text-muted-foreground" },
};

export default async function ComprasPage() {
  const supabase = await createClient();
  const [{ data: pedidos }, { data: fornecedores }, { data: saldo }, { data: projetos }, { data: previsao }] = await Promise.all([
    supabase
      .from("pedidos_compra")
      .select("id, status, projeto, projeto_id, solicitante, data_solicitacao, fornecedores(nome)")
      .order("criado_em", { ascending: false }),
    supabase.from("fornecedores").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("v_estoque_saldo").select("*"),
    supabase.from("projetos").select("id, nome").order("nome"),
    supabase.from("v_previsao_suprimentos").select("*").order("qtd_sugerida_compra", { ascending: false }),
  ]);
  const projetoNome = new Map((projetos ?? []).map((p) => [p.id, p.nome]));
  const linhas: CompraRow[] = (pedidos ?? []).map((p) => {
    const st = STATUS[p.status] ?? { label: p.status, cls: "" };
    const fornecedor = (p.fornecedores as { nome: string | null } | null)?.nome ?? "—";
    const projeto = p.projeto_id != null ? projetoNome.get(p.projeto_id) ?? "—" : p.projeto ?? "—";
    return {
      id: p.id as number,
      pedido: `#${p.id} · ${p.data_solicitacao ?? "—"}`,
      fornecedor,
      projeto,
      solicitante: p.solicitante ?? "—",
      status: p.status,
      statusLabel: st.label,
    };
  });

  // sugestões de compra: disponível abaixo do ponto de reposição
  const sugestoes = (saldo ?? [])
    .filter((s) => (s.ponto_reposicao ?? 0) > 0 && (s.disponivel ?? 0) <= (s.ponto_reposicao ?? 0))
    .map((s) => ({
      especificacao: s.especificacao,
      disponivel: s.disponivel ?? 0,
      ponto: s.ponto_reposicao ?? 0,
      sugerido: Math.max(0, (s.ponto_reposicao ?? 0) + (s.estoque_seguranca ?? 0) - (s.disponivel ?? 0)),
      categoria: s.categoria_compra,
    }))
    .sort((a, b) => b.sugerido - a.sugerido);
  const sugestoesHistoricas = (previsao ?? [])
    .filter((p) => Number(p.qtd_sugerida_compra ?? 0) > 0)
    .map((p) => ({
      especificacao: p.especificacao,
      disponivel: Number(p.disponivel ?? 0),
      sugerido: Number(p.qtd_sugerida_compra ?? 0),
      categoria: p.categoria_compra,
    }))
    .slice(0, 8);
  const sugestoesRender = sugestoesHistoricas.length > 0 ? sugestoesHistoricas : sugestoes;

  const inp = "rounded-md border border-input bg-card px-3 py-2 text-sm font-medium text-brand-700 dark:text-brand-300"; // §8.2: entrada em azul

  return (
    <div className="min-h-dvh bg-transparent font-sans text-foreground">
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <h1 className="text-xl font-semibold tracking-tight">Compras</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Solicitação → aprovação → recebimento. O material recebido entra em
          quarentena até a aceitação.
        </p>

        {/* sugestões */}
        {(sugestoes.length > 0 || sugestoesHistoricas.length > 0) && (
          <div className="mt-6 rounded-xl border border-warning-strong/30 bg-warning-soft p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-warning-strong">
                  Sugestões de compra ({Math.max(sugestoes.length, sugestoesHistoricas.length)})
                </h2>
                <p className="mt-1 text-xs text-warning-strong">
                  Combina ponto configurado com consumo histórico, lead time e estoque de segurança.
                </p>
              </div>
              <GerarReposicaoButton />
            </div>
            <ul className="mt-2 space-y-1 text-xs text-warning-strong">
              {sugestoesRender.slice(0, 8).map((s, i) => (
                <li key={i} className="flex justify-between gap-4">
                  <span className="truncate">
                    {s.categoria === "critico" && "Critico · "}
                    {s.especificacao}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    disp. {fmt(s.disponivel)} · comprar ~{fmt(s.sugerido)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 rounded-xl border border-info-strong/30 bg-info-soft p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-info-strong">
                Reposição automática
              </h2>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-info-strong">
                A mesma rotina que será agendada no Supabase cron pode ser disparada manualmente aqui.
                Agendamento diário e e-mail externo dependem das credenciais/configuração do Supabase cron e Resend.
              </p>
            </div>
            <GerarReposicaoButton />
          </div>
        </div>

        {/* novo pedido */}
        <form action={criarPedido} className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
          <div>
            <label className="block text-xs font-medium text-muted-foreground">Fornecedor</label>
            <select aria-label="Fornecedor" name="fornecedor_id" className={`${inp} mt-1`} defaultValue="">
              <option value="">—</option>
              {(fornecedores ?? []).map((f) => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground">Projeto</label>
            <select aria-label="Projeto" name="projeto_id" className={`${inp} mt-1`} defaultValue="">
              <option value="">—</option>
              {(projetos ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-40">
            <label className="block text-xs font-medium text-muted-foreground">Campanha (texto livre)</label>
            <input aria-label="Campanha (texto livre)" name="projeto" className={`${inp} mt-1 w-full`} />
          </div>
          <button className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500">
            + Nova solicitação
          </button>
        </form>

        <div className="mt-6">
          <ComprasTable rows={linhas} />
        </div>
      </main>
    </div>
  );
}
