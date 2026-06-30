"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Archive,
  Bell,
  Boxes,
  CalendarClock,
  Check,
  ExternalLink,
  Search,
  ShieldAlert,
  ShoppingCart,
  TrendingDown,
  XCircle,
  Layers,
  BarChart3,
  ListFilter,
  Info,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNumber, formatDate } from "@/lib/formatters";
import { arquivarNotificacao, marcarNotificacaoLida } from "@/lib/actions/notificacoes";
import { LoteAcoes } from "@/components/estoque/LoteAcoes";

type Notificacao = {
  id: number;
  tipo: string;
  titulo: string;
  corpo: string | null;
  entidade_tipo: string | null;
  entidade_id: number | null;
  papel_destino: string | null;
  canal: string;
  status: string;
  criado_em: string;
};

type EstoqueSaldo = {
  insumo_id: number | null;
  especificacao: string | null;
  unidade: string | null;
  em_maos: number | null;
  em_quarentena: number | null;
  reservado: number | null;
  disponivel: number | null;
  ponto_reposicao: number | null;
  estoque_seguranca: number | null;
  categoria_compra: string | null;
};

type AlertaEstoque = {
  tipo: string | null;
  insumo_id: number | null;
  especificacao: string | null;
  validade: string | null;
  valor: number | null;
  referencia: number | null;
};

type LoteDbRow = {
  id: number;
  codigoLote: string;
  validade: string;
  quantidadeAtual: number;
  status: string;
  statusLabel: string;
  especificacao: string;
  unidade: string;
  vencido: boolean;
};

type StockControlHubProps = {
  initialNotifications: Notificacao[];
  saldo: EstoqueSaldo[];
  alertas: AlertaEstoque[];
  lotes: LoteDbRow[];
  podeAceitar: boolean;
  podeGerir: boolean;
};

