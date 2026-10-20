"use client"

import { PageHeader } from "@/components/page-header"
import { analyseRecords } from "@/lib/insight"
import { useStore } from "@/lib/store"

export default function Page() {
  const { profile, patients, sessions, labs } = useStore()
  const patient = patients.find((item) => item.id === profile?.patientId) ?? (profile?.role === "pesakit" ? null : patients[0] ?? null)
  const ownSessions = patient ? sessions.filter((item) => item.patientId === patient.id) : []
  const ownLabs = patient ? labs.filter((item) => item.patientId === patient.id) : []
  const insight = analyseRecords(patient, ownSessions, ownLabs)

  return (
    <div>
      <PageHeader
        eyebrow="Analisis"
        title="Ringkasan rekod anda"
        description="Dibina daripada tarikh dan nilai yang tersimpan. Tiada angka ditambah untuk melengkapkan carta."
      />
      <p className="text-sm leading-6">{insight.message}</p>
      {insight.period ? <p className="mt-2 text-sm text-muted-foreground">Tempoh rekod: {insight.period}</p> : null}
      {insight.urgent.length > 0 ? (
        <ul className="mt-4 space-y-2 rounded-2xl bg-destructive/15 p-4 text-sm leading-6">
          {insight.urgent.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      <ul className="mt-4 space-y-3">
        {insight.observations.map((item) => (
          <li key={item} className="rounded-2xl bg-card p-4 text-sm leading-6 ring-1 ring-foreground/10">{item}</li>
        ))}
      </ul>
      {insight.questions.length > 0 ? (
        <section className="mt-6">
          <h2 className="font-heading text-2xl">Soalan untuk pasukan dialisis</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6">
            {insight.questions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="mt-6 text-sm leading-6 text-muted-foreground">{insight.disclaimer}</p>
    </div>
  )
}
