/**
 * Engine de custeio — funções puras.
 *
 * Calcula o custo analítico por amostra de uma análise e o preço ao cliente,
 * a partir dos dados crus das tabelas + parâmetros + um cenário (tamanho do lote
 * e escolhas de grupo). Toda premissa está comentada; os números devem ser
 * validados contra a expectativa do laboratório.
 */

export type Etapa = {
  nome_etapa: string;
  nome_atividade: string;
  execucoes_por_dia: number | null;
  amostras_por_execucao: number | null;
  tempo_maquina_h: number | null;
  tempo_bancada_h: number | null;
};

export type EquipAlloc = { peso: number; custoDia: number }; // custoDia já calculado

export type InsumoLinha = {
  nome_etapa: string;
  nome_atividade: string;
  especificacao_insumo: string | null;
  grupo_escolha: string | null;
  quantidade_por_amostra: number | null;
  modo_cobranca: string | null; // 'por_execucao' | 'por_amostra' | null
  custo_unitario: number | null; // do insumo ligado (null se não cadastrado)
  insumo_id?: number | null; // usado p/ demanda de estoque
};

export type Parametros = {
  dias_uteis_ano: number;
  // fatores de preço (em %)
  margem_lucro: number;
  impostos: number;
  taxas: number;
  fundo_reserva: number;
  fundo_investimento: number;
};

export type Cenario = {
  /** nº de amostras que dividem uma corrida (lote). Default = tamanho da execução-gargalo. */
  loteAmostras?: number;
  /** escolha por grupo: chave = grupo_escolha, valor = especificacao escolhida. */
  escolhasGrupo?: Record<string, string>;
};

const n = (v: number | null | undefined) => (typeof v === "number" ? v : 0);

/** custo/dia de um equipamento com depreciação LINEAR pela vida útil. */
export function equipCustoDia(
  e: {
    quantidade: number | null;
    custo_unitario: number | null;
    vida_util_anos: number | null;
    percentual_manutencao_anual: number | null;
    manutencao_anual_fixa: number | null;
  },
  diasUteisAno: number,
): number {
  const custoTotal = n(e.quantidade) * n(e.custo_unitario);
  const manut =
    e.manutencao_anual_fixa != null
      ? n(e.manutencao_anual_fixa)
      : custoTotal * n(e.percentual_manutencao_anual);
  const deprec = n(e.vida_util_anos) > 0 ? custoTotal / n(e.vida_util_anos) : 0;
  const dias = diasUteisAno > 0 ? diasUteisAno : 222;
  return (manut + deprec) / dias;
}

/** Gargalo: replica a lógica da planilha (mínimos ignorando Qubit). */
export function gargalo(etapas: Etapa[]) {
  const semQubit = etapas.filter(
    (e) => !/qubit/i.test(e.nome_atividade ?? ""),
  );
  const base = semQubit.length ? semQubit : etapas;
  const minExec = Math.min(...base.map((e) => n(e.execucoes_por_dia) || Infinity));
  const minAmExec = Math.min(
    ...base.map((e) => n(e.amostras_por_execucao) || Infinity),
  );
  const execucoesDia = Number.isFinite(minExec) ? minExec : 0;
  const amostrasPorExecucao = Number.isFinite(minAmExec) ? minAmExec : 0;
  return {
    execucoesDia,
    amostrasPorExecucao,
    amostrasDia: execucoesDia * amostrasPorExecucao,
  };
}

/** Horas de bancada por amostra = Σ (tempo_bancada_execução / amostras_da_execução). */
export function horasBancadaPorAmostra(etapas: Etapa[]): number {
  return etapas.reduce((acc, e) => {
    const amExec = n(e.amostras_por_execucao);
    if (amExec <= 0) return acc;
    return acc + n(e.tempo_bancada_h) / amExec;
  }, 0);
}

/** Seleciona as linhas de insumo válidas aplicando as escolhas de grupo. */
export function insumosSelecionados(
  linhas: InsumoLinha[],
  escolhasGrupo: Record<string, string> = {},
): InsumoLinha[] {
  // agrupa por grupo_escolha; sem grupo => sempre incluído.
  const semGrupo = linhas.filter((l) => !l.grupo_escolha);
  const comGrupo = linhas.filter((l) => l.grupo_escolha);
  const grupos = new Map<string, InsumoLinha[]>();
  for (const l of comGrupo) {
    const k = l.grupo_escolha as string;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k)!.push(l);
  }
  const escolhidas: InsumoLinha[] = [];
  for (const [grupo, opcoes] of grupos) {
    const escolhida = escolhasGrupo[grupo];
    if (escolhida) {
      escolhidas.push(
        ...opcoes.filter((o) => o.especificacao_insumo === escolhida),
      );
    } else {
      // default: a opção mais barata por amostra
      const ord = [...opcoes].sort(
        (a, b) =>
          n(a.custo_unitario) * n(a.quantidade_por_amostra) -
          n(b.custo_unitario) * n(b.quantidade_por_amostra),
      );
      if (ord[0]) escolhidas.push(ord[0]);
    }
  }
  return [...semGrupo, ...escolhidas];
}

