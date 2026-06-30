import { ModuleTopNav } from "@/components/layout/ModuleTopNav";

export default function AnalisesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ModuleTopNav moduleId="operacao" />
      {children}
    </>
  );
}
