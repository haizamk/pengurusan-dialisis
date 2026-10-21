import { normaliseLabUnit, parseLabText, validateLabFile, type ExtractionStatus } from "@/lib/lab-parse"
import { PATIENT_STATUS, type ExtractionDiagnostic } from "@/lib/pdf-text"
import { getSupabase } from "@/lib/supabase"

export type { ExtractionStatus }

export type ReviewStatus = "perlu_semakan" | "disahkan"
export type ProcessingStatus = "membaca" | "selesai" | "gagal"
export type ObservationSource = "ekstrak" | "pesakit"
export type ObservationStatus = "perlu_semakan" | "disahkan"

export type LabDocument = {
  id: string
  patientId: string
  reportDate: string | null
  uploadedAt: string
  fileName: string
  mime: string
  byteSize: number
  sha256: string
  storagePath: string | null
  processingStatus: ProcessingStatus
  extractionStatus: ExtractionStatus
  reviewStatus: ReviewStatus
  note: string
  diagnostic: ExtractionDiagnostic | null
}

export type LabObservation = {
  id: string
  patientId: string
  documentId: string | null
  takenOn: string
  originalName: string
  standardKey: string | null
  value: number | null
  unit: string | null
  refText: string | null
  abnormalFlag: string | null
  specimen: string | null
  uncertain: boolean
  snippet: string
  status: ObservationStatus
  source: ObservationSource
  createdAt: string
  updatedAt: string
}

export type LabAudit = {
  id: string
  observationId: string
  patientId: string
  previousValue: string
  previousUnit: string | null
  nextValue: string
  nextUnit: string | null
  changedAt: string
}

export type StoredAnalysis = {
  id: string
  patientId: string
  documentId: string | null
  createdAt: string
  version: string
  summary: string
  safety: string[]
  parameterKeys: string[]
  body: unknown
}

export type ArchiveData = {
  documents: LabDocument[]
  observations: LabObservation[]
  audits: LabAudit[]
  analyses: StoredAnalysis[]
}

export type LabFile = { bytes: Uint8Array; mime: string }

export type ArchiveStore = {
  read: () => ArchiveData
  write: (data: ArchiveData) => void
  putFile: (id: string, file: LabFile) => Promise<void>
  getFile: (id: string) => Promise<LabFile | null>
}

const LOCAL_KEY = "ppd.lab-archive.v1"

export function emptyArchive(): ArchiveData {
  return { documents: [], observations: [], audits: [], analyses: [] }
}

export function memoryArchiveStore(): ArchiveStore {
  let data = emptyArchive()
  const files = new Map<string, LabFile>()
  return {
    read: () => structuredClone(data),
    write: (next) => {
      data = structuredClone(next)
    },
    putFile: async (id, file) => {
      files.set(id, { bytes: new Uint8Array(file.bytes), mime: file.mime })
    },
    getFile: async (id) => {
      const file = files.get(id)
      return file ? { bytes: new Uint8Array(file.bytes), mime: file.mime } : null
    },
  }
}

export function recordsForPatient<T extends { patientId: string }>(rows: T[], patientId: string) {
  return rows.filter((row) => row.patientId === patientId)
}

export async function sha256Hex(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes)
  const digest = await crypto.subtle.digest("SHA-256", copy)
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("")
}

