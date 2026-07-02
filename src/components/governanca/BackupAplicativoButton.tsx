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
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-card"
        >
          <Archive className="h-4 w-4" aria-hidden="true" />
          {pending ? "Gerando backup..." : "Fazer backup do aplicativo"}
        </button>
      </form>

      {state.message && (
        <p
          className={`text-sm ${
            state.ok
              ? "text-brand-700 dark:text-brand-300"
              : "text-danger-strong"
          }`}
        >
          {state.message}
        </p>
      )}
    </div>
  );
}
