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
  const nousKey = process.env.NOUS_API_KEY?.trim() || ""
  const openAiKey = process.env.OPENAI_API_KEY?.trim() || ""
  if (!key && !generate && !mistralKey && !nousKey && !openAiKey) {
    return { ok: false, errorCode: "tiada-enjin", errorMessage: "Tetapkan sekurang-kurangnya satu kunci API OCR pada pelayan." }
  }

  const model = selectedGeminiModel()
  const mime = geminiMime(kind)
  const data = bytesToBase64(bytes)
  let mistralText = ""
  const errors: string[] = []
  const resultModel = (name: string, result: NonNullable<ReturnType<typeof validateAndMap>>) => ({
    ok: true as const,
    payload: result.payload,
    extract: { ...result.report, model: name, rejected: result.rejected },
  })

  // OCR first: Mistral is the preferred document reader.
  if (mistralKey) {
    try {
      mistralText = await requestMistralOcr({ bytes, mime, key: mistralKey })
      if (!mistralText.trim()) throw new Error("Mistral OCR tidak menemui teks pada laporan.")
    } catch (error) {
      errors.push("Mistral OCR: " + sanitiseError(error))
    }
  }

  // Nous Research is the PRIMARY structuring model whenever OCR text is available.
  if (nousKey && mistralText.trim()) {
    try {
      const text = await requestNousText({ text: mistralText, key: nousKey })
      const result = validateAndMap(text)
      if (result) return resultModel("mistral-ocr-latest + nous", result)
      throw new Error("Nous tidak menghasilkan struktur keputusan makmal yang sah.")
    } catch (error) {
      errors.push("Nous: " + sanitiseError(error))
    }
  }

  // Gemini is the next fallback. It can structure OCR text, or read the source document directly.
  if (key || generate) {
    if (key && mistralText.trim()) {
      try {
        const text = await requestGeminiText({ model, text: mistralText, key })
        const result = validateAndMap(text)
        if (result) return resultModel("mistral-ocr-latest + " + model, result)
        throw new Error("Gemini tidak menghasilkan struktur keputusan makmal yang sah.")
      } catch (error) {
        errors.push("Gemini teks OCR: " + sanitiseError(error))
      }
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const text = generate
          ? await generate({ model, mime, data })
          : bytes.length <= 4 * 1024 * 1024
            ? await requestGemini({ model, mime, data, key })
            : await requestGeminiFileApi({ model, mime, bytes, name: file.name, key })
        const result = validateAndMap(text)
        if (!result) throw new Error("Gemini tidak memulangkan keputusan makmal yang sah.")
        return resultModel(model, result)
      } catch (error) {
        errors.push("Gemini dokumen: " + sanitiseError(error))
        if (!isTransient(error) || attempt === 1) break
      }
    }
  }

  // OpenAI is an additional independent fallback for OCR text.
  // It is intentionally not sent the original document here: Mistral remains the OCR layer.
  if (openAiKey && mistralText.trim()) {
    try {
      const text = await requestOpenAiText({ text: mistralText, key: openAiKey })
      const result = validateAndMap(text)
      if (result) return resultModel("mistral-ocr-latest + " + (process.env.OPENAI_LAB_MODEL?.trim() || "gpt-4.1"), result)
      throw new Error("OpenAI tidak menghasilkan struktur keputusan makmal yang sah.")
    } catch (error) {
      errors.push("OpenAI: " + sanitiseError(error))
    }
  }

  // If Nous is configured but Mistral OCR failed, do not pretend Nous read the source file.
  if (nousKey && !mistralText.trim()) {
    errors.push("Nous: memerlukan teks OCR Mistral; OCR sumber tidak berjaya.")
  }

  return {
    ok: false,
    errorCode: "semua-enjin-gagal",
    errorMessage: errors.length
      ? errors.join("; ") + ". Semak keputusan secara manual; tiada nilai dibetulkan secara automatik."
      : "Tiada enjin ekstraksi yang dikonfigurasi. Tetapkan NOUS_API_KEY dan MISTRAL_API_KEY untuk laluan utama.",
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


async function requestOpenAiText(input: { text: string; key: string }) {
  const model = process.env.OPENAI_LAB_MODEL?.trim() || "gpt-4.1"
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: "Bearer " + input.key, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: GEMINI_EXTRACT_PROMPT + "\n\nTEKS OCR (sumber sahaja, jangan tambah maklumat):\n" + input.text }],
      response_format: { type: "json_object" },
      temperature: 0,
    }),
    signal: AbortSignal.timeout(60000),
  })
  if (!response.ok) throw new Error("OpenAI API HTTP " + response.status + ".")
  const result = await response.json() as { choices?: Array<{ message?: { content?: string | null } }> }
  const text = result.choices?.[0]?.message?.content?.trim() || ""
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
