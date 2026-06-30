import { ModuleTopNav } from "@/components/layout/ModuleTopNav";

export default function PedidoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ModuleTopNav moduleId="suprimentos" />
      {children}
    </>
  );
}
