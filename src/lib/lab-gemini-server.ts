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
        return { ok: false, errorCode: "gemini-skema", errorMessage: "Balasan Gemini bukan JSON yang sah." }
      }
      const validated = validateGeminiPayload(parsed)
      if (!validated.payload) return { ok: false, errorCode: "gemini-skema", errorMessage: validated.error ?? "Skema Gemini ditolak." }
      const mapped = observationsFromGemini(validated.payload)
      if (mapped.report.observations.length === 0) {
        return { ok: false, errorCode: "gemini-kosong", errorMessage: "Gemini tidak menemui keputusan yang boleh disahkan daripada teks laporan." }
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
  return { ok: false, errorCode: "gemini-gagal", errorMessage: sanitiseError(last) }
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
