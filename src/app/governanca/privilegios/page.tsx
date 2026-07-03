import { PrivilegiosMatriz } from "@/components/governanca/PrivilegiosMatriz";
import { obterMatrizPrivilegios } from "@/lib/actions/privilegios";

export const dynamic = "force-dynamic";

export default async function PrivilegiosPage() {
  const permissoesPorCategoria = await obterMatrizPrivilegios();

  if (!permissoesPorCategoria) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-6 text-center font-sans sm:px-6 sm:py-8">
        <p className="text-muted-foreground">Acesso restrito — apenas administradores gerenciam privilégios.</p>
      </main>
    );
  }

  return (
    <div className="min-h-dvh bg-transparent font-sans text-foreground">
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <h1 className="text-xl font-semibold tracking-tight">Privilégios</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Matriz granular de Governança restaurada a partir do histórico e reconciliada com os papéis atuais do Kontrol.
        </p>

        <div className="mt-6">
          <PrivilegiosMatriz permissoesPorCategoria={permissoesPorCategoria} />
        </div>
      </main>
    </div>
  );
}
