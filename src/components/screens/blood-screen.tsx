"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { LabEditor } from "@/components/lab-editor"
import { LabTrends } from "@/components/lab-trends"
import { LoadingBlock, PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { summariseLab } from "@/lib/blood"
import { formatDate } from "@/lib/format"
import { useStore } from "@/lib/store"

export function BloodScreen() {
  const params = useSearchParams()
  const presetPatientId = params.get("pesakit") ?? undefined
  const presetLabId = params.get("makmal") ?? undefined
  const { ready, patients, labs, centreFilter, removeLab } = useStore()
  const [editingId, setEditingId] = useState<string | undefined>(presetLabId)

  const rows = useMemo(() => {
    const allowed = new Set(
      patients
        .filter((patient) => centreFilter === "all" || patient.centreId === centreFilter)
        .map((patient) => patient.id),
    )
    return labs
      .filter((lab) => allowed.has(lab.patientId))
      .sort((a, b) => b.takenOn.localeCompare(a.takenOn) || b.createdAt.localeCompare(a.createdAt))
  }, [labs, patients, centreFilter])

  if (!ready) return <LoadingBlock />

  return (
    <div>
      <PageHeader
        eyebrow="Darah"
        title="Rekod darah anda"
        description="Nilai di bawah ialah rekod yang disimpan. Julat dalam aplikasi ialah panduan am, bukan julat makmal laporan anda. Muat naik fail tidak meneka nombor yang tidak dapat dibaca."
      />
      <LabEditor
        key={`${presetPatientId ?? ""}-${editingId ?? presetLabId ?? "baru"}`}
        presetPatientId={presetPatientId}
        presetLabId={editingId ?? presetLabId}
      />

      <LabTrends labs={rows} />
      <section className="mt-8 grid gap-3">
        <h2 className="font-heading text-2xl">Sampel terkini</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tiada rekod darah dalam tapisan ini.</p>
        ) : (
          rows.map((lab) => {
            const patient = patients.find((item) => item.id === lab.patientId)
            const flags = summariseLab(lab)
            return (
              <article key={lab.id} className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link href={`/pesakit/${lab.patientId}`} className="font-medium hover:underline">
                      {patient?.fullName}
                    </Link>
                    <p className="text-sm text-muted-foreground">{formatDate(lab.takenOn)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditingId(lab.id)}>
                      Ubah
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        removeLab(lab.id)
                          .then(() => toast.success("Rekod darah dipadam."))
                          .catch((error: unknown) =>
                            toast.error(error instanceof Error ? error.message : "Gagal memadam."),
                          )
                      }}
                    >
                      Padam
                    </Button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {flags.length === 0 ? (
                    <StatusBadge tone="good">Dalam sasaran yang diisi</StatusBadge>
                  ) : (
                    flags.map((flag) => (
                      <StatusBadge key={flag.key} tone={flag.serious ? "danger" : "warn"}>
                        {flag.label} {flag.value}
                      </StatusBadge>
                    ))
                  )}
                </div>
                {lab.notes ? <p className="mt-2 text-sm text-muted-foreground">{lab.notes}</p> : null}
              </article>
            )
          })
        )}
      </section>
    </div>
  )
}
