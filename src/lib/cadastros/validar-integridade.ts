/**
 * Validação central de integridade dos cadastros que alimentam o custeio.
 *
 * Funções PURAS (sem acesso a banco) — recebem os dados já carregados e
 * classificam cada análise como PRONTA, COM_ALERTAS ou BLOQUEADA, apontando a
 * causa específica de cada problema, o cadastro de origem, a gravidade e a ação
 * recomendada. O carregamento dos dados fica em `integridade-loader.ts`.
 *
 * Princípio reitor (do plano): o sistema NÃO pode transformar inconsistência
 * cadastral em custo zero silencioso. Toda condição que possa gerar custo
 * técnico incorreto BLOQUEIA a análise; o que apenas degrada a qualidade do
 * cálculo gera ALERTA.
 */

import {
  chaveComparacao,
  normalizarModoCobranca,
  type ModoCobranca,
} from "./normalizar";

// =====================================================================
// Tipos de entrada (espelho enxuto das tabelas, já carregado)
// =====================================================================

export type AnaliseInput = {
  codigo: string;
  nome: string | null;
  ativo: boolean;
  status?: string | null;
};

export type EtapaInput = {
  id: number;
  nome_etapa: string;
  nome_atividade: string;
  execucoes_por_dia: number | null;
  amostras_por_execucao: number | null;
  tempo_maquina_h: number | null;
  tempo_bancada_h: number | null;
  /** quando true, a etapa não bloqueia por falta de produtividade */
  atividade_opcional?: boolean;
  /** recurso gargalo declarado (Pessoal, Sequenciador…); informa se precisa de máquina */
  tipo_limitacao?: string | null;
};

export type InsumoAnaliseInput = {
  id: number;
  nome_etapa: string | null;
  nome_atividade: string | null;
  especificacao_insumo: string | null;
  grupo_escolha: string | null;
  quantidade_por_amostra: number | null;
  modo_cobranca: string | null;
  /** FK para insumos.id; null = sem cadastro vinculado */
  insumo_id: number | null;
  /** custo unitário do insumo vinculado; null = não cadastrado */
  custo_unitario: number | null;
  /** marca registro como inativo (campo futuro; default true se ausente) */
  ativo?: boolean;
};

export type EquipamentoAnaliseInput = {
  id: number;
  equipamento_id: number;
  peso_alocacao: number | null;
  equipamento: {
    nome: string;
    possui: boolean;
    quantidade: number | null;
    custo_unitario: number | null;
    vida_util_anos: number | null;
  } | null;
};

export type ContextoCusteio = {
  /** soma de valor-hora dos técnicos aplicáveis (> 0 indica pessoal cadastrado) */
  valorHoraPessoal: number;
  /** soma de custo-hora do overhead aplicável */
  custoHoraOverhead: number;
  /** parâmetros técnicos essenciais presentes */
  parametrosPresentes: boolean;
};

export type AnaliseParaValidar = {
  analise: AnaliseInput;
  etapas: EtapaInput[];
  insumos: InsumoAnaliseInput[];
  equipamentos: EquipamentoAnaliseInput[];
};

// =====================================================================
// Tipos de saída
// =====================================================================

export type Gravidade = "bloqueio" | "alerta" | "info";

export type CadastroOrigem =
  | "analise"
  | "etapa"
  | "insumo"
  | "equipamento"
  | "pessoal"
  | "overhead"
  | "parametro";

export type Problema = {
  /** identificador estável do tipo de problema (para testes e agregação) */
  codigo: string;
  gravidade: Gravidade;
  cadastro: CadastroOrigem;
  mensagem: string;
  /** referência específica da origem (nome da etapa, especificação do insumo…) */
  origem?: string;
  acaoRecomendada: string;
  /** link para edição do cadastro correspondente */
  link?: string;
};

export type StatusIntegridade = "PRONTA" | "COM_ALERTAS" | "BLOQUEADA";

