import { describe, it, expect } from "vitest";
import {
  equipCustoDia,
  gargalo,
  horasBancadaPorAmostra,
  insumosSelecionados,
  reagentesPorAmostra,
  calcularAnalise,
  type Etapa,
  type InsumoLinha,
  type Parametros,
} from "./engine";

describe("equipCustoDia", () => {
  it("usa depreciação linear (custo/vida_util) + manutenção (fração), rateada por dias úteis", () => {
    // custo total = 2×1000 = 2000; deprec = 2000/5 = 400; manut = 2000×0,05 = 100; (400+100)/200 = 2,5
    const v = equipCustoDia(
      {
        quantidade: 2,
        custo_unitario: 1000,
        vida_util_anos: 5,
        percentual_manutencao_anual: 0.05,
        manutencao_anual_fixa: null,
      },
      200,
    );
    expect(v).toBeCloseTo(2.5, 6);
  });

  it("manutenção fixa substitui a fração quando informada", () => {
    // custo 1000; deprec 1000/10=100; manut fixa 300; (100+300)/100 = 4
    const v = equipCustoDia(
      {
        quantidade: 1,
        custo_unitario: 1000,
        vida_util_anos: 10,
        percentual_manutencao_anual: 0.5,
        manutencao_anual_fixa: 300,
      },
      100,
    );
    expect(v).toBeCloseTo(4, 6);
  });

  it("cai para 222 dias úteis quando diasUteisAno <= 0", () => {
    // deprec 222/1=222; manut 0; /222 = 1
    const v = equipCustoDia(
      {
        quantidade: 1,
        custo_unitario: 222,
        vida_util_anos: 1,
        percentual_manutencao_anual: 0,
        manutencao_anual_fixa: null,
      },
      0,
    );
    expect(v).toBeCloseTo(1, 6);
  });
});

const etapa = (over: Partial<Etapa>): Etapa => ({
  nome_etapa: "E",
  nome_atividade: "A",
  execucoes_por_dia: null,
  amostras_por_execucao: null,
  tempo_maquina_h: null,
  tempo_bancada_h: null,
  ...over,
});

describe("gargalo", () => {
  it("usa os mínimos de exec/dia e amostras/exec", () => {
    const g = gargalo([
      etapa({ execucoes_por_dia: 3, amostras_por_execucao: 10 }),
      etapa({ execucoes_por_dia: 2, amostras_por_execucao: 24 }),
    ]);
    expect(g.execucoesDia).toBe(2);
    expect(g.amostrasPorExecucao).toBe(10);
    expect(g.amostrasDia).toBe(20);
  });

  it("ignora etapas Qubit ao calcular o gargalo", () => {
    const g = gargalo([
      etapa({ nome_atividade: "Quantificação Qubit", execucoes_por_dia: 1, amostras_por_execucao: 1 }),
      etapa({ nome_atividade: "PCR", execucoes_por_dia: 4, amostras_por_execucao: 8 }),
    ]);
    expect(g.execucoesDia).toBe(4);
    expect(g.amostrasPorExecucao).toBe(8);
  });
});

describe("horasBancadaPorAmostra", () => {
  it("soma tempo_bancada/amostras_por_execucao por etapa", () => {
    const h = horasBancadaPorAmostra([
      etapa({ tempo_bancada_h: 2, amostras_por_execucao: 4 }), // 0,5
      etapa({ tempo_bancada_h: 1, amostras_por_execucao: 2 }), // 0,5
    ]);
    expect(h).toBeCloseTo(1, 6);
  });
});

const ins = (over: Partial<InsumoLinha>): InsumoLinha => ({
  nome_etapa: "E",
  nome_atividade: "A",
  especificacao_insumo: "x",
  grupo_escolha: null,
  quantidade_por_amostra: 1,
  modo_cobranca: null,
  custo_unitario: 1,
  ...over,
});

describe("insumosSelecionados", () => {
  it("inclui sempre os sem grupo e, por padrão, a opção mais barata de cada grupo", () => {
    const sel = insumosSelecionados([
      ins({ especificacao_insumo: "base", grupo_escolha: null, custo_unitario: 5 }),
      ins({ especificacao_insumo: "kitA", grupo_escolha: "kit", custo_unitario: 100 }),
      ins({ especificacao_insumo: "kitB", grupo_escolha: "kit", custo_unitario: 40 }),
    ]);
    expect(sel.map((s) => s.especificacao_insumo).sort()).toEqual(["base", "kitB"]);
  });

  it("respeita a escolha explícita do grupo", () => {
    const sel = insumosSelecionados(
      [
        ins({ especificacao_insumo: "kitA", grupo_escolha: "kit", custo_unitario: 100 }),
        ins({ especificacao_insumo: "kitB", grupo_escolha: "kit", custo_unitario: 40 }),
      ],
      { kit: "kitA" },
    );
    expect(sel.map((s) => s.especificacao_insumo)).toEqual(["kitA"]);
  });
});

describe("reagentesPorAmostra", () => {
  it("por_amostra independe do lote; por_execucao divide pelo tamanho do lote", () => {
    const linhas: InsumoLinha[] = [
      ins({ custo_unitario: 2, quantidade_por_amostra: 3, modo_cobranca: "por_amostra" }), // 6
      ins({ custo_unitario: 96, quantidade_por_amostra: 1, modo_cobranca: "por_execucao" }), // 96/24 = 4
    ];
    expect(reagentesPorAmostra(linhas, 24).total).toBeCloseTo(10, 6);
  });
});

describe("calcularAnalise — cascata custo→preço", () => {
  const base = {
    codigo: "TESTE",
    etapas: [etapa({ execucoes_por_dia: 1, amostras_por_execucao: 10, tempo_bancada_h: 5 })],
    equip: [{ peso: 1, custoDia: 100 }],
    insumos: [ins({ custo_unitario: 2, quantidade_por_amostra: 1, modo_cobranca: "por_amostra" })],
    valorHoraPessoal: 0,
    custoHoraOverhead: 0,
  };
  const params0: Parametros = {
    dias_uteis_ano: 222,
    margem_lucro: 0,
    impostos: 0,
    taxas: 0,
    fundo_reserva: 0,
    fundo_investimento: 0,
  };

  it("compõe reagentes + equipamento/amostra + pessoal/overhead", () => {
    const b = calcularAnalise({ ...base, params: params0 });
    // reagentes=2; equip/amostra=100/(1*10)=10; pessoal=(5/10)*0=0; overhead=0
    expect(b.reagentes).toBeCloseTo(2, 6);
    expect(b.equipamento).toBeCloseTo(10, 6);
    expect(b.custoAnalitico).toBeCloseTo(12, 6);
    expect(b.custoTotal).toBeCloseTo(12, 6);
  });

  it("com fatores = 0, preço == custo total (regressão do achado da auditoria)", () => {
    const b = calcularAnalise({ ...base, params: params0 });
    expect(b.preco).toBeCloseTo(b.custoTotal, 6);
  });

  it("aplica a soma dos fatores: preço = custoTotal × (1 + Σ%/100)", () => {
    const b = calcularAnalise({ ...base, params: { ...params0, margem_lucro: 20, impostos: 10 } });
    expect(b.fatores).toBeCloseTo(0.3, 6);
    expect(b.preco).toBeCloseTo(b.custoTotal * 1.3, 6);
  });
});
