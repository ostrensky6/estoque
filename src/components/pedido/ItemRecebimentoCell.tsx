"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

import { estornarRecebimentoItem } from "@/lib/actions/pedidos-internos";
import { ReceberItemPedidoInterno, type ItemRecebivel } from "./ReceberItemPedidoInterno";

type Insumo = { id: number; especificacao: string | null; unidade: string | null };

export function ItemRecebimentoCell({
  item,
  insumos,
  podeReceber,
  recebidoEm,
  recebidoPor,
}: {
  item: ItemRecebivel;
  insumos: Insumo[];
  podeReceber: boolean;
  recebidoEm?: string | null;
  recebidoPor?: string | null;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (recebidoEm) {
    const quando = new Date(recebidoEm).toLocaleDateString("pt-BR");
    function estornar() {
      setErro(null);
      startTransition(async () => {
        const fd = new FormData();
        fd.set("item_id", String(item.id));
        fd.set("pedido_interno_id", String(item.pedidoId));
        const res = await estornarRecebimentoItem({ ok: false }, fd);
        if (res.ok) router.refresh();
        else setErro(res.message ?? "Falha ao estornar.");
      });
    }
    return (
      <div className="flex flex-col items-start gap-0.5">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-leaf-700 dark:text-leaf-300">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Recebido {quando}
        </span>
        {recebidoPor && <span className="text-[10px] text-zinc-400">{recebidoPor}</span>}
        <button
          onClick={estornar}
          disabled={pending}
          className="text-[11px] text-zinc-500 hover:underline disabled:opacity-50"
        >
          {pending ? "..." : "estornar"}
        </button>
        {erro && <span className="text-[10px] text-red-600">{erro}</span>}
      </div>
    );
  }

  if (podeReceber) {
    return <ReceberItemPedidoInterno item={item} insumos={insumos} />;
  }

  return <span className="text-xs text-zinc-400">aguardando etapa</span>;
}
