"use client";

import { HelpCircle } from "lucide-react";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type HelpContent = {
  title: string;
  description: string;
  checks: string[];
};

const HELP: Array<{ match: (path: string) => boolean; content: HelpContent }> = [
  {
    match: (path) => path.startsWith("/orcamento"),
    content: {
      title: "Orçamento",
      description: "Fluxo comercial com snapshots de custo e preço.",
      checks: ["Cadastre a demanda antes da proposta.", "Revise parâmetros econômicos antes de emitir.", "Use aprovação para gerar planejamento."],
    },
  },
  {
    match: (path) => path.startsWith("/estoque"),
    content: {
      title: "Estoque",
      description: "Controle de lotes, validade, quarentena, cobertura e reposição.",
      checks: ["Aceite lotes antes do uso.", "Priorize FEFO e itens vencendo.", "Compare ponto atual com ponto sugerido."],
    },
  },
  {
    match: (path) => path.startsWith("/compras"),
    content: {
      title: "Compras",
      description: "Ciclo de solicitação, aprovação, envio e recebimento.",
      checks: ["Use rascunhos automáticos para reposição.", "Receba itens pelo pedido.", "Confira quarentena após a entrada."],
    },
  },
  {
    match: (path) => path.startsWith("/custeio"),
    content: {
      title: "Custeio",
      description: "Engine de custo por análise com simulação de cenário.",
      checks: ["Teste lotes alternativos.", "Compare grupos de insumos.", "Valide margem antes de criar orçamento."],
    },
  },
  {
    match: () => true,
    content: {
      title: "Kontrol",
      description: "Painel operacional do laboratório.",
      checks: ["Use busca e filtros nas filas.", "Abra Command Palette para navegar rápido.", "Revise alertas antes de iniciar compras."],
    },
  },
];

export function ContextHelp() {
  const pathname = usePathname();
  const content = HELP.find((item) => item.match(pathname))?.content ?? HELP[HELP.length - 1].content;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="fixed bottom-4 right-4 z-40 h-10 w-10 rounded-full shadow-lg"
          aria-label="Ajuda contextual"
        >
          <HelpCircle />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{content.title}</DialogTitle>
          <DialogDescription>{content.description}</DialogDescription>
        </DialogHeader>
        <ul className="space-y-2 text-sm text-slate-700 dark:text-zinc-300">
          {content.checks.map((check) => (
            <li key={check} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/40">
              {check}
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
