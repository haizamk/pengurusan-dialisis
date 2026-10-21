export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="mb-7 flex flex-col gap-5 border-b border-border/70 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-3xl">
        <p className="inline-flex items-center gap-2 text-[0.68rem] font-bold tracking-[0.2em] text-primary uppercase">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          {eyebrow}
        </p>
        <h1 className="mt-2 font-heading text-3xl leading-tight tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
    </div>
  )
}

export function Disclaimer() {
  return (
    <p className="text-xs leading-5 text-muted-foreground">
      Angka dan tip ini untuk pemantauan serta pendidikan. Keputusan UF, ubat, cecair, dan diet
      mesti disahkan oleh doktor atau jururawat dialisis di centre pesakit.
    </p>
  )
}

export function LoadingBlock() {
  return (
    <div className="grid gap-5" aria-busy="true" aria-live="polite">
      <div className="space-y-3">
        <div className="h-3 w-24 animate-pulse rounded-full bg-muted" />
        <div className="h-9 w-64 max-w-full animate-pulse rounded-xl bg-muted" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="h-28 animate-pulse rounded-2xl bg-card ring-1 ring-border" />
        <div className="h-28 animate-pulse rounded-2xl bg-card ring-1 ring-border" />
        <div className="h-28 animate-pulse rounded-2xl bg-card ring-1 ring-border" />
        <div className="h-28 animate-pulse rounded-2xl bg-card ring-1 ring-border" />
      </div>
      <div className="h-64 animate-pulse rounded-2xl bg-card ring-1 ring-border" />
      <p className="text-sm text-muted-foreground">Sedang membuka rekod…</p>
    </div>
  )
}