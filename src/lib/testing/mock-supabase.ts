type Row = Record<string, unknown>;
type Store = Record<string, Row[]>;

const HISTORICAL_ANALISES: Row[] = [
  {
    codigo: "Eletrof_vir_hem",
    nome: "Eletroforese hemolinfa",
    nome_simplificado: "Eletroforese hemolinfa",
    descricao: "Gel para hemolinfa",
    status: "Ativo - ainda e feito",
    ativo: true,
    ofertavel: true,
  },
  {
    codigo: "Eletrof_vir_tec",
    nome: "Eletroforese tecido",
    nome_simplificado: "Eletroforese tecido",
    descricao: "Gel para tecido",
    status: "Ativo - ainda e feito",
    ativo: true,
    ofertavel: true,
  },
  {
    codigo: "Illumina_16S_AC",
    nome: "16S alta cobertura",
    nome_simplificado: "16S alta cobertura",
    descricao: "Sequenciamento focado em microbioma, com alta cobertura",
    status: "Ativo - oferecivel; manter alta cobertura",
    ativo: true,
    ofertavel: true,
  },
  {
    codigo: "Illumina_Sh",
    nome: "Shotgun",
    nome_simplificado: "Shotgun",
    descricao: "Sequenciamento shotgun, com qualquer marcador",
    status: "Ativo - TODO tecnico: revisar quantificacao de insumos",
    ativo: true,
    ofertavel: true,
  },
  {
    codigo: "Illumina_Sh_qPCR",
    nome: "Shotgun com qPCR",
    nome_simplificado: "Shotgun com qPCR",
    descricao: "Shotgun substituindo algumas etapas por qPCR para otimizacao de tempo e custo",
    status: "Experimental - em avaliacao; nao oferecer em orcamentos",
    ativo: false,
    ofertavel: false,
  },
  {
    codigo: "RTqPCR_RNA_virus_H",
    nome: "RT-qPCR virus hemolinfa",
    nome_simplificado: "RT-qPCR virus hemolinfa",
    descricao: "PCR em tempo real de virus 1",
    status: "Ativo - ainda e feito",
    ativo: true,
    ofertavel: true,
  },
  {
    codigo: "RTqPCR_RNA_virus_T",
    nome: "RT-qPCR virus tecidos",
    nome_simplificado: "RT-qPCR virus tecidos",
    descricao: "PCR em tempo real de virus 2",
    status: "Ativo - ainda e feito",
    ativo: true,
    ofertavel: true,
  },
  {
    codigo: "Sanger",
    nome: "Sanger",
    nome_simplificado: "Sanger",
    descricao: "Sequenciamento Sanger",
    status: "Ativo - ainda pode ser oferecido",
    ativo: true,
    ofertavel: true,
  },
  {
    codigo: "qPCR_F",
    nome: "qPCR com filtracao",
    nome_simplificado: "qPCR com filtracao",
    descricao: "PCR em tempo real com filtracao",
    status: "Ativo - ainda e feito",
    ativo: true,
    ofertavel: true,
  },
  {
    codigo: "qPCR_SF",
    nome: "qPCR sem filtracao",
    nome_simplificado: "qPCR sem filtracao",
    descricao: "PCR em tempo real sem filtracao",
    status: "Ativo - ainda e feito",
    ativo: true,
    ofertavel: true,
  },
];

const HISTORICAL_ANALISE_CODES = HISTORICAL_ANALISES.map((analise) => String(analise.codigo));

