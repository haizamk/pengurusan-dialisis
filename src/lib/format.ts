import type { AccessType, Sex } from "@/lib/types"

export const ACCESS_LABEL: Record<AccessType, string> = {
  fistula: "Fistula AV",
  graft: "Graft",
  kateter: "Kateter",
}

export const SEX_LABEL: Record<Sex, string> = {
  lelaki: "Lelaki",
  perempuan: "Perempuan",
}

export function round1(value: number) {
  return Math.round(value * 10) / 10
}

export function round2(value: number) {
  return Math.round(value * 100) / 100
}

export function formatKg(value: number | null | undefined, digits = 1) {
  if (value == null || Number.isNaN(value)) return "—"
  return `${value.toLocaleString("ms-MY", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} kg`
}

export function formatSignedKg(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—"
  const body = Math.abs(value).toLocaleString("ms-MY", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  if (value > 0) return `+${body} kg`
  if (value < 0) return `−${body} kg`
  return `${body} kg`
}

export function formatNumber(value: number | null | undefined, digits = 1) {
  if (value == null || Number.isNaN(value)) return "—"
  return value.toLocaleString("ms-MY", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function formatDate(iso: string) {
  const date = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat("ms-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date)
}

export function formatLongDate(date: Date) {
  return new Intl.DateTimeFormat("ms-MY", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date)
}

export function ageFromDob(iso: string, today = new Date()) {
  const dob = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(dob.getTime())) return null
  let age = today.getFullYear() - dob.getFullYear()
  const month = today.getMonth() - dob.getMonth()
  if (month < 0 || (month === 0 && today.getDate() < dob.getDate())) age -= 1
  return age
}

export function daysAgoIso(days: number, today = new Date()) {
  const copy = new Date(today)
  copy.setHours(0, 0, 0, 0)
  copy.setDate(copy.getDate() - days)
  const y = copy.getFullYear()
  const m = String(copy.getMonth() + 1).padStart(2, "0")
  const d = String(copy.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function bp(systolic: number | null, diastolic: number | null) {
  if (systolic == null || diastolic == null) return "—"
  return `${systolic}/${diastolic}`
}

export function hoursLabel(minutes: number) {
  const hours = minutes / 60
  return `${hours.toLocaleString("ms-MY", { maximumFractionDigits: 1 })} jam`
}
