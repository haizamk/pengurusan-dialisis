"use client"

import { useState } from "react"
import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { filterByRange, sharedPrintedRange, type ConfirmedResult, type ParameterReading } from "@/lib/lab-analysis"
import { formatDate } from "@/lib/format"

const RANGES = [
  { key: "3m", label: "3 bulan" },
  { key: "6m", label: "6 bulan" },
  { key: "12m", label: "12 bulan" },
  { key: "all", label: "Semua" },
] as const

export function ParameterCharts({
  series,
  onOpen,
}: {
  series: ParameterReading[]
  onOpen?: (documentId: string) => void
}) {
  if (series.length === 0) {
    return (
      <p className="text-sm leading-6 text-muted-foreground">
        Belum ada rekod darah. Muat naik laporan makmal untuk menyimpan keputusan, melihat graf dan mendapatkan penerangan berdasarkan data sebenar.
      </p>
    )
  }

  return (
    <div className="grid gap-4">
      {series.map((item) => (
        <ParameterChart key={`${item.key}-${item.unit}`} series={item} onOpen={onOpen} />
      ))}
    </div>
  )
}

function ParameterChart({ series, onOpen }: { series: ParameterReading; onOpen?: (documentId: string) => void }) {
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("all")
  const [today, setToday] = useState("")
  const visible = filterByRange(series.points, range, today || series.points[series.points.length - 1]?.takenOn || "1970-01-01")
  const band = sharedPrintedRange(visible)
  const values = visible.map((point) => point.value)
  const lower = values.length ? Math.min(...values, band?.low ?? Infinity) : 0
  const upper = values.length ? Math.max(...values, band?.high ?? -Infinity) : 1
  const pad = lower === upper ? Math.max(Math.abs(lower) * 0.1, 0.5) : (upper - lower) * 0.15
  const data = visible.map((point) => ({
    label: formatDate(point.takenOn),
    nilai: point.value,
    unit: point.unit,
  }))

  return (
    <article className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-2xl">{series.label}</h3>
          <p className="text-sm text-muted-foreground">Unit: {series.unit}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {RANGES.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`min-h-12 rounded-lg px-3 text-sm ${item.key === range ? "bg-primary text-primary-foreground" : "bg-muted"}`}
              onClick={() => {
                setToday(new Date().toISOString().slice(0, 10))
                setRange(item.key)
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-3 text-sm leading-6">
        Terkini: {series.latest.value} {series.unit} pada {formatDate(series.latest.takenOn)}.{" "}
        {series.previous
          ? `Sebelumnya: ${series.previous.value} ${series.unit} pada ${formatDate(series.previous.takenOn)}. Beza ${series.change} ${series.unit}.`
          : "Satu bacaan belum cukup untuk menentukan trend."}
      </p>
      {visible.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Tiada bacaan dalam julat tarikh ini. Tiada titik kosong diisi sebagai sifar.</p>
      ) : (
        <div className="mt-3 h-72 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="oklch(0.46 0.03 230)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "oklch(0.82 0.02 200)", fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis domain={[lower - pad, upper + pad]} tick={{ fill: "oklch(0.82 0.02 200)", fontSize: 12 }} axisLine={false} tickLine={false} width={56} />
              <Tooltip formatter={(value) => [`${value} ${series.unit}`, series.label]} />
              {band ? <ReferenceArea y1={band.low} y2={band.high} fill="oklch(0.72 0.09 190 / 0.18)" strokeOpacity={0} /> : null}
              <Line type="linear" dataKey="nilai" name={series.label} stroke="oklch(0.80 0.12 190)" strokeWidth={2.4} dot={{ r: 4 }} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {band ? (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Jalur menunjukkan julat {band.low}–{band.high} yang tercetak pada setiap laporan dalam paparan ini. Ia bukan sasaran yang dicipta oleh aplikasi.
        </p>
      ) : (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Tiada jalur julat dilukis kerana laporan tidak mencetak julat yang sama, atau julat tidak tersedia. Julat asal, jika ada, kekal dalam jadual.
        </p>
      )}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-2 pr-3 font-medium">Tarikh</th>
              <th className="py-2 pr-3 font-medium">Nilai</th>
              <th className="py-2 pr-3 font-medium">Julat laporan</th>
              <th className="py-2 pr-3 font-medium">Sumber</th>
              <th className="py-2 font-medium">Laporan</th>
            </tr>
          </thead>
          <tbody>
            {[...visible].reverse().map((point) => (
              <tr key={`${point.takenOn}-${point.value}-${point.source}`} className="border-t border-border">
                <td className="py-2 pr-3">{formatDate(point.takenOn)}</td>
                <td className="py-2 pr-3">{point.value} {point.unit}</td>
                <td className="py-2 pr-3">{point.refText ?? "Tidak tercetak"}</td>
                <td className="py-2 pr-3">{point.source === "manual" ? "Rekod manual" : "Disahkan daripada laporan"}</td>
                <td className="py-2">
                  {point.documentId && onOpen ? (
                    <button type="button" className="min-h-12 underline" onClick={() => onOpen(point.documentId!)}>
                      Buka laporan
                    </button>
                  ) : (
                    "Tiada fail"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  )
}

export function resultRows(points: ConfirmedResult[]) {
  return [...points].sort((a, b) => b.takenOn.localeCompare(a.takenOn) || a.label.localeCompare(b.label))
}
