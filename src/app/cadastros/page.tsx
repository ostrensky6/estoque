import { getCadastrosOrdenados } from "@/lib/cadastros/config";
import { CadastrosCards } from "@/components/cadastros/CadastrosCards";
import { CadastrosWorkbookPanel } from "@/components/cadastros/CadastrosWorkbookPanel";

export default function CadastrosIndex() {
  const cadastros = getCadastrosOrdenados();

  return (
    <div className="min-h-dvh bg-transparent font-sans text-foreground">
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <h1 className="text-xl font-semibold tracking-tight">
          Cadastros — dados mestres
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Registre projetos, clientes, insumos, equipamentos e demais bases que
          alimentam operação, suprimentos, comercial e custeio.
        </p>

        <CadastrosWorkbookPanel />
        <CadastrosCards cadastros={cadastros} />
      </main>
    </div>
  );
}
