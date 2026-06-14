"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { NavGroup } from "@/components/layout/SideNav";

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

  function ir(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed inset-x-0 top-[12vh] z-50 mx-auto w-[92%] max-w-xl overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0"
        >
          <Dialog.Title className="sr-only">Buscar e navegar</Dialog.Title>
          <Dialog.Description className="sr-only">
            Pesquise páginas e ações; use as setas e Enter.
          </Dialog.Description>
          <Command>
            <CommandInput placeholder="Buscar páginas…" />
            <CommandList>
              <CommandEmpty>Nada encontrado.</CommandEmpty>
              {groups.map((g) => (
                <CommandGroup key={g.title} heading={g.title}>
                  {g.links.map((l) => (
                    <CommandItem
                      key={l.href}
                      value={`${g.title} ${l.label} ${l.desc ?? ""}`}
                      onSelect={() => ir(l.href)}
                    >
                      <span>{l.label}</span>
                      {l.desc && (
                        <span className="ml-auto truncate pl-3 text-xs text-muted-foreground">
                          {l.desc}
                        </span>
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
