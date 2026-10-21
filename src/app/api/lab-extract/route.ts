import { createClient } from "@supabase/supabase-js"
import { labFileKind, validateLabFile } from "@/lib/lab-parse"
import { extractWithGemini, geminiApiKey } from "@/lib/lab-gemini-server"
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/supabase"

export const maxDuration = 60

async function authorised(request: Request) {
  if (!isSupabaseConfigured()) return true
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim()
  if (!token) return false
  const client = createClient(supabaseUrl(), supabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data, error } = await client.auth.getUser(token)
  return Boolean(data.user && !error)
}

export async function POST(request: Request) {
  if (!await authorised(request)) {
    return Response.json({ errorCode: "tidak-dibenarkan", errorMessage: "Sesi pesakit diperlukan untuk bacaan Gemini." }, { status: 401 })
  }
  if (!geminiApiKey()) {
    return Response.json({ errorCode: "gemini-tidak-tersedia", errorMessage: "Kunci GEMINI_API_KEY belum ditetapkan pada pelayan." }, { status: 503 })
  }
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return Response.json({ errorCode: "fail-tidak-sah", errorMessage: "Muat naik tidak dapat dibaca." }, { status: 400 })
  }
  const file = form.get("file")
  if (!(file instanceof File)) {
    return Response.json({ errorCode: "fail-tidak-sah", errorMessage: "Fail laporan tidak dihantar." }, { status: 400 })
  }
  const bytes = new Uint8Array(await file.arrayBuffer())
  const name = file.name || "laporan.pdf"
  const type = file.type || "application/octet-stream"
  const problem = validateLabFile({ name, type, size: bytes.length }, bytes)
  if (problem) return Response.json({ errorCode: "fail-tidak-sah", errorMessage: problem }, { status: 400 })
  if (!labFileKind({ name, type }, bytes)) {
    return Response.json({ errorCode: "fail-tidak-sah", errorMessage: "Kandungan fail tidak sepadan dengan PDF, JPG atau PNG." }, { status: 400 })
  }
  const result = await extractWithGemini(bytes, { name, type })
  if (!result.ok) {
    const status = result.errorCode === "gemini-tidak-tersedia" ? 503 : result.errorCode === "fail-tidak-sah" ? 400 : 422
    return Response.json({ errorCode: result.errorCode, errorMessage: result.errorMessage }, { status })
  }
  return Response.json({
    model: result.extract.model,
    payload: result.payload,
  })
}
