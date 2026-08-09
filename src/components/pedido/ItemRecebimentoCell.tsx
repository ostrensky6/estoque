"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, RotateCcw } from "lucide-react";

import { estornarRecebimentoItem, estornarRecebimentoLancamento } from "@/lib/actions/pedidos-internos";
import { ReceberItemPedidoInterno, type ItemRecebivel } from "./ReceberItemPedidoInterno";

type Insumo = { id: number; especificacao: string | null; unidade: string | null };
export type RecebimentoLancamento = {
  id: number;
  loteId: number | null;
  quantidade: number;
  codigoLote: string | null;
  fornecedor: string | null;
  validade: string | null;
  responsavel: string | null;
  recebidoEm: string;
};

export function ItemRecebimentoCell({
  item,
  insumos,
  podeReceber,
  recebidoEm,
  recebidoPor,
  recebimentos = [],
}: {
  item: ItemRecebivel;
  insumos: Insumo[];
  podeReceber: boolean;
  recebidoEm?: string | null;
  recebidoPor?: string | null;
  recebimentos?: RecebimentoLancamento[];
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const quantidadeRecebida = Number(item.quantidadeRecebida ?? 0);
  const parcial = !recebidoEm && quantidadeRecebida > 0;

  if (recebidoEm) {
    const quando = new Date(recebidoEm).toLocaleDateString("pt-BR");
    function estornar(recebimentoId?: number) {
      setErro(null);
      startTransition(async () => {
        const fd = new FormData();
        fd.set("item_id", String(item.id));
        fd.set("pedido_interno_id", String(item.pedidoId));
        if (recebimentoId) fd.set("recebimento_id", String(recebimentoId));
        const action = recebimentoId ? estornarRecebimentoLancamento : estornarRecebimentoItem;
        const res = await action({ ok: false }, fd);
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
        {recebidoPor && <span className="text-[10px] text-muted-foreground/80">{recebidoPor}</span>}
        <button
          onClick={() => estornar()}
          disabled={pending}
          className="text-[11px] text-muted-foreground hover:underline disabled:opacity-50"
        >
          {pending ? "..." : "estornar"}
        </button>
        {recebimentos.length > 0 && (
          <RecebimentosHistorico
            recebimentos={recebimentos}
            unidade={item.unidade}
            pending={pending}
            onEstornar={estornar}
          />
        )}
        {erro && <span className="text-[10px] text-danger-strong">{erro}</span>}
      </div>
    );
  }

  if (podeReceber) {
    return (
      <div className="flex flex-col items-start gap-1">
        {parcial && (
          <span className="text-[11px] font-medium text-warning-strong">
            Parcial {quantidadeRecebida}/{item.quantidade} {item.unidade ?? ""}
          </span>
        )}
        {recebimentos.length > 0 && (
          <RecebimentosHistorico
            recebimentos={recebimentos}
            unidade={item.unidade}
            pending={pending}
            onEstornar={(recebimentoId) => {
              setErro(null);
              startTransition(async () => {
                const fd = new FormData();
                fd.set("item_id", String(item.id));
                fd.set("pedido_interno_id", String(item.pedidoId));
                fd.set("recebimento_id", String(recebimentoId));
                const res = await estornarRecebimentoLancamento({ ok: false }, fd);
                if (res.ok) router.refresh();
                else setErro(res.message ?? "Falha ao estornar.");
              });
            }}
          />
        )}
        <ReceberItemPedidoInterno item={item} insumos={insumos} />
        {erro && <span className="text-[10px] text-danger-strong">{erro}</span>}
      </div>
    );
  }

  if (item.compraFormalId) {
    return (
      <Link href={`/compras/${item.compraFormalId}`} className="text-xs font-medium text-primary hover:underline">
        Receber em compras
      </Link>
    );
  }

  return <span className="text-xs text-muted-foreground/80">aguardando etapa</span>;
}

function RecebimentosHistorico({
  recebimentos,
  unidade,
  pending,
  onEstornar,
}: {
  recebimentos: RecebimentoLancamento[];
  unidade?: string | null;
  pending: boolean;
  onEstornar: (recebimentoId: number) => void;
}) {
  return (
    <div className="mt-1 min-w-44 space-y-1 rounded-md border border-border/70 bg-muted/30 p-2 text-[11px]">
      {recebimentos.map((recebimento) => {
        const quando = new Date(recebimento.recebidoEm).toLocaleDateString("pt-BR");
        return (
          <div key={recebimento.id} className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium tabular-nums text-foreground">
                {recebimento.quantidade} {unidade ?? ""}
              </p>
              <p className="truncate text-muted-foreground">
                {quando}
                {recebimento.codigoLote ? ` · lote ${recebimento.codigoLote}` : ""}
              </p>
              {(recebimento.fornecedor || recebimento.responsavel) && (
                <p className="truncate text-muted-foreground/80">
                  {recebimento.fornecedor ?? recebimento.responsavel}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onEstornar(recebimento.id)}
              disabled={pending}
              className="rounded p-1 text-muted-foreground hover:bg-background hover:text-danger-strong disabled:opacity-50"
              title="Estornar este lançamento"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
