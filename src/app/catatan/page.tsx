"use client"

import { useState } from "react"
import { CalendarDays, ClipboardList, Plus, Save } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useStore } from "@/lib/store"

const KINDS = [
  { id: "gejala", label: "Gejala" },
  { id: "ubat", label: "Ubat" },
  { id: "tekanan", label: "Tekanan darah" },
  { id: "cecair", label: "Cecair" },
  { id: "peringatan", label: "Peringatan" },
  { id: "nota", label: "Nota" },
] as const

type Kind = (typeof KINDS)[number]["id"]
type Entry = { id: string; kind: Kind; recordedOn: string; body: string }

function storageKey(patientId: string) {
  return `ppd.catatan.${patientId}`
}

function readEntries(patientId: string): Entry[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(storageKey(patientId))
    return raw ? (JSON.parse(raw) as Entry[]) : []
  } catch {
    return []
  }
}

export default function Page() {
  const { profile, patients } = useStore()
  const patient = profile
    ? profile.role === "pesakit"
      ? patients.find((item) => item.id === profile.patientId) ?? null
      : null
    : patients[0] ?? null
  const [kind, setKind] = useState<Kind>("gejala")
  const [recordedOn, setRecordedOn] = useState("")
  const [body, setBody] = useState("")
  const [entries, setEntries] = useState<Entry[]>(() => (patient ? readEntries(patient.id) : []))

  if (profile?.role === "super_admin") {
    return (
      <PageHeader
        eyebrow="Kawalan akses"
        title="Halaman pesakit"
        description="Catatan peribadi pesakit tidak dipaparkan dalam portal Master Admin."
      />
    )
  }

  if (!patient) {
    return (
      <PageHeader
        eyebrow="Catatan peribadi"
        title="Rekod belum dipautkan"
        description="Catatan peribadi hanya dibuka apabila akaun mempunyai pautan rekod pesakit yang sah."
      />
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        eyebrow="Catatan peribadi"
        title="Gejala, ubat dan peringatan"
        description="Simpan pemerhatian untuk dibincangkan bersama pasukan dialisis. Catatan ubat bukan pengesahan bahawa ubat telah diambil."
      />

      <form
        className="space-y-5 rounded-3xl border border-border/80 bg-card p-4 shadow-sm sm:p-6"
        onSubmit={(event) => {
          event.preventDefault()
          if (!body.trim()) return
          const next = [{ id: crypto.randomUUID(), kind, recordedOn, body: body.trim() }, ...entries]
          window.localStorage.setItem(storageKey(patient.id), JSON.stringify(next))
          setEntries(next)
          setBody("")
        }}
      >
        <div>
          <p className="text-sm font-semibold">Jenis catatan</p>
          <p className="mt-1 text-sm text-muted-foreground">Pilih kategori yang paling sesuai.</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {KINDS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={kind === item.id}
                className={`min-h-12 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${kind === item.id ? "border-primary bg-primary/15 text-primary" : "border-border bg-background/60 text-foreground hover:bg-secondary/70"}`}
                onClick={() => setKind(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
          <div className="space-y-2">
            <label htmlFor="tarikh-catatan" className="text-sm font-medium">Tarikh pemerhatian</label>
            <Input id="tarikh-catatan" className="h-12" type="date" value={recordedOn} onChange={(event) => setRecordedOn(event.target.value)} />
          </div>
          <div className="space-y-2">
            <label htmlFor="isi-catatan" className="text-sm font-medium">Catatan</label>
            <Textarea id="isi-catatan" className="min-h-32 resize-y" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Contoh: gejala yang dirasai atau soalan untuk jururawat" required />
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-muted-foreground">Catatan disimpan pada pelayar ini sahaja dan tidak dihantar kepada Master Admin.</p>
          <Button type="submit" className="h-12 rounded-xl sm:min-w-44"><Save className="mr-2 size-4" /> Simpan catatan</Button>
        </div>
      </form>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-primary uppercase">Arkib peribadi</p>
            <h2 className="mt-1 font-heading text-2xl">Catatan terdahulu</h2>
          </div>
          <span className="rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground">{entries.length} catatan</span>
        </div>
        {entries.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/50 px-5 py-10 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><ClipboardList className="size-6" /></span>
            <h3 className="mt-3 font-semibold">Belum ada catatan</h3>
            <p className="mt-1 text-sm text-muted-foreground">Catatan yang disimpan akan muncul di sini.</p>
          </div>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {entries.map((entry) => (
              <li key={entry.id} className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className="rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary">{KINDS.find((item) => item.id === entry.kind)?.label}</span>
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="size-3.5" /> {entry.recordedOn || "Tarikh tidak ditetapkan"}</span>
                </div>
                <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6">{entry.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <aside className="rounded-2xl border border-border/70 bg-secondary/30 p-4 text-sm leading-6 text-muted-foreground">
        Maklumat ini disimpan pada peranti dan pelayar yang digunakan. Ia tidak disegerakkan ke Supabase atau dipaparkan kepada pusat dialisis.
      </aside>
    </div>
  )
}