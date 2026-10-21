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

export function geminiApiKey() {
  // Kept as a compatibility shim for existing callers; Gemini is no longer used.
  return ""
}

export async function extractWithGemini(
  bytes: Uint8Array,
  file: { name: string; type: string },
): Promise<GeminiServerResult> {
  const problem = validateLabFile({ name: file.name, type: file.type, size: bytes.length }, bytes)
  if (problem) return { ok: false, errorCode: "fail-tidak-sah", errorMessage: problem }
  const kind = labFileKind(file, bytes)
  if (!kind) return { ok: false, errorCode: "fail-tidak-sah", errorMessage: "Kandungan fail tidak sepadan dengan PDF, JPG atau PNG." }

  const mistralKey = process.env.MISTRAL_API_KEY?.trim() || ""
  const nousKey = process.env.NOUS_API_KEY?.trim() || ""
  if (!mistralKey || !nousKey) {
    const missing = [!mistralKey ? "MISTRAL_API_KEY" : "", !nousKey ? "NOUS_API_KEY" : ""].filter(Boolean).join(" dan ")
    return { ok: false, errorCode: "tiada-enjin", errorMessage: "Tetapkan " + missing + " pada pelayan Netlify. Laluan ekstraksi hanya menggunakan Mistral OCR dan Nous Research." }
  }

  try {
    // Mistral is the only OCR provider. Nous Research is the only model used to structure OCR text.
    const ocrText = await requestMistralOcr({ bytes, mime: kind === "pdf" ? "application/pdf" : kind === "png" ? "image/png" : "image/jpeg", key: mistralKey })
    if (!ocrText.trim()) throw new Error("Mistral OCR tidak menemui teks pada laporan.")

    const structuredText = await requestNousText({ text: ocrText, key: nousKey })
    const parsed = validateAndMap(structuredText)
    if (!parsed) throw new Error("Nous tidak menghasilkan struktur keputusan makmal yang sah.")

    return {
      ok: true,
      payload: parsed.payload,
      extract: { ...parsed.report, model: "mistral-ocr-latest + nous", rejected: parsed.rejected },
    }
  } catch (error) {
    return {
      ok: false,
      errorCode: "ekstrak-gagal",
      errorMessage: sanitiseError(error) + ". Laluan ini hanya menggunakan Mistral OCR dan Nous Research. Semak keputusan secara manual; tiada nilai dibetulkan secara automatik.",
    }
  }
}

function validateAndMap(text: string) {
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { return null }
  const validated = validateGeminiPayload(parsed)
  if (!validated.payload) return null
  const mapped = observationsFromGemini(validated.payload)
  if (mapped.report.observations.length === 0) return null
  return { payload: validated.payload, report: mapped.report, rejected: mapped.rejected }
}

async function requestMistralOcr(input: { bytes: Uint8Array; mime: string; key: string }) {
  const base64 = bytesToBase64(input.bytes)
  const isPdf = input.mime === "application/pdf"
  const document = isPdf
    ? { type: "document_url", document_url: "data:application/pdf;base64," + base64 }
    : { type: "image_url", image_url: "data:" + input.mime + ";base64," + base64 }
  const response = await fetch("https://api.mistral.ai/v1/ocr", {
    method: "POST",
    headers: { Authorization: "Bearer " + input.key, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "mistral-ocr-latest", document, table_format: "markdown", include_blocks: true }),
    signal: AbortSignal.timeout(45000),
  })
  if (!response.ok) throw new Error("Mistral OCR HTTP " + response.status + ".")
  const result = await response.json() as { pages?: Array<{ markdown?: string }> }
  return (result.pages ?? []).map((page, index) => "Halaman " + (index + 1) + ":\n" + (page.markdown ?? "")).join("\n\n").slice(0, 120000)
}

async function requestNousText(input: { text: string; key: string }) {
  const baseUrl = (process.env.NOUS_API_BASE_URL?.trim() || "https://inference-api.nousresearch.com/v1").replace(/\/$/, "")
  const response = await fetch(baseUrl + "/chat/completions", {
    method: "POST",
    headers: { Authorization: "Bearer " + input.key, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.NOUS_LAB_MODEL?.trim() || "Hermes-4-70B",
      messages: [{ role: "user", content: GEMINI_EXTRACT_PROMPT + "\n\nTEKS OCR (sumber sahaja, jangan tambah maklumat):\n" + input.text }],
      response_format: { type: "json_object" },
      temperature: 0,
    }),
    signal: AbortSignal.timeout(60000),
  })
  if (!response.ok) throw new Error("Nous Research API HTTP " + response.status + ".")
  const result = await response.json() as { choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }> }
  const content = result.choices?.[0]?.message?.content
  const text = typeof content === "string" ? content.trim() : Array.isArray(content) ? content.map(part => part.text || "").join("\n").trim() : ""
  if (!text) throw new Error("Nous tidak memulangkan struktur keputusan.")
  return text
}
