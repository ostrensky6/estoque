import { ModuleTopNav } from "@/components/layout/ModuleTopNav";

export default function OrcamentoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ModuleTopNav moduleId="orcamentos" />
      {children}
    </>
  );
}
