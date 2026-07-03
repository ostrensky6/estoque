import { createClient } from "@/lib/supabase/server";
import { temPapel } from "@/lib/auth/roles";
import { StockControlHub } from "./StockControlHub";

export const dynamic = "force-dynamic";

type LoteDbRow = {
  id: number;
  codigo_lote: string | null;
  validade: string | null;
  validade_apos_abertura: string | null;
  quantidade_atual: number | null;
  status: string;
  insumos: { especificacao: string | null; unidade: string | null } | null;
};

const LOTE_STATUS: Record<string, string> = {
  quarentena: "Quarentena",
  aceito: "Aceito",
  em_uso: "Em uso",
  bloqueado: "Bloqueado",
  consumido: "Consumido",
  descartado: "Descartado",
};

export default async function EstoqueControlePage() {
  const supabase = await createClient();
  const [
    { data: notificacoesRaw },
    { data: saldoRaw },
    { data: alertasRaw },
    { data: lotesRaw },
  ] = await Promise.all([
    supabase
      .from("notificacoes")
      .select("id, tipo, titulo, corpo, entidade_tipo, entidade_id, papel_destino, canal, status, criado_em")
      .not("status", "in", "(arquivada)")
      .order("criado_em", { ascending: false }),
    supabase.from("v_estoque_saldo").select("*").order("especificacao"),
    supabase.from("v_alertas_estoque").select("*"),
    supabase
      .from("lotes_estoque")
      .select("id, codigo_lote, validade, validade_apos_abertura, quantidade_atual, status, insumos(especificacao, unidade)")
      .not("status", "in", "(consumido,descartado)")
      .order("validade", { nullsFirst: false }),
  ]);

  const [podeAceitar, podeGerir] = await Promise.all([
    temPapel("coordenador"),
    temPapel("gestor"),
  ]);

  const notificacoes = notificacoesRaw ?? [];
  const saldo = saldoRaw ?? [];
  const alertas = alertasRaw ?? [];
  const dbLotes = (lotesRaw ?? []) as unknown as LoteDbRow[];

  const hoje = new Date();
  const lotesParsed = dbLotes.map((l) => {
    const validadeEfetiva =
      l.validade && l.validade_apos_abertura
        ? l.validade <= l.validade_apos_abertura
          ? l.validade
          : l.validade_apos_abertura
        : l.validade ?? l.validade_apos_abertura;

    return {
      id: l.id,
      codigoLote: l.codigo_lote ?? "—",
      validade: validadeEfetiva ?? "—",
      quantidadeAtual: Number(l.quantidade_atual ?? 0),
      status: l.status,
      statusLabel: LOTE_STATUS[l.status] ?? l.status,
      especificacao: l.insumos?.especificacao ?? "—",
      unidade: l.insumos?.unidade ?? "",
      vencido: validadeEfetiva != null && new Date(validadeEfetiva) < hoje,
    };
  });

  return (
    <div className="min-h-dvh bg-transparent font-sans text-foreground">
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Suprimentos · Estoque e equipamentos
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
              Controle de Estoque
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Visualização ampla de insumos, rastreabilidade por lote e ações operacionais com trilha de auditoria.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground shadow-sm">
              {saldo.length} insumos monitorados
            </span>
          </div>
        </div>

        <div className="mt-6">
          <StockControlHub
            initialNotifications={notificacoes}
            saldo={saldo}
            alertas={alertas}
            lotes={lotesParsed}
            podeAceitar={podeAceitar}
            podeGerir={podeGerir}
          />
        </div>
      </main>
    </div>
  );
}
