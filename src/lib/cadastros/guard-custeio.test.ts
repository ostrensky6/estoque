import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AnaliseIntegridade, StatusIntegridade } from "./validar-integridade";

const carregarIntegridadeAnalise = vi.fn();
const carregarMapaIntegridade = vi.fn();
const exigirPermissaoIntegridade = vi.fn();
const identidadeAtual = vi.fn();
const registrarEvento = vi.fn();

vi.mock("./integridade-loader", () => ({
  carregarIntegridadeAnalise: (...a: unknown[]) => carregarIntegridadeAnalise(...a),
  carregarMapaIntegridade: (...a: unknown[]) => carregarMapaIntegridade(...a),
}));
vi.mock("./permissoes", () => ({
  exigirPermissaoIntegridade: (...a: unknown[]) => exigirPermissaoIntegridade(...a),
  identidadeAtual: (...a: unknown[]) => identidadeAtual(...a),
}));
vi.mock("@/lib/actions/eventos", () => ({
  registrarEvento: (...a: unknown[]) => registrarEvento(...a),
}));

function analise(status: StatusIntegridade, extra: Partial<AnaliseIntegridade> = {}): AnaliseIntegridade {
  return {
    codigo: "X1",
    nome: "Análise X1",
    ativo: true,
    status,
    custoCalculavel: status !== "BLOQUEADA",
    problemas:
      status === "BLOQUEADA"
        ? [
            {
              codigo: "insumo.sem_custo",
              gravidade: "bloqueio",
              cadastro: "insumo",
              mensagem: 'Insumo "Taq" sem custo unitário cadastrado — não pode virar custo zero.',
              acaoRecomendada: "Informar valor.",
            },
          ]
        : status === "COM_ALERTAS"
          ? [
              {
                codigo: "etapa.sem_tempo_bancada",
                gravidade: "alerta",
                cadastro: "etapa",
                mensagem: "Sem tempo de bancada.",
                acaoRecomendada: "Informar tempo.",
              },
            ]
          : [],
    ...extra,
  };
}

