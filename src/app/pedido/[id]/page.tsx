import Link from "next/link";
import { notFound } from "next/navigation";
import { createClientUntyped } from "@/lib/supabase/server";
import { temPapel } from "@/lib/auth/roles";
import {
  adicionarAnexoPedidoInterno,
  adicionarItemPedidoInterno,
  registrarAnaliseAdministrativa,
  registrarComunicacaoPedidoInterno,
  removerAnexoPedidoInterno,
  removerItemPedidoInterno,
} from "@/lib/actions/pedidos-internos";
import { PedidoInternoAcoes } from "@/components/pedido/PedidoInternoAcoes";
import { PedidoInternoCabecalhoAcoes } from "@/components/pedido/PedidoInternoCabecalhoAcoes";
import { ItemRecebimentoCell } from "@/components/pedido/ItemRecebimentoCell";
import { PedidoItemEditar } from "@/components/pedido/PedidoItemEditar";
import { Timeline } from "@/components/common/Timeline";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { listarEventos } from "@/lib/actions/eventos";
import {
  PEDIDO_INTERNO_ETAPA_RECEBIDA,
  PEDIDO_INTERNO_FLUXO,
  pedidoInternoNumero,
  pedidoInternoStatus,
  podeMarcarRecebida,
  type PedidoInternoStatus,
} from "@/lib/pedido/status";
import { formatCurrency as brl, formatDate, formatDateTime, formatNumber as fmt } from "@/lib/formatters";

export const dynamic = "force-dynamic";

type PedidoInternoItem = {
  id: number;
  tipo: string;
  especificacao: string;
  modelo: string | null;
  volume: string | null;
  quantidade: number;
  unidade: string | null;
  orcamento_previo: number | null;
  fornecedor_sugerido: string | null;
  observacao: string | null;
  insumo_id: number | null;
  recebido_em: string | null;
  recebido_por: string | null;
  lote_id: number | null;
  insumos: { especificacao: string | null; unidade: string | null } | null;
};

type PedidoInternoAprovacao = {
  id: number;
  etapa: string;
  decisao: string;
  responsavel: string | null;
  papel: string | null;
  comentario: string | null;
  status_origem: string | null;
  status_destino: string | null;
  criado_em: string;
};

type PedidoInternoAnexo = {
  id: number;
  etapa: string | null;
  tipo: string;
  titulo: string;
  url: string | null;
  arquivo_nome?: string | null;
  storage_bucket?: string | null;
  storage_path?: string | null;
  mime_type?: string | null;
  tamanho_bytes?: number | null;
  hash_sha256?: string | null;
  observacao: string | null;
  usuario: string | null;
  criado_em: string;
};

type PedidoInternoComunicacao = {
  id: number;
  etapa: string | null;
  tipo: string;
  remetente: string | null;
  destinatarios: string | null;
  assunto: string | null;
  referencia: string | null;
  observacao: string | null;
  usuario: string | null;
  criado_em: string;
};

