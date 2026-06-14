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
import { ChevronDown, ChevronUp, ChevronsUpDown, MoreHorizontal, Plus, Search } from "lucide-react";
import type { Campo, Coluna } from "@/lib/cadastros/config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip } from "@/components/ui/tooltip";
import {
  salvarRegistro,
  excluirRegistro,
  type FormState,
} from "@/lib/actions/cadastros";
import { cn } from "@/lib/utils";

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
        <RowActions
          onEdit={() => editar(ctx.row.original)}
          slug={slug}
          id={ctx.row.original.id as number}
          rotulo={String(ctx.row.original[rotulo] ?? "")}
        />
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

  return (
    <div>
      {/* Toolbar: busca + filtros + novo */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Buscar…"
            className="w-56 pl-8"
          />
        </div>

        {filtrosCategoricos.map((c) => {
          const campo = campoPorKey[c.key];
          const col = table.getColumn(c.key);
          const val = (col?.getFilterValue() as string) ?? "";
          return (
            <Select
              key={c.key}
              value={val}
              onChange={(e) => col?.setFilterValue(e.target.value || undefined)}
              className="h-8 w-auto px-2 py-1.5 text-xs"
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
            </Select>
          );
        })}

        <Badge variant={temFiltro ? "secondary" : "muted"}>
          {temFiltro ? `${totalFiltrado} de ${rows.length}` : `${rows.length} registro(s)`}
        </Badge>

        <Button onClick={novo} className="ml-auto">
          <Plus />
          Novo {singular}
        </Button>
      </div>

      {/* Tabela */}
      <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
        <Table>
          <TableHeader className="bg-muted/60">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((header) => {
                  const meta = header.column.columnDef.meta as ColMeta | undefined;
                  const alinhaDir = meta?.alinhar === "right" || header.column.id === "_acoes";
                  const sorted = header.column.getIsSorted();
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        alinhaDir ? "text-right" : "text-left",
                        meta?.calculada && "text-primary",
                      )}
                    >
                      {header.column.getCanSort() ? (
                        <Tooltip content={`Ordenar por ${String(header.column.columnDef.header)}`}>
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className={cn(
                              "inline-flex items-center gap-1 hover:text-foreground",
                              alinhaDir && "flex-row-reverse",
                            )}
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
                        </Tooltip>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta as ColMeta | undefined;
                  const cls =
                    cell.column.id === "_acoes"
                      ? "text-right whitespace-nowrap"
                      : cn(
                          meta?.alinhar === "right" ? "text-right tabular-nums" : "text-left",
                          meta?.calculada && "font-medium text-primary",
                        );
                  return (
                    <TableCell key={cell.id} className={cls}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={colunas.length + 1}
                  className="py-10 text-center text-muted-foreground"
                >
                  {temFiltro
                    ? "Nenhum registro encontrado para a busca/filtro."
                    : `Nenhum registro. Clique em “Novo ${singular}”.`}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginação (só quando passa de uma página) */}
      {pageCount > 1 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Linhas por página</span>
            <Select
              value={pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className="h-8 w-auto px-2 py-1.5 text-xs"
              aria-label="Linhas por página"
            >
              {[25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
              <option value={100000}>Todos</option>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <span>
              Página {pageIndex + 1} de {Math.max(1, pageCount)}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}

      {aberto && (
        <CadastroDrawer
          open={aberto}
          slug={slug}
          singular={singular}
          campos={campos}
          registro={editando}
          onOpenChange={setAberto}
          onClose={() => setAberto(false)}
        />
      )}
    </div>
  );
}

function RowActions({
  onEdit,
  slug,
  id,
  rotulo,
}: {
  onEdit: () => void;
  slug: string;
  id: number;
  rotulo: string;
}) {
  const [confirmar, setConfirmar] = useState(false);

  return (
    <>
      <DropdownMenu>
        <Tooltip content="Ações do registro">
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" aria-label="Abrir ações do registro">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
        </Tooltip>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onEdit}>Editar</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmar(true)}>
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteRegistroDialog
        open={confirmar}
        onOpenChange={setConfirmar}
        slug={slug}
        id={id}
        rotulo={rotulo}
      />
    </>
  );
}

function DeleteRegistroDialog({
  open,
  onOpenChange,
  slug,
  id,
  rotulo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  id: number;
  rotulo: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<FormState, FormData>(
    excluirRegistro,
    { ok: false },
  );
  useEffect(() => {
    // sucesso: a linha some no refresh e este modal desmonta junto.
    if (state.ok) router.refresh();
  }, [state, router]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !pending && onOpenChange(nextOpen)}>
      <DialogContent className="max-w-sm" showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Excluir registro</DialogTitle>
          <DialogDescription>
            Tem certeza que deseja excluir <b>“{rotulo}”</b>? Esta ação não pode
            ser desfeita.
          </DialogDescription>
        </DialogHeader>
        {state.message && !state.ok && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {state.message}
          </p>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <form action={action}>
            <input type="hidden" name="_slug" value={slug} />
            <input type="hidden" name="_id" value={id} />
            <Button disabled={pending} variant="destructive" size="sm">
              {pending ? "Excluindo…" : "Excluir"}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CadastroDrawer({
  open,
  slug,
  singular,
  campos,
  registro,
  onOpenChange,
  onClose,
}: {
  open: boolean;
  slug: string;
  singular: string;
  campos: Campo[];
  registro: Registro | null;
  onOpenChange: (open: boolean) => void;
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
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>
            {registro ? `Editar ${singular}` : `Novo ${singular}`}
          </DrawerTitle>
          <DrawerDescription className="sr-only">
            Preencha os campos obrigatórios e salve para atualizar o cadastro.
          </DrawerDescription>
        </DrawerHeader>

        <form action={action} className="mt-6 grid grid-cols-2 gap-4">
          <input type="hidden" name="_slug" value={slug} />
          {registro?.id != null && (
            <input type="hidden" name="_id" value={String(registro.id)} />
          )}

          {campos.map((c) => (
            <Fragment key={c.name}>
              {c.grupo && (
                <h3 className="col-span-2 mt-2 border-b border-border pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
            <p className="col-span-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.message}
            </p>
          )}

          <DrawerFooter className="col-span-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button disabled={pending}>
              {pending ? "Salvando…" : "Salvar"}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
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
    "mt-1 " +
    (erro
      ? "border-destructive focus-visible:ring-destructive"
      : "");
  const span = campo.colSpan === 2 ? "col-span-2" : "col-span-1";
  const v = valor == null ? "" : String(valor);

  return (
    <div className={span}>
      <Label className="block">
        {campo.label}
        {campo.obrigatorio && <span className="text-destructive"> *</span>}
      </Label>

      {campo.tipo === "textarea" ? (
        <Textarea
          name={campo.name}
          defaultValue={v}
          rows={3}
          placeholder={campo.placeholder}
          className={cn(
            "mt-1",
            erro && "border-destructive focus-visible:ring-destructive",
          )}
        />
      ) : campo.tipo === "select" ? (
        <Select
          name={campo.name}
          defaultValue={v}
          className={cn(
            "mt-1",
            erro && "border-destructive focus-visible:ring-destructive",
          )}
        >
          <option value="">—</option>
          {campo.opcoes?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      ) : campo.tipo === "checkbox" ? (
        <div className="mt-2">
          <Checkbox
            name={campo.name}
            defaultChecked={valor === undefined ? Boolean(campo.padraoLigado) : Boolean(valor)}
          />
        </div>
      ) : (
        <Input
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
        <p className="mt-1 text-xs text-destructive">{erro}</p>
      ) : campo.ajuda ? (
        <p className="mt-1 text-xs text-muted-foreground">{campo.ajuda}</p>
      ) : null}
    </div>
  );
}
