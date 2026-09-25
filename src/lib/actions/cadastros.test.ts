import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidatePath = vi.fn();
const single = vi.fn();
const select = vi.fn(() => ({ single }));
const insert = vi.fn();
const eq = vi.fn();
const selectAtualizados = vi.fn();
const update = vi.fn();
const from = vi.fn(() => ({ insert, update }));
const rpc = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({
  createClientUntyped: vi.fn(async () => ({ from, rpc })),
}));

function formInsumo(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  const base: Record<string, string> = {
    _slug: "insumos",
    especificacao: "Master mix qPCR",
    custo_total_embalagem: "500",
    quantidade_embalagem: "100",
    unidade: "frasco",
    unidade_consumo: "reacao",
    fator_conversao: "100",
  };

  for (const [key, value] of Object.entries({ ...base, ...overrides })) {
    formData.set(key, value);
  }

  return formData;
}

function formInsumoExistente(id: number) {
  const formData = formInsumo();
  formData.set("_id", String(id));
  return formData;
}

describe("cadastro de insumos", () => {
  beforeEach(() => {
    revalidatePath.mockReset();
    from.mockClear();
    insert.mockReset();
    update.mockReset();
    select.mockClear();
    single.mockReset();
    eq.mockReset();
    rpc.mockReset();
    insert.mockReturnValue({ select });
    update.mockReturnValue({ eq });
    single.mockResolvedValue({ data: { id: 321 }, error: null });
    selectAtualizados.mockReset();
    selectAtualizados.mockResolvedValue({ data: [{ id: 321 }], error: null });
    eq.mockReturnValue({ select: selectAtualizados });
    rpc.mockResolvedValue({ data: { insumo_id: 321, repetido: false }, error: null });
  });

  it("bloqueia fator de conversao zero ou negativo", async () => {
    const { salvarRegistro } = await import("./cadastros");
    const result = await salvarRegistro({ ok: false }, formInsumo({ fator_conversao: "0" }));

    expect(result.ok).toBe(false);
    expect(result.errors?.fator_conversao).toBe("Mínimo 0.000001");
    expect(from).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("bloqueia quantidade de embalagem zerada", async () => {
    const { salvarRegistro } = await import("./cadastros");
    const result = await salvarRegistro({ ok: false }, formInsumo({ quantidade_embalagem: "0" }));

    expect(result.ok).toBe(false);
    expect(result.errors?.quantidade_embalagem).toBe("Mínimo 0.000001");
    expect(from).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("bloqueia quantidade em estoque negativa ou fracionada", async () => {
    const { salvarRegistro } = await import("./cadastros");

    const negativa = await salvarRegistro({ ok: false }, formInsumo({ quantidade: "-1" }));
    expect(negativa.ok).toBe(false);
    expect(negativa.errors?.quantidade).toBe("Mínimo 0");

    const fracionada = await salvarRegistro({ ok: false }, formInsumo({ quantidade: "1.5" }));
    expect(fracionada.ok).toBe(false);
    expect(fracionada.errors?.quantidade).toBe("Use um número inteiro de embalagens");

    expect(rpc).not.toHaveBeenCalled();
  });

  it("cria o insumo com quantidade pela RPC atomica, sem tocar insert direto", async () => {
    const { salvarRegistro } = await import("./cadastros");
    const result = await salvarRegistro({ ok: false }, formInsumo({ quantidade: "3" }));

    expect(result).toEqual({ ok: true, message: "Criado.", createdId: 321 });
    expect(insert).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledOnce();
    const [fn, args] = rpc.mock.calls[0];
    expect(fn).toBe("criar_insumo_com_quantidade");
    expect(args).toMatchObject({
      p_quantidade_embalagens: 3,
      p_dados_insumo: expect.objectContaining({
        especificacao: "Master mix qPCR",
        quantidade_embalagem: 100,
        unidade: "frasco",
        unidade_consumo: "reacao",
        fator_conversao: 100,
      }),
    });
    expect(typeof args.p_operacao_id).toBe("string");
    expect(args.p_operacao_id.length).toBeGreaterThan(0);
    // "quantidade" nao e uma coluna de insumos: nao pode vazar no payload.
    expect(args.p_dados_insumo).not.toHaveProperty("quantidade");
    // A RPC calcula o custo unitario e recusa a chave ("Campo não reconhecido").
    expect(args.p_dados_insumo).not.toHaveProperty("custo_unitario");
  });

  it("envia somente chaves aceitas pela RPC do banco (bug: Campo não reconhecido)", async () => {
    const { readFileSync, readdirSync } = await import("node:fs");
    const { join } = await import("node:path");
    const dir = join(process.cwd(), "supabase", "migrations");
    // a definição mais recente da função é a que vale no banco
    const sql = readdirSync(dir)
      .filter((nome) => nome.endsWith(".sql"))
      .sort()
      .map((nome) => readFileSync(join(dir, nome), "utf8"))
      .filter((texto) => texto.includes("function public.criar_insumo_com_quantidade("))
      .at(-1);
    expect(sql).toBeTruthy();
    const lista = sql!.match(/where k not in \(([\s\S]*?)\)\s*\)/)?.[1] ?? "";
    const aceitas = new Set([...lista.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]));
    expect(aceitas.size).toBeGreaterThan(10);

    const { salvarRegistro } = await import("./cadastros");
    await salvarRegistro(
      { ok: false },
      formInsumo({
        quantidade: "2",
        codigo_lote: "L-2026-01",
        data_aquisicao: "2026-09-01",
        validade_dias: "30",
        categoria_compra: "critico",
        ponto_reposicao: "1",
      }),
    );
    const [, args] = rpc.mock.calls[0];
    const enviadas = Object.keys(args.p_dados_insumo);
    expect(enviadas.filter((chave) => !aceitas.has(chave))).toEqual([]);
    expect(args.p_dados_insumo.codigo_lote).toBe("L-2026-01");
  });

  it("assume quantidade zero quando o campo nao e enviado", async () => {
    const { salvarRegistro } = await import("./cadastros");
    await salvarRegistro({ ok: false }, formInsumo());

    expect(rpc).toHaveBeenCalledWith(
      "criar_insumo_com_quantidade",
      expect.objectContaining({ p_quantidade_embalagens: 0 }),
    );
  });

  it("reutiliza o operacao_id enviado pelo formulario (reenvio idempotente)", async () => {
    const { salvarRegistro } = await import("./cadastros");
    await salvarRegistro(
      { ok: false },
      formInsumo({ quantidade: "3", _operacao_id: "11111111-1111-1111-1111-111111111111" }),
    );

    expect(rpc).toHaveBeenCalledWith(
      "criar_insumo_com_quantidade",
      expect.objectContaining({ p_operacao_id: "11111111-1111-1111-1111-111111111111" }),
    );
  });

  it("não retorna ID quando a criação falha", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Falha ao criar." } });
    const { salvarRegistro } = await import("./cadastros");

    const result = await salvarRegistro({ ok: false }, formInsumo());

    expect(result).toEqual({ ok: false, message: "Falha ao criar." });
    expect(result).not.toHaveProperty("createdId");
    expect(rpc).toHaveBeenCalledOnce();
  });

  it("não inventa criação ao atualizar", async () => {
    const { salvarRegistro } = await import("./cadastros");

    const result = await salvarRegistro({ ok: false }, formInsumoExistente(321));

    expect(result).toEqual({ ok: true, message: "Atualizado." });
    expect(result).not.toHaveProperty("createdId");
    expect(update).toHaveBeenCalledOnce();
    expect(eq).toHaveBeenCalledWith("id", 321);
    expect(insert).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("não diz Atualizado quando o banco não alterou nenhuma linha (RLS)", async () => {
    selectAtualizados.mockResolvedValue({ data: [], error: null });
    const { salvarRegistro } = await import("./cadastros");

    const result = await salvarRegistro({ ok: false }, formInsumoExistente(321));

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/Nada foi alterado/);
  });

  it.each([
    ["ausente", null],
    ["malformado", { insumo_id: "321" }],
  ])("falha fechada quando o ID criado é %s", async (_caso, data) => {
    rpc.mockResolvedValue({ data, error: null });
    const { salvarRegistro } = await import("./cadastros");

    const result = await salvarRegistro({ ok: false }, formInsumo());

    expect(result).toEqual({
      ok: false,
      message: "Não foi possível confirmar o identificador do registro criado.",
    });
    expect(result).not.toHaveProperty("createdId");
    expect(rpc).toHaveBeenCalledOnce();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