export default async function PedidoInternoDetalhe({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pedidoId = Number(id);
  const supabase = await createClientUntyped();

  const { data: pedido } = await supabase
    .from("pedidos_internos")
    .select("*, projetos(nome), pedidos_compra(id, status)")
    .eq("id", pedidoId)
    .single();
  if (!pedido) notFound();

  const [
    { data: itens },
    { data: insumos },
    { data: projetos },
    { data: aprovacoes },
    { data: anexos },
    { data: comunicacoes },
    eventos,
    podeGerir,
  ] = await Promise.all([
    supabase
      .from("pedidos_internos_itens")
      .select("id, tipo, especificacao, modelo, volume, quantidade, unidade, orcamento_previo, fornecedor_sugerido, observacao, insumo_id, recebido_em, recebido_por, lote_id, insumos(especificacao, unidade)")
      .eq("pedido_interno_id", pedidoId)
      .order("id"),
    supabase.from("insumos").select("id, especificacao, unidade").order("especificacao"),
    supabase.from("projetos").select("id, nome, coordenador").order("nome"),
    supabase
      .from("pedidos_internos_aprovacoes")
      .select("id, etapa, decisao, responsavel, papel, comentario, status_origem, status_destino, criado_em")
      .eq("pedido_interno_id", pedidoId)
      .order("criado_em", { ascending: false }),
    supabase
      .from("pedidos_internos_anexos")
      .select("id, etapa, tipo, titulo, url, observacao, usuario, criado_em")
      .eq("pedido_interno_id", pedidoId)
      .order("criado_em", { ascending: false }),
    supabase
      .from("pedidos_internos_comunicacoes")
      .select("id, etapa, tipo, remetente, destinatarios, assunto, referencia, observacao, usuario, criado_em")
      .eq("pedido_interno_id", pedidoId)
      .order("criado_em", { ascending: false }),
    listarEventos("pedido_interno", pedidoId),
    temPapel("coordenador"),
  ]);

  const pedidoStatus = pedido.status as PedidoInternoStatus;
  const statusMeta = pedidoInternoStatus(pedidoStatus);
  const projetoRow = pedido.projetos as {
    nome: string | null;
    coordenador?: string | null;
    coordenador_nome?: string | null;
    coordenador_email?: string | null;
  } | null;
  const projeto = projetoRow?.nome ?? "—";
  const compraFormal = pedido.pedidos_compra as { id: number; status: string } | null;
  const coordenadorProjeto =
    pedido.coordenador_projeto_nome ??
    pedido.coordenador_projeto_email ??
    projetoRow?.coordenador_nome ??
    projetoRow?.coordenador ??
    projetoRow?.coordenador_email ??
    "—";
  const modalidadeLabel: Record<string, string> = {
    compra_direta: "Compra direta",
    fundacao: "Fundação",
    universidade: "Universidade",
    outra: "Outra",
  };
  const linhas = ((itens ?? []) as unknown as PedidoInternoItem[]) ?? [];
  const aprovacaoRows = ((aprovacoes ?? []) as unknown as PedidoInternoAprovacao[]) ?? [];
  const anexoRows = ((anexos ?? []) as unknown as PedidoInternoAnexo[]) ?? [];
  const comunicacaoRows = ((comunicacoes ?? []) as unknown as PedidoInternoComunicacao[]) ?? [];
  const total = linhas.reduce(
    (acc, item) => acc + Number(item.quantidade ?? 0) * Number(item.orcamento_previo ?? 0),
    0,
  );
  const editavel = ["rascunho", "ajuste_solicitante", "ajuste_compras"].includes(pedido.status);
  const itensTerminal = ["cancelado", "compra_concluida"].includes(pedido.status);
  // Itens podem ser editados/removidos em rascunho/ajuste (qualquer técnico) ou em qualquer
  // etapa não terminal por coordenador+.
  const podeEditarItens = !itensTerminal && (editavel || podeGerir);
  const inputCls = "rounded-md border border-input bg-card px-3 py-2 text-sm";

  // Etapas: verde = superada, amarelo = em andamento, branco = futura.
  // Etapa 11 (recebimento) é derivada: o pedido está recebido quando tem itens e
  // todos foram recebidos individualmente.
  const recebido = linhas.length > 0 && linhas.every((item) => item.recebido_em);
  const aguardandoChegada = podeMarcarRecebida(pedidoStatus);
  // O fluxo de 10 etapas está concluído quando a compra avançou além da aprovação ou já foi recebida.
  const fluxoCompleto =
    recebido ||
    ["compra_fechada", "encaminhado_instituicao", "aguardando_pagamento_nf", "compra_concluida"].includes(pedidoStatus);
  // Etapa em andamento dentro do fluxo de 10 etapas (status de ajuste retornam à etapa equivalente).
  let etapaAtiva = PEDIDO_INTERNO_FLUXO.indexOf(pedidoStatus);
  if (etapaAtiva < 0 && pedidoStatus === "ajuste_solicitante") etapaAtiva = PEDIDO_INTERNO_FLUXO.indexOf("em_validacao");
  if (etapaAtiva < 0 && pedidoStatus === "ajuste_compras") etapaAtiva = PEDIDO_INTERNO_FLUXO.indexOf("analise_administrativa");
  const classeEtapa = (estado: "concluido" | "ativo" | "futuro") =>
    estado === "concluido"
      ? "border-leaf-300 bg-leaf-50 dark:border-leaf-900 dark:bg-leaf-950/30"
      : estado === "ativo"
        ? "border-warning-strong/30 bg-warning-soft"
        : "border-border bg-card";
  const estadoRecebida: "concluido" | "ativo" | "futuro" = recebido
    ? "concluido"
    : aguardandoChegada
      ? "ativo"
      : "futuro";
  const pendencias = [
    { label: "Projeto vinculado", ok: Boolean(pedido.projeto_id) },
    { label: "Justificativa preenchida", ok: Boolean(pedido.justificativa) },
    { label: "Fonte de recurso provável", ok: Boolean(pedido.fonte_recurso) },
    { label: "Urgência definida", ok: Boolean(pedido.urgencia) },
    { label: "Ao menos um item", ok: linhas.length > 0 },
    {
      label: "Itens com especificação, quantidade e unidade",
      ok: linhas.length > 0 && linhas.every((item) => item.especificacao && Number(item.quantidade) > 0 && item.unidade),
    },
  ];
  const temDocumentoCotacao = anexoRows.some((anexo) => ["orcamento_previo", "proposta", "print", "email"].includes(anexo.tipo));
  const temDocumentoFiscal = anexoRows.some((anexo) => ["nota_fiscal", "boleto", "comprovante"].includes(anexo.tipo));

  return (
    <div className="min-h-dvh bg-transparent font-sans text-foreground">
      <main className="app-page-container">
        <Breadcrumbs items={[{ label: "Pedidos", href: "/pedido" }, { label: pedidoInternoNumero(pedido.id) }]} />
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs font-medium text-muted-foreground/80">{pedidoInternoNumero(pedido.id)}</p>
            <h1 className="text-xl font-semibold tracking-tight">{pedido.titulo}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Projeto: {projeto} · Solicitante: {pedido.solicitante ?? "—"}
              {pedido.data_necessidade ? ` · Necessidade: ${formatDate(pedido.data_necessidade)}` : ""}
              {pedido.urgencia ? ` · Urgência: ${pedido.urgencia}` : ""}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Tipo: {String(pedido.tipo_demanda ?? "laboratorio").replaceAll("_", "/")} · Coordenador: {coordenadorProjeto}
              {pedido.aprovador_coordenador_diferente ? " · aprovado por substituto" : ""}
              {pedido.modalidade_compra ? ` · Modalidade: ${modalidadeLabel[pedido.modalidade_compra] ?? pedido.modalidade_compra}` : ""}
            </p>
            {pedido.justificativa && (
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{pedido.justificativa}</p>
            )}
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <span className={`rounded-md px-3 py-1 text-xs font-medium ${statusMeta.className}`}>
              {statusMeta.label}
            </span>
            <span className="text-xs text-muted-foreground">Atualizado {formatDateTime(pedido.atualizado_em)}</span>
            <PedidoInternoCabecalhoAcoes
              pedidoId={pedidoId}
              numero={pedidoInternoNumero(pedido.id)}
              titulo={pedido.titulo}
              projetoId={pedido.projeto_id}
              dataNecessidade={pedido.data_necessidade}
              urgencia={pedido.urgencia}
              tipoDemanda={pedido.tipo_demanda}
              fonteRecurso={pedido.fonte_recurso}
              justificativa={pedido.justificativa}
              projetos={projetos ?? []}
              podeExcluir={podeGerir}
            />
          </div>
        </div>

        <section className="mt-6 rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {PEDIDO_INTERNO_FLUXO.map((status, index) => {
              const meta = pedidoInternoStatus(status);
              const estado: "concluido" | "ativo" | "futuro" =
                fluxoCompleto || (etapaAtiva >= 0 && index < etapaAtiva)
                  ? "concluido"
                  : etapaAtiva === index
                    ? "ativo"
                    : "futuro";
              return (
                <div key={status} className={`min-h-20 rounded-lg border p-3 ${classeEtapa(estado)}`}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80">Etapa {index + 1}</p>
                  <p className="mt-1 text-sm font-medium">{meta.label}</p>
                  <p className="mt-1 text-xs leading-4 text-muted-foreground">{meta.etapa}</p>
                </div>
              );
            })}
            <div className={`min-h-20 rounded-lg border p-3 ${classeEtapa(estadoRecebida)}`}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80">
                Etapa {PEDIDO_INTERNO_FLUXO.length + 1}
              </p>
              <p className="mt-1 text-sm font-medium">{PEDIDO_INTERNO_ETAPA_RECEBIDA.label}</p>
              <p className="mt-1 text-xs leading-4 text-muted-foreground">{PEDIDO_INTERNO_ETAPA_RECEBIDA.etapa}</p>
            </div>
          </div>
          {pedido.status === "ajuste_solicitante" && (
            <p className="mt-3 text-sm text-warning-strong">
              Compra não aprovada na validação. Revise os itens com o solicitante e reenvie.
            </p>
          )}
          {pedido.status === "ajuste_compras" && (
            <p className="mt-3 text-sm text-danger-strong">
              Compra não aprovada na análise administrativa. Revise com compras e/ou solicitante.
            </p>
          )}
          <div className="mt-4 grid gap-2 border-t border-border/70 pt-4 md:grid-cols-2">
            {pendencias.map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-xs">
                <span className={`h-2.5 w-2.5 rounded-full ${item.ok ? "bg-brand-500" : "bg-warning-strong"}`} />
                <span className={item.ok ? "text-muted-foreground" : "font-medium text-warning-strong"}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Materiais e serviços</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Inclua especificação, modelo, volume, quantidade e orçamento prévio.
              </p>
            </div>
            <p className="text-sm text-muted-foreground">Total prévio: <b>{brl(total)}</b></p>
          </div>

          <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-transparent text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Item</th>
                  <th className="px-4 py-3 text-left">Modelo/volume</th>
                  <th className="px-4 py-3 text-right">Qtd</th>
                  <th className="px-4 py-3 text-right">Prévio un.</th>
                  <th className="px-4 py-3 text-left">Fornecedor</th>
                  <th className="px-4 py-3 text-left">Recebimento</th>
                  {podeEditarItens && <th className="px-4 py-3 text-right">Ação</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {linhas.map((item) => (
                  <tr key={item.id}>
                    <td className="max-w-sm px-4 py-2.5">
                      <p className="font-medium">{item.especificacao}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.tipo === "servico" ? "Serviço" : "Material"}
                        {item.insumos?.especificacao ? ` · vinculado: ${item.insumos.especificacao}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {[item.modelo, item.volume].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {fmt(item.quantidade)} {item.unidade ?? item.insumos?.unidade ?? ""}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{brl(item.orcamento_previo)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{item.fornecedor_sugerido ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <ItemRecebimentoCell
                        item={{
                          id: item.id,
                          pedidoId,
                          especificacao: item.especificacao,
                          quantidade: Number(item.quantidade),
                          unidade: item.unidade ?? item.insumos?.unidade ?? null,
                          insumoId: item.insumo_id,
                          fornecedorSugerido: item.fornecedor_sugerido,
                          orcamentoPrevio: item.orcamento_previo,
                        }}
                        insumos={insumos ?? []}
                        podeReceber={aguardandoChegada}
                        recebidoEm={item.recebido_em}
                        recebidoPor={item.recebido_por}
                      />
                      {item.lote_id && (
                        <Link href={`/estoque/lotes/${item.lote_id}`} className="mt-1 block text-xs text-primary hover:underline">
                          Lote #{item.lote_id}
                        </Link>
                      )}
                    </td>
                    {podeEditarItens && (
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <PedidoItemEditar pedidoId={pedidoId} item={item} insumos={insumos ?? []} />
                          <form action={removerItemPedidoInterno}>
                            <input type="hidden" name="item_id" value={item.id} />
                            <input type="hidden" name="pedido_interno_id" value={pedidoId} />
                            <button className="text-xs text-danger-strong hover:underline">Remover</button>
                          </form>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {linhas.length === 0 && (
                  <tr>
                    <td colSpan={podeEditarItens ? 7 : 6} className="px-4 py-6 text-center text-muted-foreground/80">
                      Nenhum material ou serviço informado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {editavel && (
            <form action={adicionarItemPedidoInterno} className="mt-3 grid gap-3 rounded-xl border border-border bg-card p-4 shadow-sm md:grid-cols-12">
              <input type="hidden" name="pedido_interno_id" value={pedidoId} />
              <div className="md:col-span-2">
                <label className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Tipo</label>
                <select name="tipo" defaultValue="material" className={`${inputCls} mt-1 w-full`}>
                  <option value="material">Material</option>
                  <option value="servico">Serviço</option>
                </select>
              </div>
              <div className="md:col-span-4">
                <label className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Especificação</label>
                <input name="especificacao" required className={`${inputCls} mt-1 w-full`} />
              </div>
              <div className="md:col-span-3">
                <label className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Insumo existente</label>
                <select name="insumo_id" defaultValue="" className={`${inputCls} mt-1 w-full`}>
                  <option value="">—</option>
                  {(insumos ?? []).map((insumo) => (
                    <option key={insumo.id} value={insumo.id}>{insumo.especificacao}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-3">
                <label className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Fornecedor sugerido</label>
                <input name="fornecedor_sugerido" className={`${inputCls} mt-1 w-full`} />
              </div>
              <div className="md:col-span-3">
                <label className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Modelo</label>
                <input name="modelo" className={`${inputCls} mt-1 w-full`} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Volume</label>
                <input name="volume" className={`${inputCls} mt-1 w-full`} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Qtd</label>
                <input name="quantidade" type="number" min="0.0001" step="any" defaultValue="1" className={`${inputCls} mt-1 w-full`} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Unidade</label>
                <input name="unidade" className={`${inputCls} mt-1 w-full`} />
              </div>
              <div className="md:col-span-3">
                <label className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Orçamento prévio un.</label>
                <input name="orcamento_previo" type="number" min="0" step="0.01" className={`${inputCls} mt-1 w-full`} />
              </div>
              <div className="md:col-span-9">
                <label className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Observação</label>
                <input name="observacao" className={`${inputCls} mt-1 w-full`} />
              </div>
              <div className="flex items-end md:col-span-3">
                <button className="h-10 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  Adicionar item
                </button>
              </div>
            </form>
          )}
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Documentos</h2>
                <p className="mt-1 text-xs text-muted-foreground">Orçamentos, propostas, termos, ofícios, boletos, notas e comprovantes.</p>
              </div>
              <span className={`rounded-md px-2 py-1 text-xs ${temDocumentoCotacao ? "bg-brand-100 text-brand-800 dark:bg-brand-950/50 dark:text-brand-300" : "bg-warning-soft text-warning-strong"}`}>
                {anexoRows.length} anexo(s)
              </span>
            </div>

            <div className="mt-3 space-y-2">
              {anexoRows.map((anexo) => (
                <div key={anexo.id} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{anexo.titulo}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {anexo.tipo} · {anexo.etapa ?? "sem etapa"} · {formatDateTime(anexo.criado_em)}
                      </p>
                      {anexo.url && (
                        <a href={anexo.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-primary hover:underline">
                          Abrir referência
                        </a>
                      )}
                      {(anexo.arquivo_nome || anexo.storage_path) && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {anexo.arquivo_nome ?? "Arquivo preparado"}
                          {anexo.mime_type ? ` · ${anexo.mime_type}` : ""}
                          {anexo.tamanho_bytes ? ` · ${Math.round(anexo.tamanho_bytes / 1024)} KB` : ""}
                        </p>
                      )}
                      {anexo.storage_path && (
                        <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                          {anexo.storage_bucket ? `${anexo.storage_bucket}/` : ""}{anexo.storage_path}
                        </p>
                      )}
                      {anexo.observacao && <p className="mt-1 text-xs text-muted-foreground">{anexo.observacao}</p>}
                    </div>
                    {editavel && (
                      <form action={removerAnexoPedidoInterno}>
                        <input type="hidden" name="anexo_id" value={anexo.id} />
                        <input type="hidden" name="pedido_interno_id" value={pedidoId} />
                        <button className="text-xs text-danger-strong hover:underline">Remover</button>
                      </form>
                    )}
                  </div>
                </div>
              ))}
              {anexoRows.length === 0 && <p className="text-sm text-muted-foreground/80">Nenhum documento registrado.</p>}
            </div>

            <form action={adicionarAnexoPedidoInterno} className="mt-4 grid gap-3 border-t border-border/70 pt-4 md:grid-cols-2">
              <input type="hidden" name="pedido_interno_id" value={pedidoId} />
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Tipo</label>
                <select name="tipo" defaultValue="orcamento_previo" className={`${inputCls} mt-1 w-full`}>
                  <option value="orcamento_previo">Orçamento prévio</option>
                  <option value="proposta">Proposta</option>
                  <option value="print">Print</option>
                  <option value="email">E-mail</option>
                  <option value="termo_referencia">Termo de referência</option>
                  <option value="oficio">Ofício</option>
                  <option value="boleto">Boleto</option>
                  <option value="nota_fiscal">Nota fiscal</option>
                  <option value="comprovante">Comprovante</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Título</label>
                <input name="titulo" required className={`${inputCls} mt-1 w-full`} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Link ou referência interna</label>
                <input name="url" placeholder="https://... ou código/local do documento" className={`${inputCls} mt-1 w-full`} />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Arquivo</label>
                <input name="arquivo_nome" placeholder="nome do arquivo ou recibo de upload" className={`${inputCls} mt-1 w-full`} />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Storage path</label>
                <input name="storage_path" placeholder="caminho preparado no storage" className={`${inputCls} mt-1 w-full`} />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">MIME type</label>
                <input name="mime_type" placeholder="application/pdf" className={`${inputCls} mt-1 w-full`} />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Tamanho (bytes)</label>
                <input name="tamanho_bytes" type="number" min="0" className={`${inputCls} mt-1 w-full`} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Observação</label>
                <input name="observacao" className={`${inputCls} mt-1 w-full`} />
              </div>
              <div className="md:col-span-2">
                <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  Registrar documento
                </button>
              </div>
            </form>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Comunicações</h2>
            <p className="mt-1 text-xs text-muted-foreground">Registro interno de e-mails, reuniões, mensagens e encaminhamentos.</p>

            <div className="mt-3 space-y-2">
              {comunicacaoRows.map((comunicacao) => (
                <div key={comunicacao.id} className="rounded-lg border border-border p-3 text-sm">
                  <p className="font-medium">{comunicacao.assunto ?? comunicacao.tipo}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {comunicacao.tipo} · {comunicacao.remetente ?? "—"} → {comunicacao.destinatarios ?? "—"} · {formatDateTime(comunicacao.criado_em)}
                  </p>
                  {comunicacao.referencia && <p className="mt-1 text-xs text-primary">{comunicacao.referencia}</p>}
                  {comunicacao.observacao && <p className="mt-1 text-xs text-muted-foreground">{comunicacao.observacao}</p>}
                </div>
              ))}
              {comunicacaoRows.length === 0 && <p className="text-sm text-muted-foreground/80">Nenhuma comunicação registrada.</p>}
            </div>

            <form action={registrarComunicacaoPedidoInterno} className="mt-4 grid gap-3 border-t border-border/70 pt-4 md:grid-cols-2">
              <input type="hidden" name="pedido_interno_id" value={pedidoId} />
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Tipo</label>
                <select name="tipo" defaultValue="email" className={`${inputCls} mt-1 w-full`}>
                  <option value="email">E-mail</option>
                  <option value="reuniao">Reunião</option>
                  <option value="telefone">Telefone</option>
                  <option value="mensagem">Mensagem</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Remetente</label>
                <input name="remetente" defaultValue="giacompras2025@gmail.com" className={`${inputCls} mt-1 w-full`} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Destinatários</label>
                <input name="destinatarios" className={`${inputCls} mt-1 w-full`} />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Assunto</label>
                <input name="assunto" className={`${inputCls} mt-1 w-full`} />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Referência</label>
                <input name="referencia" placeholder="ID da mensagem, protocolo, link..." className={`${inputCls} mt-1 w-full`} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Observação</label>
                <input name="observacao" className={`${inputCls} mt-1 w-full`} />
              </div>
              <div className="md:col-span-2">
                <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  Registrar comunicação
                </button>
              </div>
            </form>
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_22rem]">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <h2 className="text-sm font-semibold">Próxima ação</h2>
            <p className="mt-1 text-xs text-muted-foreground">{statusMeta.etapa}</p>
            <div className="mt-4">
              {statusMeta && <PedidoInternoAcoes pedidoId={pedidoId} status={pedido.status} podeGerir={podeGerir} />}
              {!podeGerir && !["rascunho", "ajuste_solicitante", "ajuste_compras"].includes(pedido.status) && (
                <p className="text-sm text-muted-foreground/80">Esta etapa exige papel coordenador ou superior.</p>
              )}
            </div>

            {aguardandoChegada && (
              <div className="mt-5 border-t border-border/70 pt-4">
                <h3 className="text-sm font-semibold">Recebimento (Etapa {PEDIDO_INTERNO_FLUXO.length + 1})</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Receba cada item na tabela acima ou no módulo{" "}
                  <Link href="/recebimento" className="text-primary hover:underline">
                    Recebimento
                  </Link>
                  . A Etapa 11 fica verde quando todos os itens forem recebidos.
                </p>
              </div>
            )}

            {pedido.status === "formalizado" && podeGerir && (
              <form action={registrarAnaliseAdministrativa} className="mt-5 grid gap-3 border-t border-border/70 pt-4 md:grid-cols-2">
                <input type="hidden" name="pedido_interno_id" value={pedidoId} />
                <div>
                  <label className="block text-xs font-medium text-muted-foreground">Fonte do recurso</label>
                  <input name="fonte_recurso" defaultValue={pedido.fonte_recurso ?? ""} className={`${inputCls} mt-1 w-full`} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground">Rubrica</label>
                  <input name="rubrica" defaultValue={pedido.rubrica ?? ""} className={`${inputCls} mt-1 w-full`} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-muted-foreground">Conformidades administrativas</label>
                  <textarea name="conformidade_admin" defaultValue={pedido.conformidade_admin ?? ""} rows={3} className={`${inputCls} mt-1 w-full`} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-muted-foreground">Observação</label>
                  <input name="observacao" defaultValue={pedido.observacao_compras ?? ""} className={`${inputCls} mt-1 w-full`} />
                </div>
                <div className="md:col-span-2">
                  <button className="rounded-md bg-fuchsia-600 px-4 py-2 text-sm font-medium text-white hover:bg-fuchsia-500">
                    Registrar análise administrativa
                  </button>
                </div>
              </form>
            )}
          </div>

          <aside className="space-y-3 rounded-xl border border-border bg-card p-4 text-sm shadow-sm">
            <h2 className="text-sm font-semibold">Referências</h2>
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Compra formal</dt>
                <dd className="text-right">
                  {compraFormal ? (
                    <Link href={`/compras/${compraFormal.id}`} className="text-primary hover:underline">
                      #{compraFormal.id} · {compraFormal.status}
                    </Link>
                  ) : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Modalidade</dt>
                <dd className="text-right">
                  {pedido.modalidade_compra ? modalidadeLabel[pedido.modalidade_compra] ?? pedido.modalidade_compra : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Instituição</dt>
                <dd className="text-right">{pedido.instituicao_destino ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Protocolo</dt>
                <dd className="text-right">{pedido.protocolo_externo ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Fonte</dt>
                <dd className="text-right">{pedido.fonte_recurso ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Urgência</dt>
                <dd className="text-right">{pedido.urgencia ?? "normal"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Rubrica</dt>
                <dd className="text-right">{pedido.rubrica ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Doc. cotação</dt>
                <dd className="text-right">{temDocumentoCotacao ? "registrado" : "pendente"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Doc. fiscal</dt>
                <dd className="text-right">{temDocumentoFiscal ? "registrado" : "pendente"}</dd>
              </div>
            </dl>
          </aside>
        </section>

        <section className="mt-8 rounded-xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold">Aprovações e decisões</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {aprovacaoRows.map((aprovacao) => (
              <div key={aprovacao.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{aprovacao.etapa}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {aprovacao.responsavel ?? "—"} · {aprovacao.papel ?? "—"} · {formatDateTime(aprovacao.criado_em)}
                    </p>
                  </div>
                  <span className="rounded-md bg-muted px-2 py-1 text-xs">{aprovacao.decisao}</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {aprovacao.status_origem ?? "início"} → {aprovacao.status_destino ?? "—"}
                </p>
                {aprovacao.comentario && (
                  <p className="mt-2 text-xs leading-5 text-foreground">{aprovacao.comentario}</p>
                )}
              </div>
            ))}
            {aprovacaoRows.length === 0 && (
              <p className="text-sm text-muted-foreground/80">Nenhuma aprovação formal registrada ainda.</p>
            )}
          </div>
        </section>

        <section className="mt-8 rounded-xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold">Linha do tempo</h2>
          <div className="mt-3">
            <Timeline eventos={eventos} />
          </div>
        </section>
      </main>
    </div>
  );
}
