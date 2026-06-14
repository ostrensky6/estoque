"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer, RefreshCw, Search, type LucideIcon } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { NavGroup } from "@/components/layout/SideNav";

type QuickAction = {
  id: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  run: () => void;
};

/** Paleta de comandos (⌘K / Ctrl+K): busca e navegação rápida. */
export function CommandPalette({ groups }: { groups: NavGroup[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  React.useEffect(() => {
    function onOpenCommand() {
      setOpen(true);
    }

    window.addEventListener("kontrol:open-command-palette", onOpenCommand);
    return () => window.removeEventListener("kontrol:open-command-palette", onOpenCommand);
  }, []);

  function ir(href: string) {
    setOpen(false);
    router.push(href);
  }

  const quickActions = React.useMemo<QuickAction[]>(
    () => [
      {
        id: "refresh",
        label: "Atualizar dados da página",
        desc: "Recarrega os Server Components da rota atual",
        icon: RefreshCw,
        run: () => {
          setOpen(false);
          router.refresh();
        },
      },
      {
        id: "back",
        label: "Voltar",
        desc: "Retorna para a página anterior do histórico",
        icon: ArrowLeft,
        run: () => {
          setOpen(false);
          window.history.back();
        },
      },
      {
        id: "print",
        label: "Imprimir página atual",
        desc: "Abre a impressão do navegador",
        icon: Printer,
        run: () => {
          setOpen(false);
          window.print();
        },
      },
    ],
    [router],
  );

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed inset-x-0 top-[12vh] z-50 mx-auto w-[92%] max-w-2xl overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0"
        >
          <Dialog.Title className="sr-only">Buscar e navegar</Dialog.Title>
          <Dialog.Description className="sr-only">
            Pesquise páginas e ações; use as setas e Enter.
          </Dialog.Description>
          <Command>
            <div className="flex items-center border-b border-border pr-3">
              <div className="min-w-0 flex-1">
                <CommandInput placeholder="Buscar páginas e ações..." />
              </div>
              <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground sm:inline-flex">
                Esc
              </kbd>
            </div>
            <CommandList className="max-h-[60vh]">
              <CommandEmpty>Nada encontrado.</CommandEmpty>
              <CommandGroup heading="Ações rápidas">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <CommandItem
                      key={action.id}
                      value={`${action.label} ${action.desc}`}
                      onSelect={action.run}
                      className="items-start"
                    >
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{action.label}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {action.desc}
                        </span>
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              {groups.map((g) => (
                <CommandGroup key={g.title} heading={g.title}>
                  {g.links.map((l) => (
                    <CommandItem
                      key={l.href}
                      value={`${g.title} ${l.label} ${l.desc ?? ""}`}
                      onSelect={() => ir(l.href)}
                      className="items-start"
                    >
                      <Search className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{l.label}</span>
                        {l.desc && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {l.desc}
                          </span>
                        )}
                      </span>
                      {l.shortcut && (
                        <kbd className="mt-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          {l.shortcut}
                        </kbd>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
