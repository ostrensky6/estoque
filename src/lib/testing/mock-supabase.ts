type Row = Record<string, unknown>;
type Store = Record<string, Row[]>;

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
      codigo_analise: "TESTE-16S",
      n_amostras: 12,
      custo_unitario: 45,
      preco_unitario: 90,
    },
  ],
  orcamento_projetos: [],
  orcamento_projeto_analises: [],
  orcamento_projeto_custos: [],
  demanda_analises: [],
  projetos: [{ id: 1, nome: "Projeto E2E" }],
  clientes: [{ id: 1, nome: "Cliente Cadastrado", ativo: true }],
  analises: [
    { codigo: "TESTE-16S", nome: "Metagenomica 16S", ativo: true },
    { codigo: "TESTE-QPCR", nome: "qPCR marcador alvo", ativo: true },
  ],
  etapas: [
    {
      codigo_analise: "TESTE-16S",
      nome_etapa: "Preparo",
      nome_atividade: "PCR",
      execucoes_por_dia: 1,
      amostras_por_execucao: 12,
      tempo_maquina_h: 0,
      tempo_bancada_h: 6,
    },
    {
      codigo_analise: "TESTE-QPCR",
      nome_etapa: "Amplificação",
      nome_atividade: "qPCR",
      execucoes_por_dia: 2,
      amostras_por_execucao: 8,
      tempo_maquina_h: 1,
      tempo_bancada_h: 2,
    },
  ],
  equipamentos: [],
  equipamento_analise: [],
  tecnicos: [],
  overhead: [],
  insumo_analise: [
    {
      codigo_analise: "TESTE-16S",
      nome_etapa: "Preparo",
      nome_atividade: "PCR",
      especificacao_insumo: "Mix PCR",
      grupo_escolha: null,
      quantidade_por_amostra: 1,
      modo_cobranca: "por_amostra",
      insumos: { custo_unitario: 45 },
    },
    {
      codigo_analise: "TESTE-16S",
      nome_etapa: "Preparo",
      nome_atividade: "PCR",
      especificacao_insumo: "Kit corrida 16S",
      unidade: "kit",
      grupo_escolha: null,
      quantidade_por_amostra: 1,
      modo_cobranca: "por_execucao",
      insumos: { custo_unitario: 10 },
    },
    {
      codigo_analise: "TESTE-QPCR",
      nome_etapa: "Amplificação",
      nome_atividade: "qPCR",
      especificacao_insumo: "Master Mix qPCR",
      unidade: "uL",
      grupo_escolha: null,
      quantidade_por_amostra: 2,
      modo_cobranca: "por_amostra",
      insumos: { custo_unitario: 20 },
    },
  ],
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
  perfis: [{ id: "user-e2e", nome: "Gestor E2E", email: "gestor@example.com", papel: "gestor" }],
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
      status: "rascunho",
      data_orcamento: "2026-06-21",
      criado_em: "2026-06-21T10:00:00.000Z",
    });
    seed.orcamento_itens.push({
      id: 2,
      orcamento_id: 2,
      codigo_analise: "TESTE-16S",
      n_amostras: 12,
      custo_unitario: 45,
      preco_unitario: 90,
    });
    seed.orcamento_itens.push({
      id: 3,
      orcamento_id: 2,
      codigo_analise: "TESTE-QPCR",
      n_amostras: 5,
      custo_unitario: 40,
      preco_unitario: 80,
    });
    seed.demanda_analises = [
      {
        id: 1,
        demanda_id: 1,
        codigo_analise: "TESTE-16S",
        quantidade_amostras: 12,
        origem_quantidade: "padrao",
        status_custeio: "disponivel",
      },
      {
        id: 2,
        demanda_id: 1,
        codigo_analise: "TESTE-QPCR",
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
        status: "rascunho",
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

  gte() {
    return this;
  }

  lte() {
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
        const key = "chave" in row ? "chave" : "id";
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
      this.filters.every((filter) => row[filter.column] === filter.value) &&
      this.neqFilters.every((filter) => row[filter.column] !== filter.value) &&
      this.inFilters.every((filter) => filter.values.includes(row[filter.column])) &&
      this.notFilters.every((filter) => !filter.values.includes(String(row[filter.column]))) &&
      this.isFilters.every((filter) => (row[filter.column] ?? null) === filter.value)
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

export function createMockSupabaseClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: "user-e2e", email: "gestor@example.com" } }, error: null }),
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
      return { data: null, error: null };
    },
  };
}

