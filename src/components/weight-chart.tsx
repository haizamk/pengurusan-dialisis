"use client"

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { formatDate } from "@/lib/format"
import type { DialysisSession } from "@/lib/types"

export function WeightChart({ sessions }: { sessions: DialysisSession[] }) {
  if (sessions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Carta berat akan muncul selepas sesi pertama direkodkan.
      </p>
    )
  }

  const data = sessions.map((session) => ({
    label: formatDate(session.sessionDate).replace(/\s\d{4}$/, ""),
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
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid stroke="#e4dccb" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "#5c675f", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis
              domain={[min, max]}
              tick={{ fill: "#5c675f", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              unit=" kg"
            />
            <Tooltip
              formatter={(value, name) => [
                value == null ? "—" : `${value} kg`,
                name === "tiba" ? "Berat tiba" : name === "selepas" ? "Berat selepas" : "Berat kering",
              ]}
            />
            <ReferenceLine y={data.at(-1)?.kering} stroke="#9a6a32" strokeDasharray="4 4" />
            <Line type="monotone" dataKey="tiba" stroke="#0e6b62" strokeWidth={2.4} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="selepas" stroke="#c47b2b" strokeWidth={2.4} dot={{ r: 3 }} connectNulls />
            <Line type="monotone" dataKey="kering" stroke="#1c2b2a" strokeDasharray="5 4" strokeWidth={1.4} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <i className="h-0.5 w-4 bg-[#0e6b62]" /> Berat tiba
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="h-0.5 w-4 bg-[#c47b2b]" /> Berat selepas
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="h-0.5 w-4 border-t border-dashed border-[#1c2b2a]" /> Berat kering
        </span>
      </div>
    </div>
  )
}
