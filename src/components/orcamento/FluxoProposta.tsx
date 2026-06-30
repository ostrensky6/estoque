import { modalidadeExigeLaboratorio, modalidadeExigeProjeto } from "@/lib/orcamento/orcamento-economico";

type EtapaFluxo = "demanda" | "laboratorio" | "projeto" | "final" | "historico";

const ETAPAS: Array<{ id: EtapaFluxo; label: string }> = [
  { id: "demanda", label: "Demanda" },
  { id: "laboratorio", label: "Análises laboratoriais" },
  { id: "projeto", label: "Orçamento de projeto" },
  { id: "final", label: "Proposta final" },
  { id: "historico", label: "Histórico/Auditoria" },
];

export function FluxoProposta({
  modalidade,
  atual,
}: {
  modalidade?: string | null;
  atual: EtapaFluxo;
}) {
  const exigeLaboratorio = modalidadeExigeLaboratorio(modalidade);
  const exigeProjeto = modalidadeExigeProjeto(modalidade);
  const atualIndex = ETAPAS.findIndex((etapa) => etapa.id === atual);

  return (
    <nav className="no-print mt-4 rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900" aria-label="Fluxo da proposta">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Fluxo da proposta</p>
      <div className="mt-2 grid gap-2 md:grid-cols-3 xl:grid-cols-5">
        {ETAPAS.map((etapa, index) => {
          const aplicavel =
            (etapa.id !== "laboratorio" || exigeLaboratorio) &&
            (etapa.id !== "projeto" || exigeProjeto);
          const estado = !aplicavel ? "Não aplicável" : etapa.id === atual ? "Atual" : index < atualIndex ? "Concluída" : "Pendente";

          return (
            <div key={etapa.id} className={`rounded-md border px-2 py-2 text-xs ${classeEstado(estado)}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{index + 1}</span>
                <span className="rounded border px-1.5 py-0.5 text-[10px]">{estado}</span>
              </div>
              <p className="mt-1 font-medium">{etapa.label}</p>
            </div>
          );
        })}
      </div>
    </nav>
  );
}

function classeEstado(estado: string) {
  if (estado === "Concluída") return "border-brand-200 bg-brand-50 text-brand-900 dark:border-brand-900 dark:bg-brand-950/30 dark:text-brand-100";
  if (estado === "Atual") return "border-zinc-900 bg-white text-zinc-950 shadow-sm dark:border-zinc-100 dark:bg-zinc-950 dark:text-zinc-50";
  if (estado === "Não aplicável") return "border-zinc-200 bg-zinc-50 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950/40";
  return "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100";
}
