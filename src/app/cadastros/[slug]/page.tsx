import { notFound } from "next/navigation";
import { createClientUntyped } from "@/lib/supabase/server";
import {
  CADASTROS,
  getCadastrosOrdenados,
  type Campo,
} from "@/lib/cadastros/config";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { CrudShell } from "@/components/cadastros/CrudShell";
import { CadastrosSubnav } from "@/components/cadastros/CadastrosSubnav";
import { equipCustoDia } from "@/lib/costing/engine";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

function dateOnly(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function tempoParaValidade(value: unknown) {
  const validade = dateOnly(value);
  if (!validade) return "—";

  const agora = new Date();
  const hoje = new Date(Date.UTC(
    agora.getUTCFullYear(),
    agora.getUTCMonth(),
    agora.getUTCDate(),
  ));
  const dias = Math.ceil(
    (validade.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (dias < 0) return `Vencido há ${Math.abs(dias)} dia(s)`;
  if (dias === 0) return "Vence hoje";
  if (dias < 30) return `${dias} dia(s)`;

  const meses = Math.floor(dias / 30);
  const diasRestantes = dias % 30;
  return diasRestantes > 0
    ? `${meses} mês(es) e ${diasRestantes} dia(s)`
    : `${meses} mês(es)`;
}

function addDays(dateText: unknown, days: unknown): string | null {
  const base = dateOnly(dateText);
  const n = Number(days);
  if (!base || !Number.isFinite(n) || n <= 0) return null;
  const result = new Date(base);
  result.setUTCDate(result.getUTCDate() + Math.round(n));
  return result.toISOString().slice(0, 10);
}

function dataFimVidaUtilEquipamento(row: Row): string | null {
  const anos = Number(row.vida_util_anos);
  if (!Number.isFinite(anos) || anos <= 0) return typeof row.data_validade === "string" ? row.data_validade : null;
  return addDays(row.data_aquisicao, anos * 365.2425) ?? (typeof row.data_validade === "string" ? row.data_validade : null);
}

async function comColunasCalculadas(
  slug: string,
  rows: Row[],
  diasUteisAno: number,
): Promise<Row[]> {
  switch (slug) {
    case "equipamentos":
      return rows.map((r) => {
        const dataValidade = dataFimVidaUtilEquipamento(r);
        return {
          ...r,
          data_validade: dataValidade,
          tempo_para_validade: tempoParaValidade(dataValidade),
          custo_dia: equipCustoDia(
            {
              quantidade: r.quantidade as number,
              custo_unitario: r.custo_unitario as number,
              vida_util_anos: r.vida_util_anos as number,
              percentual_manutencao_anual: r.percentual_manutencao_anual as number,
              manutencao_anual_fixa: r.manutencao_anual_fixa as number,
            },
            diasUteisAno,
          ),
        };
      });
    case "tecnicos":
      return rows.map((r) => {
        const custoHora =
          Number(r.horas_mes_base) > 0
            ? Number(r.valor_mes) / Number(r.horas_mes_base)
            : 0;
        return {
          ...r,
          custo_hora: custoHora,
          valor_hh: (custoHora * Number(r.percentual_dedicado)) / 100,
        };
      });
    case "insumos":
      return rows.map((r) => ({
        ...r,
        tempo_para_validade: tempoParaValidade(r.data_validade),
      }));
    case "overhead":
      return rows.map((r) => ({
        ...r,
        custo_hora_bancada:
          Number(r.horas_bancada_mes) > 0
            ? (Number(r.custo_mensal) / Number(r.horas_bancada_mes)) *
              (Number(r.percentual_compensada) / 100)
            : 0,
      }));
    default:
      return rows;
  }
}

export default async function CadastroPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cfg = CADASTROS[slug];
  if (!cfg) notFound();
  const cadastros = getCadastrosOrdenados();

  const supabase = await createClientUntyped();
  const [{ data: rows }, { data: parametros }] = await Promise.all([
    supabase.from(cfg.tabela).select("*").order("id"),
    supabase.from("parametros").select("chave, valor").eq("chave", "dias_uteis_ano"),
  ]);
  const diasUteisAno = Number(parametros?.[0]?.valor ?? 222);

  let linhas = await comColunasCalculadas(slug, rows ?? [], diasUteisAno);

  // injeta opções dinâmicas nos selects que referenciam outra tabela
  const fontes = [...new Set(cfg.campos.map((c) => c.opcoesDe).filter(Boolean))] as string[];
  const opcoesPorFonte: Record<string, { value: string; label: string }[]> = {};
  for (const fonte of fontes) {
    const { data } = await supabase
      .from(fonte)
      .select("id, nome")
      .order("nome");
    opcoesPorFonte[fonte] = (data ?? []).map((r) => ({
      value: String((r as unknown as { id: number }).id),
      label: String((r as unknown as { nome: string | null }).nome ?? ""),
    }));
  }
  const campos: Campo[] = cfg.campos.map((c) =>
    c.opcoesDe ? { ...c, opcoes: opcoesPorFonte[c.opcoesDe] ?? [] } : c,
  );

  if (slug === "insumos") {
    const tipos = opcoesPorFonte["tipo_insumos"] ?? [];
    const tipoNomePorId = new Map(tipos.map((o) => [o.value, o.label]));
    const tipoIdPorNome = new Map(tipos.map((o) => [o.label.trim().toLowerCase(), o.value]));
    linhas = linhas.map((r) => {
      const tipoNome =
        r.tipo_insumo_id != null
          ? tipoNomePorId.get(String(r.tipo_insumo_id))
          : undefined;
      if (r.tipo_insumo_id != null || r.nome_item == null) {
        return {
          ...r,
          tipo_insumo_nome: tipoNome ?? r.nome_item ?? "—",
        };
      }
      const tipoId = tipoIdPorNome.get(String(r.nome_item).trim().toLowerCase());
      return {
        ...r,
        tipo_insumo_id: tipoId ?? r.tipo_insumo_id,
        tipo_insumo_nome: tipoId ? tipoNomePorId.get(tipoId) ?? r.nome_item : r.nome_item,
      };
    });
  }

  // projetos: resolve o nome do cliente para a coluna da tabela
  if (slug === "projetos") {
    const clientes = opcoesPorFonte["clientes"] ?? [];
    const nomePorId = new Map(clientes.map((o) => [o.value, o.label]));
    linhas = linhas.map((r) => ({
      ...r,
      cliente_nome: r.cliente_id != null ? nomePorId.get(String(r.cliente_id)) ?? "—" : "—",
    }));
  }

  return (
    <div className="min-h-dvh bg-transparent font-sans text-foreground">
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Breadcrumbs items={[{ label: "Cadastros", href: "/cadastros" }, { label: cfg.titulo }]} />

        <CadastrosSubnav cadastros={cadastros} activeSlug={slug} />

        <h1 className="mt-6 text-2xl font-semibold tracking-tight">{cfg.titulo}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{cfg.subtitulo}</p>

        <div className="mt-6">
          <CrudShell
            slug={cfg.slug}
            singular={cfg.singular}
            rotulo={cfg.rotulo}
            colunas={cfg.colunas}
            campos={campos}
            rows={linhas}
          />
        </div>
      </main>
    </div>
  );
}
