import { summariseLab } from "@/lib/blood"
import { analyseUf, type UfAnalysis } from "@/lib/uf"
import type { BloodRecord, DialysisSession, Patient } from "@/lib/types"

export function sortSessions(sessions: DialysisSession[]) {
  return [...sessions].sort((a, b) => {
    const byDate = a.sessionDate.localeCompare(b.sessionDate)
    if (byDate !== 0) return byDate
    return a.createdAt.localeCompare(b.createdAt)
  })
}

export function sessionsFor(patientId: string, sessions: DialysisSession[]) {
  return sortSessions(sessions.filter((session) => session.patientId === patientId))
}

export function labsFor(patientId: string, labs: BloodRecord[]) {
  return [...labs]
    .filter((lab) => lab.patientId === patientId)
    .sort((a, b) => a.takenOn.localeCompare(b.takenOn) || a.createdAt.localeCompare(b.createdAt))
}

export function previousCompletedSession(
  patientId: string,
  sessions: DialysisSession[],
  before: DialysisSession,
) {
  return sessionsFor(patientId, sessions)
    .filter((session) => {
      if (session.id === before.id) return false
      if (session.postWeightKg == null) return false
      if (session.sessionDate < before.sessionDate) return true
      if (session.sessionDate > before.sessionDate) return false
      return session.createdAt < before.createdAt
    })
    .at(-1)
}

export function analyseSession(
  session: DialysisSession,
  sessions: DialysisSession[],
): UfAnalysis {
  const previous = previousCompletedSession(session.patientId, sessions, session)
  return analyseUf({
    dryWeightKg: session.dryWeightKg,
    arrivalWeightKg: session.arrivalWeightKg,
    postWeightKg: session.postWeightKg,
    lastPostWeightKg: previous?.postWeightKg ?? null,
    durationMin: session.durationMin,
  })
}

export function latestSession(patientId: string, sessions: DialysisSession[]) {
  return sessionsFor(patientId, sessions).at(-1) ?? null
}

export function latestLab(patientId: string, labs: BloodRecord[]) {
  return labsFor(patientId, labs).at(-1) ?? null
}

export type Attention = {
  patient: Patient
  level: "tinggi" | "pantau"
  reasons: string[]
  analysis: UfAnalysis | null
}

export function attentionFor(
  patient: Patient,
  sessions: DialysisSession[],
  labs: BloodRecord[],
): Attention | null {
  const session = latestSession(patient.id, sessions)
  const analysis = session ? analyseSession(session, sessions) : null
  const lab = latestLab(patient.id, labs)
  const reasons: string[] = []
  let level: Attention["level"] = "pantau"

  if (analysis?.band === "tinggi" || analysis?.band === "bawah-kering") {
    level = "tinggi"
    reasons.push(
      analysis.band === "tinggi"
        ? "Penambahan cecair melebihi 5% berat kering"
        : "Berat semasa tiba di bawah berat kering",
    )
  } else if (analysis?.band === "sederhana") {
    reasons.push("Penambahan cecair antara 4% dan 5% berat kering")
  }

  if (analysis?.rateFlag === "tinggi") {
    level = "tinggi"
    reasons.push("Kadar UF sasaran melebihi 13 mL/kg/jam")
  }
  if (analysis?.postFlag === "atas") {
    reasons.push("Sesi terakhir belum capai berat kering")
  }
  if (analysis?.postFlag === "bawah") {
    level = "tinggi"
    reasons.push("Sesi terakhir turun di bawah berat kering")
  }
  if (session && (session.systolicPre ?? 0) >= 160) {
    reasons.push("Tekanan darah sistolik sebelum sesi 160 atau lebih")
  }

  for (const flag of lab ? summariseLab(lab) : []) {
    if (flag.serious) level = "tinggi"
    reasons.push(`${flag.label} ${flag.value}`)
  }

  if (reasons.length === 0) return null
  return { patient, level, reasons, analysis }
}
