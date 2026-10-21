import { requestLabExtract } from "@/lib/lab-gemini-client"
import { textFromGeminiReport } from "@/lib/lab-gemini"
import { labFileKind, type ParsedObservation } from "@/lib/lab-parse"

export const PATIENT_STATUS = {
  waiting: "Menunggu pemprosesan.",
  reading: "Sedang membaca laporan.",
  found: "Keputusan ditemui — perlu semakan.",
  failed: "Ekstraksi tidak berjaya — sila cuba kaedah lain atau masukkan keputusan secara manual.",
} as const

export type ExtractionMethod = "gemini" | "pdf-teks" | "ocr" | "pdf-teks+ocr" | "tiada"

export type ExtractionDiagnostic = {
  documentId: string | null
  attemptId: string
  stage: "validasi" | "teks" | "ocr" | "parse" | "selesai" | "gagal"
  method: ExtractionMethod
  pageCount: number | null
  pagesRead: number
  pagesFailed: number
  selectableText: boolean
  textLength: number
  candidates: number
  needsReview: number
  durationMs: number
  errorCode: string | null
  errorMessage: string | null
  provider: string | null
}

export type ExtractionOutcome = {
  text: string
  patientStatus: string
  observations: ParsedObservation[]
  reportDate: string | null
  dateUncertain: boolean
  diagnostic: ExtractionDiagnostic
}

type TextItem = {
  str?: string
  transform?: number[]
  width?: number
  height?: number
}

type OcrError = Error & { code?: string }

export function textIsUseful(text: string) {
  const compact = text.replace(/\s+/g, "")
  if (compact.length < 12 || !/\d/.test(text)) return false
  const broken = text.match(/\uFFFD/g)?.length ?? 0
  return broken <= compact.length * 0.2
}

function textIsReadable(text: string) {
  const compact = text.replace(/\s+/g, "")
  if (compact.length < 4 || !/\d/.test(text)) return false
  const broken = text.match(/\uFFFD/g)?.length ?? 0
  return broken <= compact.length * 0.2
}

export function linesFromTextItems(items: TextItem[]) {
  const positioned = items.flatMap((item) => {
    const str = item.str ?? ""
    if (!str.trim()) return []
    const height = item.height || Math.hypot(item.transform?.[2] ?? 0, item.transform?.[3] ?? 0) || 10
    return [{ str, x: item.transform?.[4] ?? 0, y: item.transform?.[5] ?? 0, width: item.width ?? str.length * height * 0.5, height }]
  })
  const lines: (typeof positioned)[] = []
  for (const item of [...positioned].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const line = lines.find((group) => Math.abs(group[0].y - item.y) <= Math.max(group[0].height, item.height) * 0.6)
    if (line) line.push(item)
    else lines.push([item])
  }
  return lines.map((group) => {
    let text = ""
    let end = Number.NEGATIVE_INFINITY
    for (const item of [...group].sort((a, b) => a.x - b.x)) {
      if (text && item.x - end > Math.max(1.5, item.height * 0.15)) text += " "
      text += item.str
      end = Math.max(end, item.x + item.width)
    }
    return text.trim()
  }).filter(Boolean)
}

function copyBytes(bytes: Uint8Array) {
  return new Uint8Array(bytes)
}

export function sanitiseError(error: unknown) {
  const message = error instanceof Error ? error.message : "Ralat tidak diketahui"
  return message.replace(/(?:file:|https?:)\/\/\S+/gi, "[laluan]").replace(/\/[A-Za-z0-9._/-]{8,}/g, "[laluan]").slice(0, 180)
}

function blankDiagnostic(attemptId: string): ExtractionDiagnostic {
  return {
    documentId: null,
    attemptId,
    stage: "validasi",
    method: "tiada",
    pageCount: null,
    pagesRead: 0,
    pagesFailed: 0,
    selectableText: false,
    textLength: 0,
    candidates: 0,
    needsReview: 0,
    durationMs: 0,
    errorCode: null,
    errorMessage: null,
    provider: null,
  }
}

async function nodeCanvas() {
  const load = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<unknown>
  return load("@napi-rs/canvas")
}

async function renderPage(bytes: Uint8Array, pageNumber: number) {
  const { renderPageAsImage } = await import("unpdf")
  const options: { scale: number; canvasImport?: () => Promise<unknown> } = { scale: 2 }
  if (typeof window === "undefined") options.canvasImport = nodeCanvas
  const rendered = await renderPageAsImage(copyBytes(bytes), pageNumber, options as { scale: number; canvasImport?: () => Promise<typeof import("@napi-rs/canvas")> })
  return rendered instanceof Uint8Array ? new Uint8Array(rendered) : new Uint8Array(rendered)
}

