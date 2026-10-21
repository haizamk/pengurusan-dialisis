import { getSupabase } from "@/lib/supabase"
import { MAX_GEMINI_FILE_BYTES, observationsFromGemini, validateGeminiPayload, type GeminiExtract } from "@/lib/lab-gemini"

export type GeminiClientResult =
  | { ok: true; extract: GeminiExtract }
  | { ok: false; errorCode: string; errorMessage: string }

export async function requestLabExtract(
  bytes: Uint8Array,
  file: { name: string; type: string },
): Promise<GeminiClientResult | null> {
  if (typeof window === "undefined" || bytes.length > MAX_GEMINI_FILE_BYTES) return null
  const form = new FormData()
  form.append("file", new Blob([new Uint8Array(bytes)], { type: file.type || "application/octet-stream" }), file.name)
  const headers: Record<string, string> = {}
  const supabase = getSupabase()
  if (supabase) {
    const session = await supabase.auth.getSession()
    if (session.data.session?.access_token) headers.Authorization = `Bearer ${session.data.session.access_token}`
  }
  let response: Response
  try {
    response = await fetch("/api/lab-extract", { method: "POST", body: form, headers })
  } catch (error) {
    return {
      ok: false,
      errorCode: "gemini-gagal",
      errorMessage: error instanceof Error ? error.message.slice(0, 180) : "Tidak dapat menghubungi pelayan Gemini.",
    }
  }
  let body: Record<string, unknown> = {}
  try {
    body = await response.json() as Record<string, unknown>
  } catch {
    body = {}
  }
  if (response.status === 503 && body.errorCode === "gemini-tidak-tersedia") {
    return { ok: false, errorCode: "gemini-tidak-tersedia", errorMessage: String(body.errorMessage ?? "Gemini belum dikonfigurasi.") }
  }
  if (!response.ok) {
    return {
      ok: false,
      errorCode: typeof body.errorCode === "string" ? body.errorCode : "gemini-gagal",
      errorMessage: typeof body.errorMessage === "string" ? body.errorMessage : "Bacaan Gemini gagal.",
    }
  }
  const validated = validateGeminiPayload(body.payload)
  if (!validated.payload) {
    return { ok: false, errorCode: "gemini-skema", errorMessage: validated.error ?? "Skema Gemini ditolak." }
  }
  const mapped = observationsFromGemini(validated.payload)
  if (mapped.report.observations.length === 0) {
    return { ok: false, errorCode: "gemini-kosong", errorMessage: "Gemini tidak menemui keputusan yang boleh disahkan." }
  }
  return {
    ok: true,
    extract: {
      ...mapped.report,
      model: typeof body.model === "string" ? body.model : "gemini-3.8-flash",
      rejected: mapped.rejected,
    },
  }
}
