export function PageLoading({ title = "Carregando" }: { title?: string }) {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10" aria-busy="true" aria-live="polite">
      <div className="h-7 w-56 animate-pulse rounded-md bg-slate-200 dark:bg-zinc-800" />
      <p className="sr-only">{title}</p>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="h-4 w-24 animate-pulse rounded bg-slate-200 dark:bg-zinc-800" />
            <div className="mt-4 h-8 w-32 animate-pulse rounded bg-slate-200 dark:bg-zinc-800" />
            <div className="mt-3 h-3 w-full animate-pulse rounded bg-slate-100 dark:bg-zinc-800/70" />
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((item) => (
            <div key={item} className="h-4 animate-pulse rounded bg-slate-100 dark:bg-zinc-800/70" />
          ))}
        </div>
      </div>
    </main>
  );
}