export type AnaliseIntegridade = {
  codigo: string;
  nome: string | null;
  ativo: boolean;
  status: StatusIntegridade;
  problemas: Problema[];
  /** true quando há ao menos um insumo obrigatório íntegro e custo calculável */
  custoCalculavel: boolean;
};

export type ResumoIntegridade = {
  total: number;
  prontas: number;
  comAlertas: number;
  bloqueadas: number;
  analises: AnaliseIntegridade[];
};

// =====================================================================
// Helpers
// =====================================================================

const ehNumeroPositivo = (v: number | null | undefined): v is number =>
  typeof v === "number" && Number.isFinite(v) && v > 0;

const ehNumeroNaoNegativo = (v: number | null | undefined): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;

const LINK_INSUMOS = "/cadastros/insumos";
const LINK_EQUIP = "/cadastros/equipamentos";

function linkAnalise(codigo: string): string {
  return `/analises/${encodeURIComponent(codigo)}`;
}

/**
 * Detecta se a etapa exige tempo de máquina (e portanto não pode ficar sem ele
 * silenciosamente). Heurística conservadora: só exige quando o gargalo declarado
 * é um equipamento conhecido. Sem essa informação, NÃO bloqueia (gera alerta).
 */
function etapaUsaMaquina(e: EtapaInput): boolean {
  const lim = chaveComparacao(e.tipo_limitacao);
  if (!lim) return false;
  // "pessoal"/"bancada" não usam máquina; qualquer outro recurso (sequenciador,
  // termobloco, qubit, centrifuga…) implica tempo de máquina.
  return !/pessoal|bancada|manual/.test(lim);
}

// =====================================================================
// Validação por análise
// =====================================================================

