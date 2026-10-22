import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Read-only connectivity probe: no model inference, patient data or credentials returned.
export async function GET() {
  const key = process.env.NOUS_API_KEY?.trim()
  if (!key) return NextResponse.json({ ok: false, stage: "configuration", message: "NOUS_API_KEY tidak tersedia pada deployment ini." }, { status: 503 })

  const base = (process.env.NOUS_API_BASE_URL?.trim() || "https://inference-api.nousresearch.com/v1").replace(/\/$/, "")
  try {
    const response = await fetch(base + "/models", {
      headers: { Authorization: "Bearer " + key, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    })
    if (!response.ok) return NextResponse.json({ ok: false, stage: "nous-models", httpStatus: response.status, message: "Nous tidak menerima permintaan senarai model." }, { status: 502 })
    const payload: unknown = await response.json()
    const data = typeof payload === "object" && payload !== null && "data" in payload ? (payload as { data?: unknown }).data : undefined
    if (!Array.isArray(data)) return NextResponse.json({ ok: false, stage: "nous-models", message: "Respons model Nous bukan senarai yang dijangka." }, { status: 502 })
    const ids = new Set(data.filter((item): item is { id: string } => typeof item === "object" && item !== null && typeof (item as { id?: unknown }).id === "string").map(item => item.id))
    return NextResponse.json({
      ok: true,
      stage: "nous-models",
      message: "Pelayan Netlify berjaya menghubungi endpoint model Nous. Ini belum mengesahkan chat completions atau keizinan model.",
      modelCount: ids.size,
      models: {
        "openai/gpt-4o": ids.has("openai/gpt-4o"),
        "nvidia/nemotron-3.5-super-vl": ids.has("nvidia/nemotron-3.5-super-vl"),
        "qwen/qwen3-vl-8b-instruct": ids.has("qwen/qwen3-vl-8b-instruct"),
      },
    }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ ok: false, stage: "network", message: "Netlify tidak dapat menghubungi endpoint Nous dalam had masa." }, { status: 502 })
  }
}
