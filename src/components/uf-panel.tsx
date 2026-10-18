import { Disclaimer } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { formatKg, formatNumber, formatSignedKg, hoursLabel } from "@/lib/format"
import {
  BAND_LABEL,
  POST_LABEL,
  RATE_LABEL,
  type UfAnalysis,
} from "@/lib/uf"

function toneForBand(band: UfAnalysis["band"]) {
  if (band === "baik") return "good" as const
  if (band === "sederhana") return "warn" as const
  return "danger" as const
}

export function UfPanel({ analysis }: { analysis: UfAnalysis | null }) {
  if (!analysis || !analysis.valid) {
    return (
      <section className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
        <p className="font-heading text-2xl">Analisis UF</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Isi berat kering dan berat semasa tiba. Panel ini akan kira UF seterusnya dan
          bandingkannya dengan berat kering.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[0.7rem] font-semibold tracking-[0.16em] text-primary uppercase">
            Semasa pesakit tiba
          </p>
          <h2 className="mt-1 font-heading text-2xl">Analisis UF seterusnya</h2>
        </div>
        <StatusBadge tone={toneForBand(analysis.band)}>{BAND_LABEL[analysis.band]}</StatusBadge>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <article className="rounded-xl bg-secondary/70 p-4">
          <p className="text-xs font-medium text-muted-foreground">UF seterusnya</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Berat selepas terakhir − berat semasa tiba
          </p>
          <p className="mt-3 font-heading text-3xl">
            {formatSignedKg(analysis.ufSeterusnyaKg)}
          </p>
          <p className="mt-2 text-sm leading-5">
            {analysis.idwgKg == null
              ? "Belum ada berat selepas sesi lepas."
              : analysis.idwgKg > 0
                ? `Berat naik ${formatKg(analysis.idwgKg)} (${formatNumber(analysis.idwgPercent)}% berat kering).`
                : analysis.idwgKg < 0
                  ? `Berat turun ${formatKg(Math.abs(analysis.idwgKg))}.`
                  : "Berat sama dengan selepas sesi lepas."}
          </p>
        </article>
        <article className="rounded-xl bg-primary p-4 text-primary-foreground">
          <p className="text-xs font-medium text-primary-foreground/75">
            UF untuk capai berat kering
          </p>
          <p className="mt-1 text-xs leading-5 text-primary-foreground/75">
            Berat semasa tiba − berat kering
          </p>
          <p className="mt-3 font-heading text-3xl">
            {analysis.ufSasaranKg <= 0 ? "0 kg" : formatKg(analysis.ufSasaranKg)}
          </p>
          <p className="mt-2 text-sm leading-5 text-primary-foreground/90">
            {analysis.ufSasaranKg <= 0
              ? `Jarak sebenar ${formatSignedKg(analysis.ufSasaranKg)}. Jangan tarik cecair.`
              : `${analysis.ufSasaranMl.toLocaleString("ms-MY")} mL pada sesi ${hoursLabel(analysis.durationMin)}.`}
          </p>
        </article>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Berat kering</dt>
          <dd className="font-medium">{formatKg(analysis.dryWeightKg)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Berat tiba</dt>
          <dd className="font-medium">{formatKg(analysis.arrivalWeightKg)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Selepas sesi lepas</dt>
          <dd className="font-medium">{formatKg(analysis.lastPostWeightKg)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Kadar UF sasaran</dt>
          <dd className="font-medium">
            {analysis.ufRateMlPerKgHr == null
              ? "—"
              : `${formatNumber(analysis.ufRateMlPerKgHr)} mL/kg/j`}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        {analysis.rateFlag ? (
          <StatusBadge
            tone={
              analysis.rateFlag === "selamat"
                ? "good"
                : analysis.rateFlag === "pantau"
                  ? "warn"
                  : "danger"
            }
          >
            {RATE_LABEL[analysis.rateFlag]}
          </StatusBadge>
        ) : null}
        <StatusBadge
          tone={
            analysis.postFlag === "capai"
              ? "good"
              : analysis.postFlag === "belum"
                ? "neutral"
                : "danger"
          }
        >
          {POST_LABEL[analysis.postFlag]}
        </StatusBadge>
      </div>

      <div className="mt-4 space-y-2 text-sm leading-6">
        {analysis.messages.map((message) => (
          <p key={message}>{message}</p>
        ))}
      </div>
      <div className="mt-4">
        <Disclaimer />
      </div>
    </section>
  )
}
