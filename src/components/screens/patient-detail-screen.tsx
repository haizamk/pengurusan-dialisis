"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { LabEditor } from "@/components/lab-editor"
import { LoadingBlock, PageHeader } from "@/components/page-header"
import { PatientDialog } from "@/components/patient-dialog"
import { SessionEditor } from "@/components/session-editor"
import { StatusBadge } from "@/components/status-badge"
import { UfPanel } from "@/components/uf-panel"
import { WeightChart } from "@/components/weight-chart"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { MARKERS, judgeMarker, judgeUrr, ureaReductionRatio } from "@/lib/blood"
import { ACCESS_LABEL, SEX_LABEL, ageFromDob, bp, formatDate, formatKg, formatNumber } from "@/lib/format"
import { analyseSession, labsFor, sessionsFor } from "@/lib/queries"
import { useStore } from "@/lib/store"

export function PatientDetailScreen() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params.id
  const { ready, centres, patients, sessions, labs, removePatient, removeSession, removeLab, profile, source } = useStore()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [sessionId, setSessionId] = useState<string | undefined>()
  const [labId, setLabId] = useState<string | undefined>()
  const [showSession, setShowSession] = useState(false)
  const [showLab, setShowLab] = useState(false)

  if (!ready) return <LoadingBlock />

  if (profile?.role === "super_admin") {
    return <PageHeader eyebrow="Kawalan akses" title="Rekod klinikal" description="Maklumat kesihatan pesakit tidak dipaparkan dalam portal Master Admin." />
  }
  if (profile?.role === "pesakit" && profile.patientId !== id) {
    return <PageHeader eyebrow="Kawalan akses" title="Rekod tidak tersedia" description="Akaun pesakit hanya boleh membuka rekod yang dipautkan kepada akaun sendiri." />
  }

  const patient = patients.find((item) => item.id === id)
  if (!patient) {
    return (
      <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm sm:p-6">
        <h1 className="font-heading text-3xl">Pesakit tidak dijumpai</h1>
        <p className="mt-2 text-sm text-muted-foreground">Rekod ini tiada dalam data semasa.</p>
        <Link href="/pesakit" className="mt-4 inline-block text-sm text-primary underline">
          Kembali ke senarai
        </Link>
      </div>
    )
  }

  const centre = centres.find((item) => item.id === patient.centreId)
  const history = sessionsFor(patient.id, sessions)
  const labHistory = labsFor(patient.id, labs)
  const latest = history.at(-1)
  const analysis = latest ? analyseSession(latest, sessions) : null
  const age = ageFromDob(patient.dateOfBirth)

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        eyebrow={centre ? `${centre.name}, ${centre.city}` : "Centre"}
        title={patient.fullName}
        description={`${patient.mrn} · ${SEX_LABEL[patient.sex]}${age != null ? ` · ${age} tahun` : ""} · ${patient.schedule}`}
        action={
          <>
            {profile?.role !== "pesakit" ? (
              <Button variant="outline" className="h-11 rounded-xl" onClick={() => setEditOpen(true)}>
                Kemas kini profil
              </Button>
            ) : null}
            <Button
              className="h-11 rounded-xl"
              onClick={() => {
                setSessionId(undefined)
                setShowSession(true)
                setShowLab(false)
              }}
            >
              Sesi baharu
            </Button>
            <Button
              variant="outline"
              className="h-11"
              onClick={() => {
                setLabId(undefined)
                setShowLab(true)
                setShowSession(false)
              }}
            >
              Darah baharu
            </Button>
          </>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Info label="Berat kering" value={formatKg(patient.dryWeightKg)} />
        <Info label="Akses" value={`${ACCESS_LABEL[patient.accessType]} · ${patient.accessSite || "lokasi belum diisi"}`} />
        <Info label="Diagnosis" value={patient.diagnosis || "Belum diisi"} />
        <Info label="Status" value={patient.active ? "Aktif" : "Tidak aktif"} />
      </section>
      {patient.notes ? (
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{patient.notes}</p>
      ) : null}

      <div className="mt-6">
        {analysis ? <UfPanel analysis={analysis} /> : (
          <p className="rounded-2xl border border-border/80 bg-card p-5 text-sm text-muted-foreground shadow-sm">
            Belum ada sesi. Rekod berat semasa tiba untuk mengira UF seterusnya.
          </p>
        )}
      </div>

      {showSession ? (
        <div className="mt-6">
          <SessionEditor
            key={`${patient.id}-${sessionId ?? "baru"}`}
            presetPatientId={patient.id}
            presetSessionId={sessionId}
          />
        </div>
      ) : null}
      {showLab ? (
        <div className="mt-6">
          <LabEditor
            key={`${patient.id}-${labId ?? "baru"}`}
            presetPatientId={patient.id}
            presetLabId={labId}
          />
        </div>
      ) : null}

      <section className="rounded-3xl border border-border/80 bg-card p-4 shadow-sm sm:p-6">
        <h2 className="font-heading text-2xl">Trend berat</h2>
        <div className="mt-4">
          <WeightChart sessions={history} />
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:p-5">
        <h2 className="font-heading text-2xl">Sesi dialisis</h2>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Belum ada sesi.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-border/80"><Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarikh</TableHead>
                <TableHead>Tiba</TableHead>
                <TableHead>Selepas</TableHead>
                <TableHead>Kering</TableHead>
                <TableHead>TD</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...history].reverse().map((session) => (
                <TableRow key={session.id}>
                  <TableCell>{formatDate(session.sessionDate)}</TableCell>
                  <TableCell>{formatKg(session.arrivalWeightKg)}</TableCell>
                  <TableCell>{formatKg(session.postWeightKg)}</TableCell>
                  <TableCell>{formatKg(session.dryWeightKg)}</TableCell>
                  <TableCell>{bp(session.systolicPre, session.diastolicPre)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSessionId(session.id)
                        setShowSession(true)
                        setShowLab(false)
                      }}
                    >
                      Ubah
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        removeSession(session.id)
                          .then(() => toast.success("Sesi dipadam."))
                          .catch((error: unknown) =>
                            toast.error(error instanceof Error ? error.message : "Gagal memadam sesi."),
                          )
                      }}
                    >
                      Padam
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table></div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:p-5">
        <h2 className="font-heading text-2xl">Rekod darah</h2>
        {labHistory.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Belum ada sampel.</p>
        ) : (
          <div className="mt-4 grid gap-4">
            {[...labHistory].reverse().map((lab) => {
              const urr = ureaReductionRatio(lab.ureaPre, lab.ureaPost)
              return (
                <article key={lab.id} className="rounded-xl bg-secondary/50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{formatDate(lab.takenOn)}</p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setLabId(lab.id)
                          setShowLab(true)
                          setShowSession(false)
                        }}
                      >
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
                    {MARKERS.map((marker) => {
                      const value = lab[marker.key]
                      if (value == null) return null
                      const status = judgeMarker(marker.key, value)
                      return (
                        <StatusBadge
                          key={marker.key}
                          tone={
                            status === "sasaran" || status === "trend"
                              ? "neutral"
                              : status.startsWith("kritikal")
                                ? "danger"
                                : "warn"
                          }
                        >
                          {marker.label} {formatNumber(value, marker.digits)} {marker.unit}
                        </StatusBadge>
                      )
                    })}
                    {urr != null ? (
                      <StatusBadge tone={judgeUrr(urr) === "sasaran" ? "good" : "warn"}>
                        URR {formatNumber(urr)}%
                      </StatusBadge>
                    ) : null}
                  </div>
                  {lab.notes ? <p className="mt-2 text-sm text-muted-foreground">{lab.notes}</p> : null}
                </article>
              )
            })}
          </div>
        )}
      </section>

      {source === "local" || profile?.role === "super_admin" ? (
        <div className="mt-6">
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            Padam pesakit
          </Button>
        </div>
      ) : null}

      {profile?.role !== "pesakit" ? <PatientDialog open={editOpen} onOpenChange={setEditOpen} patient={patient} /> : null}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Padam {patient.fullName}?</DialogTitle>
            <DialogDescription>
              Sesi dialisis dan rekod darah pesakit ini turut dipadam.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                removePatient(patient.id)
                  .then(() => {
                    toast.success("Pesakit dipadam.")
                    router.push("/pesakit")
                  })
                  .catch((error: unknown) =>
                    toast.error(error instanceof Error ? error.message : "Gagal memadam pesakit."),
                  )
              }}
            >
              Padam
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-2 text-sm leading-6 font-medium">{value}</p>
    </article>
  )
}
