"use server";

import { execFile } from "node:child_process";
import { access, mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { revalidatePath } from "next/cache";
import { temPermissao } from "@/lib/auth/permissoes";

const execFileAsync = promisify(execFile);

const APP_BACKUP_DIR = "D:\\Dropbox\\Aplicativos\\Kontrol\\APP";
const DB_BACKUP_DIR = "D:\\Dropbox\\Aplicativos\\Kontrol\\BD";

export type BackupActionState = {
  ok: boolean;
  message: string;
};

type BackupFile = {
  name: string;
  path: string;
  size: number;
  modifiedAt: Date;
};

async function listarBackups(dir: string, prefix: string): Promise<BackupFile[]> {
  try {
    await access(dir);
  } catch {
    return [];
  }

  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.startsWith(prefix))
      .map(async (entry) => {
        const filePath = path.join(dir, entry.name);
        const info = await stat(filePath);
        return {
          name: entry.name,
          path: filePath,
          size: info.size,
          modifiedAt: info.mtime,
        };
      }),
  );

  return files.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());
}

export async function obterResumoBackups() {
  if (!(await temPermissao("backups.gerir"))) {
    return null;
  }

  const [appBackups, dbBackups] = await Promise.all([
    listarBackups(APP_BACKUP_DIR, "kontrol-app-"),
    listarBackups(DB_BACKUP_DIR, "kontrol-db-cloud-"),
  ]);

  return {
    appDir: APP_BACKUP_DIR,
    dbDir: DB_BACKUP_DIR,
    appBackups,
    dbBackups,
  };
}

export async function executarBackupAplicativo(
  prevState: BackupActionState,
): Promise<BackupActionState> {
  void prevState;

  if (!(await temPermissao("backups.gerir"))) {
    return { ok: false, message: "Acesso restrito ao administrador." };
  }

  const scriptPath = path.join(process.cwd(), "scripts", "backup-app-local.ps1");

  try {
    await mkdir(APP_BACKUP_DIR, { recursive: true });
    await execFileAsync(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        scriptPath,
        "-SourcePath",
        process.cwd(),
        "-DestinationPath",
        APP_BACKUP_DIR,
      ],
      {
        cwd: process.cwd(),
        windowsHide: true,
        maxBuffer: 1024 * 1024 * 4,
      },
    );

    revalidatePath("/governanca/configuracoes");
    return {
      ok: true,
      message: "Backup do aplicativo criado. A retenção manteve no máximo 5 versões.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida.";
    return {
      ok: false,
      message: `Não foi possível criar o backup do aplicativo: ${message}`,
    };
  }
}
