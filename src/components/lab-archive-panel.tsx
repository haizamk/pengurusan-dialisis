"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { ChoiceSelect } from "@/components/choice-select"
import { DietEducation } from "@/components/diet-education"
import { ParameterCharts, resultRows } from "@/components/parameter-charts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  buildLabAnalysis,
  fromBloodRecords,
  mergeConfirmed,
  observationsToConfirmed,
  parameterSeries,
  safetyMessages,
  type ConfirmedResult,
} from "@/lib/lab-analysis"
import {
  BLOOD_RECORD_FIELDS,
  applyConfirmation,
  auditChange,
  loadLabArchive,
  openLabDocument,
  saveLabImport,
  savePatientArchive,
  withoutDuplicateConfirmed,
  type ArchiveData,
  type LabDocument,
  type LabObservation,
} from "@/lib/lab-archive"
import { LAB_PARAMETERS, validateLabFile, type ExtractionStatus } from "@/lib/lab-parse"
import { textFromPdfBytes } from "@/lib/pdf-text"
import { useStore } from "@/lib/store"
import type { BloodRecord } from "@/lib/types"
import { formatDate } from "@/lib/format"

type Section = "upload" | "charts" | "diet" | "analysis" | "history"

const EMPTY = "Belum ada rekod darah. Muat naik laporan makmal untuk menyimpan keputusan, melihat graf dan mendapatkan penerangan berdasarkan data sebenar."

export function useOwnPatient() {
  const store = useStore()
  const [chosen, setChosen] = useState("")
  const blocked = store.profile?.role === "super_admin"
  const patientId = blocked ? null : store.profile?.role === "pesakit" ? store.profile.patientId : chosen || store.patients[0]?.id || null
  return { ...store, patientId, blocked, chosen, setChosen }
}

