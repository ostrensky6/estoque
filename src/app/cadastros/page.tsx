import { CADASTROS } from "@/lib/cadastros/config";
import { CadastrosCards } from "@/components/cadastros/CadastrosCards";

export default function CadastrosIndex() {
  return (
    <div className="min-h-dvh bg-transparent font-sans text-foreground">
      <main className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">
          Cadastros — elementos de custo
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Registre os insumos, equipamentos, pessoal e overhead que alimentam o
          custeio das análises.
        </p>

        <CadastrosCards cadastros={Object.values(CADASTROS)} />
      </main>
    </div>
  );
}
