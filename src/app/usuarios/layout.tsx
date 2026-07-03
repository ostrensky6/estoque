import { ModuleTopNav } from "@/components/layout/ModuleTopNav";

export default function UsuariosLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ModuleTopNav moduleId="governanca" hideWhenSingle />
      {children}
    </>
  );
}
