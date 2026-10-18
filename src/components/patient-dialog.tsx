"use client"

import { useState } from "react"
import { toast } from "sonner"
import { ChoiceSelect } from "@/components/choice-select"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ACCESS_LABEL } from "@/lib/format"
import { useStore } from "@/lib/store"
import type { AccessType, Patient, Sex } from "@/lib/types"

type Draft = {
  fullName: string
  mrn: string
  sex: Sex
  dateOfBirth: string
  phone: string
  centreId: string
  dryWeightKg: string
  accessType: AccessType
  accessSite: string
  schedule: string
  diagnosis: string
  notes: string
  active: boolean
}

const empty: Draft = {
  fullName: "",
  mrn: "",
  sex: "perempuan",
  dateOfBirth: "",
  phone: "",
  centreId: "",
  dryWeightKg: "",
  accessType: "fistula",
  accessSite: "",
  schedule: "Isnin, Rabu, Jumaat",
  diagnosis: "",
  notes: "",
  active: true,
}

function fromPatient(patient: Patient): Draft {
  return {
    fullName: patient.fullName,
    mrn: patient.mrn,
    sex: patient.sex,
    dateOfBirth: patient.dateOfBirth,
    phone: patient.phone,
    centreId: patient.centreId,
    dryWeightKg: String(patient.dryWeightKg),
    accessType: patient.accessType,
    accessSite: patient.accessSite,
    schedule: patient.schedule,
    diagnosis: patient.diagnosis,
    notes: patient.notes,
    active: patient.active,
  }
}

