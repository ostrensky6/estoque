import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { gargalo, horasBancadaPorAmostra, type Etapa } from "@/lib/costing/engine";
import { calcularTodas } from "@/lib/costing/loader";
import { ConfirmActionButton } from "@/components/common/ConfirmActionButton";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { inativarAnalise } from "@/lib/actions/receita";
import { formatCurrency, formatNumber } from "@/lib/formatters";

export const dynamic = "force-dynamic";

type EquipamentoVinculado = {
  id: number;
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

const panel = "rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900";
const th = "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-400";
const td = "px-3 py-2 align-top text-sm";

export default async function AnaliseDetalhe({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo: codigoRaw } = await params;
  const codigo = decodeURIComponent(codigoRaw);
  const supabase = await createClient();

  const { data: analise } = await supabase
    .from("analises")
    .select("codigo, nome, nome_simplificado, descricao, status, ativo")
    .eq("codigo", codigo)
    .single();
  if (!analise) notFound();

  const [{ data: etapas }, { data: equipamentos }, { data: materiais }] = await Promise.all([
    supabase
      .from("etapas")
      .select("*")
      .eq("codigo_analise", codigo)
      .order("ordem", { nullsFirst: false }),
    supabase
      .from("equipamento_analise")
      .select(
        "id, peso_alocacao, equipamentos(nome, quantidade, custo_unitario, vida_util_anos, percentual_manutencao_anual, manutencao_anual_fixa, possui)",
      )
      .eq("codigo_analise", codigo),
    supabase
      .from("insumo_analise")
      .select(
        "id, nome_etapa, nome_atividade, especificacao_insumo, grupo_escolha, quantidade_por_amostra, unidade, modo_cobranca, base_calculo, preferencial, etapa_id, insumo_id, insumos(especificacao, nome_item, unidade, custo_unitario, estoque_seguranca, ponto_reposicao, lead_time_dias)",
      )
      .eq("codigo_analise", codigo)
      .order("nome_etapa"),
  ]);

  const etapasT = (etapas ?? []) as unknown as Etapa[];
  const materiaisT = (materiais ?? []) as unknown as MaterialVinculado[];
  const equipamentosT = (equipamentos ?? []) as unknown as EquipamentoVinculado[];
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

  let custo = null as Awaited<ReturnType<typeof calcularTodas>>["breakdowns"][number] | null;
  let erroCusteio = false;
  try {
    const { breakdowns } = await calcularTodas();
    custo = breakdowns.find((b) => b.codigo === codigo) ?? null;
  } catch {
    erroCusteio = true;
  }

  const g = gargalo(etapasT);
  const tempoBancada = horasBancadaPorAmostra(etapasT);
  const prazo = Math.max(0, ...(etapas ?? []).map((e) => Number(e.dia_fim_max ?? 0)));
  const avisos = [
    etapasT.length === 0 ? "Sem etapas cadastradas." : null,
    materiaisT.length === 0 ? "Sem materiais/insumos vinculados." : null,
    equipamentosT.length === 0 ? "Sem equipamentos vinculados." : null,
    materiaisT.some((m) => Number(m.quantidade_por_amostra ?? 0) > 0 && !m.insumo_id)
      ? "Ha materiais com consumo tecnico sem vinculo com item de estoque."
      : null,
    !custo || custo.custoTotal <= 0 ? "Custeio calculado ausente ou zerado." : null,
  ].filter(Boolean) as string[];

  return (
    <div className="min-h-dvh bg-transparent font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto max-w-7xl px-6 py-10">
        <Breadcrumbs items={[{ label: "Analises", href: "/analises" }, { label: codigo }]} />

        <section className="mt-3 grid gap-4 lg:grid-cols-[1fr_280px]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{analise.codigo}</h1>
              <Badge>{analise.ativo ? "Ativa" : "Inativa"}</Badge>
              {analise.status && <Badge muted>{analise.status}</Badge>}
            </div>
            <p className="mt-2 text-lg font-medium">{analise.nome_simplificado || analise.nome || "Sem nome"}</p>
            {analise.descricao && <p className="mt-2 max-w-3xl text-sm text-zinc-500">{analise.descricao}</p>}
          </div>

          <div className={panel}>
            <h2 className="text-sm font-semibold">Administracao segura</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Esta ficha esta em modo leitura. A remocao fisica foi retirada da interface normal.
            </p>
            <div className="mt-3">
              {analise.ativo ? (
                <ConfirmActionButton
                  action={inativarAnalise}
                  fields={{ codigo }}
                  trigger="Inativar analise"
                  titulo="Inativar analise"
                  mensagem={`Inativar "${analise.codigo}"? A receita e o historico permanecem preservados.`}
                  confirmLabel="Inativar"
                />
              ) : (
                <span className="text-sm text-zinc-500">Analise ja inativa.</span>
              )}
            </div>
          </div>
        </section>

        {avisos.length > 0 && (
          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <p className="font-medium">Alertas de completude</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {avisos.map((aviso) => (
                <li key={aviso}>{aviso}</li>
              ))}
            </ul>
          </div>
        )}

        <nav className="mt-8 flex flex-wrap gap-2 text-sm">
          {["Resumo", "Tempo", "Materiais/Insumos", "Equipamentos", "Custeio", "Estoque", "Historico/Versoes"].map(
            (label) => (
              <a key={label} href={`#${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} className="rounded-md border border-zinc-200 px-3 py-1.5 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900">
                {label}
              </a>
            ),
          )}
        </nav>

        <section id="resumo" className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Etapas" value={String(etapasT.length)} />
          <Stat label="Materiais" value={String(materiaisT.length)} />
          <Stat label="Equipamentos" value={String(equipamentosT.length)} />
          <Stat label="Capacidade" value={g.amostrasDia > 0 ? `${formatNumber(g.amostrasDia)}/dia` : "-"} />
          <Stat label="Preco atual" value={custo ? formatCurrency(custo.preco) : "-"} />
        </section>

        <Section id="tempo" title="Tempo">
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Execucoes/dia" value={g.execucoesDia > 0 ? formatNumber(g.execucoesDia) : "-"} compact />
            <Stat label="Amostras/execucao" value={g.amostrasPorExecucao > 0 ? formatNumber(g.amostrasPorExecucao) : "-"} compact />
            <Stat label="Bancada/amostra" value={tempoBancada > 0 ? `${formatNumber(tempoBancada)} h` : "-"} compact />
            <Stat label="Prazo max." value={prazo > 0 ? `${prazo} dias` : "-"} compact />
          </div>
          <Table>
            <thead>
              <tr>
                <th className={th}>Ordem</th>
                <th className={th}>Etapa</th>
                <th className={th}>Atividade</th>
                <th className={th}>Exec/dia</th>
                <th className={th}>Amostras/exec.</th>
                <th className={th}>Maquina h</th>
                <th className={th}>Bancada h</th>
                <th className={th}>Limitacao</th>
              </tr>
            </thead>
            <tbody>
              {(etapas ?? []).map((etapa) => (
                <tr key={etapa.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className={td}>{etapa.ordem ?? "-"}</td>
                  <td className={td}>{etapa.nome_etapa}</td>
                  <td className={td}>{etapa.nome_atividade}</td>
                  <td className={td}>{fmt(etapa.execucoes_por_dia)}</td>
                  <td className={td}>{fmt(etapa.amostras_por_execucao)}</td>
                  <td className={td}>{fmt(etapa.tempo_maquina_h)}</td>
                  <td className={td}>{fmt(etapa.tempo_bancada_h)}</td>
                  <td className={td}>{etapa.tipo_limitacao ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Section>

        <Section id="materiais-insumos" title="Materiais/Insumos">
          <Table>
            <thead>
              <tr>
                <th className={th}>Etapa</th>
                <th className={th}>Atividade</th>
                <th className={th}>Material tecnico</th>
                <th className={th}>Item de estoque</th>
                <th className={th}>Qtd/amostra</th>
                <th className={th}>Cobranca</th>
                <th className={th}>Grupo</th>
                <th className={th}>Custo unit.</th>
              </tr>
            </thead>
            <tbody>
              {materiaisT.map((material) => (
                <tr key={material.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className={td}>{material.nome_etapa}</td>
                  <td className={td}>{material.nome_atividade}</td>
                  <td className={td}>{material.especificacao_insumo ?? "-"}</td>
                  <td className={td}>{material.insumos?.especificacao ?? material.insumos?.nome_item ?? "Sem vinculo"}</td>
                  <td className={td}>{fmt(material.quantidade_por_amostra)} {material.unidade ?? ""}</td>
                  <td className={td}>{material.modo_cobranca ?? "-"}</td>
                  <td className={td}>{material.grupo_escolha ?? "-"}</td>
                  <td className={td}>{material.insumos?.custo_unitario != null ? formatCurrency(material.insumos.custo_unitario) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Section>

        <Section id="equipamentos" title="Equipamentos">
          <Table>
            <thead>
              <tr>
                <th className={th}>Equipamento</th>
                <th className={th}>Peso</th>
                <th className={th}>Quantidade</th>
                <th className={th}>Custo unit.</th>
                <th className={th}>Vida util</th>
                <th className={th}>Manutencao</th>
                <th className={th}>Disponivel</th>
              </tr>
            </thead>
            <tbody>
              {equipamentosT.map((linha) => (
                <tr key={linha.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className={td}>{linha.equipamentos?.nome ?? "-"}</td>
                  <td className={td}>{fmt(linha.peso_alocacao)}</td>
                  <td className={td}>{fmt(linha.equipamentos?.quantidade)}</td>
                  <td className={td}>{linha.equipamentos?.custo_unitario != null ? formatCurrency(linha.equipamentos.custo_unitario) : "-"}</td>
                  <td className={td}>{linha.equipamentos?.vida_util_anos ? `${fmt(linha.equipamentos.vida_util_anos)} anos` : "-"}</td>
                  <td className={td}>
                    {linha.equipamentos?.manutencao_anual_fixa != null
                      ? formatCurrency(linha.equipamentos.manutencao_anual_fixa)
                      : linha.equipamentos?.percentual_manutencao_anual != null
                        ? `${fmt(linha.equipamentos.percentual_manutencao_anual)}%`
                        : "-"}
                  </td>
                  <td className={td}>{linha.equipamentos?.possui ? "Sim" : "Nao informado"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Section>

        <Section id="custeio" title="Custeio">
          {erroCusteio && <p className="text-sm text-amber-700">Nao foi possivel carregar o custeio atual.</p>}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Reagentes" value={custo ? formatCurrency(custo.reagentes) : "-"} compact />
            <Stat label="Equipamento" value={custo ? formatCurrency(custo.equipamento) : "-"} compact />
            <Stat label="Pessoal" value={custo ? formatCurrency(custo.pessoal) : "-"} compact />
            <Stat label="Overhead" value={custo ? formatCurrency(custo.overhead) : "-"} compact />
            <Stat label="Custo analitico" value={custo ? formatCurrency(custo.custoAnalitico) : "-"} compact />
            <Stat label="Custo total" value={custo ? formatCurrency(custo.custoTotal) : "-"} compact />
            <Stat label="Fatores" value={custo ? `${formatNumber(custo.fatores * 100)}%` : "-"} compact />
            <Stat label="Preco" value={custo ? formatCurrency(custo.preco) : "-"} compact />
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Valores exibidos pela engine atual, sem gravar snapshot e sem recalcular orcamentos antigos nesta etapa.
          </p>
        </Section>

        <Section id="estoque" title="Estoque">
          <p className="mb-3 text-sm text-zinc-500">
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
                  <tr key={material.id} className="border-t border-zinc-100 dark:border-zinc-800">
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

        <Section id="historico-versoes" title="Historico/Versoes">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <p className="font-medium">Ficha tecnica viva</p>
            <p className="mt-1">
              O cadastro atual ainda nao possui versionamento de protocolo nem snapshot tecnico por orcamento. Alteracoes
              futuras na receita podem afetar novos calculos; por isso, a proxima etapa deve introduzir versoes antes de
              conectar esta ficha a orcamentos historicos.
            </p>
          </div>
          <p className="mt-3 text-sm text-zinc-500">
            Proposta incremental: ficha read-only, versionamento de protocolo, snapshot no orcamento, diagnostico de
            estoque, integracao com compras e edicao administrativa controlada.
          </p>
          <Link href="/analises" className="mt-4 inline-flex text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
            Voltar para analises
          </Link>
        </Section>
      </main>
    </div>
  );
}

function fmt(value: number | null | undefined) {
  return value == null ? "-" : formatNumber(value);
}

function Badge({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
        muted
          ? "bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700"
          : "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900"
      }`}
    >
      {children}
    </span>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="mt-8">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">{title}</h2>
      <div className={`mt-3 ${panel}`}>{children}</div>
    </section>
  );
}

function Stat({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={compact ? "rounded-md bg-zinc-50 p-3 dark:bg-zinc-950" : panel}>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Table({ children }: { children: ReactNode }) {
  return <div className="mt-3 overflow-x-auto"><table className="min-w-full border-collapse">{children}</table></div>;
}
