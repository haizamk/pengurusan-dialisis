"use client"

import Link from "next/link"
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
  const patient = patients.find((item) => item.id === profile?.patientId) ?? patients[0] ?? null
  const ownSessions = patient ? sessions.filter((session) => session.patientId === patient.id) : []
  const ownLabs = patient ? labs.filter((lab) => lab.patientId === patient.id) : []
  const latest = [...ownSessions].sort((a, b) => b.sessionDate.localeCompare(a.sessionDate))[0] ?? null
  const lab = patient ? latestLab(patient.id, ownLabs) : null
  const name = patient?.fullName || profile?.fullName || "pesakit"

  return (
    <div>
      <PageHeader
        eyebrow="Rekod peribadi"
        title={`Helo, ${name}`}
        description="Ini ruang anda. Nilai di bawah datang daripada rekod yang anda simpan. Yang kosong ditulis sebagai belum direkodkan."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/dialisis" className={cn(buttonVariants(), "h-12")}>Tambah sesi</Link>
            <Link href="/darah" className={cn(buttonVariants({ variant: "outline" }), "h-12")}>Rekod darah</Link>
            <Link href="/catatan" className={cn(buttonVariants({ variant: "outline" }), "h-12")}>Catatan</Link>
          </div>
        }
      />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Fact label="Sesi terkini" value={latest ? formatDate(latest.sessionDate) : "Belum direkodkan"} />
        <Fact label="Berat sebelum terkini" value={latest ? formatKg(latest.arrivalWeightKg) : "Belum direkodkan"} />
        <Fact label="Berat selepas terkini" value={missing(latest?.postWeightKg == null ? null : formatKg(latest.postWeightKg))} />
        <Fact label="Berat kering semasa" value={patient ? formatKg(patient.dryWeightKg) : "Belum direkodkan"} />
        <Fact
          label="Hemoglobin terkini"
          value={lab?.hemoglobin == null ? "Belum direkodkan" : `${lab.hemoglobin} g/dL · ${formatDate(lab.takenOn)}`}
        />
        <Fact label="Laporan darah terkini" value={lab ? formatDate(lab.takenOn) : "Tiada data tersedia"} />
      </section>
      <section className="mt-6 rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
        <h2 className="font-heading text-2xl">Berat sepanjang masa</h2>
        <div className="mt-4">
          <WeightChart sessions={ownSessions} />
        </div>
      </section>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        Sasaran rawatan ditentukan oleh pasukan dialisis anda. Angka di sini untuk pemantauan, bukan preskripsi baharu.
      </p>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl leading-snug">{value}</p>
    </article>
  )
}
