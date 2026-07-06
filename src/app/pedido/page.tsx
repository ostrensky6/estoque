import { createClientUntyped } from "@/lib/supabase/server";
import { temPapel } from "@/lib/auth/roles";
import { criarPedidoInterno } from "@/lib/actions/pedidos-internos";
import { PedidosInternosTable, type PedidoInternoRow } from "@/components/pedido/PedidosInternosTable";
import type { PedidoItemView } from "@/components/pedido/PedidoItensQuickView";
import { pedidoInternoNumero, pedidoInternoStatus } from "@/lib/pedido/status";
import { formatCurrency as brl, formatDate } from "@/lib/formatters";

export const dynamic = "force-dynamic";

type ProjetoOption = {
  id: number;
  nome: string;
  coordenador?: string | null;
  coordenador_nome?: string | null;
  coordenador_email?: string | null;
};

type PedidoInternoListRow = {
  id: number;
  titulo: string;
  status: string;
  solicitante: string | null;
  data_necessidade: string | null;
  urgencia: string | null;
  tipo_demanda?: string | null;
  modalidade_compra?: string | null;
  pedido_compra_id: number | null;
  criado_em: string;
  coordenador_projeto_nome?: string | null;
  coordenador_projeto_email?: string | null;
  projetos: { nome: string | null; coordenador?: string | null; coordenador_nome?: string | null; coordenador_email?: string | null } | Array<{ nome: string | null; coordenador?: string | null; coordenador_nome?: string | null; coordenador_email?: string | null }> | null;
  pedidos_compra?: { id: number; status: string } | Array<{ id: number; status: string }> | null;
  pedidos_internos_itens: Array<PedidoItemView & { recebido_em?: string | null }>;
  pedidos_internos_anexos: Array<{ id: number; tipo: string }>;
};

function asOne<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

const LABEL_TIPO: Record<string, string> = {
  laboratorio: "Laboratório",
  campo: "Campo",
  laboratorio_campo: "Lab./campo",
  administrativo: "Administrativo",
  outro: "Outro",
};

const LABEL_MODALIDADE: Record<string, string> = {
  compra_direta: "Compra direta",
  fundacao: "Fundação",
  universidade: "Universidade",
  outra: "Outra",
};

function proximaAcao(status: string) {
  const map: Record<string, { acao: string; responsavel: string }> = {
    rascunho: { acao: "Enviar para validação", responsavel: "Solicitante" },
    ajuste_solicitante: { acao: "Corrigir pedido", responsavel: "Solicitante" },
    ajuste_compras: { acao: "Corrigir dados administrativos", responsavel: "Compras/Admin." },
    em_validacao: { acao: "Aprovar coordenador", responsavel: "Coordenador do projeto" },
    validado: { acao: "Formalizar compra", responsavel: "Coordenador/Compras" },
    formalizado: { acao: "Análise administrativa", responsavel: "Administrativo" },
    analise_administrativa: { acao: "Aprovar para cotação", responsavel: "Coordenador/Admin." },
    aprovado_compra: { acao: "Registrar orçamentos", responsavel: "Compras/Admin." },
    orcamentos: { acao: "Anexar orçamentos", responsavel: "Compras/Admin." },
    orcamentos_recebidos: { acao: "Enviar aprovação final", responsavel: "Coordenador" },
    aguardando_aprovacao_final: { acao: "Aprovar compra final", responsavel: "Coordenador" },
    aprovado_para_compra: { acao: "Definir modalidade", responsavel: "Compras/Admin." },
    compra_fechada: { acao: "Aguardar pagamento/NF", responsavel: "Compras/Admin." },
    encaminhado_instituicao: { acao: "Acompanhar instituição", responsavel: "Administrativo" },
    aguardando_pagamento_nf: { acao: "Anexar NF/comprovante", responsavel: "Compras/Admin." },
    compra_concluida: { acao: "Concluído", responsavel: "—" },
    cancelado: { acao: "Encerrado", responsavel: "—" },
  };
  return map[status] ?? { acao: "Revisar", responsavel: "Operação" };
}

