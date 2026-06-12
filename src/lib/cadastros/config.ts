/**
 * Configuração declarativa dos cadastros (elementos de custo).
 * Dados serializáveis — compartilhados entre Server Components (páginas) e
 * Client Components (formulário/drawer). Sem imports de servidor aqui.
 */

export type CampoTipo =
  | "text"
  | "number"
  | "currency"
  | "percent"
  | "date"
  | "select"
  | "checkbox";

export type Campo = {
  name: string;
  label: string;
  tipo: CampoTipo;
  obrigatorio?: boolean;
  step?: string;
  min?: number;
  max?: number;
  opcoes?: { value: string; label: string }[];
  ajuda?: string;
  colSpan?: 1 | 2;
  placeholder?: string;
};

export type Coluna = {
  key: string;
  label: string;
  tipo?: CampoTipo;
  alinhar?: "left" | "right";
  /** coluna calculada (somente leitura, destacada) */
  calculada?: boolean;
};

export type CadastroConfig = {
  slug: string;
  tabela: string;
  titulo: string;
  singular: string;
  subtitulo: string;
  /** coluna usada como rótulo nas confirmações */
  rotulo: string;
  colunas: Coluna[];
  campos: Campo[];
};

export const CADASTROS: Record<string, CadastroConfig> = {
  equipamentos: {
    slug: "equipamentos",
    tabela: "equipamentos",
    titulo: "Equipamentos",
    singular: "equipamento",
    subtitulo:
      "Inventário de equipamentos. O custo/dia usa depreciação linear pela vida útil + manutenção, rateado pelos dias úteis/ano.",
    rotulo: "nome",
    colunas: [
      { key: "nome", label: "Equipamento" },
      { key: "quantidade", label: "Qtd", tipo: "number", alinhar: "right" },
      { key: "custo_unitario", label: "Custo un.", tipo: "currency", alinhar: "right" },
      { key: "vida_util_anos", label: "Vida útil (anos)", tipo: "number", alinhar: "right" },
      { key: "custo_dia", label: "Custo/dia", tipo: "currency", alinhar: "right", calculada: true },
    ],
    campos: [
      { name: "nome", label: "Nome", tipo: "text", obrigatorio: true, colSpan: 2 },
      { name: "quantidade", label: "Quantidade", tipo: "number", obrigatorio: true, min: 0, step: "1" },
      { name: "custo_unitario", label: "Custo unitário (R$)", tipo: "currency", obrigatorio: true, min: 0 },
      { name: "data_aquisicao", label: "Data de aquisição", tipo: "date" },
      { name: "vida_util_anos", label: "Vida útil (anos)", tipo: "number", min: 0, step: "0.5", ajuda: "Para depreciação linear." },
      {
        name: "percentual_manutencao_anual",
        label: "Manutenção anual (fração)",
        tipo: "number",
        min: 0,
        max: 1,
        step: "0.01",
        ajuda: "Fração do valor: 0,05 = 5% ao ano.",
      },
      {
        name: "manutencao_anual_fixa",
        label: "Manutenção anual fixa (R$)",
        tipo: "currency",
        min: 0,
        ajuda: "Opcional — contrato de manutenção; substitui a fração acima.",
      },
      { name: "possui", label: "Possui no laboratório", tipo: "checkbox" },
    ],
  },

  insumos: {
    slug: "insumos",
    tabela: "insumos",
    titulo: "Insumos",
    singular: "insumo",
    subtitulo:
      "Catálogo de reagentes e consumíveis. O custo unitário é calculado a partir do valor e da quantidade da embalagem.",
    rotulo: "especificacao",
    colunas: [
      { key: "nome_item", label: "Categoria" },
      { key: "especificacao", label: "Especificação" },
      { key: "custo_total_embalagem", label: "Embalagem (R$)", tipo: "currency", alinhar: "right" },
      { key: "quantidade_embalagem", label: "Qtd emb.", tipo: "number", alinhar: "right" },
      { key: "unidade", label: "Un." },
      { key: "custo_unitario", label: "Custo un.", tipo: "currency", alinhar: "right", calculada: true },
      { key: "ponto_reposicao", label: "Ponto repos.", tipo: "number", alinhar: "right" },
    ],
    campos: [
      { name: "nome_item", label: "Categoria", tipo: "text", placeholder: "Ladder, Beads, Kit Illumina…" },
      { name: "especificacao", label: "Especificação", tipo: "text", obrigatorio: true, colSpan: 2, ajuda: "Identificador único do insumo." },
      { name: "custo_total_embalagem", label: "Valor da embalagem (R$)", tipo: "currency", obrigatorio: true, min: 0 },
      { name: "quantidade_embalagem", label: "Quantidade na embalagem", tipo: "number", obrigatorio: true, min: 0 },
      { name: "unidade", label: "Unidade", tipo: "text", placeholder: "uL, reações, un, mL…" },
      { name: "data_aquisicao", label: "Data de aquisição", tipo: "date" },
      { name: "ponto_reposicao", label: "Ponto de reposição", tipo: "number", min: 0, ajuda: "Dispara alerta quando o disponível cai até aqui." },
      { name: "estoque_seguranca", label: "Estoque de segurança", tipo: "number", min: 0 },
      { name: "lead_time_dias", label: "Lead time (dias)", tipo: "number", min: 0, ajuda: "Prazo de entrega do fornecedor." },
    ],
  },

  tecnicos: {
    slug: "tecnicos",
    tabela: "tecnicos",
    titulo: "Técnicos",
    singular: "técnico",
    subtitulo:
      "Pessoal e dedicação. O valor-hora (HH) considera o custo da hora pela dedicação ao laboratório.",
    rotulo: "nome",
    colunas: [
      { key: "nome", label: "Nome" },
      { key: "processo", label: "Processo" },
      { key: "valor_mes", label: "Valor/mês", tipo: "currency", alinhar: "right" },
      { key: "percentual_dedicado", label: "% dedicado", tipo: "percent", alinhar: "right" },
      { key: "custo_hora", label: "Custo/hora", tipo: "currency", alinhar: "right", calculada: true },
      { key: "valor_hh", label: "Valor HH", tipo: "currency", alinhar: "right", calculada: true },
    ],
    campos: [
      { name: "nome", label: "Nome", tipo: "text", obrigatorio: true, colSpan: 2 },
      {
        name: "processo",
        label: "Processo",
        tipo: "select",
        opcoes: [
          { value: "Laboratório", label: "Laboratório" },
          { value: "Bioinformática", label: "Bioinformática" },
        ],
      },
      { name: "valor_mes", label: "Valor mensal (R$)", tipo: "currency", obrigatorio: true, min: 0 },
      { name: "horas_mes_base", label: "Horas/mês base", tipo: "number", obrigatorio: true, min: 1, ajuda: "Horas trabalhadas por mês (ex.: 170)." },
      { name: "percentual_dedicado", label: "% dedicado ao laboratório", tipo: "percent", obrigatorio: true, min: 0, max: 100 },
    ],
  },

  fornecedores: {
    slug: "fornecedores",
    tabela: "fornecedores",
    titulo: "Fornecedores",
    singular: "fornecedor",
    subtitulo:
      "Fornecedores e prazos de entrega. Usados nos pedidos de compra e no cálculo do ponto de reposição.",
    rotulo: "nome",
    colunas: [
      { key: "nome", label: "Fornecedor" },
      { key: "contato", label: "Contato" },
      { key: "prazo_medio_dias", label: "Prazo médio (dias)", tipo: "number", alinhar: "right" },
      { key: "prazo_max_dias", label: "Prazo máx (dias)", tipo: "number", alinhar: "right" },
      { key: "ativo", label: "Ativo", tipo: "checkbox" },
    ],
    campos: [
      { name: "nome", label: "Nome", tipo: "text", obrigatorio: true, colSpan: 2 },
      { name: "contato", label: "Contato (e-mail/telefone)", tipo: "text", colSpan: 2 },
      { name: "catalogo_padrao", label: "Catálogo padrão", tipo: "text" },
      { name: "prazo_medio_dias", label: "Prazo médio (dias)", tipo: "number", min: 0 },
      { name: "prazo_max_dias", label: "Prazo máximo (dias)", tipo: "number", min: 0 },
      { name: "ativo", label: "Ativo", tipo: "checkbox" },
    ],
  },

  overhead: {
    slug: "overhead",
    tabela: "overhead",
    titulo: "Overhead",
    singular: "item de overhead",
    subtitulo:
      "Custos fixos rateados por hora de bancada. A parcela compensada define quanto entra no custo das análises.",
    rotulo: "item",
    colunas: [
      { key: "item", label: "Item" },
      { key: "custo_mensal", label: "Custo/mês", tipo: "currency", alinhar: "right" },
      { key: "percentual_compensada", label: "% compensada", tipo: "percent", alinhar: "right" },
      { key: "horas_bancada_mes", label: "Horas bancada/mês", tipo: "number", alinhar: "right" },
      { key: "custo_hora_bancada", label: "Custo/hora", tipo: "currency", alinhar: "right", calculada: true },
    ],
    campos: [
      { name: "item", label: "Item", tipo: "text", obrigatorio: true, colSpan: 2 },
      { name: "custo_mensal", label: "Custo mensal (R$)", tipo: "currency", obrigatorio: true, min: 0 },
      { name: "percentual_compensada", label: "% compensada", tipo: "percent", obrigatorio: true, min: 0, max: 100 },
      { name: "horas_bancada_mes", label: "Horas de bancada/mês", tipo: "number", obrigatorio: true, min: 1 },
    ],
  },
};
