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

// Kept for compatibility with existing callers; this extraction path uses OpenAI only.
export function geminiApiKey() {
  return process.env.OPENAI_API_KEY?.trim() || ""
}

export async function extractWithGemini(
  bytes: Uint8Array,
  file: { name: string; type: string },
): Promise<GeminiServerResult> {
  const problem = validateLabFile({ name: file.name, type: file.type, size: bytes.length }, bytes)
  if (problem) return { ok: false, errorCode: "fail-tidak-sah", errorMessage: problem }
  const kind = labFileKind(file, bytes)
  if (!kind) return { ok: false, errorCode: "fail-tidak-sah", errorMessage: "Kandungan fail tidak sepadan dengan PDF, JPG atau PNG." }

  const apiKey = process.env.OPENAI_API_KEY?.trim() || ""
  if (!apiKey) {
    return { ok: false, errorCode: "tiada-enjin", errorMessage: "Tetapkan OPENAI_API_KEY pada environment pelayan Netlify. Laluan ekstraksi menggunakan OpenAI GPT-4o Vision sahaja." }
  }

  try {
    const payload = await requestOpenAiVision({ bytes, kind, fileName: file.name, key: apiKey })
    const parsed = validateAndMap(payload)
    if (!parsed) throw new Error("OpenAI tidak menghasilkan struktur keputusan makmal yang sah.")

    return {
      ok: true,
      payload: parsed.payload,
      extract: { ...parsed.report, model: process.env.OPENAI_LAB_MODEL?.trim() || "gpt-4o", rejected: parsed.rejected },
    }
  } catch (error) {
    return {
      ok: false,
      errorCode: "ekstrak-gagal",
      errorMessage: sanitiseError(error) + ". Laluan ini hanya menggunakan OpenAI GPT-4o Vision. Semak keputusan secara manual; tiada nilai dibetulkan secara automatik.",
    }
  }
}

function validateAndMap(raw: unknown) {
  const validated = validateGeminiPayload(raw)
  if (!validated.payload) return null
  const mapped = observationsFromGemini(validated.payload)
  if (mapped.report.observations.length === 0) return null
  return { payload: validated.payload, report: mapped.report, rejected: mapped.rejected }
}

async function requestOpenAiVision(input: { bytes: Uint8Array; kind: "pdf" | "png" | "jpeg"; fileName: string; key: string }) {
  const base64 = bytesToBase64(input.bytes)
  const content = input.kind === "pdf"
    ? [
        { type: "input_file", filename: input.fileName.toLowerCase().endsWith(".pdf") ? input.fileName : "laporan.pdf", file_data: "data:application/pdf;base64," + base64, detail: "high" },
        { type: "input_text", text: GEMINI_EXTRACT_PROMPT },
      ]
    : [
        { type: "input_image", image_url: "data:" + (input.kind === "png" ? "image/png" : "image/jpeg") + ";base64," + base64, detail: "high" },
        { type: "input_text", text: GEMINI_EXTRACT_PROMPT },
      ]

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: "Bearer " + input.key, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_LAB_MODEL?.trim() || "gpt-4o",
      input: [{ role: "user", content }],
      text: { format: { type: "json_object" } },
      max_output_tokens: 12000,
      store: false,
    }),
    signal: AbortSignal.timeout(90000),
  })
  if (!response.ok) throw new Error("OpenAI API HTTP " + response.status + ".")
  const result = await response.json() as {
    output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>
    output_text?: string
    error?: { message?: string }
  }
  const outputText = result.output_text?.trim() || (result.output ?? [])
    .flatMap(item => item.content ?? [])
    .filter(part => part.type === "output_text" && typeof part.text === "string")
    .map(part => part.text)
    .join("\n")
    .trim()
  if (!outputText) throw new Error("OpenAI tidak memulangkan teks keputusan.")
  let parsed: unknown
  try { parsed = JSON.parse(outputText) } catch { throw new Error("Balasan OpenAI bukan JSON yang sah.") }
  return parsed
}
