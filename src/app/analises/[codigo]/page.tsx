import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  calcularCurvaCustoAmostras,
  equipCustoDia,
  gargalo,
  horasBancadaPorAmostra,
  type EquipAlloc,
  type Etapa,
  type InsumoLinha,
} from "@/lib/costing/engine";
import { calcularTodas } from "@/lib/costing/loader";
import { ConfirmActionButton } from "@/components/common/ConfirmActionButton";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { CustoAnaliseChart } from "@/components/analises/CustoAnaliseChart";
import {
  EquipamentosEditTable,
  type EquipamentoEditRowData,
  type EquipamentoOption,
} from "@/components/analises/EquipamentosEditTable";
import { EtapasEditTable, type EtapaEditRowData } from "@/components/analises/EtapasEditTable";
import {
  MateriaisEditTable,
  type InsumoOption,
  type MaterialEditRowData,
} from "@/components/analises/MateriaisEditTable";
import { atualizarCatalogoAnalise, inativarAnalise } from "@/lib/actions/receita";
import { formatCurrency, formatNumber } from "@/lib/formatters";

export const dynamic = "force-dynamic";

type EquipamentoVinculado = {
  id: number;
  equipamento_id: number;
  peso_alocacao: number | null;
  equipamentos: {
    nome: string;
    quantidade: number | null;
    custo_unitario: number | null;
    vida_util_anos: number | null;
    percentual_manutencao_anual: number | null;
    manutencao_anual_fixa: number | null;
    possui: boolean | null;
  } | null;
};

type MaterialVinculado = {
  id: number;
  nome_etapa: string;
  nome_atividade: string;
  especificacao_insumo: string | null;
  grupo_escolha: string | null;
  quantidade_por_amostra: number | null;
  unidade: string | null;
  modo_cobranca: string | null;
  base_calculo: string | null;
  preferencial: boolean | null;
  etapa_id: number | null;
  insumo_id: number | null;
  insumos: {
    especificacao: string | null;
    nome_item: string | null;
    unidade: string | null;
    custo_unitario: number | null;
    estoque_seguranca: number | null;
    ponto_reposicao: number | null;
    lead_time_dias: number | null;
  } | null;
};

type SaldoEstoque = {
  insumo_id: number;
  disponivel: number | null;
  em_maos?: number | null;
  reservado?: number | null;
  unidade: string | null;
};

type InsumoOpcao = {
  id: number;
  especificacao: string | null;
  nome_item: string | null;
  unidade: string | null;
};

type EquipamentoOpcao = {
  id: number;
  nome: string;
};

const panel = "rounded-lg border border-border bg-card p-3 shadow-sm";
const th = "whitespace-nowrap border border-foreground/60 bg-muted/45 px-2.5 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-foreground";
const td = "border border-foreground/60 px-2.5 py-1.5 align-middle text-xs";
const labelClass = "text-[9px] font-medium uppercase tracking-wide text-blue-700 dark:text-blue-300";
const inputClass = "mt-0.5 h-7 w-full rounded-md border border-blue-300 bg-blue-50/70 px-2 py-0.5 text-[11px] font-medium text-blue-950 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-100";
const primaryButtonClass = "rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm hover:bg-primary/90";
const editablePanelClass = "rounded-md border border-blue-200 bg-blue-50/35 p-2 dark:border-blue-900 dark:bg-blue-950/15";
const navItems = [
  ["Resumo", "resumo"],
  ["Ficha tecnica", "ficha-tecnica"],
  ["Insumos", "materiais-insumos"],
  ["Equipamentos", "equipamentos"],
  ["Custo", "custeio"],
  ["Estoque", "estoque"],
  ["Historico", "historico-versoes"],
] as const;
type ViewId = (typeof navItems)[number][1];

