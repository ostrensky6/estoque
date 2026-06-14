"use client";

import * as React from "react";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronDown, ChevronUp, ChevronsUpDown, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type DataTableFilter = {
  columnId: string;
  label: string;
  options: { value: string; label: string }[];
};

type DataTableMeta = {
  align?: "left" | "center" | "right";
  className?: string;
};

type DataTableProps<TData> = {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  searchPlaceholder?: string;
  emptyText?: string;
  emptyTitle?: string;
  emptyAction?: React.ReactNode;
  filters?: DataTableFilter[];
  getMobileTitle?: (row: TData) => React.ReactNode;
  getMobileDescription?: (row: TData) => React.ReactNode;
  getMobileMeta?: (row: TData) => React.ReactNode;
  pageSize?: number;
};

const fuzzyTextFilter: FilterFn<unknown> = (row, columnId, filterValue) =>
  String(row.getValue(columnId) ?? "")
    .toLowerCase()
    .includes(String(filterValue ?? "").toLowerCase());

const categoricalFilter: FilterFn<unknown> = (row, columnId, filterValue) => {
  if (filterValue == null || filterValue === "") return true;
  return String(row.getValue(columnId) ?? "") === String(filterValue);
};

export const numericSort = (a: { getValue: (id: string) => unknown }, b: { getValue: (id: string) => unknown }, id: string) => {
  const x = Number(a.getValue(id) ?? 0);
  const y = Number(b.getValue(id) ?? 0);
  return x === y ? 0 : x > y ? 1 : -1;
};

function normalize(value: unknown) {
  if (value == null) return "";
  if (typeof value === "object") return "";
  return String(value).toLowerCase();
}

export function DataTable<TData>({
  columns,
  data,
  searchPlaceholder = "Buscar...",
  emptyText = "Nenhum registro encontrado.",
  emptyTitle = "Nada para mostrar",
  emptyAction,
  filters = [],
  getMobileTitle,
  getMobileDescription,
  getMobileMeta,
  pageSize = 25,
}: DataTableProps<TData>) {
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

  const globalFilterFn = React.useCallback<FilterFn<TData>>(
    (row, _columnId, filterValue) => {
      const needle = String(filterValue ?? "").toLowerCase();
      if (!needle) return true;
      return row
        .getAllCells()
        .some((cell) => normalize(cell.getValue()).includes(needle));
    },
    [],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    defaultColumn: {
      filterFn: fuzzyTextFilter as FilterFn<TData>,
    },
    state: { globalFilter, sorting, columnFilters },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    globalFilterFn,
    filterFns: { categorical: categoricalFilter },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  const totalFiltrado = table.getFilteredRowModel().rows.length;
  const temFiltro = globalFilter !== "" || columnFilters.length > 0;
  const { pageIndex } = table.getState().pagination;
  const pageCount = table.getPageCount();

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
            placeholder={searchPlaceholder}
            className="pl-8"
          />
        </div>

        {filters.map((filter) => {
          const column = table.getColumn(filter.columnId);
          const value = (column?.getFilterValue() as string | undefined) ?? "";
          return (
            <Select
              key={filter.columnId}
              value={value}
              onChange={(event) => column?.setFilterValue(event.target.value || undefined)}
              className="h-9 w-auto min-w-36 text-xs"
              aria-label={`Filtrar por ${filter.label}`}
            >
              <option value="">{filter.label}: todos</option>
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          );
        })}

        <Badge variant={temFiltro ? "secondary" : "muted"} className="ml-auto">
          {temFiltro ? `${totalFiltrado} de ${data.length}` : `${data.length} registro(s)`}
        </Badge>
      </div>

      <div className="mt-4 hidden overflow-x-auto rounded-lg border border-border bg-card shadow-sm md:block">
        <Table>
          <TableHeader className="bg-muted/60">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  const meta = header.column.columnDef.meta as DataTableMeta | undefined;
                  const align = meta?.align ?? "left";
                  const sorted = header.column.getIsSorted();
                  return (
                    <TableHead
                      key={header.id}
                      scope="col"
                      className={cn(
                        align === "right" && "text-right",
                        align === "center" && "text-center",
                        meta?.className,
                      )}
                    >
                      {header.column.getCanSort() ? (
                        <Tooltip content={`Ordenar por ${String(header.column.columnDef.header)}`}>
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className={cn(
                              "inline-flex items-center gap-1 hover:text-foreground",
                              align === "right" && "flex-row-reverse",
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
                  const meta = cell.column.columnDef.meta as DataTableMeta | undefined;
                  return (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        meta?.align === "right" && "text-right tabular-nums",
                        meta?.align === "center" && "text-center",
                        meta?.className,
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-10 text-center text-muted-foreground"
                >
                  <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <Search className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <p className="font-medium text-foreground">{emptyTitle}</p>
                    <p className="text-sm">{emptyText}</p>
                    {emptyAction}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 grid gap-3 md:hidden">
        {table.getRowModel().rows.map((row) => (
          <div key={row.id} className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">{getMobileTitle?.(row.original) ?? row.id}</div>
                {getMobileDescription && (
                  <div className="mt-1 text-sm text-muted-foreground">
                    {getMobileDescription(row.original)}
                  </div>
                )}
              </div>
              {getMobileMeta && <div className="shrink-0">{getMobileMeta(row.original)}</div>}
            </div>
          </div>
        ))}
        {table.getRowModel().rows.length === 0 && (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Search className="h-4 w-4" aria-hidden="true" />
              </div>
              <p className="font-medium text-foreground">{emptyTitle}</p>
              <p>{emptyText}</p>
              {emptyAction}
            </div>
          </div>
        )}
      </div>

      {pageCount > 1 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Linhas por página</span>
            <Select
              value={String(table.getState().pagination.pageSize)}
              onChange={(event) => table.setPageSize(Number(event.target.value))}
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
    </div>
  );
}
