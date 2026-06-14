"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { atualizarPapel } from "@/lib/actions/usuarios";
import { DataTable } from "@/components/common/DataTable";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

const PAPEIS = [
  { value: "tecnico", label: "Técnico" },
  { value: "coordenador", label: "Coordenador" },
  { value: "gestor", label: "Gestor" },
  { value: "admin", label: "Admin" },
];

export type UsuarioRow = {
  id: string;
  nome: string;
  email: string;
  papel: string;
  papelLabel: string;
};

const columns: ColumnDef<UsuarioRow, unknown>[] = [
  { accessorKey: "nome", header: "Usuário" },
  { accessorKey: "email", header: "E-mail" },
  {
    accessorKey: "papelLabel",
    header: "Papel",
    filterFn: "equalsString",
    cell: ({ row }) => (
      <form action={atualizarPapel} className="flex items-center gap-2">
        <input type="hidden" name="id" value={row.original.id} />
        <Select name="papel" defaultValue={row.original.papel} className="h-8 w-auto text-xs">
          {PAPEIS.map((papel) => (
            <option key={papel.value} value={papel.value}>
              {papel.label}
            </option>
          ))}
        </Select>
        <Button size="sm">Salvar</Button>
      </form>
    ),
  },
];

export function UsuariosTable({ rows }: { rows: UsuarioRow[] }) {
  return (
    <DataTable
      data={rows}
      columns={columns}
      searchPlaceholder="Buscar usuário ou e-mail..."
      emptyText="Nenhum usuário encontrado."
      filters={[
        {
          columnId: "papelLabel",
          label: "Papel",
          options: PAPEIS.map((papel) => ({ value: papel.label, label: papel.label })),
        },
      ]}
      getMobileTitle={(row) => row.nome}
      getMobileDescription={(row) => `${row.email} · ${row.papelLabel}`}
    />
  );
}
