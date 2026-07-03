import { ModuleTopNav } from "@/components/layout/ModuleTopNav";

export default function AuditoriaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ModuleTopNav moduleId="governanca" hideWhenSingle />
      {children}
    </>
  );
}
