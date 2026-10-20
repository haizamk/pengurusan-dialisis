"use client"

import { useState } from "react"
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

type Entry = {
  id: string
  kind: Kind
  recordedOn: string
  body: string
}

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
  const patient = patients.find((item) => item.id === profile?.patientId) ?? patients[0] ?? null
  const [kind, setKind] = useState<Kind>("gejala")
  const [recordedOn, setRecordedOn] = useState("")
  const [body, setBody] = useState("")
  const [entries, setEntries] = useState<Entry[]>(() => (patient ? readEntries(patient.id) : []))

  if (!patient) {
    return (
      <PageHeader
        eyebrow="Catatan"
        title="Belum ada rekod"
        description="Catatan peribadi dibuka selepas akaun diluluskan."
      />
    )
  }

  return (
    <div>
      <PageHeader
        eyebrow="Catatan sendiri"
        title="Gejala, ubat, dan peringatan"
        description="Catatan ini milik anda. Merekod ubat tidak bermaksud ubat itu telah diambil. Tiada sasaran cecair atau diet yang dipaksa."
      />
      <form
        className="grid gap-3 rounded-2xl bg-card p-5 ring-1 ring-foreground/10"
        onSubmit={(event) => {
          event.preventDefault()
          if (!body.trim()) return
          const next = [{ id: crypto.randomUUID(), kind, recordedOn, body: body.trim() }, ...entries]
          window.localStorage.setItem(storageKey(patient.id), JSON.stringify(next))
          setEntries(next)
          setBody("")
        }}
      >
        <div className="flex flex-wrap gap-2">
          {KINDS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`min-h-12 rounded-lg px-3 text-sm ${kind === item.id ? "bg-primary text-primary-foreground" : "bg-muted"}`}
              onClick={() => setKind(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <Input className="h-12" type="date" value={recordedOn} onChange={(event) => setRecordedOn(event.target.value)} aria-label="Tarikh catatan" />
        <Textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Tulis apa yang anda perhatikan" aria-label="Isi catatan" />
        <Button type="submit" className="h-12 w-fit">Simpan catatan</Button>
      </form>
      <ul className="mt-4 space-y-3">
        {entries.length === 0 ? <li className="text-sm text-muted-foreground">Belum direkodkan.</li> : null}
        {entries.map((entry) => (
          <li key={entry.id} className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
            <p className="text-sm text-muted-foreground">{KINDS.find((item) => item.id === entry.kind)?.label} · {entry.recordedOn}</p>
            <p className="mt-1 text-sm leading-6">{entry.body}</p>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        Catatan ini disimpan pada pelayar ini. Ia tidak dihantar kepada super admin.
      </p>
    </div>
  )
}
