"use client";

import { useActionState } from "react";
import { Archive, CheckCircle2, Loader2, PlusCircle } from "lucide-react";
import {
  arquivarTriagemCodigoDesconhecido,
  criarInsumoMinimoDaTriagem,
  resolverTriagemComEntidadeExistente,
} from "@/lib/actions/cadastros-triagem";
import { Button } from "@/components/ui/button";

type Opcao = {
  id: number;
  label: string;
};

export type TriagemPendenteView = {
  id: number;
  codigo: string;
  formato: string | null;
  tipo_sugerido: string | null;
  criado_em: string;
};

function ErrorMessage({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">
      {message}
    </p>
  );
}

const initialState = { ok: false, message: "" };

export function TriagemResolucaoCard({
  triagem,
  insumos,
  lotes,
  locais,
}: {
  triagem: TriagemPendenteView;
  insumos: Opcao[];
  lotes: Opcao[];
  locais: Opcao[];
}) {
  const [existenteState, existenteAction, existentePending] = useActionState(
    resolverTriagemComEntidadeExistente,
    initialState,
  );
  const [insumoState, insumoAction, insumoPending] = useActionState(
    criarInsumoMinimoDaTriagem,
    initialState,
  );
  const [arquivarState, arquivarAction, arquivarPending] = useActionState(
    arquivarTriagemCodigoDesconhecido,
    initialState,
  );

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm font-semibold text-slate-900 dark:text-zinc-100">
            {triagem.codigo}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            Formato: {triagem.formato ?? "desconhecido"} · Sugestao:{" "}
            {triagem.tipo_sugerido ?? "nao identificada"}
          </p>
        </div>
        <span className="rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/20 dark:text-amber-300">
          Pendente
        </span>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <form
          action={existenteAction}
          className="grid gap-3 rounded-md border border-slate-200 p-3 dark:border-zinc-800"
        >
          <input type="hidden" name="triagem_id" value={triagem.id} />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
            Vincular a cadastro existente
          </h2>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-zinc-200">Tipo</span>
            <select
              name="entidade_tipo"
              className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <option value="insumo">Insumo</option>
              <option value="lote">Lote existente</option>
              <option value="local">Local</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-zinc-200">ID da entidade</span>
            <input
              name="entidade_id"
              type="number"
              min="1"
              className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
              list={`entidades-${triagem.id}`}
              required
            />
          </label>
          <datalist id={`entidades-${triagem.id}`}>
            {insumos.map((opcao) => (
              <option key={`insumo-${opcao.id}`} value={opcao.id} label={`Insumo: ${opcao.label}`} />
            ))}
            {lotes.map((opcao) => (
              <option key={`lote-${opcao.id}`} value={opcao.id} label={`Lote: ${opcao.label}`} />
            ))}
            {locais.map((opcao) => (
              <option key={`local-${opcao.id}`} value={opcao.id} label={`Local: ${opcao.label}`} />
            ))}
          </datalist>
          <Button type="submit" disabled={existentePending}>
            {existentePending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Resolver vinculo
          </Button>
          <ErrorMessage message={existenteState.message} />
        </form>

        <form
          action={insumoAction}
          className="grid gap-3 rounded-md border border-slate-200 p-3 dark:border-zinc-800"
        >
          <input type="hidden" name="triagem_id" value={triagem.id} />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
            Criar novo insumo
          </h2>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-zinc-200">Especificacao</span>
            <input
              name="especificacao"
              className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
              required
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-zinc-200">Un. estoque</span>
              <input
                name="unidade"
                className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                required
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-zinc-200">Un. consumo</span>
              <input
                name="unidade_consumo"
                className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                required
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-zinc-200">Fator</span>
              <input
                name="fator_conversao"
                type="number"
                min="0.000001"
                step="any"
                className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                required
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-zinc-200">Qtd. embalagem</span>
              <input
                name="quantidade_embalagem"
                type="number"
                min="0.000001"
                step="any"
                className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                required
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-zinc-200">Valor embalagem</span>
              <input
                name="custo_total_embalagem"
                type="number"
                min="0"
                step="any"
                className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
              />
            </label>
          </div>
          <Button type="submit" disabled={insumoPending}>
            {insumoPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PlusCircle className="h-4 w-4" />
            )}
            Criar e resolver
          </Button>
          <ErrorMessage message={insumoState.message} />
        </form>
      </div>

      <form action={arquivarAction} className="mt-4 flex flex-wrap items-center gap-3">
        <input type="hidden" name="triagem_id" value={triagem.id} />
        <Button type="submit" variant="outline" disabled={arquivarPending}>
          {arquivarPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Archive className="h-4 w-4" />
          )}
          Arquivar triagem
        </Button>
        <ErrorMessage message={arquivarState.message} />
      </form>
    </article>
  );
}
