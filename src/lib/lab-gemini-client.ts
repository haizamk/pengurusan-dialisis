import { getSupabase } from "@/lib/supabase"
import { MAX_GEMINI_FILE_BYTES, observationsFromGemini, validateGeminiPayload, type GeminiExtract } from "@/lib/lab-gemini"

export type GeminiClientResult =
  | { ok: true; extract: GeminiExtract }
  | { ok: false; errorCode: string; errorMessage: string }

export async function requestLabExtract(
  bytes: Uint8Array,
  file: { name: string; type: string },
): Promise<GeminiClientResult | null> {
  if (typeof window === "undefined") return null
  if (bytes.length > MAX_GEMINI_FILE_BYTES) return { ok: false, errorCode: "fail-terlalu-besar", errorMessage: "Fail melebihi had 20 MB untuk ekstraksi AI." }
  const form = new FormData()
  form.append("file", new Blob([new Uint8Array(bytes)], { type: file.type || "application/octet-stream" }), file.name)
  const headers: Record<string, string> = {}
  const supabase = getSupabase()
  if (!supabase) {
    return { ok: false, errorCode: "supabase-tidak-dikonfigurasi", errorMessage: "Pengesahan Supabase tidak tersedia pada pelayar." }
  }
  let sessionResult
  try {
    sessionResult = await supabase.auth.getSession()
  } catch {
    return { ok: false, errorCode: "sesi-tidak-dapat-dibaca", errorMessage: "Sesi log masuk tidak dapat dibaca. Muat semula halaman dan cuba lagi." }
  }
  if (sessionResult.error) {
    return { ok: false, errorCode: "sesi-tidak-dapat-dibaca", errorMessage: "Sesi log masuk tidak dapat disahkan pada pelayar. Muat semula halaman dan cuba lagi." }
  }
  const accessToken = sessionResult.data.session?.access_token
  if (!accessToken) {
    return { ok: false, errorCode: "sesi-tidak-ditemui", errorMessage: "Tiada sesi log masuk pesakit pada pelayar. Log masuk semula sebelum mengekstrak laporan." }
  }
  headers.Authorization = `Bearer ${accessToken}`
  let response: Response
  try {
    response = await fetch("/api/lab-extract", { method: "POST", body: form, headers })
  } catch (error) {
    return {
      ok: false,
      errorCode: "ekstrak-gagal",
      errorMessage: error instanceof Error ? error.message.slice(0, 180) : "Tidak dapat menghubungi pelayan ekstraksi.",
    }
  }
  let body: Record<string, unknown> = {}
  try {
    body = await response.json() as Record<string, unknown>
  } catch {
    body = {}
  }
  if (response.status === 503 && (body.errorCode === "nous-tidak-tersedia" || body.errorCode === "supabase-tidak-dikonfigurasi")) {
    return { ok: false, errorCode: String(body.errorCode), errorMessage: String(body.errorMessage ?? "Perkhidmatan ekstraksi belum dikonfigurasi.") }
  }
  if (!response.ok) {
    return {
      ok: false,
      errorCode: typeof body.errorCode === "string" ? body.errorCode : "ekstrak-gagal",
      errorMessage: typeof body.errorMessage === "string" ? body.errorMessage : "Ekstraksi laporan gagal.",
    }
  }
  const validated = validateGeminiPayload(body.payload)
  if (!validated.payload) {
    return { ok: false, errorCode: "ekstrak-skema", errorMessage: validated.error ?? "Format keputusan daripada model melalui Nous tidak sah." }
  }
  const mapped = observationsFromGemini(validated.payload)
  if (mapped.report.observations.length === 0) {
    return { ok: false, errorCode: "ekstrak-kosong", errorMessage: "Model melalui Nous tidak menemui keputusan yang boleh disimpan." }
  }
  return {
    ok: true,
    extract: {
      ...mapped.report,
      model: typeof body.model === "string" ? body.model : "openai/gpt-4o via Nous",
      rejected: mapped.rejected,
    },
  }
}
