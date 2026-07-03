export const PAPEIS = [
  { value: "tecnico", label: "Técnico" },
  { value: "coordenador", label: "Coordenador" },
  { value: "gestor", label: "Gestor" },
  { value: "admin", label: "Administrador" },
] as const;

export type PapelUsuario = (typeof PAPEIS)[number]["value"];
export type PermissaoUsuario =
  | "orcamentos.visualizar"
  | "orcamentos.criar_editar"
  | "orcamentos.emitir"
  | "orcamentos.cancelar"
  | "compras.solicitar"
  | "compras.aprovar"
  | "estoque.movimentar"
  | "estoque.descartar_bloquear"
  | "cadastros.editar"
  | "usuarios.gerenciar"
  | "auditoria.visualizar"
  | "analises.ver"
  | "analises.editar"
  | "insumos.ver"
  | "insumos.editar"
  | "custeio.ver"
  | "estoque.ver"
  | "estoque.lote.aceitar"
  | "estoque.lote.gerir"
  | "planejamento.ver"
  | "planejamento.editar"
  | "pedido.ver"
  | "pedido.criar"
  | "pedido.aprovar"
  | "compras.ver"
  | "compras.receber"
  | "compras.cancelar"
  | "recebimento.ver"
  | "recebimento.registrar"
  | "orcamento.parametros.editar"
  | "projetos.ver"
  | "projetos.editar"
  | "cadastros.ver"
  | "backups.gerenciar"
  | "privilegios.gerenciar"
  | "configuracoes.ver";

export const HISTORICAL_ROLE_RECONCILIATION = [
  {
    historico: "usuário",
    atual: "tecnico",
    observacao: "Perfil operacional basico; capacidades historicas de consulta foram recuperadas como permissoes granulares.",
  },
  {
    historico: "coordenador",
    atual: "coordenador",
    observacao: "Equivalencia nominal mantida com permissoes operacionais e de aprovacao.",
  },
  {
    historico: "administrativo",
    atual: "sem papel dedicado",
    observacao:
      "O papel historico nao existe no check atual de perfis; foi preservado como conjunto de capacidades editaveis, sem recriar papel no banco nesta reconciliacao.",
  },
  {
    historico: "gerente",
    atual: "gestor",
    observacao: "Papel gerencial atual absorve as capacidades amplas do gerente historico.",
  },
  {
    historico: "administrador",
    atual: "admin",
    observacao: "Administrador segue como superconjunto; no UI todas as permissoes ficam habilitadas.",
  },
] as const;

