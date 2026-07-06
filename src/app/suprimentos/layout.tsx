import { ModuleTopNav } from "@/components/layout/ModuleTopNav";

export default function SuprimentosLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ModuleTopNav moduleId="suprimentos" />
      {children}
    </>
  );
}
