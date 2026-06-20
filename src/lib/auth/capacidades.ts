export const PAPEIS = [
  "usuário",
  "coordenador",
  "administrativo",
  "gerente",
  "administrador",
] as const;
export type PapelPermissao = (typeof PAPEIS)[number];

export const PAPEL_ADMIN: PapelPermissao = "administrador";

export type Capacidade = { chave: string; rotulo: string };
export type ModuloCapacidades = { modulo: string; capacidades: Capacidade[] };

export const CATALOGO: ModuloCapacidades[] = [
  { modulo: "Análises", capacidades: [
    { chave: "analises.ver", rotulo: "Ver" },
    { chave: "analises.editar", rotulo: "Editar" },
  ]},
  { modulo: "Insumos", capacidades: [
    { chave: "insumos.ver", rotulo: "Ver" },
    { chave: "insumos.editar", rotulo: "Editar" },
  ]},
  { modulo: "Custeio", capacidades: [
    { chave: "custeio.ver", rotulo: "Ver" },
  ]},
  { modulo: "Estoque", capacidades: [
    { chave: "estoque.ver", rotulo: "Ver" },
    { chave: "estoque.lote.aceitar", rotulo: "Aceitar lote" },
    { chave: "estoque.lote.gerir", rotulo: "Bloquear/descartar lote" },
  ]},
  { modulo: "Planejamento", capacidades: [
    { chave: "planejamento.ver", rotulo: "Ver" },
    { chave: "planejamento.editar", rotulo: "Editar" },
  ]},
  { modulo: "Pedido", capacidades: [
    { chave: "pedido.ver", rotulo: "Ver" },
    { chave: "pedido.criar", rotulo: "Criar" },
    { chave: "pedido.aprovar", rotulo: "Aprovar/mover" },
  ]},
  { modulo: "Compras", capacidades: [
    { chave: "compras.ver", rotulo: "Ver" },
    { chave: "compras.aprovar", rotulo: "Aprovar" },
    { chave: "compras.receber", rotulo: "Receber" },
    { chave: "compras.cancelar", rotulo: "Cancelar" },
  ]},
  { modulo: "Recebimento", capacidades: [
    { chave: "recebimento.ver", rotulo: "Ver" },
    { chave: "recebimento.registrar", rotulo: "Registrar" },
  ]},
  { modulo: "Orçamento", capacidades: [
    { chave: "orcamento.ver", rotulo: "Ver" },
    { chave: "orcamento.editar", rotulo: "Editar" },
    { chave: "orcamento.parametros.editar", rotulo: "Editar parâmetros econômicos" },
  ]},
  { modulo: "Projetos", capacidades: [
    { chave: "projetos.ver", rotulo: "Ver" },
    { chave: "projetos.editar", rotulo: "Editar" },
  ]},
  { modulo: "Cadastros", capacidades: [
    { chave: "cadastros.ver", rotulo: "Ver" },
    { chave: "cadastros.editar", rotulo: "Editar" },
  ]},
  { modulo: "Governança", capacidades: [
    { chave: "auditoria.ver", rotulo: "Ver auditoria" },
    { chave: "usuarios.gerir", rotulo: "Gerir usuários" },
    { chave: "backups.gerir", rotulo: "Gerir backups" },
    { chave: "privilegios.gerir", rotulo: "Gerir privilégios" },
    { chave: "configuracoes.ver", rotulo: "Ver configurações" },
  ]},
];

export const CHAVES_PERMISSAO: readonly string[] = CATALOGO.flatMap((m) =>
  m.capacidades.map((c) => c.chave),
);
