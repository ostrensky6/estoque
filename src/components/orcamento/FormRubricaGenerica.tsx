"use client";

import React, { useState, useEffect } from "react";
import { formatCurrency as brl } from "@/lib/formatters";

type CatalogoItem = {
  id: string;
  rubrica: string;
  descricao: string;
  unidade: string | null;
  preco_unitario: number | null;
  categoria: string | null;
  origem?: string | null;
};

type Custo = {
  id: number;
  categoria: string;
  rubrica: string | null;
  descricao: string;
  etapa: string | null;
  atividade: string | null;
  entrega: string | null;
  categoria_institucional: string | null;
  nomenclatura_origem: string | null;
  quantidade: number;
  unidade: string | null;
  custo_unitario: number;
  preco_unitario: number;
  meses_selecionados: number[];
  catalogo_item_id: string | null;
  valor_snapshot?: unknown;
};

type FormRubricaGenericaProps = {
  orcId: number;
  rubrica: "MC" | "MP" | "ST" | "VD" | "OU";
  rubricaLabel: string;
  catalogoItens: CatalogoItem[];
  custosItens: Custo[];
  adicionarCustoManualAction: (formData: FormData) => Promise<void>;
  alternarCustoCatalogoAction: (formData: FormData) => Promise<void>;
  atualizarCustoAction: (formData: FormData) => Promise<void>;
  removerCustoAction: (formData: FormData) => Promise<void>;
  subtotalProjeto: number;
  totalVendaProjeto: number;
  selecionarTodosAction: (formData: FormData) => Promise<void>;
  limparTodosAction: (formData: FormData) => Promise<void>;
};