export function draftFromText(input: {
  id: string
  patientId: string
  fileName: string
  mime: string
  byteSize: number
  sha256: string
  text: string
  uploadedAt: string
  note: string
  extractionStatus: ExtractionStatus
  processingStatus?: ProcessingStatus
  diagnostic?: ExtractionDiagnostic | null
}) {
  const parsed = input.text.trim() ? parseLabText(input.text) : null
  const parsedRows = parsed?.observations ?? []
  let extractionStatus = input.extractionStatus
  let note = input.note
  if (input.processingStatus === "membaca") {
    extractionStatus = input.extractionStatus
  } else if (parsedRows.length > 0) {
    extractionStatus = parsedRows.some((item) => item.uncertain) || parsed?.dateUncertain ? "separa" : "terbaca"
    note = PATIENT_STATUS.found
    if (parsed?.dateUncertain) note = `${note} Tarikh laporan tidak pasti, jadi ia perlu diisi semasa semakan.`
  } else if (input.text.trim()) {
    extractionStatus = "gagal"
    note = `${PATIENT_STATUS.failed} Teks dijumpai tetapi tiada keputusan makmal yang jelas.`
  } else if (extractionStatus === "tiada_teks") {
    extractionStatus = "gagal"
    note = input.note || PATIENT_STATUS.failed
  }
  const diagnostic = input.diagnostic ? { ...input.diagnostic, documentId: input.id } : null
  if (diagnostic && input.processingStatus !== "membaca") {
    diagnostic.candidates = parsedRows.length
    diagnostic.needsReview = parsedRows.filter((item) => item.uncertain || !parsed?.reportDate).length
    diagnostic.stage = parsedRows.length > 0 ? "selesai" : "gagal"
  }
  const document: LabDocument = {
    id: input.id,
    patientId: input.patientId,
    reportDate: input.processingStatus === "membaca" ? null : parsed?.reportDate ?? null,
    uploadedAt: input.uploadedAt,
    fileName: input.fileName,
    mime: input.mime,
    byteSize: input.byteSize,
    sha256: input.sha256,
    storagePath: null,
    extractionStatus,
    reviewStatus: "perlu_semakan",
    note,
    diagnostic,
    processingStatus: input.processingStatus === "membaca" ? "membaca" : parsedRows.length > 0 ? "selesai" : "gagal",
  }
  const observations: LabObservation[] = input.processingStatus === "membaca" ? [] : (parsed?.observations ?? []).map((item) => ({
    id: crypto.randomUUID(),
    patientId: input.patientId,
    documentId: input.id,
    takenOn: parsed?.reportDate ?? "",
    originalName: item.originalName,
    standardKey: item.standardKey,
    value: item.value,
    unit: item.unit,
    refText: item.refText,
    abnormalFlag: item.abnormalFlag,
    specimen: null,
    uncertain: item.uncertain || !parsed?.reportDate,
    snippet: item.snippet,
    status: "perlu_semakan",
    source: "ekstrak",
    createdAt: input.uploadedAt,
    updatedAt: input.uploadedAt,
  }))
  return { document, observations }
}

export function applyConfirmation(
  row: LabObservation,
  input: {
    value: number
    unit: string
    takenOn: string
    standardKey: string | null
    originalName: string
    acceptUnclear: boolean
    updatedAt: string
  },
): { row: LabObservation } | { error: string } {
  if (!input.takenOn) return { error: "Tarikh ujian perlu diisi sebelum pengesahan." }
  if (!Number.isFinite(input.value)) return { error: "Nilai tidak sah." }
  if (!input.unit.trim()) return { error: "Unit perlu diisi." }
  if (!input.originalName.trim()) return { error: "Nama ujian perlu diisi." }
  if (row.uncertain && !input.acceptUnclear) return { error: "Teks ini tidak pasti. Tandakan bahawa anda telah menyemaknya." }
  return {
    row: {
      ...row,
      value: input.value,
      unit: normaliseLabUnit(input.unit),
      takenOn: input.takenOn,
      standardKey: input.standardKey,
      originalName: input.originalName.trim(),
      uncertain: false,
      status: "disahkan",
      source: row.source === "ekstrak" ? "ekstrak" : "pesakit",
      updatedAt: input.updatedAt,
    },
  }
}

export function auditChange(previous: LabObservation, next: LabObservation, changedAt: string): LabAudit | null {
  if (previous.value === next.value && previous.unit === next.unit && previous.takenOn === next.takenOn) return null
  return {
    id: crypto.randomUUID(),
    observationId: next.id,
    patientId: next.patientId,
    previousValue: previous.value == null ? "" : String(previous.value),
    previousUnit: previous.unit,
    nextValue: next.value == null ? "" : String(next.value),
    nextUnit: next.unit,
    changedAt,
  }
}

export function withoutDuplicateConfirmed(existing: LabObservation[], incoming: LabObservation[]) {
  const saved: LabObservation[] = []
  const skipped: LabObservation[] = []
  const pool = [...existing]
  for (const item of incoming) {
    const duplicate = pool.some((row) =>
      row.status === "disahkan" &&
      item.status === "disahkan" &&
      row.patientId === item.patientId &&
      row.standardKey === item.standardKey &&
      row.standardKey != null &&
      row.takenOn === item.takenOn &&
      row.unit === item.unit &&
      row.value === item.value,
    )
    if (duplicate) skipped.push(item)
    else {
      saved.push(item)
      pool.push(item)
    }
  }
  return { saved, skipped }
}

