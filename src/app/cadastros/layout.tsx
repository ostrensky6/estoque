import { ModuleTopNav } from "@/components/layout/ModuleTopNav";

export default function CadastrosLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ModuleTopNav moduleId="cadastros" />
      {children}
    </>
  );
}
