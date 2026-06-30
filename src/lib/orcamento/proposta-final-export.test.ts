import { describe, expect, it } from "vitest";
import { montarPropostaFinalExport } from "./proposta-final-export";

const demanda = {
  titulo: "Demanda X",
  cliente_nome: "Cliente X",
  cliente_cnpj: null,
  cliente_contato: null,
  escopo_preliminar: "Escopo",
  descricao: null,
};

// snapshot da NOVA engine (Política A)
function snapshotNovo(opts: {
  lab?: Array<{ codigo_analise?: string; n_amostras: number; custo_unitario: number; preco_unitario?: number }>;
  proj?: Array<{ rubrica: string; quantidade?: number; custo_unitario: number; meses_selecionados?: number[] }>;
  subtotal: number;
  somaPercentual: number;
  totalFinal: number;
  parametros?: Array<{ label: string; percentual: number; valorNominal: number }>;
}) {
  return {
    orcamentos_analises: opts.lab?.length ? [{ orcamento_itens: opts.lab }] : [],
    orcamentos_projeto: opts.proj?.length ? [{ orcamento_projeto_custos: opts.proj, orcamento_projeto_analises: [] }] : [],
    consolidado: {
      totalLaboratorioCusto: (opts.lab ?? []).reduce((a, i) => a + i.n_amostras * i.custo_unitario, 0),
      totalProjetoCusto: (opts.proj ?? []).reduce((a, i) => a + (i.quantidade ?? 0) * i.custo_unitario, 0),
      economia: {
        politica: "A_GROSS_UP_TOTAL",
        subtotal: opts.subtotal,
        somaPercentual: opts.somaPercentual,
        fatorGrossUp: 1 / (1 - opts.somaPercentual / 100),
        totalParametros: Math.round((opts.totalFinal - opts.subtotal) * 100) / 100,
        totalFinal: opts.totalFinal,
        formula: "total_final = (custo_laboratorial_tecnico + custo_direto_projeto) / (1 - Σparametros/100)",
        parametros: opts.parametros ?? [{ label: "Impostos", percentual: opts.somaPercentual, valorNominal: Math.round((opts.totalFinal - opts.subtotal) * 100) / 100 }],
      },
    },
  };
}

function versao(extra: Record<string, unknown> = {}) {
  return { numero: "OF-2026-0001-v1", versao: 1, status: "emitido", total_final: 0, ...extra };
}

describe("montarPropostaFinalExport — composição reconciliada", () => {
  it("lab 100 + projeto 200, Σ 20% → valores comerciais 125 + 250 = 375", () => {
    const ex = montarPropostaFinalExport({
      versao: versao({ total_final: 375 }),
      snapshot: snapshotNovo({
        lab: [{ codigo_analise: "AN1", n_amostras: 1, custo_unitario: 100, preco_unitario: 130 }],
        proj: [{ rubrica: "MC", quantidade: 1, custo_unitario: 200 }],
        subtotal: 300,
        somaPercentual: 20,
        totalFinal: 375,
      }),
      demanda: { ...demanda, modalidade: "projeto_com_analises" },
    });
    expect(ex.legado).toBe(false);
    const soma = ex.composicaoComercial.reduce((a, l) => a + l.valorComercial, 0);
    expect(soma).toBe(375);
    expect(ex.composicaoReconciliada).toBe(true);
    expect(ex.economico.totalFinal).toBe(375);
    expect(ex.economico.parametros[0].valorNominal).toBeGreaterThan(0);
  });

  it("proposta apenas laboratorial: sem bloco de projeto", () => {
    const ex = montarPropostaFinalExport({
      versao: versao({ total_final: 125 }),
      snapshot: snapshotNovo({ lab: [{ codigo_analise: "AN1", n_amostras: 1, custo_unitario: 100 }], subtotal: 100, somaPercentual: 20, totalFinal: 125 }),
      demanda: { ...demanda, modalidade: "analises" },
    });
    expect(ex.exigeProjeto).toBe(false);
    expect(ex.detalhamento.projeto).toHaveLength(0);
    expect(ex.composicaoComercial.every((l) => l.componente.startsWith("Laboratório"))).toBe(true);
  });

  it("proposta apenas projeto: sem bloco de laboratório", () => {
    const ex = montarPropostaFinalExport({
      versao: versao({ total_final: 250 }),
      snapshot: snapshotNovo({ proj: [{ rubrica: "MC", quantidade: 1, custo_unitario: 200 }], subtotal: 200, somaPercentual: 20, totalFinal: 250 }),
      demanda: { ...demanda, modalidade: "projeto" },
    });
    expect(ex.exigeLaboratorio).toBe(false);
    expect(ex.detalhamento.laboratorio).toHaveLength(0);
  });

  it("preço snapshot não é usado como total comercial (composição reconcilia ao total salvo)", () => {
    const ex = montarPropostaFinalExport({
      versao: versao({ total_final: 125 }),
      // preço snapshot 999 (alto), custo técnico 100 → total salvo 125, não 999
      snapshot: snapshotNovo({ lab: [{ codigo_analise: "AN1", n_amostras: 1, custo_unitario: 100, preco_unitario: 999 }], subtotal: 100, somaPercentual: 20, totalFinal: 125 }),
      demanda: { ...demanda, modalidade: "analises" },
    });
    const soma = ex.composicaoComercial.reduce((a, l) => a + l.valorComercial, 0);
    expect(soma).toBe(125);
    expect(ex.detalhamento.laboratorio[0].precoSnapshot).toBe(999); // só na visão interna
  });
});

describe("montarPropostaFinalExport — compatibilidade legada", () => {
  it("versão sem snapshot da nova engine exporta em modo legado e preserva o total salvo", () => {
    const ex = montarPropostaFinalExport({
      versao: versao({ total_final: 350, total_laboratorio_custo: 20, total_projeto_custo: 70 }),
      snapshot: {
        // snapshot antigo: consolidado SEM economia
        consolidado: { parametrosProjeto: [{ label: "Lucro", nominalRate: 30, amount: 100 }] },
        orcamentos_analises: [],
        orcamentos_projeto: [],
      },
      demanda: { ...demanda, modalidade: "projeto_com_analises" },
    });
    expect(ex.legado).toBe(true);
    expect(ex.avisoLegado).toMatch(/regra econômica anterior/i);
    expect(ex.economico.totalFinal).toBe(350); // total salvo preservado
  });
});
