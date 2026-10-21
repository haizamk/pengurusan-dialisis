"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"
import { CalendarDays, Droplets, FileHeart, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { LabArchivePanel } from "@/components/lab-archive-panel"
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
  const { ready, patients, labs, centreFilter, removeLab, profile } = useStore()
  const [editingId, setEditingId] = useState<string | undefined>(presetLabId)

  const rows = useMemo(() => {
    const allowed = new Set(patients.filter((patient) => centreFilter === "all" || patient.centreId === centreFilter).map((patient) => patient.id))
    return labs.filter((lab) => allowed.has(lab.patientId)).sort((a, b) => b.takenOn.localeCompare(a.takenOn) || b.createdAt.localeCompare(a.createdAt))
  }, [labs, patients, centreFilter])

  if (!ready) return <LoadingBlock />
  if (profile?.role === "super_admin") {
    return <PageHeader eyebrow="Kawalan akses" title="Rekod klinikal" description="Keputusan darah dan dokumen pesakit tidak dipaparkan dalam portal Master Admin." />
  }

  const deleteLab = (id: string) => {
    void removeLab(id)
      .then(() => toast.success("Rekod darah dipadam."))
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Gagal memadam rekod darah."))
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        eyebrow="Pemantauan makmal"
        title="Rekod darah"
        description="Simpan keputusan sebenar, sahkan bacaan daripada laporan dan lihat trend dari semasa ke semasa. Bacaan yang tiada tidak dianggarkan."
      />

      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><FileHeart className="size-5" /></span>
          <div><h2 className="font-heading text-xl">Laporan makmal</h2><p className="mt-1 text-sm text-muted-foreground">Muat naik dan semak fail yang disimpan.</p></div>
        </div>
        <LabArchivePanel sections={["upload", "history"]} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Droplets className="size-5" /></span>
          <div><h2 className="font-heading text-xl">Rekod manual</h2><p className="mt-1 text-sm text-muted-foreground">Tambah atau kemas kini bacaan yang sudah diperiksa.</p></div>
        </div>
        <LabEditor
          key={`${presetPatientId ?? ""}-${editingId ?? presetLabId ?? "baru"}`}
          presetPatientId={presetPatientId}
          presetLabId={editingId ?? presetLabId}
        />
      </section>

      <section className="space-y-4 rounded-3xl border border-border/80 bg-card p-4 shadow-sm sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div><p className="text-xs font-bold tracking-[0.18em] text-primary uppercase">Trend</p><h2 className="mt-1 font-heading text-2xl">Sejarah bacaan darah</h2></div>
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><CalendarDays className="size-5" /></span>
        </div>
        <LabTrends labs={rows} />
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-bold tracking-[0.18em] text-primary uppercase">Rekod tersimpan</p><h2 className="mt-1 font-heading text-2xl">Sampel terdahulu</h2></div>
          <span className="rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground">{rows.length} sampel</span>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center">
            <Droplets className="mx-auto size-7 text-primary" /><p className="mt-2 font-semibold">Belum ada bacaan darah</p><p className="mt-1 text-sm text-muted-foreground">Rekod manual atau keputusan disahkan akan muncul di sini.</p>
          </div>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {rows.map((lab) => {
              const patient = patients.find((item) => item.id === lab.patientId)
              const flags = summariseLab(lab)
              return (
                <article key={lab.id} className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/pesakit/${lab.patientId}`} className="break-words font-semibold hover:text-primary">{patient?.fullName ?? "Rekod peribadi"}</Link>
                      <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground"><CalendarDays className="size-3.5" /> {formatDate(lab.takenOn)}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button variant="outline" size="sm" className="h-10 rounded-xl" onClick={() => setEditingId(lab.id)}><Pencil className="mr-1.5 size-3.5" /> Ubah</Button>
                      <Button variant="ghost" size="sm" className="h-10 rounded-xl text-destructive hover:text-destructive" onClick={() => deleteLab(lab.id)}><Trash2 className="mr-1.5 size-3.5" /> Padam</Button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {flags.length === 0 ? <StatusBadge tone="good">Tiada penanda daripada peraturan diisi</StatusBadge> : flags.map((flag) => <StatusBadge key={flag.key} tone={flag.serious ? "danger" : "warn"}>{flag.label} {flag.value}</StatusBadge>)}
                  </div>
                  {lab.notes ? <p className="mt-3 border-t border-border pt-3 text-sm leading-6 text-muted-foreground">{lab.notes}</p> : null}
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
