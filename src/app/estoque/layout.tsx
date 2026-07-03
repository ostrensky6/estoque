import { ModuleTopNav } from "@/components/layout/ModuleTopNav";

export default function EstoqueLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ModuleTopNav moduleId="suprimentos" />
      {children}
    </>
  );
}
