import { ModuleTopNav } from "@/components/layout/ModuleTopNav";

export default function ComprasLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ModuleTopNav moduleId="suprimentos" />
      {children}
    </>
  );
}