function ocrOptions() {
  if (typeof window === "undefined") {
    return { cachePath: "/tmp/ppd-tesseract", gzip: false as const }
  }
  const origin = window.location.origin
  return {
    workerPath: `${origin}/tesseract/worker.min.js`,
    corePath: `${origin}/tesseract/core`,
    langPath: `${origin}/tesseract/lang`,
    gzip: true,
    workerBlobURL: false,
  }
}

async function startRecognizer(): Promise<{ recognize: (bytes: Uint8Array, mime: string) => Promise<string>; terminate: () => Promise<unknown> }> {
  if (process.env.PPD_OCR === "off") {
    const error = new Error("OCR tempatan dimatikan.") as OcrError
    error.code = "ocr-tidak-tersedia"
    throw error
  }
  const { createWorker } = await import("tesseract.js")
  let last: unknown = null
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const worker = await createWorker("eng", undefined, { ...ocrOptions(), errorHandler: () => {} })
      return {
        recognize: async (bytes: Uint8Array, mime: string) => {
          const image = typeof window === "undefined" ? Buffer.from(bytes) : new Blob([new Uint8Array(bytes)], { type: mime })
          try {
            const rotated = await worker.recognize(image, { rotateAuto: true })
            return rotated.data.text ?? ""
          } catch {
            const plain = await worker.recognize(image)
            return plain.data.text ?? ""
          }
        },
        terminate: () => worker.terminate(),
      }
    } catch (error) {
      last = error
      const coded = error as OcrError
      if (coded.code === "ocr-tidak-tersedia") break
      const transient = /network|fetch|timeout|timed out/i.test(sanitiseError(error))
      if (!transient || attempt === 1) break
    }
  }
  throw last instanceof Error ? last : new Error("OCR gagal dimulakan")
}

async function pageText(pdf: { getPage: (page: number) => Promise<{ getTextContent: () => Promise<{ items: unknown[] }>; getOperatorList: () => Promise<unknown> }> }, pageNumber: number) {
  const page = await pdf.getPage(pageNumber)
  const readableItems = (items: unknown[]) => items.filter((item): item is TextItem => typeof item === "object" && item != null && "str" in item)
  let content = await page.getTextContent()
  let lines = linesFromTextItems(readableItems(content.items))
  if (!textIsUseful(lines.join("\n"))) {
    await page.getOperatorList()
    content = await page.getTextContent()
    lines = linesFromTextItems(readableItems(content.items))
  }
  return lines
}

function pdfOptions() {
  if (typeof window === "undefined") return { disableFontFace: true }
  return {
    disableFontFace: true,
    useSystemFonts: true,
    cMapUrl: `${window.location.origin}/pdfjs/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${window.location.origin}/pdfjs/standard_fonts/`,
  }
}

