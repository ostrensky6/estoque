import { getCadastrosOrdenados } from "@/lib/cadastros/config";
import { CadastrosCards } from "@/components/cadastros/CadastrosCards";
import { CadastrosWorkbookPanel } from "@/components/cadastros/CadastrosWorkbookPanel";

export default function CadastrosIndex() {
  const cadastros = getCadastrosOrdenados();

  return (
    <div className="min-h-dvh bg-transparent font-sans text-foreground">
      <main className="app-page-container">
        <h1 className="text-xl font-semibold tracking-tight">
          Cadastros — dados mestres
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Registre projetos, clientes, insumos, equipamentos e demais bases que
          alimentam operação, suprimentos, comercial e custeio.
        </p>

        <Link href="/cadastros/qualidade" className="mt-4 inline-flex rounded-md border border-input bg-card px-3 py-2 text-sm font-medium hover:bg-muted">
          Revisar qualidade dos cadastros
        </Link>

        <CadastrosWorkbookPanel />
        <CadastrosCards cadastros={cadastros} />
      </main>
    </div>
  );
}
import Link from "next/link";
