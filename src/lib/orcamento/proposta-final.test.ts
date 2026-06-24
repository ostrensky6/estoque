import { describe, expect, it } from "vitest";
import {
  detectarCustosZero,
  montarComponentesTecnicos,
  reconciliarComposicao,
  statusPropostaFinal,
} from "./proposta-final";

describe("reconciliarComposicao — distribuição comercial proporcional", () => {
  it("distribui o total final por participação técnica (lab 100 + projeto 200, total 375)", () => {
    const r = reconciliarComposicao({
      componentes: [
        { componente: "Laboratório", descricao: "AN1", quantidade: 1, custoUnitarioTecnico: 100, subtotalTecnico: 100 },
        { componente: "Projeto · MC", descricao: "MC", quantidade: 1, custoUnitarioTecnico: 200, subtotalTecnico: 200 },
      ],
      totalFinal: 375,
    });
    expect(r.subtotalTecnico).toBe(300);
    expect(r.linhas[0].valorComercial).toBe(125); // 375 × 1/3
    expect(r.linhas[1].valorComercial).toBe(250); // 375 × 2/3
    expect(r.linhas.reduce((a, l) => a + l.valorComercial, 0)).toBe(375);
    expect(r.reconciliaOk).toBe(true);
    expect(r.totalParametros).toBe(75);
  });

  it("absorve o resíduo de arredondamento na última linha (soma exata)", () => {
    const r = reconciliarComposicao({
      componentes: [
        { componente: "A", descricao: "a", quantidade: 1, custoUnitarioTecnico: 1, subtotalTecnico: 1 },
        { componente: "B", descricao: "b", quantidade: 1, custoUnitarioTecnico: 1, subtotalTecnico: 1 },
        { componente: "C", descricao: "c", quantidade: 1, custoUnitarioTecnico: 1, subtotalTecnico: 1 },
      ],
      totalFinal: 100, // 100/3 = 33,33 cada → resíduo na última
    });
    expect(r.linhas.reduce((a, l) => a + l.valorComercial, 0)).toBe(100);
    expect(r.reconciliaOk).toBe(true);
  });

  it("ignora componentes com subtotal técnico zero", () => {
    const r = reconciliarComposicao({
      componentes: [
        { componente: "A", descricao: "a", quantidade: 1, custoUnitarioTecnico: 100, subtotalTecnico: 100 },
        { componente: "Z", descricao: "zero", quantidade: 0, custoUnitarioTecnico: 0, subtotalTecnico: 0 },
      ],
      totalFinal: 125,
    });
    expect(r.linhas).toHaveLength(1);
    expect(r.linhas[0].valorComercial).toBe(125);
  });

  it("subtotal zero com total zero reconcilia; sem linhas", () => {
    const r = reconciliarComposicao({ componentes: [], totalFinal: 0 });
    expect(r.linhas).toHaveLength(0);
    expect(r.reconciliaOk).toBe(true);
  });
});

describe("montarComponentesTecnicos — preserva regra PE (meses)", () => {
  it("PE usa meses × valor; demais usam quantidade × custo", () => {
    const comps = montarComponentesTecnicos({
      itensLaboratorio: [{ codigo_analise: "AN1", n_amostras: 2, custo_unitario: 50 }],
      custosProjeto: [
        { rubrica: "PE", quantidade: 1, custo_unitario: 1000, meses_selecionados: [1, 2, 3] },
        { rubrica: "MC", quantidade: 4, custo_unitario: 25 },
      ],
      analisesProjeto: [],
    });
    expect(comps.find((c) => c.componente === "Laboratório")?.subtotalTecnico).toBe(100);
    expect(comps.find((c) => c.observacao)?.subtotalTecnico).toBe(3000); // PE: 3 meses × 1000
    expect(comps.find((c) => c.componente === "Projeto · MC")?.subtotalTecnico).toBe(100);
  });
});

describe("detectarCustosZero — bloqueio", () => {
  it("flagra item laboratorial com custo <= 0", () => {
    const z = detectarCustosZero({
      itensLaboratorio: [{ codigo_analise: "AN1", custo_unitario: 0 }],
      custosProjeto: [],
      analisesProjeto: [],
      projetoTemJustificativa: false,
    });
    expect(z).toHaveLength(1);
    expect(z[0].origem).toBe("laboratorio");
  });

  it("justificativa de projeto isenta zeros do projeto, mas não do laboratório", () => {
    const z = detectarCustosZero({
      itensLaboratorio: [{ codigo_analise: "AN1", custo_unitario: 0 }],
      custosProjeto: [{ rubrica: "MC", custo_unitario: 0 }],
      analisesProjeto: [],
      projetoTemJustificativa: true,
    });
    expect(z).toHaveLength(1);
    expect(z[0].origem).toBe("laboratorio");
  });
});

describe("statusPropostaFinal — linguagem padronizada", () => {
  const base = {
    demandaCompleta: true,
    laboratorioExigido: true,
    projetoExigido: false,
    laboratorioStatus: "revisado" as const,
    projetoStatus: "nao_exigido" as const,
    parametrosValidos: true,
    temCustoZeroSemJustificativa: false,
    versoesEmitidas: 0,
    ultimaVersaoStatus: null as string | null,
  };

  it("pronta para emitir quando tudo revisado e válido", () => {
    expect(statusPropostaFinal(base)).toBe("pronta_para_emitir");
  });

  it("bloqueada quando há custo zero sem justificativa", () => {
    expect(statusPropostaFinal({ ...base, temCustoZeroSemJustificativa: true })).toBe("bloqueada");
  });

  it("aguardando revisão quando módulo preenchido mas não revisado", () => {
    expect(statusPropostaFinal({ ...base, laboratorioStatus: "preenchido" })).toBe("aguardando_revisao");
  });

  it("em composição quando módulo ainda pendente", () => {
    expect(statusPropostaFinal({ ...base, laboratorioStatus: "pendente" })).toBe("em_composicao");
  });

  it("bloqueada quando demanda incompleta", () => {
    expect(statusPropostaFinal({ ...base, demandaCompleta: false })).toBe("bloqueada");
  });

  it("emitida quando há versão vigente emitida", () => {
    expect(statusPropostaFinal({ ...base, ultimaVersaoStatus: "emitido" })).toBe("emitida");
  });
});
