"use client";

import React, { useState } from "react";
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

type FormPessoalProps = {
  orcId: number;
  projectMonths: number;
  catalogoPE: CatalogoItem[];
  itensPE: Custo[];
  adicionarCustoManualAction: (formData: FormData) => Promise<void>;
  alternarCustoCatalogoAction: (formData: FormData) => Promise<void>;
  atualizarCustoAction: (formData: FormData) => Promise<void>;
  removerCustoAction: (formData: FormData) => Promise<void>;
  subtotalProjeto: number;
  totalVendaProjeto: number;
  selecionarTodosAction: (formData: FormData) => Promise<void>;
  limparTodosAction: (formData: FormData) => Promise<void>;
};

function montarEstadoLinhas(itens: Custo[]) {
  const estados: Record<number, { descricao: string; custo_unitario: number; quantidade: number }> = {};
  itens.forEach(item => {
    estados[item.id] = {
      descricao: item.descricao ?? "",
      custo_unitario: Number(item.custo_unitario ?? 0),
      quantidade: Number(item.quantidade ?? 1),
    };
  });
  return estados;
}

export function FormPessoal({
  orcId,
  projectMonths,
  catalogoPE,
  itensPE,
  adicionarCustoManualAction,
  alternarCustoCatalogoAction,
  atualizarCustoAction,
  removerCustoAction,
  subtotalProjeto,
  totalVendaProjeto,
  selecionarTodosAction,
  limparTodosAction,
}: FormPessoalProps) {
  // Estado para busca de texto
  const [busca, setBusca] = useState("");

  // Mapear custos por catalogo_item_id
  const custosPorCatalogoId = new Map<string, Custo>();
  itensPE.forEach(it => {
    if (it.catalogo_item_id) {
      custosPorCatalogoId.set(it.catalogo_item_id, it);
    }
  });

  // Custos manuais/personalizados
  const itensPersonalizados = itensPE.filter(it => !it.catalogo_item_id);

  // Estados locais das linhas
  const [linhaEstados, setLinhaEstados] = useState(() => montarEstadoLinhas(itensPE));

  const handleLinhaDescricaoChange = (id: number, val: string) => {
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

  const handleLinhaQuantidadeChange = (id: number, val: number) => {
    setLinhaEstados(prev => ({
      ...prev,
      [id]: { ...prev[id], quantidade: val }
    }));
  };

  // Subtotal local da rubrica PE
  const totalRubrica = itensPE.reduce((acc, item) => {
    const estado = linhaEstados[item.id] || {
      custo_unitario: Number(item.custo_unitario),
      quantidade: Number(item.quantidade),
    };
    return acc + (estado.quantidade * estado.custo_unitario);
  }, 0);

  // Estados de inserção de personalizado
  const [customDesc, setCustomDesc] = useState("");
  const [customCusto, setCustomCusto] = useState<number | "">("");
  const [customCat, setCustomCat] = useState("Superior");
  const [customMeses, setCustomMeses] = useState(1);

  // Filtrar itens do catálogo por busca de texto
  const catalogoFiltrado = catalogoPE.filter(it =>
    it.descricao.toLowerCase().includes(busca.toLowerCase()) ||
    (it.categoria || "").toLowerCase().includes(busca.toLowerCase())
  );

  const tableInputClass = (habilitado: boolean) => 
    `w-full bg-card border transition focus:outline-none focus:ring-1 focus:ring-brand-500 rounded px-3 py-1.5 text-sm ${
      habilitado 
        ? "text-foreground border-border focus:border-brand-500 font-semibold" 
        : "text-muted-foreground/80 border-transparent cursor-not-allowed font-medium"
    }`;

  const inputClass =
    "rounded border border-input bg-card px-3 py-1.5 text-sm font-medium text-brand-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:text-brand-300";

  return (
    <div className="space-y-6">
      {/* Tabela de Pessoal Simplificada */}
      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/70 pb-3">
          <div>
            <h3 className="text-base font-bold text-foreground font-sans">Pessoal (PE)</h3>
            <p className="mt-0.5 text-xs text-muted-foreground font-medium">
              Selecione profissionais, ajuste qualificação/valor mensal e digite o número de meses do orçamento.
            </p>
          </div>
          <div className="flex gap-3 text-xs bg-muted/50 px-3 py-1.5 rounded-md font-semibold text-muted-foreground">
            <span>{itensPE.length} selecionados</span>
            <span className="text-muted-foreground/70">|</span>
            <span>{catalogoPE.length} no catálogo</span>
            <span className="text-muted-foreground/70">|</span>
            <span>{projectMonths} meses</span>
          </div>
        </div>

        {/* Painel de busca e seleção rápida */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 no-print bg-muted/30 p-3 rounded-lg border border-border/70">
          <div className="relative w-full max-w-xs">
            <input
              type="text"
              placeholder="Buscar profissional..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full rounded border border-input bg-card px-3 py-1.5 pl-8 text-xs font-semibold text-brand-700 placeholder:text-muted-foreground/60 focus:border-brand-500 focus:outline-none dark:text-brand-300"
            />
            <span className="absolute left-2.5 top-2.5 text-[10px] text-muted-foreground/80 font-bold uppercase tracking-wide">🔍</span>
          </div>

          <div className="flex items-center gap-2">
            <form action={selecionarTodosAction}>
              <input type="hidden" name="orcamento_projeto_id" value={orcId} />
              <input type="hidden" name="rubrica" value="PE" />
              <button
                type="submit"
                className="rounded border border-border bg-card hover:bg-muted/50 px-3 py-1.5 text-xs font-bold text-foreground transition shadow-sm"
              >
                ☑️ Selecionar todos
              </button>
            </form>

            <form action={limparTodosAction}>
              <input type="hidden" name="orcamento_projeto_id" value={orcId} />
              <input type="hidden" name="rubrica" value="PE" />
              <button
                type="submit"
                className="rounded border border-border bg-card hover:bg-muted/50 px-3 py-1.5 text-xs font-bold text-danger-strong transition shadow-sm"
              >
                ✕ Limpar todos
              </button>
            </form>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-right text-sm min-w-[950px] border-collapse">
            <thead>
              <tr className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground border-b border-border/70">
                <th className="px-3 py-2 text-center w-20">Incluir</th>
                <th className="px-3 py-2 text-left w-36">Qualificação</th>
                <th className="px-3 py-2 text-left">Profissional / Função</th>
                <th className="px-3 py-2 w-32">Un.</th>
                <th className="px-3 py-2 w-28">Qtd. (Meses)</th>
                <th className="px-3 py-2 w-44">Valor Unit. (Mensal)</th>
                <th className="px-3 py-2 w-36">Valor Total</th>
                <th className="no-print px-3 py-2 w-28 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {/* 1. Profissionais do Catálogo */}
              {catalogoFiltrado.map((catItem) => {
                const item = custosPorCatalogoId.get(catItem.id);
                const selecionado = Boolean(item);

                if (selecionado && item) {
                  const estado = linhaEstados[item.id] || {
                    descricao: item.descricao ?? "",
                    custo_unitario: Number(item.custo_unitario ?? 0),
                    quantidade: Number(item.quantidade ?? 1),
                  };

                  const totalCalculado = (estado.quantidade ?? 0) * (estado.custo_unitario ?? 0);

                  return (
                    <tr key={catItem.id} className="bg-brand-50/10 dark:bg-brand-950/5 hover:bg-muted/30">
                      {/* Incluir (Checkbox) */}
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

                      {/* Qualificação */}
                      <td className="px-3 py-3 text-left">
                        <span className="inline-block bg-muted/50 text-foreground font-semibold px-2 py-1 text-xs rounded border border-border uppercase">
                          {catItem.categoria || "Outro"}
                        </span>
                      </td>

                      {/* Profissional / Função */}
                      <td className="px-3 py-3 text-left">
                        <form id={`form-cat-${item.id}`} action={atualizarCustoAction}>
                          <input type="hidden" name="orcamento_projeto_id" value={orcId} />
                          <input type="hidden" name="item_id" value={item.id} />

                          <input
                            name="descricao"
                            type="text"
                            value={estado.descricao ?? ""}
                            onChange={(e) => handleLinhaDescricaoChange(item.id, e.target.value)}
                            className={tableInputClass(true)}
                          />
                        </form>
                      </td>

                      {/* Unidade */}
                      <td className="px-3 py-3 text-center text-muted-foreground font-semibold">
                        mês
                      </td>

                      {/* Quantidade (Meses) Editável */}
                      <td className="px-3 py-3">
                        <input
                          form={`form-cat-${item.id}`}
                          name="quantidade"
                          type="number"
                          min="0.1"
                          step="0.1"
                          value={estado.quantidade ?? 0}
                          onChange={(e) => handleLinhaQuantidadeChange(item.id, Number(e.target.value))}
                          className="w-full rounded border border-border bg-card px-2 py-1.5 text-right text-sm font-semibold text-foreground focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                      </td>

                      {/* Valor Unitário Editável */}
                      <td className="px-3 py-3">
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-xs text-muted-foreground/80 font-bold">R$</span>
                          <input
                            form={`form-cat-${item.id}`}
                            name="custo_unitario"
                            type="number"
                            min="0"
                            step="0.01"
                            value={(estado.custo_unitario ?? 0).toFixed(2)}
                            onChange={(e) => handleLinhaCustoChange(item.id, Number(e.target.value))}
                            className="w-full rounded border border-border bg-card px-3 py-1.5 pl-8 text-right text-sm font-bold text-brand-600 dark:text-brand-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                          />
                        </div>
                      </td>

                      {/* Valor Total */}
                      <td className="px-3 py-3 font-bold text-brand-700 dark:text-brand-400 tabular-nums text-sm">
                        {brl(totalCalculado)}
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
                              className="rounded border border-danger-strong/30 bg-card hover:bg-danger-soft p-1.5 text-xs font-bold text-danger-strong transition shadow-sm"
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
                    <tr key={catItem.id} className="opacity-60 hover:opacity-100 border-b border-border/70 transition">
                      {/* Incluir (Checkbox) */}
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

                      {/* Qualificação */}
                      <td className="px-3 py-3 text-left">
                        <span className="inline-block bg-transparent text-muted-foreground/80 font-medium px-2 py-1 text-xs rounded uppercase">
                          {catItem.categoria || "Outro"}
                        </span>
                      </td>

                      {/* Profissional / Função */}
                      <td className="px-3 py-3 text-left">
                        <input
                          type="text"
                          readOnly
                          value={catItem.descricao}
                          className={tableInputClass(false)}
                        />
                      </td>

                      {/* Unidade */}
                      <td className="px-3 py-3 text-center text-muted-foreground/80 font-medium">
                        mês
                      </td>

                      {/* Qtd. Vazia */}
                      <td className="px-3 py-3 text-muted-foreground/70 font-light text-center">—</td>

                      {/* Valor Mensal Padrão */}
                      <td className="px-3 py-3 tabular-nums text-muted-foreground/80 text-sm font-semibold pl-8">
                        {brl(Number(catItem.preco_unitario ?? 0))}
                      </td>

                      {/* Total Vazio */}
                      <td className="px-3 py-3 text-muted-foreground/70 font-light text-sm">—</td>
                      <td className="px-3 py-3"></td>
                    </tr>
                  );
                }
              })}

              {/* 2. Profissionais Personalizados (Manuais) */}
              {itensPersonalizados.map((item) => {
                const estado = linhaEstados[item.id] || {
                  descricao: item.descricao ?? "",
                  custo_unitario: Number(item.custo_unitario ?? 0),
                  quantidade: Number(item.quantidade ?? 1),
                };

                const totalCalculado = (estado.quantidade ?? 0) * (estado.custo_unitario ?? 0);

                return (
                  <tr key={item.id} className="bg-warning-soft/10 hover:bg-muted/30">
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

                    {/* Qualificação */}
                    <td className="px-3 py-3 text-left">
                      <span className="inline-block bg-warning-soft text-warning-strong font-semibold px-2 py-1 text-xs rounded border border-warning-strong/20 uppercase">
                        {item.categoria || "Superior"}
                      </span>
                    </td>

                    {/* Nome/Descrição Editável */}
                    <td className="px-3 py-3 text-left">
                      <form id={`form-linha-${item.id}`} action={atualizarCustoAction}>
                        <input type="hidden" name="orcamento_projeto_id" value={orcId} />
                        <input type="hidden" name="item_id" value={item.id} />

                        <input
                          name="descricao"
                          type="text"
                          value={estado.descricao ?? ""}
                          onChange={(e) => handleLinhaDescricaoChange(item.id, e.target.value)}
                          className={tableInputClass(true)}
                        />
                      </form>
                    </td>

                    {/* Unidade */}
                    <td className="px-3 py-3 text-center text-muted-foreground font-semibold">
                      mês
                    </td>

                    {/* Quantidade Editável */}
                    <td className="px-3 py-3">
                      <input
                        form={`form-linha-${item.id}`}
                        name="quantidade"
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={estado.quantidade ?? 0}
                        onChange={(e) => handleLinhaQuantidadeChange(item.id, Number(e.target.value))}
                        className="w-full rounded border border-border bg-card px-2 py-1.5 text-right text-sm font-semibold text-foreground focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </td>

                    {/* Valor Unitário */}
                    <td className="px-3 py-3">
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-xs text-muted-foreground/80 font-bold">R$</span>
                        <input
                          form={`form-linha-${item.id}`}
                          name="custo_unitario"
                          type="number"
                          min="0"
                          step="0.01"
                          value={(estado.custo_unitario ?? 0).toFixed(2)}
                          onChange={(e) => handleLinhaCustoChange(item.id, Number(e.target.value))}
                          className="w-full rounded border border-input bg-card px-3 py-1.5 pl-8 text-right text-sm font-bold text-brand-600 dark:text-brand-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                      </div>
                    </td>

                    {/* Valor Total */}
                    <td className="px-3 py-3 font-bold text-brand-700 dark:text-brand-400 tabular-nums text-sm">
                      {brl(totalCalculado)}
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
                            className="rounded border border-danger-strong/30 bg-card hover:bg-danger-soft p-1.5 text-xs font-bold text-danger-strong transition shadow-sm"
                          >
                            🗑️
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Resumo de Custos e Totais Consolidados do Projeto */}
      <section className="rounded-lg border border-border bg-muted/50 p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-bold text-foreground uppercase tracking-wide">Sumário de Custos do Orçamento</h4>
            <p className="mt-0.5 text-xs text-muted-foreground font-medium">Valores totais consolidados no momento.</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-4 text-right">
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">Subtotal PE (Pessoal)</span>
              <span className="text-base font-extrabold text-foreground tabular-nums">{brl(totalRubrica)}</span>
            </div>
            <div className="h-8 w-px bg-muted hidden sm:block"></div>
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">Subtotal Técnico (Custos Diretos)</span>
              <span className="text-base font-extrabold text-foreground tabular-nums">{brl(subtotalProjeto)}</span>
            </div>
            {totalVendaProjeto > 0 && (
              <>
                <div className="h-8 w-px bg-muted hidden sm:block"></div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-brand-600 dark:text-brand-400 font-black uppercase tracking-wide">Valor Global de Venda</span>
                  <span className="text-lg font-black text-brand-700 dark:text-brand-400 tabular-nums">{brl(totalVendaProjeto)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Inserir Profissional Extra */}
      <section className="no-print rounded-lg border border-border bg-card p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground font-sans">Inserir Profissional Extra</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Adicione integrantes adicionais na equipe do projeto com valor e categoria personalizados.
        </p>

        <form
          action={adicionarCustoManualAction}
          className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-4 items-end"
        >
          <input type="hidden" name="orcamento_projeto_id" value={orcId} />
          <input type="hidden" name="rubrica" value="PE" />
          <input type="hidden" name="unidade" value="mês" />

          {/* Categoria */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Qualificação</label>
            <select
              name="categoria"
              value={customCat}
              onChange={(e) => setCustomCat(e.target.value)}
              className={inputClass}
            >
              <option value="Superior">Superior</option>
              <option value="Técnica">Técnica</option>
              <option value="Doutor">Doutor</option>
              <option value="Doutora">Doutora</option>
              <option value="Mestre">Mestre</option>
            </select>
          </div>

          {/* Descrição */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nome / Descrição Customizada</label>
            <input
              name="descricao"
              type="text"
              placeholder="Ex: Consultor Especializado"
              value={customDesc}
              onChange={(e) => setCustomDesc(e.target.value)}
              required
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Qtd. (Meses)</label>
              <input
                name="quantidade"
                type="number"
                min="0.1"
                step="0.1"
                value={customMeses}
                onChange={(e) => setCustomMeses(Number(e.target.value))}
                required
                className={inputClass}
              />
            </div>
            
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Valor Unitário (R$)</label>
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
          </div>

          <button
            type="submit"
            className="rounded bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-500 shadow-sm transition h-[34px] w-full"
          >
            Adicionar
          </button>
        </form>
      </section>
    </div>
  );
}
