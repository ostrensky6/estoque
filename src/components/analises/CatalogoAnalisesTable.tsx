import { atualizarCatalogoAnalise } from "@/lib/actions/receita";

export type CatalogoAnaliseRow = {
  codigo: string;
  nomeSimplificado: string;
  descricao: string;
  status: string;
};

const inp =
  "w-full rounded-md border border-input bg-card px-2 py-1.5 text-sm font-medium text-brand-700 dark:text-brand-300"; // §8.2: entrada em azul
const lbl = "mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground/80 sm:sr-only";

export function CatalogoAnalisesTable({ rows }: { rows: CatalogoAnaliseRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      {/* cabeçalho (apenas em telas largas) */}
      <div className="hidden grid-cols-12 gap-2 border-b border-border bg-muted/50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
        <div className="col-span-3">Nome simplificado</div>
        <div className="col-span-2">Variável</div>
        <div className="col-span-4">Descrição</div>
        <div className="col-span-2">Status</div>
        <div className="col-span-1 text-right">Ação</div>
      </div>

      {rows.length === 0 && (
        <p className="px-3 py-4 text-sm text-muted-foreground/80">Nenhuma análise cadastrada.</p>
      )}

      {rows.map((r) => (
        <form
          key={r.codigo}
          action={atualizarCatalogoAnalise}
          className="grid grid-cols-1 gap-2 border-b border-border/70 px-3 py-3 last:border-b-0 sm:grid-cols-12 sm:items-center"
        >
          <input type="hidden" name="codigo" value={r.codigo} />
          <div className="sm:col-span-3">
            <label htmlFor={`nome_simplificado-${r.codigo}`} className={lbl}>Nome simplificado</label>
            <input id={`nome_simplificado-${r.codigo}`} name="nome_simplificado" defaultValue={r.nomeSimplificado} className={inp} />
          </div>
          <div className="sm:col-span-2">
            <label className={lbl}>Variável</label>
            <code className="block truncate rounded bg-muted px-2 py-1.5 font-mono text-xs text-foreground">
              {r.codigo}
            </code>
          </div>
          <div className="sm:col-span-4">
            <label htmlFor={`descricao-${r.codigo}`} className={lbl}>Descrição</label>
            <input id={`descricao-${r.codigo}`} name="descricao" defaultValue={r.descricao} className={inp} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor={`status-${r.codigo}`} className={lbl}>Status</label>
            <input id={`status-${r.codigo}`} name="status" defaultValue={r.status} className={inp} />
          </div>
          <div className="sm:col-span-1 sm:text-right">
            <button className="w-full rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-muted sm:w-auto">
              Salvar
            </button>
          </div>
        </form>
      ))}
    </div>
  );
}
