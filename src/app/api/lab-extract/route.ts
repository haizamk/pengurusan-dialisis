import { createClient } from "@supabase/supabase-js"
import { labFileKind, validateLabFile } from "@/lib/lab-parse"
import { extractWithGemini, geminiApiKey } from "@/lib/lab-gemini-server"
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/supabase"

export const maxDuration = 60

type AuthResult =
  | { ok: true }
  | { ok: false; status: number; errorCode: string; errorMessage: string }

async function authorisePatient(request: Request): Promise<AuthResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, status: 503, errorCode: "supabase-tidak-dikonfigurasi", errorMessage: "Pengesahan Supabase belum dikonfigurasi pada pelayan." }
  }
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim()
  if (!token) {
    return { ok: false, status: 401, errorCode: "sesi-tidak-ditemui", errorMessage: "Sesi log masuk pesakit tidak dihantar. Muat semula halaman dan log masuk semula jika perlu." }
  }

  const client = createClient(supabaseUrl(), supabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) {
    return { ok: false, status: 401, errorCode: "sesi-tidak-sah", errorMessage: "Sesi log masuk telah tamat atau tidak sah. Log masuk semula, kemudian cuba ekstrak lagi." }
  }

  const account = await client.from("accounts").select("role, status").eq("user_id", data.user.id).maybeSingle()
  if (account.error) {
    return { ok: false, status: 500, errorCode: "semakan-akaun-gagal", errorMessage: "Pelayan tidak dapat menyemak kebenaran akaun pesakit. Cuba lagi kemudian." }
  }
  if (!account.data) {
    return { ok: false, status: 403, errorCode: "akaun-tidak-dipautkan", errorMessage: "Akaun log masuk belum dipautkan kepada rekod akaun pesakit." }
  }
  if (account.data.role !== "pesakit") {
    return { ok: false, status: 403, errorCode: "peranan-bukan-pesakit", errorMessage: "Ekstraksi laporan ini hanya tersedia untuk sesi akaun pesakit." }
  }
  if (account.data.status !== "lulus") {
    return { ok: false, status: 403, errorCode: "akaun-belum-diluluskan", errorMessage: "Akaun pesakit belum diluluskan. Hubungi pusat dialisis untuk pengesahan." }
  }
  return { ok: true }
}

export async function POST(request: Request) {
  const auth = await authorisePatient(request)
  if (!auth.ok) {
    return Response.json({ errorCode: auth.errorCode, errorMessage: auth.errorMessage }, { status: auth.status })
  }
  if (!geminiApiKey()) {
    return Response.json({ errorCode: "nous-tidak-tersedia", errorMessage: "NOUS_API_KEY belum ditetapkan pada pelayan Netlify. Ekstraksi menggunakan GPT-4o melalui Nous Research." }, { status: 503 })
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return Response.json({ errorCode: "fail-tidak-sah", errorMessage: "Muat naik tidak dapat dibaca oleh pelayan." }, { status: 400 })
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
    const status = result.errorCode === "tiada-enjin" ? 503 : result.errorCode === "fail-tidak-sah" ? 400 : 422
    return Response.json({ errorCode: result.errorCode, errorMessage: result.errorMessage }, { status })
  }
  return Response.json({ model: result.extract.model, payload: result.payload })
}