export async function extractReport(
  bytes: Uint8Array,
  file: { name: string; type: string },
  options?: { gemini?: typeof requestLabExtract | null },
): Promise<ExtractionOutcome> {
  const started = Date.now()
  const attemptId = crypto.randomUUID()
  const diagnostic = blankDiagnostic(attemptId)
  const empty = { observations: [] as ParsedObservation[], reportDate: null as string | null, dateUncertain: true }
  const kind = labFileKind(file, bytes)
  if (!kind) {
    diagnostic.stage = "gagal"
    diagnostic.errorCode = "fail-tidak-sah"
    diagnostic.errorMessage = "Kandungan fail tidak sepadan dengan PDF, JPG atau PNG."
    diagnostic.durationMs = Date.now() - started
    return { text: "", patientStatus: PATIENT_STATUS.failed, diagnostic, ...empty }
  }
  const requestGemini = options?.gemini === undefined ? requestLabExtract : options.gemini
  if (requestGemini) {
    diagnostic.stage = "teks"
    let gemini: Awaited<ReturnType<typeof requestLabExtract>> = null
    try {
      gemini = await requestGemini(bytes, file)
    } catch (error) {
      diagnostic.errorCode = "gemini-gagal"
      diagnostic.errorMessage = sanitiseError(error)
    }
    if (gemini?.ok) {
      const text = textFromGeminiReport(gemini.extract)
      diagnostic.method = "gemini"
      diagnostic.provider = gemini.extract.model
      diagnostic.selectableText = false
      diagnostic.pageCount = kind === "pdf" ? null : 1
      diagnostic.pagesRead = 1
      diagnostic.textLength = text.length
      diagnostic.candidates = gemini.extract.observations.length
      diagnostic.needsReview = gemini.extract.observations.filter((item) => item.uncertain).length
      diagnostic.stage = "parse"
      diagnostic.durationMs = Date.now() - started
      return {
        text,
        patientStatus: PATIENT_STATUS.found,
        observations: gemini.extract.observations,
        reportDate: gemini.extract.reportDate,
        dateUncertain: gemini.extract.dateUncertain,
        diagnostic,
      }
    }
    if (gemini && gemini.errorCode !== "gemini-tidak-tersedia") {
      diagnostic.errorCode = gemini.errorCode
      diagnostic.errorMessage = gemini.errorMessage
    }
  }

  const sections: string[] = []
  let usedText = false
  let usedOcr = false
  const session: { recognizer: { recognize: (bytes: Uint8Array, mime: string) => Promise<string>; terminate: () => Promise<unknown> } | null } = { recognizer: null }
  const ocrPage = async (image: Uint8Array, mime: string, label: string) => {
    try {
      session.recognizer ??= await startRecognizer()
      const text = await session.recognizer.recognize(image, mime)
      if (!text.trim()) {
        diagnostic.pagesFailed += 1
        diagnostic.errorCode = "ocr-kosong"
        diagnostic.errorMessage = `${label}: OCR tidak menemui teks.`
        return ""
      }
      usedOcr = true
      diagnostic.pagesRead += 1
      return text.trim()
    } catch (error) {
      diagnostic.pagesFailed += 1
      const coded = error as OcrError
      diagnostic.errorCode = coded.code === "ocr-tidak-tersedia" ? "ocr-tidak-tersedia" : "ocr-gagal"
      diagnostic.errorMessage = `${label}: ${sanitiseError(error)}`
      return ""
    }
  }
  try {
    if (kind === "pdf") {
      diagnostic.stage = "teks"
      const { getDocumentProxy } = await import("unpdf")
      const pdf = await getDocumentProxy(copyBytes(bytes), pdfOptions())
      diagnostic.pageCount = pdf.numPages
      try {
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          let text = ""
          try {
            text = (await pageText(pdf, pageNumber)).join("\n")
          } catch (error) {
            diagnostic.errorCode = "pdf-halaman"
            diagnostic.errorMessage = `Halaman ${pageNumber}: ${sanitiseError(error)}`
          }
          if (textIsUseful(text)) {
            usedText = true
            diagnostic.selectableText = true
            diagnostic.pagesRead += 1
            sections.push(`Halaman ${pageNumber}\n${text}`)
            continue
          }
          diagnostic.stage = "ocr"
          let png: Uint8Array
          try {
            png = await renderPage(bytes, pageNumber)
          } catch (error) {
            diagnostic.pagesFailed += 1
            diagnostic.errorCode = "ocr-gagal"
            diagnostic.errorMessage = `Halaman ${pageNumber}: ${sanitiseError(error)}`
            if (textIsReadable(text)) sections.push(`Halaman ${pageNumber}\n${text}`)
            continue
          }
          const ocrText = await ocrPage(png, "image/png", `Halaman ${pageNumber}`)
          if (textIsReadable(ocrText)) sections.push(`Halaman ${pageNumber}\n${ocrText}`)
          else if (textIsReadable(text)) sections.push(`Halaman ${pageNumber}\n${text}`)
        }
      } finally {
        const closable = pdf as { destroy?: () => Promise<void> }
        if (typeof closable.destroy === "function") {
          try {
            await closable.destroy()
          } catch {
            // Menutup pembaca PDF bukan kegagalan bacaan.
          }
        }
      }
    } else {
      diagnostic.stage = "ocr"
      diagnostic.pageCount = 1
      const ocrText = await ocrPage(bytes, kind === "png" ? "image/png" : "image/jpeg", "Imej")
      if (ocrText) sections.push(ocrText)
    }
  } catch (error) {
    diagnostic.stage = "gagal"
    const coded = error as OcrError
    diagnostic.errorCode = diagnostic.errorCode ?? (coded.code === "ocr-tidak-tersedia" ? "ocr-tidak-tersedia" : kind === "pdf" ? "pdf-rosak" : "ocr-gagal")
    diagnostic.errorMessage = diagnostic.errorMessage ?? sanitiseError(error)
  } finally {
    await session.recognizer?.terminate()
  }

  const text = sections.map((section) => section.trim()).filter(Boolean).join("\n")
  const readable = textIsReadable(text)
  diagnostic.method = usedText && usedOcr ? "pdf-teks+ocr" : usedOcr ? "ocr" : usedText ? "pdf-teks" : "tiada"
  diagnostic.textLength = text.length
  diagnostic.stage = readable ? "parse" : "gagal"
  if (!readable && !diagnostic.errorCode) {
    diagnostic.errorCode = "tiada-teks"
    diagnostic.errorMessage = "Teks pilihan dan OCR tidak menemui nombor yang boleh dibaca."
  }
  diagnostic.durationMs = Date.now() - started
  return {
    text: readable ? text : "",
    patientStatus: readable ? PATIENT_STATUS.found : PATIENT_STATUS.failed,
    observations: [],
    reportDate: null,
    dateUncertain: true,
    diagnostic,
  }
}

export async function textFromPdfBytes(bytes: Uint8Array) {
  const outcome = await extractReport(bytes, { name: "laporan.pdf", type: "application/pdf" })
  return outcome.text
}
