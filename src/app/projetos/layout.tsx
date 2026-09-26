import { ModuleTopNav } from "@/components/layout/ModuleTopNav";

export default function ProjetosLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ModuleTopNav moduleId="orcamentos" />
      {children}
    </>
  );
}
