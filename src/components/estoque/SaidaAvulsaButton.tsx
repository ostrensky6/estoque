"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { PackageMinus } from "lucide-react";
import { toast } from "sonner";

import { HelpExample, HelpTip } from "@/components/common/HelpTip";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "@/lib/actions/cadastros";
import { registrarSaidaAvulsa } from "@/lib/actions/estoque";
import { cn } from "@/lib/utils";

const MOTIVOS = [
  { value: "consumo_avulso", label: "Uso fora de plano", tom: "info" },
  { value: "perda", label: "Perda", tom: "atencao" },
  { value: "quebra", label: "Quebra", tom: "atencao" },
  { value: "vencido", label: "Vencido", tom: "critico" },
  { value: "descarte", label: "Descarte", tom: "critico" },
  { value: "outro", label: "Outro", tom: "neutro" },
] as const;

const tomSelecionado: Record<(typeof MOTIVOS)[number]["tom"], string> = {
  info: "border-info-strong bg-info-soft text-info-strong",
  atencao: "border-warning-strong bg-warning-soft text-warning-strong",
  critico: "border-danger-strong bg-danger-soft text-danger-strong",
  neutro: "border-foreground/40 bg-muted text-foreground",
};

/**
 * Registrar saída avulsa de um insumo: perda, quebra, vencido, descarte ou
 * uso fora de um plano. Sem lote, baixa dos lotes que vencem primeiro.
 */
export function SaidaAvulsaButton({
  insumoId,
  especificacao,
  unidade,
  loteId,
  codigoLote,
  saldo,
  embalagemFechada = false,
  triggerLabel = "Saída",
  triggerVariant = "outline",
  triggerSize = "sm",
  triggerClassName,
}: {
  insumoId: number;
  especificacao: string;
  unidade?: string | null;
  loteId?: number;
  codigoLote?: string;
  saldo?: number;
  embalagemFechada?: boolean;
  triggerLabel?: string;
  triggerVariant?: React.ComponentProps<typeof Button>["variant"];
  triggerSize?: React.ComponentProps<typeof Button>["size"];
  triggerClassName?: string;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant={triggerVariant}
        size={triggerSize}
        className={triggerClassName}
        onClick={() => setAberto(true)}
      >
        <PackageMinus />
        {triggerLabel}
      </Button>
      {aberto && (
        <SaidaAvulsaDialog
          onOpenChange={setAberto}
          insumoId={insumoId}
          especificacao={especificacao}
          unidade={unidade}
          loteId={loteId}
          codigoLote={codigoLote}
          saldo={saldo}
          embalagemFechada={embalagemFechada}
        />
      )}
    </>
  );
}

function SaidaAvulsaDialog({
  onOpenChange,
  insumoId,
  especificacao,
  unidade,
  loteId,
  codigoLote,
  saldo,
  embalagemFechada,
}: {
  onOpenChange: (open: boolean) => void;
  insumoId: number;
  especificacao: string;
  unidade?: string | null;
  loteId?: number;
  codigoLote?: string;
  saldo?: number;
  embalagemFechada: boolean;
}) {
  const router = useRouter();
  const ids = useId();
  // um id por abertura do diálogo: reenvio (duplo clique, rede) não duplica a saída
  const [operacaoId] = useState(() => crypto.randomUUID());
  const [categoria, setCategoria] = useState<string>("");
  const [state, action, pending] = useActionState<FormState, FormData>(registrarSaidaAvulsa, {
    ok: false,
  });

  useEffect(() => {
    if (!state.ok) return;
    toast.success("Saída registrada", { description: especificacao });
    router.refresh();
    onOpenChange(false);
  }, [state.ok, especificacao, router, onOpenChange]);

  const unidadeTexto = embalagemFechada ? "embalagens" : unidade || "unidades";

  return (
    <Dialog open onOpenChange={(open) => !pending && onOpenChange(open)}>
      <DialogContent className="max-w-md" showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1">
            Registrar saída
            <HelpTip title="Saída de estoque">
              <p>
                Retira material do saldo quando ele não foi usado por um plano: perda, quebra,
                vencimento, descarte ou uso fora de plano.
              </p>
              <p>
                {loteId
                  ? "A saída sai deste lote."
                  : "O sistema baixa primeiro os lotes que vencem antes (FEFO). Quantidade reservada para planos nunca é usada."}
              </p>
              <HelpExample>
                Frasco caiu e quebrou → motivo <b>Quebra</b>, quantidade <b>1</b>, observação
                “frasco quebrou na bancada”.
              </HelpExample>
            </HelpTip>
          </DialogTitle>
          <DialogDescription>
            {especificacao}
            {codigoLote ? ` · lote ${codigoLote}` : ""}
            {saldo != null ? ` · saldo ${saldo} ${unidadeTexto}` : ""}
          </DialogDescription>
        </DialogHeader>

        <form action={action} className="grid gap-4">
          <input type="hidden" name="insumo_id" value={insumoId} />
          <input type="hidden" name="operacao_id" value={operacaoId} />
          {loteId != null && <input type="hidden" name="lote_id" value={loteId} />}
          <input type="hidden" name="categoria" value={categoria} />

          <fieldset>
            <legend className="text-sm font-medium">Motivo</legend>
            <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup">
              {MOTIVOS.map((motivo) => {
                const ativo = categoria === motivo.value;
                return (
                  <button
                    key={motivo.value}
                    type="button"
                    role="radio"
                    aria-checked={ativo}
                    onClick={() => setCategoria(motivo.value)}
                    className={cn(
                      "min-h-10 rounded-md border px-2 py-1.5 text-sm font-medium transition-colors",
                      ativo
                        ? tomSelecionado[motivo.tom]
                        : "border-input bg-background text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {motivo.label}
                  </button>
                );
              })}
            </div>
            {state.errors?.categoria && (
              <p className="mt-1 text-xs text-destructive">{state.errors.categoria}</p>
            )}
          </fieldset>

          <div>
            <Label htmlFor={`${ids}-qtd`}>
              Quantidade ({unidadeTexto})
            </Label>
            <Input
              id={`${ids}-qtd`}
              name="quantidade"
              type="number"
              inputMode={embalagemFechada ? "numeric" : "decimal"}
              min={embalagemFechada ? 1 : 0}
              step={embalagemFechada ? 1 : "any"}
              max={saldo}
              required
              className="mt-1"
              aria-invalid={state.errors?.quantidade ? true : undefined}
            />
            {state.errors?.quantidade && (
              <p className="mt-1 text-xs text-destructive">{state.errors.quantidade}</p>
            )}
          </div>

          <div>
            <Label htmlFor={`${ids}-obs`}>
              Observação {categoria === "outro" ? <span className="text-destructive">*</span> : "(opcional)"}
            </Label>
            <Textarea
              id={`${ids}-obs`}
              name="observacao"
              rows={2}
              maxLength={300}
              placeholder="Ex.: frasco quebrou na bancada"
              className="mt-1"
            />
            {state.errors?.observacao && (
              <p className="mt-1 text-xs text-destructive">{state.errors.observacao}</p>
            )}
          </div>

          {state.message && !state.ok && (
            <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger-strong">
              {state.message}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" disabled={pending || !categoria}>
              {pending ? "Registrando…" : "Registrar saída"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
