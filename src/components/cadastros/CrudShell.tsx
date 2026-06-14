"use client";

import {
  Fragment,
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
  type SortingFn,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronDown, ChevronUp, ChevronsUpDown, Search } from "lucide-react";
import type { Campo, Coluna } from "@/lib/cadastros/config";
import {
  salvarRegistro,
  excluirRegistro,
  type FormState,
} from "@/lib/actions/cadastros";

type Registro = Record<string, unknown>;

const brl = (v: unknown) =>
  Number(v ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

function fmt(value: unknown, tipo?: Coluna["tipo"]) {
  if (value == null || value === "") return "—";
  switch (tipo) {
    case "currency":
      return brl(value);
    case "percent":
      return `${Number(value).toLocaleString("pt-BR")}%`;
    case "number":
      return Number(value).toLocaleString("pt-BR");
    case "checkbox":
      return value ? "Sim" : "Não";
    default:
      return String(value);
  }
}

type ColMeta = {
  alinhar?: "left" | "right";
  calculada?: boolean;
  tipo?: Coluna["tipo"];
};

/** Ordena numericamente colunas de valor/percent/número (que podem vir como string do banco). */
const numericSort: SortingFn<Registro> = (a, b, id) => {
  const x = Number(a.getValue(id) ?? 0);
  const y = Number(b.getValue(id) ?? 0);
  return x === y ? 0 : x > y ? 1 : -1;
};

/** Filtro de coluna categórica (checkbox/select): igualdade por valor. */
const categoricalFilter: FilterFn<Registro> = (row, columnId, filterValue) => {
  if (filterValue == null || filterValue === "") return true;
  const v = row.getValue(columnId);
  const s = typeof v === "boolean" ? String(v) : String(v ?? "");
  return s === String(filterValue);
};

export function CrudShell({
  slug,
  singular,
  rotulo,
  colunas,
  campos,
  rows,
}: {
  slug: string;
  singular: string;
  rotulo: string;
  colunas: Coluna[];
  campos: Campo[];
  rows: Registro[];
}) {
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Registro | null>(null);
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const novo = useCallback(() => {
    setEditando(null);
    setAberto(true);
  }, []);
  const editar = useCallback((r: Registro) => {
    setEditando(r);
    setAberto(true);
  }, []);

  const campoPorKey = useMemo(
    () => Object.fromEntries(campos.map((c) => [c.name, c])) as Record<string, Campo>,
    [campos],
  );
  const tipoPorKey = useMemo(
    () =>
      Object.fromEntries(colunas.map((c) => [c.key, c.tipo])) as Record<
        string,
        Coluna["tipo"]
      >,
    [colunas],
  );

  // mapa value->label dos campos select, p/ exibir e buscar pelo rótulo amigável
  const rotuloSelect = useMemo(() => {
    const m: Record<string, Map<string, string>> = {};
    for (const campo of campos) {
      if (campo.tipo === "select" && campo.opcoes) {
        m[campo.name] = new Map(campo.opcoes.map((o) => [String(o.value), o.label]));
      }
    }
    return m;
  }, [campos]);

  const exibir = useCallback(
    (key: string, value: unknown, tipo?: Coluna["tipo"]) => {
      const map = rotuloSelect[key];
      if (map && value != null && value !== "") return map.get(String(value)) ?? fmt(value, tipo);
      return fmt(value, tipo);
    },
    [rotuloSelect],
  );

  // busca global: casa contra o valor EXIBIDO (rótulo de select, "Sim", "R$", "%"…)
  const globalFilterFn = useCallback<FilterFn<Registro>>(
    (row, columnId, filterValue) => {
      const formatted = exibir(columnId, row.getValue(columnId), tipoPorKey[columnId]);
      return String(formatted).toLowerCase().includes(String(filterValue).toLowerCase());
    },
    [exibir, tipoPorKey],
  );

  const columns = useMemo<ColumnDef<Registro>[]>(() => {
    const dataCols: ColumnDef<Registro>[] = colunas.map((c) => ({
      id: c.key,
      accessorFn: (row) => row[c.key],
      header: c.label,
      cell: (ctx) => exibir(c.key, ctx.getValue(), c.tipo),
      enableSorting: true,
      sortingFn:
        c.tipo === "currency" || c.tipo === "number" || c.tipo === "percent"
          ? numericSort
          : "alphanumeric",
      filterFn: categoricalFilter,
      meta: { alinhar: c.alinhar, calculada: c.calculada, tipo: c.tipo },
    }));
    dataCols.push({
      id: "_acoes",
      header: "Ações",
      enableSorting: false,
      enableGlobalFilter: false,
      cell: (ctx) => (
        <>
          <button
            onClick={() => editar(ctx.row.original)}
            className="rounded px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            Editar
          </button>
          <DeleteButton
            slug={slug}
            id={ctx.row.original.id as number}
            rotulo={String(ctx.row.original[rotulo] ?? "")}
          />
        </>
      ),
    });
    return dataCols;
  }, [colunas, slug, rotulo, editar, exibir]);

  // O React Compiler não memoiza componentes que usam useReactTable (a API
  // retorna funções não-memoizáveis); o TanStack faz a própria memoização e os
  // resultados são consumidos direto no render, então é seguro.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    state: { globalFilter, sorting, columnFilters },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    globalFilterFn,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  });

  const filtrosCategoricos = colunas.filter((c) => {
    const campo = campoPorKey[c.key];
    return campo && (campo.tipo === "checkbox" || campo.tipo === "select");
  });

  const totalFiltrado = table.getFilteredRowModel().rows.length;
  const temFiltro = globalFilter !== "" || columnFilters.length > 0;
  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = table.getPageCount();

  const selectCls =
    "rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950";

  return (
    <div>
      {/* Toolbar: busca + filtros + novo */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Buscar…"
            className="w-56 rounded-md border border-zinc-300 bg-white py-2 pl-8 pr-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>

        {filtrosCategoricos.map((c) => {
          const campo = campoPorKey[c.key];
          const col = table.getColumn(c.key);
          const val = (col?.getFilterValue() as string) ?? "";
          return (
            <select
              key={c.key}
              value={val}
              onChange={(e) => col?.setFilterValue(e.target.value || undefined)}
              className={selectCls}
              aria-label={`Filtrar por ${c.label}`}
            >
              <option value="">{c.label}: todos</option>
              {campo.tipo === "checkbox" ? (
                <>
                  <option value="true">Sim</option>
                  <option value="false">Não</option>
                </>
              ) : (
                campo.opcoes?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))
              )}
            </select>
          );
        })}

        <span className="text-xs text-zinc-400">
          {temFiltro ? `${totalFiltrado} de ${rows.length}` : `${rows.length} registro(s)`}
        </span>

        <button
          onClick={novo}
          className="ml-auto rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-500"
        >
          + Novo {singular}
        </button>
      </div>

      {/* Tabela */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => {
                  const meta = header.column.columnDef.meta as ColMeta | undefined;
                  const alinhaDir = meta?.alinhar === "right" || header.column.id === "_acoes";
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      className={`px-4 py-3 ${alinhaDir ? "text-right" : "text-left"} ${meta?.calculada ? "text-emerald-600 dark:text-emerald-400" : ""}`}
                    >
                      {header.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={`inline-flex items-center gap-1 hover:text-zinc-700 dark:hover:text-zinc-200 ${alinhaDir ? "flex-row-reverse" : ""}`}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === "asc" ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : sorted === "desc" ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta as ColMeta | undefined;
                  const cls =
                    cell.column.id === "_acoes"
                      ? "px-4 py-2.5 text-right whitespace-nowrap"
                      : `px-4 py-2.5 ${meta?.alinhar === "right" ? "text-right tabular-nums" : "text-left"} ${meta?.calculada ? "font-medium text-emerald-700 dark:text-emerald-400" : ""}`;
                  return (
                    <td key={cell.id} className={cls}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td
                  colSpan={colunas.length + 1}
                  className="px-4 py-10 text-center text-zinc-400"
                >
                  {temFiltro
                    ? "Nenhum registro encontrado para a busca/filtro."
                    : `Nenhum registro. Clique em “Novo ${singular}”.`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação (só quando passa de uma página) */}
      {pageCount > 1 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <span>Linhas por página</span>
            <select
              value={pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className={selectCls}
              aria-label="Linhas por página"
            >
              {[25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
              <option value={100000}>Todos</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <span>
              Página {pageIndex + 1} de {Math.max(1, pageCount)}
            </span>
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="rounded border border-zinc-300 px-2 py-1 hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Anterior
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="rounded border border-zinc-300 px-2 py-1 hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Próxima
            </button>
          </div>
        </div>
      )}

      {aberto && (
        <Drawer
          slug={slug}
          singular={singular}
          campos={campos}
          registro={editando}
          onClose={() => setAberto(false)}
        />
      )}
    </div>
  );
}

function DeleteButton({ slug, id, rotulo }: { slug: string; id: number; rotulo: string }) {
  const router = useRouter();
  const [confirmar, setConfirmar] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(
    excluirRegistro,
    { ok: false },
  );
  useEffect(() => {
    // sucesso: a linha some no refresh e este modal desmonta junto.
    if (state.ok) router.refresh();
  }, [state, router]);

  return (
    <>
      <button
        onClick={() => setConfirmar(true)}
        className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
      >
        Excluir
      </button>

      {confirmar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !pending && setConfirmar(false)}
          />
          <div className="relative w-full max-w-sm rounded-xl bg-white p-6 text-left shadow-xl dark:bg-zinc-900">
            <h3 className="text-base font-semibold">Excluir registro</h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              Tem certeza que deseja excluir <b>“{rotulo}”</b>? Esta ação não pode
              ser desfeita.
            </p>
            {state.message && !state.ok && (
              <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
                {state.message}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmar(false)}
                disabled={pending}
                className="rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <form action={action}>
                <input type="hidden" name="_slug" value={slug} />
                <input type="hidden" name="_id" value={id} />
                <button
                  disabled={pending}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
                >
                  {pending ? "Excluindo…" : "Excluir"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Drawer({
  slug,
  singular,
  campos,
  registro,
  onClose,
}: {
  slug: string;
  singular: string;
  campos: Campo[];
  registro: Registro | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<FormState, FormData>(
    salvarRegistro,
    { ok: false },
  );

  useEffect(() => {
    if (state.ok) {
      router.refresh();
      onClose();
    }
  }, [state.ok, router, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {registro ? `Editar ${singular}` : `Novo ${singular}`}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            ✕
          </button>
        </div>

        <form action={action} className="mt-6 grid grid-cols-2 gap-4">
          <input type="hidden" name="_slug" value={slug} />
          {registro?.id != null && (
            <input type="hidden" name="_id" value={String(registro.id)} />
          )}

          {campos.map((c) => (
            <Fragment key={c.name}>
              {c.grupo && (
                <h3 className="col-span-2 mt-2 border-b border-zinc-100 pb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                  {c.grupo}
                </h3>
              )}
              <CampoInput
                campo={c}
                valor={registro?.[c.name]}
                erro={state.errors?.[c.name]}
              />
            </Fragment>
          ))}

          {state.message && !state.ok && (
            <p className="col-span-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {state.message}
            </p>
          )}

          <div className="col-span-2 mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancelar
            </button>
            <button
              disabled={pending}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {pending ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CampoInput({
  campo,
  valor,
  erro,
}: {
  campo: Campo;
  valor: unknown;
  erro?: string;
}) {
  const base =
    "mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm dark:bg-zinc-950 " +
    (erro
      ? "border-red-400 focus:border-red-500"
      : "border-zinc-300 focus:border-emerald-500 dark:border-zinc-700") +
    " focus:outline-none focus:ring-1 focus:ring-emerald-500";
  const span = campo.colSpan === 2 ? "col-span-2" : "col-span-1";
  const v = valor == null ? "" : String(valor);

  return (
    <div className={span}>
      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
        {campo.label}
        {campo.obrigatorio && <span className="text-red-500"> *</span>}
      </label>

      {campo.tipo === "textarea" ? (
        <textarea name={campo.name} defaultValue={v} rows={3} placeholder={campo.placeholder} className={base} />
      ) : campo.tipo === "select" ? (
        <select name={campo.name} defaultValue={v} className={base}>
          <option value="">—</option>
          {campo.opcoes?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : campo.tipo === "checkbox" ? (
        <div className="mt-2">
          <input
            type="checkbox"
            name={campo.name}
            defaultChecked={valor === undefined ? Boolean(campo.padraoLigado) : Boolean(valor)}
            className="h-4 w-4 rounded border-zinc-300 text-emerald-600"
          />
        </div>
      ) : (
        <input
          name={campo.name}
          defaultValue={v}
          placeholder={campo.placeholder}
          type={
            campo.tipo === "date"
              ? "date"
              : campo.tipo === "text"
                ? "text"
                : "number"
          }
          step={
            campo.step ??
            (campo.tipo === "currency"
              ? "0.01"
              : campo.tipo === "percent"
                ? "0.1"
                : undefined)
          }
          min={campo.min}
          max={campo.max}
          className={base}
        />
      )}

      {erro ? (
        <p className="mt-1 text-xs text-red-600">{erro}</p>
      ) : campo.ajuda ? (
        <p className="mt-1 text-xs text-zinc-400">{campo.ajuda}</p>
      ) : null}
    </div>
  );
}
