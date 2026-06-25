import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const revalidatePath = vi.fn();
const select = vi.fn();
const single = vi.fn();
const update = vi.fn();
const insert = vi.fn();
const eq = vi.fn();
const deleteRow = vi.fn();
const from = vi.fn();
const createClient = vi.fn();
const registrarEvento = vi.fn();
const registrarVersaoParametrosEconomicos = vi.fn();
const exigirPapelOrcamento = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("./eventos", () => ({ registrarEvento }));
vi.mock("@/lib/orcamento/parametros-versionamento", () => ({ registrarVersaoParametrosEconomicos }));
vi.mock("@/lib/orcamento/governanca", () => ({ exigirPapelOrcamento }));
vi.mock("@/lib/supabase/server", () => ({
  createClient,
}));

describe("actions de orcamento de projetos", () => {
  beforeEach(() => {
    redirect.mockClear();
    revalidatePath.mockClear();
    select.mockReset();
    single.mockReset();
    update.mockReset();
    insert.mockReset();
    eq.mockReset();
    deleteRow.mockReset();
    from.mockReset();
    createClient.mockReset();
    registrarEvento.mockReset();
    registrarVersaoParametrosEconomicos.mockReset();
    exigirPapelOrcamento.mockReset();
    eq.mockResolvedValue({ error: null });
    select.mockReturnValue({ eq });
    single.mockResolvedValue({ data: { status: "rascunho" }, error: null });
    update.mockReturnValue({ eq });
    insert.mockResolvedValue({ error: null });
    deleteRow.mockReturnValue({ eq });
    from.mockReturnValue({ select, update, delete: deleteRow, insert });
    eq.mockReturnValue({ single });
    createClient.mockResolvedValue({ from });
  });

  it("salva justificativa formal para projeto sem custo", async () => {
    const { salvarOrcamentoProjeto } = await import("./orcamento-projetos");
    const formData = new FormData();
    formData.set("orcamento_projeto_id", "77");
    formData.set("titulo", "Projeto sem custo");
    formData.set("status", "enviado");
    formData.set("validade_dias", "30");
    formData.set("projeto_sem_custo_justificativa", "Execução sem cobrança por contrapartida institucional.");

    await salvarOrcamentoProjeto(formData);

    expect(exigirPapelOrcamento).toHaveBeenCalledWith("preencher_custos");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      titulo: "Projeto sem custo",
      status: "enviado",
      projeto_sem_custo_justificativa: "Execução sem cobrança por contrapartida institucional.",
    }));
    expect(eq).toHaveBeenCalledWith("id", 77);
  });

  it("adiciona custo manual com etapa, atividade, entrega e nomenclatura institucional", async () => {
    const { adicionarCustoProjeto } = await import("./orcamento-projetos");
    const formData = new FormData();
    formData.set("orcamento_projeto_id", "77");
    formData.set("rubrica", "MC");
    formData.set("categoria", "materiais");
    formData.set("descricao", "Kit de coleta");
    formData.set("quantidade", "2");
    formData.set("custo_unitario", "150");
    formData.set("unidade", "un");
    formData.set("etapa", "Campo");
    formData.set("atividade", "Coleta");
    formData.set("entrega", "Relatório técnico");
    formData.set("categoria_institucional", "Material de consumo");

    await adicionarCustoProjeto(formData);

    expect(exigirPapelOrcamento).toHaveBeenCalledWith("preencher_custos");
    expect(insert).toHaveBeenCalledWith({
      orcamento_projeto_id: 77,
      categoria: "materiais",
      rubrica: "MC",
      descricao: "Kit de coleta",
      quantidade: 2,
      unidade: "un",
      custo_unitario: 150,
      preco_unitario: 150,
      meses_selecionados: [],
      origem: "manual",
      etapa: "Campo",
      atividade: "Coleta",
      entrega: "Relatório técnico",
      categoria_institucional: "Material de consumo",
      nomenclatura_origem: "kontrol",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/orcamento/projetos/77");
  });

  it("bloqueia salvar parametros economicos com gross-up maior ou igual a 100%", async () => {
    const { salvarParametrosEconomicosProjeto } = await import("./orcamento-projetos");
    const formData = new FormData();
    formData.set("orcamento_projeto_id", "77");
    formData.set("impostos_legacy", "50");
    formData.set("incubacao", "20");
    formData.set("reserva", "10");
    formData.set("investimentos", "10");
    formData.set("lucro", "10");

    await expect(salvarParametrosEconomicosProjeto(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/orcamento/projetos/77?erro_parametros=",
    );

    expect(exigirPapelOrcamento).toHaveBeenCalledWith("editar_parametros");
    expect(createClient).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("salva parametros economicos validos", async () => {
    const { salvarParametrosEconomicosProjeto } = await import("./orcamento-projetos");
    const formData = new FormData();
    formData.set("orcamento_projeto_id", "77");
    formData.set("margem_lucro", "0");
    formData.set("impostos", "0");
    formData.set("project_months", "12");
    formData.set("impostos_legacy", "12");
    formData.set("incubacao", "5");
    formData.set("reserva", "3");
    formData.set("investimentos", "4");
    formData.set("lucro", "10");

    await salvarParametrosEconomicosProjeto(formData);

    expect(exigirPapelOrcamento).toHaveBeenCalledWith("editar_parametros");
    expect(update).toHaveBeenCalledWith({
      margem_lucro: 0,
      impostos: 0,
      project_months: 12,
      impostos_legacy: 12,
      incubacao: 5,
      reserva: 3,
      investimentos: 4,
      lucro: 10,
    });
    expect(eq).toHaveBeenCalledWith("id", 77);
    expect(registrarVersaoParametrosEconomicos).toHaveBeenCalledWith(expect.anything(), {
      escopo: "projeto",
      orcamentoProjetoId: 77,
      parametros: {
        margem_lucro: 0,
        impostos: 0,
        project_months: 12,
        impostos_legacy: 12,
        incubacao: 5,
        reserva: 3,
        investimentos: 4,
        lucro: 10,
      },
      origem: "orcamento/projetos",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/orcamento/projetos/77");
    expect(revalidatePath).toHaveBeenCalledWith("/orcamento/projetos");
  });

  it("bloqueia exclusao de projeto enviado", async () => {
    const { excluirOrcamentoProjeto } = await import("./orcamento-projetos");
    const formData = new FormData();
    formData.set("orcamento_projeto_id", "77");
    single.mockResolvedValue({ data: { status: "enviado" }, error: null });

    await expect(excluirOrcamentoProjeto(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/orcamento/projetos/77?erro_exclusao=",
    );

    expect(exigirPapelOrcamento).toHaveBeenCalledWith("cancelar_documento");
    expect(deleteRow).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith(expect.stringContaining("/orcamento/projetos/77?erro_exclusao="));
  });

  it("permite exclusao de projeto em rascunho", async () => {
    const { excluirOrcamentoProjeto } = await import("./orcamento-projetos");
    const formData = new FormData();
    formData.set("orcamento_projeto_id", "77");
    single.mockResolvedValue({ data: { status: "rascunho" }, error: null });

    await expect(excluirOrcamentoProjeto(formData)).rejects.toThrow("NEXT_REDIRECT:/orcamento/projetos");

    expect(exigirPapelOrcamento).toHaveBeenCalledWith("cancelar_documento");
    expect(deleteRow).toHaveBeenCalled();
    expect(eq).toHaveBeenCalledWith("id", 77);
    expect(revalidatePath).toHaveBeenCalledWith("/orcamento/projetos");
    expect(redirect).toHaveBeenCalledWith("/orcamento/projetos");
  });

  it("cancela projeto preservando historico", async () => {
    const { cancelarOrcamentoProjeto } = await import("./orcamento-projetos");
    const formData = new FormData();
    formData.set("orcamento_projeto_id", "77");
    formData.set("motivo", "Cancelamento solicitado");
    single.mockResolvedValue({ data: { status: "enviado" }, error: null });
    eq.mockReturnValueOnce({ single }).mockResolvedValueOnce({ error: null });

    await expect(cancelarOrcamentoProjeto(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/orcamento/projetos/77",
    );

    expect(exigirPapelOrcamento).toHaveBeenCalledWith("cancelar_documento");
    expect(update).toHaveBeenCalledWith({ status: "cancelado" });
    expect(registrarEvento).toHaveBeenCalledWith(
      "orcamento_projeto",
      77,
      "enviado",
      "cancelado",
      "Cancelamento solicitado",
    );
    expect(revalidatePath).toHaveBeenCalledWith("/orcamento/projetos/77");
    expect(revalidatePath).toHaveBeenCalledWith("/orcamento/projetos");
  });

  it("arquiva template sem apagar o registro", async () => {
    const { excluirTemplate } = await import("./orcamento-projetos");
    const formData = new FormData();
    formData.set("template_id", "12");
    single.mockResolvedValue({ data: { nome: "Monitoramento padrão", descricao: "Base recorrente" }, error: null });

    await excluirTemplate(formData);

    expect(exigirPapelOrcamento).toHaveBeenCalledWith("gerir_modelos");
    expect(deleteRow).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      nome: "[ARQUIVADO] Monitoramento padrão",
    }));
    expect(eq).toHaveBeenCalledWith("id", 12);
    expect(revalidatePath).toHaveBeenCalledWith("/orcamento/modelos");
  });
});