export function LabArchivePanel({ sections = ["upload", "charts", "diet", "analysis", "history"] }: { sections?: Section[] }) {
  const { patientId, blocked, patients, labs, saveLab, profile, chosen, setChosen } = useOwnPatient()
  const [data, setData] = useState<ArchiveData | null>(null)
  const [cloudNote, setCloudNote] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [duplicateFile, setDuplicateFile] = useState<File | null>(null)
  const [parameter, setParameter] = useState("all")
  const [range, setRange] = useState<"3m" | "6m" | "12m" | "all">("all")
  const [today, setToday] = useState("")
  const pendingLabs = useRef(new Map<string, BloodRecord>())

  useEffect(() => {
    if (!patientId) return
    pendingLabs.current.clear()
    let cancel = false
    void loadLabArchive(patientId).then((result) => {
      if (cancel) return
      setData(result.data)
      setCloudNote(result.cloudNote)
    })
    return () => {
      cancel = true
    }
  }, [patientId])

  const ownLabs = useMemo(() => labs.filter((item) => item.patientId === patientId), [labs, patientId])
  const activeObservations = useMemo(
    () => data?.observations.filter((item) => item.documentId === activeId) ?? [],
    [data, activeId],
  )
  const confirmed = useMemo(() => {
    if (!data) return [] as ConfirmedResult[]
    const extracted = observationsToConfirmed(data.observations.map((row) => ({
      ...row,
      label: row.originalName,
      source: row.source === "pesakit" ? "manual" as const : "disahkan" as const,
    })))
    return mergeConfirmed(extracted, fromBloodRecords(ownLabs))
  }, [data, ownLabs])
  const live = useMemo(() => buildLabAnalysis(confirmed, ""), [confirmed])
  const urgent = safetyMessages(confirmed)

  if (blocked) {
    return <p className="text-sm leading-6">Super admin tidak boleh membuka laporan, graf, atau analisis kesihatan pesakit.</p>
  }
  if (!patientId) return <p className="text-sm leading-6">Akaun pesakit belum dipautkan kepada rekod.</p>

  async function commit(next: ArchiveData) {
    if (!patientId) return
    setData(next)
    const note = await savePatientArchive(patientId, next)
    if (note) setCloudNote(note)
  }

  async function upload(file: File, allowDuplicate: boolean) {
    if (!patientId) return
    const typed = file.type ? file : new File([file], file.name, { type: mimeFromName(file.name) })
    const bytes = new Uint8Array(await typed.arrayBuffer())
    const problem = validateLabFile(typed, bytes)
    if (problem) {
      toast.error(problem)
      return
    }
    let text = ""
    let extractionStatus: ExtractionStatus = "tiada_teks"
    let note = "Imej disimpan. Tiada perkhidmatan OCR dikonfigurkan, jadi tiada nilai diekstrak. Isi keputusan yang anda nampak. Tiada nilai diteka."
    if (typed.type === "application/pdf") {
      try {
        text = await textFromPdfBytes(bytes)
        extractionStatus = text ? "terbaca" : "tiada_teks"
        note = text
          ? "Teks PDF dibaca. Nilai yang tidak lengkap ditanda untuk semakan dan belum disahkan."
          : "PDF disimpan tetapi tiada teks boleh dibaca. Jika ini imbasan, isi nilai semasa semakan."
      } catch {
        extractionStatus = "gagal"
        note = "PDF disimpan tetapi teks tidak dapat dibaca. Laporan tetap boleh dibuka. Isi nilai semasa semakan."
      }
    }
    const result = await saveLabImport({
      patientId,
      fileName: typed.name,
      mime: typed.type,
      bytes,
      text,
      note,
      extractionStatus,
      allowDuplicate,
    })
    if (result.error) {
      toast.error(result.error)
      return
    }
    if (result.duplicate) {
      setDuplicateFile(typed)
      toast.message("Fail yang sama pernah dimuat naik. Simpan sebagai pembetulan hanya jika anda mahu salinan baharu.")
      return
    }
    setDuplicateFile(null)
    if (result.cloudNote) setCloudNote(result.cloudNote)
    const loaded = await loadLabArchive(patientId)
    setData(loaded.data)
    if (loaded.cloudNote) setCloudNote(loaded.cloudNote)
    setActiveId(result.document?.id ?? null)
    toast.success("Laporan disimpan. Sahkan nilai sebelum ia masuk ke rekod dan graf.")
  }

  async function confirmRow(row: LabObservation, draft: ReviewDraft) {
    if (!data || !patientId) return
    if (!draft.accept) {
      toast.error("Tandakan bahawa anda telah menyemak nilai pada laporan.")
      return
    }
    if (draft.value.trim() === "") {
      toast.error("Nilai kosong tidak disimpan, termasuk sebagai sifar.")
      return
    }
    const value = Number(draft.value.replace(",", "."))
    const updatedAt = new Date().toISOString()
    const result = applyConfirmation(row, {
      value,
      unit: draft.unit,
      takenOn: draft.takenOn,
      standardKey: draft.standardKey || null,
      originalName: draft.originalName,
      acceptUnclear: true,
      updatedAt,
    })
    if ("error" in result) {
      toast.error(result.error)
      return
    }
    const others = data.observations.filter((item) => item.id !== row.id)
    const { skipped } = withoutDuplicateConfirmed(others, [result.row])
    if (skipped.length > 0) {
      toast.message("Keputusan yang sama sudah disahkan. Salinan baharu tidak ditambah.")
      return
    }
    const audit = auditChange(row, result.row, updatedAt)
    const observations = data.observations.map((item) => (item.id === row.id ? result.row : item))
    const documents = data.documents.map((item) => item.id === row.documentId ? { ...item, reviewStatus: documentStatus(observations, item.id) } : item)
    await commit({ ...data, documents, observations, audits: audit ? [...data.audits, audit] : data.audits })
    await mirrorBloodRecord(result.row, documents.find((item) => item.id === row.documentId)?.fileName ?? "laporan")
    toast.success("Keputusan disahkan dan disimpan.")
  }

  async function mirrorBloodRecord(row: LabObservation, fileName: string) {
    if (!patientId || row.value == null || row.status !== "disahkan") return
    const mapped = BLOOD_RECORD_FIELDS.find((item) => item.key === row.standardKey && item.unit === row.unit)
    if (!mapped) return
    const existing = pendingLabs.current.get(row.takenOn) ?? ownLabs.find((item) => item.takenOn === row.takenOn)
    if (existing?.[mapped.field] != null) return
    const base: BloodRecord = existing ?? {
      id: crypto.randomUUID(),
      patientId,
      takenOn: row.takenOn,
      hemoglobin: null,
      ureaPre: null,
      ureaPost: null,
      creatinine: null,
      potassium: null,
      phosphate: null,
      calcium: null,
      sodium: null,
      albumin: null,
      notes: `Disahkan daripada laporan ${fileName}. Medan yang sudah ada tidak ditulis semula.`,
      createdAt: new Date().toISOString(),
    }
    const next = { ...base, [mapped.field]: row.value }
    pendingLabs.current.set(row.takenOn, next)
    await saveLab(next, existing ? "update" : "insert")
  }

  async function addManual(documentId: string | null) {
    if (!data || !patientId) return
    const now = new Date().toISOString()
    const row: LabObservation = {
      id: crypto.randomUUID(),
      patientId,
      documentId,
      takenOn: "",
      originalName: "",
      standardKey: null,
      value: null,
      unit: null,
      refText: null,
      abnormalFlag: null,
      specimen: null,
      uncertain: true,
      snippet: "Dimasukkan oleh pesakit. Bukan hasil ekstrak.",
      status: "perlu_semakan",
      source: "pesakit",
      createdAt: now,
      updatedAt: now,
    }
    await commit({ ...data, observations: [...data.observations, row] })
  }

  async function saveAnalysis() {
    if (!data || !patientId || confirmed.length === 0) return
    const createdAt = new Date().toISOString()
    const report = buildLabAnalysis(confirmed, createdAt)
    await commit({
      ...data,
      analyses: [{
        id: crypto.randomUUID(),
        patientId,
        documentId: activeId,
        createdAt,
        version: report.version,
        summary: report.summary.join("\n"),
        safety: report.safety,
        parameterKeys: report.parameters.map((item) => item.key),
        body: report,
      }, ...data.analyses],
    })
    toast.success("Analisis baharu disimpan. Analisis lama tidak diubah.")
  }

  async function openDocument(document: LabDocument) {
    const blob = await openLabDocument(document)
    if (!blob) {
      toast.error("Fail laporan tidak dijumpai dalam simpanan akaun ini.")
      return
    }
    const url = URL.createObjectURL(blob)
    window.open(url, "_blank", "noopener,noreferrer")
    window.setTimeout(() => URL.revokeObjectURL(url), 60000)
  }

  const active = data?.documents.find((item) => item.id === activeId) ?? null
  const history = resultRows(confirmed).filter((item) => parameter === "all" || item.standardKey === parameter)
  const ranged = today && range !== "all" ? history.filter((item) => item.takenOn >= cutoff(today, range)) : history

  return (
    <div className="grid gap-8">
      {profile?.role !== "pesakit" ? (
        <div className="max-w-md">
          <Label htmlFor="pesakit-laporan">Pesakit</Label>
          <ChoiceSelect
            id="pesakit-laporan"
            value={chosen || patientId}
            onChange={setChosen}
            placeholder="Pilih pesakit"
            options={patients.map((item) => ({ value: item.id, label: item.fullName }))}
          />
        </div>
      ) : null}
      {cloudNote ? <p className="rounded-2xl bg-muted px-4 py-3 text-sm leading-6">{cloudNote}</p> : null}
      {urgent.length > 0 ? (
        <ul className="space-y-2 rounded-2xl bg-destructive/15 p-4 text-sm leading-6">
          {urgent.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : null}

      {sections.includes("upload") ? (
        <section className="grid gap-4">
          <div>
            <h2 className="font-heading text-2xl">Muat naik laporan</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">PDF, JPG atau PNG sehingga 8 MB. Laporan baharu tidak memadam laporan lama.</p>
          </div>
          <label className="flex min-h-12 cursor-pointer items-center justify-center rounded-xl bg-primary px-4 py-3 text-center text-sm font-medium text-primary-foreground">
            Pilih laporan makmal
            <input
              className="sr-only"
              type="file"
              accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ""
                if (file) void upload(file, false)
              }}
            />
          </label>
          {duplicateFile ? (
            <Button type="button" variant="outline" className="!h-12" onClick={() => void upload(duplicateFile, true)}>
              Simpan sebagai pembetulan
            </Button>
          ) : null}
          {data && data.documents.length === 0 && ownLabs.length === 0 ? <p className="text-sm leading-6 text-muted-foreground">{EMPTY}</p> : null}
          <div className="grid gap-3">
            {(data?.documents ?? []).map((document) => (
              <article key={document.id} className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-medium">{document.fileName}</h3>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {formatDate(document.uploadedAt.slice(0, 10))} · {statusLabel(document.reviewStatus)} · {extractionLabel(document.extractionStatus)}
                    </p>
                    <p className="text-sm leading-6">{document.note}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" className="!h-12" onClick={() => void openDocument(document)}>Buka fail</Button>
                    <Button type="button" className="!h-12" onClick={() => setActiveId(document.id)}>Semak</Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {active && data ? (
            <ReviewCard
              document={active}
              observations={activeObservations}
              onConfirm={(row, draft) => void confirmRow(row, draft)}
              onOpen={() => void openDocument(active)}
              onAdd={() => void addManual(active.id)}
            />
          ) : null}
        </section>
      ) : null}

      {sections.includes("history") ? (
        <section>
          <h2 className="font-heading text-2xl">Sejarah keputusan disahkan</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <ChoiceSelect
              value={parameter}
              onChange={setParameter}
              placeholder="Semua parameter"
              options={[{ value: "all", label: "Semua parameter" }, ...LAB_PARAMETERS.map((item) => ({ value: item.key, label: item.label }))]}
            />
            {(["3m", "6m", "12m", "all"] as const).map((item) => (
              <button
                key={item}
                type="button"
                className={`min-h-12 rounded-lg px-3 text-sm ${range === item ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                onClick={() => {
                  setToday(new Date().toISOString().slice(0, 10))
                  setRange(item)
                }}
              >
                {item === "all" ? "Semua" : item === "3m" ? "3 bulan" : item === "6m" ? "6 bulan" : "12 bulan"}
              </button>
            ))}
          </div>
          {ranged.length === 0 ? <p className="mt-3 text-sm leading-6 text-muted-foreground">{confirmed.length === 0 ? EMPTY : "Tiada keputusan disahkan dalam tapisan ini."}</p> : (
            <ul className="mt-3 divide-y divide-border">
              {ranged.map((item) => (
                <li key={`${item.standardKey}-${item.takenOn}-${item.value}-${item.unit}`} className="py-3 text-sm leading-6">
                  <span className="font-medium">{item.label}</span> {item.value} {item.unit} pada {formatDate(item.takenOn)}. {item.source === "manual" ? "Rekod manual." : "Disahkan daripada laporan."} {item.refText ? `Julat tercetak: ${item.refText}.` : ""}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {sections.includes("charts") ? (
        <section>
          <h2 className="font-heading text-2xl">Graf setiap parameter</h2>
          <div className="mt-3">
            <ParameterCharts series={parameterSeries(confirmed)} onOpen={(documentId) => {
              const document = data?.documents.find((item) => item.id === documentId)
              if (document) void openDocument(document)
            }} />
          </div>
        </section>
      ) : null}

      {sections.includes("analysis") ? (
        <section className="grid gap-3">
          <h2 className="font-heading text-2xl">Analisis AI</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Analisis ini dijana oleh peraturan aplikasi {live.version} daripada rekod yang disahkan. Ia bukan model bahasa, bukan diagnosis, dan tidak menetapkan ubat atau dialisis.
          </p>
          {live.summary.map((item) => <p key={item} className="rounded-2xl bg-card p-4 text-sm leading-6 ring-1 ring-foreground/10">{item}</p>)}
          {live.parameters.map((item) => (
            <article key={`${item.key}-${item.unit}`} className="rounded-2xl bg-card p-4 text-sm leading-6 ring-1 ring-foreground/10">
              <h3 className="font-heading text-xl">{item.label}</h3>
              <p className="mt-2">{item.explanation}</p>
              <p className="mt-2">{item.latest.label} {item.latest.value} {item.unit} pada {item.latest.takenOn}. {item.latest.refText ? `Julat tercetak: ${item.latest.refText}.` : "Julat makmal tidak tersimpan untuk bacaan ini."}</p>
              <p className="mt-2">{item.previous ? `Bacaan setanding sebelumnya ${item.previous.value} ${item.unit} pada ${item.previous.takenOn}.` : "Data belum cukup untuk mengatakan nilai ini naik atau turun."}</p>
              <p className="mt-2">{item.question}</p>
            </article>
          ))}
          <Button type="button" className="!h-12 w-fit" disabled={confirmed.length === 0} onClick={() => void saveAnalysis()}>
            Simpan analisis baharu
          </Button>
          {(data?.analyses ?? []).map((item) => (
            <article key={item.id} className="rounded-2xl bg-muted p-4 text-sm leading-6">
              <p className="font-medium">Disimpan {formatDate(item.createdAt.slice(0, 10))} {item.createdAt.slice(11, 16)} · {item.version}</p>
              <p className="mt-2 whitespace-pre-wrap">{item.summary}</p>
              {item.safety.map((warning) => <p key={warning} className="mt-2">{warning}</p>)}
            </article>
          ))}
          <p className="text-sm leading-6 text-muted-foreground">{live.disclaimer}</p>
        </section>
      ) : null}

      {sections.includes("diet") ? <DietEducation notes={live.diet} disclaimer={live.disclaimer} /> : null}
    </div>
  )
}

type ReviewDraft = {
  originalName: string
  standardKey: string
  value: string
  unit: string
  takenOn: string
  accept: boolean
}

function ReviewCard({
  document,
  observations,
  onConfirm,
  onOpen,
  onAdd,
}: {
  document: LabDocument
  observations: LabObservation[]
  onConfirm: (row: LabObservation, draft: ReviewDraft) => void
  onOpen: () => void
  onAdd: () => void
}) {
  const signature = observations.map((row) => `${row.id}:${row.updatedAt}:${row.status}:${row.value ?? ""}`).join("|")
  const [state, setState] = useState(() => ({ signature, drafts: draftsFrom(observations) }))
  if (state.signature !== signature) setState({ signature, drafts: draftsFrom(observations) })
  const drafts = state.drafts
  function setDrafts(next: Record<string, ReviewDraft>) {
    setState({ signature, drafts: next })
  }

  return (
    <div className="grid gap-4 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-heading text-2xl">Semakan {document.fileName}</h3>
        <Button type="button" variant="outline" className="!h-12" onClick={onOpen}>Buka fail asal</Button>
      </div>
      {observations.length === 0 ? <p className="text-sm leading-6">Tiada nilai diekstrak. Tambah keputusan yang anda nampak pada laporan. Jangan isi nilai yang tidak pasti.</p> : null}
      {observations.map((row) => {
        const draft = drafts[row.id]
        if (!draft) return null
        return (
          <div key={row.id} className="grid gap-3 border-t border-border pt-4">
            <p className="text-sm leading-6">
              {row.status === "disahkan" ? "Disahkan. " : "Belum disahkan. "}
              {row.uncertain ? "Nilai atau tarikh tidak pasti. " : "Teks ini lengkap, tetapi masih perlukan semakan anda. "}
              {row.source === "pesakit" ? "Dimasukkan pesakit." : "Diekstrak, belum menjadi rekod sehingga disahkan."}
            </p>
            <blockquote className="rounded-lg bg-muted px-3 py-2 text-sm leading-6">{row.snippet}</blockquote>
            <Label htmlFor={`${row.id}-nama`}>Nama pada laporan</Label>
            <Input id={`${row.id}-nama`} className="!h-12" value={draft.originalName} onChange={(event) => setDrafts({ ...drafts, [row.id]: { ...draft, originalName: event.target.value } })} />
            <Label htmlFor={`${row.id}-parameter`}>Parameter standard</Label>
            <ChoiceSelect
              id={`${row.id}-parameter`}
              value={draft.standardKey}
              onChange={(value) => setDrafts({ ...drafts, [row.id]: { ...draft, standardKey: value } })}
              placeholder="Biarkan jika tidak pasti"
              options={LAB_PARAMETERS.map((item) => ({ value: item.key, label: item.label }))}
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor={`${row.id}-nilai`}>Nilai</Label>
                <Input id={`${row.id}-nilai`} className="!h-12" inputMode="decimal" value={draft.value} onChange={(event) => setDrafts({ ...drafts, [row.id]: { ...draft, value: event.target.value } })} />
              </div>
              <div>
                <Label htmlFor={`${row.id}-unit`}>Unit</Label>
                <Input id={`${row.id}-unit`} className="!h-12" value={draft.unit} onChange={(event) => setDrafts({ ...drafts, [row.id]: { ...draft, unit: event.target.value } })} />
              </div>
              <div>
                <Label htmlFor={`${row.id}-tarikh`}>Tarikh ujian</Label>
                <Input id={`${row.id}-tarikh`} className="!h-12" type="date" value={draft.takenOn} onChange={(event) => setDrafts({ ...drafts, [row.id]: { ...draft, takenOn: event.target.value } })} />
              </div>
            </div>
            {row.refText ? <p className="text-sm leading-6">Julat tercetak: {row.refText}</p> : null}
            <label className="flex min-h-12 items-center gap-3 text-sm">
              <input type="checkbox" className="size-5" checked={draft.accept} onChange={(event) => setDrafts({ ...drafts, [row.id]: { ...draft, accept: event.target.checked } })} />
              Saya telah semak nilai ini pada laporan asal.
            </label>
            <Button type="button" className="!h-12 w-fit" onClick={() => onConfirm(row, draft)}>Sahkan keputusan</Button>
          </div>
        )
      })}
      <Button type="button" variant="outline" className="!h-12 w-fit" onClick={onAdd}>Tambah keputusan manual</Button>
    </div>
  )
}

function draftsFrom(observations: LabObservation[]) {
  const next: Record<string, ReviewDraft> = {}
  for (const row of observations) {
    next[row.id] = {
      originalName: row.originalName,
      standardKey: row.standardKey ?? "",
      value: row.value == null ? "" : String(row.value),
      unit: row.unit ?? "",
      takenOn: row.takenOn,
      accept: false,
    }
  }
  return next
}

function documentStatus(observations: LabObservation[], documentId: string) {
  const rows = observations.filter((item) => item.documentId === documentId)
  if (rows.length === 0 || rows.some((item) => item.status !== "disahkan")) return "perlu_semakan" as const
  return "disahkan" as const
}

function statusLabel(status: LabDocument["reviewStatus"]) {
  return status === "disahkan" ? "Disahkan" : "Perlu semakan"
}

function extractionLabel(status: ExtractionStatus) {
  if (status === "terbaca") return "Teks dibaca"
  if (status === "separa") return "Perlu semakan teks"
  if (status === "gagal") return "Ekstrak gagal"
  return "Tiada teks dibaca"
}

function mimeFromName(name: string) {
  const extension = name.split(".").pop()?.toLowerCase()
  if (extension === "pdf") return "application/pdf"
  if (extension === "png") return "image/png"
  return "image/jpeg"
}

function cutoff(today: string, range: "3m" | "6m" | "12m") {
  const months = range === "3m" ? 3 : range === "6m" ? 6 : 12
  const start = new Date(`${today}T00:00:00Z`)
  start.setUTCMonth(start.getUTCMonth() - months)
  return start.toISOString().slice(0, 10)
}