const MOCK_PERMISSOES_CATEGORIAS = [
  {
    papel: "tecnico",
    permissoes: {
      "orcamentos.visualizar": true,
      "orcamentos.criar_editar": true,
      "compras.solicitar": true,
      "estoque.movimentar": true,
      "analises.ver": true,
      "insumos.ver": true,
      "custeio.ver": true,
      "estoque.ver": true,
      "planejamento.ver": true,
      "pedido.ver": true,
      "pedido.criar": true,
      "compras.ver": true,
      "recebimento.ver": true,
      "projetos.ver": true,
      "cadastros.ver": true,
    },
  },
  {
    papel: "coordenador",
    permissoes: {
      "orcamentos.visualizar": true,
      "orcamentos.criar_editar": true,
      "orcamentos.emitir": true,
      "compras.solicitar": true,
      "compras.aprovar": true,
      "estoque.movimentar": true,
      "cadastros.editar": true,
      "analises.ver": true,
      "analises.editar": true,
      "insumos.ver": true,
      "insumos.editar": true,
      "custeio.ver": true,
      "estoque.ver": true,
      "estoque.lote.aceitar": true,
      "planejamento.ver": true,
      "planejamento.editar": true,
      "pedido.ver": true,
      "pedido.criar": true,
      "pedido.aprovar": true,
      "compras.ver": true,
      "compras.receber": true,
      "recebimento.ver": true,
      "recebimento.registrar": true,
      "projetos.ver": true,
      "projetos.editar": true,
      "cadastros.ver": true,
    },
  },
  {
    papel: "gestor",
    permissoes: {
      "orcamentos.visualizar": true,
      "orcamentos.criar_editar": true,
      "orcamentos.emitir": true,
      "orcamentos.cancelar": true,
      "compras.solicitar": true,
      "compras.aprovar": true,
      "estoque.movimentar": true,
      "estoque.descartar_bloquear": true,
      "cadastros.editar": true,
      "auditoria.visualizar": true,
      "analises.ver": true,
      "analises.editar": true,
      "insumos.ver": true,
      "insumos.editar": true,
      "custeio.ver": true,
      "estoque.ver": true,
      "estoque.lote.aceitar": true,
      "estoque.lote.gerir": true,
      "planejamento.ver": true,
      "planejamento.editar": true,
      "pedido.ver": true,
      "pedido.criar": true,
      "pedido.aprovar": true,
      "compras.ver": true,
      "compras.receber": true,
      "compras.cancelar": true,
      "recebimento.ver": true,
      "recebimento.registrar": true,
      "orcamento.parametros.editar": true,
      "projetos.ver": true,
      "projetos.editar": true,
      "cadastros.ver": true,
      "configuracoes.ver": true,
    },
  },
  {
    papel: "admin",
    permissoes: {
      "orcamentos.visualizar": true,
      "orcamentos.criar_editar": true,
      "orcamentos.emitir": true,
      "orcamentos.cancelar": true,
      "compras.solicitar": true,
      "compras.aprovar": true,
      "estoque.movimentar": true,
      "estoque.descartar_bloquear": true,
      "cadastros.editar": true,
      "usuarios.gerenciar": true,
      "auditoria.visualizar": true,
      "analises.ver": true,
      "analises.editar": true,
      "insumos.ver": true,
      "insumos.editar": true,
      "custeio.ver": true,
      "estoque.ver": true,
      "estoque.lote.aceitar": true,
      "estoque.lote.gerir": true,
      "planejamento.ver": true,
      "planejamento.editar": true,
      "pedido.ver": true,
      "pedido.criar": true,
      "pedido.aprovar": true,
      "compras.ver": true,
      "compras.receber": true,
      "compras.cancelar": true,
      "recebimento.ver": true,
      "recebimento.registrar": true,
      "orcamento.parametros.editar": true,
      "projetos.ver": true,
      "projetos.editar": true,
      "cadastros.ver": true,
      "backups.gerenciar": true,
      "privilegios.gerenciar": true,
      "configuracoes.ver": true,
    },
  },
];

