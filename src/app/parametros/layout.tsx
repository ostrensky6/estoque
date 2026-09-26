import { ModuleTopNav } from "@/components/layout/ModuleTopNav";

export default function ParametrosLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ModuleTopNav moduleId="operacao" />
      {children}
    </>
  );
}
