import { catalogueForName, parseLabNumber, unitAppearsInText, type ParsedObservation, type ParsedReport } from "@/lib/lab-parse"

export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash"
export const GEMINI_MODELS = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-2.5-flash"] as const
export const MAX_GEMINI_FILE_BYTES = 20 * 1024 * 1024

export const GEMINI_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["sampleDate", "dateUncertain", "results"],
  properties: {
    sampleDate: {
      type: ["string", "null"],
      description: "Tarikh sampel atau laporan dalam YYYY-MM-DD jika satu tarikh tercetak. Null jika tiada atau lebih daripada satu.",
    },
    dateUncertain: { type: "boolean" },
    results: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "valueText", "unit", "referenceRange", "abnormalFlag", "visibleText", "uncertain", "page"],
        properties: {
          name: { type: "string", description: "Nama ujian seperti yang tercetak." },
          valueText: { type: ["string", "null"], description: "Nilai tepat seperti tercetak, termasuk titik perpuluhan atau ketidaksamaan. Null jika tidak jelas." },
          unit: { type: ["string", "null"] },
          referenceRange: { type: ["string", "null"] },
          abnormalFlag: { type: ["string", "null"] },
          visibleText: { type: "string", description: "Teks tepat pada laporan yang mengandungi keputusan ini." },
          uncertain: { type: "boolean" },
          page: { type: ["integer", "null"] },
        },
      },
    },
  },
} as const

export const GEMINI_EXTRACT_PROMPT = `Baca laporan makmal pada fail yang diberi.
Ekstrak hanya keputusan yang benar-benar kelihatan.
Jangan cipta nama ujian, nilai, unit, tarikh, atau julat rujukan.
Jangan isi nilai yang tidak terbaca dengan julat lazim.
Salin valueText tepat seperti tercetak, termasuk titik perpuluhan, koma, tanda negatif, notasi sains, dan < > ≤ ≥.
Jika nilai tidak jelas, valueText mestilah null dan uncertain mestilah true.
visibleText mestilah baris atau sel yang tercetak dan mesti mengandungi valueText jika valueText ada.
Jangan sertakan nama pesakit, nombor pengenalan, atau alamat.
sampleDate hanya YYYY-MM-DD jika satu tarikh sampel atau laporan tercetak.`

export type GeminiResultRow = {
  name: string
  valueText: string | null
  unit: string | null
  referenceRange: string | null
  abnormalFlag: string | null
  visibleText: string
  uncertain: boolean
  page: number | null
}

export type GeminiPayload = {
  sampleDate: string | null
  dateUncertain: boolean
  results: GeminiResultRow[]
}

export type GeminiExtract = ParsedReport & {
  model: string
  rejected: number
}

function compact(value: string) {
  return value.replace(/\s+/g, "").toLowerCase()
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function asNullableString(value: unknown) {
  if (value == null) return null
  const text = asString(value)
  return text ? text : null
}

function asBoolean(value: unknown) {
  return value === true
}

function isoDate(value: unknown) {
  const text = asNullableString(value)
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return null
  const date = new Date(`${text}T00:00:00Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text ? null : text
}

function valueInSnippet(snippet: string, valueText: string) {
  return compact(snippet).includes(compact(valueText))
}

export function selectedGeminiModel(requested = process.env.GEMINI_MODEL) {
  const model = requested?.trim()
  return model && GEMINI_MODELS.includes(model as (typeof GEMINI_MODELS)[number]) ? model : DEFAULT_GEMINI_MODEL
}

export function geminiMime(kind: "pdf" | "png" | "jpeg") {
  if (kind === "pdf") return "application/pdf"
  if (kind === "png") return "image/png"
  return "image/jpeg"
}

export function validateGeminiPayload(raw: unknown): { payload: GeminiPayload | null; error: string | null } {
  if (!raw || typeof raw !== "object") return { payload: null, error: "Balasan Gemini bukan objek JSON." }
  const row = raw as Record<string, unknown>
  if (!Array.isArray(row.results)) return { payload: null, error: "Balasan Gemini tiada senarai keputusan." }
  const results: GeminiResultRow[] = []
  for (const item of row.results) {
    if (!item || typeof item !== "object") continue
    const result = item as Record<string, unknown>
    const name = asString(result.name).slice(0, 80)
    const visibleText = asString(result.visibleText).slice(0, 240)
    if (!name || !visibleText) continue
    const page = typeof result.page === "number" && Number.isInteger(result.page) && result.page > 0 ? result.page : null
    results.push({
      name,
      valueText: asNullableString(result.valueText)?.slice(0, 40) ?? null,
      unit: asNullableString(result.unit)?.slice(0, 24) ?? null,
      referenceRange: asNullableString(result.referenceRange)?.slice(0, 80) ?? null,
      abnormalFlag: asNullableString(result.abnormalFlag)?.slice(0, 16) ?? null,
      visibleText,
      uncertain: asBoolean(result.uncertain),
      page,
    })
  }
  const sampleDate = isoDate(row.sampleDate)
  return {
    payload: {
      sampleDate,
      dateUncertain: asBoolean(row.dateUncertain) || !sampleDate,
      results,
    },
    error: null,
  }
}

export function observationsFromGemini(payload: GeminiPayload): { report: ParsedReport; rejected: number } {
  const observations: ParsedObservation[] = []
  let rejected = 0
  for (const item of payload.results) {
    if (item.valueText && !valueInSnippet(item.visibleText, item.valueText)) {
      rejected += 1
      continue
    }
    const bounded = item.valueText ? /(?:<=|>=|<|>|≤|≥)\s*[-+]?\d/.test(item.valueText) : false
    const numbers = item.valueText ? [...item.valueText.matchAll(/[-+]?\d+(?:[.,]\d+)?(?:[eE][-+]?\d+)?/g)].map((match) => parseLabNumber(match[0])).filter((value): value is number => value != null) : []
    const unit = item.unit && unitAppearsInText(item.visibleText, item.unit) ? item.unit.replace(/\s+/g, "").replace("μ", "µ").toLowerCase() : null
    if (item.unit && !unit) rejected += 1
    const catalogue = catalogueForName(item.name)
    // Preserve an evidence-backed numeric reading as a *pending* draft even when the
    // parameter is not in our small catalogue or the model marked it uncertain.
    // Never infer a value from the reference range or a mismatched source snippet.
    const hasSupportedValue = Boolean(item.valueText) && numbers.length === 1 && Boolean(unit) && !bounded
    const certain = hasSupportedValue && Boolean(catalogue) && !item.uncertain
    const snippet = item.page ? `Halaman ${item.page}: ${item.visibleText}` : item.visibleText
    observations.push({
      originalName: catalogue && certain ? catalogue.label : item.name,
      standardKey: certain && catalogue ? catalogue.key : null,
      value: hasSupportedValue ? numbers[0] : null,
      unit,
      refText: item.referenceRange && item.visibleText.includes(item.referenceRange) ? item.referenceRange : null,
      abnormalFlag: certain ? item.abnormalFlag : null,
      uncertain: !certain,
      snippet,
    })
  }
  return {
    report: {
      reportDate: payload.dateUncertain ? null : payload.sampleDate,
      dateUncertain: payload.dateUncertain || !payload.sampleDate,
      observations,
    },
    rejected,
  }
}

export function textFromGeminiReport(report: ParsedReport) {
  const lines = [
    report.reportDate ? `Tarikh: ${report.reportDate}` : "",
    ...report.observations.map((item) => item.snippet),
  ]
  return lines.filter(Boolean).join("\n")
}
