"use client";

import { useActionState, useState, useTransition } from "react";
import { MoreHorizontal } from "lucide-react";

import { alternarSuspensao, criarUsuarioPreAprovado, editarUsuario, excluirUsuario, resetarSenha } from "@/lib/actions/usuarios";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { PERMISSOES, PAPEIS, normalizePermissions } from "@/lib/auth/permissions";
import type { FormState } from "@/lib/actions/cadastros";
import { AssinaturaUsuarioForm } from "./AssinaturaUsuarioForm";
import type { UsuarioRow } from "./UsuariosTable";

const initial: FormState = { ok: false, message: "" };

type DialogAberto = "editar" | "assinatura" | "resetar" | "apagar" | "pre_aprovar" | null;

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
  const [papel, setPapel] = useState(row.papel);
  const permissoes = normalizePermissions(papel, row.permissoes);

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
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Categoria</label>
            <Select name="papel" value={papel} onChange={(event) => setPapel(event.target.value)} className="mt-1 h-9">
              {PAPEIS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Permissões efetivas</p>
            <div className="grid gap-2 md:grid-cols-2">
              {PERMISSOES.map((permissao) => (
                <label
                  key={permissao.key}
                  className="flex items-start gap-2 rounded-md border border-zinc-200 p-2 text-xs dark:border-zinc-800"
                >
                  <Checkbox
                    key={`${papel}-${permissao.key}`}
                    name="permissoes"
                    value={permissao.key}
                    defaultChecked={Boolean(permissoes[permissao.key])}
                    disabled={papel === "admin"}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block font-semibold text-zinc-800 dark:text-zinc-100">
                      {permissao.modulo} · {permissao.label}
                    </span>
                    <span className="block leading-4 text-zinc-500">{permissao.descricao}</span>
                  </span>
                </label>
              ))}
            </div>
            {papel === "admin" && (
              <p className="text-xs text-zinc-500">Administradores sempre recebem todas as permissões.</p>
            )}
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

function AssinaturaDialog({
  row,
  open,
  onOpenChange,
}: {
  row: UsuarioRow;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload da assinatura</DialogTitle>
          <DialogDescription>
            Envie a assinatura PNG de {row.nome}. O app remove fundo claro e usa a assinatura automaticamente na proposta emitida por esse usuário.
          </DialogDescription>
        </DialogHeader>
        <AssinaturaUsuarioForm
          userId={row.id}
          assinaturaPath={row.assinaturaPath}
          assinaturaUrl={row.assinaturaUrl}
        />
      </DialogContent>
    </Dialog>
  );
}

export function UploadAssinaturaButton({ row }: { row: UsuarioRow }) {
  const [open, setOpen] = useState(false);
  if (!row.temAcesso) {
    return <span className="text-xs text-zinc-400">Após cadastro</span>;
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        {row.assinaturaUrl ? "Trocar" : "Upload"}
      </Button>
      <AssinaturaDialog row={row} open={open} onOpenChange={setOpen} />
    </>
  );
}

function PreAprovarDialog({
  row,
  open,
  onOpenChange,
}: {
  row: UsuarioRow;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [state, action, pending] = useActionState(criarUsuarioPreAprovado, initial);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cadastrar acesso pré-aprovado</DialogTitle>
          <DialogDescription>
            Cria a conta de {row.email} no Auth com senha provisória e categoria {row.papelLabel}.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="pre_aprovado_id" value={row.preAprovadoId ?? ""} />
          {state.message && (
            <p className={`text-xs ${state.ok ? "text-brand-700 dark:text-brand-300" : "text-red-600"}`}>
              {state.message}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending || state.ok}>
              {pending ? "Cadastrando..." : state.ok ? "Acesso criado" : "Cadastrar acesso"}
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
          <DialogTitle>Resetar senha inicial</DialogTitle>
          <DialogDescription>
            Volta {row.email} para a senha de primeiro acesso. No próximo login ele será obrigado a criar uma senha definitiva.
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
              {pending ? "Resetando…" : state.ok ? "Senha resetada" : "Voltar para senha inicial"}
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
          <DialogTitle>Apagar usuário</DialogTitle>
          <DialogDescription>
            Esta ação é irreversível. {row.email} perderá o acesso e o cadastro será apagado. O
            histórico de auditoria das ações dele é preservado.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={row.id} />
          <input type="hidden" name="email" value={row.email} />
          {state.message && !state.ok && <p className="text-xs text-red-600">{state.message}</p>}
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Apagando…" : "Apagar definitivamente"}
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
          {!row.temAcesso ? (
            <DropdownMenuItem onSelect={() => setDialog("pre_aprovar")}>Cadastrar acesso</DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuItem onSelect={() => setDialog("editar")}>Editar</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDialog("assinatura")}>Upload assinatura</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDialog("resetar")}>Resetar senha inicial</DropdownMenuItem>
              <DropdownMenuItem onSelect={suspender}>
                {row.suspenso ? "Reativar" : "Suspender"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => setDialog("apagar")}
                className="text-red-600 focus:text-red-600"
              >
                Apagar
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {row.temAcesso && (
        <>
          <EditarDialog row={row} open={dialog === "editar"} onOpenChange={(v) => setDialog(v ? "editar" : null)} />
          <AssinaturaDialog row={row} open={dialog === "assinatura"} onOpenChange={(v) => setDialog(v ? "assinatura" : null)} />
          <ResetarDialog row={row} open={dialog === "resetar"} onOpenChange={(v) => setDialog(v ? "resetar" : null)} />
          <ExcluirDialog row={row} open={dialog === "apagar"} onOpenChange={(v) => setDialog(v ? "apagar" : null)} />
        </>
      )}
      {!row.temAcesso && (
        <PreAprovarDialog row={row} open={dialog === "pre_aprovar"} onOpenChange={(v) => setDialog(v ? "pre_aprovar" : null)} />
      )}
    </div>
  );
}
