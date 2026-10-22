import { normaliseLabUnit, type ParsedObservation } from "@/lib/lab-parse"

export const ANALYSIS_VERSION = "peraturan-darah-v1"

export type ConfirmedResult = {
  standardKey: string
  label: string
  takenOn: string
  value: number
  unit: string
  refText: string | null
  source: "disahkan" | "manual" | "belum_disemak"
  documentId?: string | null
}

export type ParameterReading = {
  key: string
  label: string
  unit: string
  explanation: string
  question: string
  latest: ConfirmedResult
  previous: ConfirmedResult | null
  change: number | null
  points: ConfirmedResult[]
}

export type LabAnalysisReport = {
  version: string
  generatedAt: string
  coveredFrom: string | null
  coveredTo: string | null
  summary: string[]
  parameters: ParameterReading[]
  safety: string[]
  diet: DietNote[]
  disclaimer: string
}

export type DietNote = {
  topic: string
  evidence: string
  why: string
  discussion: string
  limit: string
}

const EXPLANATIONS: Record<string, string> = {
  hemoglobin: "Hemoglobin mengukur jumlah pigmen pembawa oksigen dalam darah dan dipantau dalam anemia pesakit dialisis.",
  potassium: "Kalium ialah elektrolit. Keputusannya boleh mempengaruhi perbincangan tentang pilihan makanan, tetapi tidak menetapkan had yang sama untuk setiap pesakit.",
  phosphate: "Fosfat dipantau kerana buah pinggang yang tidak berfungsi mengekalkan fosfat. Label makanan berproses mungkin mengandungi bahan tambahan fosfat.",
  calcium: "Kalsium dipantau bersama fosfat dan hormon paratiroid. Satu bacaan tidak menentukan dos ubat.",
  albumin: "Albumin ialah protein darah. Satu keputusan bukan ukuran muktamad status pemakanan.",
  urea: "Urea mencerminkan sisa nitrogen. Bacaan pra dan pasca dialisis tidak boleh digabung dengan satu bacaan urea yang kaedahnya tidak dinyatakan.",
  creatinine: "Kreatinin biasanya tinggi pada pesakit dialisis. Trend hanya boleh dibanding jika unit dan kaedah sama.",
  ferritin: "Feritin ialah penanda simpanan besi yang perlukan tafsiran klinikal, termasuk keradangan.",
  tsat: "Ketepuan transferin (TSAT) digunakan bersama penanda besi yang lain. Ia tidak menentukan dos besi.",
  pth: "Hormon paratiroid (PTH) dipantau dalam mineral tulang. Kaedah ujian yang berbeza tidak boleh disambung.",
  bicarbonate: "Bikarbonat menggambarkan keseimbangan asid-bes. Keputusan perlukan konteks rawatan dialisis.",
  sodium: "Natrium ialah elektrolit. Keputusannya tidak secara automatik menetapkan had cecair.",
}

function finite(value: number) {
  return Number.isFinite(value)
}

export function parameterSeries(results: ConfirmedResult[]) {
  const groups = new Map<string, ConfirmedResult[]>()
  for (const result of results) {
    if (!result.standardKey || !finite(result.value) || !result.unit || !result.takenOn) continue
    const key = `${result.standardKey}|${result.unit}`
    groups.set(key, [...(groups.get(key) ?? []), result])
  }
  return [...groups.entries()].map(([key, points]) => {
    const sorted = [...points].sort((a, b) => a.takenOn.localeCompare(b.takenOn) || a.value - b.value)
    const [standardKey, unit] = key.split("|")
    const latest = sorted[sorted.length - 1]
    const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null
    return {
      key: standardKey,
      label: latest.label,
      unit,
      explanation: EXPLANATIONS[standardKey] ?? "Parameter ini disimpan seperti yang direkodkan.",
      question: `Bincang ${latest.label} ${latest.value} ${latest.unit} pada ${latest.takenOn} dengan pasukan dialisis anda. Aplikasi tidak menetapkan rawatan.`,
      latest,
      previous,
      change: previous ? Math.round((latest.value - previous.value) * 100) / 100 : null,
      points: sorted,
    } satisfies ParameterReading
  })
}

export function safetyMessages(results: ConfirmedResult[]) {
  const messages: string[] = []
  const latest = (key: string, unit: string) =>
    results
      .filter((item) => item.standardKey === key && item.unit.toLowerCase() === unit)
      .sort((a, b) => a.takenOn.localeCompare(b.takenOn))
      .at(-1)
  const potassium = latest("potassium", "mmol/l")
  if (potassium && (potassium.value >= 6.5 || potassium.value <= 2.5)) {
    messages.push(
      `Kalium ${potassium.value} mmol/L pada ${potassium.takenOn} melepasi amaran keselamatan aplikasi. Hubungi pasukan dialisis dengan segera atau dapatkan penilaian perubatan segera. Jangan tunggu laporan analisis penuh.`,
    )
  }
  const hemoglobin = latest("hemoglobin", "g/dl")
  if (hemoglobin && hemoglobin.value < 7) {
    messages.push(
      `Hemoglobin ${hemoglobin.value} g/dL pada ${hemoglobin.takenOn} rendah menurut amaran keselamatan aplikasi. Hubungi pasukan rawatan dengan segera.`,
    )
  }
  return messages
}

