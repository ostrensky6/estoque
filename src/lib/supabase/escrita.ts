/**
 * Confirmação de escrita no PostgREST.
 *
 * Capturar `error` não basta. Sob RLS, um UPDATE ou DELETE cujo predicado
 * não alcança nenhuma linha visível retorna `error: null` com zero linhas —
 * indistinguível de sucesso para quem só olha o erro. A única confirmação
 * é a linha devolvida por `.select()`.
 *
 * Funções puras: recebem o resultado já materializado, sem tocar em rede.
 */

export type ErroPostgrest = { message?: string; code?: string } | null | undefined;

export class EscritaSemEfeitoError extends Error {
  readonly code = "ESCRITA_SEM_EFEITO";
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "EscritaSemEfeitoError";
  }
}

/** true quando o retorno do PostgREST não comprova nenhuma linha afetada. */
export function semLinhasAfetadas(data: unknown): boolean {
  if (data === null || data === undefined) return true;
  if (Array.isArray(data)) return data.length === 0;
  return false;
}

/**
 * Lança quando a operação falhou **ou** quando não atingiu linha alguma.
 * Use sempre com `.select(...)` na consulta de origem.
 */
export function garantirEscrita(
  error: ErroPostgrest,
  data: unknown,
  mensagem: string,
): void {
  if (error) throw new Error(error.message || mensagem);
  if (semLinhasAfetadas(data)) {
    throw new EscritaSemEfeitoError(
      `${mensagem} A operação não atingiu nenhum registro — o registro não existe ou seu perfil não tem permissão sobre ele.`,
    );
  }
}

/** Variante que devolve `FormState` em vez de lançar. */
export function conferirEscrita(
  error: ErroPostgrest,
  data: unknown,
  mensagem: string,
): { ok: true } | { ok: false; message: string } {
  try {
    garantirEscrita(error, data, mensagem);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : mensagem };
  }
}
