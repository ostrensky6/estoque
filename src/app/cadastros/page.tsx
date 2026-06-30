import { getCadastrosOrdenados } from "@/lib/cadastros/config";
import { CadastrosCards } from "@/components/cadastros/CadastrosCards";
import { CadastrosSubnav } from "@/components/cadastros/CadastrosSubnav";

export default function CadastrosIndex() {
  const cadastros = getCadastrosOrdenados();

  return (
    <div className="min-h-dvh bg-transparent font-sans text-foreground">
      <main className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">
          Cadastros — dados mestres
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Registre projetos, clientes, insumos, equipamentos e demais bases que
          alimentam operação, suprimentos, comercial e custeio.
        </p>

        <CadastrosSubnav cadastros={cadastros} />
        <CadastrosCards cadastros={cadastros} />
      </main>
    </div>
  );
}