export function applyReextraction(
  data: ArchiveData,
  documentId: string,
  next: { document: LabDocument; observations: LabObservation[] },
) {
  const kept = data.observations.filter((row) => row.documentId !== documentId || row.status === "disahkan")
  const additions = next.observations.filter((item) => !kept.some((row) =>
    row.status === "disahkan" &&
    row.patientId === item.patientId &&
    row.standardKey != null &&
    row.standardKey === item.standardKey &&
    row.takenOn === item.takenOn &&
    row.unit === item.unit &&
    row.value === item.value
  ))
  const observations = [...kept, ...additions]
  return {
    ...data,
    documents: data.documents.map((document) => document.id === documentId ? { ...next.document, storagePath: document.storagePath ?? next.document.storagePath } : document),
    observations,
  }
}

export function replacePatientRecords(
  data: ArchiveData,
  patientId: string,
  slice: Pick<ArchiveData, "documents" | "observations" | "analyses"> & { audits?: LabAudit[] },
) {
  return {
    documents: [...data.documents.filter((item) => item.patientId !== patientId), ...slice.documents],
    observations: [...data.observations.filter((item) => item.patientId !== patientId), ...slice.observations],
    analyses: [...data.analyses.filter((item) => item.patientId !== patientId), ...slice.analyses],
    audits: [
      ...data.audits.filter((item) => item.patientId !== patientId),
      ...(slice.audits ?? data.audits.filter((item) => item.patientId === patientId)),
    ],
  }
}

export async function importLabDocument(
  store: ArchiveStore,
  input: {
    patientId: string
    fileName: string
    mime: string
    bytes: Uint8Array
    text: string
    note: string
    extractionStatus: ExtractionStatus
    processingStatus?: ProcessingStatus
    diagnostic?: ExtractionDiagnostic | null
    allowDuplicate: boolean
    uploadedAt: string
    id?: string
  },
) {
  const problem = validateLabFile({ name: input.fileName, type: input.mime, size: input.bytes.length }, input.bytes)
  if (problem) return { error: problem as string, duplicate: null, document: null, observations: [] as LabObservation[] }
  const sha256 = await sha256Hex(input.bytes)
  const current = store.read()
  const duplicate = current.documents.find((item) => item.patientId === input.patientId && item.sha256 === sha256) ?? null
  if (duplicate && !input.allowDuplicate) {
    return { error: null, duplicate, document: null, observations: [] as LabObservation[] }
  }
  const draft = draftFromText({
    id: input.id ?? crypto.randomUUID(),
    patientId: input.patientId,
    fileName: input.fileName,
    mime: input.mime,
    byteSize: input.bytes.length,
    sha256,
    text: input.text,
    uploadedAt: input.uploadedAt,
    note: input.note,
    extractionStatus: input.extractionStatus,
    processingStatus: input.processingStatus,
    diagnostic: input.diagnostic ?? null,
  })
  store.write({
    ...current,
    documents: [...current.documents, draft.document],
    observations: [...current.observations, ...draft.observations],
  })
  await store.putFile(draft.document.id, { bytes: input.bytes, mime: input.mime })
  return { error: null, duplicate: null, document: draft.document, observations: draft.observations }
}

function browserArchiveStore(): ArchiveStore {
  return {
    read: () => {
      if (typeof window === "undefined") return emptyArchive()
      try {
        const raw = window.localStorage.getItem(LOCAL_KEY)
        if (!raw) return emptyArchive()
        const parsed = JSON.parse(raw) as Partial<ArchiveData>
        return {
          documents: parsed.documents ?? [],
          observations: parsed.observations ?? [],
          audits: parsed.audits ?? [],
          analyses: parsed.analyses ?? [],
        }
      } catch {
        return emptyArchive()
      }
    },
    write: (data) => {
      window.localStorage.setItem(LOCAL_KEY, JSON.stringify(data))
    },
    putFile: (id, file) => putIndexedFile(id, file),
    getFile: (id) => getIndexedFile(id),
  }
}

function openFileDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("ppd-lab-files", 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("files")) request.result.createObjectStore("files")
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function putIndexedFile(id: string, file: LabFile) {
  const db = await openFileDb()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("files", "readwrite")
    transaction.objectStore("files").put({ bytes: file.bytes, mime: file.mime }, id)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
  db.close()
}

