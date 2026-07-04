import Link from "next/link";
import { QrCode } from "@/components/common/QrCode";
import { formatDate } from "@/lib/formatters";
import { gerarUrlCurtaKontrol } from "@/lib/scanner/urls";
import { createClientUntyped } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SearchParams = {
  tab?: string;
  scan?: string;
};

type UnidadeEquipamento = {
  id: number;
  equipamento_id: number;
  codigo_patrimonio: string | null;
  numero_serie: string | null;
  fabricante: string | null;
  modelo: string | null;
  status_operacional: string;
  ativo: boolean;
  observacoes: string | null;
  equipamentos: { nome: string | null } | { nome: string | null }[] | null;
  locais: { nome: string | null } | { nome: string | null }[] | null;
};

type ManutencaoEquipamento = {
  id: number;
  equipamento_unidade_id: number;
  tipo: string;
  data_programada: string;
  data_inicio: string | null;
  data_conclusao: string | null;
  proxima_data: string | null;
  status: string;
  bloqueia_operacao: boolean;
  tecnico_responsavel: string | null;
  descricao: string | null;
  resultado: string | null;
  ordem_servico: string | null;
  numero_documento: string | null;
};

type PlanoManutencao = {
  id: number;
  equipamento_id: number | null;
  equipamento_unidade_id: number | null;
  tipo: string;
  periodicidade_dias: number;
  tolerancia_dias: number;
  obrigatorio: boolean;
  descricao: string | null;
  ativo: boolean;
};

type StatusLogEquipamento = {
  id: number;
  equipamento_unidade_id: number;
  status_anterior: string | null;
  status_novo: string;
  motivo: string | null;
  criado_em: string;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  operacional: { label: "Operacional", cls: "bg-brand-100 text-brand-800 dark:bg-brand-950/50 dark:text-brand-300" },
  em_manutencao: { label: "Em manutencao", cls: "bg-warning-soft text-warning-strong" },
  calibracao_pendente: { label: "Calibracao pendente", cls: "bg-info-soft text-info-strong" },
  calibracao_vencida: { label: "Calibracao vencida", cls: "bg-danger-soft text-danger-strong" },
  reservado: { label: "Reservado", cls: "bg-muted text-foreground" },
  inativo: { label: "Inativo", cls: "bg-muted text-muted-foreground" },
  descartado: { label: "Descartado", cls: "bg-muted text-muted-foreground" },
};

function asOne<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function statusMeta(status: string, ativo: boolean) {
  if (!ativo) return STATUS.inativo;
  return STATUS[status] ?? { label: status, cls: "bg-muted text-foreground" };
}

function labelTipo(value: string | null | undefined) {
  if (!value) return "—";
  return value.replaceAll("_", " ");
}

function dateTime(value: string | null | undefined) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function byUnit<T extends { equipamento_unidade_id: number }>(items: T[]) {
  return items.reduce<Record<number, T[]>>((acc, item) => {
    acc[item.equipamento_unidade_id] = [...(acc[item.equipamento_unidade_id] ?? []), item];
    return acc;
  }, {});
}

function ultimaManutencao(items: ManutencaoEquipamento[]) {
  return [...items]
    .filter((item) => item.status === "concluida")
    .sort((a, b) => dateTime(b.data_conclusao ?? b.data_programada) - dateTime(a.data_conclusao ?? a.data_programada))[0] ?? null;
}

function proximaManutencao(items: ManutencaoEquipamento[]) {
  return [...items]
    .filter((item) => ["agendada", "em_execucao", "vencida"].includes(item.status))
    .sort((a, b) => dateTime(a.data_programada) - dateTime(b.data_programada))[0] ?? null;
}

function planoAplicavel(unidade: UnidadeEquipamento, planos: PlanoManutencao[]) {
  return planos.find((plano) => plano.equipamento_unidade_id === unidade.id)
    ?? planos.find((plano) => plano.equipamento_id === unidade.equipamento_id)
    ?? null;
}

