import { GoogleGenAI, MediaResolution, createPartFromUri } from "@google/genai"
import { labFileKind, validateLabFile } from "@/lib/lab-parse"
import {
  DEFAULT_GEMINI_MODEL,
  GEMINI_EXTRACT_PROMPT,
  GEMINI_RESPONSE_SCHEMA,
  geminiMime,
  observationsFromGemini,
  selectedGeminiModel,
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

function isTransient(error: unknown) {
  const message = sanitiseError(error)
  return /429|503|unavailable|timeout|timed out|network|fetch/i.test(message)
}

export function geminiApiKey() {
  return process.env.GEMINI_API_KEY?.trim() || ""
}

export async function extractWithGemini(
  bytes: Uint8Array,
  file: { name: string; type: string },
  generate?: (args: { model: string; mime: string; data: string }) => Promise<string>,
): Promise<GeminiServerResult> {
  const problem = validateLabFile({ name: file.name, type: file.type, size: bytes.length }, bytes)
  if (problem) return { ok: false, errorCode: "fail-tidak-sah", errorMessage: problem }
  const kind = labFileKind(file, bytes)
  if (!kind) return { ok: false, errorCode: "fail-tidak-sah", errorMessage: "Kandungan fail tidak sepadan dengan PDF, JPG atau PNG." }
  const key = geminiApiKey()
  const mistralKey = process.env.MISTRAL_API_KEY?.trim() || ""
  const openaiKey = process.env.OPENAI_API_KEY?.trim() || ""
  if (!key && !generate && !mistralKey && !openaiKey) {
    return { ok: false, errorCode: "tiada-enjin", errorMessage: "Tetapkan sekurang-kurangnya satu kunci API OCR pada pelayan." }
  }
  const model = selectedGeminiModel()
  const mime = geminiMime(kind)
  const data = bytesToBase64(bytes)
  let mistralText = ""
  let mistralError: unknown = null
  let geminiError: unknown = null

  // 1) Mistral reads the source document first.
  if (mistralKey) {
    try {
      mistralText = await requestMistralOcr({ bytes, mime, key: mistralKey })
      if (!mistralText.trim()) throw new Error("Mistral OCR tidak menemui teks pada laporan.")
      if (key) {
        try {
          const text = await requestGeminiText({ model, text: mistralText, key })
          const result = validateAndMap(text)
          if (result) return { ok: true, payload: result.payload, extract: { ...result.report, model: "mistral-ocr-latest + " + model, rejected: result.rejected } }
          throw new Error("Struktur keputusan selepas OCR tidak sah.")
        } catch (error) {
          geminiError = error
        }
      }
      // Independent OpenAI structuring fallback if Gemini is unavailable or cannot structure OCR text.
      if (openaiKey) {
        const text = await requestOpenAiText({ text: mistralText, key: openaiKey })
        const result = validateAndMap(text)
        if (result) return { ok: true, payload: result.payload, extract: { ...result.report, model: "mistral-ocr-latest + openai", rejected: result.rejected } }
        throw new Error("OpenAI tidak menghasilkan struktur keputusan makmal yang sah.")
      }
    } catch (error) {
      mistralError = error
    }
  }

  // 2) Gemini direct-document extraction when the Mistral path did not return usable results.
  if (key || generate) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const text = generate
          ? await generate({ model, mime, data })
          : bytes.length <= 4 * 1024 * 1024
            ? await requestGemini({ model, mime, data, key })
            : await requestGeminiFileApi({ model, mime, bytes, name: file.name, key })
        const result = validateAndMap(text)
        if (!result) throw new Error("Gemini tidak memulangkan keputusan makmal yang sah.")
        return { ok: true, payload: result.payload, extract: { ...result.report, model, rejected: result.rejected } }
      } catch (error) {
        geminiError = error
        if (!isTransient(error) || attempt === 1) break
      }
    }
  }

  // 3) Independent OpenAI fallback. Prefer OCR text if Mistral succeeded; otherwise send the source file to OpenAI.
  if (openaiKey) {
    try {
      const text = mistralText.trim()
        ? await requestOpenAiText({ text: mistralText, key: openaiKey })
        : await requestOpenAiDocument({ bytes, mime, key: openaiKey })
      const result = validateAndMap(text)
      if (result) return { ok: true, payload: result.payload, extract: { ...result.report, model: mistralText.trim() ? "mistral-ocr-latest + openai" : "openai", rejected: result.rejected } }
      throw new Error("OpenAI tidak memulangkan keputusan makmal yang sah.")
    } catch (error) {
      return { ok: false, errorCode: "semua-enjin-gagal", errorMessage: "Mistral: " + sanitiseError(mistralError) + "; Gemini: " + sanitiseError(geminiError) + "; OpenAI: " + sanitiseError(error) + ". Semak keputusan secara manual; tiada nilai dibetulkan secara automatik." }
    }
  }

  return {
    ok: false,
    errorCode: "ekstrak-gagal",
    errorMessage: "Mistral: " + sanitiseError(mistralError) + "; Gemini: " + sanitiseError(geminiError) + (openaiKey ? "" : ". Sandaran OpenAI belum diaktifkan; tetapkan OPENAI_API_KEY pada Netlify."),
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

async function requestGeminiText(input: { model: string; text: string; key: string }) {
  const ai = new GoogleGenAI({ apiKey: input.key })
  const response = await ai.models.generateContent({
    model: input.model,
    contents: [{ text: GEMINI_EXTRACT_PROMPT + "\n\nTEKS OCR (sumber sahaja, jangan tambah maklumat):\n" + input.text }],
    config: { responseMimeType: "application/json", responseJsonSchema: GEMINI_RESPONSE_SCHEMA },
  })
  const text = response.text?.trim() ?? ""
  if (!text) throw new Error("Gemini tidak memulangkan struktur keputusan selepas OCR.")
  return text
}

async function requestOpenAiText(input: { text: string; key: string }) {
  return requestOpenAiResponse({
    key: input.key,
    input: GEMINI_EXTRACT_PROMPT + "\n\nTEKS OCR (sumber sahaja, jangan tambah maklumat):\n" + input.text,
  })
}

async function requestOpenAiDocument(input: { bytes: Uint8Array; mime: string; key: string }) {
  const dataUrl = "data:" + input.mime + ";base64," + bytesToBase64(input.bytes)
  const content = input.mime === "application/pdf"
    ? [{ type: "input_file", filename: "lab-report.pdf", file_data: dataUrl }]
    : [{ type: "input_image", image_url: dataUrl, detail: "high" }]
  return requestOpenAiResponse({ key: input.key, input: [{ role: "user", content: [{ type: "input_text", text: GEMINI_EXTRACT_PROMPT }, ...content] }] })
}

async function requestOpenAiResponse(input: { key: string; input: string | Array<Record<string, unknown>> }) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: "Bearer " + input.key, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_LAB_MODEL?.trim() || "gpt-4.1-mini",
      input: input.input,
      text: {
        format: {
          type: "json_schema",
          name: "lab_report_extraction",
          strict: true,
          schema: GEMINI_RESPONSE_SCHEMA,
        },
      },
    }),
    signal: AbortSignal.timeout(60000),
  })
  if (!response.ok) throw new Error("OpenAI API HTTP " + response.status + ".")
  const result = await response.json() as { output_text?: string }
  const text = result.output_text?.trim() ?? ""
  if (!text) throw new Error("OpenAI tidak memulangkan struktur keputusan.")
  return text
}