const baseStore = (): Store => {
  const seed: Store = {
  orcamentos: [
    {
      id: 1,
      tipo: "analises",
      cliente_nome: "Cliente Demo",
      cliente_id: null,
      cliente_cnpj: null,
      cliente_endereco: null,
      cliente_contato: null,
      data_orcamento: "2026-06-14",
      validade_dias: 30,
      responsavel: "Kontrol",
      observacoes: null,
      status: "rascunho",
      projeto_id: null,
      criado_em: "2026-06-14T10:00:00.000Z",
    },
  ],
  orcamento_itens: [
    {
      id: 1,
      orcamento_id: 1,
      codigo_analise: "Illumina_16S_AC",
      n_amostras: 12,
      custo_unitario: 45,
      preco_unitario: 90,
    },
  ],
  orcamento_projetos: [],
  orcamento_final_versoes: [],
  eventos_status: [],
  orcamento_projeto_analises: [],
  orcamento_projeto_custos: [],
  demanda_analises: [],
  projetos: [{ id: 1, nome: "Projeto E2E" }],
  clientes: [{ id: 1, nome: "Cliente Cadastrado", ativo: true }],
  analises: HISTORICAL_ANALISES,
  etapas: HISTORICAL_ANALISE_CODES.map((codigo) => ({
    codigo_analise: codigo,
    nome_etapa: "Preparo",
    nome_atividade: codigo.includes("qPCR") ? "qPCR" : "Rotina laboratorial",
    execucoes_por_dia: 1,
    amostras_por_execucao: 12,
    tempo_maquina_h: 1,
    tempo_bancada_h: 2,
    escopo_operacional: "laboratorio",
  })),
  equipamentos: [{
    id: 1,
    nome: "Equipamento mock",
    quantidade: 1,
    custo_unitario: 30,
    vida_util_anos: 5,
    percentual_manutencao_anual: 0.05,
    manutencao_anual_fixa: 0,
    custo_hora: 30,
    ativo: true,
  }],
  equipamento_analise: HISTORICAL_ANALISE_CODES.map((codigo) => ({
    codigo_analise: codigo,
    equipamento_id: 1,
    peso_alocacao: 1,
    tempo_horas: 1,
    equipamentos: { custo_hora: 30 },
  })),
  tecnicos: [],
  overhead: [],
  insumo_analise: HISTORICAL_ANALISE_CODES.map((codigo, index) => ({
    codigo_analise: codigo,
    nome_etapa: "Preparo",
    nome_atividade: codigo.includes("qPCR") ? "qPCR" : "Rotina laboratorial",
    especificacao_insumo: `Insumo mock ${codigo}`,
    unidade: "un",
    grupo_escolha: null,
    quantidade_por_amostra: 1,
    modo_cobranca: "por_amostra",
    insumos: { custo_unitario: 20 + index },
  })),
  parametros: [
    { chave: "dias_uteis_ano", valor: 222 },
    { chave: "margem_lucro", valor: 100 },
    { chave: "impostos", valor: 0 },
    { chave: "taxas", valor: 0 },
    { chave: "fundo_reserva", valor: 0 },
    { chave: "fundo_investimento", valor: 0 },
  ],
  v_estoque_saldo: [
    {
      insumo_id: 1,
      especificacao: "Mix PCR",
      unidade: "uL",
      em_maos: 0,
      em_quarentena: 0,
      reservado: 0,
      disponivel: 0,
      ponto_reposicao: 10,
    },
  ],
  v_alertas_estoque: [
    {
      tipo: "reposicao",
      insumo_id: 1,
      especificacao: "Mix PCR",
      validade: null,
      valor: 0,
      referencia: 10,
    },
  ],
  pedidos_compra: [],
  planejamento: [],
  planejamento_itens: [],
  demandas: [],
  compras: [],
  movimentacoes_estoque: [],
  lotes_estoque: [],
  perfis: [{ id: "user-e2e", nome: "Admin E2E", email: "admin@example.com", papel: "admin" }],
  permissoes_categorias: MOCK_PERMISSOES_CATEGORIAS,
  notificacoes: [
    {
      id: 1,
      tipo: "falta_plano",
      titulo: "Falta de estoque no planejamento",
      corpo: "Mix PCR: falta 10 uL no planejamento #1.",
      entidade_tipo: "planejamento",
      entidade_id: 1,
      papel_destino: "coordenador",
      status: "nao_lida",
      canal: "in_app",
      dedupe_key: "e2e:falta-plano",
      criado_em: "2026-06-20T10:00:00.000Z",
      lida_em: null,
    },
  ],
  v_dashboard_executivo: [
    {
      valor_estoque_ativo: 0,
      valor_vencendo_horizonte: 0,
      lotes_vencendo_horizonte: 0,
      orcamentos_rascunho: 1,
      orcamentos_enviados: 0,
      orcamentos_aprovados: 0,
      orcamentos_perdidos: 0,
      margem_media_pct: 0,
      compras_abertas_valor: 0,
      gasto_por_projeto_mes: [],
    },
  ],
  };

  // Fixtures exclusivas do modo e2e (dev server com PLAYWRIGHT_MOCK_SUPABASE=1).
  // Unit tests NAO setam esse env, entao a store minima deles permanece intacta.
  // Monta uma demanda MISTA (laboratorio + projeto) para renderizar a etapa de
  // Parametros Economicos em /orcamento/demandas/1.
  if (process.env.PLAYWRIGHT_MOCK_SUPABASE === "1") {
    seed.demandas_propostas = [
      {
        id: 1,
        titulo: "Demanda Demo — Projeto + Análises",
        cliente_id: 1,
        cliente_nome: "Cliente Demo",
        modalidade: "projeto_analises_custos",
        projeto_id: 1,
        descricao: "Demanda de demonstração para a etapa de parâmetros.",
        escopo_preliminar: "Escopo demonstrativo com laboratório e projeto.",
        matriz_amostra: "Solo",
        quantidade_amostras_estimada: 12,
        prazo_tecnico_dias: 30,
        criado_em: "2026-06-21T10:00:00.000Z",
      },
    ];
    seed.orcamentos.push({
      id: 2,
      demanda_id: 1,
      tipo: "analises",
      cliente_nome: "Cliente Demo",
      status: "enviado",
      status_operacional: "revisado",
      responsavel_tecnico: "Responsavel E2E",
      data_orcamento: "2026-06-21",
      criado_em: "2026-06-21T10:00:00.000Z",
    });
    seed.orcamento_itens.push({
      id: 2,
      orcamento_id: 2,
      codigo_analise: "Illumina_16S_AC",
      n_amostras: 12,
      custo_unitario: 45,
      preco_unitario: 90,
    });
    seed.orcamento_itens.push({
      id: 3,
      orcamento_id: 2,
      codigo_analise: "qPCR_F",
      n_amostras: 5,
      custo_unitario: 40,
      preco_unitario: 80,
    });
    seed.demanda_analises = [
      {
        id: 1,
        demanda_id: 1,
        codigo_analise: "Illumina_16S_AC",
        quantidade_amostras: 12,
        origem_quantidade: "padrao",
        status_custeio: "disponivel",
      },
      {
        id: 2,
        demanda_id: 1,
        codigo_analise: "qPCR_F",
        quantidade_amostras: 5,
        origem_quantidade: "manual",
        status_custeio: "disponivel",
      },
    ];
    seed.orcamento_projetos = [
      {
        id: 1,
        demanda_id: 1,
        titulo: "Projeto Demo",
        status: "enviado",
        data_orcamento: "2026-06-21",
        impostos: 0,
        margem_lucro: 0,
        impostos_legacy: 10,
        incubacao: 5,
        reserva: 5,
        investimentos: 5,
        lucro: 20,
        projeto_sem_custo_justificativa: null,
        criado_em: "2026-06-21T10:00:00.000Z",
      },
    ];
    seed.orcamento_projeto_custos = [
      {
        id: 1,
        orcamento_projeto_id: 1,
        rubrica: "MC",
        quantidade: 1,
        custo_unitario: 500,
        preco_unitario: 500,
        meses_selecionados: [],
      },
    ];
  }

  return seed;
};

