import { atualizarCatalogoAnalise } from "@/lib/actions/receita";

export type CatalogoAnaliseRow = {
  codigo: string;
  nomeSimplificado: string;
  descricao: string;
  status: string;
};

const inp =
  "w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm font-medium text-brand-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-brand-300"; // §8.2: entrada em azul
const lbl = "mb-1 block text-[10px] uppercase tracking-wide text-zinc-400 sm:hidden";

export function CatalogoAnalisesTable({ rows }: { rows: CatalogoAnaliseRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {/* cabeçalho (apenas em telas largas) */}
      <div className="hidden grid-cols-12 gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 sm:grid dark:border-zinc-800 dark:bg-zinc-800/50">
        <div className="col-span-3">Nome simplificado</div>
        <div className="col-span-2">Variável</div>
        <div className="col-span-4">Descrição</div>
        <div className="col-span-2">Status</div>
        <div className="col-span-1 text-right">Ação</div>
      </div>

      {rows.length === 0 && (
        <p className="px-3 py-4 text-sm text-zinc-400">Nenhuma análise cadastrada.</p>
      )}

      {rows.map((r) => (
        <form
          key={r.codigo}
          action={atualizarCatalogoAnalise}
          className="grid grid-cols-1 gap-2 border-b border-zinc-100 px-3 py-3 last:border-b-0 sm:grid-cols-12 sm:items-center dark:border-zinc-800"
        >
          <input type="hidden" name="codigo" value={r.codigo} />
          <div className="sm:col-span-3">
            <label className={lbl}>Nome simplificado</label>
            <input name="nome_simplificado" defaultValue={r.nomeSimplificado} className={inp} />
          </div>
          <div className="sm:col-span-2">
            <label className={lbl}>Variável</label>
            <code className="block truncate rounded bg-zinc-100 px-2 py-1.5 font-mono text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {r.codigo}
            </code>
          </div>
          <div className="sm:col-span-4">
            <label className={lbl}>Descrição</label>
            <input name="descricao" defaultValue={r.descricao} className={inp} />
          </div>
          <div className="sm:col-span-2">
            <label className={lbl}>Status</label>
            <input name="status" defaultValue={r.status} className={inp} />
          </div>
          <div className="sm:col-span-1 sm:text-right">
            <button className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 sm:w-auto dark:border-zinc-700 dark:hover:bg-zinc-800">
              Salvar
            </button>
          </div>
        </form>
      ))}
    </div>
  );
}
