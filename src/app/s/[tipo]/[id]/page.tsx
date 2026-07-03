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
import { TriagemCodigoDesconhecidoForm } from "@/components/scanner/TriagemCodigoDesconhecidoForm";

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
    <main className="mx-auto max-w-lg px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-xl font-semibold text-foreground">
        Codigo nao encontrado
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        O Kontrol registrou a leitura, mas nao encontrou uma entidade ativa para este codigo.
      </p>
      <p className="mt-4 rounded-md bg-muted px-3 py-2 font-mono text-xs text-foreground">
        {codigo}
      </p>
      <TriagemCodigoDesconhecidoForm codigo={codigo} />
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
