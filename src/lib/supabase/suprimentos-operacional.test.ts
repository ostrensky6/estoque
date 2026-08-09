import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function migration(name: string) {
  return readFileSync(join(root, "supabase", "migrations", name), "utf8");
}

function migrationsPosterioresA0098() {
  const dir = join(root, "supabase", "migrations");
  return readdirSync(dir)
    .filter((name) => /^\d{4}_.*\.sql$/.test(name) && Number(name.slice(0, 4)) > 98)
    .sort()
    .map((name) => readFileSync(join(dir, name), "utf8"))
    .join("\n")
    .replace(/\s+/g, " ")
    .toLowerCase();
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

  it("mantem recebimento parcial rastreavel por lote no pedido interno", () => {
    const sql = migration("0083_pedidos_internos_recebimento_parcial.sql");

    expect(sql).toContain("pedidos_internos_item_recebimentos");
    expect(sql).toContain("pedido_interno_item_id");
    expect(sql).toContain("v_total_recebido := v_item.quantidade_recebida + p_quantidade");
    expect(sql).toContain("Quantidade recebida excede o saldo pendente do item.");
    expect(sql).toContain("recebido_em = case when v_total_recebido >= v_item.quantidade");
    expect(sql).toContain("tipo in ('material', 'equipamento')");
    expect(sql).toContain("drop constraint if exists pedidos_internos_status_check");
    expect(sql).toContain("add constraint pedidos_internos_status_check");
    expect(sql).toContain(")) not valid");
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
    const sql = migration("0084_suprimentos_vinculo_previsao_liberacao.sql");

    expect(sql).toContain("- qtd_pedida_aberta");
    expect(sql).toContain("pi.quantidade_recebida");
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

  it("mantem planejamento executivo independente do orcamento e rastreia responsaveis", () => {
    const sql = migration("0082_planejamento_executivo_estoque.sql");

    expect(sql).toContain("data_inicio_prevista");
    expect(sql).toContain("data_fim_prevista");
    expect(sql).toContain("origem_planejamento");
    expect(sql).toContain("planejado_por");
    expect(sql).toContain("reservado_por");
    expect(sql).toContain("v_planejamento_compromissos_estoque");
    expect(sql).toContain("validar_planejamento_executivo");
    expect(sql).toContain("Informe o projeto do planejamento antes de reservar.");
  });

  it("recria a reserva do plano quando a assinatura muda o tipo de retorno", () => {
    const sql = migration("0081_suprimentos_orquestrador_rastreavel.sql");

    expect(sql).toContain("drop function if exists reservar_plano(bigint, jsonb)");
    expect(sql).toContain("create function reservar_plano(p_planejamento_id bigint, p_itens jsonb)");
    expect(sql).toContain("returns jsonb");
  });

  it("consolida reposicao idempotente e baixa integral do planejamento", () => {
    const sql = migration("0098_consolidar_atomicidade_suprimentos.sql");

    expect(sql).toContain("origem = 'reposicao_estoque'");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("criar_pedido_reposicao_estoque");
    expect(sql).toContain("previsao.qtd_sugerida_compra > 0");
    expect(sql).toContain("jsonb_array_length(v_short) > 0");
    expect(sql).toContain("existem reservas sem estoque válido suficiente");
    expect(sql.indexOf("jsonb_array_length(v_short) > 0")).toBeLessThan(
      sql.indexOf("insert into estoque_movimentacoes("),
    );
    expect(sql.match(/extensions\.digest\(p_token/g)).toHaveLength(2);
  });

  it("estabiliza shortfall parcial re-reserva e ciclo de equipamento apos 0098", () => {
    const sql = migrationsPosterioresA0098();

    expect(sql).toContain("create or replace function public.reservar_plano");
    expect(sql).toMatch(/insert into (public\.)?reservas_estoque[^;]+lote_id[^;]+null[^;]+'parcial'/);
    expect(sql.match(/status in \('reservado', ?'parcial'\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(sql).toContain("lote_id is not null");
    expect(sql).toContain("quantidade - coalesce(quantidade_consumida, 0)");
    expect(sql).toContain("equipamento_analise");
    expect(sql).toContain("data_inicio_prevista");
    expect(sql).toContain("data_fim_prevista");
    expect(sql).toContain("fn_validar_equipamentos_na_baixa_plano");
    expect(sql).toContain("em_uso");
    expect(sql).toContain("liberado");
    expect(sql).toContain("concluido");
  });

  it("exige cobertura temporal integral do equipamento ate a baixa e a liberacao", () => {
    const sql = migrationsPosterioresA0098();
    const definicao = (nome: string) => {
      const inicio = sql.lastIndexOf(`create or replace function public.${nome}`);
      const fim = sql.indexOf("end $$;", inicio);
      return inicio < 0 ? "" : sql.slice(inicio, fim < 0 ? sql.length : fim);
    };

    const reservar = definicao("reservar_equipamento_planejamento");
    expect.soft(
      reservar,
      "reserva 5-6 deve ser rejeitada para plano 1-10, mantendo 1-10 aceito",
    ).toMatch(
      /if p_data_inicio::date > v_plano\.data_inicio_prevista or p_data_fim::date < v_plano\.data_fim_prevista then/,
    );
    expect.soft(reservar, "sobreposicao ativa deve ser rejeitada").toMatch(
      /er\.status in \('reservado', 'em_uso'\)[^;]+tstzrange\(er\.data_inicio, er\.data_fim, '\[\)'\) && tstzrange\(p_data_inicio, p_data_fim, '\[\)'\)/,
    );

    const baixa = definicao("dar_baixa_plano");
    const coberturaInicio = baixa.search(/er\.data_inicio::date\s*<=\s*\w+\.data_inicio_prevista/);
    const coberturaFim = baixa.search(/er\.data_fim::date\s*>=\s*\w+\.data_fim_prevista/);
    const primeiraEscrita = baixa.search(/\b(?:update|insert into|delete from)\s+public\./);
    expect.soft(
      coberturaInicio >= 0
        && coberturaFim >= 0
        && Math.max(coberturaInicio, coberturaFim) < primeiraEscrita,
      "dar_baixa_plano deve revalidar cobertura integral antes da primeira escrita",
    ).toBe(true);

    const liberar = definicao("liberar_plano");
    expect.soft(liberar, "outra reserva ativa deve manter a unidade reservada").toMatch(
      /update public\.equipamento_unidades[^;]+not exists \([^;]+er\.status in \('reservado', 'em_uso'\)/,
    );
  });
});
