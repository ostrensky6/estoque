import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CADASTROS } from "@/lib/cadastros/config";
import { CrudShell } from "@/components/cadastros/CrudShell";
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

  const supabase = await createClient();
  type Tabela = "equipamentos" | "insumos" | "tecnicos" | "overhead";
  const [{ data: rows }, { data: parametros }] = await Promise.all([
    supabase.from(cfg.tabela as Tabela).select("*").order("id"),
    supabase.from("parametros").select("chave, valor").eq("chave", "dias_uteis_ano"),
  ]);
  const diasUteisAno = Number(parametros?.[0]?.valor ?? 222);

  const linhas = await comColunasCalculadas(slug, rows ?? [], diasUteisAno);

  return (
    <div className="min-h-dvh bg-zinc-50 font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto max-w-6xl px-6 py-10">
        <nav className="flex flex-wrap gap-2 text-xs">
          {Object.values(CADASTROS).map((c) => (
            <Link
              key={c.slug}
              href={`/cadastros/${c.slug}`}
              className={`rounded-full px-3 py-1 ${
                c.slug === slug
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              {c.titulo}
            </Link>
          ))}
        </nav>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight">{cfg.titulo}</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">{cfg.subtitulo}</p>

        <div className="mt-6">
          <CrudShell
            slug={cfg.slug}
            singular={cfg.singular}
            rotulo={cfg.rotulo}
            colunas={cfg.colunas}
            campos={cfg.campos}
            rows={linhas}
          />
        </div>
      </main>
    </div>
  );
}
