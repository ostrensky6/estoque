import Link from "next/link";

import { OrcamentosTable } from "@/components/orcamento/OrcamentosTable";
import { formatCurrency as brl, formatDate } from "@/lib/formatters";
import { carregarLinhasOrcamentos, type OrcamentoFila } from "@/lib/orcamento/orcamentos-listagem";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SearchParams = {
  periodo?: string;
};

type DemandaFunil = {
  id: number;
  titulo: string | null;
  cliente_nome: string | null;
  modalidade: string | null;
  status: string | null;
  responsavel_interno: string | null;
  criado_em: string;
};

const SUBAREAS = [
  {
    href: "/orcamento/demandas",
    titulo: "Demandas/Propostas",
    detalhe: "Entrada obrigatória antes de qualquer orçamento formal.",
  },
  {
    href: "/orcamento/em-elaboracao",
    titulo: "Em elaboração",
    detalhe: "Custos pendentes ou ainda em preenchimento.",
  },
  {
    href: "/orcamento/revisao",
    titulo: "Prontos para revisão",
    detalhe: "Módulos preenchidos, enviados ou aguardando conferência.",
  },
  {
    href: "/orcamento/emitidos",
    titulo: "Emitidos/enviados",
    detalhe: "Versões finais ativas, vencidas e documentos enviados.",
  },
  {
    href: "/orcamento/decididos",
    titulo: "Aprovados/recusados",
    detalhe: "Resultados comerciais e documentos cancelados.",
  },
  {
    href: "/orcamento/historico",
    titulo: "Histórico de Orçamentos",
    detalhe: "Versões, validade, duplicações e comparação.",
  },
  {
    href: "/orcamento/parametros",
    titulo: "Parâmetros Econômicos",
    detalhe: "Percentuais, gross-up, versões e snapshots.",
  },
  {
    href: "/orcamento/modelos",
    titulo: "Modelos/Templates",
    detalhe: "Templates e catálogo institucional de custos.",
  },
  {
    href: "/orcamento/governanca",
    titulo: "Governança",
    detalhe: "Permissões, eventos sensíveis e auditoria por campo.",
  },
];

