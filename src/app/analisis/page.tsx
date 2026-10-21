"use client"

import { Activity, AlertTriangle, MessageCircleQuestion, NotebookTabs } from "lucide-react"
import { LabArchivePanel } from "@/components/lab-archive-panel"
import { PageHeader } from "@/components/page-header"
import { useStore } from "@/lib/store"
import { analyseRecords } from "@/lib/insight"

export default function Page() {
  const { profile, patients, sessions, labs } = useStore()
  const patient = profile
    ? profile.role === "pesakit"
      ? patients.find((item) => item.id === profile.patientId) ?? null
      : null
    : patients[0] ?? null
  const ownSessions = patient ? sessions.filter((item) => item.patientId === patient.id) : []
  const ownLabs = patient ? labs.filter((item) => item.patientId === patient.id) : []
  const insight = analyseRecords(patient, ownSessions, ownLabs)

  if (profile?.role === "super_admin") {
    return (
      <PageHeader
        eyebrow="Kawalan akses"
        title="Analisis klinikal"
        description="Analisis dan keputusan kesihatan pesakit tidak dipaparkan dalam portal Master Admin."
      />
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        eyebrow="Analisis peribadi"
        title="Ringkasan rekod kesihatan"
        description="Dibina daripada tarikh dan nilai yang benar-benar tersimpan. Carta dan ringkasan tidak menambah angka yang tiada."
      />

      <section className="rounded-3xl border border-primary/20 bg-gradient-to-br from-[#123b4a] via-[#124957] to-[#126b70] p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-teal-100"><Activity className="size-5" /></span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white">Pemerhatian berdasarkan rekod</h2>
            <p className="mt-2 text-sm leading-6 text-teal-50/85">{insight.message}</p>
            {insight.period ? <p className="mt-3 text-xs font-medium text-teal-100">Tempoh rekod: {insight.period}</p> : null}
          </div>
        </div>
      </section>

      {insight.urgent.length > 0 ? (
        <section className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 sm:p-5">
          <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-5 text-destructive" /> Perkara untuk disemak</div>
          <ul className="mt-3 space-y-2 text-sm leading-6">{insight.urgent.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center gap-2"><NotebookTabs className="size-5 text-primary" /><h2 className="font-heading text-2xl">Pemerhatian rekod</h2></div>
        {insight.observations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">Belum ada pemerhatian kerana data yang diperlukan belum direkodkan.</div>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {insight.observations.map((item) => <li key={item} className="rounded-2xl border border-border/80 bg-card p-4 text-sm leading-6 shadow-sm sm:p-5">{item}</li>)}
          </ul>
        )}
      </section>

      {insight.questions.length > 0 ? (
        <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-2"><MessageCircleQuestion className="size-5 text-primary" /><h2 className="font-heading text-xl">Soalan untuk pasukan dialisis</h2></div>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">{insight.questions.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
      ) : null}

      <p className="text-sm leading-6 text-muted-foreground">{insight.disclaimer}</p>
      <section className="space-y-3">
        <PageHeader eyebrow="Dokumen" title="Arkib laporan makmal" description="Buka laporan yang pernah disimpan, semak bacaan yang disahkan dan jejak sumbernya." />
        <LabArchivePanel sections={["analysis"]} />
      </section>
    </div>
  )
}