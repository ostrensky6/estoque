export function PageLoading({ title = "Carregando" }: { title?: string }) {
  return (
    <main className="app-page-container" aria-busy="true" aria-live="polite">
      <div className="h-7 w-56 animate-pulse rounded-md bg-muted" />
      <p className="sr-only">{title}</p>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="rounded-lg border border-border bg-card p-4 shadow-xs">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="mt-4 h-8 w-32 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-3 w-full animate-pulse rounded bg-muted/70" />
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-lg border border-border bg-card p-4 shadow-xs">
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((item) => (
            <div key={item} className="h-4 animate-pulse rounded bg-muted/70" />
          ))}
        </div>
      </div>
    </main>
  );
}
