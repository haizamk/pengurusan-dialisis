"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { ChoiceSelect } from "@/components/choice-select"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  MARKERS,
  STATUS_LABEL,
  judgeMarker,
  judgeUrr,
  ureaReductionRatio,
  type MarkerKey,
} from "@/lib/blood"
import { formatNumber } from "@/lib/format"
import { useStore } from "@/lib/store"
import type { BloodRecord } from "@/lib/types"

type Draft = {
  id: string | null
  createdAt: string | null
  patientId: string
  takenOn: string
  notes: string
  values: Record<MarkerKey, string>
}

function todayIso() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${now.getFullYear()}-${month}-${day}`
}

function emptyValues(): Record<MarkerKey, string> {
  return {
    hemoglobin: "",
    potassium: "",
    phosphate: "",
    calcium: "",
    sodium: "",
    albumin: "",
    ureaPre: "",
    ureaPost: "",
    creatinine: "",
  }
}

function blank(): Draft {
  return {
    id: null,
    createdAt: null,
    patientId: "",
    takenOn: todayIso(),
    notes: "",
    values: emptyValues(),
  }
}

function fromLab(lab: BloodRecord): Draft {
  const values = emptyValues()
  for (const marker of MARKERS) {
    const value = lab[marker.key]
    values[marker.key] = value == null ? "" : String(value)
  }
  return {
    id: lab.id,
    createdAt: lab.createdAt,
    patientId: lab.patientId,
    takenOn: lab.takenOn,
    notes: lab.notes,
    values,
  }
}

export function LabEditor({
  presetPatientId,
  presetLabId,
}: {
  presetPatientId?: string
  presetLabId?: string
}) {
  const { patients, labs, saveLab } = useStore()
  const [draft, setDraft] = useState<Draft>(() => {
    const existing = presetLabId ? labs.find((lab) => lab.id === presetLabId) : null
    if (existing) return fromLab(existing)
    return { ...blank(), patientId: presetPatientId ?? "" }
  })

  const parsed = useMemo(() => {
    const record = {} as Record<MarkerKey, number | null>
    for (const marker of MARKERS) {
      const raw = draft.values[marker.key].trim()
      record[marker.key] = raw === "" ? null : Number(raw)
    }
    return record
  }, [draft.values])

  const urr = ureaReductionRatio(parsed.ureaPre, parsed.ureaPost)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!draft.patientId || !draft.takenOn) {
      toast.error("Pilih pesakit dan tarikh sampel.")
      return
    }
    const hasValue = MARKERS.some((marker) => parsed[marker.key] != null)
    if (!hasValue) {
      toast.error("Isi sekurang-kurangnya satu keputusan darah.")
      return
    }
    for (const marker of MARKERS) {
      const value = parsed[marker.key]
      if (value != null && !Number.isFinite(value)) {
        toast.error(`${marker.label} bukan nombor yang sah.`)
        return
      }
    }
    const next: BloodRecord = {
      id: draft.id ?? crypto.randomUUID(),
      patientId: draft.patientId,
      takenOn: draft.takenOn,
      hemoglobin: parsed.hemoglobin,
      ureaPre: parsed.ureaPre,
      ureaPost: parsed.ureaPost,
      creatinine: parsed.creatinine,
      potassium: parsed.potassium,
      phosphate: parsed.phosphate,
      calcium: parsed.calcium,
      sodium: parsed.sodium,
      albumin: parsed.albumin,
      notes: draft.notes.trim(),
      createdAt: draft.createdAt ?? new Date().toISOString(),
    }
    try {
      await saveLab(next, draft.id ? "update" : "insert")
      toast.success(draft.id ? "Rekod darah dikemas kini." : "Rekod darah disimpan.")
      if (!draft.id) setDraft({ ...blank(), patientId: draft.patientId })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan rekod darah.")
    }
  }

  return (
    <form className="grid gap-4 rounded-2xl bg-card p-5 ring-1 ring-foreground/10" onSubmit={submit}>
      <div>
        <h2 className="font-heading text-2xl">{draft.id ? "Kemas kini rekod darah" : "Rekod darah baharu"}</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Sasaran di bawah ialah julat pemantauan dialisis yang lazim, bukan diagnosis.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Pesakit">
          <ChoiceSelect
            value={draft.patientId}
            onChange={(patientId) => setDraft((current) => ({ ...current, patientId }))}
            placeholder="Pilih pesakit"
            options={patients.map((patient) => ({
              value: patient.id,
              label: `${patient.fullName} · ${patient.mrn}`,
            }))}
          />
        </Field>
        <Field label="Tarikh sampel">
          <Input
            className="h-11"
            type="date"
            value={draft.takenOn}
            onChange={(event) => setDraft((current) => ({ ...current, takenOn: event.target.value }))}
          />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {MARKERS.map((marker) => {
          const value = parsed[marker.key]
          const status = judgeMarker(marker.key, value != null && Number.isFinite(value) ? value : null)
          return (
            <Field key={marker.key} label={`${marker.label} (${marker.unit})`}>
              <Input
                className="h-11"
                type="number"
                inputMode="decimal"
                step={marker.digits === 0 ? "1" : "0.01"}
                value={draft.values[marker.key]}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    values: { ...current.values, [marker.key]: event.target.value },
                  }))
                }
              />
              <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{marker.hint}</span>
                {status !== "tiada" && status !== "trend" ? (
                  <StatusBadge
                    tone={status === "sasaran" ? "good" : status.startsWith("kritikal") ? "danger" : "warn"}
                  >
                    {STATUS_LABEL[status]}
                  </StatusBadge>
                ) : null}
              </span>
            </Field>
          )
        })}
      </div>
      <div className="rounded-xl bg-secondary/80 p-4 text-sm leading-6">
        <p className="font-medium">URR (urea reduction ratio)</p>
        <p className="mt-1">
          {urr == null
            ? "Isi urea pra dan urea pasca. URR = (1 − urea pasca / urea pra) × 100. Sasaran lazim sekurang-kurangnya 65%."
            : `${formatNumber(urr)}%. ${judgeUrr(urr) === "sasaran" ? "Mencukupi untuk sasaran 65%." : judgeUrr(urr) === "tinggi" ? "Hampir sasaran. Semak tatacara sampel dan preskripsi dialisis." : "Di bawah 60%. Bincang dengan doktor tentang kecukupan dialisis."}`}
        </p>
      </div>
      <Field label="Catatan makmal">
        <Textarea
          value={draft.notes}
          onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
        />
      </Field>
      <Button type="submit" className="h-11">
        {draft.id ? "Simpan perubahan" : "Simpan rekod darah"}
      </Button>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Label className="grid gap-1.5">
      <span>{label}</span>
      {children}
    </Label>
  )
}
