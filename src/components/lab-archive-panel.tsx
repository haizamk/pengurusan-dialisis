"use client"

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
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
  applyReextraction,
  draftFromText,
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
import { LAB_PARAMETERS, validateLabFile } from "@/lib/lab-parse"
import { extractReport, PATIENT_STATUS, type ExtractionDiagnostic } from "@/lib/pdf-text"
import type { ParsedObservation } from "@/lib/lab-parse"
import { useStore } from "@/lib/store"
import { getSupabase } from "@/lib/supabase"
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
  const [reading, setReading] = useState(false)
  const [uploadStage, setUploadStage] = useState<"validating" | "archiving" | "extracting" | "saving" | "done" | "error" | null>(null)
  const [analysisStage, setAnalysisStage] = useState<"session" | "sending" | "analysing" | "saving" | null>(null)
  const [analysing, setAnalysing] = useState(false)
  const [parameter, setParameter] = useState("all")
  const [range, setRange] = useState<"3m" | "6m" | "12m" | "all">("all")
  const [today, setToday] = useState("")
  const pendingLabs = useRef(new Map<string, BloodRecord>())
  const readingRef = useRef(false)
  const showDiagnostics = useSyncExternalStore(subscribeDiagnostics, readDiagnostics, () => false)

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
    if (!patientId || readingRef.current) return
    const typed = file.type ? file : new File([file], file.name, { type: mimeFromName(file.name) })
    setUploadStage("validating")
    const bytes = new Uint8Array(await typed.arrayBuffer())
    const problem = validateLabFile(typed, bytes)
    if (problem) {
      setUploadStage("error")
      toast.error(problem)
      return
    }
    readingRef.current = true
    setReading(true)
    setUploadStage("archiving")
    try {
      const stored = await saveLabImport({
        patientId,
        fileName: typed.name,
        mime: typed.type,
        bytes,
        text: "",
        note: PATIENT_STATUS.reading,
        extractionStatus: "gagal",
        processingStatus: "membaca",
        allowDuplicate,
      })
      if (stored.error) {
        setUploadStage("error")
        toast.error(stored.error)
        return
      }
      if (stored.duplicate) {
        setUploadStage("done")
        setDuplicateFile(typed)
        toast.message("Fail yang sama pernah dimuat naik. Gunakan Cuba baca semula pada laporan itu, atau simpan sebagai pembetulan jika anda mahu salinan baharu.")
        return
      }
      setDuplicateFile(null)
      if (stored.cloudNote) setCloudNote(stored.cloudNote)
      const loaded = await loadLabArchive(patientId)
      setData(loaded.data)
      if (loaded.cloudNote) setCloudNote(loaded.cloudNote)
      const document = stored.document
      if (!document) return
      setActiveId(document.id)
      setUploadStage("extracting")
      let text = ""
      let note: string = PATIENT_STATUS.failed
      let diagnostic: ExtractionDiagnostic | null = null
      let observations: ParsedObservation[] | undefined
      let reportDate: string | null | undefined
      let dateUncertain: boolean | undefined
      try {
        const outcome = await extractReport(bytes, typed)
        text = outcome.text
        note = outcome.patientStatus
        diagnostic = outcome.diagnostic
        observations = outcome.observations.length > 0 ? outcome.observations : undefined
        reportDate = outcome.reportDate
        dateUncertain = outcome.dateUncertain
      } catch {
        note = PATIENT_STATUS.failed
      }
      const draft = draftFromText({
        id: document.id,
        patientId,
        fileName: typed.name,
        mime: typed.type,
        byteSize: bytes.length,
        sha256: document.sha256,
        text,
        uploadedAt: document.uploadedAt,
        note,
        extractionStatus: text || (observations?.length ?? 0) > 0 ? "separa" : "gagal",
        diagnostic,
        observations,
        reportDate,
        dateUncertain,
      })
      const current = loaded.data
      setUploadStage("saving")
      await commit(applyReextraction(current, document.id, draft))
      if (draft.observations.length > 0) {
        setUploadStage("done")
        toast.success(PATIENT_STATUS.found)
      } else {
        setUploadStage("error")
        toast.message(PATIENT_STATUS.failed)
      }
    } catch {
      setUploadStage("error")
      toast.error("Proses muat naik terhenti. Semak status fail dan cuba baca semula; laporan asal tidak dipadam.")
    } finally {
      readingRef.current = false
      setReading(false)
    }
  }

  async function reread(document: LabDocument) {
    if (!data || !patientId || readingRef.current) return
    readingRef.current = true
    setReading(true)
    setActiveId(document.id)
    setUploadStage("extracting")
    toast.message("Membaca semula laporan asal. Tunggu sehingga ekstraksi selesai.")
    try {
      const blob = await openLabDocument(document)
      if (!blob) {
        setUploadStage("error")
        toast.error("Fail asal tidak dijumpai. Laporan yang dimuat naik tidak dipadam.")
        return
      }
      const bytes = new Uint8Array(await blob.arrayBuffer())
      const outcome = await extractReport(bytes, { name: document.fileName, type: document.mime || "application/pdf" })
      if (outcome.observations.length === 0) {
        const failedDocument = {
          ...document,
          note: outcome.diagnostic.errorMessage
            ? `Ekstraksi semula gagal: ${outcome.diagnostic.errorMessage}`
            : PATIENT_STATUS.failed,
          extractionStatus: "gagal" as const,
          processingStatus: "selesai" as const,
          diagnostic: { ...outcome.diagnostic, documentId: document.id },
        }
        await commit({
          ...data,
          documents: data.documents.map((item) => item.id === document.id ? failedDocument : item),
        })
        setUploadStage("error")
        toast.error("Ekstraksi AI gagal atau tiada bacaan sah. Bacaan lama dikekalkan; semak butiran teknikal atau cuba lagi.")
        return
      }
      const draft = draftFromText({
        id: document.id,
        patientId,
        fileName: document.fileName,
        mime: document.mime,
        byteSize: bytes.length,
        sha256: document.sha256,
        text: outcome.text,
        uploadedAt: document.uploadedAt,
        note: outcome.patientStatus,
        extractionStatus: outcome.text || outcome.observations.length > 0 ? "separa" : "gagal",
        diagnostic: outcome.diagnostic,
        observations: outcome.observations.length > 0 ? outcome.observations : undefined,
        reportDate: outcome.reportDate,
        dateUncertain: outcome.dateUncertain,
      })
      setUploadStage("saving")
      await commit(applyReextraction(data, document.id, draft))
      setUploadStage(draft.observations.length > 0 ? "done" : "error")
      if (draft.observations.length > 0) toast.success("Ekstraksi semula selesai. Semak setiap bacaan sebelum mengesahkan.")
      else toast.error("Ekstraksi semula tidak menemui bacaan yang boleh disimpan. Laporan asal kekal; buka Butiran teknikal untuk semak ralat.")
    } catch (error) {
      setUploadStage("error")
      toast.error(error instanceof Error ? `Ekstraksi semula gagal: ${error.message}` : "Ekstraksi semula gagal. Laporan asal kekal.")
    } finally {
      readingRef.current = false
      setReading(false)
    }
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

  async function confirmAll(document: LabDocument, drafts: Record<string, ReviewDraft>) {
    if (!data || !patientId) return
    const rows = data.observations.filter((row) => row.documentId === document.id && row.status !== "disahkan")
    if (rows.length === 0) { toast.message("Semua bacaan sudah disahkan, atau tiada bacaan untuk disimpan."); return }
    const missing = rows.flatMap((row) => {
      const draft = drafts[row.id]
      const fields = [
        !draft?.originalName.trim() && "nama ujian",
        !draft?.value.trim() && "nilai",
        !draft?.unit.trim() && "unit",
        !draft?.takenOn && "tarikh ujian",
        !draft?.standardKey && "parameter standard",
      ].filter(Boolean)
      return fields.length ? [`${row.originalName || "Parameter tanpa nama"}: ${fields.join(", ")}`] : []
    })
    if (missing.length) {
      toast.error(`${missing.length} bacaan belum lengkap: ${missing.slice(0, 3).join("; ")}${missing.length > 3 ? "…" : ""}`, { duration: 12000 })
      return
    }
    const updatedAt = new Date().toISOString()
    const confirmedRows: LabObservation[] = []
    for (const row of rows) {
      const draft = drafts[row.id]
      if (!draft || !draft.value.trim() || !draft.unit.trim() || !draft.takenOn || !draft.standardKey) {
        toast.error(`Bacaan ${row.originalName} belum lengkap. Semak atau edit dahulu.`)
        return
      }
      const result = applyConfirmation(row, {
        value: Number(draft.value.replace(",", ".")), unit: draft.unit,
        takenOn: draft.takenOn, standardKey: draft.standardKey,
        originalName: draft.originalName, acceptUnclear: true, updatedAt,
      })
      if ("error" in result) { toast.error(`${row.originalName}: ${result.error}`); return }
      confirmedRows.push(result.row)
    }
    const existing = data.observations.filter((row) => !rows.some((candidate) => candidate.id === row.id))
    const { skipped } = withoutDuplicateConfirmed(existing, confirmedRows)
    if (skipped.length > 0) { toast.error("Terdapat keputusan pendua. Semak setiap bacaan sebelum menyimpan."); return }
    if (!window.confirm(`Saya telah membandingkan semua ${rows.length} bacaan dengan laporan asal dan mengesahkan semuanya betul. Simpan sekarang?`)) return
    const byId = new Map(confirmedRows.map((row) => [row.id, row]))
    const observations = data.observations.map((row) => byId.get(row.id) ?? row)
    const documents = data.documents.map((item) => item.id === document.id ? { ...item, reviewStatus: documentStatus(observations, item.id) } : item)
    const audits = rows.map((row) => auditChange(row, byId.get(row.id)!, updatedAt)).filter((audit): audit is NonNullable<typeof audit> => audit != null)
    try {
      await commit({ ...data, documents, observations, audits: [...data.audits, ...audits] })
      for (const row of confirmedRows) await mirrorBloodRecord(row, document.fileName)
      toast.success(`${confirmedRows.length} bacaan telah disahkan dan disimpan.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan semua bacaan.")
    }
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

  async function deleteManual(row: LabObservation) {
    if (!data || !patientId || row.patientId !== patientId || row.source !== "pesakit" || row.status === "disahkan") {
      toast.error("Hanya parameter manual yang belum disahkan boleh dipadam.")
      return
    }
    if (!window.confirm(`Padam parameter manual "${row.originalName || "Parameter tanpa nama"}"? Tindakan ini tidak boleh dibatalkan.`)) return
    const observations = data.observations.filter((item) => item.id !== row.id)
    const documents = data.documents.map((item) => item.id === row.documentId ? { ...item, reviewStatus: documentStatus(observations, item.id) } : item)
    const note = await savePatientArchive(patientId, { ...data, observations, documents })
    if (note) {
      setCloudNote(note)
      toast.error("Parameter tidak dapat dipadam sepenuhnya dari storan awan. Sila cuba lagi.")
      return
    }
    setData({ ...data, observations, documents })
    toast.success("Parameter manual telah dipadam.")
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
    if (!data || !patientId || confirmed.length === 0 || analysing) return
    setAnalysing(true)
    setAnalysisStage("session")
    try {
      const supabase = getSupabase()
      const session = await supabase?.auth.getSession()
      const token = session?.data.session?.access_token
      if (!token) {
        toast.error("Sesi log masuk tamat. Log masuk semula sebelum menjana analisis AI.")
        return
      }
      setAnalysisStage("sending")
      const response = await fetch("/api/lab-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          results: confirmed.map((item) => ({
            key: item.standardKey,
            label: item.label,
            date: item.takenOn,
            value: item.value,
            unit: item.unit,
            referenceRange: item.refText,
          })),
        }),
      })
      setAnalysisStage("analysing")
      const result = await response.json() as {
        error?: string
        version?: string
        summary?: string
        safety?: string[]
        parameters?: Array<{ key: string; label: string; value: number; unit: string; date: string; status: string; interpretation: string; foodTips: string[]; followUp: string }>
      }
      if (!response.ok || !result.version || !result.summary || !Array.isArray(result.parameters)) {
        toast.error(result.error ?? "Analisis AI tidak lengkap. Rekod asal tidak diubah.")
        return
      }
      setAnalysisStage("saving")
      const createdAt = new Date().toISOString()
      const stored = {
        id: crypto.randomUUID(),
        patientId,
        documentId: activeId,
        createdAt,
        version: result.version,
        summary: result.summary,
        safety: Array.isArray(result.safety) ? result.safety : [],
        parameterKeys: result.parameters.map((item) => item.key),
        body: result,
      }
      await commit({ ...data, analyses: [stored, ...data.analyses] })
      toast.success("Analisis AI bagi semua keputusan berjaya disimpan.")
    } catch {
      toast.error("Tidak dapat menjana analisis AI. Rekod asal kekal selamat.")
    } finally {
      setAnalysing(false)
      setAnalysisStage(null)
    }
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
            <p className="mt-1 text-sm leading-6 text-muted-foreground">PDF, JPG atau PNG sehingga 20 MB. Laporan baharu tidak memadam laporan lama.</p>
          </div>
          {reading ? (
            <div role="status" aria-live="polite" className="rounded-2xl border border-primary/40 bg-primary/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">{uploadStage === "validating" ? "Langkah 1/4 · Semak fail" : uploadStage === "archiving" ? "Langkah 2/4 · Simpan salinan asal" : uploadStage === "extracting" ? "Langkah 3/4 · Baca laporan" : "Langkah 4/4 · Simpan keputusan"}</p>
                <span className="text-xs text-muted-foreground">Jangan tutup halaman</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: uploadStage === "validating" ? "12%" : uploadStage === "archiving" ? "32%" : uploadStage === "extracting" ? "68%" : "88%" }} />
              </div>
              <ol className="mt-3 grid gap-2 text-sm">
                {[
                  ["validating", "Semak jenis dan saiz fail"],
                  ["archiving", "Simpan fail asal ke arkib pesakit"],
                  ["extracting", "Hantar halaman ke GPT-4o melalui Nous"],
                  ["saving", "Simpan bacaan untuk semakan manual"],
                ].map(([stage, label], index) => {
                  const stages = ["validating", "archiving", "extracting", "saving"]
                  const current = stages.indexOf(uploadStage ?? "")
                  const complete = index < current
                  const activeStep = stage === uploadStage
                  return <li key={stage} className="flex items-center gap-2"><span className={complete ? "text-primary" : activeStep ? "animate-pulse text-primary" : "text-muted-foreground"}>{complete ? "✓" : activeStep ? "●" : "○"}</span><span className={activeStep ? "font-semibold" : "text-muted-foreground"}>{label}</span></li>
                })}
              </ol>
            </div>
          ) : uploadStage === "done" ? (
            <div role="status" className="rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm">✓ Bacaan ditemui dan disimpan. Sila semak setiap nilai sebelum mengesahkan.</div>
          ) : uploadStage === "error" ? (
            <div role="status" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">Proses belum selesai. Semak mesej pada laporan dan cuba baca semula. Fail asal tidak sepatutnya dianggap sebagai keputusan yang telah disahkan.</div>
          ) : <p className="text-sm leading-6 text-muted-foreground">{PATIENT_STATUS.waiting}</p>}
          <p className="text-sm leading-6 text-muted-foreground">PDF, JPG atau PNG · maksimum 20 MB. PDF imbasan akan cuba dibaca menggunakan OCR jika teks tidak tersedia.</p>
          <label className="flex min-h-12 cursor-pointer items-center justify-center rounded-xl bg-primary px-4 py-3 text-center text-sm font-medium text-primary-foreground">
            Pilih laporan makmal
            <input
              className="sr-only"
              type="file"
              disabled={reading}
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
              <article key={document.id} className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-medium">{document.fileName}</h3>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {formatDate(document.uploadedAt.slice(0, 10))} · {statusLabel(document.reviewStatus)} · {extractionLabel(document)}
                    </p>
                    <p className="text-sm leading-6">{document.note}</p>
                    {showDiagnostics ? <DiagnosticDetails diagnostic={document.diagnostic} /> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" className="!h-12" onClick={() => void openDocument(document)}>Buka fail</Button>
                    <Button type="button" variant="outline" className="!h-12" disabled={reading} onClick={() => void reread(document)}>{reading ? "Sedang ekstrak…" : "Cuba baca semula"}</Button>
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
              onConfirmAll={(drafts) => void confirmAll(active, drafts)}
              onDeleteManual={(row) => void deleteManual(row)}
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
                className={`min-h-12 rounded-xl border px-4 text-sm font-semibold transition-colors ${range === item ? "border-primary bg-primary/15 text-primary" : "border-border bg-background hover:bg-secondary/70"}`}
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
            Analisis AI dijana daripada keputusan yang telah disahkan. Ia ialah penerangan pendidikan, bukan diagnosis atau arahan mengubah ubat/dialisis. Tip pemakanan perlu disemak bersama pasukan dialisis.
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
          <Button type="button" className="!h-12 w-fit" disabled={confirmed.length === 0 || analysing} onClick={() => void saveAnalysis()}>
            {analysing ? "Sedang menjana analisis AI…" : "Jana dan simpan analisis AI"}
          </Button>
          {analysing && analysisStage ? (
            <div role="status" aria-live="polite" className="rounded-2xl border border-primary/40 bg-primary/10 p-4">
              <div className="flex items-center justify-between gap-3"><p className="font-semibold">Analisis AI sedang berjalan</p><span className="animate-pulse text-xs text-primary">Diproses</span></div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: analysisStage === "session" ? "20%" : analysisStage === "sending" ? "40%" : analysisStage === "analysing" ? "72%" : "90%" }} /></div>
              <ol className="mt-3 grid gap-2 text-sm">
                {[
                  ["session", "Sahkan sesi pesakit"],
                  ["sending", "Hantar keputusan yang disahkan"],
                  ["analysing", "Gemini menganalisis setiap parameter"],
                  ["saving", "Simpan analisis dan tip pemakanan"],
                ].map(([stage, label], index) => {
                  const stages = ["session", "sending", "analysing", "saving"]
                  const current = stages.indexOf(analysisStage)
                  return <li key={stage} className="flex items-center gap-2"><span className={index < current ? "text-primary" : stage === analysisStage ? "animate-pulse text-primary" : "text-muted-foreground"}>{index < current ? "✓" : stage === analysisStage ? "●" : "○"}</span><span className={stage === analysisStage ? "font-semibold" : "text-muted-foreground"}>{label}</span></li>
                })}
              </ol>
            </div>
          ) : null}
          {(data?.analyses ?? []).map((item) => {
            const body = item.body as { parameters?: Array<{ key?: string; label?: string; value?: number; unit?: string; date?: string; status?: string; interpretation?: string; foodTips?: string[]; followUp?: string }> }
            const aiParameters = item.version.startsWith("gemini-") ? body.parameters ?? [] : []
            return (
              <article key={item.id} className="rounded-2xl bg-muted p-4 text-sm leading-6">
                <p className="font-medium">Disimpan {formatDate(item.createdAt.slice(0, 10))} {item.createdAt.slice(11, 16)} · {item.version}</p>
                <p className="mt-2 whitespace-pre-wrap">{item.summary}</p>
                {aiParameters.map((parameter, index) => (
                  <div key={`${parameter.key ?? "parameter"}-${parameter.date ?? index}-${index}`} className="mt-3 rounded-xl border border-border bg-card p-3">
                    <p className="font-semibold">{parameter.label}: {parameter.value} {parameter.unit} · {parameter.date}</p>
                    <p className="mt-1">Status: {parameter.status?.replaceAll("_", " ")}</p>
                    <p className="mt-1">{parameter.interpretation}</p>
                    {parameter.foodTips?.map((tip, tipIndex) => <p key={tipIndex} className="mt-1">• {tip}</p>)}
                    {parameter.followUp ? <p className="mt-1 text-muted-foreground">Perbincangan: {parameter.followUp}</p> : null}
                  </div>
                ))}
                {item.safety.map((warning) => <p key={warning} className="mt-2 font-medium">{warning}</p>)}
              </article>
            )
          })}
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
  onConfirmAll,
  onDeleteManual,
}: {
  document: LabDocument
  observations: LabObservation[]
  onConfirm: (row: LabObservation, draft: ReviewDraft) => void
  onOpen: () => void
  onAdd: () => void
  onConfirmAll: (drafts: Record<string, ReviewDraft>) => void
  onDeleteManual: (row: LabObservation) => void
}) {
  const signature = observations.map((row) => `${row.id}:${row.updatedAt}:${row.status}:${row.value ?? ""}`).join("|")
  const [state, setState] = useState(() => ({ signature, drafts: draftsFrom(observations) }))
  if (state.signature !== signature) setState({ signature, drafts: draftsFrom(observations) })
  const drafts = state.drafts
  const pendingRows = observations.filter((row) => row.status !== "disahkan")
  const incompleteRows = pendingRows.filter((row) => {
    const draft = drafts[row.id]
    return !draft || !draft.originalName.trim() || !draft.value.trim() || !draft.unit.trim() || !draft.takenOn || !draft.standardKey
  })
  function setDrafts(next: Record<string, ReviewDraft>) {
    setState({ signature, drafts: next })
  }

  return (
    <div className="grid gap-4 rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-heading text-2xl">Semakan {document.fileName}</h3>
        <Button type="button" variant="outline" className="!h-12" onClick={onOpen}>Buka fail asal</Button>
      </div>
      {observations.length === 0 ? <p className="text-sm leading-6">{PATIENT_STATUS.failed} Tambah keputusan yang anda nampak pada laporan. Jangan isi nilai yang tidak pasti.</p> : null}
      {observations.map((row) => {
        const draft = drafts[row.id]
        if (!draft) return null
        return (
          <details key={row.id} className="group rounded-xl border border-border/80 bg-background/50 p-3">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
              <span className="min-w-0">
                <span className="block truncate font-medium">{draft.originalName || "Parameter tanpa nama"}</span>
                <span className="block text-sm text-muted-foreground">{draft.value.trim() ? `${draft.value} ${draft.unit}` : "Nilai belum dikenal pasti"} · {row.status === "disahkan" ? "Disahkan" : "Perlu semakan"}</span>
              </span>
              <span className="shrink-0 text-sm font-medium text-primary">Ada maklumat salah / Edit <span aria-hidden="true">⌄</span></span>
            </summary>
            <div className="mt-3 grid gap-3 border-t border-border pt-3">
              <p className="text-sm text-muted-foreground">Ubah hanya maklumat yang salah. Bandingkan dengan laporan asal sebelum mengesahkan.</p>
              <blockquote className="rounded-lg bg-muted px-3 py-2 text-sm leading-6">{row.snippet}</blockquote>
              <Label htmlFor={`${row.id}-nama`}>Nama pada laporan</Label>
              <Input id={`${row.id}-nama`} className="!h-12" value={draft.originalName} onChange={(event) => setDrafts({ ...drafts, [row.id]: { ...draft, originalName: event.target.value } })} />
              <Label htmlFor={`${row.id}-parameter`}>Parameter standard</Label>
              <ChoiceSelect id={`${row.id}-parameter`} value={draft.standardKey} onChange={(value) => setDrafts({ ...drafts, [row.id]: { ...draft, standardKey: value } })} placeholder="Biarkan jika tidak pasti" options={LAB_PARAMETERS.map((item) => ({ value: item.key, label: item.label }))} />
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label htmlFor={`${row.id}-nilai`}>Nilai</Label><Input id={`${row.id}-nilai`} className="!h-12" inputMode="decimal" value={draft.value} onChange={(event) => setDrafts({ ...drafts, [row.id]: { ...draft, value: event.target.value } })} /></div>
                <div><Label htmlFor={`${row.id}-unit`}>Unit</Label><Input id={`${row.id}-unit`} className="!h-12" value={draft.unit} onChange={(event) => setDrafts({ ...drafts, [row.id]: { ...draft, unit: event.target.value } })} /></div>
              </div>
              <details className="text-sm"><summary className="min-h-10 cursor-pointer text-muted-foreground">Ubah tarikh ujian (jika salah)</summary><Label htmlFor={`${row.id}-tarikh`}>Tarikh ujian</Label><Input id={`${row.id}-tarikh`} className="!h-12" type="date" value={draft.takenOn} onChange={(event) => setDrafts({ ...drafts, [row.id]: { ...draft, takenOn: event.target.value } })} /></details>
              {row.refText ? <p className="text-sm text-muted-foreground">Julat tercetak: {row.refText}</p> : null}
              <label className="flex min-h-12 items-center gap-3 text-sm"><input type="checkbox" className="size-5" checked={draft.accept} onChange={(event) => setDrafts({ ...drafts, [row.id]: { ...draft, accept: event.target.checked } })} />Saya telah bandingkan bacaan dengan laporan asal.</label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" className="!h-12 w-fit" onClick={() => onConfirm(row, draft)}>Sahkan bacaan ini</Button>
                {row.source === "pesakit" && row.status !== "disahkan" ? <Button type="button" variant="destructive" className="!h-12" onClick={() => onDeleteManual(row)}>Padam parameter manual</Button> : null}
              </div>
            </div>
          </details>
        )
      })}
      <div className="flex flex-wrap gap-3">
        {incompleteRows.length > 0 ? <div role="status" className="w-full rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm leading-6"><p className="font-semibold">{incompleteRows.length} daripada {pendingRows.length} bacaan belum lengkap untuk simpan semua.</p><p>Buka Edit dan semak nilai, unit, tarikh serta parameter standard untuk: {incompleteRows.slice(0, 8).map((row) => row.originalName || "Parameter tanpa nama").join(", ")}{incompleteRows.length > 8 ? " dan lain-lain" : ""}. Jangan sahkan nilai yang tidak pasti.</p></div> : null}
        <Button type="button" variant="outline" className="!h-12" onClick={onAdd}>Tambah keputusan manual</Button>
        <Button type="button" className="!h-12" onClick={() => onConfirmAll(drafts)}>Semua Parameter Sepadan. Simpan sekarang</Button>
      </div>
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

function subscribeDiagnostics() {
  return () => {}
}

function readDiagnostics() {
  const params = new URLSearchParams(window.location.search)
  return params.get("diagnostik") === "1" || window.localStorage.getItem("ppd.lab-diagnostics") === "1"
}

function extractionLabel(document: LabDocument) {
  if (document.processingStatus === "membaca") return PATIENT_STATUS.reading
  if (document.extractionStatus === "terbaca" || document.extractionStatus === "separa") return PATIENT_STATUS.found
  return PATIENT_STATUS.failed
}

function DiagnosticDetails({ diagnostic }: { diagnostic: ExtractionDiagnostic | null }) {
  if (!diagnostic) return null
  return (
    <details className="mt-2">
      <summary className="min-h-12 cursor-pointer text-sm">Butiran teknikal</summary>
      <dl className="grid gap-1 text-sm leading-6 text-muted-foreground">
        <div>Kaedah: {diagnostic.method}. Model: {diagnostic.provider ?? "tiada"}. Peringkat: {diagnostic.stage}.</div>
        <div>Halaman: {diagnostic.pageCount ?? "tiada"}. Dibaca: {diagnostic.pagesRead}. Gagal: {diagnostic.pagesFailed}. Teks pilihan: {diagnostic.selectableText ? "ya" : "tidak"}.</div>
        <div>Panjang teks: {diagnostic.textLength}. Calon: {diagnostic.candidates}. Perlu semakan: {diagnostic.needsReview}. Masa: {diagnostic.durationMs} ms.</div>
        <div>Ralat: {diagnostic.errorCode ?? "tiada"}{diagnostic.errorMessage ? ` — ${diagnostic.errorMessage}` : ""}.</div>
        <div>Dokumen: {diagnostic.documentId ?? "belum dipaut"}. Percubaan: {diagnostic.attemptId}</div>
      </dl>
    </details>
  )
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
