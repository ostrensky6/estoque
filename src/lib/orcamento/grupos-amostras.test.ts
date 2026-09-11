import { describe, expect, it } from "vitest";
import {
  GruposAmostrasInvalidosError,
  lerGruposAmostras,
  matrizesConcatenadas,
  payloadSincronizacao,
  totalAmostras,
} from "./grupos-amostras";

type GrupoBruto = {
  chave?: string;
  id?: string;
  identificacao?: string;
  matriz?: string;
  quantidade?: string;
  unidade?: string;
  observacao?: string;
};

/** Reproduz a submissão do DemandaForm: campos repetidos, um par por grupo. */
function formComGrupos(grupos: GrupoBruto[]): FormData {
  const fd = new FormData();
  for (const [i, g] of grupos.entries()) {
    fd.append("grupo_key", g.chave ?? `grupo-${i + 1}`);
    fd.append("grupo_id", g.id ?? "");
    fd.append("grupo_identificacao", g.identificacao ?? `Grupo ${i + 1}`);
    fd.append("grupo_tipo_matriz", g.matriz ?? "");
    fd.append("grupo_quantidade", g.quantidade ?? "1");
    if (g.unidade !== undefined) fd.append("grupo_unidade", g.unidade);
    if (g.observacao !== undefined) fd.append("grupo_observacao", g.observacao);
  }
  return fd;
}

function ler(fd: FormData) {
  const g = lerGruposAmostras(fd);
  if (g === null) throw new Error("esperava grupos, veio null");
  return g;
}

describe("lerGruposAmostras", () => {
  it("REGRESSÃO C1: preserva cada grupo digitado, não só o agregado", () => {
    // Antes da correção, o servidor lia apenas os campos ocultos derivados
    // (soma e matrizes concatenadas) e descartava a estrutura.
    const grupos = ler(
      formComGrupos([
        { identificacao: "Ponto A", matriz: "Água", quantidade: "12" },
        { identificacao: "Ponto B", matriz: "Sedimento", quantidade: "8" },
      ]),
    );

    expect(grupos).toHaveLength(2);
    expect(grupos[0]).toMatchObject({
      identificacao: "Ponto A",
      tipo_matriz: "Água",
      quantidade_amostras: 12,
      unidade: "amostras",
      id: null,
    });
    expect(grupos[1]).toMatchObject({
      identificacao: "Ponto B",
      tipo_matriz: "Sedimento",
      quantidade_amostras: 8,
    });
  });

  it("preserva a ordem de submissão", () => {
    const grupos = ler(
      formComGrupos([
        { identificacao: "Terceiro" },
        { identificacao: "Primeiro" },
        { identificacao: "Segundo" },
      ]),
    );
    expect(grupos.map((g) => g.identificacao)).toEqual(["Terceiro", "Primeiro", "Segundo"]);
  });

  it("mantém o id de grupos existentes para atualizar em vez de recriar", () => {
    const grupos = ler(
      formComGrupos([
        { id: "41", identificacao: "Existente" },
        { identificacao: "Novo" },
      ]),
    );
    expect(grupos[0].id).toBe(41);
    expect(grupos[1].id).toBeNull();
  });

  it("REGRESSÃO: formulário sem editor de grupos devolve null (preservar), não lista vazia (apagar)", () => {
    // A tela de detalhe da demanda salva sem campos de grupo. Tratar isso
    // como lista vazia apagava os grupos criados na tela de criação.
    expect(lerGruposAmostras(new FormData())).toBeNull();
  });

  it("normaliza matriz e observação vazias para null", () => {
    const [g] = ler(
      formComGrupos([{ identificacao: "Sem matriz", matriz: "   ", observacao: "" }]),
    );
    expect(g.tipo_matriz).toBeNull();
    expect(g.observacao).toBeNull();
  });

  it("aplica 'amostras' como unidade padrão", () => {
    const [g] = ler(formComGrupos([{ identificacao: "X" }]));
    expect(g.unidade).toBe("amostras");
  });
});

describe("lerGruposAmostras — recusa em vez de descartar", () => {
  it("recusa grupo sem identificação", () => {
    expect(() => lerGruposAmostras(formComGrupos([{ identificacao: "  " }]))).toThrow(
      GruposAmostrasInvalidosError,
    );
  });

  it("recusa quantidade zero, negativa ou não numérica", () => {
    for (const quantidade of ["0", "-3", "abc", ""]) {
      expect(() =>
        lerGruposAmostras(formComGrupos([{ identificacao: "A", quantidade }])),
      ).toThrow(GruposAmostrasInvalidosError);
    }
  });

  it("recusa quantidade fracionária", () => {
    expect(() =>
      lerGruposAmostras(formComGrupos([{ identificacao: "A", quantidade: "2.5" }])),
    ).toThrow(/inteira/i);
  });

  it("recusa identificações duplicadas, ignorando caixa", () => {
    expect(() =>
      lerGruposAmostras(
        formComGrupos([{ identificacao: "Ponto A" }, { identificacao: "ponto a" }]),
      ),
    ).toThrow(/mais de um grupo/i);
  });

  it("REGRESSÃO: campo oculto duplicado no formulário é recusado, não pareado errado", () => {
    // Encontrado ao exercitar o formulário contra o banco local: um input
    // oculto com o mesmo `name` de um campo visível fazia cada grupo enviar
    // duas unidades, deslocando o pareamento por índice.
    const fd = formComGrupos([
      { identificacao: "Ponto A", unidade: "amostras" },
      { identificacao: "Ponto B", unidade: "amostras" },
    ]);
    fd.append("grupo_unidade", "amostras");
    fd.append("grupo_unidade", "amostras");
    expect(() => lerGruposAmostras(fd)).toThrow(/grupo_unidade=4/);
  });

  it("recusa campos repetidos desalinhados em vez de parear errado", () => {
    const fd = new FormData();
    fd.append("grupo_key", "grupo-1");
    fd.append("grupo_key", "grupo-2");
    fd.append("grupo_identificacao", "Só um");
    fd.append("grupo_tipo_matriz", "Água");
    fd.append("grupo_quantidade", "5");
    expect(() => lerGruposAmostras(fd)).toThrow(/desalinhados/i);
  });
});

describe("derivados que alimentam as colunas legadas", () => {
  const grupos = ler(
    formComGrupos([
      { identificacao: "A", matriz: "Água", quantidade: "12" },
      { identificacao: "B", matriz: "Sedimento", quantidade: "8" },
      { identificacao: "C", matriz: "Água", quantidade: "5" },
    ]),
  );

  it("soma as amostras para quantidade_amostras_estimada", () => {
    expect(totalAmostras(grupos)).toBe(25);
  });

  it("concatena matrizes distintas, sem repetir", () => {
    expect(matrizesConcatenadas(grupos)).toBe("Água; Sedimento");
  });

  it("devolve string vazia quando nenhum grupo tem matriz", () => {
    expect(matrizesConcatenadas(ler(formComGrupos([{ identificacao: "X" }])))).toBe(
      "",
    );
  });

  it("monta o payload da RPC com chave e id preservados", () => {
    expect(payloadSincronizacao(grupos)![0]).toEqual({
      chave: "grupo-1",
      id: null,
      identificacao: "A",
      tipo_matriz: "Água",
      quantidade_amostras: 12,
      unidade: "amostras",
      observacao: null,
    });
  });
});
