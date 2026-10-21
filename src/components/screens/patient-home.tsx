"use client"

import Link from "next/link"
import { Activity, ArrowUpRight, Droplets, HeartPulse, Scale, CalendarDays, FileHeart } from "lucide-react"
import { PageHeader } from "@/components/page-header"
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
    <div className="space-y-5 sm:space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-[#123b4a] via-[#124957] to-[#126b70] p-4 shadow-lg shadow-black/10 sm:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full border-[32px] border-white/[0.04]" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 right-24 h-48 w-48 rounded-full bg-teal-300/10 blur-2xl" />
        <div className="relative max-w-3xl">
          <p className="text-xs font-bold tracking-[0.2em] text-teal-200 uppercase">Ruang kesihatan peribadi</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:mt-3 sm:text-4xl">Selamat kembali, {firstName}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-teal-50/80 sm:mt-3 sm:text-base">
            Semua rekod dialisis dan keputusan darah anda di satu tempat. Maklumat dipaparkan berdasarkan rekod yang telah disimpan.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 sm:mt-6 sm:gap-3">
            <Link href="/dialisis" className={cn(buttonVariants(), "h-11 bg-teal-300 text-slate-950 hover:bg-teal-200")}>
              <Activity className="mr-2 size-4" /> Tambah sesi
            </Link>
            <Link href="/darah" className={cn(buttonVariants({ variant: "outline" }), "h-11 border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white")}>
              <Droplets className="mr-2 size-4" /> Rekod darah
            </Link>
          </div>
        </div>
      </section>

      <PageHeader
        eyebrow="Ringkasan rekod"
        title="Perkembangan anda"
        description="Nilai terkini dan sejarah berat membantu anda menyemak rekod bersama pasukan dialisis."
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Fact icon={CalendarDays} label="Sesi terkini" value={latest ? formatDate(latest.sessionDate) : "Belum direkodkan"} detail="Tarikh sesi terakhir" />
        <Fact icon={Scale} label="Berat sebelum dialisis" value={latest ? formatKg(latest.arrivalWeightKg) : "Belum direkodkan"} detail="Bacaan yang anda simpan" />
        <Fact icon={Activity} label="Berat selepas dialisis" value={missing(latest?.postWeightKg == null ? null : formatKg(latest.postWeightKg))} detail="Bacaan selepas sesi" />
        <Fact icon={HeartPulse} label="Berat kering semasa" value={patient ? formatKg(patient.dryWeightKg) : "Belum direkodkan"} detail="Seperti direkodkan dalam profil" />
        <Fact icon={Droplets} label="Hemoglobin terkini" value={lab?.hemoglobin == null ? "Belum direkodkan" : `${lab.hemoglobin} g/dL`} detail={lab ? `Sampel ${formatDate(lab.takenOn)}` : "Tiada keputusan darah"} />
        <Fact icon={FileHeart} label="Rekod darah terkini" value={lab ? formatDate(lab.takenOn) : "Tiada data tersedia"} detail="Keputusan yang telah disimpan" />
      </section>

      <section className="rounded-3xl border border-border/80 bg-card p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-[0.16em] text-primary uppercase">Trend kesihatan</p>
            <h2 className="mt-2 font-heading text-2xl tracking-tight">Berat sepanjang masa</h2>
            <p className="mt-1 text-sm text-muted-foreground">Berdasarkan sesi yang telah direkodkan.</p>
          </div>
          <Link href="/graf" className="inline-flex h-10 items-center gap-1 rounded-xl border border-border px-3 text-sm font-semibold transition hover:bg-accent">
            Lihat graf <ArrowUpRight className="size-4" />
          </Link>
        </div>
        <div className="mt-5">
          <WeightChart sessions={ownSessions} />
        </div>
      </section>

      <aside className="rounded-2xl border border-border/80 bg-secondary/40 p-4 sm:p-5">
        <p className="text-sm font-semibold">Peringatan kesihatan</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Paparan ini untuk membantu anda memantau rekod, bukan menggantikan nasihat klinikal. Sahkan sasaran rawatan dan sebarang perubahan dengan doktor atau jururawat dialisis anda.
        </p>
      </aside>
    </div>
  )
}

function Fact({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Scale
  label: string
  value: string
  detail: string
}) {
  return (
    <article className="group rounded-2xl border border-border/80 bg-card p-3 shadow-sm transition hover:border-primary/40 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
      </div>
      <p className="mt-2 break-words text-xl font-semibold leading-snug tracking-tight sm:mt-4 sm:text-2xl">{value}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
    </article>
  )
}