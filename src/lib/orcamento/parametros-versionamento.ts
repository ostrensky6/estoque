import type { Json } from "@/lib/supabase/database.types";

type SupabaseLike = {
  auth: {
    getUser: () => Promise<{ data: { user: { id: string } | null } }>;
  };
  from: (table: "parametros_economicos_versoes") => {
    select: (columns: string) => {
      eq: (column: string, value: unknown) => unknown;
    };
    insert: (payload: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }>;
  };
};

type QueryLike = {
  eq: (column: string, value: unknown) => QueryLike;
  is: (column: string, value: null) => QueryLike;
  order: (column: string, opts?: { ascending?: boolean }) => QueryLike;
  limit: (count: number) => QueryLike;
  maybeSingle: () => Promise<{ data: { versao: number } | null }>;
};

export async function registrarVersaoParametrosEconomicos(
  supabaseClient: unknown,
  args: {
    escopo: "laboratorio_global" | "projeto";
    orcamentoProjetoId?: number | null;
    parametros: Json;
    origem: string;
  },
) {
  const supabase = supabaseClient as SupabaseLike;
  let query = supabase
    .from("parametros_economicos_versoes")
    .select("versao")
    .eq("escopo", args.escopo) as QueryLike;

  query = args.orcamentoProjetoId
    ? query.eq("orcamento_projeto_id", args.orcamentoProjetoId)
    : query.is("orcamento_projeto_id", null);

  const { data: ultima } = await query
    .order("versao", { ascending: false })
    .limit(1)
    .maybeSingle();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("parametros_economicos_versoes").insert({
    escopo: args.escopo,
    orcamento_projeto_id: args.orcamentoProjetoId ?? null,
    versao: Number(ultima?.versao ?? 0) + 1,
    parametros: args.parametros,
    origem: args.origem,
    criado_por: user?.id ?? null,
  });
  if (error) throw new Error(error.message);
}
