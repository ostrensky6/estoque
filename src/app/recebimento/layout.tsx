import { ModuleTopNav } from "@/components/layout/ModuleTopNav";

export default function RecebimentoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ModuleTopNav moduleId="suprimentos" />
      {children}
    </>
  );
}
