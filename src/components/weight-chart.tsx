"use client"

import { useState } from "react"
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { formatDate } from "@/lib/format"
import type { DialysisSession } from "@/lib/types"

type RangeKey = "hari" | "bulan" | "enam" | "tahun" | "semua"

const RANGES: { key: RangeKey; label: string; days: number | null }[] = [
  { key: "hari", label: "Harian", days: 14 },
  { key: "bulan", label: "Bulanan", days: 31 },
  { key: "enam", label: "6 bulan", days: 183 },
  { key: "tahun", label: "Setahun", days: 366 },
  { key: "semua", label: "Semua", days: null },
]

function within(date: string, days: number | null) {
  if (days == null) return true
  const then = new Date(`${date}T00:00:00`)
  const limit = new Date()
  limit.setDate(limit.getDate() - days)
  return then >= limit
}

export function WeightChart({ sessions }: { sessions: DialysisSession[] }) {
  const [range, setRange] = useState<RangeKey>("semua")
  const chosen = RANGES.find((item) => item.key === range) ?? RANGES[4]
  const visible = [...sessions]
    .filter((session) => within(session.sessionDate, chosen.days))
    .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate))

  if (sessions.length === 0) {
    return (
      <p className="text-sm leading-6 text-muted-foreground">
        Tiada data tersedia. Carta berat akan muncul selepas sesi pertama direkodkan.
      </p>
    )
  }

  const data = visible.map((session) => ({
    label: formatDate(session.sessionDate),
    tiba: session.arrivalWeightKg,
    selepas: session.postWeightKg,
    kering: session.dryWeightKg,
  }))
  const numbers = data.flatMap((row) => [row.tiba, row.selepas, row.kering]).filter(
    (value): value is number => value != null,
  )
  const min = Math.floor(Math.min(...numbers) - 1)
  const max = Math.ceil(Math.max(...numbers) + 1)

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {RANGES.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`min-h-12 rounded-xl border px-4 text-sm font-semibold transition-colors ${item.key === range ? "border-primary bg-primary/15 text-primary" : "border-border bg-background text-foreground hover:bg-secondary/70"}`}
            onClick={() => setRange(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {data.length === 0 ? (
        <p className="text-sm leading-6 text-muted-foreground">Tiada sesi dalam julat tarikh ini.</p>
      ) : (
        <div className="h-72 w-full min-w-0 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="oklch(0.46 0.03 230)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "oklch(0.82 0.02 200)", fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis domain={[min, max]} tick={{ fill: "oklch(0.82 0.02 200)", fontSize: 12 }} axisLine={false} tickLine={false} unit=" kg" width={64} />
              <Tooltip
                formatter={(value, name) => [
                  value == null || value === "" ? "Tiada data" : `${value} kg`,
                  name === "tiba" ? "Berat sebelum" : name === "selepas" ? "Berat selepas" : "Berat kering sesi",
                ]}
              />
              <Legend />
              <Line type="linear" name="Berat sebelum" dataKey="tiba" stroke="oklch(0.80 0.12 190)" strokeWidth={2.4} dot={{ r: 3 }} connectNulls={false} />
              <Line type="linear" name="Berat selepas" dataKey="selepas" stroke="oklch(0.78 0.12 70)" strokeWidth={2.4} dot={{ r: 3 }} connectNulls={false} />
              <Line type="linear" name="Berat kering" dataKey="kering" stroke="oklch(0.86 0.02 200)" strokeDasharray="5 4" strokeWidth={1.6} dot={{ r: 2 }} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Setiap titik ialah sesi yang disimpan. Berat kering mengikut sesi itu, bukan satu garis tetap. Titik yang tiada dibiarkan kosong.
      </p>
    </div>
  )
}
