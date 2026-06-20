import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { temPermissao } from "@/lib/auth/permissoes";
import { CriarUsuarioForm } from "@/components/usuarios/CriarUsuarioForm";
import { UsuariosTable, type UsuarioRow } from "@/components/usuarios/UsuariosTable";

export const dynamic = "force-dynamic";

const PAPEIS = [
  { value: "usuário", label: "Usuário" },
  { value: "coordenador", label: "Coordenador" },
  { value: "administrativo", label: "Administrativo" },
  { value: "gerente", label: "Gerente" },
  { value: "administrador", label: "Administrador" },
];

export default async function UsuariosPage() {
  if (!(await temPermissao("usuarios.gerir"))) {
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Usuários e papéis</h1>
          <Link
            href="/governanca/privilegios"
            className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300"
          >
            Privilégios por papel →
          </Link>
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          Cadastre, edite, suspenda usuários e redefina senhas. As permissões de cada
          papel são definidas na matriz de Privilégios.
        </p>

        <CriarUsuarioForm />

        <div className="mt-6">
          <UsuariosTable rows={linhas} />
        </div>
      </main>
    </div>
  );
}