async function getIndexedFile(id: string) {
  const db = await openFileDb()
  const record = await new Promise<{ bytes: Uint8Array; mime: string } | undefined>((resolve, reject) => {
    const transaction = db.transaction("files", "readonly")
    const request = transaction.objectStore("files").get(id)
    request.onsuccess = () => resolve(request.result as { bytes: Uint8Array; mime: string } | undefined)
    request.onerror = () => reject(request.error)
  })
  db.close()
  return record ? { bytes: new Uint8Array(record.bytes), mime: record.mime } : null
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ""
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  }
  return btoa(binary)
}

function base64ToBytes(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function documentRow(document: LabDocument, contentBase64?: string | null, includeDiagnostic = true) {
  return {
    id: document.id,
    patient_id: document.patientId,
    report_date: document.reportDate,
    uploaded_at: document.uploadedAt,
    file_name: document.fileName,
    mime: document.mime,
    byte_size: document.byteSize,
    sha256: document.sha256,
    storage_path: document.storagePath,
    ...(contentBase64 !== undefined ? { content_base64: contentBase64 } : {}),
    processing_status: document.processingStatus,
    extraction_status: document.extractionStatus,
    review_status: document.reviewStatus,
    note: document.note,
    ...(includeDiagnostic ? { diagnostic: document.diagnostic } : {}),
  }
}

function observationRow(row: LabObservation) {
  return {
    id: row.id,
    patient_id: row.patientId,
    document_id: row.documentId,
    taken_on: row.takenOn || null,
    original_name: row.originalName,
    standard_key: row.standardKey,
    value_numeric: row.value,
    unit: row.unit,
    ref_text: row.refText,
    abnormal_flag: row.abnormalFlag,
    specimen: row.specimen,
    uncertain: row.uncertain,
    snippet: row.snippet,
    status: row.status,
    source: row.source,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
}

async function removeStaleObservations(patientId: string, keepIds: string[]) {
  const supabase = getSupabase()
  if (!supabase) return null
  const existing = await supabase.from("lab_observations").select("id").eq("patient_id", patientId)
  if (existing.error) return null
  const keep = new Set(keepIds)
  const stale = (existing.data ?? []).map((row) => String(row.id)).filter((id) => !keep.has(id))
  if (stale.length === 0) return null
  const removed = await supabase.from("lab_observations").delete().eq("patient_id", patientId).in("id", stale)
  return removed.error ? "Keputusan lama tidak dapat dibuang dari awan. Salinan pelayar sudah dikemas kini." : null
}

function missingTable(error: { message?: string; code?: string } | null) {
  const message = error?.message?.toLowerCase() ?? ""
  return error?.code === "42P01" || error?.code === "PGRST205" || message.includes("does not exist") || message.includes("schema cache") || message.includes("could not find")
}

const SQL_NOTE = "Jadual laporan belum dipasang pada Supabase. Fail kekal pada pelayar ini. Jalankan supabase/darah.sql sekali. Rekod lama tidak dipadam."

export async function loadLabArchive(patientId: string) {
  const store = browserArchiveStore()
  const local = store.read()
  const supabase = getSupabase()
  if (!supabase) {
    return { data: filterArchive(local, patientId), cloudNote: "Supabase tidak dikonfigurkan. Laporan disimpan pada pelayar ini sahaja." }
  }
  const documentColumns = "id, patient_id, report_date, uploaded_at, file_name, mime, byte_size, sha256, storage_path, processing_status, extraction_status, review_status, note"
  type DocumentQuery = { data: Record<string, unknown>[] | null; error: { message: string; code?: string } | null }
  let documents = await supabase.from("health_documents").select(`${documentColumns}, diagnostic`).eq("patient_id", patientId) as DocumentQuery
  if (documents.error && documents.error.message.toLowerCase().includes("diagnostic")) {
    documents = await supabase.from("health_documents").select(documentColumns).eq("patient_id", patientId) as DocumentQuery
  }
  if (documents.error) {
    return { data: filterArchive(local, patientId), cloudNote: missingTable(documents.error) ? SQL_NOTE : "Laporan awan tidak dapat dibaca. Salinan pelayar masih digunakan." }
  }
  const observations = await supabase.from("lab_observations").select("*").eq("patient_id", patientId)
  const analyses = await supabase.from("lab_analyses").select("*").eq("patient_id", patientId)
  const audits = await supabase.from("lab_observation_audits").select("*").eq("patient_id", patientId)
  if (observations.error || analyses.error || audits.error) {
    return { data: filterArchive(local, patientId), cloudNote: "Sebahagian jadual laporan belum sedia. Salinan pelayar masih digunakan." }
  }
  const remote = remoteArchive(documents.data ?? [], observations.data ?? [], analyses.data ?? [], audits.data ?? [])
  const merged = mergeRemote(local, patientId, remote)
  store.write(merged)
  return { data: filterArchive(merged, patientId), cloudNote: null }
}

function filterArchive(data: ArchiveData, patientId: string): ArchiveData {
  return {
    documents: recordsForPatient(data.documents, patientId),
    observations: recordsForPatient(data.observations, patientId),
    audits: recordsForPatient(data.audits, patientId),
    analyses: recordsForPatient(data.analyses, patientId),
  }
}

function mergeRemote(local: ArchiveData, patientId: string, remote: ArchiveData) {
  const keep = <T extends { id: string; patientId: string }>(localRows: T[], remoteRows: T[], pick?: (localRow: T, remoteRow: T) => T) => {
    const localById = new Map(localRows.filter((row) => row.patientId === patientId).map((row) => [row.id, row]))
    const seen = new Set<string>()
    const merged = remoteRows.map((remoteRow) => {
      seen.add(remoteRow.id)
      const localRow = localById.get(remoteRow.id)
      return localRow && pick ? pick(localRow, remoteRow) : remoteRow
    })
    return [...merged, ...localRows.filter((row) => row.patientId === patientId && !seen.has(row.id))]
  }
  const observations = keep(local.observations, remote.observations, (localRow, remoteRow) =>
    localRow.updatedAt >= remoteRow.updatedAt ? localRow : remoteRow,
  )
  const documents = keep(local.documents, remote.documents, (localRow, remoteRow) => ({
    ...localRow,
    ...remoteRow,
    storagePath: remoteRow.storagePath ?? localRow.storagePath,
    diagnostic: remoteRow.diagnostic ?? localRow.diagnostic ?? null,
  })).map((document) => {
    const rows = observations.filter((item) => item.documentId === document.id)
    if (rows.length === 0) return document
    return { ...document, reviewStatus: rows.every((item) => item.status === "disahkan") ? "disahkan" as const : "perlu_semakan" as const }
  })
  const knownAudits = new Set(local.audits.map((item) => item.id))
  return replacePatientRecords(local, patientId, {
    documents,
    observations,
    analyses: keep(local.analyses, remote.analyses),
    audits: [
      ...local.audits.filter((item) => item.patientId === patientId),
      ...remote.audits.filter((item) => !knownAudits.has(item.id)),
    ],
  })
}

function diagnosticFrom(value: unknown): ExtractionDiagnostic | null {
  if (!value || typeof value !== "object") return null
  const row = value as Partial<ExtractionDiagnostic>
  const stage = row.stage
  const method = row.method
  const stages = new Set(["validasi", "teks", "ocr", "parse", "selesai", "gagal"])
  const methods = new Set(["pdf-teks", "ocr", "pdf-teks+ocr", "tiada"])
  if (typeof row.attemptId !== "string" || !stage || !stages.has(stage) || !method || !methods.has(method)) return null
  return {
    documentId: typeof row.documentId === "string" ? row.documentId : null,
    attemptId: row.attemptId,
    stage,
    method,
    pageCount: typeof row.pageCount === "number" ? row.pageCount : null,
    pagesRead: typeof row.pagesRead === "number" ? row.pagesRead : 0,
    pagesFailed: typeof row.pagesFailed === "number" ? row.pagesFailed : 0,
    selectableText: Boolean(row.selectableText),
    textLength: typeof row.textLength === "number" ? row.textLength : 0,
    candidates: typeof row.candidates === "number" ? row.candidates : 0,
    needsReview: typeof row.needsReview === "number" ? row.needsReview : 0,
    durationMs: typeof row.durationMs === "number" ? row.durationMs : 0,
    errorCode: typeof row.errorCode === "string" ? row.errorCode.slice(0, 80) : null,
    errorMessage: typeof row.errorMessage === "string" ? row.errorMessage.slice(0, 180) : null,
  }
}

function remoteArchive(documents: Record<string, unknown>[], observations: Record<string, unknown>[], analyses: Record<string, unknown>[], audits: Record<string, unknown>[]): ArchiveData {
  return {
    documents: documents.map((row) => ({
      id: String(row.id),
      patientId: String(row.patient_id),
      reportDate: row.report_date ? String(row.report_date) : null,
      uploadedAt: String(row.uploaded_at),
      fileName: String(row.file_name),
      mime: String(row.mime),
      byteSize: Number(row.byte_size),
      sha256: String(row.sha256),
      storagePath: row.storage_path ? String(row.storage_path) : null,
      processingStatus: row.processing_status === "membaca" || row.processing_status === "gagal" ? row.processing_status : "selesai",
      extractionStatus: (row.extraction_status as ExtractionStatus) ?? "gagal",
      reviewStatus: row.review_status === "disahkan" ? "disahkan" : "perlu_semakan",
      note: String(row.note ?? ""),
      diagnostic: diagnosticFrom(row.diagnostic),
    })),
    observations: observations.map((row) => ({
      id: String(row.id),
      patientId: String(row.patient_id),
      documentId: row.document_id ? String(row.document_id) : null,
      takenOn: row.taken_on ? String(row.taken_on) : "",
      originalName: String(row.original_name),
      standardKey: row.standard_key ? String(row.standard_key) : null,
      value: row.value_numeric == null ? null : Number(row.value_numeric),
      unit: row.unit ? String(row.unit) : null,
      refText: row.ref_text ? String(row.ref_text) : null,
      abnormalFlag: row.abnormal_flag ? String(row.abnormal_flag) : null,
      specimen: row.specimen ? String(row.specimen) : null,
      uncertain: Boolean(row.uncertain),
      snippet: String(row.snippet ?? ""),
      status: row.status === "disahkan" ? "disahkan" : "perlu_semakan",
      source: row.source === "pesakit" ? "pesakit" : "ekstrak",
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    })),
    analyses: analyses.map((row) => ({
      id: String(row.id),
      patientId: String(row.patient_id),
      documentId: row.document_id ? String(row.document_id) : null,
      createdAt: String(row.created_at),
      version: String(row.version),
      summary: String(row.summary),
      safety: Array.isArray(row.safety) ? row.safety.map(String) : [],
      parameterKeys: Array.isArray(row.parameter_keys) ? row.parameter_keys.map(String) : [],
      body: row.body,
    })),
    audits: audits.map((row) => ({
      id: String(row.id),
      observationId: String(row.observation_id),
      patientId: String(row.patient_id),
      previousValue: String(row.previous_value ?? ""),
      previousUnit: row.previous_unit ? String(row.previous_unit) : null,
      nextValue: String(row.next_value ?? ""),
      nextUnit: row.next_unit ? String(row.next_unit) : null,
      changedAt: String(row.changed_at),
    })),
  }
}

export async function saveLabImport(input: {
  patientId: string
  fileName: string
  mime: string
  bytes: Uint8Array
  text: string
  note: string
  extractionStatus: ExtractionStatus
  processingStatus?: ProcessingStatus
  diagnostic?: ExtractionDiagnostic | null
  allowDuplicate: boolean
}) {
  const uploadedAt = new Date().toISOString()
  const result = await importLabDocument(browserArchiveStore(), { ...input, uploadedAt })
  if (!result.document) return { ...result, cloudNote: null as string | null }
  const cloudNote = await pushNewDocument(result.document, result.observations, input.bytes)
  return { ...result, cloudNote }
}

async function pushNewDocument(document: LabDocument, observations: LabObservation[], bytes: Uint8Array) {
  const supabase = getSupabase()
  if (!supabase) return "Supabase tidak dikonfigurkan. Fail disimpan pada pelayar ini."
  const safeName = document.fileName.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80)
  const storagePath = `${document.patientId}/${document.id}/${safeName}`
  const upload = await supabase.storage.from("lab-reports").upload(storagePath, new Blob([new Uint8Array(bytes)], { type: document.mime }), {
    contentType: document.mime,
    upsert: false,
  })
  const stored = upload.error ? null : storagePath
  if (stored) {
    document.storagePath = stored
    const local = browserArchiveStore().read()
    browserArchiveStore().write({
      ...local,
      documents: local.documents.map((item) => (item.id === document.id ? { ...item, storagePath: stored } : item)),
    })
  }
  const content = stored ? null : bytesToBase64(bytes)
  let inserted = await supabase.from("health_documents").upsert(documentRow(document, content))
  if (inserted.error && inserted.error.message.toLowerCase().includes("diagnostic")) {
    inserted = await supabase.from("health_documents").upsert(documentRow(document, content, false))
  }
  if (inserted.error) return missingTable(inserted.error) ? SQL_NOTE : "Fail tempatan disimpan, tetapi salinan awan gagal."
  if (observations.length > 0) {
    const rows = await supabase.from("lab_observations").upsert(observations.map(observationRow))
    if (rows.error) return "Laporan disimpan, tetapi keputusan ekstrak belum masuk ke awan. Ia kekal untuk semakan pada pelayar ini."
  }
  return null
}

export async function savePatientArchive(patientId: string, slice: ArchiveData) {
  const store = browserArchiveStore()
  store.write(replacePatientRecords(store.read(), patientId, slice))
  const supabase = getSupabase()
  if (!supabase) return "Perubahan disimpan pada pelayar ini. Supabase tidak dikonfigurkan."
  let documents = await supabase.from("health_documents").upsert(slice.documents.map((item) => documentRow(item)))
  if (documents.error && documents.error.message.toLowerCase().includes("diagnostic")) {
    documents = await supabase.from("health_documents").upsert(slice.documents.map((item) => documentRow(item, undefined, false)))
  }
  if (documents.error) return missingTable(documents.error) ? SQL_NOTE : "Perubahan tempatan disimpan. Salinan awan gagal."
  if (slice.observations.length > 0) {
    const observations = await supabase.from("lab_observations").upsert(slice.observations.map(observationRow))
    if (observations.error) return "Keputusan belum dapat disimpan ke awan."
  }
  const staleNote = await removeStaleObservations(patientId, slice.observations.map((item) => item.id))
  if (staleNote) return staleNote
  if (slice.analyses.length > 0) {
    const analyses = await supabase.from("lab_analyses").upsert(slice.analyses.map((item) => ({
      id: item.id,
      patient_id: item.patientId,
      document_id: item.documentId,
      created_at: item.createdAt,
      version: item.version,
      summary: item.summary,
      safety: item.safety,
      parameter_keys: item.parameterKeys,
      body: item.body,
    })), { onConflict: "id", ignoreDuplicates: true })
    if (analyses.error) return "Analisis tempatan disimpan. Salinan awan gagal."
  }
  if (slice.audits.length > 0) {
    await supabase.from("lab_observation_audits").upsert(slice.audits.map((item) => ({
      id: item.id,
      observation_id: item.observationId,
      patient_id: item.patientId,
      previous_value: item.previousValue,
      previous_unit: item.previousUnit,
      next_value: item.nextValue,
      next_unit: item.nextUnit,
      changed_at: item.changedAt,
    })), { onConflict: "id", ignoreDuplicates: true })
  }
  return null
}

export async function openLabDocument(document: LabDocument) {
  const local = await browserArchiveStore().getFile(document.id)
  if (local) return new Blob([new Uint8Array(local.bytes)], { type: local.mime })
  const supabase = getSupabase()
  if (!supabase) return null
  if (document.storagePath) {
    const downloaded = await supabase.storage.from("lab-reports").download(document.storagePath)
    if (!downloaded.error && downloaded.data) return downloaded.data
  }
  const row = await supabase.from("health_documents").select("content_base64, mime").eq("id", document.id).eq("patient_id", document.patientId).maybeSingle()
  if (row.error || !row.data?.content_base64) return null
  return new Blob([base64ToBytes(String(row.data.content_base64))], { type: String(row.data.mime || document.mime) })
}

export const BLOOD_RECORD_FIELDS = [
  { key: "hemoglobin", field: "hemoglobin", unit: "g/dl" },
  { key: "potassium", field: "potassium", unit: "mmol/l" },
  { key: "phosphate", field: "phosphate", unit: "mmol/l" },
  { key: "calcium", field: "calcium", unit: "mmol/l" },
  { key: "sodium", field: "sodium", unit: "mmol/l" },
  { key: "albumin", field: "albumin", unit: "g/l" },
  { key: "creatinine", field: "creatinine", unit: "µmol/l" },
] as const