export default async function OrcamentosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const filtros = await searchParams;
  const periodoDias = Number(filtros.periodo ?? 30) || 30;
  const agora = new Date();
  const inicioPeriodo = new Date(agora.getTime() - periodoDias * 86400000);
  const supabase = await createClient();
  const [{ data: demandas }, linhas] = await Promise.all([
    supabase
      .from("demandas_propostas")
      .select("id, titulo, cliente_nome, modalidade, status, responsavel_interno, criado_em")
      .order("criado_em", { ascending: false }),
    carregarLinhasOrcamentos(),
  ]);

  const demandasPeriodo = ((demandas ?? []) as DemandaFunil[]).filter((demanda) =>
    dentroPeriodo(demanda.criado_em, inicioPeriodo),
  );
  const linhasPeriodo = linhas.filter((linha) => dentroPeriodo(linha.criadoEm, inicioPeriodo));
  const finaisPeriodo = linhasPeriodo.filter((linha) => linha.origem === "final");
  const emitidosAtivos = linhas.filter((linha) => linha.origem === "final" && linha.status === "emitido");
  const vencidos = linhas.filter((linha) => linha.origem === "final" && linha.status === "vencido");
  const aprovadosPeriodo = linhasPeriodo.filter((linha) => linha.status === "aprovado");
  const custosPendentes = linhas.filter((linha) => linha.etapaAtual === "Custos pendentes");
  const custosRevisados = linhas.filter((linha) => ["Custos preenchidos", "Pronto para revisão"].includes(linha.etapaAtual ?? ""));
  const aguardandoParametros = linhas.filter((linha) => linha.grupo === "revisao" && linha.origem !== "final");
  const prontosEmissao = linhas.filter((linha) => linha.grupo === "revisao");
  const receitaPotencial = emitidosAtivos.reduce((acc, linha) => acc + Number(linha.total ?? 0), 0);
  const totalMonitorado = linhas.reduce((acc, linha) => acc + Number(linha.total ?? 0), 0);

  const funil = [
    { label: "Demanda", valor: demandasPeriodo.length, href: "/orcamento/demandas" },
    { label: "Custos", valor: custosRevisados.length, href: "/orcamento/em-elaboracao" },
    { label: "Parâmetros", valor: aguardandoParametros.length, href: "/orcamento/parametros" },
    { label: "Final", valor: finaisPeriodo.length, href: "/orcamento/emitidos" },
    { label: "Aprovado", valor: aprovadosPeriodo.length, href: "/orcamento/decididos" },
  ];
  const maxFunil = Math.max(...funil.map((item) => item.valor), 1);
  const valorPorStatus = agruparValorPor(linhas, (linha) => linha.statusLabel || linha.status);
  const topClientes = agruparValorPor(linhas, (linha) => linha.cliente || "Cliente sem nome").slice(0, 5);
  const modalidades = agruparContagemPor(linhas, (linha) => linha.tipoLabel);
  const tempoMedio = [
    { label: "Elaboração", valor: mediaIdadeDias(linhas.filter((linha) => linha.grupo === "em_elaboracao")) },
    { label: "Revisão", valor: mediaIdadeDias(linhas.filter((linha) => linha.grupo === "revisao")) },
    { label: "Emitidos", valor: mediaIdadeDias(linhas.filter((linha) => linha.grupo === "emitidos")) },
    { label: "Decididos", valor: mediaIdadeDias(linhas.filter((linha) => linha.grupo === "decididos")) },
  ];
  const paradas = linhas
    .filter((linha) => ["em_elaboracao", "revisao"].includes(linha.grupo) && idadeDias(linha.atualizadoEm ?? linha.criadoEm, agora) >= 7)
    .slice(0, 6);
  const vencendo = emitidosAtivos
    .filter((linha) => diasAte(linha.data, agora) >= 0 && diasAte(linha.data, agora) <= 30)
    .sort((a, b) => diasAte(a.data, agora) - diasAte(b.data, agora))
    .slice(0, 6);
  const aguardandoRevisao = linhas
    .filter((linha) => linha.grupo === "revisao")
    .slice(0, 6);
  const parametrosAtencao = linhas
    .filter((linha) => linha.origem !== "final" && linha.grupo === "revisao")
    .slice(0, 6);

  return (
    <div className="min-h-dvh bg-transparent font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Orçamentos</h1>
            <p className="mt-1 max-w-3xl text-sm text-zinc-500">
              Dashboard operacional para funil, receita potencial, gargalos e próximas ações de orçamento.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[15, 30, 60, 90].map((dias) => (
              <Link
                key={dias}
                href={`/orcamento?periodo=${dias}`}
                className={`rounded-md border px-3 py-2 text-sm font-medium ${
                  periodoDias === dias
                    ? "border-brand-600 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-950/30 dark:text-brand-300"
                    : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                }`}
              >
                {dias}d
              </Link>
            ))}
            <Link href="/orcamento/demandas" className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-500">
              Nova demanda
            </Link>
          </div>
        </div>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Resumo titulo="Demandas novas" valor={demandasPeriodo.length.toLocaleString("pt-BR")} href="/orcamento/demandas" />
          <Resumo titulo="Custos pendentes" valor={custosPendentes.length.toLocaleString("pt-BR")} href="/orcamento/em-elaboracao" />
          <Resumo titulo="Aguardando parâmetros" valor={aguardandoParametros.length.toLocaleString("pt-BR")} href="/orcamento/parametros" />
          <Resumo titulo="Prontos para emissão" valor={prontosEmissao.length.toLocaleString("pt-BR")} href="/orcamento/revisao" />
          <Resumo titulo="Emitidos" valor={finaisPeriodo.length.toLocaleString("pt-BR")} href="/orcamento/emitidos" />
          <Resumo titulo="Aprovados" valor={aprovadosPeriodo.length.toLocaleString("pt-BR")} href="/orcamento/decididos" />
          <Resumo titulo="Vencidos" valor={vencidos.length.toLocaleString("pt-BR")} href="/orcamento/emitidos" />
          <Resumo titulo="Receita potencial" valor={brl(receitaPotencial)} href="/orcamento/emitidos" />
        </section>

        <section className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <Painel titulo="Funil por etapa" subtitulo={`Período: últimos ${periodoDias} dias`}>
            <div className="space-y-3">
              {funil.map((item) => (
                <Link key={item.label} href={item.href} className="grid grid-cols-[7rem_1fr_4rem] items-center gap-3 text-sm">
                  <span className="font-medium">{item.label}</span>
                  <span className="h-3 rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <span
                      className="block h-3 rounded-full bg-brand-600"
                      style={{ width: `${Math.max(6, (item.valor / maxFunil) * 100)}%` }}
                    />
                  </span>
                  <span className="text-right font-semibold tabular-nums">{item.valor}</span>
                </Link>
              ))}
            </div>
          </Painel>

          <Painel titulo="Valor por status" subtitulo={`Total monitorado: ${brl(totalMonitorado)}`}>
            <ListaMetrica itens={valorPorStatus.slice(0, 6)} valorMoeda />
          </Painel>
        </section>

        <section className="mt-6 grid gap-4 xl:grid-cols-3">
          <Painel titulo="Tempo médio por etapa" subtitulo="Dias desde a última atualização">
            <ListaMetrica itens={tempoMedio.map((item) => ({ label: item.label, valor: item.valor }))} sufixo=" dias" />
          </Painel>
          <Painel titulo="Top clientes" subtitulo="Valor monitorado por cliente">
            <ListaMetrica itens={topClientes} valorMoeda />
          </Painel>
          <Painel titulo="Modalidade" subtitulo="Quantidade de itens no funil">
            <ListaMetrica itens={modalidades} />
          </Painel>
        </section>

        <section className="mt-6 grid gap-4 xl:grid-cols-2">
          <TabelaAcao titulo="Paradas há mais de 7 dias" linhas={paradas} detalhe={(linha) => `${linha.etapaAtual ?? "Sem etapa"} · ${idadeDias(linha.atualizadoEm ?? linha.criadoEm, agora)} dias`} />
          <TabelaAcao titulo="Vencendo em até 30 dias" linhas={vencendo} detalhe={(linha) => `${formatDate(linha.data)} · ${diasAte(linha.data, agora)} dias`} />
          <TabelaAcao titulo="Custos aguardando revisão" linhas={aguardandoRevisao} detalhe={(linha) => `${linha.etapaAtual} · ${linha.responsavel}`} />
          <TabelaAcao titulo="Parâmetros pendentes ou antigos" linhas={parametrosAtencao} detalhe={(linha) => `${linha.proximaAcao ?? "Revisar"} · atualizado ${formatDate(linha.atualizadoEm ?? linha.criadoEm)}`} />
        </section>

        <section className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {SUBAREAS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-brand-300 hover:bg-brand-50/50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-brand-800 dark:hover:bg-brand-950/20"
            >
              <h2 className="text-sm font-semibold">{item.titulo}</h2>
              <p className="mt-1 text-xs leading-5 text-zinc-500">{item.detalhe}</p>
            </Link>
          ))}
        </section>

        <section className="mt-6">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">Lista consolidada recente</h2>
              <p className="mt-1 text-xs text-zinc-500">Use as subáreas para trabalhar por etapa do funil.</p>
            </div>
          </div>
          <OrcamentosTable rows={linhas.slice(0, 25)} />
        </section>
      </main>
    </div>
  );
}

