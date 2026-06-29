import { notFound, redirect } from "next/navigation";
import {
  destinoScanner,
  entidadeTipoRotaCurta,
  type EntidadeScanner,
} from "@/lib/scanner/resolver";
import { createClientUntyped } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/roles";
import { normalizarCodigo } from "@/lib/scanner/identificadores";
import { entidadeEscaneavelExiste } from "@/lib/actions/scanner";

export const dynamic = "force-dynamic";

async function registrarEvento(args: {
  codigo: string;
  tipo: EntidadeScanner | null;
  id: number | null;
  resultado: "encontrado" | "nao_encontrado" | "erro";
  contexto?: Record<string, unknown>;
}) {
  try {
    const usuario = await usuarioAtual();
    const supabase = await createClientUntyped();

    await supabase.from("scan_eventos").insert({
      codigo: args.codigo,
      formato: "url_kontrol",
      entidade_tipo: args.tipo,
      entidade_id: args.id,
      acao: "buscar",
      resultado: args.resultado,
      contexto: {
        ...args.contexto,
        origem: "rota_curta",
        codigo_normalizado: normalizarCodigo(args.codigo),
      },
      usuario: usuario?.email ?? usuario?.id ?? null,
    });
  } catch {
    // Registro de auditoria nao deve bloquear a resolucao/redirect principal.
  }
}

function EstadoDesconhecido({ codigo }: { codigo: string }) {
  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
        Codigo nao encontrado
      </h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        O Kontrol registrou a leitura, mas nao encontrou uma entidade ativa para este codigo.
      </p>
      <p className="mt-4 rounded-md bg-slate-100 px-3 py-2 font-mono text-xs text-slate-700 dark:bg-zinc-900 dark:text-zinc-300">
        {codigo}
      </p>
    </main>
  );
}

export default async function ScannerRedirectPage({
  params,
}: {
  params: Promise<{ tipo: string; id: string }>;
}) {
  const { tipo: tipoRaw, id: idRaw } = await params;
  const valorLido = `/s/${tipoRaw}/${idRaw}`;

  const tipo = entidadeTipoRotaCurta(tipoRaw);
  const id = Number(idRaw);
  if (!tipo || !Number.isInteger(id) || id <= 0) {
    await registrarEvento({
      codigo: valorLido,
      tipo,
      id: Number.isInteger(id) && id > 0 ? id : null,
      resultado: "erro",
      contexto: { motivo: "tipo_ou_id_invalido" },
    });
    notFound();
  }

  if (!(await entidadeEscaneavelExiste(tipo, id))) {
    await registrarEvento({
      codigo: valorLido,
      tipo,
      id,
      resultado: "nao_encontrado",
    });
    return <EstadoDesconhecido codigo={valorLido} />;
  }

  await registrarEvento({
    codigo: valorLido,
    tipo,
    id,
    resultado: "encontrado",
  });
  redirect(destinoScanner(tipo, id));
}
