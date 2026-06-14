import { Clock, DatabaseBackup, FolderArchive, ShieldCheck } from "lucide-react";
import { obterResumoBackups } from "@/lib/actions/backups";
import { BackupAplicativoButton } from "@/components/governanca/BackupAplicativoButton";

export const dynamic = "force-dynamic";

function formatBytes(bytes: number) {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
  })} ${units[index]}`;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={3} className="px-4 py-8 text-center text-sm text-slate-400">
        {children}
      </td>
    </tr>
  );
}

export default async function BackupsPage() {
  const resumo = await obterResumoBackups();

  if (!resumo) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center font-sans">
        <p className="text-zinc-500">
          Acesso restrito: backups locais são uma operação de administrador.
        </p>
      </main>
    );
  }

  const ultimoApp = resumo.appBackups[0];
  const ultimoDb = resumo.dbBackups[0];

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 font-sans text-slate-900 dark:text-slate-100 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Backups</h1>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
            Cópias locais administradas para aplicativo e banco de dados em nuvem.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Governança
        </span>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start gap-3">
            <FolderArchive className="mt-0.5 h-5 w-5 text-slate-500" aria-hidden="true" />
            <div>
              <h2 className="text-lg font-semibold">Aplicativo local</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
                Backup manual da versão atual em localhost, salvo em {resumo.appDir}.
              </p>
            </div>
          </div>
          <div className="mt-5">
            <BackupAplicativoButton />
          </div>
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
              <dt className="text-xs font-medium uppercase text-slate-500">Retenção</dt>
              <dd className="mt-1 font-semibold">5 últimas versões</dd>
            </div>
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
              <dt className="text-xs font-medium uppercase text-slate-500">Último backup</dt>
              <dd className="mt-1 font-semibold">
                {ultimoApp ? formatDate(ultimoApp.modifiedAt) : "Nenhum"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start gap-3">
            <DatabaseBackup className="mt-0.5 h-5 w-5 text-slate-500" aria-hidden="true" />
            <div>
              <h2 className="text-lg font-semibold">Banco da nuvem</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
                Dump automático da nuvem salvo em {resumo.dbDir}.
              </p>
            </div>
          </div>
          <div className="mt-5 rounded-md border border-slate-100 bg-slate-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950/40">
            <div className="flex items-center gap-2 font-semibold">
              <Clock className="h-4 w-4" aria-hidden="true" />
              Agendamento Windows
            </div>
            <p className="mt-2 text-slate-600 dark:text-zinc-400">
              Execute scripts\install-windows-backup-tasks.ps1 no computador do
              administrador para registrar os backups de 00:30 e 12:30.
            </p>
          </div>
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
              <dt className="text-xs font-medium uppercase text-slate-500">Retenção</dt>
              <dd className="mt-1 font-semibold">30 dias; dias 1 e 15 indefinidos</dd>
            </div>
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
              <dt className="text-xs font-medium uppercase text-slate-500">Último backup</dt>
              <dd className="mt-1 font-semibold">
                {ultimoDb ? formatDate(ultimoDb.modifiedAt) : "Nenhum"}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-slate-100 px-4 py-3 dark:border-zinc-800">
            <h2 className="text-sm font-semibold">Versões do aplicativo</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-zinc-950/40">
              <tr>
                <th className="px-4 py-3 text-left">Arquivo</th>
                <th className="px-4 py-3 text-left">Quando</th>
                <th className="px-4 py-3 text-right">Tamanho</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {resumo.appBackups.length ? (
                resumo.appBackups.map((backup) => (
                  <tr key={backup.path}>
                    <td className="max-w-0 truncate px-4 py-3 font-medium" title={backup.name}>
                      {backup.name}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                      {formatDate(backup.modifiedAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-slate-500">
                      {formatBytes(backup.size)}
                    </td>
                  </tr>
                ))
              ) : (
                <EmptyRow>Nenhuma versão do aplicativo encontrada.</EmptyRow>
              )}
            </tbody>
          </table>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-slate-100 px-4 py-3 dark:border-zinc-800">
            <h2 className="text-sm font-semibold">Dumps do banco</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-zinc-950/40">
              <tr>
                <th className="px-4 py-3 text-left">Arquivo</th>
                <th className="px-4 py-3 text-left">Quando</th>
                <th className="px-4 py-3 text-right">Tamanho</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {resumo.dbBackups.length ? (
                resumo.dbBackups.slice(0, 80).map((backup) => (
                  <tr key={backup.path}>
                    <td className="max-w-0 truncate px-4 py-3 font-medium" title={backup.name}>
                      {backup.name}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                      {formatDate(backup.modifiedAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-slate-500">
                      {formatBytes(backup.size)}
                    </td>
                  </tr>
                ))
              ) : (
                <EmptyRow>Nenhum dump do banco encontrado.</EmptyRow>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
