import { PAPEIS, normalizePermissions, type PapelUsuario, type PermissaoUsuario } from "@/lib/auth/permissions";

export type PermissoesPorCategoria = Record<PapelUsuario, Record<PermissaoUsuario, boolean>>;

export function buildPermissoesPorCategoria(rows: Array<{ papel: string; permissoes: unknown }>): PermissoesPorCategoria {
  return Object.fromEntries(
    PAPEIS.map((papel) => {
      const row = rows.find((item) => item.papel === papel.value);
      return [papel.value, normalizePermissions(papel.value, row?.permissoes)];
    }),
  ) as PermissoesPorCategoria;
}