const store = (globalThis as typeof globalThis & { __kontrolMockStore?: Store }).__kontrolMockStore ?? baseStore();
(globalThis as typeof globalThis & { __kontrolMockStore?: Store }).__kontrolMockStore = store;

export function resetMockSupabaseStore() {
  const fresh = baseStore();
  for (const key of Object.keys(store)) delete store[key];
  Object.assign(store, fresh);
}

export function getMockSupabaseStore() {
  return store;
}

const nextId = (table: string) =>
  Math.max(0, ...((store[table] ?? []) as Row[]).map((row) => Number(row.id) || 0)) + 1;

function valoresIguais(a: unknown, b: unknown) {
  return a === b || String(a) === String(b);
}

function compararValores(a: unknown, b: unknown) {
  const numeroA = Number(a);
  const numeroB = Number(b);
  if (Number.isFinite(numeroA) && Number.isFinite(numeroB)) return numeroA - numeroB;
  return String(a).localeCompare(String(b));
}

function withRelations(table: string, row: Row): Row {
  if (table === "orcamentos") {
    return {
      ...row,
      orcamento_itens: store.orcamento_itens.filter((item) => item.orcamento_id === row.id),
    };
  }
  if (table === "orcamento_projetos") {
    return {
      ...row,
      orcamento_projeto_analises: store.orcamento_projeto_analises.filter((item) => item.orcamento_projeto_id === row.id),
      orcamento_projeto_custos: store.orcamento_projeto_custos.filter((item) => item.orcamento_projeto_id === row.id),
    };
  }
  if (table === "lotes_estoque") {
    const saldo = store.v_estoque_saldo.find((item) => item.insumo_id === row.insumo_id);
    return {
      ...row,
      insumos: { especificacao: saldo?.especificacao ?? "Mix PCR", unidade: saldo?.unidade ?? "uL" },
    };
  }
  return row;
}

