import { getCadastrosOrdenados } from "@/lib/cadastros/config";
import { CadastrosCards } from "@/components/cadastros/CadastrosCards";
import { CadastrosWorkbookPanel } from "@/components/cadastros/CadastrosWorkbookPanel";
import { HelpTip } from "@/components/common/HelpTip";

export default function CadastrosIndex() {
  const cadastros = getCadastrosOrdenados();

  return (
    <div className="min-h-dvh bg-transparent font-sans text-foreground">
      <main className="app-page-container">
        <div className="flex items-center gap-1">
          <h1 className="text-xl font-semibold tracking-tight">
            Cadastros — dados mestres
          </h1>
          <HelpTip title="Dados mestres">
            <p>
              Bases usadas por todo o Kontrol: operação, suprimentos, comercial e custeio. Ao{" "}
              <b>salvar uma alteração</b>, o que depende dela é recalculado.
            </p>
          </HelpTip>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Projetos, clientes, insumos, equipamentos e demais bases do laboratório.
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
