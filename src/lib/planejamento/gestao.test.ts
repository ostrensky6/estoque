import { describe, expect, it } from "vitest";

import { avaliarGestaoPlano, houveBaixaMaterial, statusEditavel } from "./gestao";

describe("gestão de planejamento (0111)", () => {
  it("rascunho sem baixa: editável e excluível por coordenador", () => {
    const g = avaliarGestaoPlano({ status: "rascunho", reservas: [{ status: "liberado" }], podeGerir: true });
    expect(g).toMatchObject({ podeEditar: true, acao: "excluir", acaoBloqueada: false, houveBaixa: false });
  });

  it("status ausente vale como rascunho", () => {
    expect(statusEditavel(null)).toBe(true);
    expect(avaliarGestaoPlano({ status: undefined, podeGerir: true }).acao).toBe("excluir");
  });

  it("reserva consumida conta como baixa: só cancelar", () => {
    const g = avaliarGestaoPlano({
      status: "reservado",
      reservas: [{ status: "reservado", quantidade_consumida: 2 }],
      podeGerir: true,
    });
    expect(g.acao).toBe("cancelar");
    expect(g.acaoBloqueada).toBe(false);
    expect(g.motivoAcao).toBe("Já houve baixa de material — só é possível cancelar.");
    expect(g.podeEditar).toBe(true);
  });

  it("em execução: não editável e só cancelável", () => {
    const g = avaliarGestaoPlano({ status: "em_execucao", podeGerir: true });
    expect(g.podeEditar).toBe(false);
    expect(g.motivoSemEdicao).toContain("em execução");
    expect(g.acao).toBe("cancelar");
  });

  it("concluído ou cancelado com baixa: nenhuma ação destrutiva", () => {
    expect(avaliarGestaoPlano({ status: "concluido", podeGerir: true }).acao).toBeNull();
    const cancelado = avaliarGestaoPlano({
      status: "cancelado",
      reservas: [{ status: "consumido" }],
      podeGerir: true,
    });
    expect(cancelado.acao).toBeNull();
    expect(cancelado.motivoAcao).toContain("já cancelado");
  });

  it("cancelado sem baixa ainda pode ser excluído", () => {
    const g = avaliarGestaoPlano({ status: "cancelado", reservas: [{ status: "cancelado" }], podeGerir: true });
    expect(g).toMatchObject({ podeEditar: false, acao: "excluir", acaoBloqueada: false });
  });

  it("técnico vê a ação bloqueada com o motivo", () => {
    const g = avaliarGestaoPlano({ status: "rascunho", podeGerir: false });
    expect(g).toMatchObject({ acao: "excluir", acaoBloqueada: true, motivoAcao: "Somente coordenador pode excluir planos." });
  });

  it("pedido interno ativo bloqueia a exclusão e é listado", () => {
    const g = avaliarGestaoPlano({ status: "rascunho", podeGerir: true, pedidosAtivos: ["#7 (rascunho)"] });
    expect(g.acaoBloqueada).toBe(true);
    expect(g.motivoAcao).toContain("#7 (rascunho)");
  });

  it("houveBaixaMaterial reconhece status e consumo", () => {
    expect(houveBaixaMaterial("concluido")).toBe(true);
    expect(houveBaixaMaterial("reservado", [{ status: "consumido" }])).toBe(true);
    expect(houveBaixaMaterial("reservado", [{ status: "reservado", quantidade_consumida: 0 }])).toBe(false);
  });
});