function dentroPeriodo(value: string, inicio: Date) {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date >= inicio;
}

function idadeDias(value: string | null | undefined, now = new Date()) {
  if (!value) return 0;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86400000));
}

function diasAte(value: string | null | undefined, now = new Date()) {
  if (!value) return 9999;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 9999;
  return Math.ceil((date.getTime() - now.getTime()) / 86400000);
}

function mediaIdadeDias(linhas: OrcamentoFila[]) {
  if (!linhas.length) return 0;
  return Math.round(linhas.reduce((acc, linha) => acc + idadeDias(linha.atualizadoEm ?? linha.criadoEm), 0) / linhas.length);
}

function agruparValorPor(linhas: OrcamentoFila[], keyFn: (linha: OrcamentoFila) => string) {
  const mapa = new Map<string, number>();
  for (const linha of linhas) {
    const key = keyFn(linha);
    mapa.set(key, (mapa.get(key) ?? 0) + Number(linha.total ?? 0));
  }
  return [...mapa.entries()]
    .map(([label, valor]) => ({ label, valor }))
    .sort((a, b) => b.valor - a.valor);
}

function agruparContagemPor(linhas: OrcamentoFila[], keyFn: (linha: OrcamentoFila) => string) {
  const mapa = new Map<string, number>();
  for (const linha of linhas) {
    const key = keyFn(linha);
    mapa.set(key, (mapa.get(key) ?? 0) + 1);
  }
  return [...mapa.entries()]
    .map(([label, valor]) => ({ label, valor }))
    .sort((a, b) => b.valor - a.valor);
}

