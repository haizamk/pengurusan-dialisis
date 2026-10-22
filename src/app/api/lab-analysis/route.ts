import { createClient } from "@supabase/supabase-js"
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
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim()
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
  const key = process.env.NOUS_API_KEY?.trim()
  if (!key) return Response.json({ error: "NOUS_API_KEY belum ditetapkan pada pelayan." }, { status: 503 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Data keputusan tidak sah." }, { status: 400 })
  }
  const raw = body && typeof body === "object" ? (body as { results?: unknown }).results : null
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 200) {
    return Response.json({ error: "Hantar antara 1 hingga 200 keputusan darah." }, { status: 400 })
  }
  const results = raw.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const row = item as Record<string, unknown>
    if (
      typeof row.key !== "string" || typeof row.label !== "string" ||
      typeof row.value !== "number" || !Number.isFinite(row.value) ||
      typeof row.unit !== "string" || typeof row.date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(row.date)
    ) return []
    return [{
      key: row.key.slice(0, 80),
      label: row.label.slice(0, 80),
      value: row.value,
      unit: row.unit.slice(0, 30),
      date: row.date,
      referenceRange: typeof row.referenceRange === "string" ? row.referenceRange.slice(0, 80) : null,
      abnormalFlag: typeof row.abnormalFlag === "string" ? row.abnormalFlag.slice(0, 20) : null,
      unverified: row.unverified === true,
    }]
  })
  if (results.length !== raw.length) {
    return Response.json({ error: "Sebahagian keputusan tidak lengkap atau tidak sah. Semak rekod sebelum menjana analisis." }, { status: 400 })
  }

  const prompt = `Anda pembantu pendidikan kesihatan untuk pesakit hemodialisis. Tafsir hanya keputusan yang diberi di bawah. Pulangkan satu item parameter bagi SETIAP keputusan input, tanpa menggugurkan atau menambah parameter. Kekalkan nilai, unit dan tarikh tepat. Gunakan julat rujukan atau tanda H/L tercetak jika ada; jika tiada, status mestilah tidak_dapat_dipastikan dan jangan mendakwa nilai tinggi/rendah berdasarkan andaian. Terangkan maksud dengan bahasa Melayu mudah. Beri tip pemakanan hanya jika relevan kepada parameter dan keputusan; untuk kalium/fosfat tinggi, beri tip umum yang selamat untuk dibincang dengan pakar diet renal, jangan melarang semua buah/sayur/protein atau menetapkan had individu. Jangan diagnosis, ubah ubat, pengikat fosfat, suplemen, cecair atau preskripsi dialisis. Jika nilai berbahaya berdasarkan konteks input, sarankan hubungi pasukan dialisis segera tanpa membuat diagnosis. Jika julat rujukan tiada, nyatakan perlunya rujuk julat makmal dan pasukan rawatan. Jangan cipta fakta atau nilai.
Keputusan darah (unverified=true bermaksud bacaan AI belum disemak; nyatakan ketidakpastian dan jangan beri arahan pemakanan khusus berdasarkan bacaan tersebut): ${JSON.stringify(results)}`

  try {
    // Use the same Nous Research OpenAI-compatible gateway as lab extraction.
    // A Gemini model can be selected via NOUS_ANALYSIS_MODEL only if Nous exposes it.
    const model = process.env.NOUS_ANALYSIS_MODEL?.trim() || process.env.NOUS_LAB_MODEL?.trim() || "openai/gpt-4o"
    const baseUrl = (process.env.NOUS_API_BASE_URL?.trim() || "https://inference-api.nousresearch.com/v1").replace(/\\/$/, "")
    const upstream = await fetch(baseUrl + "/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "Balas dengan objek JSON sahaja tanpa markdown. Kunci wajib: summary (string), safety (array string), parameters (array objek). Setiap parameter wajib ada key,label,value,unit,date,status,interpretation,foodTips,followUp. Status: tinggi, rendah, dalam_julat, tidak_dapat_dipastikan." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: 12000,
      }),
      signal: AbortSignal.timeout(55000),
    })
    if (!upstream.ok) {
      return Response.json({ error: "Nous Research tidak dapat menjana analisis (HTTP " + upstream.status + "). Semak model NOUS_ANALYSIS_MODEL." }, { status: 502 })
    }
    const upstreamJson = await upstream.json() as { choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }> }
    const output = upstreamJson.choices?.[0]?.message?.content
    const answer = typeof output === "string" ? output : Array.isArray(output) ? output.map((part) => part.text || "").join("\\n") : ""
    if (!answer.trim()) return Response.json({ error: "Nous tidak memulangkan analisis. Cuba semula." }, { status: 502 })
    let parsed: { summary?: unknown; parameters?: unknown; safety?: unknown }
    try { parsed = JSON.parse(answer) } catch {
      return Response.json({ error: "Nous memulangkan format JSON yang tidak sah. Tiada analisis disimpan." }, { status: 502 })
    }
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
      version: "nous-lab-analysis-v1",
      summary: parsed.summary.slice(0, 4000),
      safety: parsed.safety.filter((item): item is string => typeof item === "string").slice(0, 20),
      parameters,
    })
  } catch {
    return Response.json({ error: "Analisis AI gagal dijana. Rekod asal tidak berubah; cuba semula." }, { status: 502 })
  }
}
