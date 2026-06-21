import Link from "next/link";

import { ConfirmActionButton } from "@/components/common/ConfirmActionButton";
import {
  arquivarCatalogoProjetoItem,
  criarProjetoDeTemplate,
  duplicarTemplateProjeto,
  excluirTemplate,
} from "@/lib/actions/orcamento-projetos";
import { formatCurrency as brl, formatDate } from "@/lib/formatters";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

type SearchParams = {
  origem?: string;
  rubrica?: string;
  status?: string;
  busca?: string;
};

type TemplateProjeto = {
  id: number;
  nome: string;
  descricao: string | null;
  itens: Json;
  parametros: Json;
  origem: string;
  criado_em: string;
};

type CatalogoItem = {
  id: string;
  rubrica: string;
  descricao: string;
  unidade: string | null;
  preco_unitario: number;
  categoria: string | null;
  origem: string;
  ativo: boolean;
  valid_from: string | null;
};

type ProjetoOpcao = {
  id: number;
  nome: string;
};

const rubricas = ["PE", "MC", "MP", "ST", "VD", "OU"] as const;

export default async function OrcamentoModelosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const filtros = await searchParams;
  const supabase = await createClient();
  const [{ data: templates }, { data: catalogo }, { data: projetos }] = await Promise.all([
    supabase
      .from("orcamento_projeto_templates")
      .select("id, nome, descricao, itens, parametros, origem, criado_em")
      .order("criado_em", { ascending: false }),
    supabase
      .from("orcamento_projeto_catalogo")
      .select("id, rubrica, descricao, unidade, preco_unitario, categoria, origem, ativo, valid_from")
      .order("rubrica")
      .order("descricao")
      .limit(300),
    supabase.from("projetos").select("id, nome").order("nome").limit(100),
  ]);

  const templatesFiltrados = filtrarTemplates((templates ?? []) as TemplateProjeto[], filtros);
  const catalogoFiltrado = filtrarCatalogo((catalogo ?? []) as CatalogoItem[], filtros);
  const templatesAtivos = ((templates ?? []) as TemplateProjeto[]).filter((item) => !isArquivado(item)).length;
  const templatesArquivados = ((templates ?? []) as TemplateProjeto[]).filter(isArquivado).length;
  const itensAtivos = ((catalogo ?? []) as CatalogoItem[]).filter((item) => item.ativo).length;
  const importados = ((catalogo ?? []) as CatalogoItem[]).filter((item) => item.origem === "orcamento_projetos_antigo").length;
  const parametrosPadrao = resumirParametrosPadrao((templates ?? []) as TemplateProjeto[]);

  return (
    <div className="min-h-dvh bg-transparent font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link href="/orcamento" className="text-xs text-zinc-500 hover:underline">Orçamentos</Link>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Modelos e catálogo</h1>
            <p className="mt-1 max-w-3xl text-sm text-zinc-500">
              Área operacional para templates de projeto, catálogo institucional, parâmetros padrão e origem importada preservada.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/orcamento/projetos" className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-500">
              Usar em orçamento
            </Link>
            <Link href="/orcamento" className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
              Orçamentos
            </Link>
          </div>
        </div>

        <nav className="mt-5 flex gap-2 overflow-x-auto text-sm">
          {[
            ["#templates", "Templates"],
            ["#catalogo", "Catálogo institucional"],
            ["#parametros", "Parâmetros padrão"],
            ["#importados", "Origem importada"],
          ].map(([href, label]) => (
            <a key={href} href={href} className="rounded-md border border-zinc-200 px-3 py-2 font-medium hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-800">
              {label}
            </a>
          ))}
        </nav>

        <section className="mt-6 grid gap-3 sm:grid-cols-4">
          <Resumo titulo="Templates ativos" valor={templatesAtivos.toLocaleString("pt-BR")} />
          <Resumo titulo="Templates arquivados" valor={templatesArquivados.toLocaleString("pt-BR")} />
          <Resumo titulo="Itens ativos" valor={itensAtivos.toLocaleString("pt-BR")} />
          <Resumo titulo="Origem importada" valor={importados.toLocaleString("pt-BR")} />
        </section>

        <form className="mt-6 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="grid gap-3 md:grid-cols-[1fr_10rem_12rem_10rem_auto_auto] md:items-end">
            <CampoFiltro label="Busca">
              <input name="busca" defaultValue={filtros.busca ?? ""} className={inputCls} />
            </CampoFiltro>
            <CampoFiltro label="Rubrica">
              <select name="rubrica" defaultValue={filtros.rubrica ?? ""} className={inputCls}>
                <option value="">Todas</option>
                {rubricas.map((rubrica) => <option key={rubrica} value={rubrica}>{rubrica}</option>)}
              </select>
            </CampoFiltro>
            <CampoFiltro label="Origem">
              <select name="origem" defaultValue={filtros.origem ?? ""} className={inputCls}>
                <option value="">Todas</option>
                <option value="kontrol">Kontrol</option>
                <option value="orcamento_projetos_antigo">Importada</option>
              </select>
            </CampoFiltro>
            <CampoFiltro label="Status">
              <select name="status" defaultValue={filtros.status ?? ""} className={inputCls}>
                <option value="">Todos</option>
                <option value="ativo">Ativo</option>
                <option value="arquivado">Arquivado</option>
                <option value="inativo">Inativo</option>
              </select>
            </CampoFiltro>
            <button className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-500">Filtrar</button>
            <Link href="/orcamento/modelos" className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-center hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
              Limpar
            </Link>
          </div>
        </form>

        <section id="templates" className="mt-6 scroll-mt-8 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Templates de projeto</h2>
              <p className="mt-1 text-xs text-zinc-500">Use, duplique ou arquive estruturas completas de rubricas e parâmetros.</p>
            </div>
            <Link href="/orcamento/projetos" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">Criar a partir de template</Link>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">Descrição</th>
                  <th className="px-3 py-2">Origem</th>
                  <th className="px-3 py-2 text-right">Itens</th>
                  <th className="px-3 py-2">Parâmetros</th>
                  <th className="px-3 py-2">Criado em</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {templatesFiltrados.map((template) => (
                  <tr key={template.id}>
                    <td className="px-3 py-3 font-medium">{nomeVisivel(template.nome)}</td>
                    <td className="px-3 py-3 text-zinc-500">{template.descricao ?? "—"}</td>
                    <td className="px-3 py-3"><Origem origem={template.origem} /></td>
                    <td className="px-3 py-3 text-right tabular-nums">{contarItens(template.itens)}</td>
                    <td className="px-3 py-3 text-xs text-zinc-500">{resumoParametros(template.parametros)}</td>
                    <td className="px-3 py-3 text-zinc-500">{formatDate(template.criado_em)}</td>
                    <td className="px-3 py-3">{isArquivado(template) ? <Badge tom="zinc">Arquivado</Badge> : <Badge tom="brand">Ativo</Badge>}</td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-2">
                        {!isArquivado(template) && (
                          <form action={criarProjetoDeTemplate} className="flex items-center gap-1">
                            <input type="hidden" name="template_id" value={template.id} />
                            <select name="projeto_id" defaultValue="" className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950">
                              <option value="">Sem projeto</option>
                              {((projetos ?? []) as ProjetoOpcao[]).map((projeto) => (
                                <option key={projeto.id} value={projeto.id}>{projeto.nome}</option>
                              ))}
                            </select>
                            <button className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300">Usar</button>
                          </form>
                        )}
                        <form action={duplicarTemplateProjeto}>
                          <input type="hidden" name="template_id" value={template.id} />
                          <button className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300">Duplicar</button>
                        </form>
                        {!isArquivado(template) && (
                          <ConfirmActionButton
                            action={excluirTemplate}
                            fields={{ template_id: template.id }}
                            trigger="Arquivar"
                            titulo="Arquivar template"
                            mensagem={`Arquivar o template ${nomeVisivel(template.nome)}? Ele deixa de ser oferecido como ativo, mas o registro permanece no histórico.`}
                            confirmLabel="Arquivar"
                            triggerClassName="text-xs font-medium text-red-600 hover:underline"
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {templatesFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-zinc-400">Nenhum template encontrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section id="catalogo" className="mt-6 scroll-mt-8 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold">Catálogo institucional de custos</h2>
          <p className="mt-1 text-xs text-zinc-500">Itens reutilizáveis por rubrica, com origem auditável e arquivamento sem remoção.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Código</th>
                  <th className="px-3 py-2">Rubrica</th>
                  <th className="px-3 py-2">Categoria institucional</th>
                  <th className="px-3 py-2">Descrição</th>
                  <th className="px-3 py-2">Unidade</th>
                  <th className="px-3 py-2 text-right">Custo padrão</th>
                  <th className="px-3 py-2">Origem</th>
                  <th className="px-3 py-2">Válido desde</th>
                  <th className="px-3 py-2">Ativo</th>
                  <th className="px-3 py-2 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {catalogoFiltrado.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-3 font-medium">{item.id}</td>
                    <td className="px-3 py-3"><Badge>{item.rubrica}</Badge></td>
                    <td className="px-3 py-3">{item.categoria ?? "—"}</td>
                    <td className="px-3 py-3">{item.descricao}</td>
                    <td className="px-3 py-3">{item.unidade ?? "un"}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{brl(Number(item.preco_unitario ?? 0))}</td>
                    <td className="px-3 py-3"><Origem origem={item.origem} /></td>
                    <td className="px-3 py-3 text-zinc-500">{formatDate(item.valid_from)}</td>
                    <td className="px-3 py-3">{item.ativo ? <Badge tom="brand">Sim</Badge> : <Badge tom="zinc">Não</Badge>}</td>
                    <td className="px-3 py-3 text-right">
                      {item.ativo ? (
                        <ConfirmActionButton
                          action={arquivarCatalogoProjetoItem}
                          fields={{ catalogo_item_id: item.id }}
                          trigger="Arquivar"
                          titulo="Arquivar item do catálogo"
                          mensagem={`Arquivar ${item.descricao}? O item deixa de ser sugerido para novos orçamentos, sem apagar histórico.`}
                          confirmLabel="Arquivar"
                          triggerClassName="text-xs font-medium text-red-600 hover:underline"
                        />
                      ) : (
                        <span className="text-xs text-zinc-400">Arquivado</span>
                      )}
                    </td>
                  </tr>
                ))}
                {catalogoFiltrado.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center text-zinc-400">Nenhum item de catálogo encontrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section id="parametros" className="mt-6 scroll-mt-8 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold">Parâmetros padrão em templates</h2>
          <p className="mt-1 text-xs text-zinc-500">Leitura consolidada dos parâmetros salvos nos modelos reutilizáveis.</p>
          <div className="mt-3 grid gap-3 md:grid-cols-6">
            {parametrosPadrao.map((item) => (
              <Resumo key={item.label} titulo={item.label} valor={item.valor} />
            ))}
          </div>
        </section>

        <section id="importados" className="mt-6 scroll-mt-8 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold">Importados do app antigo</h2>
          <p className="mt-1 text-xs text-zinc-500">
            A origem antiga aparece como procedência auditável. O uso operacional continua sendo catálogo institucional.
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-4">
            {rubricas.map((rubrica) => {
              const itens = ((catalogo ?? []) as CatalogoItem[]).filter((item) => item.origem === "orcamento_projetos_antigo" && item.rubrica === rubrica);
              return <Resumo key={rubrica} titulo={`${rubrica} importados`} valor={itens.length.toLocaleString("pt-BR")} />;
            })}
          </div>
        </section>
      </main>
    </div>
  );
}

const inputCls =
  "mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";

function filtrarTemplates(templates: TemplateProjeto[], filtros: SearchParams) {
  const busca = (filtros.busca ?? "").toLocaleLowerCase("pt-BR");
  return templates.filter((template) => {
    const texto = `${template.nome} ${template.descricao ?? ""}`.toLocaleLowerCase("pt-BR");
    return (
      (!busca || texto.includes(busca)) &&
      (!filtros.origem || template.origem === filtros.origem) &&
      (!filtros.status ||
        (filtros.status === "arquivado" ? isArquivado(template) : filtros.status === "ativo" ? !isArquivado(template) : true))
    );
  });
}

function filtrarCatalogo(catalogo: CatalogoItem[], filtros: SearchParams) {
  const busca = (filtros.busca ?? "").toLocaleLowerCase("pt-BR");
  return catalogo.filter((item) => {
    const texto = `${item.id} ${item.descricao} ${item.categoria ?? ""}`.toLocaleLowerCase("pt-BR");
    return (
      (!busca || texto.includes(busca)) &&
      (!filtros.rubrica || item.rubrica === filtros.rubrica) &&
      (!filtros.origem || item.origem === filtros.origem) &&
      (!filtros.status ||
        (filtros.status === "ativo" ? item.ativo : filtros.status === "inativo" || filtros.status === "arquivado" ? !item.ativo : true))
    );
  });
}

function isArquivado(template: TemplateProjeto) {
  return template.nome.startsWith("[ARQUIVADO]") || Boolean(template.descricao?.includes("Arquivado em "));
}

function nomeVisivel(nome: string) {
  return nome.replace(/^\[ARQUIVADO\]\s*/i, "");
}

function contarItens(itens: Json) {
  return Array.isArray(itens) ? itens.length : 0;
}

function resumoParametros(parametros: Json) {
  if (!parametros || typeof parametros !== "object" || Array.isArray(parametros)) return "sem parâmetros";
  const record = parametros as Record<string, unknown>;
  const pares = [
    ["meses", record.project_months],
    ["impostos", record.impostos_legacy],
    ["incubação", record.incubacao],
    ["reserva", record.reserva],
    ["invest.", record.investimentos],
    ["lucro", record.lucro],
  ].filter(([, value]) => value !== undefined && value !== null);
  return pares.length ? pares.map(([label, value]) => `${label}: ${String(value)}`).join(" · ") : "sem parâmetros";
}

function resumirParametrosPadrao(templates: TemplateProjeto[]) {
  const ativos = templates.filter((template) => !isArquivado(template));
  const media = (key: string) => {
    const valores = ativos
      .map((template) => jsonRecord(template.parametros))
      .filter((parametros) => parametros !== null)
      .map((parametros) => Number(parametros[key] ?? 0));
    if (!valores.length) return "—";
    return (valores.reduce((total, valor) => total + valor, 0) / valores.length).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  };
  return [
    { label: "Meses", valor: media("project_months") },
    { label: "Impostos", valor: `${media("impostos_legacy")}%` },
    { label: "Incubação", valor: `${media("incubacao")}%` },
    { label: "Reserva", valor: `${media("reserva")}%` },
    { label: "Investimentos", valor: `${media("investimentos")}%` },
    { label: "Lucro", valor: `${media("lucro")}%` },
  ];
}

function jsonRecord(value: Json): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function CampoFiltro({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-zinc-500">
      {label}
      {children}
    </label>
  );
}

function Origem({ origem }: { origem: string | null }) {
  if (origem === "orcamento_projetos_antigo") return <Badge tom="amber">Importada</Badge>;
  return <Badge tom="brand">Kontrol</Badge>;
}

function Badge({ children, tom = "zinc" }: { children: React.ReactNode; tom?: "brand" | "amber" | "zinc" }) {
  const cls =
    tom === "brand"
      ? "bg-brand-100 text-brand-800 dark:bg-brand-950/50 dark:text-brand-300"
      : tom === "amber"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{children}</span>;
}

function Resumo({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-medium text-zinc-500">{titulo}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{valor}</p>
    </div>
  );
}
