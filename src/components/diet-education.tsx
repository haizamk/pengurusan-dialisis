import type { DietNote } from "@/lib/lab-analysis"

export function DietEducation({ notes, disclaimer }: { notes: DietNote[]; disclaimer: string }) {
  return (
    <section className="grid gap-3">
      <h2 className="font-heading text-2xl">Cadangan Pemakanan Berdasarkan Rekod Darah</h2>
      {notes.length === 0 ? (
        <p className="text-sm leading-6 text-muted-foreground">
          Tiada cadangan pemakanan kerana keputusan kalium, fosfat, hemoglobin, feritin, TSAT atau albumin yang disahkan belum ada. Tiada had kalium, fosfat, protein atau cecair dicipta.
        </p>
      ) : (
        notes.map((note) => (
          <article key={note.topic} className="rounded-2xl bg-card p-4 text-sm leading-6 ring-1 ring-foreground/10">
            <h3 className="font-heading text-xl">{note.topic}</h3>
            <p className="mt-2"><span className="text-muted-foreground">Bukti: </span>{note.evidence}</p>
            <p className="mt-2">{note.why}</p>
            <p className="mt-2">{note.discussion}</p>
            <p className="mt-2">{note.limit}</p>
          </article>
        ))
      )}
      <p className="text-sm leading-6 text-muted-foreground">{disclaimer}</p>
    </section>
  )
}
