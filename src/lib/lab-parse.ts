export type ParsedObservation = {
  originalName: string
  standardKey: string | null
  value: number | null
  unit: string | null
  refText: string | null
  abnormalFlag: string | null
  uncertain: boolean
  snippet: string
}

export type ExtractionStatus = "tiada_teks" | "separa" | "terbaca" | "gagal"

export type ParsedReport = {
  reportDate: string | null
  dateUncertain: boolean
  observations: ParsedObservation[]
}

type CatalogueItem = {
  key: string
  label: string
  pattern: RegExp
  units: string[]
}

export const LAB_PARAMETERS: { key: string; label: string }[] = [
  { key: "hemoglobin", label: "Hemoglobin" },
  { key: "potassium", label: "Kalium" },
  { key: "phosphate", label: "Fosfat" },
  { key: "calcium", label: "Kalsium" },
  { key: "sodium", label: "Natrium" },
  { key: "albumin", label: "Albumin" },
  { key: "urea", label: "Urea" },
  { key: "creatinine", label: "Kreatinin" },
  { key: "ferritin", label: "Feritin" },
  { key: "tsat", label: "TSAT" },
  { key: "pth", label: "PTH" },
  { key: "bicarbonate", label: "Bikarbonat" },
]

const CATALOGUE: CatalogueItem[] = [
  { key: "hemoglobin", label: "Hemoglobin", pattern: /^(hb|hgb|hemoglobin|haemoglobin)$/i, units: ["g/dl", "g/l"] },
  { key: "potassium", label: "Kalium", pattern: /^(k|k\+|potassium|kalium)$/i, units: ["mmol/l", "meq/l"] },
  { key: "phosphate", label: "Fosfat", pattern: /^(po4|phosphate|fosfat|phosphorus|fosforus)$/i, units: ["mmol/l", "mg/dl"] },
  { key: "calcium", label: "Kalsium", pattern: /^(ca|calcium|kalsium)$/i, units: ["mmol/l", "mg/dl"] },
  { key: "sodium", label: "Natrium", pattern: /^(na|na\+|sodium|natrium)$/i, units: ["mmol/l"] },
  { key: "albumin", label: "Albumin", pattern: /^(albumin|alb)$/i, units: ["g/l", "g/dl"] },
  { key: "urea", label: "Urea", pattern: /^(urea|bun)$/i, units: ["mmol/l", "mg/dl"] },
  { key: "creatinine", label: "Kreatinin", pattern: /^(creatinine|kreatinin|creat)$/i, units: ["umol/l", "µmol/l", "μmol/l", "mg/dl"] },
  { key: "ferritin", label: "Feritin", pattern: /^(ferritin|feritin)$/i, units: ["ug/l", "µg/l", "μg/l", "ng/ml"] },
  { key: "tsat", label: "TSAT", pattern: /^(tsat)$/i, units: ["%"] },
  { key: "pth", label: "PTH", pattern: /^(pth|ipth)$/i, units: ["pmol/l", "pg/ml"] },
  { key: "bicarbonate", label: "Bikarbonat", pattern: /^(hco3|bicarbonate|bikarbonat)$/i, units: ["mmol/l"] },
]

const UNIT_PATTERN =
  /(\b(?:g\/dl|g\/l|mmol\/l|mg\/dl|µmol\/l|μmol\/l|umol\/l|µg\/l|μg\/l|ug\/l|ng\/ml|pmol\/l|pg\/ml|meq\/l|%)\b)/i

const NUMBER_PATTERN = /-?\d+(?:[.,]\d+)?/g
const RANGE_PATTERN = /(\d+(?:[.,]\d+)?)\s*[-–—]\s*(\d+(?:[.,]\d+)?)/

function normaliseUnit(unit: string) {
  return unit.replace(/\s+/g, "").replace("μ", "µ").toLowerCase()
}

function parseNumber(token: string) {
  const normalised = token.includes(",") && !token.includes(".") ? token.replace(",", ".") : token.replace(/,/g, "")
  const value = Number(normalised)
  return Number.isFinite(value) ? value : null
}

function canonicalUnit(unit: string) {
  const value = normaliseUnit(unit)
  if (value === "umol/l") return "µmol/l"
  if (value === "ug/l") return "µg/l"
  return value
}