export function StockControlHub({
  initialNotifications,
  saldo,
  alertas,
  lotes,
  podeAceitar,
  podeGerir,
}: StockControlHubProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAlertType, setSelectedAlertType] = useState<string>("todos");
  const [selectedCriticidade, setSelectedCriticidade] = useState<string>("todos");
  const [selectedStatus, setSelectedStatus] = useState<string>("todos");
  const [viewMode, setViewMode] = useState<"insumo" | "lote" | "grafica">("insumo");
  const [isPending, startTransition] = useTransition();

  // Mapear notificações por insumo_id ou por texto correspondente
  const getNotificationsForInsumo = useCallback((insumoId: number | null, especificacao: string | null) => {
    return initialNotifications.filter((n) => {
      if (insumoId != null && n.entidade_tipo === "insumo" && n.entidade_id === insumoId) return true;
      if (especificacao && n.titulo.toLowerCase().includes(especificacao.toLowerCase())) return true;
      return false;
    });
  }, [initialNotifications]);

  // Enriquecer dados dos insumos com status de estoque e alertas correspondentes
  const items = useMemo(() => {
    return saldo.map((s) => {
      const itemAlerts = alertas.filter((a) => a.insumo_id === s.insumo_id);
      const itemNotifications = getNotificationsForInsumo(s.insumo_id, s.especificacao);

      let status = "ok";
      let statusLabel = "Estoque OK";
      let tone: "red" | "amber" | "blue" | "emerald" | "slate" = "slate";

      const disponivel = s.disponivel ?? 0;
      const pontoReposicao = s.ponto_reposicao ?? 0;
      const emQuarentena = s.em_quarentena ?? 0;

      const temVencido = itemAlerts.some((a) => a.tipo === "vencido");
      const temSemValidade = itemAlerts.some((a) => a.tipo === "sem_validade");
      const temVencendo = itemAlerts.some((a) => a.tipo === "vencimento");

      if (disponivel <= 0) {
        status = "sem_disponivel";
        statusLabel = "Sem Estoque";
        tone = "red";
      } else if (temVencido) {
        status = "vencido";
        statusLabel = "Lote Vencido";
        tone = "red";
      } else if (temSemValidade) {
        status = "sem_validade";
        statusLabel = "Sem Validade";
        tone = "red";
      } else if (disponivel <= pontoReposicao && pontoReposicao > 0) {
        status = "reposicao";
        statusLabel = "Reposição";
        tone = "amber";
      } else if (temVencendo) {
        status = "vencendo";
        statusLabel = "Vence em breve";
        tone = "amber";
      } else if (emQuarentena > 0) {
        status = "quarentena";
        statusLabel = "Em Quarentena";
        tone = "emerald";
      }

      return {
        ...s,
        status,
        statusLabel,
        tone,
        alerts: itemAlerts,
        notifications: itemNotifications,
      };
    });
  }, [saldo, alertas, getNotificationsForInsumo]);

  // Filtragem dos itens de Insumo
  const filteredInsumos = useMemo(() => {
    return items.filter((item) => {
      if (
        searchTerm &&
        !item.especificacao?.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !(item.insumo_id != null && item.insumo_id.toString().includes(searchTerm))
      ) {
        return false;
      }

      if (selectedAlertType !== "todos") {
        if (selectedAlertType === "reposicao" && item.status !== "reposicao") return false;
        if (selectedAlertType === "vencido_vencendo" && item.status !== "vencido" && item.status !== "vencendo") return false;
        if (selectedAlertType === "quarentena" && item.status !== "quarentena") return false;
        if (selectedAlertType === "sem_disponivel" && item.status !== "sem_disponivel") return false;
        if (selectedAlertType === "ok" && item.status !== "ok") return false;
      }

      if (selectedCriticidade !== "todos") {
        if (item.categoria_compra !== selectedCriticidade) return false;
      }

      if (selectedStatus !== "todos") {
        if (selectedStatus === "pendentes" && !item.notifications.some((n) => n.status === "nao_lida")) return false;
        if (selectedStatus === "tratadas" && item.notifications.length > 0 && !item.notifications.every((n) => n.status === "lida")) return false;
        if (selectedStatus === "sem_notificacao" && item.notifications.length > 0) return false;
      }

      return true;
    });
  }, [items, searchTerm, selectedAlertType, selectedCriticidade, selectedStatus]);

  // Filtragem dos Lotes
  const filteredLotes = useMemo(() => {
    return lotes.filter((lote) => {
      // Busca por nome do insumo do lote ou código do lote
      if (
        searchTerm &&
        !lote.especificacao?.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !lote.codigoLote?.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return false;
      }

      // Filtro de situação física do lote
      if (selectedAlertType !== "todos") {
        if (selectedAlertType === "quarentena" && lote.status !== "quarentena") return false;
        if (selectedAlertType === "vencido_vencendo" && !lote.vencido) return false;
      }

      return true;
    });
  }, [lotes, searchTerm, selectedAlertType]);

  // Contagem para gráficos e KPIs baseados em TODOS os itens
  const totalInsumos = items.length;
  const countSemEstoque = items.filter((i) => i.status === "sem_disponivel").length;
  const countRepor = items.filter((i) => i.status === "reposicao").length;
  const countVencidos = items.filter((i) => i.status === "vencido" || i.status === "sem_validade").length;
  const countVencendo = items.filter((i) => i.status === "vencendo").length;
  const countQuarentena = items.filter((i) => i.status === "quarentena").length;
  const countOk = items.filter((i) => i.status === "ok").length;

  const chartData = [
    { name: "Sem Estoque", value: countSemEstoque, color: "#ef4444" },
    { name: "Vencido/Sem Val.", value: countVencidos, color: "#f87171" },
    { name: "Reposição", value: countRepor, color: "#f59e0b" },
    { name: "Vencendo", value: countVencendo, color: "#fbbf24" },
    { name: "Quarentena", value: countQuarentena, color: "#10b981" },
    { name: "Estoque OK", value: countOk, color: "#3b82f6" },
  ].filter((d) => d.value > 0);

  const TONE_CLASSES = {
    red: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200",
    amber: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200",
    blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200",
    slate: "border-slate-200 bg-slate-50 text-slate-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200",
  };

  return (
    <div className="grid gap-6">
      {/* 1. Visão Geral / KPIs Visuais */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase text-slate-500">Sem Estoque</p>
            <span className="rounded-md bg-red-100 p-1 text-red-600 dark:bg-red-950/50">
              <XCircle className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-3xl font-bold tracking-tight text-red-600">{countSemEstoque}</p>
          <p className="mt-1 text-xs text-slate-500">críticos sem saldo</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase text-slate-500">Reposição</p>
            <span className="rounded-md bg-amber-100 p-1 text-amber-600 dark:bg-amber-950/50">
              <TrendingDown className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-3xl font-bold tracking-tight text-amber-600">{countRepor}</p>
          <p className="mt-1 text-xs text-slate-500">abaixo do ponto</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase text-slate-500">Validade</p>
            <span className="rounded-md bg-orange-100 p-1 text-orange-600 dark:bg-orange-950/50">
              <CalendarClock className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-3xl font-bold tracking-tight text-orange-600">{countVencidos + countVencendo}</p>
          <p className="mt-1 text-xs text-slate-500">{countVencidos} lotes vencidos</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase text-slate-500">Quarentena</p>
            <span className="rounded-md bg-emerald-100 p-1 text-emerald-600 dark:bg-emerald-950/50">
              <Boxes className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-3xl font-bold tracking-tight text-emerald-600">{countQuarentena}</p>
          <p className="mt-1 text-xs text-slate-500">lotes aguardando aceite</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase text-slate-500">Saúde do Estoque</p>
            <span className="rounded-md bg-blue-100 p-1 text-blue-600 dark:bg-blue-950/50">
              <ShieldAlert className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-3xl font-bold tracking-tight text-blue-600">{Math.round((countOk / totalInsumos) * 100)}%</p>
          <p className="mt-1 text-xs text-slate-500">dos itens sem alertas</p>
        </div>
      </section>

      {/* 2. Filtros e Visualizações */}
      <section className="grid gap-4 lg:grid-cols-[2.2fr_0.8fr]">
        {/* Barra de Filtros / Seleções */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-50 flex items-center gap-2">
                <ListFilter className="h-4 w-4 text-slate-400" /> Seleções do Estoque
              </h2>
              {/* Toggles de Visualização */}
              <div className="inline-flex rounded-md shadow-sm" role="group">
                <button
                  onClick={() => setViewMode("insumo")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-l-md border ${
                    viewMode === "insumo"
                      ? "bg-brand-50 border-brand-200 text-brand-700 dark:bg-brand-950/20 dark:border-brand-900 dark:text-brand-300"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-zinc-900 dark:border-zinc-850 dark:text-zinc-300"
                  }`}
                >
                  <span className="flex items-center gap-1"><Boxes className="h-3.5 w-3.5" /> Por Insumo</span>
                </button>
                <button
                  onClick={() => setViewMode("lote")}
                  className={`px-3 py-1.5 text-xs font-medium border-t border-b ${
                    viewMode === "lote"
                      ? "bg-brand-50 border-brand-200 text-brand-700 dark:bg-brand-950/20 dark:border-brand-900 dark:text-brand-300"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-zinc-900 dark:border-zinc-850 dark:text-zinc-300"
                  }`}
                >
                  <span className="flex items-center gap-1"><Layers className="h-3.5 w-3.5" /> Por Lote</span>
                </button>
                <button
                  onClick={() => setViewMode("grafica")}
                  className={`px-3 py-1.5 text-xs font-medium rounded-r-md border ${
                    viewMode === "grafica"
                      ? "bg-brand-50 border-brand-200 text-brand-700 dark:bg-brand-950/20 dark:border-brand-900 dark:text-brand-300"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-zinc-900 dark:border-zinc-850 dark:text-zinc-300"
                  }`}
                >
                  <span className="flex items-center gap-1"><BarChart3 className="h-3.5 w-3.5" /> Visão Gráfica</span>
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              {/* Busca */}
              <div className="relative">
                <label className="block text-xs font-medium text-slate-500 mb-1">Buscar Insumo</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder={viewMode === "lote" ? "Insumo ou lote..." : "Insumo ou ID..."}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full rounded-md border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-sm outline-none focus:border-brand-500 dark:border-zinc-800 dark:bg-zinc-900"
                  />
                </div>
              </div>

              {/* Alerta de Estoque */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Estado Físico / Alerta</label>
                <select
                  value={selectedAlertType}
                  onChange={(e) => setSelectedAlertType(e.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 dark:border-zinc-800 dark:bg-zinc-900"
                  disabled={viewMode === "grafica"}
                >
                  <option value="todos">Todos</option>
                  <option value="sem_disponivel">Sem Estoque</option>
                  <option value="reposicao">Abaixo do Ponto (Repor)</option>
                  <option value="vencido_vencendo">Vencido/Vencendo</option>
                  <option value="quarentena">Em Quarentena</option>
                  <option value="ok" disabled={viewMode === "lote"}>Estoque OK</option>
                </select>
              </div>

              {/* Criticidade */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Criticidade</label>
                <select
                  value={selectedCriticidade}
                  onChange={(e) => setSelectedCriticidade(e.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 dark:border-zinc-800 dark:bg-zinc-900"
                  disabled={viewMode === "lote" || viewMode === "grafica"}
                >
                  <option value="todos">Todas</option>
                  <option value="critico">Crítico</option>
                  <option value="normal">Normal</option>
                </select>
              </div>

              {/* Status Notificações */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Estado Administrativo</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 dark:border-zinc-800 dark:bg-zinc-900"
                  disabled={viewMode === "lote" || viewMode === "grafica"}
                >
                  <option value="todos">Todos</option>
                  <option value="pendentes">Não Tratadas (Pendentes)</option>
                  <option value="tratadas">Tratadas / Lidas</option>
                  <option value="sem_notificacao">Sem Log In-App</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-between items-center text-xs text-slate-500">
            <span>
              {viewMode === "lote"
                ? `Mostrando ${filteredLotes.length} de ${lotes.length} lotes filtrados`
                : `Mostrando ${filteredInsumos.length} de ${totalInsumos} insumos filtrados`}
            </span>
            {(searchTerm || selectedAlertType !== "todos" || selectedCriticidade !== "todos" || selectedStatus !== "todos") && (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setSelectedAlertType("todos");
                  setSelectedCriticidade("todos");
                  setSelectedStatus("todos");
                }}
                className="text-brand-600 hover:text-brand-700 font-semibold"
              >
                Limpar filtros
              </button>
            )}
          </div>
        </div>

        {/* Mini gráfico */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase text-slate-500">Alertas Ativos</h3>
            <p className="text-[10px] text-slate-400">Total de eventos operacionais críticos</p>
          </div>
          <div className="h-24 mt-2">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 2, right: 2, left: -32, bottom: 2 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.2} />
                  <XAxis dataKey="name" fontSize={8} tickLine={false} axisLine={false} />
                  <YAxis fontSize={8} tickLine={false} axisLine={false} />
                  <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Nenhum alerta ativo
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 3. Renderização Principal Baseada no ViewMode */}
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 overflow-hidden">
        {/* CABEÇALHO DO MÓDULO */}
        <div className="border-b border-slate-100 px-5 py-4 dark:border-zinc-900 bg-slate-50/50 dark:bg-zinc-900/10 flex justify-between items-center">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-50">
              {viewMode === "insumo" && "Visão Consolidada de Insumos"}
              {viewMode === "lote" && "Listagem Detalhada por Lote"}
              {viewMode === "grafica" && "Relatórios de Estoque"}
            </h2>
            <p className="text-xs text-slate-500">
              {viewMode === "insumo" && "Saldos do insumo consolidado, ideais para análise de compras e reposições."}
              {viewMode === "lote" && "Lotes individuais ativos, validades e ações físicas de movimentação."}
              {viewMode === "grafica" && "Análise macro do estoque por faixas, alertas e status físico."}
            </p>
          </div>
          <span className="text-xs text-slate-400">
            {viewMode === "insumo" && `${filteredInsumos.length} reagentes`}
            {viewMode === "lote" && `${filteredLotes.length} lotes`}
          </span>
        </div>

        {/* VISÃO 1: POR INSUMO */}
        {viewMode === "insumo" && (
          filteredInsumos.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Nenhum insumo ou alerta localizado com os filtros selecionados.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-zinc-900">
              {filteredInsumos.map((item, idx) => {
                const disponivel = item.disponivel ?? 0;
                const emMaos = item.em_maos ?? 0;
                const ponto = item.ponto_reposicao ?? 0;
                const pctMin = puntoPct(disponivel, ponto);

                return (
                  <article key={item.insumo_id ?? idx} className="p-5 hover:bg-slate-50/40 dark:hover:bg-zinc-900/10 transition-colors">
                    <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr_1.5fr]">
                      {/* Nome do Insumo e Detalhes */}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-mono text-slate-400 bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                            #{item.insumo_id ?? "—"}
                          </span>
                          <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${TONE_CLASSES[item.tone]}`}>
                            {item.statusLabel}
                          </span>
                          {item.categoria_compra === "critico" && (
                            <span className="rounded-md border border-red-200 bg-red-50 text-red-700 px-2 py-0.5 text-[10px] font-bold dark:border-red-950 dark:bg-red-950/20 dark:text-red-400">
                              Crítico
                            </span>
                          )}
                        </div>
                        <h3 className="mt-2 text-base font-semibold text-slate-900 dark:text-zinc-50 truncate" title={item.especificacao ?? ""}>
                          {item.especificacao ?? "Insumo sem nome"}
                        </h3>
                        <div className="mt-1 text-xs text-slate-500 flex flex-wrap gap-x-4">
                          <span>Em mãos: {formatNumber(emMaos)} {item.unidade}</span>
                          <span>Reservado: {formatNumber(item.reservado)} {item.unidade}</span>
                        </div>
                      </div>

                      {/* Progresso do Saldo */}
                      <div className="flex flex-col justify-center">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-slate-500 font-medium">Disponível: {formatNumber(disponivel)} {item.unidade}</span>
                          {ponto > 0 && (
                            <span className="text-slate-400">Ponto: {formatNumber(ponto)} {item.unidade}</span>
                          )}
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-zinc-900 relative">
                          <div
                            className={`h-full rounded-full ${
                              item.status === "sem_disponivel"
                                ? "bg-red-500"
                                : item.status === "reposicao"
                                  ? "bg-amber-500"
                                  : "bg-brand-600"
                            }`}
                            style={{ width: `${Math.min(100, pctMin)}%` }}
                          />
                        </div>
                        {ponto > 0 && disponivel <= ponto && (
                          <p className="mt-1.5 text-[11px] text-amber-600 font-medium flex items-center gap-1">
                            <TrendingDown className="h-3 w-3" /> Falta comprar: {formatNumber(ponto - disponivel)} {item.unidade}
                          </p>
                        )}
                      </div>

                      {/* Logs e Ações */}
                      <div className="flex flex-col justify-between gap-3">
                        <div className="space-y-1.5">
                          {item.notifications.length > 0 ? (
                            item.notifications.map((n) => (
                              <div key={n.id} className="rounded-md border border-slate-100 bg-slate-50 p-2 dark:border-zinc-800 dark:bg-zinc-900 text-xs">
                                <div className="flex justify-between items-start gap-2">
                                  <span className="font-semibold text-slate-800 dark:text-zinc-200 flex items-center gap-1">
                                    <Bell className="h-3 w-3 text-slate-400" /> {n.titulo}
                                  </span>
                                  <span className="text-[10px] text-slate-400 shrink-0">
                                    {new Date(n.criado_em).toLocaleDateString("pt-BR")}
                                  </span>
                                </div>
                                {n.corpo && <p className="text-slate-500 mt-0.5 line-clamp-1">{n.corpo}</p>}
                                
                                <div className="mt-2 flex justify-end gap-2">
                                  {n.status === "nao_lida" && (
                                    <form
                                      onSubmit={(e) => {
                                        e.preventDefault();
                                        const formData = new FormData();
                                        formData.append("notificacao_id", n.id.toString());
                                        startTransition(async () => {
                                          await marcarNotificacaoLida(formData);
                                        });
                                      }}
                                    >
                                      <button type="submit" disabled={isPending} className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 font-semibold hover:text-emerald-700">
                                        <Check className="h-3 w-3" /> Tratar Alerta
                                      </button>
                                    </form>
                                  )}
                                  <form
                                    onSubmit={(e) => {
                                      e.preventDefault();
                                      const formData = new FormData();
                                      formData.append("notificacao_id", n.id.toString());
                                      startTransition(async () => {
                                        await arquivarNotificacao(formData);
                                      });
                                    }}
                                  >
                                    <button type="submit" disabled={isPending} className="inline-flex items-center gap-0.5 text-[10px] text-slate-500 font-semibold hover:text-slate-700">
                                      <Archive className="h-3 w-3" /> Arquivar
                                    </button>
                                  </form>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-slate-400 italic">Sem notificações ativas.</p>
                          )}

                          {item.alerts.filter((a) => a.tipo === "vencido" || a.tipo === "vencimento").map((a, idx) => (
                            <div key={idx} className="text-xs text-red-600 font-semibold flex items-center gap-1.5">
                              <CalendarClock className="h-3.5 w-3.5" />
                              {a.tipo === "vencido" ? "Vencido em:" : "Vence em:"} {a.validade ? new Date(a.validade).toLocaleDateString("pt-BR") : "sem data"}
                            </div>
                          ))}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 justify-end mt-auto">
                          <Link
                            href={`/cadastros`}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
                          >
                            <ExternalLink className="h-3.5 w-3.5" /> Ficha
                          </Link>
                          {disponivel <= ponto && (
                            <Link
                              href="/compras"
                              className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-500"
                            >
                              <ShoppingCart className="h-3.5 w-3.5" /> Solicitar Compra
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )
        )}

        {/* VISÃO 2: POR LOTE */}
        {viewMode === "lote" && (
          filteredLotes.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Nenhum lote localizado com os filtros selecionados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-500 dark:text-zinc-400">
                <thead className="bg-slate-50 text-xs uppercase text-slate-700 dark:bg-zinc-900 dark:text-zinc-400">
                  <tr>
                    <th scope="col" className="px-6 py-3">Insumo / Especificação</th>
                    <th scope="col" className="px-6 py-3">Código do Lote</th>
                    <th scope="col" className="px-6 py-3">Status</th>
                    <th scope="col" className="px-6 py-3">Quantidade</th>
                    <th scope="col" className="px-6 py-3">Validade</th>
                    <th scope="col" className="px-6 py-3 text-right">Ações Operacionais (Auditoria)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-900">
                  {filteredLotes.map((lote) => (
                    <tr key={lote.id} className="bg-white hover:bg-slate-50/50 dark:bg-zinc-950 dark:hover:bg-zinc-900/10 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-900 dark:text-zinc-100">
                        {lote.especificacao}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs">
                        {lote.codigoLote}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                          lote.status === "quarentena"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                            : lote.status === "bloqueado"
                              ? "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300"
                              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                        }`}>
                          {lote.statusLabel}
                        </span>
                      </td>
                      <td className="px-6 py-4 tabular-nums">
                        {formatNumber(lote.quantidadeAtual)} {lote.unidade}
                      </td>
                      <td className={`px-6 py-4 text-xs font-semibold ${lote.vencido ? "text-red-600" : ""}`}>
                        {formatDate(lote.validade)}
                        {lote.vencido && " (Vencido)"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <LoteAcoes
                          loteId={lote.id}
                          status={lote.status}
                          quantidadeAtual={lote.quantidadeAtual}
                          unidade={lote.unidade}
                          podeAceitar={podeAceitar}
                          podeGerir={podeGerir}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* VISÃO 3: VISÃO GRÁFICA */}
        {viewMode === "grafica" && (
          <div className="p-6 grid gap-6 md:grid-cols-2">
            {/* Gráfico 1: Situação Geral */}
            <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-5 dark:border-zinc-900 dark:bg-zinc-900/10">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200 mb-4">Situação Física dos Insumos</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={3}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [value, "Insumos"]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                {chartData.map((d, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-slate-600 truncate">{d.name}:</span>
                    <span className="font-bold tabular-nums ml-auto">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quadro de Resumo de Cobertura */}
            <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-5 dark:border-zinc-900 dark:bg-zinc-900/10 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5 mb-2">
                  <Info className="h-4 w-4 text-slate-400" /> Notas Operacionais de Controle
                </h3>
                <ul className="space-y-3 text-xs text-slate-600 mt-4 leading-relaxed">
                  <li className="flex items-start gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                    <span><b>{countSemEstoque} insumos críticos estão totalmente sem saldo disponível</b> no estoque. A abertura imediata de pedidos de compra é recomendada.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                    <span>Existem <b>{countRepor} insumos abaixo do ponto de reposição</b>, o que pode comprometer reservas e planejamentos operacionais em andamento.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <span><b>{countQuarentena} lotes estão aguardando inspeção/aceite técnico</b>. Use a <i>Visão por Lote</i> para liberar os insumos para uso operacional.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                    <span><b>{countOk} reagentes e insumos estão com estoque saudável</b>, satisfazendo a demanda estipulada de segurança.</span>
                  </li>
                </ul>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200/60 dark:border-zinc-800">
                <div className="flex justify-between items-center text-xs font-semibold text-slate-800 mb-1">
                  <span>Taxa de Saúde de Estoque:</span>
                  <span>{Math.round((countOk / totalInsumos) * 100)}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-brand-600"
                    style={{ width: `${Math.round((countOk / totalInsumos) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function puntoPct(disponivel: number, ponto: number) {
  if (ponto <= 0) return disponivel > 0 ? 100 : 0;
  return (disponivel / ponto) * 100;
}
