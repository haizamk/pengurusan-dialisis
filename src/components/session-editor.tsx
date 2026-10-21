"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { ChoiceSelect } from "@/components/choice-select"
import { UfPanel } from "@/components/uf-panel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { estimatedNetRemovalL, ufRateFromMachine } from "@/lib/monitoring"
import { analyseUf } from "@/lib/uf"
import { previousCompletedSession } from "@/lib/queries"
import { useStore } from "@/lib/store"
import type { DialysisSession } from "@/lib/types"

type Draft = {
  id: string | null
  createdAt: string | null
  patientId: string
  centreId: string
  sessionDate: string
  arrival: string
  post: string
  dry: string
  duration: string
  prescribed: string
  machineUf: string
  ufTarget: string
  symptoms: string
  sessionTime: string
  systolicPre: string
  diastolicPre: string
  systolicPost: string
  diastolicPost: string
  notes: string
  updateDryWeight: boolean
}

function todayIso() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${now.getFullYear()}-${month}-${day}`
}

function blank(): Draft {
  return {
    id: null,
    createdAt: null,
    patientId: "",
    centreId: "",
    sessionDate: todayIso(),
    arrival: "",
    post: "",
    dry: "",
    duration: "240",
    prescribed: "",
    machineUf: "",
    ufTarget: "",
    symptoms: "",
    sessionTime: "",
    systolicPre: "",
    diastolicPre: "",
    systolicPost: "",
    diastolicPost: "",
    notes: "",
    updateDryWeight: true,
  }
}

function optionalNumber(value: string) {
  if (value.trim() === "") return null
  const number = Number(value)
  return Number.isFinite(number) ? number : Number.NaN
}

export function SessionEditor({
  presetPatientId,
  presetSessionId,
}: {
  presetPatientId?: string
  presetSessionId?: string
}) {
  const { patients, centres, sessions, saveSession, savePatient } = useStore()
  const [draft, setDraft] = useState<Draft>(() => {
    const session = presetSessionId
      ? sessions.find((item) => item.id === presetSessionId)
      : null
    if (session) {
      return {
        id: session.id,
        createdAt: session.createdAt,
        patientId: session.patientId,
        centreId: session.centreId,
        sessionDate: session.sessionDate,
        arrival: String(session.arrivalWeightKg),
        post: session.postWeightKg == null ? "" : String(session.postWeightKg),
        dry: String(session.dryWeightKg),
        duration: String(session.durationMin),
        prescribed: session.prescribedDurationMin == null ? "" : String(session.prescribedDurationMin),
        machineUf: session.machineUfMl == null ? "" : String(session.machineUfMl),
        ufTarget: session.ufTargetL == null ? "" : String(session.ufTargetL),
        symptoms: session.symptoms ?? "",
        sessionTime: session.sessionTime ?? "",
        systolicPre: session.systolicPre == null ? "" : String(session.systolicPre),
        diastolicPre: session.diastolicPre == null ? "" : String(session.diastolicPre),
        systolicPost: session.systolicPost == null ? "" : String(session.systolicPost),
        diastolicPost: session.diastolicPost == null ? "" : String(session.diastolicPost),
        notes: session.notes,
        updateDryWeight: false,
      }
    }
    const patient = patients.find((item) => item.id === presetPatientId)
    return {
      ...blank(),
      patientId: patient?.id ?? "",
      centreId: patient?.centreId ?? "",
      dry: patient ? String(patient.dryWeightKg) : "",
    }
  })

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function choosePatient(patientId: string) {
    const patient = patients.find((item) => item.id === patientId)
    setDraft((current) => ({
      ...current,
      patientId,
      centreId: current.id ? current.centreId : patient?.centreId ?? current.centreId,
      dry: current.id ? current.dry : patient ? String(patient.dryWeightKg) : current.dry,
    }))
  }

  const analysis = useMemo(() => {
    const arrival = Number(draft.arrival)
    const dry = Number(draft.dry)
    if (!Number.isFinite(arrival) || !Number.isFinite(dry) || arrival <= 0 || dry <= 0) return null
    const post = optionalNumber(draft.post)
    const probe: DialysisSession = {
      id: draft.id ?? "__draft__",
      patientId: draft.patientId,
      centreId: draft.centreId,
      sessionDate: draft.sessionDate || "9999-12-31",
      arrivalWeightKg: arrival,
      postWeightKg: post != null && Number.isFinite(post) ? post : null,
      dryWeightKg: dry,
      durationMin: Number(draft.duration) || 240,
      systolicPre: null,
      diastolicPre: null,
      systolicPost: null,
      diastolicPost: null,
      notes: "",
      createdAt: draft.createdAt ?? "9999-12-31T00:00:00.000Z",
    }
    const previous = draft.patientId
      ? previousCompletedSession(draft.patientId, sessions, probe)
      : undefined
    return analyseUf({
      dryWeightKg: dry,
      arrivalWeightKg: arrival,
      postWeightKg: probe.postWeightKg,
      lastPostWeightKg: previous?.postWeightKg ?? null,
      durationMin: probe.durationMin,
    })
  }, [draft, sessions])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const patient = patients.find((item) => item.id === draft.patientId)
    if (!patient) {
      toast.error("Pilih pesakit.")
      return
    }
    const arrival = Number(draft.arrival)
    const dry = Number(draft.dry)
    const post = optionalNumber(draft.post)
    const duration = Number(draft.duration)
    if (!draft.sessionDate || !draft.centreId) {
      toast.error("Tarikh dan centre sesi diperlukan.")
      return
    }
    if (!Number.isFinite(arrival) || arrival < 20 || arrival > 200) {
      toast.error("Berat semasa tiba perlu antara 20 dan 200 kg.")
      return
    }
    if (!Number.isFinite(dry) || dry < 20 || dry > 200) {
      toast.error("Berat kering perlu antara 20 dan 200 kg.")
      return
    }
    if (post != null && (!Number.isFinite(post) || post < 20 || post > 200)) {
      toast.error("Berat selepas tidak sah.")
      return
    }
    if (!Number.isFinite(duration) || duration < 60 || duration > 480) {
      toast.error("Tempoh sesi perlu antara 60 dan 480 minit.")
      return
    }
    const pressure = [
      optionalNumber(draft.systolicPre),
      optionalNumber(draft.diastolicPre),
      optionalNumber(draft.systolicPost),
      optionalNumber(draft.diastolicPost),
    ]
    if (pressure.some((value) => value != null && !Number.isFinite(value))) {
      toast.error("Tekanan darah tidak sah.")
      return
    }
    const duplicate = sessions.some(
      (session) =>
        session.patientId === patient.id &&
        session.sessionDate === draft.sessionDate &&
        session.id !== draft.id,
    )
    if (duplicate) {
      toast.error("Pesakit ini sudah ada sesi pada tarikh tersebut. Kemas kini rekod sedia ada.")
      return
    }
    const next: DialysisSession = {
      id: draft.id ?? crypto.randomUUID(),
      patientId: patient.id,
      centreId: draft.centreId,
      sessionDate: draft.sessionDate,
      arrivalWeightKg: arrival,
      postWeightKg: post,
      dryWeightKg: dry,
      durationMin: duration,
      systolicPre: optionalNumber(draft.systolicPre),
      diastolicPre: optionalNumber(draft.diastolicPre),
      systolicPost: optionalNumber(draft.systolicPost),
      diastolicPost: optionalNumber(draft.diastolicPost),
      notes: draft.notes.trim(),
      createdAt: draft.createdAt ?? new Date().toISOString(),
      sessionTime: draft.sessionTime || null,
      prescribedDurationMin: optionalNumber(draft.prescribed),
      machineUfMl: optionalNumber(draft.machineUf),
      ufTargetL: optionalNumber(draft.ufTarget),
      symptoms: draft.symptoms.trim(),
      updatedAt: new Date().toISOString(),
    }
    try {
      await saveSession(next, draft.id ? "update" : "insert")
      if (draft.updateDryWeight && dry !== patient.dryWeightKg) {
        await savePatient({ ...patient, dryWeightKg: dry }, "update")
      }
      toast.success(draft.id ? "Sesi dikemas kini." : "Sesi dialisis disimpan.")
      if (!draft.id) {
        setDraft({
          ...blank(),
          patientId: patient.id,
          centreId: patient.centreId,
          dry: String(draft.updateDryWeight ? dry : patient.dryWeightKg),
        })
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan sesi.")
    }
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <form className="grid gap-4 rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:p-5" onSubmit={submit}>
        <div>
          <h2 className="font-heading text-2xl">{draft.id ? "Kemas kini sesi" : "Rekod sesi baharu"}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Isi berat semasa pesakit sampai. Analisis di sebelah menggunakan berat selepas sesi lepas.
          </p>
        </div>
        <Field label="Pesakit">
          <ChoiceSelect
            value={draft.patientId}
            onChange={choosePatient}
            placeholder="Pilih pesakit"
            options={patients
              .filter((patient) => patient.active)
              .map((patient) => ({ value: patient.id, label: `${patient.fullName} · ${patient.mrn}` }))}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tarikh sesi">
            <Input className="h-11" type="date" value={draft.sessionDate} onChange={(event) => set("sessionDate", event.target.value)} />
          </Field>
          <Field label="Centre sesi">
            <ChoiceSelect
              value={draft.centreId}
              onChange={(value) => set("centreId", value)}
              placeholder="Pilih centre"
              options={centres.map((centre) => ({ value: centre.id, label: centre.name }))}
            />
          </Field>
          <Field label="Berat semasa tiba (kg)">
            <Input className="h-11" type="number" inputMode="decimal" step="0.1" value={draft.arrival} onChange={(event) => set("arrival", event.target.value)} />
          </Field>
          <Field label="Berat selepas dialisis (kg)">
            <Input className="h-11" type="number" inputMode="decimal" step="0.1" value={draft.post} onChange={(event) => set("post", event.target.value)} />
          </Field>
          <Field label="Berat kering sesi ini (kg)">
            <Input className="h-11" type="number" inputMode="decimal" step="0.1" value={draft.dry} onChange={(event) => set("dry", event.target.value)} />
          </Field>
          <Field label="Tempoh sebenar (minit)">
            <Input className="h-12" type="number" min={60} max={480} step="15" value={draft.duration} onChange={(event) => set("duration", event.target.value)} />
          </Field>
          <Field label="Tempoh ditetapkan (minit, jika ada)">
            <Input className="h-12" type="number" min={60} max={480} step="15" value={draft.prescribed} onChange={(event) => set("prescribed", event.target.value)} />
          </Field>
          <Field label="UF mesin (mL, jika ada)">
            <Input className="h-12" type="number" min={0} step="1" value={draft.machineUf} onChange={(event) => set("machineUf", event.target.value)} />
          </Field>
          <Field label="Sasaran UF daripada arahan rawatan (L)">
            <Input className="h-12" type="number" min={0} step="0.1" value={draft.ufTarget} onChange={(event) => set("ufTarget", event.target.value)} />
          </Field>
          <Field label="Masa sesi">
            <Input className="h-12" type="time" value={draft.sessionTime} onChange={(event) => set("sessionTime", event.target.value)} />
          </Field>
          <Field label="TD sebelum (sistolik)">
            <Input className="h-11" type="number" value={draft.systolicPre} onChange={(event) => set("systolicPre", event.target.value)} />
          </Field>
          <Field label="TD sebelum (diastolik)">
            <Input className="h-11" type="number" value={draft.diastolicPre} onChange={(event) => set("diastolicPre", event.target.value)} />
          </Field>
          <Field label="TD selepas (sistolik)">
            <Input className="h-11" type="number" value={draft.systolicPost} onChange={(event) => set("systolicPost", event.target.value)} />
          </Field>
          <Field label="TD selepas (diastolik)">
            <Input className="h-11" type="number" value={draft.diastolicPost} onChange={(event) => set("diastolicPost", event.target.value)} />
          </Field>
        </div>
        <Field label="Gejala">
          <Textarea value={draft.symptoms} onChange={(event) => set("symptoms", event.target.value)} placeholder="Kram, pening, letih, atau lain-lain" />
        </Field>
        <Field label="Catatan sesi">
          <Textarea value={draft.notes} onChange={(event) => set("notes", event.target.value)} placeholder="Nota lain tentang sesi" />
        </Field>
        <label className="flex items-start gap-2 text-sm leading-5">
          <input
            className="mt-1"
            type="checkbox"
            checked={draft.updateDryWeight}
            onChange={(event) => set("updateDryWeight", event.target.checked)}
          />
          Kemas kini berat kering pada profil pesakit jika angka ini berbeza
        </label>
        <Button type="submit" className="h-11">
          {draft.id ? "Simpan perubahan" : "Simpan sesi"}
        </Button>
      </form>
      <div className="grid gap-4">
        <UfPanel analysis={analysis} />
        <MonitoringReadout
          pre={optionalNumber(draft.arrival)}
          post={optionalNumber(draft.post)}
          machineUfMl={optionalNumber(draft.machineUf)}
          durationMin={Number(draft.duration)}
          dry={optionalNumber(draft.dry)}
          targetL={optionalNumber(draft.ufTarget)}
        />
      </div>
    </div>
  )
}

function MonitoringReadout({
  pre,
  post,
  machineUfMl,
  durationMin,
  dry,
  targetL,
}: {
  pre: number | null
  post: number | null
  machineUfMl: number | null
  durationMin: number
  dry: number | null
  targetL: number | null
}) {
  const removal = estimatedNetRemovalL(pre, post)
  const rate = ufRateFromMachine({
    machineUfMl,
    actualDurationMin: durationMin,
    weightKg: dry,
    weightLabel: "berat kering sesi ini",
  })
  return (
    <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:p-5">
      <h2 className="font-heading text-2xl">Tiga angka yang berbeza</h2>
      <ul className="mt-3 space-y-2 text-sm leading-6">
        <li>UF mesin: {machineUfMl == null ? "Belum direkodkan" : `${machineUfMl} mL`}</li>
        <li>Anggaran daripada berat: {removal.value == null ? removal.reason : `${removal.value} L`}</li>
        <li>Kadar UF: {rate.mlPerHour.value == null ? rate.mlPerHour.reason : `${rate.mlPerHour.value} mL/jam`}</li>
        <li>
          Kadar ikut berat ({rate.weightLabel}): {rate.mlPerKgHour.value == null ? rate.mlPerKgHour.reason : `${rate.mlPerKgHour.value} mL/kg/jam`}
        </li>
        <li>Sasaran yang anda salin daripada arahan rawatan: {targetL == null ? "Belum direkodkan" : `${targetL} L`}</li>
      </ul>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Angka ini untuk pemantauan. Pasukan dialisis menentukan sasaran rawatan mengikut keadaan klinikal anda.
      </p>
    </section>
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