/**
 * Reagentes por amostra.
 * - por_amostra (default): custo_unitario × quantidade_por_amostra  (independe do lote)
 * - por_execucao: custo fixo por corrida, dividido pelo tamanho do lote
 *   (custo_unitario × quantidade_por_amostra) / loteAmostras
 */
export function reagentesPorAmostra(
  linhas: InsumoLinha[],
  loteAmostras: number,
): { total: number; detalhe: { nome: string; porAmostra: boolean; valor: number }[] } {
  const lote = loteAmostras > 0 ? loteAmostras : 1;
  const detalhe = linhas.map((l) => {
    const base = n(l.custo_unitario) * n(l.quantidade_por_amostra);
    const porExec = l.modo_cobranca === "por_execucao";
    const valor = porExec ? base / lote : base;
    return {
      nome: l.especificacao_insumo ?? "(sem insumo)",
      porAmostra: !porExec,
      valor,
    };
  });
  return { total: detalhe.reduce((a, d) => a + d.valor, 0), detalhe };
}

/**
 * Validação explícita contra "custo zero silencioso" (ETAPA 3 do plano).
 *
 * A engine de cálculo mantém o fallback histórico (custo ausente => 0) para
 * preservar a compatibilidade dos snapshots já emitidos. Esta função NÃO altera
 * o cálculo: ela apenas detecta as linhas que, se calculadas, virariam custo
 * zero por cadastro incompleto. Callers que emitem novos orçamentos devem
 * chamá-la e BLOQUEAR a inclusão quando houver problemas (salvo override
 * administrativo auditado).
 */
export type ProblemaInsumoCusteio = {
  especificacao: string;
  motivo: "sem_vinculo" | "sem_custo" | "sem_modo_cobranca" | "sem_quantidade";
};

export function validarInsumosCusteio(
  linhas: Array<
    InsumoLinha & { insumo_id?: number | null; ativo?: boolean | null }
  >,
): ProblemaInsumoCusteio[] {
  const problemas: ProblemaInsumoCusteio[] = [];
  for (const l of linhas) {
    if (l.ativo === false) continue;
    const rotulo = l.especificacao_insumo ?? "(sem insumo)";
    if (l.insumo_id == null && l.custo_unitario == null) {
      problemas.push({ especificacao: rotulo, motivo: "sem_vinculo" });
      continue;
    }
    if (l.custo_unitario == null) {
      problemas.push({ especificacao: rotulo, motivo: "sem_custo" });
    }
    if (l.modo_cobranca !== "por_amostra" && l.modo_cobranca !== "por_execucao") {
      problemas.push({ especificacao: rotulo, motivo: "sem_modo_cobranca" });
    }
    if (l.quantidade_por_amostra == null) {
      problemas.push({ especificacao: rotulo, motivo: "sem_quantidade" });
    }
  }
  return problemas;
}

export type Breakdown = {
  codigo: string;
  lote: number;
  reagentes: number;
  equipamento: number;
  pessoal: number;
  custoAnalitico: number;
  overhead: number;
  custoTotal: number;
  fatores: number; // soma % aplicada
  preco: number;
};

export function calcularAnalise(args: {
  codigo: string;
  etapas: Etapa[];
  equip: EquipAlloc[];
  insumos: InsumoLinha[];
  valorHoraPessoal: number; // Σ valor_hh dos técnicos
  custoHoraOverhead: number; // Σ custo_hora_bancada do overhead
  params: Parametros;
  cenario?: Cenario;
}): Breakdown {
  const g = gargalo(args.etapas);
  const lote = args.cenario?.loteAmostras ?? g.amostrasPorExecucao;

  const selic = insumosSelecionados(
    args.insumos,
    args.cenario?.escolhasGrupo,
  );
  const reagentes = reagentesPorAmostra(selic, lote).total;

  const equipDia = args.equip.reduce((a, e) => a + e.peso * e.custoDia, 0);
  const equipamento = g.amostrasDia > 0 ? equipDia / g.amostrasDia : 0;

  const hBancada = horasBancadaPorAmostra(args.etapas);
  const pessoal = hBancada * args.valorHoraPessoal;
  const overhead = hBancada * args.custoHoraOverhead;

  const custoAnalitico = reagentes + equipamento + pessoal;
  const custoTotal = custoAnalitico + overhead;

  const p = args.params;
  const fatores =
    (n(p.margem_lucro) +
      n(p.impostos) +
      n(p.taxas) +
      n(p.fundo_reserva) +
      n(p.fundo_investimento)) /
    100;
  const preco = custoTotal * (1 + fatores);

  return {
    codigo: args.codigo,
    lote,
    reagentes,
    equipamento,
    pessoal,
    custoAnalitico,
    overhead,
    custoTotal,
    fatores,
    preco,
  };
}
