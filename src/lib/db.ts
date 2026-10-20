import { createSeed } from "@/lib/seed"
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase"
import type {
  BloodRecord,
  Centre,
  Database,
  DataSource,
  DialysisSession,
  Patient,
  StaffProfile,
  StaffRole,
} from "@/lib/types"

const STORAGE_KEY = "ppd.v1"

type CentreRow = {
  id: string
  name: string
  city: string
  state: string
  phone: string
}

type PatientRow = {
  id: string
  full_name: string
  mrn: string
  sex: Patient["sex"]
  date_of_birth: string
  phone: string
  centre_id: string
  dry_weight_kg: number
  access_type: Patient["accessType"]
  access_site: string
  schedule: string
  diagnosis: string
  notes: string
  active: boolean
}

type SessionRow = {
  id: string
  patient_id: string
  centre_id: string
  session_date: string
  arrival_weight_kg: number
  post_weight_kg: number | null
  dry_weight_kg: number
  duration_min: number
  systolic_pre: number | null
  diastolic_pre: number | null
  systolic_post: number | null
  diastolic_post: number | null
  notes: string
  created_at: string
}

type LabRow = {
  id: string
  patient_id: string
  taken_on: string
  hemoglobin: number | null
  urea_pre: number | null
  urea_post: number | null
  creatinine: number | null
  potassium: number | null
  phosphate: number | null
  calcium: number | null
  sodium: number | null
  albumin: number | null
  notes: string
  created_at: string
}

export type LoadResult = {
  source: DataSource
  data: Database
  error: string | null
}

function centreToRow(centre: Centre): CentreRow {
  return { ...centre }
}

function centreFromRow(row: CentreRow): Centre {
  return { ...row }
}

function patientToRow(patient: Patient): PatientRow {
  return {
    id: patient.id,
    full_name: patient.fullName,
    mrn: patient.mrn,
    sex: patient.sex,
    date_of_birth: patient.dateOfBirth,
    phone: patient.phone,
    centre_id: patient.centreId,
    dry_weight_kg: patient.dryWeightKg,
    access_type: patient.accessType,
    access_site: patient.accessSite,
    schedule: patient.schedule,
    diagnosis: patient.diagnosis,
    notes: patient.notes,
    active: patient.active,
  }
}

function patientFromRow(row: PatientRow): Patient {
  return {
    id: row.id,
    fullName: row.full_name,
    mrn: row.mrn,
    sex: row.sex,
    dateOfBirth: row.date_of_birth,
    phone: row.phone,
    centreId: row.centre_id,
    dryWeightKg: Number(row.dry_weight_kg),
    accessType: row.access_type,
    accessSite: row.access_site,
    schedule: row.schedule,
    diagnosis: row.diagnosis,
    notes: row.notes,
    active: row.active,
  }
}

function sessionToRow(session: DialysisSession): SessionRow {
  return {
    id: session.id,
    patient_id: session.patientId,
    centre_id: session.centreId,
    session_date: session.sessionDate,
    arrival_weight_kg: session.arrivalWeightKg,
    post_weight_kg: session.postWeightKg,
    dry_weight_kg: session.dryWeightKg,
    duration_min: session.durationMin,
    systolic_pre: session.systolicPre,
    diastolic_pre: session.diastolicPre,
    systolic_post: session.systolicPost,
    diastolic_post: session.diastolicPost,
    notes: session.notes,
    created_at: session.createdAt,
  }
}

function sessionFromRow(row: SessionRow): DialysisSession {
  return {
    id: row.id,
    patientId: row.patient_id,
    centreId: row.centre_id,
    sessionDate: row.session_date,
    arrivalWeightKg: Number(row.arrival_weight_kg),
    postWeightKg: row.post_weight_kg == null ? null : Number(row.post_weight_kg),
    dryWeightKg: Number(row.dry_weight_kg),
    durationMin: row.duration_min,
    systolicPre: row.systolic_pre,
    diastolicPre: row.diastolic_pre,
    systolicPost: row.systolic_post,
    diastolicPost: row.diastolic_post,
    notes: row.notes,
    createdAt: row.created_at,
  }
}

function labToRow(lab: BloodRecord): LabRow {
  return {
    id: lab.id,
    patient_id: lab.patientId,
    taken_on: lab.takenOn,
    hemoglobin: lab.hemoglobin,
    urea_pre: lab.ureaPre,
    urea_post: lab.ureaPost,
    creatinine: lab.creatinine,
    potassium: lab.potassium,
    phosphate: lab.phosphate,
    calcium: lab.calcium,
    sodium: lab.sodium,
    albumin: lab.albumin,
    notes: lab.notes,
    created_at: lab.createdAt,
  }
}

function labFromRow(row: LabRow): BloodRecord {
  return {
    id: row.id,
    patientId: row.patient_id,
    takenOn: row.taken_on,
    hemoglobin: row.hemoglobin == null ? null : Number(row.hemoglobin),
    ureaPre: row.urea_pre == null ? null : Number(row.urea_pre),
    ureaPost: row.urea_post == null ? null : Number(row.urea_post),
    creatinine: row.creatinine == null ? null : Number(row.creatinine),
    potassium: row.potassium == null ? null : Number(row.potassium),
    phosphate: row.phosphate == null ? null : Number(row.phosphate),
    calcium: row.calcium == null ? null : Number(row.calcium),
    sodium: row.sodium == null ? null : Number(row.sodium),
    albumin: row.albumin == null ? null : Number(row.albumin),
    notes: row.notes,
    createdAt: row.created_at,
  }
}

export function readLocal(): Database | null {
  if (typeof window === "undefined") return null
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Database
    if (!parsed.centres || !parsed.patients || !parsed.sessions || !parsed.labs) return null
    return parsed
  } catch {
    return null
  }
}

