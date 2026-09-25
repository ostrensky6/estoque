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
import { HelpExample, HelpTip } from "@/components/common/HelpTip";
import { DownloadButton } from "@/components/common/DownloadButton";
import { SaidaAvulsaButton } from "@/components/estoque/SaidaAvulsaButton";
import {
  salvarRegistro,
  excluirRegistro,
  type FormState,
} from "@/lib/actions/cadastros";
import { corrigirQuantidadeEmbalagens } from "@/lib/actions/estoque";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate, formatNumber, formatPercent } from "@/lib/formatters";

type Registro = Record<string, unknown>;

function fmt(value: unknown, tipo?: Coluna["tipo"]) {
  if (value == null || value === "") return "—";
  switch (tipo) {
    case "currency":
      return formatCurrency(Number(value));
    case "percent":
      return formatPercent(Number(value));
    case "number":
      return formatNumber(Number(value));
    case "date":
      return formatDate(String(value));
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
  largura?: Coluna["largura"];
};

type FiltroCategorico = {
  fieldId: string;
  columnId: string;
  label: string;
  opcoes: { value: string; label: string }[];
};

const larguraClasse: Record<NonNullable<Coluna["largura"]>, string> = {
  xs: "max-w-20",
  sm: "max-w-32",
  md: "max-w-44",
  lg: "max-w-80",
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

function uniqueOptions(opcoes: { value: string; label: string }[]) {
  const seen = new Set<string>();
  return opcoes.filter((opcao) => {
    const value = String(opcao.value);
    if (value === "" || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

export function CrudShell({
  slug,
  singular,
  rotulo,
  colunas,
  campos,
  rows,
  initialFocusId,
  somenteLeitura = false,
  mascarar,
}: {
  slug: string;
  singular: string;
  rotulo: string;
  colunas: Coluna[];
  campos: Campo[];
  rows: Registro[];
  initialFocusId?: string;
  /** esconde criar/editar/excluir (ex.: técnicos sem permissão de remuneração) */
  somenteLeitura?: boolean;
  /** colunas exibidas como "XXX" */
  mascarar?: string[];
}) {
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Registro | null>(null);
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [focusApplied, setFocusApplied] = useState(false);

  const novo = useCallback(() => {
    setEditando(null);
    setAberto(true);
  }, []);
  const editar = useCallback((r: Registro) => {
    setEditando(r);
    setAberto(true);
  }, []);

  useEffect(() => {
    if (focusApplied || !initialFocusId || somenteLeitura) return;
    const registro = rows.find((row) => String(row.id) === initialFocusId);
    if (!registro) return;
    setGlobalFilter(initialFocusId);
    setEditando(registro);
    setAberto(true);
    setFocusApplied(true);
  }, [focusApplied, initialFocusId, rows, somenteLeitura]);

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
      if (mascarar?.includes(key)) return "XXX";
      const map = rotuloSelect[key];
      if (map && value != null && value !== "") return map.get(String(value)) ?? fmt(value, tipo);
      return fmt(value, tipo);
    },
    [rotuloSelect, mascarar],
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
      meta: { alinhar: c.alinhar, calculada: c.calculada, tipo: c.tipo, largura: c.largura },
    }));
    for (const campo of campos) {
      if (
        (campo.tipo === "checkbox" || campo.tipo === "select") &&
        !dataCols.some((col) => col.id === campo.name)
      ) {
        dataCols.push({
          id: campo.name,
          accessorFn: (row) => row[campo.name],
          header: campo.label,
          cell: (ctx) => exibir(campo.name, ctx.getValue(), campo.tipo),
          filterFn: categoricalFilter,
          enableSorting: false,
        });
      }
    }
    if (somenteLeitura) return dataCols;
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
  }, [campos, colunas, slug, rotulo, editar, exibir, somenteLeitura]);

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
    initialState: {
      columnVisibility: Object.fromEntries(
        campos
          .filter((campo) => !colunas.some((coluna) => coluna.key === campo.name))
          .map((campo) => [campo.name, false]),
      ),
      pagination: { pageSize: 25 },
    },
  });

  const filtrosCategoricos = useMemo<FiltroCategorico[]>(() => {
    const chavesVisiveis = new Set(colunas.map((coluna) => coluna.key));

    return campos
      .filter((campo) => campo.tipo === "checkbox" || campo.tipo === "select")
      .map((campo) => {
        let columnId = campo.name;

        if (campo.tipo === "select" && !chavesVisiveis.has(campo.name)) {
          const nomeVisivel = campo.name.replace(/_id$/, "_nome");
          if (chavesVisiveis.has(nomeVisivel)) columnId = nomeVisivel;
        }

        if (campo.tipo === "checkbox") {
          return {
            fieldId: campo.name,
            columnId,
            label: campo.label,
            opcoes: [
              { value: "true", label: "Sim" },
              { value: "false", label: "Não" },
            ],
          };
        }

        if (columnId !== campo.name) {
          return {
            fieldId: campo.name,
            columnId,
            label: campo.label,
            opcoes: uniqueOptions(
              rows
                .map((row) => row[columnId])
                .filter((value) => value != null && value !== "" && value !== "—")
                .map((value) => ({ value: String(value), label: String(value) }))
                .sort((a, b) => a.label.localeCompare(b.label, "pt-BR")),
            ),
          };
        }

        const opcoesConfiguradas = campo.opcoes?.map((opcao) => ({
          value: String(opcao.value),
          label: opcao.label,
        })) ?? [];
        const labelsPorValor = new Map(opcoesConfiguradas.map((opcao) => [opcao.value, opcao.label]));
        const opcoesDosRegistros = rows
          .map((row) => row[campo.name])
          .filter((value) => value != null && value !== "")
          .map((value) => {
            const stringValue = String(value);
            return {
              value: stringValue,
              label: labelsPorValor.get(stringValue) ?? stringValue,
            };
          });

        return {
          fieldId: campo.name,
          columnId,
          label: campo.label,
          opcoes: uniqueOptions([...opcoesConfiguradas, ...opcoesDosRegistros]).sort((a, b) =>
            a.label.localeCompare(b.label, "pt-BR"),
          ),
        };
      })
      .filter((filtro) => filtro.opcoes.length > 0);
  }, [campos, colunas, rows]);

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

        {filtrosCategoricos.map((filtro) => {
          const col = table.getColumn(filtro.columnId);
          const val = (col?.getFilterValue() as string) ?? "";
          return (
            <Select
              key={filtro.fieldId}
              value={val}
              onChange={(e) => col?.setFilterValue(e.target.value || undefined)}
              className="h-8 w-auto max-w-56 px-2 py-1.5 text-xs"
              aria-label={`Filtrar por ${filtro.label}`}
            >
              <option value="">{filtro.label}: todos</option>
              {filtro.opcoes.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          );
        })}

        <Badge variant={temFiltro ? "secondary" : "muted"}>
          {temFiltro
            ? `${totalFiltrado} de ${rows.length}`
            : `${rows.length} ${rows.length === 1 ? "registro" : "registros"}`}
        </Badge>

        {slug === "insumos" && (
          <HelpTip title="Coluna Quantidade" side="bottom">
            <p>
              Número de <b>embalagens fechadas</b> em estoque (frascos, pacotes, kits), somando os
              lotes aceitos. Não é o volume de cada embalagem.
            </p>
            <p>Para corrigir, registrar um lote novo ou dar baixa, abra o insumo.</p>
          </HelpTip>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <DownloadButton href={`/cadastros/${slug}/export`} fileName={`${slug}.xlsx`}>
            Planilha
          </DownloadButton>
          {somenteLeitura ? (
            <Badge variant="muted">Somente consulta</Badge>
          ) : (
            <Button onClick={novo}>
              <Plus />
              Novo {singular}
            </Button>
          )}
        </div>
      </div>

      {/* Tabela */}
      <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-card text-xs shadow-sm">
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
                        "h-9 px-3 py-2 text-xs",
                        alinhaDir ? "text-right" : "text-left",
                        meta?.calculada && "text-primary",
                        meta?.largura && larguraClasse[meta.largura],
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
                      ? "whitespace-nowrap px-3 py-2 text-right"
                      : cn(
                          "px-3 py-2 align-middle",
                          meta?.alinhar === "right" ? "text-right tabular-nums" : "text-left",
                          meta?.calculada && "font-medium text-primary",
                          meta?.largura && larguraClasse[meta.largura],
                        );
                  const rendered = flexRender(cell.column.columnDef.cell, cell.getContext());
                  return (
                    <TableCell key={cell.id} className={cls}>
                      <span
                        className={cn("block truncate", meta?.alinhar === "right" && "ml-auto")}
                        title={typeof rendered === "string" ? rendered : undefined}
                      >
                        {rendered}
                      </span>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={colunas.length + 1}
                  className="py-6 text-center text-muted-foreground"
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
  // Estavel enquanto o drawer ficar aberto: um reenvio (duplo clique, retry
  // de rede) usa o mesmo id e a RPC de criação devolve o resultado anterior
  // em vez de duplicar o insumo/lote.
  const [operacaoId] = useState(() => crypto.randomUUID());
  const isInsumos = slug === "insumos";
  const quantidadeModelo = isInsumos ? (registro?.quantidade_modelo as string | null | undefined) : null;
  const podeCorrigirQuantidade = isInsumos && registro?.id != null && quantidadeModelo !== "LEGADO";

  useEffect(() => {
    if (!state.ok) return;
    router.refresh();
    onClose();
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

        {isInsumos && registro?.id != null && (
          <LotesInsumoResumo
            insumoId={Number(registro.id)}
            especificacao={String(registro.especificacao ?? singular)}
            unidade={typeof registro.unidade === "string" ? registro.unidade : null}
            quantidadeAtual={Number(registro.quantidade ?? 0)}
            embalagemFechada={quantidadeModelo === "EMBALAGEM_FECHADA"}
            podeCorrigirQuantidade={podeCorrigirQuantidade}
            lotes={(registro.lotes_resumo as LoteResumo[] | undefined) ?? []}
          />
        )}

        <form action={action} className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <input type="hidden" name="_slug" value={slug} />
          <input type="hidden" name="_operacao_id" value={operacaoId} />
          {registro?.id != null && (
            <input type="hidden" name="_id" value={String(registro.id)} />
          )}

          {campos.map((c) => (
            <Fragment key={c.name}>
              {c.grupo && (
                <h3 className="mt-2 sm:col-span-2 border-b border-border pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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

          {isInsumos && !registro && (
            <>
              <h3 className="mt-2 border-b border-border pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:col-span-2">
                Estoque inicial
              </h3>
              <div>
                <div className="flex min-h-5 items-center gap-0.5">
                  <Label htmlFor="campo-quantidade" className="block">
                    Quantidade (embalagens fechadas)
                  </Label>
                  <HelpTip title="Quantidade em estoque">
                    <p>
                      Conte <b>embalagens fechadas</b> (frascos, pacotes, kits), não o volume de cada
                      uma. Entra direto no estoque, sem quarentena. Deixe 0 se ainda não houver.
                    </p>
                    <HelpExample>
                      3 frascos de 500 mL → informe <b>3</b> (não 1500).
                    </HelpExample>
                  </HelpTip>
                </div>
                <Input
                  id="campo-quantidade"
                  name="quantidade"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step="1"
                  defaultValue="0"
                  aria-invalid={state.errors?.quantidade ? true : undefined}
                  className={cn(
                    "mt-1",
                    state.errors?.quantidade && "border-destructive focus-visible:ring-destructive",
                  )}
                />
                {state.errors?.quantidade && (
                  <p className="mt-1 text-xs text-destructive">{state.errors.quantidade}</p>
                )}
              </div>
              <div>
                <div className="flex min-h-5 items-center gap-0.5">
                  <Label htmlFor="campo-codigo_lote" className="block">
                    Número do lote
                  </Label>
                  <HelpTip title="Número do lote">
                    <p>
                      Código impresso na embalagem pelo fabricante. Liga o estoque à validade (FEFO),
                      à quarentena e ao rastreio. Vale para a quantidade informada ao lado.
                    </p>
                    <HelpExample>
                      Frasco com “LOT 24B1187” → informe <b>24B1187</b>. Sem código? Deixe vazio e o
                      sistema cria um identificador.
                    </HelpExample>
                  </HelpTip>
                </div>
                <Input
                  id="campo-codigo_lote"
                  name="codigo_lote"
                  maxLength={80}
                  placeholder="Ex.: 24B1187"
                  autoComplete="off"
                  className="mt-1"
                />
              </div>
            </>
          )}

          {state.message && !state.ok && (
            <p className="rounded-md sm:col-span-2 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.message}
            </p>
          )}

          <DrawerFooter className="sm:col-span-2">
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

type LoteResumo = {
  id: number;
  codigo_lote: string | null;
  validade: string | null;
  quantidade_atual: number;
  status: string;
};

const ROTULO_STATUS_LOTE: Record<string, string> = {
  quarentena: "Quarentena",
  aceito: "Aceito",
  em_uso: "Em uso",
  bloqueado: "Bloqueado",
};

/** Seção "Lotes" da edição do insumo: saldo por lote, entrada de novo lote e saída. */
function LotesInsumoResumo({
  insumoId,
  especificacao,
  unidade,
  quantidadeAtual,
  embalagemFechada,
  podeCorrigirQuantidade,
  lotes,
}: {
  insumoId: number;
  especificacao: string;
  unidade: string | null;
  quantidadeAtual: number;
  embalagemFechada: boolean;
  podeCorrigirQuantidade: boolean;
  lotes: LoteResumo[];
}) {
  const [corrigindo, setCorrigindo] = useState(false);
  const saldo = lotes.reduce((total, lote) => total + Number(lote.quantidade_atual || 0), 0);

  return (
    <section className="mt-4 rounded-md border border-border bg-muted/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <h3 className="text-sm font-semibold">Lotes em estoque</h3>
          <HelpTip title="Lotes do insumo">
            <p>
              Cada entrada vira um lote, com número, validade e saldo próprios. O uso segue FEFO: o
              lote que vence antes sai antes.
            </p>
            <p>
              <b>+ Entrada</b> registra um lote novo (com o número do fabricante). <b>Saída</b> retira
              perda, quebra, vencido, descarte ou uso fora de plano.
            </p>
          </HelpTip>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <a href={`/estoque?entrada=${insumoId}`}>+ Entrada</a>
          </Button>
          {saldo > 0 && (
            <SaidaAvulsaButton
              insumoId={insumoId}
              especificacao={especificacao}
              unidade={unidade}
              saldo={saldo}
              embalagemFechada={embalagemFechada}
              triggerClassName="text-danger-strong hover:text-danger-strong"
            />
          )}
          {podeCorrigirQuantidade && (
            <Button type="button" size="sm" variant="ghost" onClick={() => setCorrigindo(true)}>
              Corrigir quantidade
            </Button>
          )}
        </div>
      </div>

      {lotes.length > 0 ? (
        <ul className="mt-2 divide-y divide-border rounded-md border border-border bg-card text-xs">
          {lotes.slice(0, 6).map((lote) => (
            <li key={lote.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-2.5 py-1.5">
              <a
                href={`/estoque/lotes/${lote.id}`}
                className="font-medium text-brand-700 hover:underline dark:text-brand-400"
              >
                Lote {lote.codigo_lote || lote.id}
              </a>
              <span className="text-muted-foreground">
                validade {lote.validade ? formatDate(lote.validade) : "—"}
              </span>
              <span className="tabular-nums">
                {formatNumber(lote.quantidade_atual)} {embalagemFechada ? "emb." : unidade ?? ""}
              </span>
              <Badge variant="muted">{ROTULO_STATUS_LOTE[lote.status] ?? lote.status}</Badge>
            </li>
          ))}
          {lotes.length > 6 && (
            <li className="px-2.5 py-1.5 text-muted-foreground">
              +{lotes.length - 6} lote(s) — veja todos em Estoque.
            </li>
          )}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          Nenhum lote com saldo. Quantidade atual: {quantidadeAtual}.
        </p>
      )}

      {podeCorrigirQuantidade && corrigindo && (
        <CorrigirQuantidadeDialog
          open={corrigindo}
          onOpenChange={setCorrigindo}
          insumoId={insumoId}
          quantidadeAtual={quantidadeAtual}
        />
      )}
    </section>
  );
}

function CorrigirQuantidadeDialog({
  open,
  onOpenChange,
  insumoId,
  quantidadeAtual,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  insumoId: number;
  quantidadeAtual: number;
}) {
  const router = useRouter();
  // o diálogo monta a cada abertura: cada correção é uma operação nova
  const [operacaoId] = useState(() => crypto.randomUUID());
  const [state, action, pending] = useActionState<FormState, FormData>(
    corrigirQuantidadeEmbalagens,
    { ok: false },
  );

  useEffect(() => {
    if (!state.ok) return;
    router.refresh();
    onOpenChange(false);
  }, [state.ok, router, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="max-w-sm" showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Corrigir quantidade</DialogTitle>
          <DialogDescription>
            Requer papel coordenador ou superior. A diferença fica registrada com o motivo informado
            — não sobrescreve o histórico.
          </DialogDescription>
        </DialogHeader>

        <form action={action} className="mt-2 grid gap-3">
          <input type="hidden" name="insumo_id" value={insumoId} />
          <input type="hidden" name="operacao_id" value={operacaoId} />
          <div>
            <Label className="block">Quantidade correta (embalagens fechadas)</Label>
            <Input
              name="quantidade_alvo"
              type="number"
              min={0}
              step="1"
              defaultValue={quantidadeAtual}
              className={cn(
                "mt-1",
                state.errors?.quantidade_alvo && "border-destructive focus-visible:ring-destructive",
              )}
            />
            {state.errors?.quantidade_alvo && (
              <p className="mt-1 text-xs text-destructive">{state.errors.quantidade_alvo}</p>
            )}
          </div>
          <div>
            <Label className="block">Motivo</Label>
            <Input
              name="motivo"
              placeholder="Ex.: contagem física divergente do cadastro"
              className={cn(
                "mt-1",
                state.errors?.motivo && "border-destructive focus-visible:ring-destructive",
              )}
            />
            {state.errors?.motivo && (
              <p className="mt-1 text-xs text-destructive">{state.errors.motivo}</p>
            )}
          </div>

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
            <Button disabled={pending} size="sm">
              {pending ? "Corrigindo…" : "Corrigir"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
  const span = campo.colSpan === 2 ? "sm:col-span-2" : "sm:col-span-1";
  const valorInicial = valor == null ? campo.valorPadrao : valor;
  const v = valorInicial == null ? "" : String(valorInicial);
  const inputId = `campo-${campo.name}`;
  const erroId = erro ? `${inputId}-erro` : undefined;

  return (
    <div className={span}>
      <div className="flex min-h-5 items-center gap-0.5">
        <Label htmlFor={inputId} className="block">
          {campo.label}
          {campo.obrigatorio && <span className="text-destructive"> *</span>}
        </Label>
        {campo.ajuda && (
          <HelpTip title={campo.label}>
            <p>{campo.ajuda}</p>
            {campo.exemplo && <HelpExample>{campo.exemplo}</HelpExample>}
          </HelpTip>
        )}
      </div>

      {campo.tipo === "textarea" ? (
        <Textarea
          id={inputId}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erroId}
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
          id={inputId}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erroId}
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
            id={inputId}
            name={campo.name}
            defaultChecked={valor === undefined ? Boolean(campo.padraoLigado) : Boolean(valor)}
          />
        </div>
      ) : (
        <Input
          id={inputId}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erroId}
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

      {erro && (
        <p id={erroId} className="mt-1 text-xs text-destructive">
          {erro}
        </p>
      )}
    </div>
  );
}
