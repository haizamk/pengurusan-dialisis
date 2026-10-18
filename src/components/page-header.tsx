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
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-3xl">
        <p className="text-[0.7rem] font-semibold tracking-[0.18em] text-primary uppercase">
          {eyebrow}
        </p>
        <h1 className="mt-1 font-heading text-3xl leading-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
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
    <div className="grid gap-4" aria-busy="true" aria-live="polite">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="h-28 animate-pulse rounded-xl bg-muted" />
        <div className="h-28 animate-pulse rounded-xl bg-muted" />
        <div className="h-28 animate-pulse rounded-xl bg-muted" />
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-muted" />
      <p className="text-sm text-muted-foreground">Sedang membuka rekod…</p>
    </div>
  )
}
