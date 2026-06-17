import { createClient } from "@/lib/supabase/server";
import { temPapel } from "@/lib/auth/roles";
import { CriarUsuarioForm } from "@/components/usuarios/CriarUsuarioForm";
import { UsuariosTable, type UsuarioRow } from "@/components/usuarios/UsuariosTable";

export const dynamic = "force-dynamic";

const PAPEIS = [
  { value: "tecnico", label: "Técnico" },
  { value: "coordenador", label: "Coordenador" },
  { value: "gestor", label: "Gestor" },
  { value: "admin", label: "Admin" },
];

export default async function UsuariosPage() {
  if (!(await temPapel("admin"))) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center font-sans">
        <p className="text-zinc-500">Acesso restrito — apenas administradores gerenciam papéis.</p>
      </main>
    );
  }

  const supabase = await createClient();
  const { data: perfis } = await supabase
    .from("perfis")
    .select("id, nome, email, papel, criado_em, suspenso, senha_provisoria")
    .order("email");
  const papelLabel = new Map(PAPEIS.map((papel) => [papel.value, papel.label]));
  const linhas: UsuarioRow[] = (perfis ?? []).map((perfil) => ({
    id: String(perfil.id),
    nome: perfil.nome ?? "—",
    email: perfil.email ?? "—",
    papel: perfil.papel,
    papelLabel: papelLabel.get(perfil.papel) ?? perfil.papel,
    suspenso: Boolean(perfil.suspenso),
    senhaProvisoria: Boolean(perfil.senha_provisoria),
  }));

  return (
    <div className="min-h-dvh bg-transparent font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Usuários e papéis</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Cadastre, edite, suspenda usuários e redefina senhas. Técnico registra; coordenador aprova
          compras e aceita lotes; gestor bloqueia/descarta lotes; admin gerencia tudo.
        </p>

        <CriarUsuarioForm />

        <div className="mt-6">
          <UsuariosTable rows={linhas} />
        </div>
      </main>
    </div>
  );
}