async function requestGemini(input: { model: string; mime: string; data: string; key: string }) {
  const ai = new GoogleGenAI({ apiKey: input.key })
  const response = await ai.models.generateContent({
    model: input.model,
    contents: [
      { inlineData: { mimeType: input.mime, data: input.data } },
      { text: GEMINI_EXTRACT_PROMPT },
    ],
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: GEMINI_RESPONSE_SCHEMA,
      mediaResolution: input.mime === "application/pdf" ? MediaResolution.MEDIA_RESOLUTION_MEDIUM : MediaResolution.MEDIA_RESOLUTION_HIGH,
    },
  })
  const text = response.text?.trim() ?? ""
  if (!text) throw new Error("Gemini memulangkan balasan kosong.")
  return text
}

export { DEFAULT_GEMINI_MODEL }

async function requestGeminiFileApi(input: { model: string; mime: string; bytes: Uint8Array; name: string; key: string }) {
  const ai = new GoogleGenAI({ apiKey: input.key })
  let uploaded: Awaited<ReturnType<typeof ai.files.upload>> | null = null
  try {
    const blob = new Blob([new Uint8Array(input.bytes)], { type: input.mime })
    uploaded = await ai.files.upload({ file: blob, config: { mimeType: input.mime, displayName: input.name.slice(0, 120) } })
    if (!uploaded.name || !uploaded.uri || !uploaded.mimeType) throw new Error("Gemini File API tidak memulangkan maklumat fail yang lengkap.")
    let current = uploaded
    const deadline = Date.now() + 25000
    while (current.state === "PROCESSING" && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      current = await ai.files.get({ name: uploaded.name })
    }
    if (current.state === "FAILED") throw new Error("Gemini gagal memproses fail laporan.")
    if (current.state === "PROCESSING") throw new Error("Pemprosesan fail Gemini mengambil masa terlalu lama. Cuba semula.")
    const response = await ai.models.generateContent({
      model: input.model,
      contents: [createPartFromUri(uploaded.uri, uploaded.mimeType), { text: GEMINI_EXTRACT_PROMPT }],
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: GEMINI_RESPONSE_SCHEMA,
        mediaResolution: input.mime === "application/pdf" ? MediaResolution.MEDIA_RESOLUTION_MEDIUM : MediaResolution.MEDIA_RESOLUTION_HIGH,
      },
    })
    const text = response.text?.trim() ?? ""
    if (!text) throw new Error("Gemini memulangkan balasan kosong.")
    return text
  } finally {
    if (uploaded?.name) {
      try { await ai.files.delete({ name: uploaded.name }) } catch { /* best-effort cleanup of temporary Gemini upload */ }
    }
  }
}