export function FormRubricaGenerica({
  orcId,
  rubrica,
  rubricaLabel,
  catalogoItens,
  custosItens,
  adicionarCustoManualAction,
  alternarCustoCatalogoAction,
  atualizarCustoAction,
  removerCustoAction,
  subtotalProjeto,
  totalVendaProjeto,
  selecionarTodosAction,
  limparTodosAction,
}: FormRubricaGenericaProps) {
  // Estado para busca de texto
  const [busca, setBusca] = useState("");

  // Mapear custos por catalogo_item_id
  const custosPorCatalogoId = new Map<string, Custo>();
  custosItens.forEach(it => {
    if (it.catalogo_item_id) {
      custosPorCatalogoId.set(it.catalogo_item_id, it);
    }
  });

  // Custos manuais/personalizados
  const itensPersonalizados = custosItens.filter(it => !it.catalogo_item_id);

  // Estados locais das linhas
  const [linhaEstados, setLinhaEstados] = useState<Record<number, { descricao: string; custo_unitario: number; quantidade: number; unidade: string }>>({});

  useEffect(() => {
    const novosEstados: typeof linhaEstados = {};
    custosItens.forEach(item => {
      novosEstados[item.id] = {
        descricao: item.descricao ?? "",
        custo_unitario: Number(item.custo_unitario ?? 0),
        quantidade: Number(item.quantidade ?? 1),
        unidade: item.unidade ?? "",
      };
    });
    setLinhaEstados(novosEstados);
  }, [custosItens]);

  const handleLinhaDescChange = (id: number, val: string) => {
    setLinhaEstados(prev => ({
      ...prev,
      [id]: { ...prev[id], descricao: val }
    }));
  };

  const handleLinhaCustoChange = (id: number, val: number) => {
    setLinhaEstados(prev => ({
      ...prev,
      [id]: { ...prev[id], custo_unitario: val }
    }));
  };

  const handleLinhaQtdChange = (id: number, val: number) => {
    setLinhaEstados(prev => ({
      ...prev,
      [id]: { ...prev[id], quantidade: val }
    }));
  };

  const handleLinhaUnidadeChange = (id: number, val: string) => {
    setLinhaEstados(prev => ({
      ...prev,
      [id]: { ...prev[id], unidade: val }
    }));
  };

  // Subtotal local da rubrica ativa
  const totalRubrica = custosItens.reduce((acc, item) => {
    const estado = linhaEstados[item.id] || {
      custo_unitario: Number(item.custo_unitario),
      quantidade: Number(item.quantidade),
    };
    return acc + (estado.quantidade * estado.custo_unitario);
  }, 0);

  // Estados de inserção de personalizado
  const [customDesc, setCustomDesc] = useState("");
  const [customCusto, setCustomCusto] = useState<number | "">("");
  const [customQtd, setCustomQtd] = useState(1);
  const [customUnidade, setCustomUnidade] = useState("");
  const [customCat, setCustomCat] = useState("Geral");

  // Filtrar itens do catálogo por busca de texto
  const catalogoFiltrado = catalogoItens.filter(it =>
    it.descricao.toLowerCase().includes(busca.toLowerCase()) ||
    (it.categoria || "").toLowerCase().includes(busca.toLowerCase())
  );

  const tableInputClass = (habilitado: boolean) => 
    `w-full bg-white dark:bg-zinc-950 border transition focus:outline-none focus:ring-1 focus:ring-brand-500 rounded px-3 py-1.5 text-sm ${
      habilitado 
        ? "text-zinc-950 dark:text-zinc-50 border-zinc-200 dark:border-zinc-800 focus:border-brand-500 font-semibold" 
        : "text-zinc-400 dark:text-zinc-500 border-transparent cursor-not-allowed font-medium"
    }`;

  const inputClass =
    "rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-brand-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-brand-300";

  return (
    <div className="space-y-6">
      {/* Tabela de Lançamento da Rubrica Generica */}
      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 font-sans">{rubricaLabel}</h3>
            <p className="mt-0.5 text-xs text-zinc-500 font-medium">
              Selecione itens do catálogo, ajuste quantidade e valores, ou cadastre novos itens.
            </p>
          </div>
          <div className="flex gap-3 text-xs bg-zinc-50 dark:bg-zinc-950 px-3 py-1.5 rounded-md font-semibold text-zinc-600 dark:text-zinc-400">
            <span>{custosItens.length} selecionados</span>
            <span className="text-zinc-300">|</span>
            <span>{catalogoItens.length} no catálogo</span>
          </div>
        </div>

        {/* Painel de busca e seleção rápida */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 no-print bg-zinc-50/50 dark:bg-zinc-950/20 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800">
          <div className="relative w-full max-w-xs">
            <input
              type="text"
              placeholder={`Buscar em ${rubricaLabel}...`}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full rounded border border-zinc-300 bg-white px-3 py-1.5 pl-8 text-xs font-semibold text-brand-700 placeholder-zinc-400 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-brand-300"
            />
            <span className="absolute left-2.5 top-2.5 text-[10px] text-zinc-400 font-bold uppercase tracking-wide">🔍</span>
          </div>

          <div className="flex items-center gap-2">
            <form action={selecionarTodosAction}>
              <input type="hidden" name="orcamento_projeto_id" value={orcId} />
              <input type="hidden" name="rubrica" value={rubrica} />
              <button
                type="submit"
                className="rounded border border-zinc-200 bg-white hover:bg-zinc-50 px-3 py-1.5 text-xs font-bold text-zinc-750 dark:border-zinc-750 dark:bg-zinc-950 dark:text-zinc-350 transition shadow-sm"
              >
                ☑️ Selecionar todos
              </button>
            </form>

            <form action={limparTodosAction}>
              <input type="hidden" name="orcamento_projeto_id" value={orcId} />
              <input type="hidden" name="rubrica" value={rubrica} />
              <button
                type="submit"
                className="rounded border border-zinc-200 bg-white hover:bg-zinc-50 px-3 py-1.5 text-xs font-bold text-red-650 dark:border-zinc-750 dark:bg-zinc-950 dark:text-red-400 transition shadow-sm"
              >
                ✕ Limpar todos
              </button>
            </form>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-right text-sm table-fixed min-w-[950px] border-collapse">
            <thead>
              <tr className="bg-zinc-50 text-xs uppercase tracking-wider text-zinc-500 dark:bg-zinc-950/60 border-b border-zinc-100 dark:border-zinc-800">
                <th className="px-3 py-2 text-center w-20">Incluir</th>
                <th className="px-3 py-2 text-left w-36">Item (Categoria)</th>
                <th className="px-3 py-2 text-left min-w-[280px]">Especificação</th>
                <th className="px-3 py-2 w-24">Un.</th>
                <th className="px-3 py-2 w-28">Qtd.</th>
                <th className="px-3 py-2 w-44">Valor Unit.</th>
                <th className="px-3 py-2 w-36">Valor Total</th>
                <th className="no-print px-3 py-2 w-28 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {/* 1. Itens do Catálogo */}
              {catalogoFiltrado.map((catItem) => {
                const item = custosPorCatalogoId.get(catItem.id);
                const selecionado = Boolean(item);

                if (selecionado && item) {
                  const estado = linhaEstados[item.id] || {
                    descricao: item.descricao ?? "",
                    custo_unitario: Number(item.custo_unitario ?? 0),
                    quantidade: Number(item.quantidade ?? 1),
                    unidade: item.unidade ?? "",
                  };

                  const subtotalCalculado = (estado.quantidade ?? 0) * (estado.custo_unitario ?? 0);

                  return (
                    <tr key={catItem.id} className="bg-brand-50/10 dark:bg-brand-950/5 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                      {/* Checkbox de Seleção */}
                      <td className="px-3 py-3 text-center no-print">
                        <form action={removerCustoAction}>
                          <input type="hidden" name="orcamento_projeto_id" value={orcId} />
                          <input type="hidden" name="item_id" value={item.id} />
                          <input
                            type="checkbox"
                            defaultChecked
                            onChange={(e) => {
                              if (!confirm("Deseja realmente apagar este item do banco de dados?")) {
                                e.target.checked = true;
                                return;
                              }
                              e.target.form?.requestSubmit();
                            }}
                            className="rounded text-brand-600 focus:ring-brand-500 cursor-pointer h-4.5 w-4.5"
                          />
                        </form>
                      </td>

                      {/* Item (Categoria) */}
                      <td className="px-3 py-3 text-left">
                        <span className="inline-block bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-semibold px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 uppercase">
                          {catItem.categoria || "Geral"}
                        </span>
                      </td>

                      {/* Especificação Editável */}
                      <td className="px-3 py-3 text-left">
                        <form id={`form-cat-${item.id}`} action={atualizarCustoAction}>
                          <input type="hidden" name="orcamento_projeto_id" value={orcId} />
                          <input type="hidden" name="item_id" value={item.id} />
                          <input type="hidden" name="unidade" value={estado.unidade ?? ""} />

                          <input
                            name="descricao"
                            type="text"
                            value={estado.descricao ?? ""}
                            onChange={(e) => handleLinhaDescChange(item.id, e.target.value)}
                            className={tableInputClass(true)}
                          />
                        </form>
                      </td>

                      {/* Un. Editável */}
                      <td className="px-3 py-3">
                        <input
                          form={`form-cat-${item.id}`}
                          name="unidade"
                          type="text"
                          value={estado.unidade ?? ""}
                          onChange={(e) => handleLinhaUnidadeChange(item.id, e.target.value)}
                          className="w-full text-center rounded border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 px-2 py-1.5 text-sm text-zinc-800 dark:text-zinc-300 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                      </td>

                      {/* Quantidade Editável */}
                      <td className="px-3 py-3">
                        <input
                          form={`form-cat-${item.id}`}
                          name="quantidade"
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={estado.quantidade ?? 0}
                          onChange={(e) => handleLinhaQtdChange(item.id, Number(e.target.value))}
                          className="w-full rounded border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 px-2 py-1.5 text-right text-sm font-semibold text-zinc-900 dark:text-zinc-100 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                      </td>

                      {/* Valor Unitário Editável */}
                      <td className="px-3 py-3">
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-xs text-zinc-400 font-bold">R$</span>
                          <input
                            form={`form-cat-${item.id}`}
                            name="custo_unitario"
                            type="number"
                            min="0"
                            step="0.01"
                            value={(estado.custo_unitario ?? 0).toFixed(2)}
                            onChange={(e) => handleLinhaCustoChange(item.id, Number(e.target.value))}
                            className="w-full rounded border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 px-3 py-1.5 pl-8 text-right text-sm font-bold text-zinc-800 dark:text-zinc-300 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                          />
                        </div>
                      </td>

                      {/* Valor Total */}
                      <td className="px-3 py-3 font-bold text-brand-700 dark:text-brand-400 tabular-nums text-sm">
                        {brl(subtotalCalculado)}
                      </td>

                      {/* Ações: Salvar / Lixeira */}
                      <td className="px-3 py-3 text-center no-print">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="submit"
                            form={`form-cat-${item.id}`}
                            className="rounded bg-brand-600 hover:bg-brand-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition"
                          >
                            Salvar
                          </button>
                          
                          <form
                            action={removerCustoAction}
                            onSubmit={(e) => {
                              if (!confirm("Deseja realmente apagar este item do banco de dados?")) {
                                e.preventDefault();
                              }
                            }}
                          >
                            <input type="hidden" name="orcamento_projeto_id" value={orcId} />
                            <input type="hidden" name="item_id" value={item.id} />
                            <button
                              type="submit"
                              className="rounded border border-red-200 bg-white hover:bg-red-50 p-1.5 text-xs font-bold text-red-650 transition shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                            >
                              🗑️
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                } else {
                  // Caso o item do catálogo NÃO esteja incluído
                  return (
                    <tr key={catItem.id} className="opacity-60 hover:opacity-100 border-b border-zinc-100 dark:border-zinc-800/60 transition">
                      {/* Checkbox de Seleção */}
                      <td className="px-3 py-3 text-center no-print">
                        <form action={alternarCustoCatalogoAction}>
                          <input type="hidden" name="orcamento_projeto_id" value={orcId} />
                          <input type="hidden" name="catalogo_item_id" value={catItem.id} />
                          <input type="hidden" name="incluir" value="true" />
                          <input type="hidden" name="quantidade" value="1" />
                          <input
                            type="checkbox"
                            onChange={(e) => e.target.form?.requestSubmit()}
                            className="rounded text-brand-600 focus:ring-brand-500 cursor-pointer h-4.5 w-4.5"
                          />
                        </form>
                      </td>

                      {/* Item (Categoria) */}
                      <td className="px-3 py-3 text-left">
                        <span className="inline-block bg-transparent text-zinc-400 font-medium px-2 py-1 text-xs rounded uppercase">
                          {catItem.categoria || "Geral"}
                        </span>
                      </td>

                      {/* Especificação */}
                      <td className="px-3 py-3 text-left">
                        <input
                          type="text"
                          readOnly
                          value={catItem.descricao}
                          className={tableInputClass(false)}
                        />
                      </td>

                      {/* Unidade */}
                      <td className="px-3 py-3 text-center text-zinc-400 font-medium">
                        {catItem.unidade ?? "un"}
                      </td>

                      {/* Qtd. Vazia */}
                      <td className="px-3 py-3 text-zinc-300 font-light text-center">—</td>

                      {/* Preço sugerido */}
                      <td className="px-3 py-3 tabular-nums text-zinc-400 text-sm font-semibold pl-8">
                        {brl(Number(catItem.preco_unitario ?? 0))}
                      </td>

                      {/* Total Vazio */}
                      <td className="px-3 py-3 text-zinc-300 font-light">—</td>
                      <td className="px-3 py-3"></td>
                    </tr>
                  );
                }
              })}

              {/* 2. Itens Personalizados (Manuais) */}
              {itensPersonalizados.map((item) => {
                const estado = linhaEstados[item.id] || {
                  descricao: item.descricao ?? "",
                  custo_unitario: Number(item.custo_unitario ?? 0),
                  quantidade: Number(item.quantidade ?? 1),
                  unidade: item.unidade ?? "",
                };

                const subtotalCalculado = (estado.quantidade ?? 0) * (estado.custo_unitario ?? 0);

                return (
                  <tr key={item.id} className="bg-amber-50/10 dark:bg-amber-950/5 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                    {/* Checkbox de Seleção */}
                    <td className="px-3 py-3 text-center no-print">
                      <form action={removerCustoAction}>
                        <input type="hidden" name="orcamento_projeto_id" value={orcId} />
                        <input type="hidden" name="item_id" value={item.id} />
                        <input
                          type="checkbox"
                          defaultChecked
                          onChange={(e) => {
                            if (!confirm("Deseja realmente apagar este item do banco de dados?")) {
                              e.target.checked = true;
                              return;
                            }
                            e.target.form?.requestSubmit();
                          }}
                          className="rounded text-brand-600 focus:ring-brand-500 cursor-pointer h-4.5 w-4.5"
                        />
                      </form>
                    </td>

                    {/* Categoria */}
                    <td className="px-3 py-3 text-left">
                      <span className="inline-block bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-semibold px-2 py-1 text-xs rounded border border-amber-100 dark:border-amber-900 uppercase">
                        {item.categoria || "Geral"}
                      </span>
                    </td>

                    {/* Descrição Editável */}
                    <td className="px-3 py-3 text-left">
                      <form id={`form-linha-${item.id}`} action={atualizarCustoAction}>
                        <input type="hidden" name="orcamento_projeto_id" value={orcId} />
                        <input type="hidden" name="item_id" value={item.id} />

                        <input
                          name="descricao"
                          type="text"
                          value={estado.descricao ?? ""}
                          onChange={(e) => handleLinhaDescChange(item.id, e.target.value)}
                          className={tableInputClass(true)}
                        />
                      </form>
                    </td>

                    {/* Un. Editável */}
                    <td className="px-3 py-3">
                      <input
                        form={`form-linha-${item.id}`}
                        name="unidade"
                        type="text"
                        value={estado.unidade ?? ""}
                        onChange={(e) => handleLinhaUnidadeChange(item.id, e.target.value)}
                        className="w-full text-center rounded border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 px-2 py-1.5 text-sm text-zinc-850 dark:text-zinc-300 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </td>

                    {/* Quantidade Editável */}
                    <td className="px-3 py-3">
                      <input
                        form={`form-linha-${item.id}`}
                        name="quantidade"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={estado.quantidade ?? 0}
                        onChange={(e) => handleLinhaQtdChange(item.id, Number(e.target.value))}
                        className="w-full rounded border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 px-2 py-1.5 text-right text-sm font-semibold text-zinc-900 dark:text-zinc-100 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </td>

                    {/* Custo Unitário Editável */}
                    <td className="px-3 py-3">
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-xs text-zinc-400 font-bold">R$</span>
                        <input
                          form={`form-linha-${item.id}`}
                          name="custo_unitario"
                          type="number"
                          min="0"
                          step="0.01"
                          value={(estado.custo_unitario ?? 0).toFixed(2)}
                          onChange={(e) => handleLinhaCustoChange(item.id, Number(e.target.value))}
                          className="w-full rounded border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 px-3 py-1.5 pl-8 text-right text-sm font-bold text-zinc-800 dark:text-zinc-300 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                      </div>
                    </td>

                    {/* Valor Total */}
                    <td className="px-3 py-3 font-bold text-brand-700 dark:text-brand-400 tabular-nums text-sm">
                      {brl(subtotalCalculado)}
                    </td>

                    {/* Ações: Salvar / Lixeira */}
                    <td className="px-3 py-3 text-center no-print">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="submit"
                          form={`form-linha-${item.id}`}
                          className="rounded bg-brand-600 hover:bg-brand-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition"
                        >
                          Salvar
                        </button>
                        
                        <form
                          action={removerCustoAction}
                          onSubmit={(e) => {
                            if (!confirm("Deseja realmente apagar este item do banco de dados?")) {
                              e.preventDefault();
                            }
                          }}
                        >
                          <input type="hidden" name="orcamento_projeto_id" value={orcId} />
                          <input type="hidden" name="item_id" value={item.id} />
                          <button
                            type="submit"
                            className="rounded border border-red-200 bg-white hover:bg-red-50 p-1.5 text-xs font-bold text-red-650 transition shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                          >
                            🗑️
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {catalogoFiltrado.length === 0 && itensPersonalizados.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-zinc-400">
                    Nenhum item cadastrado nesta rubrica. Adicione um custo personalizado abaixo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Resumo de Custos e Totais Consolidados do Projeto */}
      <section className="rounded-lg border border-zinc-200 bg-zinc-50 p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wide">Sumário de Custos do Orçamento</h4>
            <p className="mt-0.5 text-xs text-zinc-500 font-medium">Valores totais consolidados no momento.</p>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-right justify-end">
            <div className="flex flex-col">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wide">Subtotal {rubrica} ({rubricaLabel})</span>
              <span className="text-base font-extrabold text-zinc-900 dark:text-zinc-100 tabular-nums">{brl(totalRubrica)}</span>
            </div>
            <div className="h-8 w-px bg-zinc-200 dark:bg-zinc-800 hidden sm:block"></div>
            <div className="flex flex-col">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wide">Subtotal Técnico (Custos Diretos)</span>
              <span className="text-base font-extrabold text-zinc-900 dark:text-zinc-100 tabular-nums">{brl(subtotalProjeto)}</span>
            </div>
            {totalVendaProjeto > 0 && (
              <>
                <div className="h-8 w-px bg-zinc-200 dark:bg-zinc-800 hidden sm:block"></div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-brand-600 dark:text-brand-400 font-black uppercase tracking-wide">Valor Global de Venda</span>
                  <span className="text-lg font-black text-brand-700 dark:text-brand-400 tabular-nums">{brl(totalVendaProjeto)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Inserir Item Personalizado */}
      <section className="no-print rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 font-sans">Inserir Item Personalizado</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Adicione itens customizados extras que não constam no catálogo.
        </p>

        <form
          action={adicionarCustoManualAction}
          className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-5 items-end"
        >
          <input type="hidden" name="orcamento_projeto_id" value={orcId} />
          <input type="hidden" name="rubrica" value={rubrica} />

          {/* Categoria */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Categoria</label>
            <input
              name="categoria"
              type="text"
              placeholder="Geral"
              value={customCat}
              onChange={(e) => setCustomCat(e.target.value)}
              required
              className={inputClass}
            />
          </div>

          {/* Descrição */}
          <div className="flex flex-col gap-1 md:col-span-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Especificação / Item</label>
            <input
              name="descricao"
              type="text"
              placeholder="Ex: Item customizado"
              value={customDesc}
              onChange={(e) => setCustomDesc(e.target.value)}
              required
              className={inputClass}
            />
          </div>

          {/* Quantidade e Unidade */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Qtd.</label>
              <input
                name="quantidade"
                type="number"
                min="0.01"
                step="0.01"
                value={customQtd}
                onChange={(e) => setCustomQtd(Number(e.target.value))}
                required
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Unidade</label>
              <input
                name="unidade"
                type="text"
                placeholder="un"
                value={customUnidade}
                onChange={(e) => setCustomUnidade(e.target.value)}
                required
                className={inputClass}
              />
            </div>
          </div>

          {/* Valor Custo */}
          <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Valor Unitário (R$)</label>
              <input
                name="custo_unitario"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={customCusto}
                onChange={(e) => setCustomCusto(e.target.value === "" ? "" : Number(e.target.value))}
                required
                className={inputClass}
              />
            </div>

            <button
              type="submit"
              className="rounded bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-500 shadow-sm transition h-[34px]"
            >
              Adicionar
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
