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
  | "auditoria.visualizar";

export const PERMISSOES: Array<{
  key: PermissaoUsuario;
  modulo: string;
  label: string;
  descricao: string;
}> = [
  {
    key: "orcamentos.visualizar",
    modulo: "Orcamentos",
    label: "Visualizar",
    descricao: "Acessar demandas, propostas e historico.",
  },
  {
    key: "orcamentos.criar_editar",
    modulo: "Orcamentos",
    label: "Criar/editar",
    descricao: "Preencher demandas, custos e parametros.",
  },
  {
    key: "orcamentos.emitir",
    modulo: "Orcamentos",
    label: "Emitir proposta",
    descricao: "Gerar versoes finais para cliente.",
  },
  {
    key: "orcamentos.cancelar",
    modulo: "Orcamentos",
    label: "Cancelar",
    descricao: "Cancelar ou duplicar versoes historicas.",
  },
  {
    key: "compras.solicitar",
    modulo: "Compras",
    label: "Solicitar",
    descricao: "Abrir pedidos internos e reposicoes.",
  },
  {
    key: "compras.aprovar",
    modulo: "Compras",
    label: "Aprovar",
    descricao: "Aprovar compras e recebimentos sensiveis.",
  },
  {
    key: "estoque.movimentar",
    modulo: "Estoque",
    label: "Movimentar",
    descricao: "Registrar entradas, baixas e ajustes.",
  },
  {
    key: "estoque.descartar_bloquear",
    modulo: "Estoque",
    label: "Bloquear/descartar",
    descricao: "Executar bloqueios, descartes e desbloqueios.",
  },
  {
    key: "cadastros.editar",
    modulo: "Cadastros",
    label: "Editar cadastros",
    descricao: "Manter clientes, insumos e parametros mestres.",
  },
  {
    key: "usuarios.gerenciar",
    modulo: "Administracao",
    label: "Gerenciar usuarios",
    descricao: "Criar acessos, papeis, assinaturas e permissoes.",
  },
  {
    key: "auditoria.visualizar",
    modulo: "Administracao",
    label: "Ver auditoria",
    descricao: "Consultar trilha de auditoria e governanca.",
  },
];

const DEFAULT_PERMISSIONS_BY_ROLE: Record<PapelUsuario, PermissaoUsuario[]> = {
  tecnico: [
    "orcamentos.visualizar",
    "orcamentos.criar_editar",
    "compras.solicitar",
    "estoque.movimentar",
  ],
  coordenador: [
    "orcamentos.visualizar",
    "orcamentos.criar_editar",
    "orcamentos.emitir",
    "compras.solicitar",
    "compras.aprovar",
    "estoque.movimentar",
    "cadastros.editar",
  ],
  gestor: [
    "orcamentos.visualizar",
    "orcamentos.criar_editar",
    "orcamentos.emitir",
    "orcamentos.cancelar",
    "compras.solicitar",
    "compras.aprovar",
    "estoque.movimentar",
    "estoque.descartar_bloquear",
    "cadastros.editar",
    "auditoria.visualizar",
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