function Painel({ titulo, subtitulo, children }: { titulo: string; subtitulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold">{titulo}</h2>
      <p className="mt-1 text-xs text-zinc-500">{subtitulo}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ListaMetrica({
  itens,
  valorMoeda = false,
  sufixo = "",
}: {
  itens: Array<{ label: string; valor: number }>;
  valorMoeda?: boolean;
  sufixo?: string;
}) {
  const max = Math.max(...itens.map((item) => item.valor), 1);
  return (
    <div className="space-y-3">
      {itens.map((item) => (
        <div key={item.label} className="grid grid-cols-[1fr_5rem] gap-3 text-sm">
          <div>
            <div className="flex justify-between gap-2">
              <span className="truncate font-medium">{item.label}</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div className="h-2 rounded-full bg-brand-600" style={{ width: `${Math.max(5, (item.valor / max) * 100)}%` }} />
            </div>
          </div>
          <span className="text-right font-semibold tabular-nums">
            {valorMoeda ? brl(item.valor) : `${item.valor.toLocaleString("pt-BR")}${sufixo}`}
          </span>
        </div>
      ))}
      {itens.length === 0 && <p className="text-sm text-zinc-400">Sem dados.</p>}
    </div>
  );
}

function TabelaAcao({
  titulo,
  linhas,
  detalhe,
}: {
  titulo: string;
  linhas: OrcamentoFila[];
  detalhe: (linha: OrcamentoFila) => string;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="text-sm font-semibold">{titulo}</h2>
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {linhas.map((linha) => (
          <Link key={linha.key} href={linha.href} className="grid gap-1 px-4 py-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-950/50">
            <span className="font-medium">{linha.titulo}</span>
            <span className="text-xs text-zinc-500">{linha.cliente} · {detalhe(linha)}</span>
          </Link>
        ))}
        {linhas.length === 0 && <p className="px-4 py-5 text-sm text-zinc-400">Nenhuma ação crítica no momento.</p>}
      </div>
    </section>
  );
}

function Resumo({ titulo, valor, href }: { titulo: string; valor: string; href: string }) {
  return (
    <Link href={href} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm hover:border-brand-300 hover:bg-brand-50/50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-brand-800 dark:hover:bg-brand-950/20">
      <p className="text-xs font-medium text-zinc-500">{titulo}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{valor}</p>
    </Link>
  );
}
