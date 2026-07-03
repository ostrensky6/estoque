import { AjudaCentro } from "@/components/ajuda/AjudaCentro";

export const metadata = {
  title: "Ajuda · Kontrol",
  description: "Central de ajuda com orientações de todos os módulos do app.",
};

export default function AjudaPage() {
  return (
    <div className="min-h-dvh bg-transparent font-sans text-foreground">
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Central de Ajuda</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Orientações de uso de todos os módulos do Kontrol. Pesquise pelo assunto ou abra o
            módulo diretamente para colocar em prática.
          </p>
        </div>

        <div className="mt-6">
          <AjudaCentro />
        </div>
      </main>
    </div>
  );
}