function dietNotes(series: ParameterReading[]): DietNote[] {
  const notes: DietNote[] = []
  const find = (key: string) => series.find((item) => item.key === key)
  const potassium = find("potassium")
  if (potassium) {
    notes.push({
      topic: "Kalium",
      evidence: `${potassium.latest.label} ${potassium.latest.value} ${potassium.latest.unit} pada ${potassium.latest.takenOn}.`,
      why: "Keputusan kalium boleh relevan kepada pilihan dan cara penyediaan makanan.",
      discussion: "Contoh perbincangan: cara merebus dan membuang air sayur, saiz hidangan, serta makanan berproses. Buah dan sayur tidak diharamkan secara automatik.",
      limit: "Tiada had kalium peribadi ditetapkan di sini. Ikut arahan pakar diet buah pinggang anda.",
    })
  }
  const phosphate = find("phosphate")
  if (phosphate) {
    notes.push({
      topic: "Fosfat",
      evidence: `${phosphate.latest.label} ${phosphate.latest.value} ${phosphate.latest.unit} pada ${phosphate.latest.takenOn}.`,
      why: "Fosfat dalam makanan semula jadi dan bahan tambahan berbeza. Label boleh menyenaraikan phosphoric acid atau perkataan phosphate.",
      discussion: "Baca label makanan berproses dan bincang sumber protein dengan pakar diet. Jangan buang semua makanan berprotein.",
      limit: "Cadangan ini bukan arahan untuk menukar pengikat fosfat atau rawatan dialisis.",
    })
  }
  const hemoglobin = find("hemoglobin")
  const ferritin = find("ferritin")
  const tsat = find("tsat")
  if (hemoglobin || ferritin || tsat) {
    const evidence = [hemoglobin, ferritin, tsat]
      .filter((item): item is ParameterReading => Boolean(item))
      .map((item) => `${item.latest.label} ${item.latest.value} ${item.latest.unit} pada ${item.latest.takenOn}`)
      .join("; ")
    notes.push({
      topic: "Hemoglobin, feritin dan TSAT",
      evidence,
      why: "Penanda ini digunakan untuk memantau anemia dan status besi, tetapi tafsiran memerlukan keputusan klinikal.",
      discussion: "Bawa keputusan ini kepada pasukan dialisis jika anda ingin faham kaitan dengan gejala letih.",
      limit: "Jangan mulakan, hentikan, atau ubah dos besi, ESA, atau ubat anemia berdasarkan paparan ini.",
    })
  }
  const albumin = find("albumin")
  if (albumin) {
    notes.push({
      topic: "Albumin",
      evidence: `${albumin.latest.label} ${albumin.latest.value} ${albumin.latest.unit} pada ${albumin.latest.takenOn}.`,
      why: "Albumin boleh dipengaruhi penyakit, keradangan, dan cecair, bukan pemakanan semata-mata.",
      discussion: "Bincang selera makan, protein, dan berat dengan pakar diet jika keputusan ini berulang.",
      limit: "Satu keputusan tidak menjadi alasan untuk menetapkan suplemen.",
    })
  }
  return notes
}

export function buildLabAnalysis(results: ConfirmedResult[], generatedAt: string): LabAnalysisReport {
  const series = parameterSeries(results)
  const dates = results.map((item) => item.takenOn).sort()
  const summary = series.length
    ? series.map((item) => {
        const comparison = item.previous
          ? ` Bacaan setanding sebelumnya ialah ${item.previous.value} ${item.unit} pada ${item.previous.takenOn}; beza ${item.change} ${item.unit}.`
          : " Hanya satu bacaan setanding, jadi trend tidak dapat ditentukan."
        return `${item.latest.label}: ${item.latest.value} ${item.unit} pada ${item.latest.takenOn}.${comparison}`
      })
    : ["Tiada bacaan dengan nilai dan unit yang boleh dipaparkan untuk dianalisis."]
  return {
    version: ANALYSIS_VERSION,
    generatedAt,
    coveredFrom: dates[0] ?? null,
    coveredTo: dates.at(-1) ?? null,
    summary,
    parameters: series,
    safety: safetyMessages(results),
    diet: dietNotes(series),
    disclaimer:
      "Analisis dan cadangan pemakanan ini ialah sokongan pendidikan berdasarkan rekod yang mungkin belum disemak. Sahkan bacaan dengan laporan asal sebelum membuat keputusan. Ia bukan diagnosis, bukan preskripsi, dan bukan pengganti nasihat pakar diet buah pinggang atau nefrologi.",
  }
}

