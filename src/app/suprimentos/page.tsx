import Link from "next/link";
import { createClient, createClientUntyped } from "@/lib/supabase/server";
import { formatDate, formatNumber as fmt } from "@/lib/formatters";

export const dynamic = "force-dynamic";

type LoteOperacional = {
  id: number;
  codigo_lote: string | null;
  validade: string | null;
  validade_apos_abertura: string | null;
  quantidade_atual: number | null;
  status: string;
  insumos: { especificacao: string | null; unidade: string | null } | { especificacao: string | null; unidade: string | null }[] | null;
};

type CompraAberta = {
  id: number;
  status: string;
  data_solicitacao: string | null;
  data_prevista_entrega: string | null;
  fornecedores: { nome: string | null } | { nome: string | null }[] | null;
};

type TriagemPendente = {
  id: number;
  codigo: string | null;
  tipo_sugerido: string | null;
  status: string | null;
  criado_em: string | null;
};

type InsumoCadastro = {
  id: number;
  especificacao: string | null;
  fator_conversao: number | null;
  quantidade_embalagem: number | null;
  categoria_compra: string | null;
  unidade: string | null;
  unidade_consumo: string | null;
};

function asOne<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function validadeEfetiva(lote: Pick<LoteOperacional, "validade" | "validade_apos_abertura">) {
  if (lote.validade && lote.validade_apos_abertura) {
    return lote.validade <= lote.validade_apos_abertura ? lote.validade : lote.validade_apos_abertura;
  }
  return lote.validade ?? lote.validade_apos_abertura;
}

function pendenciasInsumo(row: InsumoCadastro) {
  const pendencias: string[] = [];
  const fator = Number(row.fator_conversao);
  const quantidadeEmbalagem = Number(row.quantidade_embalagem);

  if (!Number.isFinite(fator) || fator <= 0) pendencias.push("fator de conversao");
  if (!Number.isFinite(quantidadeEmbalagem) || quantidadeEmbalagem <= 0) pendencias.push("quantidade da embalagem");
  if (!row.categoria_compra) pendencias.push("categoria de compra");
  if (!row.unidade) pendencias.push("unidade de estoque");
  if (!row.unidade_consumo) pendencias.push("unidade de consumo");

  return pendencias;
}

function prioridadeCompra(status: string, dataPrevista: string | null) {
  if (!dataPrevista) return 0;
  const hoje = new Date().toISOString().slice(0, 10);
  return dataPrevista < hoje && status !== "recebido" && status !== "cancelado" ? 1 : 0;
}

