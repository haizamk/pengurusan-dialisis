"use client"

import Link from "next/link"
import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  Droplets,
  FileHeart,
  HeartPulse,
  Scale,
  Utensils,
} from "lucide-react"
import { WeightChart } from "@/components/weight-chart"
import { buttonVariants } from "@/components/ui/button"
import { formatDate, formatKg } from "@/lib/format"
import { latestLab } from "@/lib/queries"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"

function missing(value: string | null | undefined) {
  return value && value !== "—" ? value : "Belum direkodkan"
}

export function PatientHome() {
  const { profile, patients, sessions, labs } = useStore()
  const patient = patients.find((item) => item.id === profile?.patientId) ?? null
  const ownSessions = patient ? sessions.filter((session) => session.patientId === patient.id) : []
  const ownLabs = patient ? labs.filter((lab) => lab.patientId === patient.id) : []
  const latest = [...ownSessions].sort((a, b) => b.sessionDate.localeCompare(a.sessionDate))[0] ?? null
  const lab = patient ? latestLab(patient.id, ownLabs) : null
  const name = patient?.fullName || profile?.fullName || "pesakit"
  const firstName = name.trim().split(/\s+/)[0] || "pesakit"

  return (
    <div className="space-y-7 xl:space-y-8">
      <section className="relative isolate overflow-hidden rounded-[1.65rem] border border-cyan-400/20 bg-[linear-gradient(115deg,#06243a_0%,#07394b_58%,#075d68_100%)] px-6 py-7 shadow-[0_22px_60px_rgba(0,10,25,0.22)] sm:px-8 sm:py-8 xl:px-10 xl:py-9">
        <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-24 -z-10 size-80 rounded-full border-[42px] border-cyan-200/[0.055]" />
        <div aria-hidden="true" className="pointer-events-none absolute right-28 top-10 -z-10 size-52 rounded-full bg-cyan-300/[0.07] blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute bottom-0 right-0 h-full w-[38%] bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.12),transparent_66%)]" />
        <div className="relative grid items-center gap-7 xl:grid-cols-[minmax(0,1fr)_250px]">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 text-[0.7rem] font-extrabold tracking-[0.22em] text-teal-200 uppercase">
              <span className="size-1.5 rounded-full bg-teal-300" />
              Ruang kesihatan peribadi
            </p>
            <h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight text-white sm:text-4xl xl:text-[2.6rem]">
              Selamat kembali, {firstName}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-sky-50/80 sm:text-base sm:leading-7">
              Semua rekod dialisis dan keputusan darah anda di satu tempat. Maklumat dipaparkan berdasarkan rekod yang telah disimpan.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/dialisis" className={cn(buttonVariants(), "h-12 rounded-xl border border-teal-200/30 bg-teal-300 px-5 font-semibold text-slate-950 shadow-lg shadow-teal-950/20 hover:bg-teal-200")}>
                <Activity className="mr-2 size-4" /> Tambah sesi
              </Link>
              <Link href="/darah" className={cn(buttonVariants({ variant: "outline" }), "h-12 rounded-xl border-cyan-100/25 bg-white/[0.045] px-5 font-semibold text-white hover:bg-white/10 hover:text-white")}>
                <Droplets className="mr-2 size-4" /> Rekod darah
              </Link>
            </div>
          </div>
          <div aria-hidden="true" className="relative hidden h-48 items-center justify-center xl:flex">
            <div className="absolute size-48 rounded-full border border-cyan-200/10 bg-cyan-200/[0.035]" />
            <div className="absolute size-36 rounded-full border border-cyan-200/10" />
            <div className="absolute size-24 rounded-full bg-cyan-300/10 blur-xl" />
            <HeartPulse className="relative size-28 stroke-[1.1] text-cyan-200/75 drop-shadow-[0_0_18px_rgba(103,232,249,0.24)]" />
            <span className="absolute right-7 top-7 size-3 rounded-full bg-teal-200 shadow-[0_0_18px_rgba(94,234,212,0.8)]" />
            <span className="absolute bottom-8 left-8 size-2 rounded-full bg-cyan-100/70" />
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/70 pb-5">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-primary uppercase"><span className="size-1.5 rounded-full bg-primary" /> Ringkasan rekod</p>
            <h2 className="mt-2 font-heading text-3xl tracking-tight sm:text-4xl">Perkembangan anda</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">Nilai terkini dan sejarah berat membantu anda menyemak rekod bersama pasukan dialisis.</p>
          </div>
          {latest ? (
            <div className="hidden items-center gap-3 pb-1 text-sm text-muted-foreground xl:flex">
              <CalendarDays className="size-5 text-primary" />
              <span>Dikemas kini berdasarkan rekod<br /><strong className="font-medium text-foreground">{formatDate(latest.sessionDate)}</strong></span>
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          <Fact icon={CalendarDays} tone="teal" label="Sesi terkini" value={latest ? formatDate(latest.sessionDate) : "Belum direkodkan"} detail="Tarikh sesi terakhir" />
          <Fact icon={Scale} tone="cyan" label="Berat sebelum dialisis" value={latest ? formatKg(latest.arrivalWeightKg) : "Belum direkodkan"} detail="Bacaan yang anda simpan" />
          <Fact icon={Activity} tone="blue" label="Berat selepas dialisis" value={missing(latest?.postWeightKg == null ? null : formatKg(latest.postWeightKg))} detail="Bacaan selepas sesi" />
          <Fact icon={HeartPulse} tone="coral" label="Berat kering" value={patient ? formatKg(patient.dryWeightKg) : "Belum direkodkan"} detail="Berat kering yang disetkan dalam profil" />
          <Fact icon={Droplets} tone="violet" label="Hemoglobin terkini" value={lab?.hemoglobin == null ? "Belum direkodkan" : `${lab.hemoglobin} g/dL`} detail={lab ? `Sampel ${formatDate(lab.takenOn)}` : "Tiada keputusan darah"} />
          <Fact icon={FileHeart} tone="blue" label="Rekod darah terkini" value={lab ? formatDate(lab.takenOn) : "Tiada data tersedia"} detail="Keputusan yang telah disimpan" />
        </div>
      </section>

      <section className="grid gap-4 2xl:grid-cols-[minmax(0,1.45fr)_minmax(330px,0.8fr)]">
        <article className="min-w-0 rounded-3xl border border-border/80 bg-card/90 p-5 shadow-[0_12px_32px_rgba(0,0,0,0.12)] sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[0.68rem] font-extrabold tracking-[0.18em] text-primary uppercase">Trend kesihatan</p>
              <h2 className="mt-2 font-heading text-2xl tracking-tight">Trend berat sepanjang masa</h2>
              <p className="mt-1 text-sm text-muted-foreground">Berdasarkan sesi yang telah direkodkan.</p>
            </div>
            <Link href="/graf" className="inline-flex h-10 items-center gap-1 rounded-xl border border-border px-3 text-sm font-semibold transition hover:border-primary/40 hover:bg-accent">
              Lihat graf <ArrowUpRight className="size-4" />
            </Link>
          </div>
          <div className="mt-5 min-h-[230px]">
            <WeightChart sessions={ownSessions} />
          </div>
        </article>

        <article className="rounded-3xl border border-border/80 bg-card/90 p-5 shadow-[0_12px_32px_rgba(0,0,0,0.12)] sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[0.68rem] font-extrabold tracking-[0.18em] text-primary uppercase">Akses pantas</p>
              <h2 className="mt-2 font-heading text-2xl tracking-tight">Rekod dan maklumat</h2>
            </div>
            <span className="flex size-10 items-center justify-center rounded-xl bg-amber-400/10 text-amber-200"><Activity className="size-5" /></span>
          </div>
          <div className="mt-4 divide-y divide-border/80">
            <QuickLink href="/dialisis" icon={CalendarDays} title="Sesi dialisis" detail={latest ? `Rekod terakhir: ${formatDate(latest.sessionDate)}` : "Lihat dan tambah rekod sesi"} tone="teal" />
            <QuickLink href="/darah" icon={Droplets} title="Keputusan darah" detail={lab ? `Rekod terakhir: ${formatDate(lab.takenOn)}` : "Semak keputusan yang disimpan"} tone="blue" />
            <QuickLink href="/pemakanan" icon={Utensils} title="Cadangan pemakanan" detail="Lihat panduan pemakanan" tone="violet" />
            <QuickLink href="/catatan" icon={FileHeart} title="Catatan kesihatan" detail="Lihat catatan peribadi anda" tone="cyan" />
          </div>
        </article>
      </section>

      <aside className="flex gap-3 rounded-2xl border border-border/80 bg-secondary/35 p-4 sm:p-5">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><HeartPulse className="size-5" /></span>
        <div>
          <p className="text-sm font-semibold">Peringatan kesihatan</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Paparan ini membantu anda memantau rekod dan bukan pengganti nasihat klinikal. Sahkan sasaran rawatan dan sebarang perubahan dengan doktor atau jururawat dialisis anda.
          </p>
        </div>
      </aside>
    </div>
  )
}

function Fact({
  icon: Icon,
  tone,
  label,
  value,
  detail,
}: {
  icon: typeof Scale
  tone: "teal" | "cyan" | "blue" | "coral" | "violet"
  label: string
  value: string
  detail: string
}) {
  const tones = {
    teal: "bg-teal-400/10 text-teal-300 ring-teal-300/10",
    cyan: "bg-cyan-400/10 text-cyan-300 ring-cyan-300/10",
    blue: "bg-sky-400/10 text-sky-300 ring-sky-300/10",
    coral: "bg-orange-400/10 text-orange-300 ring-orange-300/10",
    violet: "bg-violet-400/10 text-violet-300 ring-violet-300/10",
  }
  return (
    <article className="group rounded-2xl border border-border/80 bg-card/90 p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg hover:shadow-black/10 sm:p-5">
      <div className="flex items-start gap-4">
        <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl ring-1", tones[tone])}><Icon className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 break-words text-xl font-semibold leading-snug tracking-tight sm:text-2xl">{value}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
        </div>
      </div>
    </article>
  )
}

function QuickLink({
  href,
  icon: Icon,
  title,
  detail,
  tone,
}: {
  href: string
  icon: typeof Scale
  title: string
  detail: string
  tone: "teal" | "cyan" | "blue" | "violet"
}) {
  const tones = {
    teal: "bg-teal-400/10 text-teal-300",
    cyan: "bg-cyan-400/10 text-cyan-300",
    blue: "bg-sky-400/10 text-sky-300",
    violet: "bg-violet-400/10 text-violet-300",
  }
  return (
    <Link href={href} className="group flex items-center gap-3 py-4 first:pt-1 last:pb-1">
      <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", tones[tone])}><Icon className="size-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold group-hover:text-primary">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{detail}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  )
}