export const PERMISSOES: Array<{
  key: PermissaoUsuario;
  modulo: string;
  label: string;
  descricao: string;
}> = [
  {
    key: "analises.ver",
    modulo: "Operação",
    label: "Ver análises",
    descricao: "Acessar catálogo técnico, etapas e matriz de análises.",
  },
  {
    key: "analises.editar",
    modulo: "Operação",
    label: "Editar análises",
    descricao: "Manter análises, etapas e vínculos técnicos.",
  },
  {
    key: "insumos.ver",
    modulo: "Operação",
    label: "Ver insumos",
    descricao: "Consultar insumos, consumos e vínculos por análise.",
  },
  {
    key: "insumos.editar",
    modulo: "Operação",
    label: "Editar insumos",
    descricao: "Manter insumos, perdas e parâmetros técnicos.",
  },
  {
    key: "custeio.ver",
    modulo: "Operação",
    label: "Ver custeio",
    descricao: "Consultar custo técnico, overhead e preço base.",
  },
  {
    key: "estoque.ver",
    modulo: "Suprimentos",
    label: "Ver estoque",
    descricao: "Consultar saldos, lotes, alertas e rastreabilidade.",
  },
  {
    key: "estoque.movimentar",
    modulo: "Suprimentos",
    label: "Movimentar estoque",
    descricao: "Registrar entradas, baixas e ajustes.",
  },
  {
    key: "estoque.descartar_bloquear",
    modulo: "Suprimentos",
    label: "Bloquear/descartar",
    descricao: "Executar bloqueios, descartes e desbloqueios.",
  },
  {
    key: "estoque.lote.aceitar",
    modulo: "Suprimentos",
    label: "Aceitar lote",
    descricao: "Liberar lotes em quarentena para uso operacional.",
  },
  {
    key: "estoque.lote.gerir",
    modulo: "Suprimentos",
    label: "Gerir lotes",
    descricao: "Administrar lotes, estados e exceções de estoque.",
  },
  {
    key: "planejamento.ver",
    modulo: "Suprimentos",
    label: "Ver planejamento",
    descricao: "Consultar demandas, reservas e consumo previsto.",
  },
  {
    key: "planejamento.editar",
    modulo: "Suprimentos",
    label: "Editar planejamento",
    descricao: "Ajustar planejamento, reservas e projeções.",
  },
  {
    key: "pedido.ver",
    modulo: "Suprimentos",
    label: "Ver pedidos",
    descricao: "Consultar pedidos internos e seus estágios.",
  },
  {
    key: "pedido.criar",
    modulo: "Suprimentos",
    label: "Criar pedidos",
    descricao: "Abrir pedidos internos para compra.",
  },
  {
    key: "pedido.aprovar",
    modulo: "Suprimentos",
    label: "Aprovar pedidos",
    descricao: "Aprovar ou devolver pedidos internos.",
  },
  {
    key: "compras.ver",
    modulo: "Suprimentos",
    label: "Ver compras",
    descricao: "Consultar solicitações, compras e recebimentos.",
  },
  {
    key: "compras.solicitar",
    modulo: "Suprimentos",
    label: "Solicitar compras",
    descricao: "Abrir pedidos internos e reposições.",
  },
  {
    key: "compras.aprovar",
    modulo: "Suprimentos",
    label: "Aprovar compras",
    descricao: "Aprovar compras e recebimentos sensíveis.",
  },
  {
    key: "compras.receber",
    modulo: "Suprimentos",
    label: "Receber compras",
    descricao: "Registrar recebimento formal de compras.",
  },
  {
    key: "compras.cancelar",
    modulo: "Suprimentos",
    label: "Cancelar compras",
    descricao: "Cancelar solicitações e pedidos de compra.",
  },
  {
    key: "recebimento.ver",
    modulo: "Suprimentos",
    label: "Ver recebimento",
    descricao: "Consultar itens em recebimento e conferência.",
  },
  {
    key: "recebimento.registrar",
    modulo: "Suprimentos",
    label: "Registrar recebimento",
    descricao: "Registrar chegada, conferência e lote recebido.",
  },
  {
    key: "orcamentos.visualizar",
    modulo: "Orçamentos",
    label: "Visualizar",
    descricao: "Acessar demandas, propostas e histórico.",
  },
  {
    key: "orcamentos.criar_editar",
    modulo: "Orçamentos",
    label: "Criar/editar",
    descricao: "Preencher demandas, custos e parâmetros.",
  },
  {
    key: "orcamentos.emitir",
    modulo: "Orçamentos",
    label: "Emitir proposta",
    descricao: "Gerar versões finais para cliente.",
  },
  {
    key: "orcamentos.cancelar",
    modulo: "Orçamentos",
    label: "Cancelar",
    descricao: "Cancelar ou duplicar versões históricas.",
  },
  {
    key: "orcamento.parametros.editar",
    modulo: "Orçamentos",
    label: "Editar parâmetros",
    descricao: "Manter premissas econômicas e parâmetros globais.",
  },
  {
    key: "projetos.ver",
    modulo: "Projetos",
    label: "Ver projetos",
    descricao: "Consultar projetos e vínculos com orçamento.",
  },
  {
    key: "projetos.editar",
    modulo: "Projetos",
    label: "Editar projetos",
    descricao: "Manter projetos, custos e dados associados.",
  },
  {
    key: "cadastros.ver",
    modulo: "Cadastros",
    label: "Ver cadastros",
    descricao: "Consultar clientes, fornecedores e bases mestres.",
  },
  {
    key: "cadastros.editar",
    modulo: "Cadastros",
    label: "Editar cadastros",
    descricao: "Manter clientes, insumos e parâmetros mestres.",
  },
  {
    key: "auditoria.visualizar",
    modulo: "Governança",
    label: "Ver auditoria",
    descricao: "Consultar trilha de auditoria e governança.",
  },
  {
    key: "usuarios.gerenciar",
    modulo: "Governança",
    label: "Gerenciar usuários",
    descricao: "Criar acessos, papéis, assinaturas e permissões.",
  },
  {
    key: "backups.gerenciar",
    modulo: "Governança",
    label: "Gerenciar backups",
    descricao: "Executar e registrar backups locais e em nuvem.",
  },
  {
    key: "privilegios.gerenciar",
    modulo: "Governança",
    label: "Gerenciar privilégios",
    descricao: "Editar a matriz granular de permissões por papel.",
  },
  {
    key: "configuracoes.ver",
    modulo: "Governança",
    label: "Ver configurações",
    descricao: "Consultar parâmetros institucionais e controles globais.",
  },
];

