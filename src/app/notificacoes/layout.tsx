import { ModuleTopNav } from "@/components/layout/ModuleTopNav";

export default function NotificacoesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ModuleTopNav moduleId="suprimentos" />
      {children}
    </>
  );
}
