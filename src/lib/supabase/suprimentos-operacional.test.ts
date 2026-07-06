import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function migration(name: string) {
  return readFileSync(join(root, "supabase", "migrations", name), "utf8");
}

describe("migrations operacionais de suprimentos", () => {
  it("mantem baixa manual, ajuste de saldo e validade efetiva no estoque", () => {
    const sql = migration("0028_suprimentos_operacao_completa.sql");

    expect(sql).toContain("create or replace function baixa_manual_lote");
    expect(sql).toContain("create or replace function ajustar_saldo_lote");
    expect(sql).toContain("validade_apos_abertura");
    expect(sql).toContain("select 'sem_validade'");
    expect(sql).toContain("menor_validade(l.validade, l.validade_apos_abertura)");
  });

  it("mantem status operacional explicito no planejamento", () => {
    const sql = migration("0029_planejamento_execucao_operacional.sql");

    expect(sql).toContain("status_operacional");
    expect(sql).toContain("marcar_planejamento_reservado");
    expect(sql).toContain("marcar_planejamento_em_execucao");
    expect(sql).toContain("concluir_planejamento");
    expect(sql).toContain("cancelar_planejamento_operacional");
  });

  it("mantem recebimento parcial e divergencia em compras e pedidos internos", () => {
    const sql = migration("0030_recebimento_divergencias.sql");

    expect(sql).toContain("quantidade_recebida");
    expect(sql).toContain("divergencia_recebimento");
    expect(sql).toContain("pedidos_compra_itens");
    expect(sql).toContain("pedidos_internos_itens");
  });

  it("mantem notificacoes operacionais para validade e quarentena", () => {
    const sql = migration("0031_alertas_operacionais_notificacoes.sql");

    expect(sql).toContain("create or replace function gerar_reposicao_automatica");
    expect(sql).toContain("notificacoes_criadas");
    expect(sql).toContain("where a.tipo = 'sem_validade'");
    expect(sql).toContain("where a.tipo = 'quarentena'");
    expect(sql).toContain("'quarentena:' || a.insumo_id");
  });

  it("mantem recebimento formal sincronizado com item interno", () => {
    const sql = migration("0078_corrigir_ciclo_suprimentos_operacional.sql");

    expect(sql).toContain("pi.pedido_interno_item_id");
    expect(sql).toContain("if v_item.pedido_interno_item_id is not null then");
    expect(sql).toContain("update pedidos_internos_itens");
    expect(sql).toContain("where id = v_item.pedido_interno_item_id");
    expect(sql).toContain("if v_item.lote_id is not null then");
  });

  it("desconta pedidos abertos na previsao e exige liberacao documentada para lote critico", () => {
    const sql = migration("0079_suprimentos_vinculo_previsao_liberacao.sql");

    expect(sql).toContain("- qtd_pedida_aberta");
    expect(sql).toContain("v_lote.categoria_compra = 'critico'");
    expect(sql).toContain("v_responsavel is null or v_criterio is null");
    expect(sql).toContain("Lote critico exige responsavel e criterio de aceitacao.");
  });

  it("mantem controle aditivo de envio externo de notificacoes", () => {
    const sql = migration("0080_notificacoes_email_operacional.sql");

    expect(sql).toContain("email_enviado_em");
    expect(sql).toContain("email_erro");
    expect(sql).toContain("email_tentativas");
    expect(sql).toContain("notificacoes_email_pendentes_idx");
  });
});