function pendenciasPedido(row: PedidoInternoListRow) {
  const pendencias: string[] = [];
  const docsCotacao = row.pedidos_internos_anexos.some((doc) => ["orcamento_previo", "proposta", "print", "email"].includes(doc.tipo));
  if (!docsCotacao && ["orcamentos", "aprovado_compra"].includes(row.status)) pendencias.push("orçamento");
  if (!row.projetos) pendencias.push("projeto");
  if (!row.pedidos_internos_itens.length) pendencias.push("itens");
  if (row.status === "aprovado_para_compra" && !row.modalidade_compra) pendencias.push("modalidade");
  return pendencias.length ? pendencias.join(", ") : "—";
}

export default async function PedidoPage() {
  const supabase = await createClientUntyped();
  const [pedidosFull, projetosFull, podeExcluir] = await Promise.all([
    supabase
      .from("pedidos_internos")
      .select("id, titulo, status, solicitante, data_necessidade, urgencia, tipo_demanda, modalidade_compra, pedido_compra_id, criado_em, coordenador_projeto_nome, coordenador_projeto_email, projetos(nome, coordenador, coordenador_nome, coordenador_email), pedidos_compra(id, status), pedidos_internos_itens(id, tipo, especificacao, modelo, volume, quantidade, unidade, orcamento_previo, fornecedor_sugerido, recebido_em), pedidos_internos_anexos(id, tipo)")
      .order("criado_em", { ascending: false }),
    supabase.from("projetos").select("id, nome, coordenador, coordenador_nome, coordenador_email").order("nome"),
    temPapel("coordenador"),
  ]);
  const { data: pedidos } = pedidosFull.error
    ? await supabase
        .from("pedidos_internos")
        .select("id, titulo, status, solicitante, data_necessidade, urgencia, pedido_compra_id, criado_em, projetos(nome, coordenador), pedidos_compra(id, status), pedidos_internos_itens(id, tipo, especificacao, modelo, volume, quantidade, unidade, orcamento_previo, fornecedor_sugerido, recebido_em), pedidos_internos_anexos(id, tipo)")
        .order("criado_em", { ascending: false })
    : pedidosFull;
  const { data: projetos } = projetosFull.error
    ? await supabase.from("projetos").select("id, nome, coordenador").order("nome")
    : projetosFull;

  const rows: PedidoInternoRow[] = ((pedidos ?? []) as unknown as PedidoInternoListRow[]).map((pedido) => {
    const itens = ((pedido.pedidos_internos_itens ?? []) as PedidoItemView[]) ?? [];
    const total = itens.reduce(
      (acc, item) => acc + Number(item.quantidade ?? 0) * Number(item.orcamento_previo ?? 0),
      0,
    );
    const status = pedidoInternoStatus(pedido.status);
    const projetoRow = asOne(pedido.projetos);
    const compraRow = asOne(pedido.pedidos_compra);
    const projeto = projetoRow?.nome ?? "—";
    const coordenador =
      pedido.coordenador_projeto_nome ??
      pedido.coordenador_projeto_email ??
      projetoRow?.coordenador_nome ??
      projetoRow?.coordenador ??
      projetoRow?.coordenador_email ??
      "—";
    const docsCotacao = pedido.pedidos_internos_anexos.some((doc) => ["orcamento_previo", "proposta", "print", "email"].includes(doc.tipo));
    const recebidos = pedido.pedidos_internos_itens.filter((item) => item.recebido_em).length;
    const proxima = proximaAcao(pedido.status);
    const compraFormal = compraRow?.id ? `#${compraRow.id} · ${compraRow.status}` : "—";
    return {
      id: pedido.id,
      numero: pedidoInternoNumero(pedido.id),
      titulo: pedido.titulo,
      tipoDemanda: LABEL_TIPO[pedido.tipo_demanda ?? "laboratorio"] ?? pedido.tipo_demanda ?? "—",
      projeto,
      coordenador,
      solicitante: pedido.solicitante ?? "—",
      necessidade: formatDate(pedido.data_necessidade),
      urgencia: pedido.urgencia ?? "normal",
      itens: itens.length,
      itensDetalhe: itens,
      total: brl(total),
      status: pedido.status,
      statusLabel: status.label,
      proximaAcao: proxima.acao,
      responsavelAtual: proxima.responsavel,
      documentos: docsCotacao ? "ok" : "pendente",
      modalidade: pedido.modalidade_compra ? LABEL_MODALIDADE[pedido.modalidade_compra] ?? pedido.modalidade_compra : "—",
      compraFormal,
      recebimento: itens.length ? `${recebidos}/${itens.length}` : "—",
      pendencias: pendenciasPedido(pedido),
    };
  });

  const inputCls = "mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm";

  return (
    <div className="min-h-dvh bg-transparent font-sans text-foreground">
      <main className="app-page-container">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Pedido</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Demandas internas do GATGF para materiais e serviços antes da compra formal.
            </p>
          </div>
          <div className="grid min-w-56 grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-muted-foreground">Abertos</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {rows.filter((row) => !["cancelado", "compra_concluida"].includes(row.status)).length}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-muted-foreground">Em validação</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {rows.filter((row) => row.status === "em_validacao").length}
              </p>
            </div>
          </div>
        </div>

        <form action={criarPedidoInterno} className="mt-6 grid gap-4 rounded-xl border border-border bg-card p-4 shadow-sm md:grid-cols-12">
          <div className="md:col-span-5">
            <label className="block text-xs font-medium text-muted-foreground">Demanda inicial</label>
            <input name="titulo" required placeholder="Ex.: Reagentes para sequenciamento de junho" className={inputCls} />
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-muted-foreground">Projeto</label>
            <select name="projeto_id" defaultValue="" className={inputCls}>
              <option value="">—</option>
              {((projetos ?? []) as ProjetoOption[]).map((projeto) => (
                <option key={projeto.id} value={projeto.id}>
                  {projeto.nome}{projeto.coordenador_nome || projeto.coordenador ? ` · ${projeto.coordenador_nome ?? projeto.coordenador}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-muted-foreground">Tipo</label>
            <select name="tipo_demanda" defaultValue="laboratorio" className={inputCls}>
              <option value="laboratorio">Laboratório</option>
              <option value="campo">Campo</option>
              <option value="laboratorio_campo">Lab./campo</option>
              <option value="administrativo">Administrativo</option>
              <option value="outro">Outro</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-muted-foreground">Necessidade</label>
            <input name="data_necessidade" type="date" className={inputCls} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-muted-foreground">Urgência</label>
            <select name="urgencia" defaultValue="normal" className={inputCls}>
              <option value="baixa">Baixa</option>
              <option value="normal">Normal</option>
              <option value="alta">Alta</option>
              <option value="critica">Crítica</option>
            </select>
          </div>
          <div className="md:col-span-4">
            <label className="block text-xs font-medium text-muted-foreground">Fonte provável</label>
            <input name="fonte_recurso" placeholder="Projeto, convênio, recurso interno..." className={inputCls} />
          </div>
          <div className="md:col-span-4">
            <label className="block text-xs font-medium text-muted-foreground">Justificativa</label>
            <input name="justificativa" placeholder="Experimentos, análises ou problema que originou a compra" className={inputCls} />
          </div>
          <div className="flex items-end md:col-span-2">
            <button className="h-10 w-full rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-500">
              Novo pedido
            </button>
          </div>
        </form>

        <div className="mt-6">
          <PedidosInternosTable rows={rows} podeExcluir={podeExcluir} />
        </div>
      </main>
    </div>
  );
}
