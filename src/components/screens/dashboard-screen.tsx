"use client"

import Link from "next/link"
import { useMemo } from "react"
import { Activity, ArrowUpRight, BellRing, CalendarDays, CheckCircle2, ClipboardCheck, Droplets, ShieldCheck, Users } from "lucide-react"
import { Disclaimer, LoadingBlock, PageHeader } from "@/components/page-header"
import { PatientHome } from "@/components/screens/patient-home"
import { StatusBadge } from "@/components/status-badge"
import { buttonVariants } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { summariseLab } from "@/lib/blood"
import { daysAgoIso, formatDate, formatKg, formatLongDate } from "@/lib/format"
import { attentionFor, latestLab, sortSessions } from "@/lib/queries"
import { BAND_LABEL } from "@/lib/uf"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"

export function DashboardScreen() {
  const { ready, centres, patients, sessions, labs, centreFilter, profile, applications } = useStore()

  const visiblePatients = useMemo(
    () => patients.filter((patient) => patient.active && (centreFilter === "all" || patient.centreId === centreFilter)),
    [patients, centreFilter],
  )
  const visibleIds = useMemo(() => new Set(visiblePatients.map((patient) => patient.id)), [visiblePatients])
  const attention = useMemo(
    () => visiblePatients.map((patient) => attentionFor(patient, sessions, labs)).filter((item) => item != null)
      .sort((a, b) => Number(b.level === "tinggi") - Number(a.level === "tinggi")),
    [visiblePatients, sessions, labs],
  )
  const recent = useMemo(
    () => sortSessions(sessions.filter((session) => visibleIds.has(session.patientId))).slice(-8).reverse(),
    [sessions, visibleIds],
  )
  const labAlerts = visiblePatients.filter((patient) => {
    const lab = latestLab(patient.id, labs)
    return lab ? summariseLab(lab).length > 0 : false
  }).length

  if (!ready) return <LoadingBlock />
  if (profile?.role === "pesakit") return <PatientHome />
  if (profile?.role === "super_admin") return <AdminOverview applications={applications} centresCount={centres.length} />

  const urgent = attention.filter((item) => item.level === "tinggi").length
  const centreName = centreFilter === "all" ? `${centres.length} centre` : centres.find((centre) => centre.id === centreFilter)?.name
  const now = new Date()
  const weekStart = daysAgoIso(6, now)
  const weekCount = sessions.filter((session) => visibleIds.has(session.patientId) && session.sessionDate >= weekStart).length

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        eyebrow={formatLongDate(now) || "Hari ini"}
        title="Papan pemuka kesihatan"
        description={`Ringkasan operasi untuk ${centreName}. Semak sesi terkini dan perkara yang memerlukan perhatian pasukan dialisis.`}
        action={
          <>
            <Link href="/dialisis" className={cn(buttonVariants(), "h-11 rounded-xl")}><Activity className="mr-2 size-4" /> Rekod sesi</Link>
            <Link href="/darah" className={cn(buttonVariants({ variant: "outline" }), "h-11 rounded-xl")}><Droplets className="mr-2 size-4" /> Rekod darah</Link>
          </>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Users} label="Pesakit aktif" value={String(visiblePatients.length)} detail="Dalam tapisan centre semasa" />
        <Metric icon={CalendarDays} label="Sesi 7 hari" value={weekStart ? String(weekCount) : "—"} detail="Termasuk hari ini" />
        <Metric icon={BellRing} label="Perlu tindakan" value={String(urgent)} detail="Semak sesi dan rekod darah" />
        <Metric icon={Droplets} label="Darah perlu disemak" value={String(labAlerts)} detail="Berdasarkan sampel terkini" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="rounded-3xl border border-border/80 bg-card p-4 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-xs font-bold tracking-[0.16em] text-primary uppercase">Triage rekod</p><h2 className="mt-2 font-heading text-2xl">Perlu perhatian</h2></div>
            <span className="flex size-10 items-center justify-center rounded-xl bg-amber-400/10 text-amber-200"><BellRing className="size-5" /></span>
          </div>
          {attention.length === 0 ? (
            <p className="mt-4 rounded-xl bg-secondary/50 p-4 text-sm leading-6 text-muted-foreground">Tiada amaran berdasarkan data yang tersedia untuk tapisan ini.</p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {attention.map((item) => (
                <li key={item.patient.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <Link href={`/pesakit/${item.patient.id}`} className="font-semibold hover:text-primary">{item.patient.fullName}</Link>
                    <p className="mt-1 text-xs text-muted-foreground">{centres.find((centre) => centre.id === item.patient.centreId)?.name} · berat kering {formatKg(item.patient.dryWeightKg)}</p>
                    <ul className="mt-2 space-y-1 text-sm leading-5">{item.reasons.slice(0, 3).map((reason) => <li key={reason}>{reason}</li>)}</ul>
                  </div>
                  <StatusBadge tone={item.level === "tinggi" ? "danger" : "warn"}>{item.level === "tinggi" ? "Tindakan" : "Pantau"}</StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-3xl border border-border/80 bg-card p-4 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold tracking-[0.16em] text-primary uppercase">Aktiviti terbaru</p><h2 className="mt-2 font-heading text-2xl">Sesi terkini</h2></div><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Activity className="size-5" /></span></div>
          {recent.length === 0 ? <p className="mt-4 rounded-xl bg-secondary/50 p-4 text-sm text-muted-foreground">Belum ada sesi untuk tapisan ini.</p> : (
            <div className="mt-3 overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Tarikh</TableHead><TableHead>Pesakit</TableHead><TableHead>Tiba</TableHead><TableHead>Selepas</TableHead></TableRow></TableHeader>
                <TableBody>{recent.map((session) => {
                  const patient = patients.find((item) => item.id === session.patientId)
                  return <TableRow key={session.id}><TableCell className="whitespace-nowrap">{formatDate(session.sessionDate)}</TableCell><TableCell><Link href={`/pesakit/${session.patientId}`} className="font-medium hover:text-primary">{patient?.fullName}</Link></TableCell><TableCell>{formatKg(session.arrivalWeightKg)}</TableCell><TableCell>{formatKg(session.postWeightKg)}</TableCell></TableRow>
                })}</TableBody>
              </Table>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-3xl border border-primary/20 bg-gradient-to-br from-[#123b4a] to-[#155c65] p-5 text-white sm:p-6">
          <p className="text-xs font-bold tracking-[0.16em] text-teal-200 uppercase">Panduan pengiraan</p>
          <h2 className="mt-2 font-heading text-2xl">Memahami UF</h2>
          <ol className="mt-3 space-y-2 text-sm leading-6 text-teal-50/85">
            <li>1. Perubahan berat antara sesi membantu pasukan memahami pertambahan cecair.</li>
            <li>2. UF sebenar perlu ditafsir bersama tempoh rawatan dan keadaan klinikal.</li>
            <li>3. Berat kering dan sasaran rawatan mesti disahkan oleh pasukan dialisis.</li>
          </ol>
        </article>
        <article className="rounded-3xl border border-border/80 bg-card p-5 shadow-sm sm:p-6">
          <p className="text-xs font-bold tracking-[0.16em] text-primary uppercase">Nota klinikal</p>
          <h2 className="mt-2 font-heading text-2xl">Baca dengan konteks</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {urgent === 0 ? "Tiada rekod dalam kumpulan tindakan segera berdasarkan data yang tersedia." : `${urgent} pesakit memerlukan semakan rekod oleh pasukan dialisis.`} Status ini ialah petunjuk semakan, bukan diagnosis atau arahan rawatan automatik.
          </p>
          <div className="mt-4"><Disclaimer /></div>
          <Link href="/analisis" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">Buka analisis <ArrowUpRight className="size-4" /></Link>
        </article>
      </section>
    </div>
  )
}

function AdminOverview({ applications, centresCount }: { applications: { userId: string; fullName: string; email: string; status: string }[]; centresCount: number }) {
  const waiting = applications.filter((item) => item.status === "menunggu")
  const approved = applications.filter((item) => item.status === "lulus").length
  const rejected = applications.filter((item) => item.status === "tolak").length
  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-[#123b4a] via-[#124957] to-[#126b70] p-5 shadow-lg shadow-black/10 sm:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full border-[32px] border-white/[0.04]" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl"><p className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.2em] text-teal-200 uppercase"><ShieldCheck className="size-4" /> Portal master admin</p><h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Selamat datang</h1><p className="mt-3 text-sm leading-6 text-teal-50/80 sm:text-base">Urus permohonan akses dan pantau status akaun. Kawalan pentadbir dipisahkan daripada rekod klinikal pesakit.</p></div>
          <Link href="/permohonan" className={cn(buttonVariants(), "h-12 shrink-0 rounded-xl bg-teal-300 text-slate-950 hover:bg-teal-200")}><ClipboardCheck className="mr-2 size-4" /> Semak permohonan <ArrowUpRight className="ml-2 size-4" /></Link>
        </div>
      </section>
      <PageHeader eyebrow="Gambaran keseluruhan" title="Kawalan akses portal" description="Ringkasan status akaun dan permohonan tanpa memaparkan maklumat kesihatan pesakit." />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={BellRing} label="Menunggu kelulusan" value={String(waiting.length)} detail="Perlu semakan super admin" />
        <Metric icon={CheckCircle2} label="Akaun diluluskan" value={String(approved)} detail="Akses portal telah diberikan" />
        <Metric icon={Users} label="Semua permohonan" value={String(applications.length)} detail="Termasuk semua status" />
        <Metric icon={ShieldCheck} label="Centre berdaftar" value={String(centresCount)} detail={`${rejected} permohonan ditolak`} />
      </section>
      <section className="rounded-3xl border border-border/80 bg-card p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold tracking-tight">Perlu tindakan</h2><p className="mt-1 text-sm text-muted-foreground">Permohonan yang menunggu semakan.</p></div><Link href="/permohonan" className="inline-flex h-10 items-center gap-1 rounded-xl border border-border px-3 text-sm font-semibold hover:bg-accent">Semua permohonan <ArrowUpRight className="size-4" /></Link></div>
        {waiting.length === 0 ? <div className="mt-4 rounded-2xl border border-dashed border-border p-6 text-center"><CheckCircle2 className="mx-auto size-8 text-primary" /><p className="mt-2 font-semibold">Tiada permohonan tertangguh</p><p className="mt-1 text-sm text-muted-foreground">Semua permohonan telah disemak buat masa ini.</p></div> : (
          <div className="mt-4 divide-y divide-border">{waiting.slice(0, 5).map((item) => <div key={item.userId} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="font-semibold">{item.fullName}</p><p className="break-all text-sm text-muted-foreground">{item.email}</p></div><span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-200"><BellRing className="size-3.5" /> Menunggu semakan</span></div>)}</div>
        )}
      </section>
      <aside className="rounded-2xl border border-border/80 bg-secondary/40 p-4 text-sm leading-6 text-muted-foreground sm:p-5">Privasi: halaman pentadbir ini hanya memaparkan status akaun dan permohonan. Maklumat klinikal kekal di ruang kerja yang sesuai.</aside>
    </div>
  )
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof Users; label: string; value: string; detail: string }) {
  return (
    <article className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm transition hover:border-primary/35 sm:p-5">
      <div className="flex items-start justify-between gap-3"><p className="text-sm font-medium text-muted-foreground">{label}</p><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></span></div>
      <p className="mt-4 text-3xl font-semibold tabular-nums tracking-tight">{value}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
    </article>
  )
}
