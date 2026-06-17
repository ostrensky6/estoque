import { AjudaCentro } from "@/components/ajuda/AjudaCentro";

export const metadata = {
  title: "Ajuda · Kontrol",
  description: "Central de ajuda com orientações de todos os módulos do app.",
};

export default function AjudaPage() {
  return (
    <div className="min-h-dvh bg-transparent font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Central de Ajuda</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
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
