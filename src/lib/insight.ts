import { judgeMarker, MARKERS } from "@/lib/blood"
import { formatDate } from "@/lib/format"
import type { BloodRecord, DialysisSession, Patient } from "@/lib/types"

export type Insight = {
  sufficient: boolean
  message: string
  period: string | null
  observations: string[]
  questions: string[]
  urgent: string[]
  disclaimer: string
}

const DISCLAIMER =
  "Analisis ini alat pendidikan berdasarkan rekod yang anda sahkan. Ia bukan diagnosis dan tidak menggantikan nasihat pasukan dialisis. Ia tidak mengubah berat kering, sasaran UF, ubat, atau preskripsi dialisis."

export function analyseRecords(patient: Patient | null, sessions: DialysisSession[], labs: BloodRecord[]): Insight {
  const empty: Insight = {
    sufficient: false,
    message: "Data belum mencukupi untuk analisis. Tambah rekod kesihatan sebenar untuk memulakan analisis.",
    period: null,
    observations: [],
    questions: [],
    urgent: [],
    disclaimer: DISCLAIMER,
  }
  if (!patient) return empty
  const dated = [
    ...sessions.map((session) => session.sessionDate),
    ...labs.map((lab) => lab.takenOn),
  ].filter(Boolean).sort()
  if (dated.length < 2 && sessions.length + labs.length < 1) return empty
  if (sessions.length === 0 && labs.length === 0) return empty

  const observations: string[] = []
  const questions: string[] = []
  const urgent: string[] = []

  const ordered = [...sessions].sort((a, b) => a.sessionDate.localeCompare(b.sessionDate))
  if (ordered.length >= 2) {
    const first = ordered[0]
    const last = ordered[ordered.length - 1]
    const delta = Math.round((last.arrivalWeightKg - first.arrivalWeightKg) * 10) / 10
    observations.push(
      `Berat sebelum dialisis ${delta >= 0 ? "naik" : "turun"} ${Math.abs(delta)} kg antara ${formatDate(first.sessionDate)} (${first.arrivalWeightKg} kg) dan ${formatDate(last.sessionDate)} (${last.arrivalWeightKg} kg).`,
    )
    const dryChanged = first.dryWeightKg !== last.dryWeightKg
    if (dryChanged) {
      observations.push(
        `Berat kering yang direkod berubah daripada ${first.dryWeightKg} kg pada ${formatDate(first.sessionDate)} kepada ${last.dryWeightKg} kg pada ${formatDate(last.sessionDate)}.`,
      )
    }
  } else if (ordered.length === 1) {
    observations.push(
      `Hanya satu sesi disahkan, pada ${formatDate(ordered[0].sessionDate)}. Trend berat belum boleh dibuat.`,
    )
  } else {
    observations.push("Tiada sesi dialisis disimpan.")
  }

  const labsOrdered = [...labs].sort((a, b) => a.takenOn.localeCompare(b.takenOn))
  for (const marker of MARKERS) {
    const points = labsOrdered
      .map((lab) => ({ date: lab.takenOn, value: lab[marker.key] }))
      .filter((point): point is { date: string; value: number } => point.value != null && Number.isFinite(point.value))
    if (points.length === 0) continue
    const latest = points[points.length - 1]
    const status = judgeMarker(marker.key, latest.value)
    observations.push(
      `${marker.label} terkini ${latest.value} ${marker.unit} pada ${formatDate(latest.date)}. Julat pemantauan dalam aplikasi ialah panduan am, bukan julat makmal laporan anda.`,
    )
    if (status === "kritikal-tinggi" || status === "kritikal-rendah") {
      urgent.push(
        `${marker.label} ${latest.value} ${marker.unit} pada ${formatDate(latest.date)} berada di luar julat amaran aplikasi. Hubungi pasukan dialisis dengan kadar segera.`,
      )
    }
    if (points.length >= 2) {
      const previous = points[points.length - 2]
      const change = Math.round((latest.value - previous.value) * 10) / 10
      if (change !== 0) {
        observations.push(
          `${marker.label} ${change > 0 ? "meningkat" : "menurun"} ${Math.abs(change)} ${marker.unit} daripada ${formatDate(previous.date)} (${previous.value}) ke ${formatDate(latest.date)} (${latest.value}).`,
        )
      }
    } else {
      observations.push(`${marker.label} hanya ada satu bacaan. Trend belum boleh ditetapkan.`)
    }
  }

  if (labs.length === 0) {
    observations.push("Tiada rekod darah yang disahkan.")
    questions.push("Adakah salinan laporan makmal terkini boleh dimasukkan supaya trend hemoglobin dan kalium dapat dilihat?")
  }
  questions.push("Adakah berat kering semasa masih sesuai dengan keadaan saya?")
  questions.push("Nilai manakah yang pasukan ingin semak pada sesi akan datang?")

  const period = dated.length
    ? `${formatDate(dated[0])} hingga ${formatDate(dated[dated.length - 1])}`
    : null

  return {
    sufficient: observations.length > 0,
    message: observations.length > 0 ? "Ringkasan dibuat daripada rekod yang disimpan." : empty.message,
    period,
    observations,
    questions,
    urgent,
    disclaimer: DISCLAIMER,
  }
}
