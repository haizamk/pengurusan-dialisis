"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"
import { Activity, CalendarClock, ClipboardList, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { LoadingBlock, PageHeader } from "@/components/page-header"
import { SessionEditor } from "@/components/session-editor"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDate, formatKg } from "@/lib/format"
import { analyseSession, sortSessions } from "@/lib/queries"
import { BAND_LABEL } from "@/lib/uf"
import { useStore } from "@/lib/store"

export function DialysisScreen() {
  const params = useSearchParams()
  const presetPatientId = params.get("pesakit") ?? undefined
  const presetSessionId = params.get("sesi") ?? undefined
  const { ready, patients, centres, sessions, centreFilter, removeSession, profile } = useStore()
  const [editingId, setEditingId] = useState<string | undefined>(presetSessionId)

  const rows = useMemo(() => {
    const allowed = new Set(
      patients.filter((patient) => centreFilter === "all" || patient.centreId === centreFilter).map((patient) => patient.id),
    )
    return sortSessions(sessions.filter((session) => allowed.has(session.patientId))).reverse()
  }, [patients, sessions, centreFilter])

  if (!ready) return <LoadingBlock />
  if (profile?.role === "super_admin") {
    return <PageHeader eyebrow="Kawalan akses" title="Rekod klinikal" description="Sesi dialisis tidak dipaparkan dalam portal Master Admin." />
  }

  const deleteSession = (id: string) => {
    void removeSession(id)
      .then(() => toast.success("Sesi dialisis dipadam."))
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Gagal memadam sesi."))
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        eyebrow="Pemantauan dialisis"
        title="Sesi, berat dan UF"
        description="Rekodkan bacaan sesi sebenar. Perbandingan berat dan pengiraan UF membantu menyemak data bersama pasukan dialisis."
        action={<a href="#borang-sesi" className="inline-flex h-12 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"><Plus className="mr-2 size-4" /> Sesi baharu</a>}
      />

      <section id="borang-sesi" className="scroll-mt-28">
        <SessionEditor
          key={`${presetPatientId ?? ""}-${editingId ?? presetSessionId ?? "baru"}`}
          presetPatientId={presetPatientId}
          presetSessionId={editingId ?? presetSessionId}
        />
      </section>

      <section className="space-y-4 rounded-3xl border border-border/80 bg-card p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-primary uppercase">Sejarah rawatan</p>
            <h2 className="mt-1 font-heading text-2xl">Sesi terdahulu</h2>
            <p className="mt-1 text-sm text-muted-foreground">{rows.length} sesi dalam paparan ini</p>
          </div>
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><ClipboardList className="size-5" /></span>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center">
            <CalendarClock className="mx-auto size-7 text-primary" />
            <p className="mt-2 font-semibold">Belum ada sesi direkodkan</p>
            <p className="mt-1 text-sm text-muted-foreground">Sesi yang disimpan akan muncul di sini.</p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-xl border border-border/80 md:block">
              <Table>
                <TableHeader><TableRow><TableHead>Tarikh</TableHead><TableHead>Pesakit</TableHead><TableHead>Centre</TableHead><TableHead>Tiba</TableHead><TableHead>Selepas</TableHead><TableHead>Status UF</TableHead><TableHead>Tindakan</TableHead></TableRow></TableHeader>
                <TableBody>
                  {rows.map((session) => {
                    const patient = patients.find((item) => item.id === session.patientId)
                    const centre = centres.find((item) => item.id === session.centreId)
                    const analysis = analyseSession(session, sessions)
                    return (
                      <TableRow key={session.id}>
                        <TableCell className="whitespace-nowrap">{formatDate(session.sessionDate)}</TableCell>
                        <TableCell><Link href={`/pesakit/${session.patientId}`} className="font-semibold hover:text-primary">{patient?.fullName ?? "Rekod pesakit"}</Link></TableCell>
                        <TableCell>{centre?.city ?? "—"}</TableCell>
                        <TableCell className="tabular-nums">{formatKg(session.arrivalWeightKg)}</TableCell>
                        <TableCell className="tabular-nums">{formatKg(session.postWeightKg)}</TableCell>
                        <TableCell><StatusBadge tone={analysis.band === "baik" ? "good" : analysis.band === "sederhana" ? "warn" : "danger"}>{BAND_LABEL[analysis.band]}</StatusBadge></TableCell>
                        <TableCell><div className="flex justify-end gap-1"><Button variant="ghost" size="sm" className="h-10" onClick={() => setEditingId(session.id)}><Pencil className="mr-1.5 size-3.5" /> Ubah</Button><Button variant="ghost" size="sm" className="h-10 text-destructive hover:text-destructive" onClick={() => deleteSession(session.id)}><Trash2 className="mr-1.5 size-3.5" /> Padam</Button></div></TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="grid gap-3 md:hidden">
              {rows.map((session) => {
                const patient = patients.find((item) => item.id === session.patientId)
                const analysis = analyseSession(session, sessions)
                return (
                  <article key={session.id} className="rounded-2xl border border-border/80 bg-background/50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div><p className="font-semibold">{patient?.fullName ?? "Rekod pesakit"}</p><p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarClock className="size-3.5" /> {formatDate(session.sessionDate)}</p></div>
                      <StatusBadge tone={analysis.band === "baik" ? "good" : analysis.band === "sederhana" ? "warn" : "danger"}>{BAND_LABEL[analysis.band]}</StatusBadge>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <Value label="Berat tiba" value={formatKg(session.arrivalWeightKg)} />
                      <Value label="Berat selepas" value={formatKg(session.postWeightKg)} />
                      <Value label="Berat kering" value={formatKg(session.dryWeightKg)} />
                      <Value label="Centre" value={centres.find((item) => item.id === session.centreId)?.city ?? "—"} />
                    </div>
                    <div className="mt-3 flex gap-2 border-t border-border pt-3"><Button variant="outline" className="h-11 flex-1 rounded-xl" onClick={() => setEditingId(session.id)}><Pencil className="mr-2 size-4" /> Ubah</Button><Button variant="ghost" className="h-11 rounded-xl text-destructive hover:text-destructive" onClick={() => deleteSession(session.id)}><Trash2 className="mr-2 size-4" /> Padam</Button></div>
                  </article>
                )
              })}
            </div>
          </>
        )}
      </section>
    </div>
  )
}

function Value({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-secondary/60 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 break-words font-semibold tabular-nums">{value}</p></div>
}