describe("guard-custeio", () => {
  beforeEach(() => {
    vi.resetModules();
    carregarIntegridadeAnalise.mockReset();
    carregarMapaIntegridade.mockReset();
    exigirPermissaoIntegridade.mockReset();
    identidadeAtual.mockReset();
    registrarEvento.mockReset();
    identidadeAtual.mockResolvedValue({ id: "u-1", email: "user@lab" });
    exigirPermissaoIntegridade.mockResolvedValue(undefined);
  });

  it("análise PRONTA passa sem override", async () => {
    const { assegurarAnaliseLiberada } = await import("./guard-custeio");
    carregarIntegridadeAnalise.mockResolvedValue(analise("PRONTA"));
    const r = await assegurarAnaliseLiberada({ codigo: "X1" });
    expect(r.status).toBe("PRONTA");
    expect(r.override).toBeNull();
    expect(registrarEvento).not.toHaveBeenCalled();
  });

  it("análise COM_ALERTAS passa (alerta visível, não bloqueia)", async () => {
    const { assegurarAnaliseLiberada } = await import("./guard-custeio");
    carregarIntegridadeAnalise.mockResolvedValue(analise("COM_ALERTAS"));
    const r = await assegurarAnaliseLiberada({ codigo: "X1" });
    expect(r.status).toBe("COM_ALERTAS");
    expect(r.override).toBeNull();
  });

  it("análise BLOQUEADA sem justificativa falha com a causa específica (custo não vira zero)", async () => {
    const { assegurarAnaliseLiberada, AnaliseBloqueadaError } = await import("./guard-custeio");
    carregarIntegridadeAnalise.mockResolvedValue(analise("BLOQUEADA"));
    await expect(assegurarAnaliseLiberada({ codigo: "X1" })).rejects.toBeInstanceOf(AnaliseBloqueadaError);
    await expect(assegurarAnaliseLiberada({ codigo: "X1" })).rejects.toThrow(/sem custo unitário/);
    expect(exigirPermissaoIntegridade).not.toHaveBeenCalled();
  });

  it("override sem justificativa falha (não chega a pedir permissão)", async () => {
    const { assegurarAnaliseLiberada, AnaliseBloqueadaError } = await import("./guard-custeio");
    carregarIntegridadeAnalise.mockResolvedValue(analise("BLOQUEADA"));
    await expect(
      assegurarAnaliseLiberada({ codigo: "X1", override: { justificativa: "   " } }),
    ).rejects.toBeInstanceOf(AnaliseBloqueadaError);
    expect(exigirPermissaoIntegridade).not.toHaveBeenCalled();
  });

  it("override sem permissão falha", async () => {
    const { assegurarAnaliseLiberada } = await import("./guard-custeio");
    carregarIntegridadeAnalise.mockResolvedValue(analise("BLOQUEADA"));
    exigirPermissaoIntegridade.mockRejectedValue(new Error("Sem permissão para override"));
    await expect(
      assegurarAnaliseLiberada({ codigo: "X1", override: { justificativa: "urgente, cliente VIP" } }),
    ).rejects.toThrow(/Sem permissão/);
    expect(registrarEvento).not.toHaveBeenCalled();
  });

  it("override válido é auditado e retorna o registro com usuário e problema", async () => {
    const { assegurarAnaliseLiberada } = await import("./guard-custeio");
    carregarIntegridadeAnalise.mockResolvedValue(analise("BLOQUEADA"));
    const r = await assegurarAnaliseLiberada({
      codigo: "X1",
      override: { justificativa: "exceção aprovada pelo coordenador" },
      auditoria: { entidade: "orcamento", entidadeId: 42 },
    });
    expect(exigirPermissaoIntegridade).toHaveBeenCalledWith("cadastros.integridade.override");
    expect(r.override).toMatchObject({
      aplicado: true,
      justificativa: "exceção aprovada pelo coordenador",
      usuario_id: "u-1",
      usuario_email: "user@lab",
    });
    expect(r.override?.problemas[0]?.codigo).toBe("insumo.sem_custo");
    expect(registrarEvento).toHaveBeenCalledTimes(1);
    const args = registrarEvento.mock.calls[0];
    expect(args[0]).toBe("orcamento");
    expect(args[1]).toBe(42);
    expect(args[3]).toBe("override_integridade");
    expect(String(args[4])).toMatch(/exceção aprovada/);
  });

  it("análise inexistente é bloqueada", async () => {
    const { assegurarAnaliseLiberada, AnaliseBloqueadaError } = await import("./guard-custeio");
    carregarIntegridadeAnalise.mockResolvedValue(null);
    await expect(assegurarAnaliseLiberada({ codigo: "FANTASMA" })).rejects.toBeInstanceOf(
      AnaliseBloqueadaError,
    );
  });

  describe("assegurarAnalisesLiberadas (lote: recálculo/emissão/planejamento)", () => {
    it("bloqueia o lote quando há análise bloqueada, listando as causas", async () => {
      const { assegurarAnalisesLiberadas, AnaliseBloqueadaError } = await import("./guard-custeio");
      const mapa = new Map<string, AnaliseIntegridade>([
        ["OK1", analise("PRONTA", { codigo: "OK1" })],
        ["BAD", analise("BLOQUEADA", { codigo: "BAD" })],
      ]);
      carregarMapaIntegridade.mockResolvedValue(mapa);
      await expect(assegurarAnalisesLiberadas(["OK1", "BAD"])).rejects.toBeInstanceOf(
        AnaliseBloqueadaError,
      );
      await expect(assegurarAnalisesLiberadas(["OK1", "BAD"])).rejects.toThrow(/BAD/);
    });

    it("passa quando todas estão prontas/alerta", async () => {
      const { assegurarAnalisesLiberadas } = await import("./guard-custeio");
      const mapa = new Map<string, AnaliseIntegridade>([
        ["OK1", analise("PRONTA", { codigo: "OK1" })],
        ["OK2", analise("COM_ALERTAS", { codigo: "OK2" })],
      ]);
      carregarMapaIntegridade.mockResolvedValue(mapa);
      await expect(assegurarAnalisesLiberadas(["OK1", "OK2"])).resolves.toBeInstanceOf(Map);
    });
  });
});