export function PatientDialog({
  open,
  onOpenChange,
  patient,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  patient?: Patient | null
}) {
  const { centres, patients, savePatient } = useStore()
  const resetKey = `${open}:${patient?.id ?? "baru"}`
  const [seen, setSeen] = useState(resetKey)
  const [draft, setDraft] = useState<Draft>(empty)
  if (seen !== resetKey) {
    setSeen(resetKey)
    if (open) {
      setDraft(patient ? fromPatient(patient) : { ...empty, centreId: centres[0]?.id ?? "" })
    }
  }

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const dry = Number(draft.dryWeightKg)
    if (!draft.fullName.trim() || !draft.mrn.trim()) {
      toast.error("Nama dan nombor rekod diperlukan.")
      return
    }
    if (!draft.centreId) {
      toast.error("Pilih centre dialisis.")
      return
    }
    if (!draft.dateOfBirth) {
      toast.error("Tarikh lahir diperlukan.")
      return
    }
    if (!Number.isFinite(dry) || dry < 20 || dry > 200) {
      toast.error("Berat kering perlu antara 20 dan 200 kg.")
      return
    }
    const mrn = draft.mrn.trim().toLowerCase()
    const duplicate = patients.some(
      (item) => item.id !== patient?.id && item.mrn.trim().toLowerCase() === mrn,
    )
    if (duplicate) {
      toast.error("Nombor rekod ini sudah digunakan.")
      return
    }
    const next: Patient = {
      id: patient?.id ?? crypto.randomUUID(),
      fullName: draft.fullName.trim(),
      mrn: draft.mrn.trim(),
      sex: draft.sex,
      dateOfBirth: draft.dateOfBirth,
      phone: draft.phone.trim(),
      centreId: draft.centreId,
      dryWeightKg: dry,
      accessType: draft.accessType,
      accessSite: draft.accessSite.trim(),
      schedule: draft.schedule.trim(),
      diagnosis: draft.diagnosis.trim(),
      notes: draft.notes.trim(),
      active: draft.active,
    }
    try {
      await savePatient(next, patient ? "update" : "insert")
      toast.success(patient ? "Rekod pesakit dikemas kini." : "Pesakit baharu disimpan.")
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan pesakit.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{patient ? "Kemas kini pesakit" : "Pesakit baharu"}</DialogTitle>
          <DialogDescription>
            Setiap pesakit terikat pada satu centre. Berat kering di sini menjadi nilai lalai sesi
            baharu, manakala sesi lama menyimpan berat kering pada masa itu.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nama penuh">
              <Input className="h-11" value={draft.fullName} onChange={(event) => set("fullName", event.target.value)} />
            </Field>
            <Field label="No. rekod">
              <Input className="h-11" value={draft.mrn} onChange={(event) => set("mrn", event.target.value)} />
            </Field>
            <Field label="Jantina">
              <ChoiceSelect
                value={draft.sex}
                onChange={(value) => set("sex", value as Sex)}
                placeholder="Pilih jantina"
                options={[
                  { value: "perempuan", label: "Perempuan" },
                  { value: "lelaki", label: "Lelaki" },
                ]}
              />
            </Field>
            <Field label="Tarikh lahir">
              <Input className="h-11" type="date" value={draft.dateOfBirth} onChange={(event) => set("dateOfBirth", event.target.value)} />
            </Field>
            <Field label="Telefon">
              <Input className="h-11" value={draft.phone} onChange={(event) => set("phone", event.target.value)} />
            </Field>
            <Field label="Centre dialisis">
              <ChoiceSelect
                value={draft.centreId}
                onChange={(value) => set("centreId", value)}
                placeholder="Pilih centre"
                options={centres.map((centre) => ({
                  value: centre.id,
                  label: `${centre.name}, ${centre.city}`,
                }))}
              />
            </Field>
            <Field label="Berat kering (kg)">
              <Input
                className="h-11"
                inputMode="decimal"
                type="number"
                min={20}
                max={200}
                step="0.1"
                value={draft.dryWeightKg}
                onChange={(event) => set("dryWeightKg", event.target.value)}
              />
            </Field>
            <Field label="Jenis akses">
              <ChoiceSelect
                value={draft.accessType}
                onChange={(value) => set("accessType", value as AccessType)}
                placeholder="Pilih akses"
                options={(Object.keys(ACCESS_LABEL) as AccessType[]).map((key) => ({
                  value: key,
                  label: ACCESS_LABEL[key],
                }))}
              />
            </Field>
            <Field label="Lokasi akses">
              <Input className="h-11" value={draft.accessSite} placeholder="Contoh: lengan kiri" onChange={(event) => set("accessSite", event.target.value)} />
            </Field>
            <Field label="Jadual">
              <Input className="h-11" value={draft.schedule} onChange={(event) => set("schedule", event.target.value)} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => set("schedule", "Isnin, Rabu, Jumaat")}>
              Isnin / Rabu / Jumaat
            </Button>
            <Button type="button" variant="outline" onClick={() => set("schedule", "Selasa, Khamis, Sabtu")}>
              Selasa / Khamis / Sabtu
            </Button>
          </div>
          <Field label="Diagnosis">
            <Input className="h-11" value={draft.diagnosis} onChange={(event) => set("diagnosis", event.target.value)} />
          </Field>
          <Field label="Catatan">
            <Textarea value={draft.notes} onChange={(event) => set("notes", event.target.value)} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(event) => set("active", event.target.checked)}
            />
            Pesakit masih aktif di centre
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" className="h-11">
              Simpan pesakit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function CentreDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { saveCentre } = useStore()
  const [name, setName] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [phone, setPhone] = useState("")
  const [seenOpen, setSeenOpen] = useState(open)
  if (open && !seenOpen) {
    setSeenOpen(true)
    setName("")
    setCity("")
    setState("")
    setPhone("")
  } else if (!open && seenOpen) {
    setSeenOpen(false)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim() || !city.trim() || !state.trim()) {
      toast.error("Nama centre, bandar, dan negeri diperlukan.")
      return
    }
    try {
      await saveCentre(
        { id: crypto.randomUUID(), name: name.trim(), city: city.trim(), state: state.trim(), phone: phone.trim() },
        "insert",
      )
      toast.success("Centre baharu ditambah.")
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan centre.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Centre dialisis baharu</DialogTitle>
          <DialogDescription>
            Pesakit dari centre berbeza disimpan dalam senarai yang sama, kemudian ditapis mengikut centre.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-3" onSubmit={submit}>
          <Field label="Nama centre">
            <Input className="h-11" value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Bandar">
              <Input className="h-11" value={city} onChange={(event) => setCity(event.target.value)} />
            </Field>
            <Field label="Negeri">
              <Input className="h-11" value={state} onChange={(event) => setState(event.target.value)} />
            </Field>
          </div>
          <Field label="Telefon">
            <Input className="h-11" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" className="h-11">
              Simpan centre
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
