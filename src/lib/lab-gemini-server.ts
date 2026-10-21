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
  if (!key && !generate) {
    return { ok: false, errorCode: "gemini-tidak-tersedia", errorMessage: "Kunci GEMINI_API_KEY belum ditetapkan pada pelayan." }
  }
  const model = selectedGeminiModel()
  const mime = geminiMime(kind)
  const data = bytesToBase64(bytes)
  let last: unknown = null

  // Primary path: Mistral OCR reads the source document first; Gemini structures only the OCR text.
  const mistralKey = process.env.MISTRAL_API_KEY?.trim() || ""
  if (mistralKey && key) {
    try {
      const ocrText = await requestMistralOcr({ bytes, mime, key: mistralKey })
      if (!ocrText.trim()) throw new Error("Mistral OCR tidak menemui teks pada laporan.")
      const text = await requestGeminiText({ model, text: ocrText, key })
      const parsed = JSON.parse(text) as unknown
      const validated = validateGeminiPayload(parsed)
      if (!validated.payload) throw new Error(validated.error ?? "Struktur keputusan selepas OCR tidak sah.")
      const mapped = observationsFromGemini(validated.payload)
      if (mapped.report.observations.length === 0) throw new Error("OCR berjaya, tetapi tiada keputusan makmal dapat dikenal pasti.")
      return { ok: true, payload: validated.payload, extract: { ...mapped.report, model: "mistral-ocr-latest + " + model, rejected: mapped.rejected } }
    } catch (error) {
      last = error
      // Continue to Gemini direct-document fallback below.
    }
  }
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const text = generate
        ? await generate({ model, mime, data })
        : bytes.length <= 4 * 1024 * 1024
          ? await requestGemini({ model, mime, data, key })
          : await requestGeminiFileApi({ model, mime, bytes, name: file.name, key })
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        throw new Error("Balasan Gemini bukan JSON yang sah.")
      }
      const validated = validateGeminiPayload(parsed)
      if (!validated.payload) throw new Error(validated.error ?? "Skema Gemini ditolak.")
      const mapped = observationsFromGemini(validated.payload)
      if (mapped.report.observations.length === 0) {
        throw new Error("Gemini tidak menemui keputusan yang boleh disahkan daripada teks laporan.")
      }
      return {
        ok: true,
        payload: validated.payload,
        extract: {
          ...mapped.report,
          model,
          rejected: mapped.rejected,
        },
      }
    } catch (error) {
      last = error
      if (!isTransient(error) || attempt === 1) break
    }
  }
  return {
    ok: false,
    errorCode: "gemini-gagal",
    errorMessage: sanitiseError(last) + (mistralKey ? ". Laluan Mistral OCR dan Gemini gagal; semak log fungsi tanpa mendedahkan kunci API." : ". Sandaran Mistral OCR belum diaktifkan; tetapkan MISTRAL_API_KEY pada Netlify."),
  }
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
    contents: [{ text: GEMINI_EXTRACT_PROMPT + "\n\nTEKS OCR MISTRAL (sumber sahaja, jangan tambah maklumat):\n" + input.text }],
    config: { responseMimeType: "application/json", responseJsonSchema: GEMINI_RESPONSE_SCHEMA },
  })
  const text = response.text?.trim() ?? ""
  if (!text) throw new Error("Gemini tidak memulangkan struktur keputusan selepas OCR.")
  return text
}

async function requestGemini(input: { model: string; mime: string; data: string; key: string }) {
  const ai = new GoogleGenAI({ apiKey: input.key })
  const response = await ai.models.generateContent({
    model: input.model,
    contents: [
      {
        inlineData: {
          mimeType: input.mime,
          data: input.data,
        },
      },
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
    uploaded = await ai.files.upload({
      file: blob,
      config: { mimeType: input.mime, displayName: input.name.slice(0, 120) },
    })
    if (!uploaded.name || !uploaded.uri || !uploaded.mimeType) {
      throw new Error("Gemini File API tidak memulangkan maklumat fail yang lengkap.")
    }
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
      contents: [
        createPartFromUri(uploaded.uri, uploaded.mimeType),
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
  } finally {
    if (uploaded?.name) {
      try { await ai.files.delete({ name: uploaded.name }) } catch { /* best-effort cleanup of temporary Gemini upload */ }
    }
  }
}
