"use client";

import { useRef } from "react";
import { formatCurrency } from "@/lib/formatters";
import {
  salvarJustificativaProjetoSemCusto,
  adicionarCustoProjeto,
  adicionarAnaliseProjeto,
  removerCustoProjeto,
  removerAnaliseProjeto,
} from "@/lib/actions/orcamento-projetos";
import { ConfirmActionButton } from "@/components/common/ConfirmActionButton";

type CustoProjeto = {
  id: number;
  rubrica: string | null;
  descricao?: string | null;
  unidade?: string | null;
  quantidade: number;
  custo_unitario: number;
  preco_unitario: number;
  meses_selecionados: number[] | null;
};

type AnaliseProjeto = {
  id: number;
  codigo_analise?: string | null;
  n_amostras: number;
  custo_unitario: number;
  preco_unitario: number;
};

type OrcamentoProjeto = {
  id: number;
  status: string;
  titulo?: string | null;
  projeto_sem_custo_justificativa?: string | null;
  orcamento_projeto_custos?: CustoProjeto[] | null;
  orcamento_projeto_analises?: AnaliseProjeto[] | null;
};

export function EditorCustosProjeto({ orcamento }: { orcamento: OrcamentoProjeto }) {
  const formCustoRef = useRef<HTMLFormElement>(null);
  const formAnaliseRef = useRef<HTMLFormElement>(null);
  const formJustificativaRef = useRef<HTMLFormElement>(null);

  const custos = orcamento.orcamento_projeto_custos ?? [];
  const analises = orcamento.orcamento_projeto_analises ?? [];

  const totalCustos = custos.reduce((acc, c) => acc + c.custo_unitario * c.quantidade, 0);
  const totalAnalises = analises.reduce((acc, a) => acc + a.custo_unitario * a.n_amostras, 0);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold">Configuração do Projeto {orcamento.titulo && `- ${orcamento.titulo}`}</h3>
        <form
          ref={formJustificativaRef}
          action={async (formData) => {
            await salvarJustificativaProjetoSemCusto(formData);
          }}
          className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <input type="hidden" name="orcamento_projeto_id" value={orcamento.id} />
          <input type="hidden" name="status" value={orcamento.status} />

          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Justificativa (se projeto não tiver custos)
            </label>
            <input
              type="text"
              name="projeto_sem_custo_justificativa"
              defaultValue={orcamento.projeto_sem_custo_justificativa ?? ""}
              placeholder="Ex: Custos já cobertos pelo cliente..."
              className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-brand-500 dark:border-zinc-700"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-zinc-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-white"
          >
            Salvar
          </button>
        </form>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Custos Diretos do Projeto</h3>
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            Subtotal: {formatCurrency(totalCustos)}
          </span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-600 dark:text-zinc-400">
            <thead className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="pb-2 font-medium">Rubrica</th>
                <th className="pb-2 font-medium">Descrição</th>
                <th className="pb-2 font-medium">Qtd</th>
                <th className="pb-2 font-medium">Un</th>
                <th className="pb-2 font-medium text-right">Custo Unitário</th>
                <th className="pb-2 font-medium text-right">Total</th>
                <th className="pb-2 font-medium text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
              {custos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-xs text-zinc-400">Nenhum custo lançado.</td>
                </tr>
              ) : (
                custos.map((custo) => (
                  <tr key={custo.id} className="group">
                    <td className="py-2">{custo.rubrica}</td>
                    <td className="py-2">{custo.descricao}</td>
                    <td className="py-2">{custo.quantidade}</td>
                    <td className="py-2">{custo.unidade}</td>
                    <td className="py-2 text-right">{formatCurrency(custo.custo_unitario)}</td>
                    <td className="py-2 text-right">{formatCurrency(custo.custo_unitario * custo.quantidade)}</td>
                    <td className="py-2 text-right">
                      <ConfirmActionButton
                        action={removerCustoProjeto}
                        fields={{ orcamento_projeto_id: orcamento.id, item_id: custo.id }}
                        trigger="Remover"
                        titulo="Remover Custo"
                        mensagem={`Deseja remover o custo "${custo.descricao}"?`}
                        destrutivo
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <form
          ref={formCustoRef}
          action={async (formData) => {
            await adicionarCustoProjeto(formData);
            formCustoRef.current?.reset();
          }}
          className="mt-4 grid grid-cols-1 gap-3 rounded-md bg-zinc-50 p-3 sm:grid-cols-12 dark:bg-zinc-950/50"
        >
          <input type="hidden" name="orcamento_projeto_id" value={orcamento.id} />

          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">Rubrica</label>
            <input required type="text" name="rubrica" placeholder="Ex: MC" className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-500 dark:border-zinc-700 dark:bg-zinc-900" />
          </div>
          <div className="sm:col-span-4">
            <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">Descrição</label>
            <input required type="text" name="descricao" placeholder="Descrição do item" className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-500 dark:border-zinc-700 dark:bg-zinc-900" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">Unidade</label>
            <input required type="text" name="unidade" placeholder="Ex: un" className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-500 dark:border-zinc-700 dark:bg-zinc-900" />
          </div>
          <div className="sm:col-span-1">
            <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">Qtd</label>
            <input required type="number" step="0.01" name="quantidade" defaultValue="1" className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-500 dark:border-zinc-700 dark:bg-zinc-900" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">Custo Un.</label>
            <input required type="number" step="0.01" name="custo_unitario" placeholder="0.00" className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-500 dark:border-zinc-700 dark:bg-zinc-900" />
          </div>
          <div className="flex items-end sm:col-span-1">
            <button type="submit" className="w-full rounded-md bg-zinc-800 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-white">
              Add
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Análises de Projeto</h3>
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            Subtotal: {formatCurrency(totalAnalises)}
          </span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-600 dark:text-zinc-400">
            <thead className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="pb-2 font-medium">Código da Análise</th>
                <th className="pb-2 font-medium text-center">Amostras</th>
                <th className="pb-2 font-medium text-right">Custo Unitário</th>
                <th className="pb-2 font-medium text-right">Custo Total</th>
                <th className="pb-2 font-medium text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
              {analises.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-xs text-zinc-400">Nenhuma análise vinculada.</td>
                </tr>
              ) : (
                analises.map((analise) => (
                  <tr key={analise.id} className="group">
                    <td className="py-2">{analise.codigo_analise}</td>
                    <td className="py-2 text-center">{analise.n_amostras}</td>
                    <td className="py-2 text-right">{formatCurrency(analise.custo_unitario)}</td>
                    <td className="py-2 text-right">{formatCurrency(analise.custo_unitario * analise.n_amostras)}</td>
                    <td className="py-2 text-right">
                      <ConfirmActionButton
                        action={removerAnaliseProjeto}
                        fields={{ orcamento_projeto_id: orcamento.id, item_id: analise.id }}
                        trigger="Remover"
                        titulo="Remover Análise"
                        mensagem={`Deseja remover a análise ${analise.codigo_analise}?`}
                        destrutivo
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <form
          ref={formAnaliseRef}
          action={async (formData) => {
            await adicionarAnaliseProjeto(formData);
            formAnaliseRef.current?.reset();
          }}
          className="mt-4 flex flex-col gap-3 rounded-md bg-zinc-50 p-3 sm:flex-row sm:items-end dark:bg-zinc-950/50"
        >
          <input type="hidden" name="orcamento_projeto_id" value={orcamento.id} />

          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">Código da Análise</label>
            <input required type="text" name="codigo_analise" placeholder="Ex: AN-001" className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-500 dark:border-zinc-700 dark:bg-zinc-900" />
          </div>
          <div className="w-24">
            <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">Amostras</label>
            <input required type="number" name="n_amostras" defaultValue="1" min="1" className="w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-500 dark:border-zinc-700 dark:bg-zinc-900" />
          </div>
          <button type="submit" className="rounded-md bg-zinc-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-white">
            Add
          </button>
        </form>
      </div>
    </div>
  );
}