class MockQuery {
  private filters: { column: string; value: unknown }[] = [];
  private neqFilters: { column: string; value: unknown }[] = [];
  private inFilters: { column: string; values: unknown[] }[] = [];
  private notFilters: { column: string; values: string[] }[] = [];
  private isFilters: { column: string; value: null }[] = [];
  private comparisonFilters: { column: string; operator: "gt" | "gte" | "lt" | "lte"; value: unknown }[] = [];
  private mutation: null | { type: "insert" | "update" | "delete" | "upsert"; payload?: Row | Row[] } = null;

  constructor(private table: string) {}

  select(_columns?: string) {
    void _columns;
    return this;
  }

  order() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  neq(column: string, value: unknown) {
    this.neqFilters.push({ column, value });
    return this;
  }

  in(column: string, values: unknown[]) {
    this.inFilters.push({ column, values });
    return this;
  }

  is(column: string, value: null) {
    // Suporta apenas `.is(coluna, null)`, o unico uso no app.
    this.isFilters.push({ column, value });
    return this;
  }

  limit() {
    return this;
  }

  range() {
    return this;
  }

  gt(column: string, value: unknown) {
    this.comparisonFilters.push({ column, operator: "gt", value });
    return this;
  }

  gte(column: string, value: unknown) {
    this.comparisonFilters.push({ column, operator: "gte", value });
    return this;
  }

  lt(column: string, value: unknown) {
    this.comparisonFilters.push({ column, operator: "lt", value });
    return this;
  }

  lte(column: string, value: unknown) {
    this.comparisonFilters.push({ column, operator: "lte", value });
    return this;
  }

  not(column: string, operator: string, rawValue: string) {
    if (operator === "in") {
      this.notFilters.push({
        column,
        values: rawValue.replace(/[()]/g, "").split(",").map((value) => value.trim()),
      });
    }
    return this;
  }