export function writeLocal(data: Database) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function clearLocal() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(STORAGE_KEY)
}

async function fetchRemote(): Promise<Database> {
  const supabase = getSupabase()
  if (!supabase) throw new Error("Supabase tidak dikonfigurasi.")
  const [centres, patients, sessions, labs] = await Promise.all([
    supabase.from("centres").select("*").order("name"),
    supabase.from("patients").select("*").order("full_name"),
    supabase.from("dialysis_sessions").select("*"),
    supabase.from("blood_records").select("*"),
  ])
  if (centres.error) throw new Error(centres.error.message)
  if (patients.error) throw new Error(patients.error.message)
  if (sessions.error) throw new Error(sessions.error.message)
  if (labs.error) throw new Error(labs.error.message)
  return {
    centres: (centres.data as CentreRow[]).map(centreFromRow),
    patients: (patients.data as PatientRow[]).map(patientFromRow),
    sessions: (sessions.data as SessionRow[]).map(sessionFromRow),
    labs: (labs.data as LabRow[]).map(labFromRow),
  }
}

const emptyDatabase: Database = { centres: [], patients: [], sessions: [], labs: [] }

export function explainSupabaseError(message: string) {
  const lower = message.toLowerCase()
  if (lower.includes("staff") && (lower.includes("schema cache") || lower.includes("does not exist") || lower.includes("relation"))) {
    return "Jadual staf belum wujud. Jalankan supabase/access.sql dalam SQL Editor, kemudian muat semula."
  }
  return message
}

export async function fetchStaffProfile(userId: string, email: string): Promise<StaffProfile | null> {
  const supabase = getSupabase()
  if (!supabase) return null
  const staff = await supabase.from("staff").select("full_name, role").eq("user_id", userId).maybeSingle()
  if (staff.error) throw new Error(explainSupabaseError(staff.error.message))
  if (!staff.data) return null
  const role = staff.data.role === "pentadbir" ? "pentadbir" : "staf"
  const links = await supabase.from("staff_centres").select("centre_id").eq("user_id", userId)
  if (links.error) throw new Error(explainSupabaseError(links.error.message))
  return {
    userId,
    email,
    fullName: String(staff.data.full_name),
    role: role satisfies StaffRole,
    centreIds: (links.data ?? []).map((row) => String(row.centre_id)),
  }
}

export async function loadDatabase(): Promise<LoadResult> {
  if (isSupabaseConfigured()) {
    try {
      const data = await fetchRemote()
      return { source: "supabase", data, error: null }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal membaca Supabase."
      return {
        source: "supabase",
        data: emptyDatabase,
        error: explainSupabaseError(message),
      }
    }
  }
  return { source: "local", data: readLocal() ?? createSeed(), error: null }
}

async function requireWrite(table: string, action: "insert" | "update" | "delete" | "upsert", run: () => PromiseLike<{ error: { message: string } | null }>) {
  const result = await run()
  if (result.error) {
    throw new Error(`${table}: ${result.error.message}`)
  }
}

export async function persistCentre(centre: Centre, mode: "insert" | "update") {
  const supabase = getSupabase()
  if (!supabase) return
  if (mode === "insert") {
    await requireWrite("centres", mode, () => supabase.from("centres").insert(centreToRow(centre)))
  } else {
    await requireWrite("centres", mode, () =>
      supabase.from("centres").update(centreToRow(centre)).eq("id", centre.id),
    )
  }
}

export async function persistPatient(patient: Patient, mode: "insert" | "update") {
  const supabase = getSupabase()
  if (!supabase) return
  const row = patientToRow(patient)
  if (mode === "insert") {
    await requireWrite("patients", mode, () => supabase.from("patients").insert(row))
  } else {
    await requireWrite("patients", mode, () => supabase.from("patients").update(row).eq("id", patient.id))
  }
}

export async function persistSession(session: DialysisSession, mode: "insert" | "update") {
  const supabase = getSupabase()
  if (!supabase) return
  const row = sessionToRow(session)
  if (mode === "insert") {
    await requireWrite("dialysis_sessions", mode, () => supabase.from("dialysis_sessions").insert(row))
  } else {
    await requireWrite("dialysis_sessions", mode, () =>
      supabase.from("dialysis_sessions").update(row).eq("id", session.id),
    )
  }
}

export async function persistLab(lab: BloodRecord, mode: "insert" | "update") {
  const supabase = getSupabase()
  if (!supabase) return
  const row = labToRow(lab)
  if (mode === "insert") {
    await requireWrite("blood_records", mode, () => supabase.from("blood_records").insert(row))
  } else {
    await requireWrite("blood_records", mode, () =>
      supabase.from("blood_records").update(row).eq("id", lab.id),
    )
  }
}

export async function deleteRemote(table: "centres" | "patients" | "dialysis_sessions" | "blood_records", id: string) {
  const supabase = getSupabase()
  if (!supabase) return
  await requireWrite(table, "delete", () => supabase.from(table).delete().eq("id", id))
}

export async function pushDatabase(data: Database) {
  const supabase = getSupabase()
  if (!supabase) throw new Error("Supabase tidak dikonfigurasi.")
  await requireWrite("centres", "upsert", () => supabase.from("centres").upsert(data.centres.map(centreToRow)))
  await requireWrite("patients", "upsert", () => supabase.from("patients").upsert(data.patients.map(patientToRow)))
  await requireWrite("dialysis_sessions", "upsert", () =>
    supabase.from("dialysis_sessions").upsert(data.sessions.map(sessionToRow)),
  )
  await requireWrite("blood_records", "upsert", () => supabase.from("blood_records").upsert(data.labs.map(labToRow)))
}
