"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Building2, ChevronRight, Search, UserRound, Users } from "lucide-react"
import { PatientDialog } from "@/components/patient-dialog"
import { LoadingBlock, PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ACCESS_LABEL, ageFromDob, formatKg } from "@/lib/format"
import { analyseSession, attentionFor, latestSession } from "@/lib/queries"
import { BAND_LABEL } from "@/lib/uf"
import { useStore } from "@/lib/store"
import type { AccessType } from "@/lib/types"

export function PatientsScreen() {
  const { ready, centres, patients, sessions, labs, centreFilter, profile } = useStore()
  const [query, setQuery] = useState("")
  const [access, setAccess] = useState<AccessType | "all">("all")
  const [open, setOpen] = useState(false)

  const rows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ms")
    return patients
      .filter((patient) => centreFilter === "all" || patient.centreId === centreFilter)
      .filter((patient) => access === "all" || patient.accessType === access)
      .filter((patient) => {
        if (!needle) return true
        return patient.fullName.toLocaleLowerCase("ms").includes(needle) || patient.mrn.toLocaleLowerCase("ms").includes(needle)
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName, "ms"))
  }, [patients, centreFilter, access, query])

  if (!ready) return <LoadingBlock />
  if (profile?.role === "super_admin") {
    return (
      <PageHeader
        eyebrow="Kawalan akses"
        title="Direktori klinikal"
        description="Direktori pesakit berasingan daripada portal Master Admin. Pengurusan akses tersedia pada halaman permohonan."
      />
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        eyebrow={profile?.role === "pesakit" ? "Rekod peribadi" : "Direktori pesakit"}
        title={profile?.role === "pesakit" ? "Rekod saya" : "Pesakit mengikut centre"}
        description={
          profile?.role === "pesakit"
            ? "Buka rekod anda untuk melihat sesi, bacaan dan sejarah yang telah disimpan."
            : "Cari pesakit dan semak ringkasan sesi terkini. Buka profil untuk melihat sejarah lengkap."
        }
        action={
          profile?.role === "pesakit" ? null : (
            <Button className="h-12 rounded-xl" onClick={() => setOpen(true)}>
              <UserRound className="mr-2 size-4" /> Pesakit baharu
            </Button>
          )
        }
      />

      {profile?.role !== "pesakit" ? (
        <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-12 rounded-xl pl-9" placeholder="Cari nama atau nombor rekod" value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
            <div className="flex flex-wrap gap-2">
              {(["all", "fistula", "graft", "kateter"] as const).map((item) => (
                <Button key={item} type="button" variant={access === item ? "default" : "outline"} className="h-11 rounded-xl" onClick={() => setAccess(item)}>
                  {item === "all" ? "Semua akses" : ACCESS_LABEL[item]}
                </Button>
              ))}
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{rows.length} pesakit dalam tapisan ini</p>
        </section>
      ) : null}

      {rows.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/50 px-5 py-12 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Users className="size-7" /></span>
          <h2 className="mt-4 text-lg font-semibold">Tiada rekod dalam paparan ini</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            {profile?.role === "pesakit" ? "Rekod akan tersedia selepas akaun anda dipautkan kepada rekod pesakit yang diluluskan." : "Cuba carian yang berbeza atau tambah rekod pesakit baharu."}
          </p>
        </div>
      ) : (
        <>
          <section className="hidden overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm md:block">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pesakit</TableHead>
                    <TableHead>Centre</TableHead>
                    <TableHead>Berat kering</TableHead>
                    <TableHead>Akses</TableHead>
                    <TableHead>Keadaan sesi</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((patient) => {
                    const session = latestSession(patient.id, sessions)
                    const analysis = session ? analyseSession(session, sessions) : null
                    const attention = attentionFor(patient, sessions, labs)
                    const centre = centres.find((item) => item.id === patient.centreId)
                    return (
                      <TableRow key={patient.id}>
                        <TableCell>
                          <Link href={`/pesakit/${patient.id}`} className="font-semibold hover:text-primary">{patient.fullName}</Link>
                          <p className="mt-1 text-xs text-muted-foreground">{patient.mrn}{ageFromDob(patient.dateOfBirth) != null ? ` · ${ageFromDob(patient.dateOfBirth)} tahun` : ""}</p>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5"><Building2 className="size-3.5 text-muted-foreground" />{centre?.name ?? "Centre tidak tersedia"}</span>
                          <p className="mt-1 text-xs text-muted-foreground">{centre?.city}</p>
                        </TableCell>
                        <TableCell className="font-semibold tabular-nums">{formatKg(patient.dryWeightKg)}</TableCell>
                        <TableCell>{ACCESS_LABEL[patient.accessType]}<p className="mt-1 text-xs text-muted-foreground">{patient.accessSite || "Lokasi belum diisi"}</p></TableCell>
                        <TableCell>
                          {attention ? <StatusBadge tone={attention.level === "tinggi" ? "danger" : "warn"}>{attention.level === "tinggi" ? "Perlu semakan" : "Pantau"}</StatusBadge> : analysis ? <StatusBadge tone={analysis.band === "baik" ? "good" : analysis.band === "sederhana" ? "warn" : "danger"}>{BAND_LABEL[analysis.band]}</StatusBadge> : <span className="text-sm text-muted-foreground">Belum ada sesi</span>}
                        </TableCell>
                        <TableCell className="text-right"><Link href={`/pesakit/${patient.id}`} className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-primary/10">Buka <ChevronRight className="size-4" /></Link></TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </section>

          <section className="grid gap-3 md:hidden">
            {rows.map((patient) => {
              const centre = centres.find((item) => item.id === patient.centreId)
              const session = latestSession(patient.id, sessions)
              const attention = attentionFor(patient, sessions, labs)
              const analysis = session ? analyseSession(session, sessions) : null
              return (
                <Link key={patient.id} href={`/pesakit/${patient.id}`} className="group rounded-2xl border border-border/80 bg-card p-4 shadow-sm transition-colors hover:border-primary/40 active:bg-secondary/50">
                  <div className="flex items-start gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><UserRound className="size-5" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2"><p className="break-words font-semibold">{patient.fullName}</p><ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" /></div>
                      <p className="mt-1 text-xs text-muted-foreground">{patient.mrn}</p>
                      <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground"><Building2 className="size-3.5" /> {centre?.name ?? "Centre tidak tersedia"}{centre?.city ? ` · ${centre.city}` : ""}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-secondary/60 p-3"><p className="text-xs text-muted-foreground">Berat kering</p><p className="mt-1 font-semibold tabular-nums">{formatKg(patient.dryWeightKg)}</p></div>
                    <div className="rounded-xl bg-secondary/60 p-3"><p className="text-xs text-muted-foreground">Akses</p><p className="mt-1 font-semibold">{ACCESS_LABEL[patient.accessType]}</p></div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">{session ? `Sesi ${session.sessionDate}` : "Belum ada sesi"}</span>
                    {attention ? <StatusBadge tone={attention.level === "tinggi" ? "danger" : "warn"}>{attention.level === "tinggi" ? "Perlu semakan" : "Pantau"}</StatusBadge> : analysis ? <StatusBadge tone={analysis.band === "baik" ? "good" : analysis.band === "sederhana" ? "warn" : "danger"}>{BAND_LABEL[analysis.band]}</StatusBadge> : null}
                  </div>
                </Link>
              )
            })}
          </section>
        </>
      )}

      <PatientDialog open={open} onOpenChange={setOpen} />
    </div>
  )
}
