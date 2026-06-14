/**
 * Configuração declarativa dos cadastros (elementos de custo).
 * Dados serializáveis — compartilhados entre Server Components (páginas) e
 * Client Components (formulário/drawer). Sem imports de servidor aqui.
 *
 * Cada categoria expõe TODOS os campos da tabela, agrupados por seção; os
 * dados vêm importados da planilha e o usuário ajusta livremente — ao salvar,
 * o app revalida e recalcula tudo que depende (custeio, orçamentos, estoque…).
 */

export type CampoTipo =
  | "text"
  | "textarea"
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
  /** preenche as opções dinamicamente no servidor (ex.: lista de fornecedores) */
  opcoesDe?: "fornecedores" | "clientes" | "projetos";
  ajuda?: string;
  colSpan?: 1 | 2;
  placeholder?: string;
  /** título de seção; o primeiro campo de cada seção carrega o rótulo */
  grupo?: string;
  /** checkbox marcado por padrão ao criar um novo registro */
  padraoLigado?: boolean;
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
  clientes: {
    slug: "clientes",
    tabela: "clientes",
    titulo: "Clientes",
    singular: "cliente",
    subtitulo:
      "Cadastro de clientes. Vinculados aos orçamentos e, através dos projetos, aos planejamentos e compras.",
    rotulo: "nome",
    colunas: [
      { key: "nome", label: "Cliente" },
      { key: "cnpj", label: "CNPJ" },
      { key: "contato", label: "Contato" },
      { key: "email", label: "E-mail" },
      { key: "telefone", label: "Telefone" },
      { key: "ativo", label: "Ativo", tipo: "checkbox" },
    ],
    campos: [
      { name: "nome", label: "Razão social / nome", tipo: "text", obrigatorio: true, colSpan: 2, grupo: "Identificação" },
      { name: "cnpj", label: "CNPJ / CPF", tipo: "text", placeholder: "00.000.000/0000-00" },
      { name: "ativo", label: "Ativo", tipo: "checkbox", padraoLigado: true },

      { name: "contato", label: "Responsável / comprador", tipo: "text", colSpan: 2, grupo: "Contato" },
      { name: "email", label: "E-mail", tipo: "text" },
      { name: "telefone", label: "Telefone", tipo: "text" },

      { name: "endereco", label: "Endereço", tipo: "text", colSpan: 2, grupo: "Endereço" },

      { name: "observacoes", label: "Observações", tipo: "textarea", colSpan: 2, grupo: "Observações" },
    ],
  },

  projetos: {
    slug: "projetos",
    tabela: "projetos",
    titulo: "Projetos",
    singular: "projeto",
    subtitulo:
      "Trabalhos do laboratório. Cada projeto pertence a um cliente e amarra orçamentos, planejamentos e compras relacionados.",
    rotulo: "nome",
    colunas: [
      { key: "nome", label: "Projeto" },
      { key: "cliente_nome", label: "Cliente" },
      { key: "responsavel", label: "Responsável" },
      { key: "data_inicio", label: "Início", tipo: "date" },
      { key: "data_fim", label: "Fim", tipo: "date" },
      { key: "status", label: "Status" },
    ],
    campos: [
      { name: "nome", label: "Nome do projeto", tipo: "text", obrigatorio: true, colSpan: 2, grupo: "Identificação" },
      { name: "cliente_id", label: "Cliente", tipo: "select", opcoesDe: "clientes" },
      { name: "responsavel", label: "Responsável (laboratório)", tipo: "text" },
      {
        name: "status",
        label: "Status",
        tipo: "select",
        opcoes: [
          { value: "proposto", label: "Proposto" },
          { value: "ativo", label: "Ativo" },
          { value: "concluido", label: "Concluído" },
          { value: "cancelado", label: "Cancelado" },
        ],
      },

      { name: "data_inicio", label: "Data de início", tipo: "date", grupo: "Prazos" },
      { name: "data_fim", label: "Data de término", tipo: "date" },

      { name: "descricao", label: "Descrição / escopo", tipo: "textarea", colSpan: 2, grupo: "Descrição" },
    ],
  },

  equipamentos: {
    slug: "equipamentos",
    tabela: "equipamentos",
    titulo: "Equipamentos",
    singular: "equipamento",
    subtitulo:
      "Inventário de equipamentos. O custo/dia usa depreciação linear pela vida útil + manutenção, rateado pelos dias úteis/ano. Alterações recalculam o custeio e os orçamentos.",
    rotulo: "nome",
    colunas: [
      { key: "nome", label: "Equipamento" },
      { key: "quantidade", label: "Qtd", tipo: "number", alinhar: "right" },
      { key: "custo_unitario", label: "Custo un.", tipo: "currency", alinhar: "right" },
      { key: "vida_util_anos", label: "Vida útil (anos)", tipo: "number", alinhar: "right" },
      { key: "custo_dia", label: "Custo/dia", tipo: "currency", alinhar: "right", calculada: true },
    ],
    campos: [
      { name: "nome", label: "Nome", tipo: "text", obrigatorio: true, colSpan: 2, grupo: "Identificação" },
      { name: "possui", label: "Possui no laboratório", tipo: "checkbox" },

      { name: "quantidade", label: "Quantidade", tipo: "number", obrigatorio: true, min: 0, step: "1", grupo: "Aquisição e valor" },
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
        grupo: "Manutenção",
      },
      {
        name: "manutencao_anual_fixa",
        label: "Manutenção anual fixa (R$)",
        tipo: "currency",
        min: 0,
        ajuda: "Opcional — contrato de manutenção; substitui a fração acima.",
      },
    ],
  },

  insumos: {
    slug: "insumos",
    tabela: "insumos",
    titulo: "Insumos",
    singular: "insumo",
    subtitulo:
      "Catálogo completo de reagentes e consumíveis: marca, embalagem, fornecedor, compra, política de estoque e armazenamento. O custo unitário é derivado do valor e da quantidade da embalagem.",
    rotulo: "especificacao",
    colunas: [
      { key: "nome_item", label: "Categoria" },
      { key: "especificacao", label: "Especificação" },
      { key: "fabricante", label: "Marca" },
      { key: "custo_total_embalagem", label: "Embalagem (R$)", tipo: "currency", alinhar: "right" },
      { key: "quantidade_embalagem", label: "Qtd emb.", tipo: "number", alinhar: "right" },
      { key: "unidade", label: "Un." },
      { key: "custo_unitario", label: "Custo un.", tipo: "currency", alinhar: "right", calculada: true },
      { key: "ponto_reposicao", label: "Ponto repos.", tipo: "number", alinhar: "right" },
    ],
    campos: [
      { name: "nome_item", label: "Categoria", tipo: "text", placeholder: "Ladder, Beads, Kit Illumina…", grupo: "Identificação" },
      { name: "especificacao", label: "Especificação", tipo: "text", obrigatorio: true, colSpan: 2, ajuda: "Identificador único do insumo." },
      { name: "fabricante", label: "Marca / fabricante", tipo: "text", placeholder: "Qiagen, Illumina, KASVI…" },
      { name: "codigo_fabricante", label: "Código do fabricante", tipo: "text", placeholder: "Catálogo / part number" },
      { name: "codigo_interno", label: "Código interno", tipo: "text" },

      { name: "custo_total_embalagem", label: "Valor da embalagem (R$)", tipo: "currency", obrigatorio: true, min: 0, grupo: "Embalagem e custo" },
      { name: "quantidade_embalagem", label: "Quantidade na embalagem", tipo: "number", obrigatorio: true, min: 0 },
      { name: "unidade", label: "Unidade", tipo: "text", placeholder: "uL, reações, un, mL…" },

      { name: "data_aquisicao", label: "Data da última compra", tipo: "date", grupo: "Compra e fornecedor" },
      { name: "fornecedor_id", label: "Fornecedor principal", tipo: "select", opcoesDe: "fornecedores" },
      { name: "fornecedor_alt_id", label: "Fornecedor alternativo", tipo: "select", opcoesDe: "fornecedores" },
      {
        name: "categoria_compra",
        label: "Categoria de compra",
        tipo: "select",
        opcoes: [
          { value: "normal", label: "Normal" },
          { value: "critico", label: "Crítico" },
        ],
        ajuda: "Crítico recebe destaque nas sugestões de compra.",
      },
      { name: "quantidade_minima_compra", label: "Quantidade mínima de compra", tipo: "number", min: 0 },
      { name: "prazo_entrega_max_dias", label: "Prazo de entrega máx. (dias)", tipo: "number", min: 0 },

      { name: "ponto_reposicao", label: "Ponto de reposição", tipo: "number", min: 0, ajuda: "Dispara alerta quando o disponível cai até aqui.", grupo: "Estoque e reposição" },
      { name: "estoque_seguranca", label: "Estoque de segurança", tipo: "number", min: 0 },
      { name: "lead_time_dias", label: "Lead time (dias)", tipo: "number", min: 0, ajuda: "Prazo típico de reposição." },

      {
        name: "condicao_armazenamento",
        label: "Condição de armazenamento",
        tipo: "text",
        colSpan: 2,
        placeholder: "−20 °C, 2–8 °C, temperatura ambiente…",
        grupo: "Armazenamento e validade",
      },
      {
        name: "validade_apos_abertura_dias",
        label: "Validade após abertura (dias)",
        tipo: "number",
        min: 0,
        ajuda: "A validade de cada lote recebido é registrada em Estoque → Lotes.",
      },
      { name: "sds_url", label: "Ficha de segurança (URL do SDS)", tipo: "text", colSpan: 2 },
    ],
  },

  tecnicos: {
    slug: "tecnicos",
    tabela: "tecnicos",
    titulo: "Técnicos",
    singular: "técnico",
    subtitulo:
      "Pessoal e dedicação. O valor-hora (HH) considera o custo da hora pela dedicação ao laboratório. Entra no custo analítico das análises.",
    rotulo: "nome",
    colunas: [
      { key: "nome", label: "Nome" },
      { key: "processo", label: "Processo" },
      { key: "valor_mes", label: "Valor/mês", tipo: "currency", alinhar: "right" },
      { key: "horas_mes_base", label: "Horas/mês", tipo: "number", alinhar: "right" },
      { key: "percentual_dedicado", label: "% dedicado", tipo: "percent", alinhar: "right" },
      { key: "custo_hora", label: "Custo/hora", tipo: "currency", alinhar: "right", calculada: true },
      { key: "valor_hh", label: "Valor HH", tipo: "currency", alinhar: "right", calculada: true },
    ],
    campos: [
      { name: "nome", label: "Nome", tipo: "text", obrigatorio: true, colSpan: 2, grupo: "Identificação" },
      {
        name: "processo",
        label: "Processo",
        tipo: "select",
        opcoes: [
          { value: "Laboratório", label: "Laboratório" },
          { value: "Bioinformática", label: "Bioinformática" },
        ],
      },

      { name: "valor_mes", label: "Valor mensal (R$)", tipo: "currency", obrigatorio: true, min: 0, grupo: "Custo e dedicação" },
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
      "Cadastro completo de fornecedores: identificação fiscal, contato, endereço e prazos. Usados nos insumos, nos pedidos de compra e no cálculo do ponto de reposição.",
    rotulo: "nome",
    colunas: [
      { key: "nome", label: "Fornecedor" },
      { key: "cnpj", label: "CNPJ" },
      { key: "email", label: "E-mail" },
      { key: "telefone", label: "Telefone" },
      { key: "prazo_medio_dias", label: "Prazo médio (dias)", tipo: "number", alinhar: "right" },
      { key: "ativo", label: "Ativo", tipo: "checkbox" },
    ],
    campos: [
      { name: "nome", label: "Razão social / nome", tipo: "text", obrigatorio: true, colSpan: 2, grupo: "Identificação" },
      { name: "cnpj", label: "CNPJ", tipo: "text", placeholder: "00.000.000/0000-00" },
      { name: "ativo", label: "Ativo", tipo: "checkbox", padraoLigado: true },

      { name: "contato", label: "Vendedor / representante", tipo: "text", colSpan: 2, grupo: "Contato" },
      { name: "email", label: "E-mail", tipo: "text" },
      { name: "telefone", label: "Telefone", tipo: "text" },
      { name: "site", label: "Site", tipo: "text", colSpan: 2 },

      { name: "endereco", label: "Endereço", tipo: "text", colSpan: 2, grupo: "Endereço" },

      { name: "catalogo_padrao", label: "Catálogo padrão", tipo: "text", grupo: "Compras e prazos" },
      { name: "prazo_medio_dias", label: "Prazo médio (dias)", tipo: "number", min: 0 },
      { name: "prazo_max_dias", label: "Prazo máximo (dias)", tipo: "number", min: 0 },

      { name: "observacoes", label: "Observações", tipo: "textarea", colSpan: 2, grupo: "Observações" },
    ],
  },

  locais: {
    slug: "locais",
    tabela: "locais",
    titulo: "Locais",
    singular: "local",
    subtitulo:
      "Locais físicos de armazenamento, como prédio, sala, freezer, geladeira, gaveta, caixa, rack ou posição.",
    rotulo: "nome",
    colunas: [
      { key: "nome", label: "Local" },
      { key: "tipo", label: "Tipo" },
      { key: "condicao_armazenamento", label: "Condição" },
    ],
    campos: [
      { name: "nome", label: "Nome do local", tipo: "text", obrigatorio: true, colSpan: 2, grupo: "Identificação" },
      {
        name: "tipo",
        label: "Tipo",
        tipo: "select",
        opcoes: [
          { value: "predio", label: "Prédio" },
          { value: "sala", label: "Sala" },
          { value: "freezer", label: "Freezer" },
          { value: "geladeira", label: "Geladeira" },
          { value: "armario", label: "Armário" },
          { value: "gaveta", label: "Gaveta" },
          { value: "caixa", label: "Caixa" },
          { value: "rack", label: "Rack" },
          { value: "posicao", label: "Posição" },
        ],
      },
      {
        name: "condicao_armazenamento",
        label: "Condição de armazenamento",
        tipo: "text",
        placeholder: "-20 °C, 2-8 °C, ambiente...",
      },
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
      { name: "item", label: "Item", tipo: "text", obrigatorio: true, colSpan: 2, grupo: "Identificação" },
      { name: "custo_mensal", label: "Custo mensal (R$)", tipo: "currency", obrigatorio: true, min: 0, grupo: "Rateio" },
      { name: "percentual_compensada", label: "% compensada", tipo: "percent", obrigatorio: true, min: 0, max: 100 },
      { name: "horas_bancada_mes", label: "Horas de bancada/mês", tipo: "number", obrigatorio: true, min: 1 },
    ],
  },
};
