import { ModuleTopNav } from "@/components/layout/ModuleTopNav";

export default function PlanejamentoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ModuleTopNav moduleId="suprimentos" />
      {children}
    </>
  );
}
