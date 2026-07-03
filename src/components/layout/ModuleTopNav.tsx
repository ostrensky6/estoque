import { createClient } from "@/lib/supabase/server";
import {
  type AppModuleId,
  filtrarChildrenPorPerfil,
  getModuleForProfile,
} from "@/config/modules";
import { ModuleTopNavClient } from "@/components/layout/ModuleTopNavClient";

async function carregarPerfil() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("perfis").select("papel").eq("id", user.id).single();
  return data;
}

export async function ModuleTopNav({
  moduleId,
  hideWhenSingle = false,
}: {
  moduleId: AppModuleId;
  hideWhenSingle?: boolean;
}) {
  const perfil = await carregarPerfil();
  const appModule = getModuleForProfile(moduleId, perfil);
  if (!appModule) return null;

  const topNavChildren = filtrarChildrenPorPerfil(appModule.children, perfil).filter(
    (child) => child.showInTopNav !== false,
  );
  if (topNavChildren.length === 0 || (hideWhenSingle && topNavChildren.length <= 1)) return null;

  return <ModuleTopNavClient appModule={appModule} items={topNavChildren} />;
}
