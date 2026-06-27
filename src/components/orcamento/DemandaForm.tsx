"use client";

import { useActionState, useMemo, useState } from "react";
import type { DemandaFormState } from "@/lib/actions/demandas";
import { criarDemandaCompleta, salvarDemanda } from "@/lib/actions/demandas";
import { modalidadeExigeLaboratorio } from "@/lib/orcamento/orcamento-economico";
import { TOM_ENTRADA } from "@/lib/orcamento/tom-valor";
import { Pencil, Trash2 } from "lucide-react";

type Option = { id: number; nome: string };
type Demanda = {
  id: number;
  titulo: string | null;
  cliente_id: number | null;
  projeto_id: number | null;
  cliente_nome: string | null;
  cliente_cnpj: string | null;
  cliente_contato: string | null;
  instituicao: string | null;
  responsavel_interno: string | null;
  origem: string | null;
  data_solicitacao: string | null;
  prazo_esperado: string | null;
  matriz_amostra: string | null;
  quantidade_amostras_estimada: number | null;
  prazo_tecnico_dias: number | null;
  modalidade: string | null;
  status: string | null;
  prioridade: string | null;
  descricao: string | null;
  escopo_preliminar: string | null;
  observacoes: string | null;
};
export type AnaliseCatalogoDemanda = {
  codigo: string;
  nome: string | null;
  nome_simplificado: string | null;
  descricao: string | null;
  status: string | null;
  metodo: string | null;
  matriz?: string | null;
  unidade: string | null;
  prazo_tecnico_dias: number | null;
  custeio_disponivel: boolean;
  lote_padrao: number | null;
  capacidade_dia: number | null;
  reagentes: Array<{
    especificacao: string;
    unidade: string;
    quantidade_por_amostra: number;
    custo_unitario?: number | null;
    status_vinculo_insumo?: string | null;
    estoque_status?: string | null;
    modo_cobranca: "por_amostra" | "por_execucao";
  }>;
};
export type GrupoAmostraDemanda = {
  id?: number | null;
  identificacao: string;
  tipo_matriz: string | null;
  quantidade_amostras: number;
  unidade: string;
  observacao: string | null;
};
export type AnaliseSelecionadaDemanda = {
  grupo_amostra_id?: number | null;
  grupo_identificacao?: string | null;
  codigo_analise: string;
  quantidade_amostras: number;
  origem_quantidade: string;
  status_custeio?: string | null;
};

const initialState: DemandaFormState = { ok: false };
const inp = `rounded-md border-2 border-brand-300 bg-white px-3 py-2 text-sm font-medium shadow-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-200 dark:border-brand-700 dark:bg-zinc-950 dark:focus:ring-brand-900 ${TOM_ENTRADA}`;
const inheritedInp = "rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200";
const operationalInp = "rounded-md border-2 border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950 shadow-sm outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-200 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100";
const lbl = "block text-xs font-medium text-zinc-600 dark:text-zinc-300";

