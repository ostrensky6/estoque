"use client";

import { useActionState, useState, useTransition } from "react";
import { MoreHorizontal } from "lucide-react";

import { alternarSuspensao, editarUsuario, excluirUsuario, resetarSenha } from "@/lib/actions/usuarios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FormState } from "@/lib/actions/cadastros";
import type { UsuarioRow } from "./UsuariosTable";

const PAPEIS = [
  { value: "tecnico", label: "Técnico" },
  { value: "coordenador", label: "Coordenador" },
  { value: "gestor", label: "Gestor" },
  { value: "admin", label: "Admin" },
];

const initial: FormState = { ok: false, message: "" };

type DialogAberto = "editar" | "resetar" | "excluir" | null;

function EditarDialog({
  row,
  open,
  onOpenChange,
}: {
  row: UsuarioRow;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [erro, setErro] = useState("");
  const [pending, startTransition] = useTransition();

  function handle(formData: FormData) {
    startTransition(async () => {
      const res = await editarUsuario(initial, formData);
      if (res.ok) {
        setErro("");
        onOpenChange(false);
      } else {
        setErro(res.message ?? "Não foi possível salvar.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar usuário</DialogTitle>
          <DialogDescription>{row.email}</DialogDescription>
        </DialogHeader>
        <form action={handle} className="space-y-4">
          <input type="hidden" name="id" value={row.id} />
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Nome</label>
            <Input name="nome" defaultValue={row.nome === "—" ? "" : row.nome} className="mt-1" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Papel</label>
            <Select name="papel" defaultValue={row.papel} className="mt-1 h-9">
              {PAPEIS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>
          {erro && <p className="text-xs text-red-600">{erro}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetarDialog({
  row,
  open,
  onOpenChange,
}: {
  row: UsuarioRow;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [state, action, pending] = useActionState(resetarSenha, initial);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resetar senha</DialogTitle>
          <DialogDescription>
            Define uma senha provisória para {row.email}. No próximo acesso ele será obrigado a criar
            uma nova senha.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={row.id} />
          <input type="hidden" name="email" value={row.email} />
          {state.message && (
            <p className={`text-xs ${state.ok ? "text-brand-700 dark:text-brand-300" : "text-red-600"}`}>
              {state.message}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={pending || state.ok}>
              {pending ? "Resetando…" : state.ok ? "Senha resetada" : "Confirmar reset"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ExcluirDialog({
  row,
  open,
  onOpenChange,
}: {
  row: UsuarioRow;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [state, action, pending] = useActionState(excluirUsuario, initial);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir usuário</DialogTitle>
          <DialogDescription>
            Esta ação é irreversível. {row.email} perderá o acesso e o cadastro será removido. O
            histórico de auditoria das ações dele é preservado.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={row.id} />
          <input type="hidden" name="email" value={row.email} />
          {state.message && !state.ok && <p className="text-xs text-red-600">{state.message}</p>}
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Excluindo…" : "Excluir definitivamente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function UsuarioAcoes({ row }: { row: UsuarioRow }) {
  const [dialog, setDialog] = useState<DialogAberto>(null);
  const [, startTransition] = useTransition();

  function suspender() {
    const fd = new FormData();
    fd.set("id", row.id);
    fd.set("suspender", row.suspenso ? "0" : "1");
    startTransition(() => alternarSuspensao(fd));
  }

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Ações do usuário">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setDialog("editar")}>Editar</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog("resetar")}>Resetar senha</DropdownMenuItem>
          <DropdownMenuItem onSelect={suspender}>
            {row.suspenso ? "Reativar" : "Suspender"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setDialog("excluir")}
            className="text-red-600 focus:text-red-600"
          >
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditarDialog row={row} open={dialog === "editar"} onOpenChange={(v) => setDialog(v ? "editar" : null)} />
      <ResetarDialog row={row} open={dialog === "resetar"} onOpenChange={(v) => setDialog(v ? "resetar" : null)} />
      <ExcluirDialog row={row} open={dialog === "excluir"} onOpenChange={(v) => setDialog(v ? "excluir" : null)} />
    </div>
  );
}
