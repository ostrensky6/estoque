import Link from "next/link";
import {
  arquivarNotificacao,
  marcarNotificacaoLida,
  marcarTodasNotificacoesLidas,
} from "@/lib/actions/notificacoes";
import { createClient } from "@/lib/supabase/server";

type Notificacao = {
  id: number;
  tipo: string;
  titulo: string;
  corpo: string | null;
  entidade_tipo: string | null;
  entidade_id: number | null;
  papel_destino: string | null;
  canal: string;
  status: string;
  criado_em: string;
};

function entidadeHref(item: Notificacao) {
  if (!item.entidade_tipo || !item.entidade_id) return null;
  if (item.entidade_tipo === "planejamento") return `/planejamento/${item.entidade_id}`;
  if (item.entidade_tipo === "pedido_compra") return `/compras/${item.entidade_id}`;
  if (item.entidade_tipo === "insumo") return "/cadastros/insumos";
  return null;
}

function formatarData(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function badgeClass(status: string) {
  if (status === "nao_lida") {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200";
  }
  if (status === "arquivada") {
    return "border-slate-200 bg-slate-50 text-slate-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200";
}

export default async function NotificacoesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notificacoes")
    .select(
      "id,tipo,titulo,corpo,entidade_tipo,entidade_id,papel_destino,canal,status,criado_em",
    )
    .not("status", "in", "(arquivada)")
    .order("criado_em", { ascending: false })
    .limit(80);

  const notificacoes = (data ?? []) as Notificacao[];
  const naoLidas = notificacoes.filter((item) => item.status === "nao_lida").length;
  const faltaPlano = notificacoes.filter((item) => item.tipo === "falta_plano").length;
  const reposicao = notificacoes.filter((item) => item.tipo === "reposicao").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
            Suprimentos
          </p>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-zinc-50">Notificações</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
            Faltas de estoque, reposições sugeridas e vencimentos que pedem ação operacional.
          </p>
        </div>
        {naoLidas > 0 && (
          <form action={marcarTodasNotificacoesLidas}>
            <button
              type="submit"
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Marcar todas como lidas
            </button>
          </form>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
            Não lidas
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-950 dark:text-zinc-50">{naoLidas}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
            Falta em planos
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-950 dark:text-zinc-50">{faltaPlano}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
            Reposição
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-950 dark:text-zinc-50">{reposicao}</p>
        </div>
      </div>

      {notificacoes.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          Nenhuma notificação operacional pendente.
        </div>
      ) : (
        <div className="space-y-2">
          {notificacoes.map((item) => {
            const href = entidadeHref(item);
            return (
              <article
                key={item.id}
                className="rounded-md border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badgeClass(
                          item.status,
                        )}`}
                      >
                        {item.status === "nao_lida" ? "não lida" : item.status}
                      </span>
                      <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
                        {item.tipo.replace("_", " ")} • {formatarData(item.criado_em)}
                      </span>
                    </div>
                    <h2 className="mt-2 text-base font-semibold text-slate-950 dark:text-zinc-50">
                      {item.titulo}
                    </h2>
                    {item.corpo && (
                      <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">{item.corpo}</p>
                    )}
                    <p className="mt-2 text-xs text-slate-500 dark:text-zinc-500">
                      Destino: {item.papel_destino ?? "equipe"} • Canal: {item.canal}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {href && (
                      <Link
                        href={href}
                        className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                      >
                        Abrir
                      </Link>
                    )}
                    {item.status === "nao_lida" && (
                      <form action={marcarNotificacaoLida}>
                        <input type="hidden" name="notificacao_id" value={item.id} />
                        <button
                          type="submit"
                          className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200"
                        >
                          Lida
                        </button>
                      </form>
                    )}
                    <form action={arquivarNotificacao}>
                      <input type="hidden" name="notificacao_id" value={item.id} />
                      <button
                        type="submit"
                        className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
                      >
                        Arquivar
                      </button>
                    </form>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