export default async function EquipamentosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { scan } = await searchParams;
  const scanId = scan != null && /^\d+$/.test(scan) ? Number(scan) : null;
  const supabase = await createClientUntyped();

  const query = supabase
    .from("equipamento_unidades")
    .select("id, equipamento_id, codigo_patrimonio, numero_serie, fabricante, modelo, status_operacional, ativo, observacoes, equipamentos(nome), locais(nome)")
    .order("id", { ascending: true });

  const { data } = scanId ? await query.eq("id", scanId) : await query;
  const unidades = (data ?? []) as unknown as UnidadeEquipamento[];
  const unidadeIds = unidades.map((unidade) => unidade.id);

  const [manutencoesResult, planosResult, logsResult] = unidadeIds.length > 0
    ? await Promise.all([
        supabase
          .from("equipamento_manutencoes")
          .select("id, equipamento_unidade_id, tipo, data_programada, data_inicio, data_conclusao, proxima_data, status, bloqueia_operacao, tecnico_responsavel, descricao, resultado, ordem_servico, numero_documento")
          .in("equipamento_unidade_id", unidadeIds)
          .order("data_programada", { ascending: false })
          .limit(200),
        supabase
          .from("equipamento_planos_manutencao")
          .select("id, equipamento_id, equipamento_unidade_id, tipo, periodicidade_dias, tolerancia_dias, obrigatorio, descricao, ativo")
          .eq("ativo", true)
          .limit(200),
        supabase
          .from("equipamento_status_log")
          .select("id, equipamento_unidade_id, status_anterior, status_novo, motivo, criado_em")
          .in("equipamento_unidade_id", unidadeIds)
          .order("criado_em", { ascending: false })
          .limit(200),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const manutencoesPorUnidade = byUnit((manutencoesResult.data ?? []) as unknown as ManutencaoEquipamento[]);
  const logsPorUnidade = byUnit((logsResult.data ?? []) as unknown as StatusLogEquipamento[]);
  const planos = (planosResult.data ?? []) as unknown as PlanoManutencao[];

  return (
    <div className="min-h-dvh bg-transparent font-sans text-foreground">
      <main className="app-page-container">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Estoque · Patrimonio fisico
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">
              Equipamentos físicos
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Lista mínima de unidades patrimoniais cadastradas. Esta página é somente leitura e serve de base para identificação patrimonial futura.
            </p>
          </div>
          <Link
            href="/cadastros/equipamentos"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Cadastro de tipos
          </Link>
        </div>

        {scanId && (
          <div className="mt-5 rounded-lg border border-info-strong/30 bg-info-soft px-4 py-3 text-sm text-info-strong">
            Exibindo unidade escaneada #{scanId}. Esta visualização não altera status, manutenção, calibração ou operação.
            <Link href="/estoque/equipamentos?tab=unidades" className="ml-2 font-medium underline">
              Ver todas
            </Link>
          </div>
        )}

        <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-transparent text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">ID</th>
                <th className="px-4 py-3 text-left">Equipamento/tipo</th>
                <th className="px-4 py-3 text-left">Patrimônio</th>
                <th className="px-4 py-3 text-left">Série</th>
                <th className="px-4 py-3 text-left">Fabricante/modelo</th>
                <th className="px-4 py-3 text-left">Local</th>
                <th className="px-4 py-3 text-left">Situação</th>
                <th className="px-4 py-3 text-left">QR interno</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {unidades.map((unidade) => {
                const equipamento = asOne(unidade.equipamentos);
                const local = asOne(unidade.locais);
                const meta = statusMeta(unidade.status_operacional, unidade.ativo);
                const destacado = scanId === unidade.id;
                const urlCurta = gerarUrlCurtaKontrol("equipamento_unidade", unidade.id);

                return (
                  <tr
                    key={unidade.id}
                    className={destacado ? "bg-info-soft/70" : ""}
                  >
                    <td className="px-4 py-3 font-mono text-xs">#{unidade.id}</td>
                    <td className="px-4 py-3 font-medium">
                      {equipamento?.nome ?? `Equipamento #${unidade.equipamento_id}`}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {unidade.codigo_patrimonio ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {unidade.numero_serie ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {[unidade.fabricante, unidade.modelo].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {local?.nome ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.cls}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="inline-grid max-w-48 gap-2 rounded-md border border-border bg-card p-2 text-xs shadow-sm">
                        <QrCode
                          value={urlCurta}
                          label={`QR da unidade ${unidade.id}`}
                          size={84}
                          className="rounded bg-card"
                        />
                        <div className="space-y-0.5">
                          <p className="font-medium text-foreground">
                            ID Kontrol #{unidade.id}
                          </p>
                          <p className="truncate text-muted-foreground" title={equipamento?.nome ?? undefined}>
                            {equipamento?.nome ?? `Equipamento #${unidade.equipamento_id}`}
                          </p>
                          <p className="font-mono text-[11px] text-muted-foreground">
                            {unidade.codigo_patrimonio ?? "Sem patrimonio"}
                          </p>
                          {unidade.numero_serie && (
                            <p className="font-mono text-[11px] text-muted-foreground">
                              Série {unidade.numero_serie}
                            </p>
                          )}
                          <p className="break-all font-mono text-[11px] text-muted-foreground">
                            {urlCurta}
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {unidades.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground/80">
                    {scanId ? `Nenhuma unidade encontrada para #${scanId}.` : "Nenhuma unidade patrimonial cadastrada."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Operação básica</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Leitura operacional mínima das unidades. Esta visão não registra manutenção, calibração ou mudança de status.
              </p>
            </div>
            <Link
              href="/cadastros/equipamentos"
              className="text-sm font-medium text-brand-700 underline-offset-4 hover:underline dark:text-brand-300"
            >
              Gerenciar cadastro de equipamentos
            </Link>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {unidades.map((unidade) => {
              const equipamento = asOne(unidade.equipamentos);
              const meta = statusMeta(unidade.status_operacional, unidade.ativo);
              const manutencoes = manutencoesPorUnidade[unidade.id] ?? [];
              const ultima = ultimaManutencao(manutencoes);
              const proxima = proximaManutencao(manutencoes);
              const plano = planoAplicavel(unidade, planos);
              const historico = (logsPorUnidade[unidade.id] ?? []).slice(0, 3);

              return (
                <article
                  key={`operacao-${unidade.id}`}
                  className="rounded-lg border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs text-muted-foreground">Unidade #{unidade.id}</p>
                      <h3 className="mt-1 text-base font-semibold">
                        {equipamento?.nome ?? `Equipamento #${unidade.equipamento_id}`}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Patrimônio {unidade.codigo_patrimonio ?? "não informado"} · Série {unidade.numero_serie ?? "não informada"}
                      </p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.cls}`}>
                      {meta.label}
                    </span>
                  </div>

                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-md border border-border/70 p-3">
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Última manutenção</dt>
                      <dd className="mt-1 text-sm font-medium">
                        {ultima ? `${labelTipo(ultima.tipo)} · ${formatDate(ultima.data_conclusao ?? ultima.data_programada)}` : "Sem registro concluído"}
                      </dd>
                      {ultima?.resultado && (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{ultima.resultado}</p>
                      )}
                    </div>
                    <div className="rounded-md border border-border/70 p-3">
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Próxima ação</dt>
                      <dd className="mt-1 text-sm font-medium">
                        {proxima
                          ? `${labelTipo(proxima.tipo)} · ${formatDate(proxima.data_programada)}`
                          : plano
                            ? `${labelTipo(plano.tipo)} · a cada ${plano.periodicidade_dias} dias`
                            : "Sem agenda/plano ativo"}
                      </dd>
                      {proxima?.bloqueia_operacao && (
                        <p className="mt-1 text-xs font-medium text-danger-strong">Bloqueia operação</p>
                      )}
                    </div>
                    <div className="rounded-md border border-border/70 p-3">
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Plano ativo</dt>
                      <dd className="mt-1 text-sm font-medium">
                        {plano ? `${labelTipo(plano.tipo)} · tolerância ${plano.tolerancia_dias} dias` : "Nenhum plano aplicável"}
                      </dd>
                      {plano?.descricao && (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{plano.descricao}</p>
                      )}
                    </div>
                    <div className="rounded-md border border-border/70 p-3">
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Histórico de status</dt>
                      <dd className="mt-1 space-y-1 text-xs text-muted-foreground">
                        {historico.length > 0 ? historico.map((item) => (
                          <p key={item.id}>
                            <span className="font-medium text-foreground">{statusMeta(item.status_novo, true).label}</span>
                            {" · "}
                            {formatDate(item.criado_em)}
                          </p>
                        )) : "Sem transições registradas"}
                      </dd>
                    </div>
                  </dl>
                </article>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