export function DemandaForm({
  demanda,
  clientes,
  projetos,
  analises,
  gruposAmostras,
  analisesSelecionadas,
  modo = "completo",
}: {
  demanda: Demanda;
  clientes: Option[];
  projetos: Option[];
  analises: AnaliseCatalogoDemanda[];
  gruposAmostras: GrupoAmostraDemanda[];
  analisesSelecionadas: AnaliseSelecionadaDemanda[];
  modo?: "completo" | "demanda" | "laboratorio";
}) {
  const action = demanda.id > 0 ? salvarDemanda : criarDemandaCompleta;
  const [state, formAction, pending] = useActionState(action, initialState);
  const quantidadeInicial = demanda.quantidade_amostras_estimada ?? 1;
  const [modalidade, setModalidade] = useState(demanda.modalidade ?? "analises");
  const [busca, setBusca] = useState("");
  const [grupos, setGrupos] = useState(() => {
    const base = gruposAmostras.length > 0 ? gruposAmostras : [{
      identificacao: "Grupo A",
      tipo_matriz: demanda.matriz_amostra,
      quantidade_amostras: quantidadeInicial,
      unidade: "amostras",
      observacao: null,
    }];
    return base.map((grupo, index) => ({ ...grupo, key: `grupo-${grupo.id ?? index + 1}` }));
  });
  const [selecionadas, setSelecionadas] = useState(() =>
    analisesSelecionadas.map((item) => {
      const fallbackIndex = gruposAmostras.findIndex((grupo) => grupo.identificacao === item.grupo_identificacao);
      const fallbackKey = grupos[fallbackIndex >= 0 ? fallbackIndex : 0]?.key ?? "grupo-1";
      return {
        grupoKey: item.grupo_amostra_id ? `grupo-${item.grupo_amostra_id}` : fallbackKey,
        codigo: item.codigo_analise,
        quantidade: item.quantidade_amostras || quantidadeInicial,
        origem: item.origem_quantidade === "manual" ? "manual" : "padrao",
        statusCusteio: item.status_custeio ?? null,
      };
    }),
  );
  const [, setGrupoAtivo] = useState(() => grupos[0]?.key ?? "grupo-1");
  const [seletorAberto, setSeletorAberto] = useState<string | null>(() => grupos[0]?.key ?? null);
  const exigeAnalises = modalidadeExigeLaboratorio(modalidade);
  const mostraDemanda = modo !== "laboratorio";
  const mostraLaboratorio = modo !== "demanda";
  const porCodigo = useMemo(() => new Map(analises.map((analise) => [analise.codigo, analise])), [analises]);
  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const base = termo
          ? analises.filter((analise) =>
          [analise.codigo, analise.nome, analise.nome_simplificado, analise.metodo, analise.matriz, analise.status, analise.descricao]
            .filter(Boolean)
            .some((valor) => String(valor).toLowerCase().includes(termo)),
        )
      : analises;
    return base.slice(0, 30);
  }, [analises, busca]);

  const toggleAnalise = (grupoKey: string, codigo: string) => {
    setSelecionadas((atuais) => {
      if (atuais.some((item) => item.codigo === codigo && item.grupoKey === grupoKey)) return atuais.filter((item) => !(item.codigo === codigo && item.grupoKey === grupoKey));
      const grupo = grupos.find((item) => item.key === grupoKey);
      return [...atuais, { grupoKey, codigo, quantidade: grupo?.quantidade_amostras ?? quantidadeInicial, origem: "padrao", statusCusteio: porCodigo.get(codigo)?.custeio_disponivel ? "disponivel" : "pendente" }];
    });
  };
  const totalAmostras = selecionadas.reduce((total, item) => total + Number(item.quantidade || 0), 0);
  const pendentesCusteio = selecionadas.filter((item) => {
    const analise = porCodigo.get(item.codigo);
    return analise ? !analise.custeio_disponivel : item.statusCusteio === "pendente";
  }).length;
  const previsoesOperacionais = selecionadas.map((item) => {
    const analise = porCodigo.get(item.codigo);
    const quantidade = Math.max(1, Number(item.quantidade || 1));
    const lotePadrao = Math.max(1, Number(analise?.lote_padrao ?? quantidade));
    const lotes = Math.max(1, Math.ceil(quantidade / lotePadrao));
    const capacidadeDia = Math.max(0, Number(analise?.capacidade_dia ?? 0));
    return {
      key: `${item.grupoKey}-${item.codigo}`,
      grupoKey: item.grupoKey,
      codigo: item.codigo,
      quantidade,
      lotePadrao,
      lotes,
      prazoDias: capacidadeDia > 0 ? Math.max(1, Math.ceil(quantidade / capacidadeDia)) : null,
      reagentes: (analise?.reagentes ?? []).map((reagente) => ({
        ...reagente,
        consumo: reagente.quantidade_por_amostra * (reagente.modo_cobranca === "por_execucao" ? lotes : quantidade),
        custo: Number(reagente.custo_unitario ?? 0) * reagente.quantidade_por_amostra * (reagente.modo_cobranca === "por_execucao" ? lotes : quantidade),
      })),
    };
  });
  const custoDiretoLaboratorio = previsoesOperacionais.reduce(
    (total, previsao) => total + previsao.reagentes.reduce((subtotal, reagente) => subtotal + Number(reagente.custo || 0), 0),
    0,
  );
  const prazoMaximoLaboratorio = Math.max(0, ...previsoesOperacionais.map((previsao) => Number(previsao.prazoDias ?? 0)));
  const pendenciasInsumos = analises
    .flatMap((analise) => analise.reagentes.map((reagente) => ({ codigo: analise.codigo, ...reagente })))
    .filter((reagente) => reagente.status_vinculo_insumo === "insumo_sem_cadastro_correspondente");

  return (
    <form action={formAction} className="mt-3 space-y-4">
      {demanda.id > 0 ? <input type="hidden" name="demanda_id" value={demanda.id} /> : null}
      <input type="hidden" name="escopo_salvamento" value={modo} />
      {!mostraDemanda && (
        <CamposDemandaLeitura
          demanda={demanda}
          quantidadeAmostras={grupos.reduce((total, grupo) => total + Number(grupo.quantidade_amostras || 0), 0) || quantidadeInicial}
          matrizAmostra={grupos.map((grupo) => grupo.tipo_matriz).filter(Boolean).join("; ") || (demanda.matriz_amostra ?? "")}
        />
      )}
      <div className="flex flex-wrap gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px] text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-300">
        <Legenda texto="Editável" classe="border-brand-300 bg-white" />
        <Legenda texto="Herdado" classe="border-zinc-300 bg-zinc-100" />
        <Legenda texto="Calculado" classe="border-dashed border-zinc-300 bg-zinc-100" />
        <Legenda texto="Operacional" classe="border-amber-300 bg-amber-50" />
        <Legenda texto="Bloqueado após emissão" classe="border-zinc-400 bg-zinc-200" />
      </div>
      {state.message && (
        <div
          className={`rounded-md px-3 py-2 text-sm ${
            state.ok
              ? "bg-brand-50 text-brand-900 dark:bg-brand-950/40 dark:text-brand-200"
              : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
          }`}
          aria-live="polite"
        >
          {state.message}
          {state.savedAt ? <span className="ml-2 text-xs opacity-75">Último salvamento: {new Date(state.savedAt).toLocaleString("pt-BR")}</span> : null}
        </div>
      )}
      {mostraDemanda && (
      <section className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
        <h3 className="text-sm font-semibold">Identificação do orçamento</h3>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className={lbl}>Título <Obrigatorio /></label>
            <input name="titulo" defaultValue={demanda.titulo ?? ""} className={`${inp} mt-1 w-full`} />
          </div>
          <div className="sm:col-span-2">
            <label className={lbl}>Modalidade <Obrigatorio /></label>
            <select name="modalidade" value={modalidade} onChange={(event) => setModalidade(event.target.value)} className={`${inp} mt-1 w-full`}>
              <option value="analises">Análises laboratoriais</option>
              <option value="projeto">Projeto sem análises</option>
              <option value="projeto_com_analises">Projeto com análises</option>
            </select>
          </div>
          <div>
            <label className={lbl}>Número do orçamento <Selo texto="Calculado" /></label>
            <div className="mt-1 rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950">
              {demanda.id > 0 ? `#${demanda.id}` : "Gerado ao salvar"}
            </div>
          </div>
          <div>
            <label className={lbl}>Status</label>
            <select name="status" defaultValue={demanda.status ?? "nova"} className={`${inp} mt-1 w-full`}>
              <option value="nova">Nova</option>
              <option value="em_analise">Em análise</option>
              <option value="orcada">Orçada</option>
              <option value="enviada">Enviada</option>
              <option value="aprovada">Aprovada</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>
          <div>
            <label className={lbl}>Prioridade</label>
            <select name="prioridade" defaultValue={demanda.prioridade ?? "normal"} className={`${inp} mt-1 w-full`}>
              <option value="baixa">Baixa</option>
              <option value="normal">Normal</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>
          <div>
            <label className={lbl}>Responsável interno</label>
            <input name="responsavel_interno" defaultValue={demanda.responsavel_interno ?? ""} className={`${inp} mt-1 w-full`} />
          </div>
          <div>
            <label className={lbl}>Data da solicitação</label>
            <input name="data_solicitacao" type="date" defaultValue={demanda.data_solicitacao ?? ""} className={`${inp} mt-1 w-full`} />
          </div>
          <div>
            <label className={lbl}>Prazo esperado</label>
            <input name="prazo_esperado" type="date" defaultValue={demanda.prazo_esperado ?? ""} className={`${inp} mt-1 w-full`} />
          </div>
          <div className="sm:col-span-2">
            <label className={lbl}>Origem</label>
            <input name="origem" defaultValue={demanda.origem ?? ""} className={`${inp} mt-1 w-full`} />
          </div>
          <input name="prazo_tecnico_dias" type="hidden" value={demanda.prazo_tecnico_dias ?? ""} />
          <input name="quantidade_amostras_estimada" type="hidden" value={grupos.reduce((total, grupo) => total + Number(grupo.quantidade_amostras || 0), 0) || quantidadeInicial} />
          <input name="matriz_amostra" type="hidden" value={grupos.map((grupo) => grupo.tipo_matriz).filter(Boolean).join("; ") || (demanda.matriz_amostra ?? "")} />
        </div>
      </section>
      )}

      {mostraDemanda && (
      <section className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
        <h3 className="text-sm font-semibold">Cliente</h3>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className={lbl}>Cliente <Obrigatorio /></label>
            <select name="cliente_id" defaultValue={demanda.cliente_id ?? ""} className={`${inp} mt-1 w-full`}>
              <option value="">Cliente avulso</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={lbl}>Projeto <Selo texto="Quando aplicável" /></label>
            <select name="projeto_id" defaultValue={demanda.projeto_id ?? ""} className={`${inp} mt-1 w-full`}>
              <option value="">Sem projeto vinculado</option>
              {projetos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={lbl}>Cliente avulso <Selo texto="Editável" /></label>
            <input name="cliente_nome" defaultValue={demanda.cliente_nome ?? ""} className={`${inp} mt-1 w-full`} />
          </div>
          <div>
            <label className={lbl}>CNPJ/CPF</label>
            <input name="cliente_cnpj" defaultValue={demanda.cliente_cnpj ?? ""} className={`${inp} mt-1 w-full`} />
          </div>
          <div>
            <label className={lbl}>Instituição</label>
            <input name="instituicao" defaultValue={demanda.instituicao ?? ""} className={`${inp} mt-1 w-full`} />
          </div>
          <div className="sm:col-span-2">
            <label className={lbl}>Contato <Selo texto="Herdado do cliente quando selecionado" /></label>
            <input name="cliente_contato" defaultValue={demanda.cliente_contato ?? ""} className={`${inheritedInp} mt-1 w-full`} />
          </div>
        </div>
      </section>
      )}

      {mostraDemanda && (
      <section className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
        <h3 className="text-sm font-semibold">Escopo inicial</h3>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={lbl}>Descrição do orçamento <Obrigatorio /></label>
            <textarea id="descricao" name="descricao" rows={3} defaultValue={demanda.descricao ?? ""} className={`${inp} mt-1 w-full ${state.errors?.descricao ? "border-red-400 focus:border-red-600 focus:ring-red-200" : ""}`} />
          </div>
          <div>
            <label className={lbl}>Observações gerais</label>
            <textarea name="observacoes" rows={3} defaultValue={demanda.observacoes ?? ""} className={`${inp} mt-1 w-full`} />
          </div>
        </div>
      </section>
      )}

      {mostraLaboratorio && exigeAnalises && (
      <section className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Amostras a processar</h3>
          <button type="button" onClick={() => {
            const proximo = grupos.length + 1;
            const key = `grupo-novo-${Date.now()}`;
            setGrupos((atuais) => [...atuais, { key, identificacao: `Grupo ${String.fromCharCode(64 + proximo)}`, tipo_matriz: "", quantidade_amostras: 1, unidade: "amostras", observacao: null }]);
            setGrupoAtivo(key);
            setSeletorAberto(key);
          }} className="rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">Adicionar tipo de amostra</button>
        </div>
        <div className="mt-3 grid gap-3">
          {grupos.map((grupo) => {
            const selecionadasDoGrupo = selecionadas.filter((item) => item.grupoKey === grupo.key);
            return (
            <div key={grupo.key} id={`grupo-card-${grupo.key}`} className="grid gap-2 rounded-md bg-zinc-50 p-3 dark:bg-zinc-950/50 sm:grid-cols-5">
              <input type="hidden" name="grupo_key" value={grupo.key} />
              <div><label className={lbl}>Grupo</label><input name="grupo_identificacao" value={grupo.identificacao} onChange={(event) => setGrupos((atuais) => atuais.map((item) => item.key === grupo.key ? { ...item, identificacao: event.target.value } : item))} className={`${inp} mt-1 w-full`} /></div>
              <div className="sm:col-span-2"><label className={lbl}>Tipo/matriz</label><input name="grupo_tipo_matriz" value={grupo.tipo_matriz ?? ""} onChange={(event) => setGrupos((atuais) => atuais.map((item) => item.key === grupo.key ? { ...item, tipo_matriz: event.target.value } : item))} className={`${inp} mt-1 w-full`} /></div>
              <div><label className={lbl}>Quantidade</label><input name="grupo_quantidade" type="number" min="1" step="1" value={grupo.quantidade_amostras} onChange={(event) => setGrupos((atuais) => atuais.map((item) => item.key === grupo.key ? { ...item, quantidade_amostras: Number(event.target.value) || 1 } : item))} className={`${operationalInp} mt-1 w-full`} /></div>
              <div><label className={lbl}>Unidade</label><input name="grupo_unidade" value={grupo.unidade} onChange={(event) => setGrupos((atuais) => atuais.map((item) => item.key === grupo.key ? { ...item, unidade: event.target.value } : item))} className={`${inp} mt-1 w-full`} /></div>
              <div className="sm:col-span-5"><label className={lbl}>Observação</label><input name="grupo_observacao" value={grupo.observacao ?? ""} onChange={(event) => setGrupos((atuais) => atuais.map((item) => item.key === grupo.key ? { ...item, observacao: event.target.value } : item))} className={`${inp} mt-1 w-full`} /></div>
              <div className="sm:col-span-5 rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-semibold uppercase text-zinc-500">Análises deste grupo</h4>
                    <p className="mt-1 text-xs text-zinc-500">{selecionadasDoGrupo.length} análise(s) selecionada(s) para {grupo.identificacao || "grupo"}.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setGrupoAtivo(grupo.key);
                      setSeletorAberto((atual) => atual === grupo.key ? null : grupo.key);
                    }}
                    className="rounded-md bg-brand-600 px-3 py-2 text-xs font-medium text-white hover:bg-brand-500"
                  >
                    Selecionar análises
                  </button>
                </div>
                {selecionadasDoGrupo.length > 0 ? (
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
                      <thead className="text-left text-xs text-zinc-500">
                        <tr><th className="py-2">Código da análise</th><th>Nome da análise</th><th>Quantidade de amostras para esta análise</th><th className="w-10 text-right"></th></tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {selecionadasDoGrupo.map((item) => {
                          const analise = porCodigo.get(item.codigo);
                          return (
                            <tr key={`${item.grupoKey}-${item.codigo}`}>
                              <td className="py-2 pr-3 font-mono text-xs text-zinc-600 dark:text-zinc-300">
                                <input type="hidden" name="analise_grupo_key" value={item.grupoKey} />
                                <input type="hidden" name="analise_codigo" value={item.codigo} />
                                <input type="hidden" name="analise_origem_quantidade" value={item.origem} />
                                {item.codigo}
                              </td>
                              <td className="pr-3">{analise?.nome_simplificado ?? analise?.nome ?? "Sem nome"}</td>
                              <td className="pr-3">
                                <input
                                  name="analise_quantidade"
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={item.quantidade}
                                  onChange={(event) => setSelecionadas((atuais) => atuais.map((atual) => atual.codigo === item.codigo && atual.grupoKey === item.grupoKey ? { ...atual, quantidade: Number(event.target.value) || 1, origem: "manual" } : atual))}
                                  className={`${operationalInp} w-24`}
                                />
                              </td>
                              <td className="text-right">
                                <button type="button" onClick={() => toggleAnalise(item.grupoKey, item.codigo)} className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300" title="Remover análise">
                                  <Trash2 className="h-4 w-4 inline" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mt-3 rounded-md border border-dashed border-zinc-300 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-700">Nenhuma análise selecionada para este grupo.</p>
                )}
                {seletorAberto === grupo.key && (
                  <div className="mt-3 rounded-md border border-brand-200 bg-brand-50/40 p-3 dark:border-brand-900 dark:bg-brand-950/20">
                    <input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar por código, nome ou método" className={`${inp} w-full`} />
                    <div className="mt-3 max-h-[56rem] overflow-y-auto rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
                      {filtradas.length === 0 ? (
                        <p className="px-3 py-4 text-xs text-zinc-500">
                          {analises.length === 0 ? "Não existem análises ativas cadastradas ou você não possui permissão para visualizar este catálogo." : "Nenhuma análise corresponde à busca ou à matriz informada."}
                        </p>
                      ) : filtradas.map((analise) => {
                        const marcada = selecionadas.some((item) => item.codigo === analise.codigo && item.grupoKey === grupo.key);
                        const pendenteInsumo = analise.reagentes.some((reagente) => reagente.status_vinculo_insumo === "insumo_sem_cadastro_correspondente");
                        return (
                          <label key={`${grupo.key}-${analise.codigo}`} className="flex cursor-pointer gap-3 border-b border-zinc-100 px-3 py-2 text-sm last:border-0 hover:bg-brand-50 focus-within:bg-brand-50 dark:border-zinc-800 dark:hover:bg-brand-950/20">
                            <input type="checkbox" checked={marcada} onChange={() => toggleAnalise(grupo.key, analise.codigo)} className="mt-1 h-4 w-4 rounded border-zinc-300 focus:ring-2 focus:ring-brand-500" />
                            <span>
                              <span className="font-medium">{analise.codigo} · {analise.nome_simplificado ?? analise.nome ?? "Sem nome"}</span>
                              <span className="block text-xs text-zinc-500">
                                Método: {analise.metodo ?? "não informado"} · Lote: {analise.lote_padrao ?? "a calcular"} amostra(s) · Custeio: {analise.custeio_disponivel ? "disponível" : "pendente"}{pendenteInsumo ? " · insumo sem cadastro" : ""}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
            );
          })}
        </div>
      </section>
      )}

      {mostraLaboratorio && exigeAnalises && (
        <section id="analises-solicitadas" className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Análises por grupo de amostra</h3>
              <p className="mt-1 text-xs text-zinc-500">Resumo consolidado das análises selecionadas nos grupos acima. {analises.length} análise(s) oficial(is) disponível(is).</p>
            </div>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-4">
            <ResumoLaboratorio titulo="Análises" valor={`${selecionadas.length}`} detalhe={`${totalAmostras} amostra(s)`} />
            <ResumoLaboratorio titulo="Custo direto estimado" valor={formatCurrency(custoDiretoLaboratorio)} detalhe="insumos/reagentes" />
            <ResumoLaboratorio titulo="Prazo técnico" valor={prazoMaximoLaboratorio > 0 ? `${prazoMaximoLaboratorio} dia(s)` : "a calcular"} detalhe="maior prazo previsto" />
            <ResumoLaboratorio titulo="Pendências" valor={`${pendentesCusteio}`} detalhe={pendentesCusteio > 0 ? "custeio pendente" : "custeio disponível"} />
          </div>
          <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            Compatibilidade por matriz ainda não possui relação oficial no banco. A matriz da demanda é informativa; confirme tecnicamente antes de emitir.
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
              <thead className="text-left text-xs text-zinc-500">
                <tr><th className="py-2">Grupo</th><th>Tipo/matriz da amostra</th><th>Código da análise</th><th>Nome da análise</th><th>Quantidade de amostras para esta análise</th><th>Prazo técnico calculated</th><th>Lotes previstos</th><th>Status do custeio</th><th>Status dos insumos</th><th className="w-16 text-right"></th></tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {selecionadas.map((item) => {
                  const analise = porCodigo.get(item.codigo);
                  const grupo = grupos.find((grupo) => grupo.key === item.grupoKey);
                  const previsao = previsoesOperacionais.find((prev) => prev.key === `${item.grupoKey}-${item.codigo}`);
                  const statusInsumos = analise?.reagentes.some((reagente) => reagente.status_vinculo_insumo === "insumo_sem_cadastro_correspondente") ? "Pendente" : "Mapeados";
                  return (
                    <tr key={`${item.grupoKey}-${item.codigo}`}>
                      <td className="py-2 pr-3">{grupo?.identificacao ?? "Grupo"}</td>
                      <td className="pr-3 text-zinc-500">{grupo?.tipo_matriz || "—"}</td>
                      <td className="pr-3 font-mono text-xs text-zinc-500">{item.codigo}</td>
                      <td className="pr-3">{analise?.nome_simplificado ?? analise?.nome ?? "Sem nome"}</td>
                      <td className="pr-3 font-semibold tabular-nums">{item.quantidade}</td>
                      <td className="pr-3 text-zinc-500">{previsao?.prazoDias ? `${previsao.prazoDias} dia(s)` : "a calcular"}</td>
                      <td className="pr-3 text-zinc-500">{previsao ? `${previsao.lotes} lote(s) de ${previsao.lotePadrao}` : "a calcular"}</td>
                      <td className={analise?.custeio_disponivel ? "pr-3 text-brand-700 dark:text-brand-300" : "pr-3 text-amber-700 dark:text-amber-300"}>
                        {analise?.custeio_disponivel ? "Disponível" : "Pendente"}
                      </td>
                      <td className={statusInsumos === "Mapeados" ? "pr-3 text-brand-700 dark:text-brand-300" : "pr-3 text-amber-700 dark:text-amber-300"}>{statusInsumos}</td>
                      <td className="text-right space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setSeletorAberto(item.grupoKey);
                            document.getElementById(`grupo-card-${item.grupoKey}`)?.scrollIntoView({ behavior: "smooth" });
                          }}
                          className="text-zinc-600 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                          title="Editar análises do grupo"
                        >
                          <Pencil className="h-4 w-4 inline" />
                        </button>
                        <button type="button" onClick={() => toggleAnalise(item.grupoKey, item.codigo)} className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300" title="Remover análise">
                          <Trash2 className="h-4 w-4 inline" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {selecionadas.length === 0 && (
                  <tr><td colSpan={10} className="py-4 text-xs text-zinc-400">Nenhuma análise selecionada.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {previsoesOperacionais.length > 0 && (
            <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
              <h4 className="text-xs font-semibold uppercase text-zinc-500">Previsão operacional calculada</h4>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {previsoesOperacionais.map((previsao) => (
                  <div key={previsao.key} className="rounded-md border border-zinc-200 bg-white p-2 text-xs dark:border-zinc-800 dark:bg-zinc-950">
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="font-semibold">{grupos.find((grupo) => grupo.key === previsao.grupoKey)?.identificacao ?? "Grupo"} · {previsao.codigo}</span>
                      <span className="text-zinc-500">{previsao.quantidade} amostra(s) · {previsao.lotes} lote(s) de {previsao.lotePadrao}</span>
                    </div>
                    <ul className="mt-2 space-y-1 text-zinc-600 dark:text-zinc-300">
                      {previsao.reagentes.length > 0 ? previsao.reagentes.slice(0, 4).map((reagente, index) => (
                        <li key={`${previsao.codigo}-${reagente.especificacao}-${index}`}>
                          {reagente.especificacao}: {formatNumber(reagente.consumo)} {reagente.unidade} · {formatCurrency(reagente.custo)} <span className="text-zinc-400">({reagente.modo_cobranca === "por_execucao" ? "por execução" : "por amostra"})</span>
                        </li>
                      )) : <li>Sem reagentes configurados na receita técnica oficial.</li>}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {mostraLaboratorio && exigeAnalises && (
      <section className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
        <h3 className="text-sm font-semibold">Pendências</h3>
        {pendenciasInsumos.length > 0 ? (
          <ul className="mt-2 space-y-1 text-xs text-amber-800 dark:text-amber-200">
            {[...new Set(pendenciasInsumos.map((item) => `${item.codigo}: ${item.especificacao}`))].map((item) => (
              <li key={item}><Selo texto="Pendente" /> {item}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-zinc-500">Sem pendências de cadastro de insumo para as análises carregadas.</p>
        )}
      </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-wait disabled:bg-zinc-400 dark:bg-white dark:text-zinc-900">
          {pending ? "Salvando..." : demanda.id > 0 ? (modo === "laboratorio" ? "Salvar análises laboratoriais" : "Salvar demanda") : "Criar demanda"}
        </button>
        {state.errors?.descricao ? <a href="#descricao" className="text-sm font-medium text-red-600">Corrigir descrição</a> : null}
      </div>
    </form>
  );
}

function CamposDemandaLeitura({
  demanda,
  quantidadeAmostras,
  matrizAmostra,
}: {
  demanda: Demanda;
  quantidadeAmostras: number;
  matrizAmostra: string;
}) {
  return (
    <section className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Dados completos da demanda</h3>
          <p className="mt-1 text-xs text-zinc-500">
            Campos herdados do formulário mestre. Edite estes dados na etapa Demanda; aqui eles ficam visíveis para conferência.
          </p>
        </div>
        <Selo texto="Leitura" />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CampoLeitura name="titulo" label="Título" value={demanda.titulo} className="sm:col-span-2" />
        <CampoLeitura name="cliente_id" label="Cliente cadastrado (ID)" value={demanda.cliente_id} />
        <CampoLeitura name="projeto_id" label="Projeto vinculado (ID)" value={demanda.projeto_id} />
        <CampoLeitura name="cliente_nome" label="Cliente" value={demanda.cliente_nome} />
        <CampoLeitura name="cliente_cnpj" label="CNPJ/CPF" value={demanda.cliente_cnpj} />
        <CampoLeitura name="cliente_contato" label="Contato" value={demanda.cliente_contato} />
        <CampoLeitura name="instituicao" label="Instituição" value={demanda.instituicao} />
        <CampoLeitura name="responsavel_interno" label="Responsável interno" value={demanda.responsavel_interno} />
        <CampoLeitura name="origem" label="Origem" value={demanda.origem} />
        <CampoLeitura name="data_solicitacao" label="Data da solicitação" value={demanda.data_solicitacao} />
        <CampoLeitura name="prazo_esperado" label="Prazo esperado" value={demanda.prazo_esperado} />
        <CampoLeitura name="modalidade" label="Modalidade" value={demanda.modalidade ?? "analises"} />
        <CampoLeitura name="status" label="Status" value={demanda.status ?? "nova"} />
        <CampoLeitura name="prioridade" label="Prioridade" value={demanda.prioridade ?? "normal"} />
        <CampoLeitura name="matriz_amostra" label="Matriz/amostra" value={matrizAmostra} />
        <CampoLeitura name="quantidade_amostras_estimada" label="Quantidade estimada" value={quantidadeAmostras} />
        <CampoLeitura name="prazo_tecnico_dias" label="Prazo técnico (dias)" value={demanda.prazo_tecnico_dias} />
        <CampoLeitura name="descricao" label="Descrição do orçamento" value={demanda.descricao} multiline className="sm:col-span-2" />
        <CampoLeitura name="escopo_preliminar" label="Escopo preliminar" value={demanda.escopo_preliminar} multiline className="sm:col-span-2" />
        <CampoLeitura name="observacoes" label="Observações gerais" value={demanda.observacoes} multiline className="sm:col-span-2" />
      </div>
    </section>
  );
}

function CampoLeitura({
  name,
  label,
  value,
  multiline = false,
  className = "",
}: {
  name: string;
  label: string;
  value: string | number | null | undefined;
  multiline?: boolean;
  className?: string;
}) {
  const valor = value == null ? "" : String(value);
  return (
    <div className={className}>
      <label className={lbl}>{label}</label>
      {multiline ? (
        <textarea name={name} value={valor} readOnly rows={3} className={`${inheritedInp} mt-1 w-full`} />
      ) : (
        <input name={name} value={valor} readOnly className={`${inheritedInp} mt-1 w-full`} />
      )}
    </div>
  );
}

function Obrigatorio() {
  return <span className="text-[10px] font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">Obrigatório</span>;
}

function Selo({ texto }: { texto: string }) {
  return <span className="rounded border border-zinc-300 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:border-zinc-700 dark:text-zinc-300">{texto}</span>;
}

function formatNumber(valor: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(valor);
}

function formatCurrency(valor: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

function Legenda({ texto, classe }: { texto: string; classe: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`h-3 w-3 rounded border ${classe}`} />
      {texto}
    </span>
  );
}

function ResumoLaboratorio({ titulo, valor, detalhe }: { titulo: string; valor: string; detalhe: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/50">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{titulo}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{valor}</p>
      <p className="mt-0.5 text-xs text-zinc-500">{detalhe}</p>
    </div>
  );
}
