/**
 * Grupos de amostras da demanda.
 *
 * O formulário de demanda sempre teve um editor de grupos (identificação,
 * tipo/matriz e quantidade por grupo), mas nenhuma server action lia esses
 * campos: só o derivado — soma das quantidades e concatenação das matrizes —
 * era gravado. A estrutura de grupos se perdia a cada salvamento.
 *
 * Este módulo é a leitura pura do `FormData`. A gravação é atômica, pela RPC
 * `sincronizar_demanda_grupos` (migration 0104): demanda e grupos entram na
 * mesma transação, sem gravação parcial.
 */

export type GrupoAmostraEntrada = {
  /** chave estável do formulário, usada para religar análises ao grupo */
  chave: string;
  /** id existente no banco; ausente em grupo novo */
  id: number | null;
  identificacao: string;
  tipo_matriz: string | null;
  quantidade_amostras: number;
  unidade: string;
  observacao: string | null;
};

export class GruposAmostrasInvalidosError extends Error {
  readonly code = "GRUPOS_AMOSTRAS_INVALIDOS";
  constructor(message: string) {
    super(message);
    this.name = "GruposAmostrasInvalidosError";
  }
}

function limpar(valor: FormDataEntryValue | undefined): string {
  return String(valor ?? "").trim();
}

function textoOuNull(valor: FormDataEntryValue | undefined): string | null {
  const v = limpar(valor);
  return v.length > 0 ? v : null;
}

/**
 * Lê os grupos do formulário preservando a ordem de submissão.
 *
 * Lança `GruposAmostrasInvalidosError` quando os campos repetidos estão
 * desalinhados ou quando um grupo é inválido — nunca descarta grupo em
 * silêncio, que é exatamente o defeito que este módulo corrige.
 */
export function lerGruposAmostras(formData: FormData): GrupoAmostraEntrada[] | null {
  const chaves = formData.getAll("grupo_key");
  const ids = formData.getAll("grupo_id");
  const identificacoes = formData.getAll("grupo_identificacao");
  const matrizes = formData.getAll("grupo_tipo_matriz");
  const quantidades = formData.getAll("grupo_quantidade");
  const unidades = formData.getAll("grupo_unidade");
  const observacoes = formData.getAll("grupo_observacao");

  // `null` = o formulário não traz o editor de grupos, então os grupos
  // gravados devem ser preservados. Só `[]` significa "remover todos".
  // A tela de detalhe da demanda salva sem esses campos; tratá-la como
  // lista vazia apagava os grupos criados na tela de criação.
  if (chaves.length === 0) return null;

  // Todo campo repetido é pareado por índice com `grupo_key`. Se algum vier
  // com tamanho diferente — por exemplo um input duplicado no formulário —
  // o pareamento silenciosamente atribuiria o valor de um grupo a outro.
  // Recusar é a única opção segura.
  const campos: Array<[string, FormDataEntryValue[]]> = [
    ["grupo_identificacao", identificacoes],
    ["grupo_tipo_matriz", matrizes],
    ["grupo_quantidade", quantidades],
    ["grupo_id", ids],
    ["grupo_unidade", unidades],
    ["grupo_observacao", observacoes],
  ];
  const desalinhados = campos
    .filter(([, valores]) => valores.length > 0 && valores.length !== chaves.length)
    .map(([nome, valores]) => `${nome}=${valores.length}`);
  if (desalinhados.length > 0) {
    throw new GruposAmostrasInvalidosError(
      `Campos de grupo desalinhados: ${chaves.length} grupo(s) enviados, mas ${desalinhados.join(", ")}. Nada foi salvo.`,
    );
  }

  const vistas = new Set<string>();

  return chaves.map((chaveBruta, i) => {
    const chave = limpar(chaveBruta);
    const identificacao = limpar(identificacoes[i]);
    const quantidade = Number(limpar(quantidades[i]));

    if (identificacao.length === 0) {
      throw new GruposAmostrasInvalidosError(
        `O grupo na posição ${i + 1} está sem identificação.`,
      );
    }
    if (!Number.isFinite(quantidade) || !Number.isInteger(quantidade) || quantidade <= 0) {
      throw new GruposAmostrasInvalidosError(
        `O grupo “${identificacao}” precisa de uma quantidade de amostras inteira e maior que zero.`,
      );
    }
    if (vistas.has(identificacao.toLocaleLowerCase("pt-BR"))) {
      throw new GruposAmostrasInvalidosError(
        `Há mais de um grupo chamado “${identificacao}”. Use identificações distintas.`,
      );
    }
    vistas.add(identificacao.toLocaleLowerCase("pt-BR"));

    const idBruto = limpar(ids[i]);
    const id = idBruto.length > 0 && Number.isFinite(Number(idBruto)) ? Number(idBruto) : null;

    return {
      chave: chave.length > 0 ? chave : `grupo-${i + 1}`,
      id,
      identificacao,
      tipo_matriz: textoOuNull(matrizes[i]),
      quantidade_amostras: quantidade,
      unidade: textoOuNull(unidades[i]) ?? "amostras",
      observacao: textoOuNull(observacoes[i]),
    };
  });
}

