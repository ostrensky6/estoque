import { formatDateTime as quando } from "@/lib/formatters";

type Evento = {
  id: number;
  de_status: string | null;
  para_status: string;
  usuario: string | null;
  observacao: string | null;
  criado_em: string;
};

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aprovado: "Aprovado",
  recusado: "Recusado",
  solicitado: "Solicitado",
  em_transito: "Em trânsito",
  recebido: "Recebido",
  cancelado: "Cancelado",
};

const rotulo = (s: string | null) => (s ? STATUS_LABEL[s] ?? s : null);

/** Linha do tempo de transições de status (Fase 3.4). */
export function Timeline({ eventos }: { eventos: Evento[] }) {
  if (eventos.length === 0) {
    return <p className="text-sm text-zinc-400">Sem eventos registrados ainda.</p>;
  }
  return (
    <ol className="space-y-3">
      {eventos.map((e) => (
        <li key={e.id} className="flex gap-3">
          <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
          <div className="min-w-0">
            <p className="text-sm">
              {rotulo(e.de_status) && (
                <span className="text-zinc-500">{rotulo(e.de_status)} → </span>
              )}
              <span className="font-medium">{rotulo(e.para_status)}</span>
            </p>
            <p className="text-xs text-zinc-500">
              {quando(e.criado_em)}
              {e.usuario ? ` · ${e.usuario}` : ""}
            </p>
            {e.observacao && (
              <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">{e.observacao}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
