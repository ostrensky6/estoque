import "server-only";

import { papelAtual, temPapel, type Papel } from "@/lib/auth/roles";

export type AcaoOrcamento =
  | "criar_demanda"
  | "preencher_custos"
  | "recalcular_custos"
  | "revisar_modulo"
  | "editar_parametros"
  | "emitir_final"
  | "duplicar_final"
  | "cancelar_documento"
  | "gerir_modelos"
  | "ver_governanca";

export type PermissaoOrcamento = {
  acao: AcaoOrcamento;
  titulo: string;
  descricao: string;
  papelMinimo: Papel;
  motivoObrigatorio: boolean;
  eventoAuditavel: string;
};

export const LABEL_PAPEL: Record<Papel, string> = {
  tecnico: "Técnico",
  coordenador: "Coordenador",
  gestor: "Gestor",
  admin: "Administrador",
};

export const PERMISSOES_ORCAMENTO: PermissaoOrcamento[] = [
  {
    acao: "criar_demanda",
    titulo: "Criar demanda",
    descricao: "Abrir uma solicitação comercial ou técnica antes do orçamento formal.",
    papelMinimo: "tecnico",
    motivoObrigatorio: false,
    eventoAuditavel: "Auditoria do registro de demanda",
  },
  {
    acao: "preencher_custos",
    titulo: "Preencher custos",
    descricao: "Adicionar análises, custos de projeto, anexos e premissas operacionais.",
    papelMinimo: "tecnico",
    motivoObrigatorio: false,
    eventoAuditavel: "Auditoria de tabelas de custo",
  },
  {
    acao: "recalcular_custos",
    titulo: "Recalcular custos",
    descricao: "Atualizar snapshots com parâmetros e cadastros vigentes.",
    papelMinimo: "coordenador",
    motivoObrigatorio: true,
    eventoAuditavel: "Evento de recalculo",
  },
  {
    acao: "revisar_modulo",
    titulo: "Revisar módulo",
    descricao: "Mover módulo para enviado, aprovado ou etapa equivalente de revisão.",
    papelMinimo: "coordenador",
    motivoObrigatorio: false,
    eventoAuditavel: "Mudança de status",
  },
  {
    acao: "editar_parametros",
    titulo: "Editar parâmetros",
    descricao: "Alterar percentuais financeiros, gross-up e parâmetros globais.",
    papelMinimo: "gestor",
    motivoObrigatorio: false,
    eventoAuditavel: "Versão de parâmetros",
  },
  {
    acao: "emitir_final",
    titulo: "Emitir orçamento final",
    descricao: "Gerar proposta institucional com snapshot consolidado.",
    papelMinimo: "coordenador",
    motivoObrigatorio: false,
    eventoAuditavel: "Emissão final",
  },
  {
    acao: "duplicar_final",
    titulo: "Duplicar versão final",
    descricao: "Criar nova versão preservando a origem e substituindo a versão ativa.",
    papelMinimo: "coordenador",
    motivoObrigatorio: false,
    eventoAuditavel: "Duplicação de versão",
  },
  {
    acao: "cancelar_documento",
    titulo: "Cancelar documento",
    descricao: "Cancelar orçamento, projeto ou versão final sem apagar histórico.",
    papelMinimo: "coordenador",
    motivoObrigatorio: true,
    eventoAuditavel: "Cancelamento com motivo",
  },
  {
    acao: "gerir_modelos",
    titulo: "Gerir modelos e catálogos",
    descricao: "Duplicar, arquivar e manter templates ou catálogo institucional.",
    papelMinimo: "gestor",
    motivoObrigatorio: false,
    eventoAuditavel: "Auditoria de template/catálogo",
  },
  {
    acao: "ver_governanca",
    titulo: "Ver governança",
    descricao: "Consultar matriz de permissões, eventos e alterações por campo.",
    papelMinimo: "gestor",
    motivoObrigatorio: false,
    eventoAuditavel: "Leitura restrita",
  },
];

export function permissaoOrcamento(acao: AcaoOrcamento) {
  const permissao = PERMISSOES_ORCAMENTO.find((item) => item.acao === acao);
  if (!permissao) throw new Error(`Ação de orçamento sem política: ${acao}`);
  return permissao;
}

export async function exigirPapelOrcamento(acao: AcaoOrcamento) {
  const permissao = permissaoOrcamento(acao);
  if (await temPapel(permissao.papelMinimo)) return;

  const atual = await papelAtual();
  throw new Error(
    `Sem permissão para ${permissao.titulo.toLowerCase()}. Papel atual: ${LABEL_PAPEL[atual]}. Exigido: ${LABEL_PAPEL[permissao.papelMinimo]} ou superior.`,
  );
}