  insert(payload: Row | Row[]) {
    const rows = Array.isArray(payload) ? payload : [payload];
    const inserted = rows.map((row) => ({
      id: row.id ?? nextId(this.table),
      criado_em: row.criado_em ?? new Date().toISOString(),
      status: row.status ?? "rascunho",
      ...row,
    }));
    store[this.table] = [...(store[this.table] ?? []), ...inserted];
    this.mutation = { type: "insert", payload: inserted };
    return this;
  }

  update(payload: Row) {
    this.mutation = { type: "update", payload };
    return this;
  }

  upsert(payload: Row | Row[]) {
    this.mutation = { type: "upsert", payload };
    return this;
  }

  delete() {
    this.mutation = { type: "delete" };
    return this;
  }

  single() {
    return this.then((result) => ({
      ...result,
      data: Array.isArray(result.data) ? (result.data[0] ?? null) : result.data,
    }));
  }

  maybeSingle() {
    return this.single();
  }

  then<TResult1 = { data: unknown; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private execute() {
    if (this.mutation?.type === "update") {
      store[this.table] = (store[this.table] ?? []).map((row) =>
        this.matches(row) ? { ...row, ...(this.mutation?.payload as Row) } : row,
      );
    }
    if (this.mutation?.type === "delete") {
      store[this.table] = (store[this.table] ?? []).filter((row) => !this.matches(row));
    }
    if (this.mutation?.type === "upsert") {
      const rows = Array.isArray(this.mutation.payload) ? this.mutation.payload : [this.mutation.payload];
      for (const row of rows.filter(Boolean) as Row[]) {
        const key = "chave" in row ? "chave" : "papel" in row ? "papel" : "id";
        const index = (store[this.table] ?? []).findIndex((current) => current[key] === row[key]);
        if (index >= 0) store[this.table][index] = { ...store[this.table][index], ...row };
        else store[this.table] = [...(store[this.table] ?? []), { id: row.id ?? nextId(this.table), ...row }];
      }
    }

    const source =
      this.mutation?.type === "insert"
        ? (this.mutation.payload as Row[])
        : (store[this.table] ?? []).filter((row) => this.matches(row));
    return { data: source.map((row) => withRelations(this.table, row)), error: null };
  }

  private matches(row: Row) {
    return (
      this.filters.every((filter) => valoresIguais(row[filter.column], filter.value)) &&
      this.neqFilters.every((filter) => !valoresIguais(row[filter.column], filter.value)) &&
      this.inFilters.every((filter) => filter.values.some((value) => valoresIguais(row[filter.column], value))) &&
      this.notFilters.every((filter) => !filter.values.includes(String(row[filter.column]))) &&
      this.isFilters.every((filter) => (row[filter.column] ?? null) === filter.value) &&
      this.comparisonFilters.every((filter) => {
        const comparison = compararValores(row[filter.column], filter.value);
        if (filter.operator === "gt") return comparison > 0;
        if (filter.operator === "gte") return comparison >= 0;
        if (filter.operator === "lt") return comparison < 0;
        return comparison <= 0;
      })
    );
  }
}

function receiveLot(args: Row) {
  const saldo = store.v_estoque_saldo.find((item) => item.insumo_id === args.p_insumo_id);
  const lote = {
    id: nextId("lotes_estoque"),
    insumo_id: args.p_insumo_id,
    codigo_lote: args.p_codigo ?? `L-${Date.now()}`,
    validade: args.p_validade ?? null,
    quantidade_atual: Number(args.p_quantidade),
    status: "quarentena",
  };
  store.lotes_estoque.push(lote);
  if (saldo) {
    saldo.em_maos = Number(saldo.em_maos ?? 0) + lote.quantidade_atual;
    saldo.em_quarentena = Number(saldo.em_quarentena ?? 0) + lote.quantidade_atual;
  }
}

function setLotStatus(loteId: number, status: string) {
  const lote = store.lotes_estoque.find((row) => row.id === loteId);
  if (lote) lote.status = status;
}

function baixarManualLote(args: Row) {
  const lote = store.lotes_estoque.find((row) => row.id === args.p_lote_id);
  if (!lote) return;
  const quantidade = Number(args.p_quantidade);
  const atual = Number(lote.quantidade_atual ?? 0);
  lote.quantidade_atual = Math.max(0, atual - quantidade);
  lote.status = Number(lote.quantidade_atual) <= 0 ? "consumido" : "em_uso";
}

function ajustarSaldoLote(args: Row) {
  const lote = store.lotes_estoque.find((row) => row.id === args.p_lote_id);
  if (!lote) return;
  lote.quantidade_atual = Number(args.p_quantidade_nova);
  if (Number(lote.quantidade_atual) <= 0) lote.status = "consumido";
}

function sincronizarDemandaAnalises(args: Row) {
  const demandaId = Number(args.p_demanda_id);
  const itens = Array.isArray(args.p_itens) ? args.p_itens as Row[] : [];
  const exigeLaboratorio = args.p_exige_laboratorio !== false;
  const backup = {
    demanda_analises: [...(store.demanda_analises ?? [])],
    orcamento_itens: [...(store.orcamento_itens ?? [])],
    orcamentos: [...(store.orcamentos ?? [])],
  };

  try {
    const demanda = store.demandas_propostas?.find((row) => Number(row.id) === demandaId);
    if (!demanda) throw new Error(`Demanda ${demandaId} nao encontrada`);
    if (itens.some((item) => item.codigo_analise === "FORCAR-FALHA-RPC")) {
      throw new Error("Falha simulada na RPC de sincronização");
    }

    let orcamento = store.orcamentos.find((row) => Number(row.demanda_id) === demandaId && row.status !== "cancelado");
    if (exigeLaboratorio) {
      if (orcamento && orcamento.status !== "rascunho") {
        throw new Error("Somente orcamento laboratorial em rascunho pode ser sincronizado pela demanda");
      }
      if (!orcamento) {
        orcamento = {
          id: nextId("orcamentos"),
          demanda_id: demandaId,
          tipo: "analises",
          cliente_nome: demanda.cliente_nome ?? demanda.titulo ?? "Cliente",
          status: "rascunho",
          criado_em: new Date().toISOString(),
        };
        store.orcamentos.push(orcamento);
      }
    }

    store.demanda_analises = (store.demanda_analises ?? []).filter((row) => Number(row.demanda_id) !== demandaId);
    for (const item of itens) {
      store.demanda_analises.push({
        id: nextId("demanda_analises"),
        demanda_id: demandaId,
        codigo_analise: item.codigo_analise,
        quantidade_amostras: item.quantidade_amostras,
        origem_quantidade: item.origem_quantidade ?? "padrao",
        status_custeio: item.status_custeio ?? "pendente",
      });
    }

    if (exigeLaboratorio && orcamento) {
      const codigos = itens.map((item) => item.codigo_analise);
      store.orcamento_itens = (store.orcamento_itens ?? []).filter(
        (row) => Number(row.orcamento_id) !== Number(orcamento.id) || codigos.includes(row.codigo_analise),
      );
      for (const item of itens) {
        const existente = store.orcamento_itens.find(
          (row) => Number(row.orcamento_id) === Number(orcamento?.id) && row.codigo_analise === item.codigo_analise,
        );
        const payload = {
          orcamento_id: orcamento.id,
          codigo_analise: item.codigo_analise,
          n_amostras: item.quantidade_amostras,
          custo_unitario: item.custo_unitario ?? 0,
          preco_unitario: item.preco_unitario ?? 0,
          valor_snapshot: item.valor_snapshot ?? {},
        };
        if (existente) Object.assign(existente, payload);
        else store.orcamento_itens.push({ id: nextId("orcamento_itens"), ...payload });
      }
      orcamento.status_operacional = itens.length > 0 ? "preenchido" : "pendente";
      orcamento.status_operacional_atualizado_em = new Date().toISOString();
    }

    return {
      registradas: itens.length,
      pendentes: itens.filter((item) => item.status_custeio !== "disponivel").length,
      orcamento_id: orcamento?.id ?? null,
    };
  } catch (error) {
    store.demanda_analises = backup.demanda_analises;
    store.orcamento_itens = backup.orcamento_itens;
    store.orcamentos = backup.orcamentos;
    throw error;
  }
}

function emitirOrcamentoFinalTransacional(args: Row) {
  const demandaId = Number(args.p_demanda_id);
  const versoesDaDemanda = (store.orcamento_final_versoes ?? []).filter((row) => Number(row.demanda_id) === demandaId);
  const versao = Math.max(0, ...versoesDaDemanda.map((row) => Number(row.versao) || 0)) + 1;
  const id = nextId("orcamento_final_versoes");
  const numero = `OF-2026-${String(demandaId).padStart(4, "0")}-v${versao}`;
  const criadoEm = new Date().toISOString();
  const validadeDias = Number(args.p_validade_dias ?? 30);
  const validoAte = new Date(Date.now() + validadeDias * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  store.orcamento_final_versoes = (store.orcamento_final_versoes ?? []).map((row) =>
    Number(row.demanda_id) === demandaId && row.status === "emitido"
      ? { ...row, status: "substituido", substituido_em: criadoEm }
      : row,
  );

  const versaoFinal = {
    id,
    demanda_id: demandaId,
    versao,
    numero,
    status: "emitido",
    total_laboratorio_custo: args.p_total_laboratorio_custo,
    total_laboratorio_preco: args.p_total_laboratorio_preco,
    total_projeto_custo: args.p_total_projeto_custo,
    total_projeto_final: args.p_total_projeto_final,
    total_final: args.p_total_final,
    snapshot: args.p_snapshot,
    parametros: args.p_parametros,
    criado_por: args.p_criado_por,
    criado_em: criadoEm,
    valido_ate: validoAte,
  };
  store.orcamento_final_versoes.push(versaoFinal);

  store.demandas_propostas = (store.demandas_propostas ?? []).map((row) =>
    Number(row.id) === demandaId ? { ...row, status: "orcada", atualizado_em: criadoEm } : row,
  );
  store.eventos_status = [
    ...(store.eventos_status ?? []),
    {
      id: nextId("eventos_status"),
      entidade_tipo: "demanda_proposta",
      entidade_id: demandaId,
      status_novo: "orcada",
      observacao: `Versao final ${numero} emitida via mock e2e.`,
      criado_em: criadoEm,
      usuario_email: args.p_usuario_email ?? null,
    },
  ];

  return { versao_id: id, versao, numero };
}

export function createMockSupabaseClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: "user-e2e", email: "admin@example.com" } }, error: null }),
    },
    from: (table: string) => new MockQuery(table),
    rpc: async (fn: string, args: Row) => {
      if (fn === "receber_lote" || fn === "entrada_inventario") receiveLot(args);
      if (fn === "aceitar_lote") setLotStatus(Number(args.p_lote_id), "aceito");
      if (fn === "bloquear_lote") setLotStatus(Number(args.p_lote_id), "bloqueado");
      if (fn === "desbloquear_lote") setLotStatus(Number(args.p_lote_id), "aceito");
      if (fn === "descartar_lote") setLotStatus(Number(args.p_lote_id), "descartado");
      if (fn === "baixa_manual_lote") baixarManualLote(args);
      if (fn === "ajustar_saldo_lote") ajustarSaldoLote(args);
      if (fn === "sincronizar_demanda_analises") {
        try {
          return { data: sincronizarDemandaAnalises(args), error: null };
        } catch (error) {
          return { data: null, error: { message: error instanceof Error ? error.message : "Erro na RPC" } };
        }
      }
      if (fn === "emitir_orcamento_final_transacional") return { data: emitirOrcamentoFinalTransacional(args), error: null };
      return { data: null, error: null };
    },
  };
}

