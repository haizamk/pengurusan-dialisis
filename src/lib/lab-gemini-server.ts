import { getDocumentProxy, renderPageAsImage } from "unpdf"
import { labFileKind, validateLabFile } from "@/lib/lab-parse"
import {
  GEMINI_EXTRACT_PROMPT,
  observationsFromGemini,
  validateGeminiPayload,
  type GeminiExtract,
  type GeminiPayload,
} from "@/lib/lab-gemini"

function sanitiseError(error: unknown) {
  const message = error instanceof Error ? error.message : "Ralat tidak diketahui"
  return message.replace(/(?:file:|https?:)\/\/\S+/gi, "[laluan]").replace(/\/[A-Za-z0-9._/-]{8,}/g, "[laluan]").slice(0, 180)
}

export type GeminiServerResult =
  | { ok: true; extract: GeminiExtract; payload: GeminiPayload }
  | { ok: false; errorCode: string; errorMessage: string }

function bytesToBase64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64")
}

async function nodeCanvas() {
  return import("@napi-rs/canvas")
}

// Compatibility shim: provider is Nous Research, model is OpenAI GPT-4o hosted through Nous.
export function geminiApiKey() {
  return process.env.NOUS_API_KEY?.trim() || ""
}

export async function extractWithGemini(
  bytes: Uint8Array,
  file: { name: string; type: string },
): Promise<GeminiServerResult> {
  const problem = validateLabFile({ name: file.name, type: file.type, size: bytes.length }, bytes)
  if (problem) return { ok: false, errorCode: "fail-tidak-sah", errorMessage: problem }
  const kind = labFileKind(file, bytes)
  if (!kind) return { ok: false, errorCode: "fail-tidak-sah", errorMessage: "Kandungan fail tidak sepadan dengan PDF, JPG atau PNG." }

  const apiKey = process.env.NOUS_API_KEY?.trim() || ""
  if (!apiKey) {
    return { ok: false, errorCode: "tiada-enjin", errorMessage: "Tetapkan NOUS_API_KEY pada pelayan Netlify. Ekstraksi menggunakan model OpenAI GPT-4o melalui Nous Research." }
  }

  let stage = "penyediaan fail"
  try {
    const images = await documentImages(bytes, kind)
    stage = "permintaan Nous"
    const payload = await requestNousVision({ images, key: apiKey })
    stage = "pengesahan bacaan"
    const parsed = validateAndMap(payload)
    if (!parsed) throw new Error("Respons AI tiada bacaan yang dapat disahkan daripada teks sumber.")

    return {
      ok: true,
      payload: parsed.payload,
      extract: { ...parsed.report, model: process.env.NOUS_LAB_MODEL?.trim() || "openai/gpt-4o via Nous", rejected: parsed.rejected },
    }
  } catch (error) {
    return {
      ok: false,
      errorCode: "ekstrak-gagal",
      errorMessage: "Gagal pada peringkat " + stage + ": " + sanitiseError(error) + ". Rekod lama tidak diubah.",
    }
  }
}

async function documentImages(bytes: Uint8Array, kind: "pdf" | "png" | "jpeg") {
  if (kind !== "pdf") {
    return [{ mime: kind === "png" ? "image/png" : "image/jpeg", data: bytesToBase64(bytes) }]
  }
  const pdf = await getDocumentProxy(new Uint8Array(bytes))
  const pageCount = Math.min(pdf.numPages, 10)
  if (pdf.numPages > 10) throw new Error("PDF melebihi had 10 halaman untuk ekstraksi visual. Muat naik bahagian laporan yang berkaitan.")
  const images: Array<{ mime: string; data: string }> = []
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    // Reduce rendering cost for multi-page scanned PDFs within serverless execution limits.
    const options: { scale: number; canvasImport?: () => Promise<unknown> } = { scale: 1.5, canvasImport: nodeCanvas }
    const rendered = await renderPageAsImage(new Uint8Array(bytes), pageNumber, options as never)
    images.push({ mime: "image/png", data: bytesToBase64(new Uint8Array(rendered)) })
  }
  return images
}

function validateAndMap(raw: unknown) {
  const validated = validateGeminiPayload(raw)
  if (!validated.payload) return null
  const mapped = observationsFromGemini(validated.payload)
  if (mapped.report.observations.length === 0) return null
  return { payload: validated.payload, report: mapped.report, rejected: mapped.rejected }
}

async function requestNousVision(input: { images: Array<{ mime: string; data: string }>; key: string }) {
  const baseUrl = (process.env.NOUS_API_BASE_URL?.trim() || "https://inference-api.nousresearch.com/v1").replace(/\/$/, "")
  const instructions = GEMINI_EXTRACT_PROMPT + "\n\nPulangkan objek JSON sahaja dengan bentuk tepat: { sampleDate: string|null, dateUncertain: boolean, results: [{ name: string, valueText: string|null, unit: string|null, referenceRange: string|null, abnormalFlag: string|null, visibleText: string, uncertain: boolean, page: number|null }] }. Jangan tambah markdown atau teks di luar JSON. visibleText mesti mengandungi nilai yang sama tepat seperti valueText. Jika ragu, valueText=null dan uncertain=true. Setiap keputusan mesti berpandukan imej laporan sahaja."
  const content: Array<Record<string, unknown>> = [{ type: "text", text: instructions }]
  for (const [index, image] of input.images.entries()) {
    content.push({ type: "text", text: "Halaman " + (index + 1) })
    content.push({ type: "image_url", image_url: { url: "data:" + image.mime + ";base64," + image.data, detail: "high" } })
  }
  const response = await fetch(baseUrl + "/chat/completions", {
    method: "POST",
    headers: { Authorization: "Bearer " + input.key, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.NOUS_LAB_MODEL?.trim() || "openai/gpt-4o",
      messages: [{ role: "user", content }],
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 12000,
    }),
    // Netlify function budget is 60s; return a controlled failure before platform timeout.
    signal: AbortSignal.timeout(45000),
  })
  if (!response.ok) throw new Error("Nous API HTTP " + response.status + ".")
  const result = await response.json() as { choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }> }
  const output = result.choices?.[0]?.message?.content
  const text = typeof output === "string" ? output.trim() : Array.isArray(output) ? output.map(part => part.text || "").join("\n").trim() : ""
  if (!text) throw new Error("Nous tidak memulangkan teks keputusan.")
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { throw new Error("Balasan model melalui Nous bukan JSON yang sah.") }
  return parsed
}