export function validarAnalise(dados: AnaliseParaValidar, ctx: ContextoCusteio): AnaliseIntegridade {
  const { analise, etapas, insumos, equipamentos } = dados;
  const problemas: Problema[] = [];
  const add = (p: Problema) => problemas.push(p);
  const link = linkAnalise(analise.codigo);

  // ---- Análise ------------------------------------------------------
  if (!analise.nome || !chaveComparacao(analise.nome)) {
    add({
      codigo: "analise.sem_nome",
      gravidade: "alerta",
      cadastro: "analise",
      mensagem: "Análise sem nome descritivo.",
      acaoRecomendada: "Preencher o nome da análise no catálogo.",
      link,
    });
  }

  // ---- Etapas -------------------------------------------------------
  if (etapas.length === 0) {
    add({
      codigo: "etapa.ausente",
      gravidade: "bloqueio",
      cadastro: "etapa",
      mensagem: "Nenhuma etapa cadastrada — não há base para produtividade nem rateio.",
      acaoRecomendada: "Cadastrar as etapas/atividades da análise.",
      link,
    });
  }

  // etapas duplicadas (mesma etapa+atividade): a planilha permite repetição
  // legítima (ex.: duas eletroforeses), então isto é ALERTA, não bloqueio.
  const vistas = new Map<string, number>();
  for (const e of etapas) {
    const k = `${chaveComparacao(e.nome_etapa)}|${chaveComparacao(e.nome_atividade)}`;
    vistas.set(k, (vistas.get(k) ?? 0) + 1);
  }
  for (const [, count] of vistas) {
    if (count > 1) {
      add({
        codigo: "etapa.duplicada",
        gravidade: "alerta",
        cadastro: "etapa",
        mensagem:
          "Há etapas com mesmo nome/atividade. Pode ser legítimo (repetição real), mas vincule insumos por etapa_id para evitar ambiguidade.",
        acaoRecomendada: "Conferir se a duplicidade é intencional e usar etapa_id nos insumos.",
        link,
      });
      break;
    }
  }

  // produtividade necessária ao rateio (gargalo): pelo menos uma etapa não
  // opcional com execuções/dia e amostras/execução positivas.
  const etapasRateaveis = etapas.filter((e) => !e.atividade_opcional);
  const temProdutividade = etapasRateaveis.some(
    (e) => ehNumeroPositivo(e.execucoes_por_dia) && ehNumeroPositivo(e.amostras_por_execucao),
  );
  if (etapas.length > 0 && !temProdutividade) {
    add({
      codigo: "etapa.sem_produtividade",
      gravidade: "bloqueio",
      cadastro: "etapa",
      mensagem:
        "Nenhuma etapa tem produtividade (execuções/dia e amostras/execução) — impede o rateio de equipamento e o cálculo do gargalo.",
      acaoRecomendada: "Informar execuções por dia e amostras por execução nas etapas principais.",
      link,
    });
  }

  // tempo de bancada: sem ele, o componente de pessoal/overhead vira zero
  // silencioso. Alerta (não bloqueia o custo de reagentes/equipamento).
  const temBancada = etapas.some((e) => ehNumeroPositivo(e.tempo_bancada_h));
  if (etapas.length > 0 && !temBancada) {
    add({
      codigo: "etapa.sem_tempo_bancada",
      gravidade: "alerta",
      cadastro: "etapa",
      mensagem:
        "Nenhuma etapa tem tempo de bancada — o custo de pessoal e overhead será zero.",
      acaoRecomendada: "Informar o tempo de bancada das etapas que consomem mão de obra.",
      link,
    });
  }

  // tempo de máquina quando a etapa depende de equipamento
  for (const e of etapas) {
    if (etapaUsaMaquina(e) && !ehNumeroNaoNegativo(e.tempo_maquina_h)) {
      add({
        codigo: "etapa.sem_tempo_maquina",
        gravidade: "alerta",
        cadastro: "etapa",
        mensagem: `Etapa depende de equipamento (${e.tipo_limitacao}) mas não tem tempo de máquina.`,
        origem: `${e.nome_etapa} / ${e.nome_atividade}`,
        acaoRecomendada: "Informar o tempo de máquina por execução.",
        link,
      });
    }
  }

  // ---- Insumos ------------------------------------------------------
  const insumosAtivos = insumos.filter((i) => i.ativo !== false);

  if (insumosAtivos.length === 0) {
    add({
      codigo: "insumo.ausente",
      gravidade: "alerta",
      cadastro: "insumo",
      mensagem: "Nenhum insumo vinculado à análise.",
      acaoRecomendada: "Vincular os reagentes/consumíveis consumidos pela análise.",
      link,
    });
  }

  for (const i of insumosAtivos) {
    const rotulo = i.especificacao_insumo ?? `insumo #${i.id}`;
    const linkIns = i.insumo_id ? `${LINK_INSUMOS}` : link;

    // quantidade
    const qtdInvalida = i.quantidade_por_amostra == null || !Number.isFinite(i.quantidade_por_amostra);
    const qtdZero = i.quantidade_por_amostra === 0;

    // vínculo / custo
    if (i.insumo_id == null) {
      add({
        codigo: "insumo.sem_vinculo",
        gravidade: "bloqueio",
        cadastro: "insumo",
        mensagem: `Insumo "${rotulo}" não está vinculado a um cadastro de insumo — custo indeterminado.`,
        origem: rotulo,
        acaoRecomendada: "Vincular a um insumo do catálogo ou marcar a linha como inativa.",
        link: LINK_INSUMOS,
      });
    } else if (!ehNumeroNaoNegativo(i.custo_unitario)) {
      add({
        codigo: "insumo.sem_custo",
        gravidade: "bloqueio",
        cadastro: "insumo",
        mensagem: `Insumo "${rotulo}" sem custo unitário cadastrado — não pode virar custo zero.`,
        origem: rotulo,
        acaoRecomendada: "Informar valor e quantidade da embalagem do insumo.",
        link: linkIns,
      });
    }

    // modo de cobrança obrigatório (null não é por_amostra)
    const modo: ModoCobranca | null = normalizarModoCobranca(i.modo_cobranca);
    if (modo == null) {
      add({
        codigo: "insumo.sem_modo_cobranca",
        gravidade: "bloqueio",
        cadastro: "insumo",
        mensagem: `Insumo "${rotulo}" sem modo de cobrança definido (por_amostra / por_execucao).`,
        origem: rotulo,
        acaoRecomendada: "Definir explicitamente o modo de cobrança da linha.",
        link,
      });
    }

    if (qtdInvalida) {
      add({
        codigo: "insumo.sem_quantidade",
        gravidade: "bloqueio",
        cadastro: "insumo",
        mensagem: `Insumo "${rotulo}" sem quantidade por amostra.`,
        origem: rotulo,
        acaoRecomendada: "Informar a quantidade consumida por amostra.",
        link,
      });
    } else if (qtdZero) {
      add({
        codigo: "insumo.quantidade_zero",
        gravidade: "alerta",
        cadastro: "insumo",
        mensagem: `Insumo "${rotulo}" com quantidade zero — não usar zero para representar item inativo.`,
        origem: rotulo,
        acaoRecomendada: "Definir a quantidade real ou marcar a linha como inativa (campo próprio).",
        link,
      });
    }
  }

  // grupos de escolha: detectar variações textuais que viram grupos distintos
  const gruposBrutos = insumosAtivos
    .map((i) => i.grupo_escolha)
    .filter((g): g is string => !!g && g.trim() !== "");
  const porChave = new Map<string, Set<string>>();
  for (const g of gruposBrutos) {
    const k = chaveComparacao(g);
    if (!porChave.has(k)) porChave.set(k, new Set());
    porChave.get(k)!.add(g);
  }
  for (const [, variacoes] of porChave) {
    if (variacoes.size > 1) {
      add({
        codigo: "grupo.variacao_textual",
        gravidade: "alerta",
        cadastro: "insumo",
        mensagem: `Grupo de escolha duplicado por caixa/espaço/acento: ${[...variacoes]
          .map((v) => `"${v}"`)
          .join(", ")}.`,
        acaoRecomendada: "Padronizar o nome do grupo (ou migrar para grupo_escolha por entidade).",
        link,
      });
    }
  }

  // grupo com uma única opção: escolha trivial, mas pode indicar opção faltante
  const opcoesPorGrupo = new Map<string, number>();
  for (const i of insumosAtivos) {
    if (!i.grupo_escolha) continue;
    const k = chaveComparacao(i.grupo_escolha);
    opcoesPorGrupo.set(k, (opcoesPorGrupo.get(k) ?? 0) + 1);
  }
  for (const [, n] of opcoesPorGrupo) {
    if (n < 1) {
      add({
        codigo: "grupo.sem_opcao",
        gravidade: "alerta",
        cadastro: "insumo",
        mensagem: "Grupo de escolha sem nenhuma alternativa válida.",
        acaoRecomendada: "Cadastrar ao menos uma alternativa para o grupo.",
        link,
      });
    }
  }

  // ---- Equipamentos -------------------------------------------------
  for (const ea of equipamentos) {
    const eq = ea.equipamento;
    const rotulo = eq?.nome ?? `equipamento #${ea.equipamento_id}`;
    if (!eq) {
      add({
        codigo: "equip.invalido",
        gravidade: "bloqueio",
        cadastro: "equipamento",
        mensagem: `Vínculo aponta para equipamento inexistente (#${ea.equipamento_id}).`,
        origem: rotulo,
        acaoRecomendada: "Corrigir o vínculo equipamento↔análise.",
        link: LINK_EQUIP,
      });
      continue;
    }

    if (!ehNumeroNaoNegativo(ea.peso_alocacao)) {
      add({
        codigo: "equip.peso_invalido",
        gravidade: "bloqueio",
        cadastro: "equipamento",
        mensagem: `Peso de alocação inválido para "${rotulo}".`,
        origem: rotulo,
        acaoRecomendada: "Informar um peso de alocação >= 0.",
        link: LINK_EQUIP,
      });
    }

    if (!ehNumeroPositivo(eq.vida_util_anos)) {
      add({
        codigo: "equip.sem_vida_util",
        gravidade: "alerta",
        cadastro: "equipamento",
        mensagem: `Equipamento "${rotulo}" sem vida útil — depreciação será zero.`,
        origem: rotulo,
        acaoRecomendada: "Informar a vida útil (anos) para a depreciação linear.",
        link: LINK_EQUIP,
      });
    }

    if (!ehNumeroPositivo(eq.custo_unitario)) {
      add({
        codigo: "equip.sem_custo",
        gravidade: "alerta",
        cadastro: "equipamento",
        mensagem: `Equipamento "${rotulo}" sem custo — não contribui para o custo/dia.`,
        origem: rotulo,
        acaoRecomendada: "Informar o custo unitário do equipamento.",
        link: LINK_EQUIP,
      });
    }

    if (!eq.possui) {
      add({
        codigo: "equip.nao_possuido",
        gravidade: "alerta",
        cadastro: "equipamento",
        mensagem: `Equipamento "${rotulo}" marcado como não possuído — defina como será custeado (locação/terceirização/bloqueio).`,
        origem: rotulo,
        acaoRecomendada: "Definir o modo de disponibilidade do equipamento.",
        link: LINK_EQUIP,
      });
    }
  }

  // ---- Pessoal / overhead / parâmetros ------------------------------
  if (temBancada && !ehNumeroPositivo(ctx.valorHoraPessoal)) {
    add({
      codigo: "pessoal.ausente",
      gravidade: "alerta",
      cadastro: "pessoal",
      mensagem: "Há tempo de bancada mas nenhum técnico aplicável — custo de pessoal será zero.",
      acaoRecomendada: "Cadastrar técnicos e sua dedicação (e, futuramente, vincular por processo).",
      link: "/cadastros/tecnicos",
    });
  }

  if (temBancada && !ehNumeroPositivo(ctx.custoHoraOverhead)) {
    add({
      codigo: "overhead.ausente",
      gravidade: "alerta",
      cadastro: "overhead",
      mensagem: "Há tempo de bancada mas nenhum overhead aplicável — overhead será zero.",
      acaoRecomendada: "Cadastrar os itens de overhead e seu rateio.",
      link: "/cadastros/overhead",
    });
  }

  if (!ctx.parametrosPresentes) {
    add({
      codigo: "parametro.ausente",
      gravidade: "bloqueio",
      cadastro: "parametro",
      mensagem: "Parâmetros técnicos essenciais ausentes (ex.: dias úteis/ano).",
      acaoRecomendada: "Cadastrar os parâmetros técnicos em Parâmetros.",
      link: "/parametros",
    });
  }

  // ---- Classificação final -----------------------------------------
  const temBloqueio = problemas.some((p) => p.gravidade === "bloqueio");
  const temAlerta = problemas.some((p) => p.gravidade === "alerta");

  // custo calculável: existe insumo íntegro OU equipamento íntegro, e há
  // produtividade, e não há bloqueio impeditivo.
  const insumoIntegro = insumosAtivos.some(
    (i) =>
      i.insumo_id != null &&
      ehNumeroNaoNegativo(i.custo_unitario) &&
      normalizarModoCobranca(i.modo_cobranca) != null &&
      ehNumeroPositivo(i.quantidade_por_amostra ?? 0),
  );
  const custoCalculavel = !temBloqueio && temProdutividade && (insumoIntegro || equipamentos.length === 0);

  const status: StatusIntegridade = temBloqueio
    ? "BLOQUEADA"
    : temAlerta
      ? "COM_ALERTAS"
      : "PRONTA";

  return {
    codigo: analise.codigo,
    nome: analise.nome,
    ativo: analise.ativo,
    status,
    problemas,
    custoCalculavel,
  };
}

/** Valida um conjunto de análises e produz o resumo global. */
export function validarCadastros(
  analises: AnaliseParaValidar[],
  ctx: ContextoCusteio,
): ResumoIntegridade {
  const resultados = analises.map((a) => validarAnalise(a, ctx));
  return {
    total: resultados.length,
    prontas: resultados.filter((r) => r.status === "PRONTA").length,
    comAlertas: resultados.filter((r) => r.status === "COM_ALERTAS").length,
    bloqueadas: resultados.filter((r) => r.status === "BLOQUEADA").length,
    analises: resultados,
  };
}
