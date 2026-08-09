"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { recalcularOrcamento } from "@/lib/actions/orcamentos";

type RecalcularOrcamentoFormProps = {
  orcamentoId: number;
  fonteAtual: string;
  operacaoId: string;
};

export function RecalcularOrcamentoForm({
  orcamentoId,
  fonteAtual,
  operacaoId,
}: RecalcularOrcamentoFormProps) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [fonte, setFonte] = useState(fonteAtual);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const submissaoEmCurso = useRef(false);
  const [pending, startTransition] = useTransition();

  function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!motivo.trim()) {
      setMensagem("Informe o motivo do recálculo.");
      return;
    }
    if (submissaoEmCurso.current) {
      return;
    }
    submissaoEmCurso.current = true;
    setMensagem(null);

    const formData = new FormData(event.currentTarget);
    formData.set("motivo", motivo.trim());
    formData.set("fonte_custo_insumos", fonte);

    startTransition(async () => {
      try {
        const resultado = await recalcularOrcamento(formData);
        if (!resultado.ok) {
          setMensagem(resultado.message);
          return;
        }
        setAberto(false);
        setMotivo("");
        setMensagem(null);
        router.refresh();
      } catch (error) {
        setMensagem(
          error instanceof Error
            ? error.message
            : "Não foi possível recalcular o orçamento.",
        );
      } finally {
        submissaoEmCurso.current = false;
      }
    });
  }

  function cancelar() {
    if (!pending) setAberto(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setMensagem(null);
          setAberto(true);
        }}
        className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted"
      >
        Aplicar e recalcular
      </button>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 text-left">
          <button
            type="button"
            aria-label="Fechar recálculo"
            className="absolute inset-0 bg-black/40"
            onClick={cancelar}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="recalcular-orcamento-titulo"
            aria-describedby="recalcular-orcamento-descricao"
            onKeyDown={(event) => {
              if (event.key === "Escape") cancelar();
            }}
            className="relative w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"
          >
            <h2 id="recalcular-orcamento-titulo" className="text-base font-semibold">
              Recalcular orçamento
            </h2>
            <p id="recalcular-orcamento-descricao" className="mt-1 text-sm text-muted-foreground">
              Confirme a fonte dos insumos e registre por que os valores serão atualizados.
            </p>

            <form onSubmit={enviar} aria-busy={pending} className="mt-4 space-y-4">
              <input type="hidden" name="orcamento_id" value={orcamentoId} />
              <input type="hidden" name="operacao_id" value={operacaoId} />

              <div>
                <label htmlFor="fonte-custo-insumos" className="block text-xs font-medium text-muted-foreground">
                  Fonte de custo dos insumos
                </label>
                <select
                  id="fonte-custo-insumos"
                  name="fonte_custo_insumos"
                  value={fonte}
                  onChange={(event) => setFonte(event.target.value)}
                  disabled={pending}
                  className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                >
                  <option value="custo_padrao">Custo padrão</option>
                  <option value="custo_medio_ponderado">Média dos lotes liberados</option>
                </select>
              </div>

              <div>
                <label htmlFor="motivo-recalculo" className="block text-xs font-medium text-muted-foreground">
                  Motivo
                </label>
                <textarea
                  id="motivo-recalculo"
                  name="motivo"
                  value={motivo}
                  onChange={(event) => setMotivo(event.target.value)}
                  disabled={pending}
                  autoFocus
                  rows={3}
                  className="mt-1 w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-sm"
                  placeholder="Explique por que os custos precisam ser recalculados"
                />
              </div>

              {mensagem && (
                <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger-strong">
                  {mensagem}
                </p>
              )}

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={cancelar}
                  disabled={pending}
                  className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  aria-busy={pending}
                  disabled={pending}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                >
                  {pending ? "Recalculando…" : "Aplicar e recalcular"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
