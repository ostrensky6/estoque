import { ModuleTopNav } from "@/components/layout/ModuleTopNav";

export default function CusteioLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ModuleTopNav moduleId="operacao" />
      {children}
    </>
  );
}