export function filterByRange<T extends { takenOn: string }>(points: T[], range: "3m" | "6m" | "12m" | "all", today: string) {
  if (range === "all") return points
  const months = range === "3m" ? 3 : range === "6m" ? 6 : 12
  const start = new Date(`${today}T00:00:00Z`)
  start.setUTCMonth(start.getUTCMonth() - months)
  const cutoff = start.toISOString().slice(0, 10)
  return points.filter((point) => point.takenOn >= cutoff)
}

/** Provisional readings are usable for display and educational trends, never as verified records. */
export function observationsToAnalysis(
  rows: Array<ParsedObservation & { takenOn: string; label?: string; source: "disahkan" | "manual"; status: "disahkan" | "perlu_semakan"; documentId?: string | null }>,
): ConfirmedResult[] {
  return rows.flatMap((row) => {
    if (row.value == null || !Number.isFinite(row.value) || !row.unit?.trim() || !row.takenOn) return []
    // Do not use unverified implausible numbers for charts or dietary interpretations.
    if (row.status !== "disahkan" && (row.value < 0 || row.value > 10000)) return []
    return [{
      standardKey: row.standardKey ?? `nama:${row.originalName}`,
      label: row.label ?? row.originalName,
      takenOn: row.takenOn,
      value: row.value,
      unit: normaliseLabUnit(row.unit),
      refText: row.refText,
      source: row.status === "disahkan" ? row.source : "belum_disemak" as const,
      documentId: row.documentId ?? null,
    }]
  })
}

export function observationsToConfirmed(
  rows: Array<ParsedObservation & { takenOn: string; label?: string; source: "disahkan" | "manual"; status: "disahkan" | "perlu_semakan"; documentId?: string | null }>,
): ConfirmedResult[] {
  return rows.flatMap((row) => {
    if (row.status !== "disahkan" || row.uncertain || row.value == null || row.unit == null || !row.takenOn) return []
    return [{
      standardKey: row.standardKey ?? `nama:${row.originalName}`,
      label: row.label ?? row.originalName,
      takenOn: row.takenOn,
      value: row.value,
      unit: normaliseLabUnit(row.unit),
      refText: row.refText,
      source: row.source,
      documentId: row.documentId ?? null,
    }]
  })
}

const MANUAL_MARKERS: { field: "hemoglobin" | "potassium" | "phosphate" | "calcium" | "sodium" | "albumin" | "ureaPre" | "ureaPost" | "creatinine"; key: string; label: string; unit: string }[] = [
  { field: "hemoglobin", key: "hemoglobin", label: "Hemoglobin", unit: "g/dl" },
  { field: "potassium", key: "potassium", label: "Kalium", unit: "mmol/l" },
  { field: "phosphate", key: "phosphate", label: "Fosfat", unit: "mmol/l" },
  { field: "calcium", key: "calcium", label: "Kalsium", unit: "mmol/l" },
  { field: "sodium", key: "sodium", label: "Natrium", unit: "mmol/l" },
  { field: "albumin", key: "albumin", label: "Albumin", unit: "g/l" },
  { field: "ureaPre", key: "ureaPre", label: "Urea pra", unit: "mmol/l" },
  { field: "ureaPost", key: "ureaPost", label: "Urea pasca", unit: "mmol/l" },
  { field: "creatinine", key: "creatinine", label: "Kreatinin", unit: "µmol/l" },
]

export function fromBloodRecords(labs: Array<{ takenOn: string; hemoglobin: number | null; potassium: number | null; phosphate: number | null; calcium: number | null; sodium: number | null; albumin: number | null; ureaPre: number | null; ureaPost: number | null; creatinine: number | null }>): ConfirmedResult[] {
  return labs.flatMap((lab) =>
    MANUAL_MARKERS.flatMap((marker) => {
      const value = lab[marker.field]
      if (value == null || !Number.isFinite(value)) return []
      return [{
        standardKey: marker.key,
        label: marker.label,
        takenOn: lab.takenOn,
        value,
        unit: marker.unit,
        refText: null,
        source: "manual" as const,
        documentId: null,
      }]
    }),
  )
}

export function mergeConfirmed(primary: ConfirmedResult[], extra: ConfirmedResult[]) {
  const seen = new Set(primary.map((item) => `${item.standardKey}|${item.unit}|${item.takenOn}|${item.value}`))
  return [...primary, ...extra.filter((item) => !seen.has(`${item.standardKey}|${item.unit}|${item.takenOn}|${item.value}`))]
}

export function parsePrintedRange(text: string | null) {
  if (!text) return null
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*[-–—]\s*(\d+(?:[.,]\d+)?)/)
  if (!match) return null
  const low = Number(match[1].replace(",", "."))
  const high = Number(match[2].replace(",", "."))
  if (!Number.isFinite(low) || !Number.isFinite(high) || low >= high) return null
  return { low, high }
}

export function sharedPrintedRange(points: { refText: string | null }[]) {
  if (points.length === 0) return null
  const parsed = points.map((point) => parsePrintedRange(point.refText))
  if (parsed.some((item) => item == null)) return null
  const first = parsed[0]
  if (!first || parsed.some((item) => item?.low !== first.low || item?.high !== first.high)) return null
  return first
}