/** Total de amostras — o valor que hoje é gravado em `quantidade_amostras_estimada`. */
export function totalAmostras(grupos: GrupoAmostraEntrada[] | null): number {
  return (grupos ?? []).reduce((total, g) => total + g.quantidade_amostras, 0);
}

/**
 * Matrizes distintas, na ordem dos grupos, para o campo texto legado
 * `demandas_propostas.matriz_amostra`. Mantido enquanto o cadastro
 * canônico `matrizes_amostras` (0060) não substitui o campo livre.
 */
export function matrizesConcatenadas(grupos: GrupoAmostraEntrada[] | null): string {
  const vistas = new Set<string>();
  const ordenadas: string[] = [];
  for (const g of grupos ?? []) {
    if (!g.tipo_matriz) continue;
    const chave = g.tipo_matriz.toLocaleLowerCase("pt-BR");
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    ordenadas.push(g.tipo_matriz);
  }
  return ordenadas.join("; ");
}

export type AnaliseSelecionadaEntrada = {
  codigo_analise: string;
  quantidade_amostras: number;
  origem_quantidade: string;
  status_custeio: string;
  /** chave do grupo a que a análise pertence; null quando não informada */
  grupo_chave: string | null;
};

/**
 * Lê as análises selecionadas e a que grupo cada uma pertence.
 *
 * Devolve `null` quando o formulário não traz o bloco de análises — sinal
 * para a RPC preservar `demanda_analises` como está, em vez de apagar.
 * Nenhuma associação histórica é inferida.
 */
export function lerAnalisesSelecionadas(
  formData: FormData,
): AnaliseSelecionadaEntrada[] | null {
  const codigos = formData.getAll("analise_codigo");
  if (codigos.length === 0) return null;

  const grupos = formData.getAll("analise_grupo_key");
  const quantidades = formData.getAll("analise_quantidade");
  const origens = formData.getAll("analise_origem_quantidade");
  const status = formData.getAll("analise_status_custeio");

  if (quantidades.length !== codigos.length) {
    throw new GruposAmostrasInvalidosError(
      `Campos de análise desalinhados: ${codigos.length} análise(s) e ${quantidades.length} quantidade(s). Nada foi salvo.`,
    );
  }

  return codigos.map((codigoBruto, i) => {
    const codigo_analise = limpar(codigoBruto);
    if (codigo_analise.length === 0) {
      throw new GruposAmostrasInvalidosError(
        `A análise na posição ${i + 1} está sem código.`,
      );
    }
    const quantidade = Number(limpar(quantidades[i]));
    if (!Number.isFinite(quantidade) || !Number.isInteger(quantidade) || quantidade <= 0) {
      throw new GruposAmostrasInvalidosError(
        `A análise “${codigo_analise}” precisa de uma quantidade inteira maior que zero.`,
      );
    }
    return {
      codigo_analise,
      quantidade_amostras: quantidade,
      origem_quantidade: textoOuNull(origens[i]) ?? "manual",
      status_custeio: textoOuNull(status[i]) ?? "pendente",
      grupo_chave: textoOuNull(grupos[i]),
    };
  });
}

/** Payload da RPC `sincronizar_demanda_grupos`. */
export function payloadSincronizacao(grupos: GrupoAmostraEntrada[] | null) {
  if (grupos === null) return null;
  return grupos.map((g) => ({
    chave: g.chave,
    id: g.id,
    identificacao: g.identificacao,
    tipo_matriz: g.tipo_matriz,
    quantidade_amostras: g.quantidade_amostras,
    unidade: g.unidade,
    observacao: g.observacao,
  }));
}
