"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/common/DataTable";
import { Badge } from "@/components/ui/badge";
import { UsuarioAcoes } from "./UsuarioAcoes";

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
  suspenso: boolean;
  senhaProvisoria: boolean;
};

function statusTexto(row: UsuarioRow) {
  if (row.suspenso) return "Suspenso";
  if (row.senhaProvisoria) return "Senha provisória";
  return "Ativo";
}

const columns: ColumnDef<UsuarioRow, unknown>[] = [
  { accessorKey: "nome", header: "Usuário" },
  { accessorKey: "email", header: "E-mail" },
  { accessorKey: "papelLabel", header: "Papel", filterFn: "equalsString" },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => {
      const r = row.original;
      if (r.suspenso) return <Badge variant="secondary">Suspenso</Badge>;
      if (r.senhaProvisoria) return <Badge variant="muted">Senha provisória</Badge>;
      return <Badge variant="outline">Ativo</Badge>;
    },
  },
  {
    id: "acoes",
    header: () => <span className="sr-only">Ações</span>,
    cell: ({ row }) => <UsuarioAcoes row={row.original} />,
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
      getMobileDescription={(row) => `${row.email} · ${row.papelLabel} · ${statusTexto(row)}`}
    />
  );
}