function findCatalogue(line: string) {
  const tokens = line
    .replace(/[()[\],:]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
  const hits = CATALOGUE.filter((item) => tokens.some((token) => item.pattern.test(token.replace(/\+/g, "+"))))
  const phraseHits = CATALOGUE.filter((item) => {
    if (item.key !== "tsat") return false
    return /transferrin saturation|ketepuan transferin/i.test(line)
  })
  const combined = [...hits, ...phraseHits.filter((item) => !hits.includes(item))]
  return combined.length === 1 ? combined[0] : combined.length > 1 ? "ambiguous" : null
}

export function normaliseLabUnit(unit: string) {
  return canonicalUnit(unit.trim())
}

export function parseLabText(text: string): ParsedReport {
  const prepared = text.replace(/([A-Za-zµμ%])(?=\d)/g, "$1 ").replace(/(\d)(?=[A-Za-zµμ%])/g, "$1 ")
  const lines = prepared
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const dates = lines.flatMap((line) => {
    const iso = line.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/)
    if (iso) return [`${iso[1]}-${iso[2]}-${iso[3]}`]
    const dmy = line.match(/\b(\d{2})\/(\d{2})\/(20\d{2})\b/)
    if (dmy) return [`${dmy[3]}-${dmy[2]}-${dmy[1]}`]
    return []
  })
  const uniqueDates = [...new Set(dates)]
  const observations: ParsedObservation[] = []

  for (const line of lines) {
    const match = findCatalogue(line)
    if (!match || match === "ambiguous") {
      if (match === "ambiguous") {
        observations.push({
          originalName: line.slice(0, 80),
          standardKey: null,
          value: null,
          unit: null,
          refText: null,
          abnormalFlag: null,
          uncertain: true,
          snippet: line,
        })
      }
      continue
    }
    const range = line.match(RANGE_PATTERN)
    const withoutRange = range ? line.replace(range[0], " ") : line
    const numbers = [...withoutRange.matchAll(NUMBER_PATTERN)].map((item) => parseNumber(item[0])).filter((item): item is number => item != null)
    const unitMatch = line.match(UNIT_PATTERN)
    const unit = unitMatch ? canonicalUnit(unitMatch[1]) : null
    const withoutUnit = unitMatch ? line.replace(unitMatch[0], " ") : line
    const flagMatch = withoutUnit.match(/(?:^|\s)(H|L|High|Low|Tinggi|Rendah)(?:\s|$)/)
    const flag = flagMatch ? flagMatch[1] : null
    const unitAllowed = unit != null && match.units.includes(normaliseUnit(unit).replace("µ", "u").replace("μ", "u")) || (unit != null && match.units.some((item) => normaliseUnit(item).replace("µ", "u") === normaliseUnit(unit).replace("µ", "u")))
    const certain = numbers.length === 1 && unitAllowed
    observations.push({
      originalName: match.label,
      standardKey: certain ? match.key : null,
      value: certain ? numbers[0] : null,
      unit: certain ? unit : unit,
      refText: range ? range[0].replace(/\s+/g, " ") : null,
      abnormalFlag: certain ? flag : null,
      uncertain: !certain,
      snippet: line,
    })
  }

  return {
    reportDate: uniqueDates.length === 1 ? uniqueDates[0] : null,
    dateUncertain: uniqueDates.length !== 1,
    observations,
  }
}

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47]
const JPEG_MAGIC = [0xff, 0xd8, 0xff]

export const MAX_LAB_FILE_BYTES = 8 * 1024 * 1024

export function validateLabFile(file: { name: string; type: string; size: number }, bytes: Uint8Array) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? ""
  const head = Array.from(bytes.slice(0, 4))
  const starts = (magic: number[]) => magic.every((value, index) => head[index] === value)
  if (file.size <= 0 || file.size > MAX_LAB_FILE_BYTES) return "Saiz fail mesti antara 1 bait dan 8 MB."
  if (extension === "pdf" && file.type === "application/pdf" && starts(PDF_MAGIC)) return null
  if ((extension === "jpg" || extension === "jpeg") && (file.type === "image/jpeg" || file.type === "image/jpg") && starts(JPEG_MAGIC)) return null
  if (extension === "png" && file.type === "image/png" && starts(PNG_MAGIC)) return null
  return "Hanya PDF, JPG atau PNG yang sepadan dengan kandungannya diterima."
}
