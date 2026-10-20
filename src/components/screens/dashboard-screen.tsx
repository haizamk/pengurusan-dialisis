"use client"

import Link from "next/link"
import { useMemo } from "react"
import { Disclaimer, LoadingBlock, PageHeader } from "@/components/page-header"
import { PatientHome } from "@/components/screens/patient-home"
import { StatusBadge } from "@/components/status-badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { summariseLab } from "@/lib/blood"
import { daysAgoIso, formatDate, formatKg, formatLongDate } from "@/lib/format"
import { attentionFor, latestLab, sortSessions } from "@/lib/queries"
import { BAND_LABEL } from "@/lib/uf"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"

export function DashboardScreen() {
  const { ready, centres, patients, sessions, labs, centreFilter, profile } = useStore()

  const visiblePatients = useMemo(
    () =>
      patients.filter(
        (patient) =>
          patient.active && (centreFilter === "all" || patient.centreId === centreFilter),
      ),
    [patients, centreFilter],
  )
  const visibleIds = useMemo(
    () => new Set(visiblePatients.map((patient) => patient.id)),
    [visiblePatients],
  )

  const attention = useMemo(
    () =>
      visiblePatients
        .map((patient) => attentionFor(patient, sessions, labs))
        .filter((item) => item != null)
        .sort((a, b) => Number(b.level === "tinggi") - Number(a.level === "tinggi")),
    [visiblePatients, sessions, labs],
  )

  const recent = useMemo(
    () =>
      sortSessions(sessions.filter((session) => visibleIds.has(session.patientId))).slice(-8).reverse(),
    [sessions, visibleIds],
  )

  const labAlerts = visiblePatients.filter((patient) => {
    const lab = latestLab(patient.id, labs)
    return lab ? summariseLab(lab).length > 0 : false
  }).length
  const urgent = attention.filter((item) => item.level === "tinggi").length
  const centreName =
    centreFilter === "all"
      ? `${centres.length} centre`
      : centres.find((centre) => centre.id === centreFilter)?.name

  if (!ready) return <LoadingBlock />
  if (profile?.role === "pesakit") return <PatientHome />
  if (profile?.role === "super_admin") {
    return (
      <PageHeader
        eyebrow="Super admin"
        title="Pendaftaran akaun"
        description="Anda melihat status pendaftaran sahaja. Rekod kesihatan pesakit tidak dipaparkan di sini."
        action={
          <Link href="/permohonan" className={cn(buttonVariants(), "h-12")}>
            Semak permohonan
          </Link>
        }
      />
    )
  }

  const now = new Date()
  const todayLabel = formatLongDate(now)
  const weekStart = daysAgoIso(6, now)
  const weekCount = sessions.filter(
    (session) => visibleIds.has(session.patientId) && session.sessionDate >= weekStart,
  ).length

  return (
    <div>
      <PageHeader
        eyebrow={todayLabel || "Hari ini"}
        title={profile?.role === "pesakit" ? "Rekod kesihatan saya" : "Papan pemuka kesihatan"}
        description={
          profile?.role === "pesakit"
            ? "Ringkasan dialisis anda. Sesi, berat, dan rekod darah diisi sendiri selepas kelulusan."
            : `Ringkasan pesakit dialisis untuk ${centreName}. Amaran datang dari sesi terkini dan rekod darah terkini.`
        }
        action={
          <>
            <Link href="/dialisis" className={cn(buttonVariants(), "h-11")}>
              Rekod sesi
            </Link>
            <Link href="/darah" className={cn(buttonVariants({ variant: "outline" }), "h-11")}>
              Rekod darah
            </Link>
          </>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Pesakit aktif" value={String(visiblePatients.length)} detail="Dalam tapisan centre semasa" />
        <Metric label="Sesi 7 hari" value={weekStart ? String(weekCount) : "—"} detail="Termasuk hari ini" />
        <Metric label="Perlu tindakan" value={String(urgent)} detail="Cecair, UF, atau darah kritikal" />
        <Metric label="Darah luar sasaran" value={String(labAlerts)} detail="Berdasarkan sampel terkini" />
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
          <h2 className="font-heading text-2xl">Perlu perhatian</h2>
          {attention.length === 0 ? (
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Tiada amaran pada tapisan ini. Sesi terkini berada dalam julat cecair, dan sampel darah terkini dalam sasaran.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {attention.map((item) => (
                <li key={item.patient.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <Link href={`/pesakit/${item.patient.id}`} className="font-medium hover:underline">
                      {item.patient.fullName}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {centres.find((centre) => centre.id === item.patient.centreId)?.name} · berat kering{" "}
                      {formatKg(item.patient.dryWeightKg)}
                    </p>
                    <ul className="mt-2 space-y-1 text-sm leading-5">
                      {item.reasons.slice(0, 3).map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                  <StatusBadge tone={item.level === "tinggi" ? "danger" : "warn"}>
                    {item.level === "tinggi" ? "Tindakan" : "Pantau"}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
          <h2 className="font-heading text-2xl">Sesi terkini</h2>
          {recent.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Belum ada sesi untuk tapisan ini.</p>
          ) : (
            <Table className="mt-3">
              <TableHeader>
                <TableRow>
                  <TableHead>Tarikh</TableHead>
                  <TableHead>Pesakit</TableHead>
                  <TableHead>Tiba</TableHead>
                  <TableHead>Selepas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((session) => {
                  const patient = patients.find((item) => item.id === session.patientId)
                  return (
                    <TableRow key={session.id}>
                      <TableCell>{formatDate(session.sessionDate)}</TableCell>
                      <TableCell>
                        <Link href={`/pesakit/${session.patientId}`} className="hover:underline">
                          {patient?.fullName}
                        </Link>
                      </TableCell>
                      <TableCell>{formatKg(session.arrivalWeightKg)}</TableCell>
                      <TableCell>{formatKg(session.postWeightKg)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <article className="rounded-2xl bg-primary p-5 text-primary-foreground">
          <h2 className="font-heading text-2xl">Cara UF seterusnya dikira</h2>
          <ol className="mt-3 space-y-2 text-sm leading-6 text-primary-foreground/90">
            <li>1. UF seterusnya = berat selepas dialisis terakhir − berat semasa tiba.</li>
            <li>2. Nilai negatif bermaksud berat naik. Itu penambahan cecair antara sesi.</li>
            <li>3. UF untuk capai berat kering = berat semasa tiba − berat kering.</li>
            <li>4. Jika sesi lepas tamat di atas atau di bawah berat kering, dua angka ini tidak sama.</li>
          </ol>
        </article>
        <article className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
          <h2 className="font-heading text-2xl">Bacaan papan ini</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {urgent === 0
              ? "Tiada pesakit dalam kumpulan tindakan segera."
              : `${urgent} pesakit perlukan semakan cecair, kadar UF, atau keputusan darah.`}{" "}
            Status {BAND_LABEL.tinggi.toLowerCase()} muncul bila penambahan cecair melebihi 5% berat kering.
            Kadar UF di atas 13 mL/kg/jam juga ditanda, dengan anggapan tempoh yang direkodkan.
          </p>
          <div className="mt-4">
            <Disclaimer />
          </div>
        </article>
      </section>
    </div>
  )
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="rounded-2xl bg-card px-4 py-4 ring-1 ring-foreground/10">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-2 font-heading text-4xl">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </article>
  )
}
