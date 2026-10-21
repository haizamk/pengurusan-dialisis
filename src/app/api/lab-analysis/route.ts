import { createClient } from "@supabase/supabase-js"
import { GoogleGenAI } from "@google/genai"
import { geminiApiKey } from "@/lib/lab-gemini-server"
import { selectedGeminiModel } from "@/lib/lab-gemini"
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/supabase"

export const maxDuration = 60

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "parameters", "safety"],
  properties: {
    summary: { type: "string" },
    safety: { type: "array", items: { type: "string" } },
    parameters: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "label", "value", "unit", "date", "status", "interpretation", "foodTips", "followUp"],
        properties: {
          key: { type: "string" },
          label: { type: "string" },
          value: { type: "number" },
          unit: { type: "string" },
          date: { type: "string" },
          status: { type: "string", enum: ["tinggi", "rendah", "dalam_julat", "tidak_dapat_dipastikan"] },
          interpretation: { type: "string" },
          foodTips: { type: "array", items: { type: "string" } },
          followUp: { type: "string" },
        },
      },
    },
  },
} as const

async function authorised(request: Request) {
  if (!isSupabaseConfigured()) return false
  const token = request.headers.get("authorization")?.replace(/^Bearer\\s+/i, "").trim()
  if (!token) return false
  const client = createClient(supabaseUrl(), supabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await client.auth.getUser(token)
  if (!data.user || error) return false
  const account = await client.from("accounts").select("role, status").eq("user_id", data.user.id).maybeSingle()
  return !account.error && account.data?.role === "pesakit" && account.data.status === "lulus"
}

export async function POST(request: Request) {
  if (!await authorised(request)) {
    return Response.json({ error: "Sesi pesakit yang diluluskan diperlukan." }, { status: 401 })
  }
  const key = geminiApiKey()
  if (!key) return Response.json({ error: "GEMINI_API_KEY belum ditetapkan pada pelayan." }, { status: 503 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Data keputusan tidak sah." }, { status: 400 })
  }
  const raw = body && typeof body === "object" ? (body as { results?: unknown }).results : null
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 200) {
    return Response.json({ error: "Hantar antara 1 hingga 200 keputusan yang telah disahkan." }, { status: 400 })
  }
  const results = raw.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const row = item as Record<string, unknown>
    if (
      typeof row.key !== "string" || typeof row.label !== "string" ||
      typeof row.value !== "number" || !Number.isFinite(row.value) ||
      typeof row.unit !== "string" || typeof row.date !== "string" ||
      !/^\\d{4}-\\d{2}-\\d{2}$/.test(row.date)
    ) return []
    return [{
      key: row.key.slice(0, 80),
      label: row.label.slice(0, 80),
      value: row.value,
      unit: row.unit.slice(0, 30),
      date: row.date,
      referenceRange: typeof row.referenceRange === "string" ? row.referenceRange.slice(0, 80) : null,
      abnormalFlag: typeof row.abnormalFlag === "string" ? row.abnormalFlag.slice(0, 20) : null,
    }]
  })
  if (results.length !== raw.length) {
    return Response.json({ error: "Sebahagian keputusan tidak lengkap atau tidak sah. Semak rekod sebelum menjana analisis." }, { status: 400 })
  }

  const prompt = `Anda pembantu pendidikan kesihatan untuk pesakit hemodialisis. Tafsir hanya keputusan yang diberi di bawah. Pulangkan satu item parameter bagi SETIAP keputusan input, tanpa menggugurkan atau menambah parameter. Kekalkan nilai, unit dan tarikh tepat. Gunakan julat rujukan atau tanda H/L tercetak jika ada; jika tiada, status mestilah tidak_dapat_dipastikan dan jangan mendakwa nilai tinggi/rendah berdasarkan andaian. Terangkan maksud dengan bahasa Melayu mudah. Beri tip pemakanan hanya jika relevan kepada parameter dan keputusan; untuk kalium/fosfat tinggi, beri tip umum yang selamat untuk dibincang dengan pakar diet renal, jangan melarang semua buah/sayur/protein atau menetapkan had individu. Jangan diagnosis, ubah ubat, pengikat fosfat, suplemen, cecair atau preskripsi dialisis. Jika nilai berbahaya berdasarkan konteks input, sarankan hubungi pasukan dialisis segera tanpa membuat diagnosis. Jika julat rujukan tiada, nyatakan perlunya rujuk julat makmal dan pasukan rawatan. Jangan cipta fakta atau nilai.
Keputusan disahkan: ${JSON.stringify(results)}`

  try {
    const ai = new GoogleGenAI({ apiKey: key })
    const response = await ai.models.generateContent({
      model: selectedGeminiModel(),
      contents: [{ text: prompt }],
      config: { responseMimeType: "application/json", responseJsonSchema: schema },
    })
    const text = response.text?.trim()
    if (!text) return Response.json({ error: "AI tidak memulangkan analisis. Cuba semula." }, { status: 502 })
    const parsed = JSON.parse(text) as { summary?: unknown; parameters?: unknown; safety?: unknown }
    if (typeof parsed.summary !== "string" || !Array.isArray(parsed.parameters) || !Array.isArray(parsed.safety)) {
      return Response.json({ error: "Format analisis AI tidak lengkap." }, { status: 502 })
    }
    const expected = new Set(results.map((row) => row.key + "|" + row.date + "|" + row.value + "|" + row.unit))
    const parameters = parsed.parameters.filter((item): item is Record<string, unknown> => {
      if (!item || typeof item !== "object") return false
      const row = item as Record<string, unknown>
      return typeof row.key === "string" && typeof row.date === "string" && typeof row.value === "number" && typeof row.unit === "string" &&
        expected.has(row.key + "|" + row.date + "|" + row.value + "|" + row.unit)
    })
    if (parameters.length !== results.length) {
      return Response.json({ error: "Analisis AI tidak meliputi semua keputusan. Tiada analisis separa disimpan; cuba semula." }, { status: 502 })
    }
    return Response.json({
      version: "gemini-lab-analysis-v1",
      summary: parsed.summary.slice(0, 4000),
      safety: parsed.safety.filter((item): item is string => typeof item === "string").slice(0, 20),
      parameters,
    })
  } catch {
    return Response.json({ error: "Analisis AI gagal dijana. Rekod asal tidak berubah; cuba semula." }, { status: 502 })
  }
}
