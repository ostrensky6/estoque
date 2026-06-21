import Link from "next/link";
import type { ReactNode } from "react";

import { formatDateTime } from "@/lib/formatters";
import { createClient } from "@/lib/supabase/server";
import { temPapel, usuarioAtual } from "@/lib/auth/roles";
import { LABEL_PAPEL, PERMISSOES_ORCAMENTO } from "@/lib/orcamento/governanca";

export const dynamic = "force-dynamic";

const ENTIDADES_ORCAMENTO = [
  "orcamento",
  "orcamento_projeto",
  "orcamento_final",
  "orcamento_parametros",
  "orcamento_template",
  "orcamento_catalogo",
];

const LABEL_ENTIDADE: Record<string, string> = {
  orcamento: "Laboratório",
  orcamento_projeto: "Projeto",
  orcamento_final: "Final",
  orcamento_parametros: "Parâmetros",
  orcamento_template: "Template",
  orcamento_catalogo: "Catálogo",
};

const TABELAS_ORCAMENTO = [
  "demandas_propostas",
  "orcamentos",
  "orcamento_itens",
  "orcamento_projetos",
  "orcamento_projeto_custos",
  "orcamento_projeto_analises",
  "orcamento_final_versoes",
  "parametros",
  "parametros_economicos_versoes",
  "orcamento_projeto_templates",
  "orcamento_projeto_catalogo",
];

const LABEL_ACAO: Record<string, string> = {
  insert: "Criou",
  update: "Alterou",
  delete: "Removeu",
};

const IGNORAR_DIFF = new Set(["criado_em", "atualizado_em", "status_operacional_atualizado_em"]);

type Evento = {
  id: number;
  entidade: string;
  entidade_id: number;
  de_status: string | null;
  para_status: string;
  usuario: string | null;
  observacao: string | null;
  criado_em: string;
};

type Auditoria = {
  id: number;
  tabela: string;
  registro_id: string | null;
  acao: string;
  usuario: string | null;
  valor_anterior: Record<string, unknown> | null;
  valor_novo: Record<string, unknown> | null;
  criado_em: string;
};

