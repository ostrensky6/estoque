import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/0014_rls_por_papel.sql"),
  "utf8",
);
const aliasCleanupMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/0015_rls_limpa_aliases_lotes.sql"),
  "utf8",
);
const orcamentoRlsMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/0075_rls_permissoes_orcamentos.sql"),
  "utf8",
);
const operacoesFisicasMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/0085_blindar_operacoes_fisicas.sql"),
  "utf8",
);
const transicoesPedidoInternoMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/0087_transicoes_pedido_interno_transacionais.sql"),
  "utf8",
);
const formalizacaoPedidoMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/0088_formalizar_pedido_interno_transacional.sql"),
  "utf8",
);
const transicoesPedidoCompraMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/0089_transicoes_pedido_compra_transacionais.sql"),
  "utf8",
);
const transicoesOrcamentosMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/0090_transicoes_orcamentos_transacionais.sql"),
  "utf8",
);
const blindagemPlanejamentoMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/0091_blindar_status_planejamento.sql"),
  "utf8",
);
const recebimentoParcialCompraMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/0092_recebimento_parcial_compra_formal.sql"),
  "utf8",
);
const documentosPedidosMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/0093_documentos_reais_pedidos_internos.sql"),
  "utf8",
);
const custosEstoqueMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/0094_camada_custos_estoque.sql"),
  "utf8",
);
const bloqueioBaixaEquipamentoMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/0097_bloquear_baixa_sem_equipamento.sql"),
  "utf8",
);
const consolidacaoSuprimentosMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/0098_consolidar_atomicidade_suprimentos.sql"),
  "utf8",
);
const blindagemMarcadoresMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/0103_blindar_marcadores_transacionais.sql"),
  "utf8",
);
describe("RLS por papel", () => {
  it("remove policies abertas e instala predicado hierarquico", () => {
    expect(migration).toContain("drop policy if exists authenticated_all_");
    expect(migration).toContain("drop policy if exists anon_read_");
    expect(migration).toContain("create or replace function papel_minimo");
    expect(migration).toContain("array['tecnico','coordenador','gestor','admin']");
  });

  it("protege transicoes de lote por papel", () => {
    expect(migration).toContain("perform fn_exige_papel('coordenador');");
    expect(migration.match(/perform fn_exige_papel\('gestor'\);/g)?.length).toBeGreaterThanOrEqual(3);
    expect(migration).toContain("create or replace function aceitar_lote");
    expect(migration).toContain("create or replace function descartar_lote");
  });

  it("mantem estoque fisico sem mutacao direta por policy", () => {
    expect(migration).toContain(
      "Sem policies de insert/update/delete diretas em lotes/reservas/movimentações.",
    );
    expect(`${migration}\n${aliasCleanupMigration}`).toContain(
      "drop policy if exists authenticated_all_lotes",
    );
    expect(`${migration}\n${aliasCleanupMigration}`).toContain(
      "drop policy if exists authenticated_all_reservas",
    );
    expect(migration).not.toContain("rls_tecnico_insert_lotes_estoque");
    expect(migration).not.toContain("rls_tecnico_update_lotes_estoque");
    expect(migration).not.toContain("rls_tecnico_insert_reservas_estoque");
  });

  it("endurece RLS no modulo orcamentos (Fase 11 - migration 0075)", () => {
    // Remove as policies amplas
    expect(orcamentoRlsMigration).toContain("drop policy if exists authenticated_all_orcamento_final_versoes");
    expect(orcamentoRlsMigration).toContain("drop policy if exists authenticated_all_orcamento_parametros_aplicados");
    expect(orcamentoRlsMigration).toContain("drop policy if exists authenticated_all_demanda_analises");
    expect(orcamentoRlsMigration).toContain("drop policy if exists authenticated_all_demanda_grupos_amostras");
    expect(orcamentoRlsMigration).toContain("drop policy if exists authenticated_all_eventos_status");
    expect(orcamentoRlsMigration).toContain("drop policy if exists authenticated_all_orcamento_projeto_anexos");
    expect(orcamentoRlsMigration).toContain("drop policy if exists authenticated_all_orcamento_projeto_links");

    // Restringe escritas em versoes e parametros a coordenador
    expect(orcamentoRlsMigration).toContain("create policy rls_coordenador_insert_orcamento_final_versoes");
    expect(orcamentoRlsMigration).toContain("create policy rls_coordenador_insert_orcamento_parametros_aplicados");
    expect(orcamentoRlsMigration).toContain("papel_minimo('coordenador')");

    // Restringe escrita de anexos, links e analises a tecnico
    expect(orcamentoRlsMigration).toContain("create policy rls_tecnico_insert_demanda_analises");
    expect(orcamentoRlsMigration).toContain("create policy rls_tecnico_insert_orcamento_projeto_anexos");
    expect(orcamentoRlsMigration).toContain("create policy rls_tecnico_insert_orcamento_projeto_links");
    expect(orcamentoRlsMigration).toContain("papel_minimo('tecnico')");

    // Bloqueia atualizacao/delecao de historicos em eventos_status (apenas insert)
    expect(orcamentoRlsMigration).toContain("create policy rls_tecnico_insert_eventos_status");
    expect(orcamentoRlsMigration).not.toContain("update_eventos_status");
    expect(orcamentoRlsMigration).not.toContain("delete_eventos_status");

    // Endurece RPC de emissao no banco de dados
    expect(orcamentoRlsMigration).toContain("perform fn_exige_papel('coordenador');");
    expect(orcamentoRlsMigration).toContain("revoke execute on function emitir_orcamento_final_transacional");
    expect(orcamentoRlsMigration).toContain("from public, anon;");
    expect(orcamentoRlsMigration).toContain("grant execute on function emitir_orcamento_final_transacional");
    expect(orcamentoRlsMigration).toContain("to authenticated, service_role;");
  });

  it("bloqueia mutação física direta e execução anônima das RPCs operacionais", () => {
    expect(operacoesFisicasMigration).toContain(
      "revoke insert, update, delete on table public.lotes_estoque from authenticated;",
    );
    expect(operacoesFisicasMigration).toContain(
      "revoke insert, update, delete on table public.reservas_estoque from authenticated;",
    );
    expect(operacoesFisicasMigration).toContain(
      "revoke insert, update, delete on table public.equipamento_reservas from authenticated;",
    );
    expect(operacoesFisicasMigration).toContain(
      "drop policy if exists authenticated_all_equipamento_reservas",
    );
    expect(operacoesFisicasMigration).toContain(
      "revoke execute on function public.reservar_plano(bigint, jsonb) from public, anon;",
    );
    expect(operacoesFisicasMigration).toContain(
      "revoke execute on function public.receber_item_pedido_interno",
    );
    expect(operacoesFisicasMigration).toContain(
      "grant execute on function public.dar_baixa_plano(bigint) to authenticated, service_role;",
    );
  });

  it("bloqueia baixa por API sem reserva operacional de equipamento", () => {
    expect(bloqueioBaixaEquipamentoMigration).toContain("trg_validar_equipamentos_na_baixa_plano");
    expect(bloqueioBaixaEquipamentoMigration).toContain("join equipamento_analise ea");
    expect(bloqueioBaixaEquipamentoMigration).toContain("equipamento_reservas er");
    expect(bloqueioBaixaEquipamentoMigration).toContain("^plano [0-9]+(;|$)");
    expect(bloqueioBaixaEquipamentoMigration).toContain("Não é possível iniciar/baixar o plano");
  });

  it("remove acesso anonimo das views operacionais e das funcoes novas", () => {
    expect(consolidacaoSuprimentosMigration).toContain(
      "revoke all on public.v_planejamento_compromissos_estoque from public, anon;",
    );
    expect(consolidacaoSuprimentosMigration).toContain(
      "revoke all on public.v_previsao_suprimentos from public, anon;",
    );
    expect(consolidacaoSuprimentosMigration).toContain(
      "with (security_invoker = true)",
    );
    expect(consolidacaoSuprimentosMigration).toContain(
      "revoke execute on function public.criar_pedido_reposicao_estoque",
    );
  });

  it("centraliza status do pedido interno em RPC e bloqueia update direto", () => {
    expect(transicoesPedidoInternoMigration).toContain("create or replace function public.transicionar_pedido_interno");
    expect(transicoesPedidoInternoMigration).toContain("perform fn_exige_papel('coordenador');");
    expect(transicoesPedidoInternoMigration).toContain("Transicao de status nao permitida");
    expect(transicoesPedidoInternoMigration).toContain("insert into pedidos_internos_aprovacoes");
    expect(transicoesPedidoInternoMigration).toContain("insert into eventos_status");
    expect(transicoesPedidoInternoMigration).toContain("create trigger trg_bloquear_status_direto_pedido_interno");
    expect(transicoesPedidoInternoMigration).toContain("só pode ser alterado por transição transacional");
  });

  it("formaliza pedido e compra na mesma transação", () => {
    expect(formalizacaoPedidoMigration).toContain("create or replace function public.formalizar_pedido_interno");
    expect(formalizacaoPedidoMigration).toContain("insert into pedidos_compra(");
    expect(formalizacaoPedidoMigration).toContain("insert into pedidos_compra_itens(");
    expect(formalizacaoPedidoMigration).toContain("set pedido_compra_id = v_compra_id");
    expect(formalizacaoPedidoMigration).toContain("status = 'formalizado'");
    expect(formalizacaoPedidoMigration).toContain("insert into pedidos_internos_aprovacoes");
  });

  it("centraliza status da compra formal em RPC e bloqueia update direto", () => {
    expect(transicoesPedidoCompraMigration).toContain("create or replace function public.transicionar_pedido_compra");
    expect(transicoesPedidoCompraMigration).toContain("perform fn_exige_papel('coordenador');");
    expect(transicoesPedidoCompraMigration).toContain("Transição de status não permitida");
    expect(transicoesPedidoCompraMigration).toContain("insert into eventos_status");
    expect(transicoesPedidoCompraMigration).toContain("create trigger trg_bloquear_status_direto_pedido_compra");
    expect(transicoesPedidoCompraMigration).toContain("só pode ser alterado por transição transacional");
  });

  it("centraliza status dos orçamentos em RPCs auditadas", () => {
    expect(transicoesOrcamentosMigration).toContain("create or replace function public.transicionar_orcamento(");
    expect(transicoesOrcamentosMigration).toContain("create or replace function public.transicionar_orcamento_projeto(");
    expect(transicoesOrcamentosMigration).toContain("perform fn_exige_papel('coordenador');");
    expect(transicoesOrcamentosMigration).toContain("insert into eventos_status");
    expect(transicoesOrcamentosMigration).toContain("create trigger trg_bloquear_status_direto_orcamento");
    expect(transicoesOrcamentosMigration).toContain("create trigger trg_bloquear_status_direto_orcamento_projeto");
  });

  it("bloqueia alteração direta do ciclo operacional do planejamento", () => {
    expect(blindagemPlanejamentoMigration).toContain("create trigger trg_bloquear_status_operacional_direto_planejamento");
    expect(blindagemPlanejamentoMigration).toContain("só pode ser alterado por RPC transacional");
    expect(blindagemPlanejamentoMigration).toContain("revoke execute on function public.reservar_plano(bigint, jsonb) from public, anon;");
    expect(blindagemPlanejamentoMigration).toContain("grant execute on function public.concluir_planejamento(bigint) to authenticated, service_role;");
  });

  it("rastreia recebimentos parciais de compra formal sem escrita direta", () => {
    expect(recebimentoParcialCompraMigration).toContain("create table if not exists public.pedidos_compra_item_recebimentos");
    expect(recebimentoParcialCompraMigration).toContain("revoke insert, update, delete on table public.pedidos_compra_item_recebimentos from authenticated;");
    expect(recebimentoParcialCompraMigration).toContain("Quantidade recebida excede o saldo pendente do item.");
    expect(recebimentoParcialCompraMigration).toContain("Recebimento parcial");
    expect(recebimentoParcialCompraMigration).toContain("pedidos_internos_item_recebimentos(");
  });

  it("armazena anexos de pedido em bucket privado com escrita técnica", () => {
    expect(documentosPedidosMigration).toContain("'pedidos-internos-anexos'");
    expect(documentosPedidosMigration).toContain("create policy pedidos_internos_anexos_read on storage.objects");
    expect(documentosPedidosMigration).toContain("create policy pedidos_internos_anexos_insert on storage.objects");
    expect(documentosPedidosMigration).toContain("public.papel_minimo('tecnico')");
  });

  it("expõe custo padrão, médio e real por lote de forma auditável", () => {
    expect(custosEstoqueMigration).toContain("create or replace view public.v_custo_estoque_vigente");
    expect(custosEstoqueMigration).toContain("custo_medio_ponderado");
    expect(custosEstoqueMigration).toContain("create or replace view public.v_custo_real_consumo");
    expect(custosEstoqueMigration).toContain("m.custo_unitario as custo_real_unitario");
  });

  it("impede GUC forjada sem depender de owner fixo", () => {
    const guardas = [
      "bloquear_status_direto_pedido_interno",
      "bloquear_status_direto_pedido_compra",
      "bloquear_status_operacional_direto_planejamento",
      "bloquear_status_direto_orcamento",
      "bloquear_status_direto_orcamento_projeto",
      "proteger_recalculo_orcamento",
      "proteger_orcamento_final_emitido",
    ];

    for (const guarda of guardas) {
      expect(blindagemMarcadoresMigration).toContain(
        `create or replace function public.${guarda}()`,
      );
    }
    expect(blindagemMarcadoresMigration).toContain(
      "create or replace function public.fn_marcador_transacional_autorizado(",
    );
    expect(blindagemMarcadoresMigration).toContain(
      "owner_role.rolname = current_user",
    );
    expect(blindagemMarcadoresMigration).toContain(
      "owner_role.rolname not in ('anon', 'authenticated', 'service_role')",
    );
    expect(
      blindagemMarcadoresMigration.match(/fn_marcador_transacional_autorizado\(/g)?.length,
    ).toBeGreaterThanOrEqual(8);
    expect(blindagemMarcadoresMigration).not.toMatch(
      /current_user\s*(?:=|<>)\s*'postgres'/,
    );
    expect(blindagemMarcadoresMigration).not.toContain("owner to postgres");
  });
});
