import { round1 } from "@/lib/format"
import type { BloodRecord } from "@/lib/types"

export type MarkerStatus =
  | "tiada"
  | "rendah"
  | "sasaran"
  | "tinggi"
  | "kritikal-rendah"
  | "kritikal-tinggi"
  | "trend"

export type MarkerKey =
  | "hemoglobin"
  | "potassium"
  | "phosphate"
  | "calcium"
  | "sodium"
  | "albumin"
  | "ureaPre"
  | "ureaPost"
  | "creatinine"

type MarkerSpec = {
  key: MarkerKey
  label: string
  unit: string
  digits: number
  hint: string
  judge: (value: number) => MarkerStatus
}

function band(
  value: number,
  targetLow: number,
  targetHigh: number,
  criticalLow?: number,
  criticalHigh?: number,
): MarkerStatus {
  if (criticalLow != null && value < criticalLow) return "kritikal-rendah"
  if (criticalHigh != null && value > criticalHigh) return "kritikal-tinggi"
  if (value < targetLow) return "rendah"
  if (value > targetHigh) return "tinggi"
  return "sasaran"
}

export const MARKERS: MarkerSpec[] = [
  {
    key: "hemoglobin",
    label: "Hemoglobin",
    unit: "g/dL",
    digits: 1,
    hint: "Sasaran dialisis lazim 10–12 g/dL.",
    judge: (value) => band(value, 10, 12, 8, 13),
  },
  {
    key: "potassium",
    label: "Kalium",
    unit: "mmol/L",
    digits: 1,
    hint: "Julat pra-dialisis yang biasa dipantau 3.5–5.5 mmol/L.",
    judge: (value) => band(value, 3.5, 5.5, 3, 6),
  },
  {
    key: "phosphate",
    label: "Fosfat",
    unit: "mmol/L",
    digits: 2,
    hint: "Sasaran lazim 1.13–1.78 mmol/L.",
    judge: (value) => band(value, 1.13, 1.78, 0.6, 2.5),
  },
  {
    key: "calcium",
    label: "Kalsium",
    unit: "mmol/L",
    digits: 2,
    hint: "Julat lazim 2.10–2.54 mmol/L.",
    judge: (value) => band(value, 2.1, 2.54, 1.9, 2.8),
  },
  {
    key: "sodium",
    label: "Natrium",
    unit: "mmol/L",
    digits: 0,
    hint: "Julat lazim 135–145 mmol/L.",
    judge: (value) => band(value, 135, 145, 125, 155),
  },
  {
    key: "albumin",
    label: "Albumin",
    unit: "g/L",
    digits: 0,
    hint: "Sasaran sekurang-kurangnya 35 g/L.",
    judge: (value) => {
      if (value < 30) return "kritikal-rendah"
      if (value < 35) return "rendah"
      return "sasaran"
    },
  },
  {
    key: "ureaPre",
    label: "Urea pra",
    unit: "mmol/L",
    digits: 1,
    hint: "Digunakan bersama urea pasca untuk kira URR.",
    judge: () => "trend",
  },
  {
    key: "ureaPost",
    label: "Urea pasca",
    unit: "mmol/L",
    digits: 1,
    hint: "Sampel diambil mengikut tatacara centre.",
    judge: () => "trend",
  },
  {
    key: "creatinine",
    label: "Kreatinin",
    unit: "µmol/L",
    digits: 0,
    hint: "Sentiasa tinggi pada pesakit dialisis. Lihat trend, bukan julat orang sihat.",
    judge: () => "trend",
  },
]

export const STATUS_LABEL: Record<MarkerStatus, string> = {
  tiada: "Tiada",
  rendah: "Rendah",
  sasaran: "Dalam sasaran",
  tinggi: "Tinggi",
  "kritikal-rendah": "Kritikal rendah",
  "kritikal-tinggi": "Kritikal tinggi",
  trend: "Trend",
}

export function markerByKey(key: MarkerKey) {
  return MARKERS.find((marker) => marker.key === key)!
}

export function judgeMarker(key: MarkerKey, value: number | null): MarkerStatus {
  if (value == null || Number.isNaN(value)) return "tiada"
  return markerByKey(key).judge(value)
}

export function ureaReductionRatio(pre: number | null, post: number | null) {
  if (pre == null || post == null) return null
  if (!(pre > 0) || post < 0 || post > pre) return null
  return round1((1 - post / pre) * 100)
}

export function judgeUrr(urr: number | null): MarkerStatus {
  if (urr == null) return "tiada"
  if (urr < 60) return "rendah"
  if (urr < 65) return "tinggi"
  return "sasaran"
}

export function urrLabel(status: MarkerStatus) {
  if (status === "rendah") return "URR rendah"
  if (status === "tinggi") return "URR hampir sasaran"
  if (status === "sasaran") return "URR mencukupi"
  return "URR tiada"
}

export type LabFlag = {
  key: string
  label: string
  value: string
  status: MarkerStatus
  serious: boolean
}

export function summariseLab(lab: BloodRecord): LabFlag[] {
  const flags: LabFlag[] = []
  for (const marker of MARKERS) {
    const value = lab[marker.key]
    const status = judgeMarker(marker.key, value)
    if (status === "tiada" || status === "trend" || status === "sasaran") continue
    flags.push({
      key: marker.key,
      label: marker.label,
      value:
        value == null
          ? "—"
          : `${value.toLocaleString("ms-MY", {
              minimumFractionDigits: marker.digits,
              maximumFractionDigits: marker.digits,
            })} ${marker.unit}`,
      status,
      serious: status === "kritikal-rendah" || status === "kritikal-tinggi",
    })
  }
  const urr = ureaReductionRatio(lab.ureaPre, lab.ureaPost)
  const urrStatus = judgeUrr(urr)
  if (urr != null && urrStatus !== "sasaran") {
    flags.push({
      key: "urr",
      label: "URR",
      value: `${urr.toLocaleString("ms-MY", { maximumFractionDigits: 1 })}%`,
      status: urrStatus,
      serious: urrStatus === "rendah",
    })
  }
  return flags
}

export function isSeriousStatus(status: MarkerStatus) {
  return (
    status === "kritikal-rendah" ||
    status === "kritikal-tinggi" ||
    status === "rendah" ||
    status === "tinggi"
  )
}
