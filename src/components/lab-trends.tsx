"use client"

import { useState } from "react"
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { MARKERS, type MarkerKey } from "@/lib/blood"
import { formatDate } from "@/lib/format"
import type { BloodRecord } from "@/lib/types"

type RangeKey = "bulan" | "enam" | "tahun" | "semua"

const DAYS: Record<RangeKey, number | null> = {
  bulan: 31,
  enam: 183,
  tahun: 366,
  semua: null,
}

export function LabTrends({ labs }: { labs: BloodRecord[] }) {
  const [range, setRange] = useState<RangeKey>("semua")
  const days = DAYS[range]
  const visible = labs.filter((lab) => {
    if (days == null) return true
    const limit = new Date()
    limit.setDate(limit.getDate() - days)
    return new Date(`${lab.takenOn}T00:00:00`) >= limit
  })
  const present = MARKERS.filter((marker) => visible.some((lab) => lab[marker.key] != null))

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-2xl">Sejarah setiap ujian</h2>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(DAYS) as RangeKey[]).map((key) => (
            <button
              key={key}
              type="button"
              className={`min-h-12 rounded-xl border px-4 text-sm font-semibold transition-colors ${key === range ? "border-primary bg-primary/15 text-primary" : "border-border bg-background hover:bg-secondary/70"}`}
              onClick={() => setRange(key)}
            >
              {key === "bulan" ? "Bulan" : key === "enam" ? "6 bulan" : key === "tahun" ? "Setahun" : "Semua"}
            </button>
          ))}
        </div>
      </div>
      {present.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Tiada data tersedia untuk julat ini.</p>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {present.map((marker) => (
            <MarkerCard key={marker.key} markerKey={marker.key} labs={visible} />
          ))}
        </div>
      )}
    </section>
  )
}

function MarkerCard({ markerKey, labs }: { markerKey: MarkerKey; labs: BloodRecord[] }) {
  const marker = MARKERS.find((item) => item.key === markerKey)!
  const points = labs
    .map((lab) => ({ date: lab.takenOn, value: lab[markerKey] }))
    .filter((point): point is { date: string; value: number } => point.value != null)
    .sort((a, b) => a.date.localeCompare(b.date))
  return (
    <article className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:p-5">
      <h3 className="font-heading text-xl">{marker.label}</h3>
      <p className="text-sm text-muted-foreground">{marker.unit}. {marker.hint}</p>
      {points.length < 2 ? (
        <p className="mt-3 text-sm leading-6">Satu bacaan belum cukup untuk trend. Nilai: {points[0] ? `${points[0].value} ${marker.unit} pada ${formatDate(points[0].date)}` : "Tiada data tersedia"}.</p>
      ) : (
        <div className="mt-3 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points.map((point) => ({ label: formatDate(point.date), nilai: point.value }))}>
              <CartesianGrid vertical={false} stroke="oklch(0.46 0.03 230)" />
              <XAxis dataKey="label" tick={{ fill: "oklch(0.82 0.02 200)", fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fill: "oklch(0.82 0.02 200)", fontSize: 11 }} width={48} unit={` ${marker.unit}`} />
              <Tooltip formatter={(value) => [`${value} ${marker.unit}`, marker.label]} />
              <Line dataKey="nilai" name={marker.label} stroke="oklch(0.80 0.12 190)" strokeWidth={2.2} dot connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <table className="mt-3 w-full text-left text-sm">
        <caption className="sr-only">Senarai {marker.label}</caption>
        <thead>
          <tr className="text-muted-foreground">
            <th className="py-1 font-medium">Tarikh</th>
            <th className="py-1 font-medium">Nilai</th>
          </tr>
        </thead>
        <tbody>
          {[...points].reverse().map((point) => (
            <tr key={point.date} className="border-t border-border">
              <td className="py-2">{formatDate(point.date)}</td>
              <td className="py-2">{point.value} {marker.unit}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  )
}
