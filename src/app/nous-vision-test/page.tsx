"use client"

import { useState } from "react"
import { getSupabase } from "@/lib/supabase"

const MODELS = [
  { id: "openai/gpt-4o", label: "GPT-4o" },
  { id: "nvidia/nemotron-3.5-super-vl", label: "NVIDIA Nemotron 3.5 Super VL" },
  { id: "qwen/qwen3-vl-8b-instruct", label: "Qwen3 VL 8B" },
] as const

type Result = { model: string; ok?: boolean; answer?: string; error?: string; httpStatus?: number; elapsedMs?: number; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null }

export default function NousVisionTestPage() {
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<Result[]>([])
  const [notice, setNotice] = useState("")

  async function run() {
    if (!file || busy) return
    setBusy(true)
    setResults([])
    setNotice("")
    try {
      const supabase = getSupabase()
      const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } }
      if (!data.session?.access_token) { setNotice("Sila log masuk sebagai pesakit yang diluluskan terlebih dahulu."); return }
      for (const model of MODELS) {
        setNotice("Menguji " + model.label + "…")
        const form = new FormData()
        form.append("file", file)
        form.append("model", model.id)
        try {
          const response = await fetch("/api/nous-vision-test", { method: "POST", headers: { Authorization: "Bearer " + data.session.access_token }, body: form })
          const result = await response.json() as Result
          setResults(prev => [...prev, { ...result, model: model.id }])
          if (response.status === 401 || response.status === 403) { setNotice(result.error || "Akses ditolak."); return }
        } catch { setResults(prev => [...prev, { model: model.id, ok: false, error: "Sambungan gagal." }]) }
      }
      setNotice("Ujian selesai. Semak setiap bacaan secara manual.")
    } finally { setBusy(false) }
  }

  return <main className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-8">
    <div className="space-y-2">
      <h1 className="text-2xl font-bold">Makmal Ujian Vision Nous</h1>
      <p className="text-sm text-muted-foreground">Ujian perbandingan tiga model. Tidak menyimpan imej atau keputusan dalam rekod pesakit. Permintaan dihantar kepada Nous Research dan pembekal modelnya.</p>
    </div>
    <section className="space-y-4 rounded-xl border p-5">
      <p className="font-semibold">Muat naik imej laporan contoh</p>
      <p className="text-sm">Gunakan imej sintetik atau laporan yang telah dibuang nama, nombor pengenalan, tarikh lahir dan semua pengenal pesakit. JPG/PNG sahaja, maksimum 3 MB. Setiap ujian menggunakan kredit API.</p>
      <input aria-label="Pilih imej laporan contoh" type="file" accept="image/png,image/jpeg" disabled={busy} onChange={e => { const next = e.target.files?.[0] || null; setFile(next); setResults([]); setNotice("") }} className="block w-full text-sm" />
      <button type="button" disabled={!file || busy || (file?.size || 0) > 3 * 1024 * 1024 || !["image/png", "image/jpeg"].includes(file?.type || "")} onClick={run} className="min-h-12 rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50">{busy ? "Ujian sedang berjalan…" : "Uji ketiga-tiga model"}</button>
      {notice && <p role="status" className="text-sm">{notice}</p>}
    </section>
    <section className="grid gap-4 md:grid-cols-3">
      {MODELS.map(model => {
        const result = results.find(r => r.model === model.id)
        return <article key={model.id} className="min-w-0 space-y-3 rounded-xl border p-4">
          <h2 className="font-bold">{model.label}</h2>
          {!result ? <p className="text-sm text-muted-foreground">{busy ? "Menunggu keputusan…" : "Belum diuji"}</p> : <>
            <p className="text-sm">{result.ok ? "Respons diterima" : "Ujian gagal"} · {result.elapsedMs == null ? "—" : (result.elapsedMs / 1000).toFixed(1) + " saat"}</p>
            {result.usage && <p className="text-xs text-muted-foreground">Token input: {result.usage.prompt_tokens ?? "—"} · Output: {result.usage.completion_tokens ?? "—"} · Jumlah: {result.usage.total_tokens ?? "—"}</p>}
            {result.error && <p role="alert" className="text-sm">{result.error}{result.httpStatus ? " (HTTP " + result.httpStatus + ")" : ""}</p>}
            {result.answer && <pre className="whitespace-pre-wrap break-words font-sans text-sm">{result.answer}</pre>}
          </>}
        </article>
      })}
    </section>
    <p className="text-sm text-muted-foreground">Keputusan AI hanya untuk penilaian teknikal, bukan diagnosis. Jangan gunakan nilai tanpa pengesahan terhadap laporan asal.</p>
  </main>
}
