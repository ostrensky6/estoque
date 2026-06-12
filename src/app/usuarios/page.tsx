import { createClient } from "@/lib/supabase/server";
import { temPapel } from "@/lib/auth/roles";
import { atualizarPapel } from "@/lib/actions/usuarios";

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
    .select("id, nome, email, papel, criado_em")
    .order("email");

  return (
    <div className="min-h-dvh bg-transparent font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Usuários e papéis</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Defina o papel de cada usuário. Técnico registra; coordenador aprova
          compras e aceita lotes; gestor bloqueia/descarta lotes; admin gerencia tudo.
        </p>

        <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-transparent text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60">
              <tr>
                <th className="px-4 py-3 text-left">Usuário</th>
                <th className="px-4 py-3 text-left">E-mail</th>
                <th className="px-4 py-3 text-left">Papel</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {(perfis ?? []).map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2.5">{p.nome ?? "—"}</td>
                  <td className="px-4 py-2.5 text-zinc-500">{p.email}</td>
                  <td className="px-4 py-2.5">
                    <form action={atualizarPapel} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={p.id} />
                      <select
                        name="papel"
                        defaultValue={p.papel}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                      >
                        {PAPEIS.map((pp) => (
                          <option key={pp.value} value={pp.value}>{pp.label}</option>
                        ))}
                      </select>
                      <button className="rounded bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900">
                        Salvar
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
