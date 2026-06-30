import { ModuleTopNav } from "@/components/layout/ModuleTopNav";

export default function InsumosLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ModuleTopNav moduleId="operacao" />
      {children}
    </>
  );
}
