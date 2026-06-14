"use client";

import { useActionState } from "react";
import { Archive } from "lucide-react";
import {
  executarBackupAplicativo,
  type BackupActionState,
} from "@/lib/actions/backups";

const initialState: BackupActionState = {
  ok: false,
  message: "",
};

export function BackupAplicativoButton() {
  const [state, action, pending] = useActionState(
    executarBackupAplicativo,
    initialState,
  );

  return (
    <div className="space-y-3">
      <form action={action}>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-zinc-200"
        >
          <Archive className="h-4 w-4" aria-hidden="true" />
          {pending ? "Gerando backup..." : "Fazer backup do aplicativo"}
        </button>
      </form>

      {state.message && (
        <p
          className={`text-sm ${
            state.ok
              ? "text-emerald-700 dark:text-emerald-300"
              : "text-red-700 dark:text-red-300"
          }`}
        >
          {state.message}
        </p>
      )}
    </div>
  );
}
