import { describe, it, expect } from "vitest";
import {
  validarAnalise,
  validarCadastros,
  type AnaliseParaValidar,
  type ContextoCusteio,
} from "./validar-integridade";

const ctxOk: ContextoCusteio = {
  valorHoraPessoal: 50,
  custoHoraOverhead: 10,
  parametrosPresentes: true,
};

function analiseBase(over: Partial<AnaliseParaValidar> = {}): AnaliseParaValidar {
  return {
    analise: { codigo: "qPCR_F", nome: "qPCR com filtração", ativo: true },
    etapas: [
      {
        id: 1,
        nome_etapa: "PCR",
        nome_atividade: "qPCR",
        execucoes_por_dia: 2,
        amostras_por_execucao: 24,
        tempo_maquina_h: 2,
        tempo_bancada_h: 1,
      },
    ],
    insumos: [
      {
        id: 1,
        nome_etapa: "PCR",
        nome_atividade: "qPCR",
        especificacao_insumo: "Master mix",
        grupo_escolha: null,
        quantidade_por_amostra: 1,
        modo_cobranca: "por_amostra",
        insumo_id: 10,
        custo_unitario: 5,
      },
    ],
    equipamentos: [
      {
        id: 1,
        equipamento_id: 100,
        peso_alocacao: 1,
        equipamento: {
          nome: "Termociclador",
          possui: true,
          quantidade: 1,
          custo_unitario: 50000,
          vida_util_anos: 10,
        },
      },
    ],
    ...over,
  };
}

describe("validarAnalise — classificação", () => {
  it("classifica como PRONTA quando tudo está íntegro", () => {
    const r = validarAnalise(analiseBase(), ctxOk);
    expect(r.status).toBe("PRONTA");
    expect(r.problemas).toHaveLength(0);
    expect(r.custoCalculavel).toBe(true);
  });

  // teste 1 do plano: insumo sem vínculo não gera custo zero (bloqueia)
  it("BLOQUEIA insumo sem vínculo (insumo_id null)", () => {
    const base = analiseBase();
    base.insumos[0].insumo_id = null;
    base.insumos[0].custo_unitario = null;
    const r = validarAnalise(base, ctxOk);
    expect(r.status).toBe("BLOQUEADA");
    expect(r.problemas.some((p) => p.codigo === "insumo.sem_vinculo")).toBe(true);
    expect(r.custoCalculavel).toBe(false);
  });

  // teste 2 do plano: insumo sem custo bloqueia a análise
  it("BLOQUEIA insumo vinculado mas sem custo", () => {
    const base = analiseBase();
    base.insumos[0].custo_unitario = null;
    const r = validarAnalise(base, ctxOk);
    expect(r.status).toBe("BLOQUEADA");
    expect(r.problemas.some((p) => p.codigo === "insumo.sem_custo")).toBe(true);
  });

  it("custo ausente NÃO vira zero: custoCalculavel é falso e o problema aponta o campo", () => {
    const base = analiseBase();
    base.insumos[0].custo_unitario = null;
    const r = validarAnalise(base, ctxOk);
    expect(r.custoCalculavel).toBe(false);
    const p = r.problemas.find((x) => x.codigo === "insumo.sem_custo");
    expect(p?.campo).toBe("custo_unitario");
    expect(p?.valorAtual).toBe("(nulo)");
  });

  // teste 3 do plano: modo de cobrança obrigatório
  it("BLOQUEIA modo de cobrança ausente (null não é por_amostra)", () => {
    const base = analiseBase();
    base.insumos[0].modo_cobranca = null;
    const r = validarAnalise(base, ctxOk);
    expect(r.status).toBe("BLOQUEADA");
    expect(r.problemas.some((p) => p.codigo === "insumo.sem_modo_cobranca")).toBe(true);
  });

  it("BLOQUEIA quando não há produtividade para o rateio", () => {
    const base = analiseBase();
    base.etapas[0].execucoes_por_dia = null;
    base.etapas[0].amostras_por_execucao = null;
    const r = validarAnalise(base, ctxOk);
    expect(r.status).toBe("BLOQUEADA");
    expect(r.problemas.some((p) => p.codigo === "etapa.sem_produtividade")).toBe(true);
  });

  it("ALERTA (não bloqueio) para quantidade zero", () => {
    const base = analiseBase();
    base.insumos[0].quantidade_por_amostra = 0;
    const r = validarAnalise(base, ctxOk);
    expect(r.problemas.some((p) => p.codigo === "insumo.quantidade_zero")).toBe(true);
    expect(r.problemas.find((p) => p.codigo === "insumo.quantidade_zero")?.gravidade).toBe("alerta");
  });

  // teste 6 do plano: grupo de escolha normalizado (variação textual detectada)
  it("ALERTA para grupo de escolha duplicado por caixa/espaço", () => {
    const base = analiseBase();
    base.insumos = [
      { ...base.insumos[0], id: 1, especificacao_insumo: "Kit A", grupo_escolha: "Kit " },
      { ...base.insumos[0], id: 2, especificacao_insumo: "Kit B", grupo_escolha: "kit" },
    ];
    const r = validarAnalise(base, ctxOk);
    expect(r.problemas.some((p) => p.codigo === "grupo.variacao_textual")).toBe(true);
  });

  // teste 13 do plano: equipamento não possuído gera alerta
  it("ALERTA para equipamento não possuído", () => {
    const base = analiseBase();
    base.equipamentos[0].equipamento!.possui = false;
    const r = validarAnalise(base, ctxOk);
    expect(r.problemas.some((p) => p.codigo === "equip.nao_possuido")).toBe(true);
  });

  it("ALERTA de pessoal/overhead quando há bancada mas contexto zerado", () => {
    const r = validarAnalise(analiseBase(), {
      valorHoraPessoal: 0,
      custoHoraOverhead: 0,
      parametrosPresentes: true,
    });
    expect(r.problemas.some((p) => p.codigo === "pessoal.ausente")).toBe(true);
    expect(r.problemas.some((p) => p.codigo === "overhead.ausente")).toBe(true);
  });

  it("BLOQUEIA quando parâmetros técnicos essenciais ausentes", () => {
    const r = validarAnalise(analiseBase(), { ...ctxOk, parametrosPresentes: false });
    expect(r.status).toBe("BLOQUEADA");
    expect(r.problemas.some((p) => p.codigo === "parametro.ausente")).toBe(true);
  });
});

// teste 23 do plano: a página/resumo classifica corretamente as análises
describe("validarCadastros — resumo", () => {
  it("agrega contagens por status", () => {
    const pronta = analiseBase();
    const bloqueada = analiseBase({ analise: { codigo: "X", nome: "X", ativo: true } });
    bloqueada.insumos[0].insumo_id = null;
    bloqueada.insumos[0].custo_unitario = null;

    const resumo = validarCadastros([pronta, bloqueada], ctxOk);
    expect(resumo.total).toBe(2);
    expect(resumo.prontas).toBe(1);
    expect(resumo.bloqueadas).toBe(1);
    expect(resumo.comAlertas).toBe(0);
  });
});