const DEFAULT_PERMISSIONS_BY_ROLE: Record<PapelUsuario, PermissaoUsuario[]> = {
  tecnico: [
    "analises.ver",
    "insumos.ver",
    "custeio.ver",
    "estoque.ver",
    "estoque.movimentar",
    "planejamento.ver",
    "pedido.ver",
    "pedido.criar",
    "compras.ver",
    "compras.solicitar",
    "recebimento.ver",
    "orcamentos.visualizar",
    "orcamentos.criar_editar",
    "projetos.ver",
    "cadastros.ver",
  ],
  coordenador: [
    "analises.ver",
    "analises.editar",
    "insumos.ver",
    "insumos.editar",
    "custeio.ver",
    "estoque.ver",
    "estoque.movimentar",
    "estoque.lote.aceitar",
    "planejamento.ver",
    "planejamento.editar",
    "pedido.ver",
    "pedido.criar",
    "pedido.aprovar",
    "compras.ver",
    "compras.solicitar",
    "compras.aprovar",
    "compras.receber",
    "recebimento.ver",
    "recebimento.registrar",
    "orcamentos.visualizar",
    "orcamentos.criar_editar",
    "orcamentos.emitir",
    "projetos.ver",
    "projetos.editar",
    "cadastros.ver",
    "cadastros.editar",
  ],
  gestor: [
    "analises.ver",
    "analises.editar",
    "insumos.ver",
    "insumos.editar",
    "custeio.ver",
    "estoque.ver",
    "estoque.movimentar",
    "estoque.descartar_bloquear",
    "estoque.lote.aceitar",
    "estoque.lote.gerir",
    "planejamento.ver",
    "planejamento.editar",
    "pedido.ver",
    "pedido.criar",
    "pedido.aprovar",
    "compras.ver",
    "compras.solicitar",
    "compras.aprovar",
    "compras.receber",
    "compras.cancelar",
    "recebimento.ver",
    "recebimento.registrar",
    "orcamentos.visualizar",
    "orcamentos.criar_editar",
    "orcamentos.emitir",
    "orcamentos.cancelar",
    "orcamento.parametros.editar",
    "projetos.ver",
    "projetos.editar",
    "cadastros.ver",
    "cadastros.editar",
    "auditoria.visualizar",
    "configuracoes.ver",
  ],
  admin: PERMISSOES.map((permissao) => permissao.key),
};

export function defaultPermissionsForRole(papel: string): PermissaoUsuario[] {
  return DEFAULT_PERMISSIONS_BY_ROLE[(papel as PapelUsuario) || "tecnico"] ?? DEFAULT_PERMISSIONS_BY_ROLE.tecnico;
}

export function normalizePermissions(papel: string, permissoes: unknown): Record<PermissaoUsuario, boolean> {
  const defaults = new Set(defaultPermissionsForRole(papel));
  const raw = typeof permissoes === "object" && permissoes !== null ? (permissoes as Record<string, unknown>) : {};
  return Object.fromEntries(
    PERMISSOES.map((permissao) => [
      permissao.key,
      typeof raw[permissao.key] === "boolean" ? Boolean(raw[permissao.key]) : defaults.has(permissao.key),
    ]),
  ) as Record<PermissaoUsuario, boolean>;
}

export function selectedPermissionsFromForm(formData: FormData, papel: string) {
  const submitted = formData.getAll("permissoes").map(String);
  const selected = new Set(submitted.length > 0 ? submitted : defaultPermissionsForRole(papel));
  return Object.fromEntries(
    PERMISSOES.map((permissao) => [
      permissao.key,
      selected.has(permissao.key) || papel === "admin",
    ]),
  );
}
