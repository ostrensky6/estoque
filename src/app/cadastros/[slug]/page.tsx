import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  CADASTROS,
  getCadastrosOrdenados,
  type Campo,
} from "@/lib/cadastros/config";
import { CrudShell } from "@/components/cadastros/CrudShell";
import { Button } from "@/components/ui/button";
import { equipCustoDia } from "@/lib/costing/engine";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

async function comColunasCalculadas(
  slug: string,
  rows: Row[],
  diasUteisAno: number,
): Promise<Row[]> {
  switch (slug) {
    case "equipamentos":
      return rows.map((r) => ({
        ...r,
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
      }));
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

  const supabase = await createClient();
  type Tabela = "equipamentos" | "insumos" | "tecnicos" | "overhead";
  const [{ data: rows }, { data: parametros }] = await Promise.all([
    supabase.from(cfg.tabela as Tabela).select("*").order("id"),
    supabase.from("parametros").select("chave, valor").eq("chave", "dias_uteis_ano"),
  ]);
  const diasUteisAno = Number(parametros?.[0]?.valor ?? 222);

  let linhas = await comColunasCalculadas(slug, rows ?? [], diasUteisAno);

  // injeta opções dinâmicas nos selects que referenciam outra tabela
  const fontes = [...new Set(cfg.campos.map((c) => c.opcoesDe).filter(Boolean))] as string[];
  const opcoesPorFonte: Record<string, { value: string; label: string }[]> = {};
  for (const fonte of fontes) {
    const { data } = await supabase
      .from(fonte as "fornecedores")
      .select("id, nome")
      .order("nome");
    opcoesPorFonte[fonte] = (data ?? []).map((r) => ({
      value: String((r as { id: number }).id),
      label: (r as { nome: string }).nome,
    }));
  }
  const campos: Campo[] = cfg.campos.map((c) =>
    c.opcoesDe ? { ...c, opcoes: opcoesPorFonte[c.opcoesDe] ?? [] } : c,
  );

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
        <nav className="flex flex-wrap gap-2 text-xs">
          {cadastros.map((c) => (
            <Button
              key={c.slug}
              asChild
              size="sm"
              variant={c.slug === slug ? "default" : "secondary"}
            >
              <Link href={`/cadastros/${c.slug}`}>{c.titulo}</Link>
            </Button>
          ))}
        </nav>

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