export default async function GovernancaOrcamentoPage() {
  const permitido = await temPapel("gestor");
  const usuario = await usuarioAtual();

  if (!permitido) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center font-sans">
        <p className="text-sm text-zinc-500">
          Acesso restrito. A governança de Orçamentos é visível para gestor ou admin.
        </p>
        <Link
          href="/orcamento"
          className="mt-4 inline-flex rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Voltar para Orçamentos
        </Link>
      </main>
    );
  }

  const supabase = await createClient();
  const [{ data: eventos }, { data: auditorias }] = await Promise.all([
    supabase
      .from("eventos_status")
      .select("id, entidade, entidade_id, de_status, para_status, usuario, observacao, criado_em")
      .in("entidade", ENTIDADES_ORCAMENTO)
      .order("criado_em", { ascending: false })
      .limit(80),
    supabase
      .from("auditoria")
      .select("id, tabela, registro_id, acao, usuario, valor_anterior, valor_novo, criado_em")
      .in("tabela", TABELAS_ORCAMENTO)
      .order("id", { ascending: false })
      .limit(80),
  ]);

  const eventosRecentes = (eventos ?? []) as Evento[];
  const auditoriaRecente = (auditorias ?? []) as Auditoria[];
  const eventosComMotivo = eventosRecentes.filter((evento) => Boolean(evento.observacao?.trim())).length;
  const acoesCriticas = eventosRecentes.filter((evento) =>
    ["cancelado", "alterado", "duplicado"].includes(evento.para_status) || evento.entidade === "orcamento_final",
  ).length;

  return (
    <div className="min-h-dvh bg-transparent font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
              Orçamentos
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">Governança e permissões</h1>
            <p className="mt-1 max-w-3xl text-sm text-zinc-500">
              Matriz de papéis, eventos sensíveis e auditoria por campo para reconstruir o caminho de cada valor final.
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <span className="block text-xs text-zinc-500">Sessão atual</span>
            <strong>{usuario?.nome || usuario?.email || "Usuário autenticado"}</strong>
            <span className="ml-2 text-zinc-500">{usuario?.papel ? LABEL_PAPEL[usuario.papel] : "Técnico"}</span>
          </div>
        </div>

        <section className="mt-6 grid gap-3 md:grid-cols-4">
          <Resumo titulo="Ações governadas" valor={PERMISSOES_ORCAMENTO.length.toLocaleString("pt-BR")} />
          <Resumo titulo="Eventos recentes" valor={eventosRecentes.length.toLocaleString("pt-BR")} />
          <Resumo titulo="Com motivo" valor={eventosComMotivo.toLocaleString("pt-BR")} />
          <Resumo titulo="Críticas" valor={acoesCriticas.toLocaleString("pt-BR")} />
        </section>

        <section className="mt-6 rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <h2 className="font-semibold">Matriz operacional</h2>
            <p className="text-sm text-zinc-500">Ações sensíveis, papel mínimo, motivo e evidência auditável.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-950">
                <tr>
                  <th className="px-4 py-3">Ação</th>
                  <th className="px-4 py-3">Papel mínimo</th>
                  <th className="px-4 py-3">Motivo</th>
                  <th className="px-4 py-3">Evidência</th>
                  <th className="px-4 py-3">Regra</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {PERMISSOES_ORCAMENTO.map((permissao) => (
                  <tr key={permissao.acao}>
                    <td className="px-4 py-3">
                      <strong>{permissao.titulo}</strong>
                      <span className="mt-1 block text-xs text-zinc-500">{permissao.descricao}</span>
                    </td>
                    <td className="px-4 py-3">{LABEL_PAPEL[permissao.papelMinimo]}</td>
                    <td className="px-4 py-3">{permissao.motivoObrigatorio ? "Obrigatório" : "Quando aplicável"}</td>
                    <td className="px-4 py-3">{permissao.eventoAuditavel}</td>
                    <td className="px-4 py-3 text-xs text-zinc-500">Bloqueio em Server Action e RLS de apoio no banco.</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <Painel titulo="Eventos sensíveis">
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {eventosRecentes.length === 0 ? (
                <p className="px-4 py-8 text-sm text-zinc-500">Nenhum evento de orçamento encontrado.</p>
              ) : (
                eventosRecentes.slice(0, 18).map((evento) => (
                  <div key={evento.id} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[8rem_1fr_10rem]">
                    <span className="text-xs text-zinc-500">{formatDateTime(evento.criado_em)}</span>
                    <span>
                      <strong>{LABEL_ENTIDADE[evento.entidade] ?? evento.entidade}</strong>
                      <span className="text-zinc-500"> #{evento.entidade_id}</span>
                      <span className="mt-1 block text-xs text-zinc-500">
                        {evento.de_status || "novo"} {"->"} {evento.para_status}
                        {evento.observacao ? ` · ${evento.observacao}` : ""}
                      </span>
                    </span>
                    <span className="text-xs text-zinc-500">{evento.usuario || "Sem usuário"}</span>
                  </div>
                ))
              )}
            </div>
          </Painel>

          <Painel titulo="Auditoria por campo">
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {auditoriaRecente.length === 0 ? (
                <p className="px-4 py-8 text-sm text-zinc-500">Nenhuma alteração auditada nas tabelas de orçamento.</p>
              ) : (
                auditoriaRecente.slice(0, 18).map((item) => (
                  <div key={item.id} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[8rem_1fr_10rem]">
                    <span className="text-xs text-zinc-500">{formatDateTime(item.criado_em)}</span>
                    <span>
                      <strong>{LABEL_ACAO[item.acao] ?? item.acao}</strong>
                      <span className="text-zinc-500"> {item.tabela} #{item.registro_id ?? "-"}</span>
                      <span className="mt-1 block text-xs text-zinc-500">
                        {resumoDiff(item.acao, item.valor_anterior, item.valor_novo)}
                      </span>
                    </span>
                    <span className="text-xs text-zinc-500">{item.usuario || "Sem usuário"}</span>
                  </div>
                ))
              )}
            </div>
          </Painel>
        </section>
      </main>
    </div>
  );
}

function Resumo({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">{titulo}</span>
      <strong className="mt-2 block text-2xl">{valor}</strong>
    </div>
  );
}

function Painel({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="font-semibold">{titulo}</h2>
      </div>
      {children}
    </section>
  );
}

function resumoDiff(
  acao: string,
  anterior: Record<string, unknown> | null,
  novo: Record<string, unknown> | null,
) {
  if (acao === "insert") return "Registro criado.";
  if (acao === "delete") return "Registro removido.";
  if (!anterior || !novo) return "Alteração sem diff disponível.";
  const mudancas = Object.keys(novo)
    .filter((campo) => !IGNORAR_DIFF.has(campo))
    .filter((campo) => JSON.stringify(anterior[campo]) !== JSON.stringify(novo[campo]))
    .map((campo) => `${campo}: ${formatarValor(anterior[campo])} -> ${formatarValor(novo[campo])}`);
  return mudancas.slice(0, 3).join(" · ") || "Sem mudança relevante.";
}

function formatarValor(valor: unknown) {
  if (valor == null || valor === "") return "-";
  const texto = String(valor);
  return texto.length > 32 ? `${texto.slice(0, 32)}...` : texto;
}