function adicionarDias(data: string, dias: number) {
  const base = new Date(`${data}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

function StatusPill({ children, tone = "zinc" }: { children: React.ReactNode; tone?: "red" | "amber" | "blue" | "brand" | "zinc" }) {
  const cls = {
    red: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
    blue: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300",
    brand: "bg-brand-100 text-brand-800 dark:bg-brand-950/50 dark:text-brand-300",
    zinc: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
  }[tone];

  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{children}</span>;
}

function Section({
  id,
  title,
  action,
  children,
}: {
  id: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="border-t border-zinc-200 py-8 dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">{title}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 px-4 py-6 text-sm text-zinc-500 dark:border-zinc-700">
      {children}
    </div>
  );
}

export default async function SuprimentosPage() {
  const supabase = await createClient();
  const supabaseUntyped = await createClientUntyped();
  const hoje = new Date().toISOString().slice(0, 10);

  const [
    { data: previsao },
    { data: lotes },
    { data: compras },
    { data: triagens },
    { data: insumos },
  ] = await Promise.all([
    supabase.from("v_previsao_suprimentos").select("*").order("qtd_sugerida_compra", { ascending: false }),
    supabase
      .from("lotes_estoque")
      .select("id, codigo_lote, validade, validade_apos_abertura, quantidade_atual, status, insumos(especificacao, unidade)")
      .gt("quantidade_atual", 0)
      .not("status", "in", "(consumido,descartado)")
      .order("validade", { nullsFirst: false }),
    supabase
      .from("pedidos_compra")
      .select("id, status, data_solicitacao, data_prevista_entrega, fornecedores(nome)")
      .in("status", ["solicitado", "aprovado", "enviado", "em_transito"])
      .order("data_prevista_entrega", { ascending: true, nullsFirst: false }),
    supabaseUntyped
      .from("cadastros_triagem")
      .select("id, codigo, tipo_sugerido, status, criado_em")
      .in("status", ["pendente", "em_analise"])
      .order("criado_em", { ascending: true })
      .limit(12),
    supabaseUntyped
      .from("insumos")
      .select("id, especificacao, fator_conversao, quantidade_embalagem, categoria_compra, unidade, unidade_consumo")
      .order("especificacao"),
  ]);

  const limiteVencimento = adicionarDias(hoje, 30);
  const previsoes = previsao ?? [];
  const rupturas = previsoes
    .filter((item) => Number(item.disponivel ?? 0) <= 0)
    .slice(0, 8);
  const abaixoReposicao = previsoes
    .filter((item) => {
      const disponivel = Number(item.disponivel ?? 0);
      const ponto = Number(item.ponto_reposicao_configurado ?? item.ponto_reposicao_sugerido ?? 0);
      return ponto > 0 && disponivel > 0 && disponivel <= ponto;
    })
    .slice(0, 8);
  const comprasAbertas = ((compras ?? []) as CompraAberta[])
    .map((compra) => ({
      ...compra,
      fornecedorNome: asOne(compra.fornecedores)?.nome ?? "Fornecedor nao informado",
      atrasada: prioridadeCompra(compra.status, compra.data_prevista_entrega) > 0,
    }))
    .sort((a, b) => Number(b.atrasada) - Number(a.atrasada));
  const lotesOperacionais = (lotes ?? []) as LoteOperacional[];
  const lotesVencidos = lotesOperacionais.filter((lote) => {
    const validade = validadeEfetiva(lote);
    return validade != null && validade < hoje;
  });
  const lotesVencendo = lotesOperacionais.filter((lote) => {
    const validade = validadeEfetiva(lote);
    return validade != null && validade >= hoje && validade <= limiteVencimento;
  });
  const lotesQuarentena = lotesOperacionais.filter((lote) => lote.status === "quarentena");
  const triagensPendentes = (triagens ?? []) as TriagemPendente[];
  const cadastrosPendentes = ((insumos ?? []) as InsumoCadastro[])
    .map((insumo) => ({ ...insumo, pendencias: pendenciasInsumo(insumo) }))
    .filter((insumo) => insumo.pendencias.length > 0)
    .slice(0, 10);

  const excecoesHoje = [
    ...rupturas.map((item) => ({
      key: `ruptura-${item.insumo_id}`,
      title: item.especificacao ?? `Insumo #${item.insumo_id}`,
      meta: `disponivel ${fmt(item.disponivel)} ${item.unidade ?? ""}`,
      href: "/compras",
      tone: "red" as const,
      label: "Ruptura",
    })),
    ...comprasAbertas.filter((item) => item.atrasada).map((item) => ({
      key: `compra-${item.id}`,
      title: `Pedido #${item.id}`,
      meta: `${item.fornecedorNome} · previsto ${formatDate(item.data_prevista_entrega)}`,
      href: `/compras/${item.id}`,
      tone: "amber" as const,
      label: "Compra atrasada",
    })),
    ...lotesVencidos.slice(0, 6).map((lote) => ({
      key: `vencido-${lote.id}`,
      title: asOne(lote.insumos)?.especificacao ?? `Lote #${lote.id}`,
      meta: `lote ${lote.codigo_lote ?? lote.id} · venceu ${formatDate(validadeEfetiva(lote))}`,
      href: `/estoque/lotes/${lote.id}`,
      tone: "red" as const,
      label: "Vencido",
    })),
    ...triagensPendentes.slice(0, 4).map((triagem) => ({
      key: `triagem-${triagem.id}`,
      title: triagem.codigo ?? `Triagem #${triagem.id}`,
      meta: `${triagem.tipo_sugerido ?? "tipo indefinido"} · ${formatDate(triagem.criado_em)}`,
      href: "/scanner/triagem",
      tone: "blue" as const,
      label: "Triagem",
    })),
  ].slice(0, 12);

  const kpis = [
    { label: "Hoje", value: excecoesHoje.length, detail: "excecoes prioritarias", tone: excecoesHoje.length > 0 ? "red" : "brand" },
    { label: "Comprar", value: rupturas.length + abaixoReposicao.length, detail: "ruptura ou abaixo do ponto", tone: rupturas.length > 0 ? "red" : "amber" },
    { label: "Receber", value: comprasAbertas.length, detail: "compras abertas", tone: comprasAbertas.some((c) => c.atrasada) ? "amber" : "blue" },
    { label: "Pendencias", value: triagensPendentes.length + cadastrosPendentes.length, detail: "triagem ou cadastro", tone: "blue" },
  ];

  return (
    <div className="min-h-dvh bg-transparent font-sans text-slate-900 dark:text-slate-100">
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Suprimentos</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
              Central de exceções: estoque, compras, inventário e cadastros pendentes em uma fila de decisão.
              Esta tela só lê dados e aponta para os fluxos existentes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link href="#hoje" className="rounded-md border border-zinc-200 px-3 py-1.5 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">Hoje</Link>
            <Link href="#receber" className="rounded-md border border-zinc-200 px-3 py-1.5 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">Receber</Link>
            <Link href="#comprar" className="rounded-md border border-zinc-200 px-3 py-1.5 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">Comprar</Link>
            <Link href="#inventariar" className="rounded-md border border-zinc-200 px-3 py-1.5 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">Inventariar</Link>
            <Link href="#pendencias" className="rounded-md border border-zinc-200 px-3 py-1.5 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">Pendencias</Link>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between gap-3">
                <StatusPill tone={kpi.tone as "red" | "amber" | "blue" | "brand"}>{kpi.label}</StatusPill>
                <span className="text-2xl font-semibold tabular-nums">{kpi.value}</span>
              </div>
              <p className="mt-2 text-xs text-zinc-500">{kpi.detail}</p>
            </div>
          ))}
        </div>

        <Section id="hoje" title="Hoje" action={<Link href="/estoque" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">Abrir estoque</Link>}>
          {excecoesHoje.length > 0 ? (
            <div className="grid gap-2 md:grid-cols-2">
              {excecoesHoje.map((item) => (
                <Link key={item.key} href={item.href} className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm hover:border-brand-300 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{item.title}</span>
                    <StatusPill tone={item.tone}>{item.label}</StatusPill>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">{item.meta}</p>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState>Nenhuma exceção prioritária para hoje.</EmptyState>
          )}
        </Section>

        <Section id="receber" title="Receber" action={<Link href="/compras" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">Abrir compras</Link>}>
          {comprasAbertas.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <table className="w-full text-sm">
                <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                  <tr>
                    <th className="px-4 py-3 text-left">Pedido</th>
                    <th className="px-4 py-3 text-left">Fornecedor</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Previsao</th>
                    <th className="px-4 py-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {comprasAbertas.slice(0, 10).map((compra) => (
                    <tr key={compra.id}>
                      <td className="px-4 py-3 font-medium">#{compra.id}</td>
                      <td className="px-4 py-3 text-zinc-500">{compra.fornecedorNome}</td>
                      <td className="px-4 py-3"><StatusPill tone={compra.atrasada ? "amber" : "blue"}>{compra.status}</StatusPill></td>
                      <td className="px-4 py-3 text-zinc-500">{formatDate(compra.data_prevista_entrega)}</td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/compras/${compra.id}`} className="font-medium text-brand-700 hover:underline dark:text-brand-300">Detalhe</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState>Nenhuma compra aberta para receber ou acompanhar.</EmptyState>
          )}
        </Section>

        <Section id="comprar" title="Comprar" action={<Link href="/compras" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">Abrir fila de compras</Link>}>
          <div className="grid gap-3 lg:grid-cols-2">
            <div>
              <h3 className="text-sm font-medium">Ruptura prevista</h3>
              <div className="mt-2 space-y-2">
                {rupturas.length > 0 ? rupturas.map((item) => (
                  <Link key={item.insumo_id} href="/compras" className="block rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm hover:border-red-300 dark:border-red-950/50 dark:bg-red-950/20">
                    <div className="font-medium text-red-900 dark:text-red-200">{item.especificacao}</div>
                    <p className="mt-1 text-xs text-red-800/80 dark:text-red-300/80">
                      disponivel {fmt(item.disponivel)} {item.unidade ?? ""} · pedido aberto {fmt(item.qtd_pedida_aberta)}
                    </p>
                  </Link>
                )) : <EmptyState>Nenhuma ruptura prevista.</EmptyState>}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium">Abaixo do ponto de reposicao</h3>
              <div className="mt-2 space-y-2">
                {abaixoReposicao.length > 0 ? abaixoReposicao.map((item) => (
                  <Link key={item.insumo_id} href="/compras" className="block rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm hover:border-amber-300 dark:border-amber-950/50 dark:bg-amber-950/20">
                    <div className="font-medium text-amber-900 dark:text-amber-200">{item.especificacao}</div>
                    <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-200/80">
                      disp. {fmt(item.disponivel)} · ponto {fmt(item.ponto_reposicao_configurado ?? item.ponto_reposicao_sugerido)} · sugerido {fmt(item.qtd_sugerida_compra)}
                    </p>
                  </Link>
                )) : <EmptyState>Nenhum insumo abaixo do ponto.</EmptyState>}
              </div>
            </div>
          </div>
        </Section>

        <Section id="inventariar" title="Inventariar" action={<Link href="/estoque/inventario" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">Abrir inventario</Link>}>
          <div className="grid gap-3 lg:grid-cols-3">
            {[
              { title: "Lotes vencidos", rows: lotesVencidos, tone: "red" as const },
              { title: "Lotes vencendo", rows: lotesVencendo, tone: "amber" as const },
              { title: "Quarentena", rows: lotesQuarentena, tone: "blue" as const },
            ].map((grupo) => (
              <div key={grupo.title}>
                <h3 className="text-sm font-medium">{grupo.title}</h3>
                <div className="mt-2 space-y-2">
                  {grupo.rows.length > 0 ? grupo.rows.slice(0, 6).map((lote) => {
                    const insumo = asOne(lote.insumos);
                    return (
                      <Link key={lote.id} href={`/estoque/lotes/${lote.id}`} className="block rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm hover:border-brand-300 dark:border-zinc-800 dark:bg-zinc-900">
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate font-medium">{insumo?.especificacao ?? `Lote #${lote.id}`}</span>
                          <StatusPill tone={grupo.tone}>{lote.status}</StatusPill>
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">
                          {lote.codigo_lote ?? `#${lote.id}`} · validade {formatDate(validadeEfetiva(lote))} · saldo {fmt(lote.quantidade_atual)} {insumo?.unidade ?? ""}
                        </p>
                      </Link>
                    );
                  }) : <EmptyState>Nenhum item.</EmptyState>}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section id="pendencias" title="Pendências" action={<Link href="/scanner/triagem" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">Abrir triagem</Link>}>
          <div className="grid gap-3 lg:grid-cols-2">
            <div>
              <h3 className="text-sm font-medium">Triagens de código</h3>
              <div className="mt-2 space-y-2">
                {triagensPendentes.length > 0 ? triagensPendentes.map((triagem) => (
                  <Link key={triagem.id} href="/scanner/triagem" className="block rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm hover:border-brand-300 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="font-medium">{triagem.codigo ?? `Triagem #${triagem.id}`}</div>
                    <p className="mt-1 text-xs text-zinc-500">{triagem.tipo_sugerido ?? "tipo indefinido"} · {triagem.status ?? "pendente"} · {formatDate(triagem.criado_em)}</p>
                  </Link>
                )) : <EmptyState>Nenhuma triagem pendente.</EmptyState>}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium">Cadastros de insumo incompletos</h3>
              <div className="mt-2 space-y-2">
                {cadastrosPendentes.length > 0 ? cadastrosPendentes.map((insumo) => (
                  <Link key={insumo.id} href="/cadastros/insumos" className="block rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm hover:border-brand-300 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="font-medium">{insumo.especificacao ?? `Insumo #${insumo.id}`}</div>
                    <p className="mt-1 text-xs text-zinc-500">{insumo.pendencias.join(", ")}</p>
                  </Link>
                )) : <EmptyState>Nenhum cadastro incompleto pela regra atual.</EmptyState>}
              </div>
            </div>
          </div>
        </Section>
      </main>
    </div>
  );
}
