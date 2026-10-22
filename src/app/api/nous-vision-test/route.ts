import { connection, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/supabase"

const MODELS = ["openai/gpt-4o", "nvidia/nemotron-3.5-super-vl", "qwen/qwen3-vl-8b-instruct"] as const
const LIMIT = 3 * 1024 * 1024

type LabEntry = { test: string; value: string; unit: string | null; reference_range: string | null; flag: string | null; page: number | null }
function parseStructured(raw: string): { entries: LabEntry[]; warning: string | null } {
  try {
    const cleaned = raw.trim().replace(/^\x60{3}(?:json)?\s*/i, "").replace(/\s*\x60{3}$/, "")
    const parsed: unknown = JSON.parse(cleaned)
    if (!parsed || typeof parsed !== "object" || !("tests" in parsed) || !Array.isArray(parsed.tests)) throw new Error("Invalid schema")
    if (parsed.tests.length > 100) throw new Error("Too many tests")
    const entries: LabEntry[] = parsed.tests.map((item: unknown) => {
      if (!item || typeof item !== "object") throw new Error("Invalid entry")
      const obj = item as Record<string, unknown>
      if (typeof obj.test !== "string" || !obj.test.trim() || typeof obj.value !== "string" || !obj.value.trim()) throw new Error("Missing required fields")
      const optional = (key: string): string | null => obj[key] == null ? null : typeof obj[key] === "string" ? (obj[key] as string).slice(0, 150) : null
      return { test: obj.test.slice(0, 120), value: obj.value.slice(0, 100), unit: optional("unit"), reference_range: optional("reference_range"), flag: optional("flag"), page: typeof obj.page === "number" && Number.isInteger(obj.page) && obj.page > 0 && obj.page < 100 ? obj.page : null }
    })
    return { entries, warning: null }
  } catch { return { entries: [], warning: "Respons bukan JSON sah. Jangan simpan keputusan." } }
}


export async function POST(request: Request) {
  await connection()
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Supabase belum dikonfigurasi." }, { status: 503 })
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) return NextResponse.json({ error: "Log masuk diperlukan." }, { status: 401 })
  const client = createClient(supabaseUrl(), supabaseAnonKey(), {
    global: { headers: { Authorization: "Bearer " + token } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: authError } = await client.auth.getUser(token)
  if (authError || !userData.user) return NextResponse.json({ error: "Sesi tidak sah." }, { status: 401 })
  const { data: account, error: accountError } = await client.from("accounts").select("role, status").eq("user_id", userData.user.id).maybeSingle()
  if (accountError) return NextResponse.json({ error: "Pengesahan akaun gagal." }, { status: 503 })
  if (!account || account.role !== "pesakit" || account.status !== "lulus") return NextResponse.json({ error: "Hanya akaun pesakit yang diluluskan boleh menjalankan ujian." }, { status: 403 })
  if (!process.env.NOUS_API_KEY?.trim()) return NextResponse.json({ error: "NOUS_API_KEY tiada pada pelayan." }, { status: 503 })

  let form: FormData
  try { form = await request.formData() } catch { return NextResponse.json({ error: "Borang tidak sah." }, { status: 400 }) }
  const model = form.get("model")
  const file = form.get("file")
  if (typeof model !== "string" || !MODELS.some(id => id === model)) return NextResponse.json({ error: "Model tidak dibenarkan." }, { status: 400 })
  if (!(file instanceof File) || file.size < 1 || file.size > LIMIT || !["image/png", "image/jpeg"].includes(file.type)) return NextResponse.json({ error: "Hanya JPG/PNG sehingga 3 MB dibenarkan." }, { status: 400 })
  const bytes = new Uint8Array(await file.arrayBuffer())
  const isPng = bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((n,i) => bytes[i] === n)
  const isJpeg = bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
  if (!(file.type === "image/png" ? isPng : isJpeg)) return NextResponse.json({ error: "Kandungan imej tidak sah." }, { status: 400 })
  const base = (process.env.NOUS_API_BASE_URL?.trim() || "https://inference-api.nousresearch.com/v1").replace(/\/$/, "")
  const started = Date.now()
  try {
    const upstream = await fetch(base + "/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer " + process.env.NOUS_API_KEY!.trim(), "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: [
          { type: "text", text: `Baca hanya keputusan ujian makmal yang kelihatan. Jangan masukkan nama, nombor pengenalan, tarikh lahir, alamat atau maklumat pesakit dalam respons. Jangan teka nilai yang kabur. Pulangkan HANYA JSON sah dengan format {"tests":[{"test":"Haemoglobin","value":"11.4","unit":"g/dL","reference_range":"12.0 - 18.0","flag":"L","page":1}]}. value mesti string supaya perpuluhan kekal. Gunakan null untuk unit, reference_range, flag atau page yang tidak jelas. Jika tiada ujian boleh dibaca, pulangkan {"tests":[]}. Tiada markdown.` },
          { type: "image_url", image_url: { url: "data:" + file.type + ";base64," + Buffer.from(bytes).toString("base64"), detail: "high" } },
        ] }],
        max_tokens: 1800,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(45000),
    })
    const elapsedMs = Date.now() - started
    if (!upstream.ok) return NextResponse.json({ model, ok: false, httpStatus: upstream.status, elapsedMs, error: "Nous menolak permintaan. Semak status HTTP." }, { status: 502 })
    const result = await upstream.json() as { choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } }
    const value = result.choices?.[0]?.message?.content
    const answer = typeof value === "string" ? value : Array.isArray(value) ? value.map(x => x.text || "").join("\n") : ""
    const structured = parseStructured(answer)
    return NextResponse.json({ model, ok: structured.warning === null && structured.entries.length > 0, elapsedMs, answer: answer.slice(0, 12000), structured: structured.entries, warning: structured.warning, usage: result.usage || null }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ model, ok: false, elapsedMs: Date.now() - started, error: "Permintaan gagal atau melebihi had masa 45 saat." }, { status: 502 })
  }
}