export default async function AnaliseDetalhe({
  params,
  searchParams,
}: {
  params: Promise<{ codigo: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { codigo: codigoRaw } = await params;
  const { view } = await searchParams;
  const codigo = decodeURIComponent(codigoRaw);
  const activeView = isViewId(view) ? view : "resumo";
  const supabase = await createClient();

  const { data: analise } = await supabase
    .from("analises")
    .select("codigo, nome, nome_simplificado, descricao, status, ativo, ofertavel")
    .eq("codigo", codigo)
    .single();
  if (!analise) notFound();

  const [
    { data: etapas },
    { data: equipamentos },
    { data: materiais },
    { data: insumosCatalogo },
    { data: equipamentosCatalogo },
  ] = await Promise.all([
    supabase
      .from("etapas")
      .select("*")
      .eq("codigo_analise", codigo)
      .order("ordem", { nullsFirst: false }),
    supabase
      .from("equipamento_analise")
      .select(
        "id, equipamento_id, peso_alocacao, equipamentos(nome, quantidade, custo_unitario, vida_util_anos, percentual_manutencao_anual, manutencao_anual_fixa, possui)",
      )
      .eq("codigo_analise", codigo)
      .gt("peso_alocacao", 0),
    supabase
      .from("insumo_analise")
      .select(
        "id, nome_etapa, nome_atividade, especificacao_insumo, grupo_escolha, quantidade_por_amostra, unidade, modo_cobranca, base_calculo, preferencial, etapa_id, insumo_id, insumos(especificacao, nome_item, unidade, custo_unitario, estoque_seguranca, ponto_reposicao, lead_time_dias)",
      )
      .eq("codigo_analise", codigo)
      .order("nome_etapa"),
    supabase
      .from("insumos")
      .select("id, especificacao, nome_item, unidade")
      .order("especificacao"),
    supabase
      .from("equipamentos")
      .select("id, nome")
      .order("nome"),
  ]);

  const etapasT = (etapas ?? []) as unknown as Etapa[];
  const etapasLaboratorio = etapasT.filter((etapa) => !isEtapaPosAnalise(etapa));
  const etapasPosAnalise = etapasT.filter((etapa) => isEtapaPosAnalise(etapa));
  const materiaisT = (materiais ?? []) as unknown as MaterialVinculado[];
  const equipamentosT = (equipamentos ?? []) as unknown as EquipamentoVinculado[];
  const insumosOpcoes = (insumosCatalogo ?? []) as InsumoOpcao[];
  const equipamentosOpcoes = (equipamentosCatalogo ?? []) as EquipamentoOpcao[];
  const idsInsumos = [...new Set(materiaisT.map((m) => m.insumo_id).filter((id): id is number => id != null))];

  const saldoResult =
    idsInsumos.length > 0
      ? await supabase
          .from("v_estoque_saldo")
          .select("insumo_id, disponivel, em_maos, reservado, unidade")
          .in("insumo_id", idsInsumos)
      : { data: [] as SaldoEstoque[] };
  const saldoPorInsumo = new Map(
    ((saldoResult.data ?? []) as SaldoEstoque[]).map((saldo) => [saldo.insumo_id, saldo]),
  );

  let custoData = null as Awaited<ReturnType<typeof calcularTodas>> | null;
  let custo = null as Awaited<ReturnType<typeof calcularTodas>>["breakdowns"][number] | null;
  let erroCusteio = false;
  try {
    custoData = await calcularTodas();
    custo = custoData.breakdowns.find((b) => b.codigo === codigo) ?? null;
  } catch {
    erroCusteio = true;
  }

  const g = gargalo(etapasLaboratorio);
  const tempoBancada = horasBancadaPorAmostra(etapasLaboratorio);
  const prazoLaboratorio = Math.max(0, ...etapasLaboratorio.map((e) => Number((e as unknown as { dia_fim_max?: number | null }).dia_fim_max ?? 0)));
  const prazoPosAnalise = Math.max(0, ...etapasPosAnalise.map((e) => Number((e as unknown as { dia_fim_max?: number | null }).dia_fim_max ?? 0)));
  const prazoTotal = Math.max(prazoLaboratorio, prazoPosAnalise);
  const posAnaliseSemParametros = etapasPosAnalise.some((e) => !e.tempo_maquina_h && !e.tempo_bancada_h);
  const curvaCusto =
    custoData && !erroCusteio
      ? calcularCurvaCustoAmostras({
          codigo,
          etapas: etapasT,
          equip: equipamentosT.map((linha) => toEquipAlloc(linha, custoData.params.dias_uteis_ano)),
          insumos: materiaisT.map(toInsumoLinha),
          valorHoraPessoal: custoData.valorHoraPessoal,
          custoHoraOverhead: custoData.custoHoraOverhead,
          params: custoData.params,
          maxAmostras: maxAmostrasCurva(g.amostrasDia),
        })
      : [];
  const avisos = [
    etapasT.length === 0 ? "Sem etapas cadastradas." : null,
    materiaisT.length === 0 ? "Sem materiais/insumos vinculados." : null,
    equipamentosT.length === 0 ? "Sem equipamentos vinculados." : null,
    materiaisT.some((m) => Number(m.quantidade_por_amostra ?? 0) > 0 && !m.insumo_id)
      ? "Ha materiais com consumo tecnico sem vinculo com item de estoque."
      : null,
    analise.ativo && !analise.ofertavel ? "Analise ativa, mas fora da oferta comercial." : null,
    analise.ativo && /experimental|experimento|revis|avali|pend|todo/i.test(analise.status ?? "")
      ? "Analise ativa com status textual de revisao."
      : null,
    posAnaliseSemParametros
      ? "Bioinformatica classificada como pos-analise, mas ainda sem parametros de custo/prazo cadastrados."
      : null,
    !custo || custo.custoTotal <= 0 ? "Custeio calculado ausente ou zerado." : null,
  ].filter(Boolean) as string[];

  return (
    <div className="min-h-dvh bg-transparent font-sans text-foreground">
      <main className="app-page-container">
        <Breadcrumbs items={[{ label: "Analises", href: "/analises" }, { label: codigo }]} />

        <section className="mt-3 rounded-lg border border-border bg-card shadow-sm">
          <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight">{analise.codigo}</h1>
                <Badge>{analise.ativo ? "Ativa" : "Inativa"}</Badge>
                <Badge muted>{analise.ofertavel ? "Ofertavel" : "Nao ofertavel"}</Badge>
                {analise.status && <Badge muted>{analise.status}</Badge>}
              </div>
              <p className="mt-1 text-lg font-medium">{analise.nome_simplificado || analise.nome || "Sem nome"}</p>
              {analise.descricao && <p className="mt-2 max-w-4xl text-sm leading-5 text-muted-foreground">{analise.descricao}</p>}
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                <MiniStat label="Etapas" value={String(etapasT.length)} />
                <MiniStat label="Insumos" value={String(materiaisT.length)} />
                <MiniStat label="Equip." value={String(equipamentosT.length)} />
                <MiniStat label="Capacidade" value={g.amostrasDia > 0 ? `${formatNumber(g.amostrasDia)}/dia` : "-"} />
                <MiniStat label="Preco" value={custo ? formatCurrency(custo.preco) : "-"} />
              </div>
            </div>

            <form action={atualizarCatalogoAnalise} className={`grid content-start gap-2 ${editablePanelClass}`}>
              <input type="hidden" name="codigo" value={codigo} />
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className={labelClass}>Nome curto</span>
                  <input name="nome_simplificado" defaultValue={analise.nome_simplificado ?? ""} className={inputClass} />
                </label>
                <label className="block">
                  <span className={labelClass}>Status</span>
                  <input name="status" defaultValue={analise.status ?? ""} className={inputClass} />
                </label>
              </div>
              <label className="block">
                <span className={labelClass}>Descricao</span>
                <textarea name="descricao" defaultValue={analise.descricao ?? ""} className={`${inputClass} h-16 min-h-16 resize-y`} />
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button className={primaryButtonClass}>Salvar cadastro</button>
                {analise.ativo ? (
                  <ConfirmActionButton
                    action={inativarAnalise}
                    fields={{ codigo }}
                    trigger="Inativar"
                    titulo="Inativar analise"
                    mensagem={`Inativar "${analise.codigo}"? A receita e o historico permanecem preservados.`}
                    confirmLabel="Inativar"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">Analise ja inativa.</span>
                )}
              </div>
            </form>
          </div>
        </section>

        {avisos.length > 0 && (
          <div className="mt-5 rounded-lg border border-warning-strong/30 bg-warning-soft p-4 text-sm text-warning-strong">
            <p className="font-medium">Alertas de completude</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {avisos.map((aviso) => (
                <li key={aviso}>{aviso}</li>
              ))}
            </ul>
          </div>
        )}

        <nav className="sticky top-2 z-10 mt-5 flex flex-wrap gap-1.5 rounded-lg border border-border bg-background/95 p-1.5 text-xs shadow-sm backdrop-blur">
          {navItems.map(([label, id]) => (
            <Link
              key={id}
              href={`/analises/${encodeURIComponent(codigo)}?view=${id}`}
              className={`rounded-md px-3 py-1.5 font-medium ${
                activeView === id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {activeView === "resumo" && (
          <section className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <Stat label="Execucoes/dia" value={g.execucoesDia > 0 ? formatNumber(g.execucoesDia) : "-"} compact />
            <Stat label="Amostras/exec." value={g.amostrasPorExecucao > 0 ? formatNumber(g.amostrasPorExecucao) : "-"} compact />
            <Stat label="Bancada/amostra" value={tempoBancada > 0 ? `${formatNumber(tempoBancada)} h` : "-"} compact />
            <Stat label="Prazo lab." value={prazoLaboratorio > 0 ? `${prazoLaboratorio} dias` : "-"} compact />
            <Stat label="Prazo total" value={prazoTotal > 0 ? `${prazoTotal} dias` : "-"} compact />
            <Stat label="Materiais" value={String(materiaisT.length)} compact />
            <Stat label="Equipamentos" value={String(equipamentosT.length)} compact />
            <Stat label="Custo total" value={custo ? formatCurrency(custo.custoTotal) : "-"} compact />
            <Stat label="Preco atual" value={custo ? formatCurrency(custo.preco) : "-"} compact />
          </section>
        )}

        {activeView === "ficha-tecnica" && (
        <Section title="Ficha tecnica" description="Tempos, capacidade e etapas editaveis da analise selecionada.">
          <EtapasEditTable
            codigo={codigo}
            titulo="Laboratorio"
            etapas={etapasLaboratorio.map(toEtapaEditRowData)}
            showAddForm
          />
          <EtapasEditTable
            codigo={codigo}
            titulo="Pos-analise / Bioinformatica"
            etapas={etapasPosAnalise.map(toEtapaEditRowData)}
            emptyText="Nenhuma etapa pos-analise cadastrada."
          />
        </Section>
        )}

        {activeView === "materiais-insumos" && (
        <Section title="Insumos" description="Materiais tecnicos, item de estoque, consumo por amostra e modo de cobranca.">
          <MateriaisEditTable
            codigo={codigo}
            materiais={materiaisT.map(toMaterialEditRowData)}
            insumos={insumosOpcoes.map(toInsumoOption)}
          />
        </Section>
        )}

        {activeView === "equipamentos" && (
        <Section title="Equipamentos" description="Equipamentos vinculados a receita e parametros usados no custo.">
          <EquipamentosEditTable
            codigo={codigo}
            equipamentos={equipamentosT.map(toEquipamentoEditRowData)}
            opcoes={equipamentosOpcoes.map(toEquipamentoOption)}
          />
        </Section>
        )}

        {activeView === "custeio" && (
        <Section title="Custo" description="Composicao calculada pela engine atual, sem alterar snapshots historicos.">
          {erroCusteio && <p className="text-sm text-warning-strong">Nao foi possivel carregar o custeio atual.</p>}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Reagentes" value={custo ? formatCurrency(custo.reagentes) : "-"} compact />
            <Stat label="Equipamento" value={custo ? formatCurrency(custo.equipamento) : "-"} compact />
            <Stat label="Pessoal" value={custo ? formatCurrency(custo.pessoal) : "-"} compact />
            <Stat label="Overhead" value={custo ? formatCurrency(custo.overhead) : "-"} compact />
            <Stat label="Custo analitico" value={custo ? formatCurrency(custo.custoAnalitico) : "-"} compact />
            <Stat label="Custo total" value={custo ? formatCurrency(custo.custoTotal) : "-"} compact />
            <Stat label="Fatores" value={custo ? `${formatNumber(custo.fatores * 100)}%` : "-"} compact />
            <Stat label="Preco" value={custo ? formatCurrency(custo.preco) : "-"} compact />
            <Stat label="Prazo laboratorio" value={prazoLaboratorio > 0 ? `${prazoLaboratorio} dias` : "-"} compact />
            <Stat label="Prazo pos-analise" value={prazoPosAnalise > 0 ? `${prazoPosAnalise} dias` : "-"} compact />
            <Stat label="Prazo total" value={prazoTotal > 0 ? `${prazoTotal} dias` : "-"} compact />
          </div>
          {posAnaliseSemParametros && (
            <p className="mt-3 text-sm text-warning-strong">
              Bioinformatica classificada como pos-analise, mas ainda sem parametros de custo/prazo cadastrados.
            </p>
          )}
          <CustoAnaliseChart data={curvaCusto} capacidade={curvaCusto[0]?.capacidadeOperacional ?? g.amostrasDia} />
          <p className="mt-3 text-xs text-muted-foreground">
            Valores exibidos pela engine atual, sem gravar snapshot e sem recalcular orcamentos antigos nesta etapa.
          </p>
        </Section>
        )}

        {activeView === "estoque" && (
        <Section title="Estoque" description="Sinalizacao de disponibilidade dos insumos vinculados.">
          <p className="mb-3 text-sm text-muted-foreground">
            Diagnostico apenas informativo. Esta ficha nao reserva, baixa nem abre compras automaticamente.
          </p>
          <Table>
            <thead>
              <tr>
                <th className={th}>Material</th>
                <th className={th}>Insumo</th>
                <th className={th}>Disponivel</th>
                <th className={th}>Ponto reposicao</th>
                <th className={th}>Estoque seguranca</th>
                <th className={th}>Lead time</th>
                <th className={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {materiaisT.map((material) => {
                const saldo = material.insumo_id ? saldoPorInsumo.get(material.insumo_id) : null;
                const disponivel = Number(saldo?.disponivel ?? 0);
                const ponto = Number(material.insumos?.ponto_reposicao ?? 0);
                return (
                  <tr key={material.id} className="border-t border-border/70">
                    <td className={td}>{material.especificacao_insumo ?? "-"}</td>
                    <td className={td}>{material.insumos?.especificacao ?? material.insumos?.nome_item ?? "Sem vinculo"}</td>
                    <td className={td}>{material.insumo_id ? `${fmt(disponivel)} ${saldo?.unidade ?? material.insumos?.unidade ?? ""}` : "-"}</td>
                    <td className={td}>{fmt(material.insumos?.ponto_reposicao)}</td>
                    <td className={td}>{fmt(material.insumos?.estoque_seguranca)}</td>
                    <td className={td}>{material.insumos?.lead_time_dias ? `${material.insumos.lead_time_dias} dias` : "-"}</td>
                    <td className={td}>{!material.insumo_id ? "sem vinculo" : ponto > 0 && disponivel <= ponto ? "abaixo do ponto" : "diagnostico ok"}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Section>
        )}

        {activeView === "historico-versoes" && (
        <Section title="Historico/Versoes" description="Estado atual do versionamento tecnico desta ficha.">
          <div className="rounded-lg border border-warning-strong/30 bg-warning-soft p-4 text-sm text-warning-strong">
            <p className="font-medium">Ficha tecnica viva</p>
            <p className="mt-1">
              O cadastro atual ainda nao possui versionamento de protocolo nem snapshot tecnico por orcamento. Alteracoes
              futuras na receita podem afetar novos calculos; por isso, a proxima etapa deve introduzir versoes antes de
              conectar esta ficha a orcamentos historicos.
            </p>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Proposta incremental: ficha read-only, versionamento de protocolo, snapshot no orcamento, diagnostico de
            estoque, integracao com compras e edicao administrativa controlada.
          </p>
          <Link href="/analises" className="mt-4 inline-flex text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
            Voltar para analises
          </Link>
        </Section>
        )}
      </main>
    </div>
  );
}

function fmt(value: number | null | undefined) {
  return value == null ? "-" : formatNumber(value);
}

function isEtapaPosAnalise(etapa: Etapa) {
  return (
    etapa.escopo_operacional === "pos_analise" ||
    /bioinform/i.test(`${etapa.nome_etapa ?? ""} ${etapa.nome_atividade ?? ""}`)
  );
}

function isViewId(view: string | undefined): view is ViewId {
  return navItems.some(([, id]) => id === view);
}

function toEtapaEditRowData(etapa: Etapa): EtapaEditRowData {
  const e = etapa as Etapa & {
    id: number;
    ordem?: number | null;
    tipo_limitacao?: string | null;
    atividade_opcional?: boolean | null;
  };
  return {
    id: e.id,
    ordem: e.ordem ?? null,
    nome_etapa: e.nome_etapa ?? null,
    nome_atividade: e.nome_atividade ?? null,
    execucoes_por_dia: e.execucoes_por_dia ?? null,
    amostras_por_execucao: e.amostras_por_execucao ?? null,
    tempo_maquina_h: e.tempo_maquina_h ?? null,
    tempo_bancada_h: e.tempo_bancada_h ?? null,
    tipo_limitacao: e.tipo_limitacao ?? null,
    atividade_opcional: e.atividade_opcional ?? null,
  };
}

function toMaterialEditRowData(material: MaterialVinculado): MaterialEditRowData {
  return {
    id: material.id,
    nome_etapa: material.nome_etapa,
    nome_atividade: material.nome_atividade,
    especificacao_insumo: material.especificacao_insumo,
    grupo_escolha: material.grupo_escolha,
    quantidade_por_amostra: material.quantidade_por_amostra,
    unidade: material.unidade,
    modo_cobranca: material.modo_cobranca,
    preferencial: material.preferencial,
    insumo_id: material.insumo_id,
    insumo_rotulo: material.insumos?.especificacao ?? material.insumos?.nome_item ?? "Sem vinculo",
    custo_unitario: material.insumos?.custo_unitario ?? null,
  };
}

function toInsumoLinha(material: MaterialVinculado): InsumoLinha {
  return {
    nome_etapa: material.nome_etapa,
    nome_atividade: material.nome_atividade,
    especificacao_insumo: material.especificacao_insumo,
    grupo_escolha: material.grupo_escolha,
    quantidade_por_amostra: material.quantidade_por_amostra,
    modo_cobranca: material.modo_cobranca,
    custo_unitario: material.insumos?.custo_unitario ?? null,
    insumo_id: material.insumo_id,
  };
}

function toInsumoOption(insumo: InsumoOpcao): InsumoOption {
  return {
    id: insumo.id,
    label: insumo.especificacao ?? insumo.nome_item ?? `Insumo ${insumo.id}`,
  };
}

function toEquipAlloc(linha: EquipamentoVinculado, diasUteisAno: number): EquipAlloc {
  return {
    peso: Number(linha.peso_alocacao ?? 0),
    custoDia: linha.equipamentos ? equipCustoDia(linha.equipamentos, diasUteisAno) : 0,
  };
}

function maxAmostrasCurva(amostrasDia: number) {
  const capacidade = Math.max(1, Math.floor(amostrasDia || 1));
  return Math.min(Math.max(capacidade * 3, 24), 384);
}

function toEquipamentoEditRowData(linha: EquipamentoVinculado): EquipamentoEditRowData {
  return {
    id: linha.id,
    nome: linha.equipamentos?.nome ?? "-",
    peso_alocacao: linha.peso_alocacao,
    quantidade: linha.equipamentos?.quantidade ?? null,
    custo_unitario: linha.equipamentos?.custo_unitario ?? null,
    vida_util_anos: linha.equipamentos?.vida_util_anos ?? null,
    percentual_manutencao_anual: linha.equipamentos?.percentual_manutencao_anual ?? null,
    manutencao_anual_fixa: linha.equipamentos?.manutencao_anual_fixa ?? null,
    possui: linha.equipamentos?.possui ?? null,
  };
}

function toEquipamentoOption(equipamento: EquipamentoOpcao): EquipamentoOption {
  return {
    id: equipamento.id,
    label: equipamento.nome,
  };
}

function Badge({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
        muted
          ? "bg-muted text-muted-foreground ring-border"
          : "bg-success-soft text-success-strong ring-success-strong/30"
      }`}
    >
      {children}
    </span>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
          {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      <div className={`mt-2 ${panel}`}>{children}</div>
    </section>
  );
}

function Stat({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={compact ? "rounded-md border border-border/60 bg-muted/35 px-3 py-2" : panel}>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-base font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-background/60 px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Table({ children }: { children: ReactNode }) {
  return <div className="mt-2 overflow-x-auto"><table className="mx-auto table-auto border-collapse border border-foreground/70">{children}</table></div>;
}

