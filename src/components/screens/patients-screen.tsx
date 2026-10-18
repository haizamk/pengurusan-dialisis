"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { PatientDialog } from "@/components/patient-dialog"
import { LoadingBlock, PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ACCESS_LABEL, ageFromDob, formatKg } from "@/lib/format"
import { analyseSession, attentionFor, latestSession } from "@/lib/queries"
import { BAND_LABEL } from "@/lib/uf"
import { useStore } from "@/lib/store"
import type { AccessType } from "@/lib/types"

export function PatientsScreen() {
  const { ready, centres, patients, sessions, labs, centreFilter } = useStore()
  const [query, setQuery] = useState("")
  const [access, setAccess] = useState<AccessType | "all">("all")
  const [open, setOpen] = useState(false)

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return patients
      .filter((patient) => centreFilter === "all" || patient.centreId === centreFilter)
      .filter((patient) => access === "all" || patient.accessType === access)
      .filter((patient) => {
        if (!needle) return true
        return (
          patient.fullName.toLowerCase().includes(needle) ||
          patient.mrn.toLowerCase().includes(needle)
        )
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName, "ms"))
  }, [patients, centreFilter, access, query])

  if (!ready) return <LoadingBlock />

  return (
    <div>
      <PageHeader
        eyebrow="Pesakit"
        title="Senarai mengikut centre"
        description="Cari pesakit, lihat berat kering, dan buka rekod untuk sesi serta darah."
        action={
          <Button className="h-11" onClick={() => setOpen(true)}>
            Pesakit baharu
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Input
          className="h-11 sm:max-w-sm"
          placeholder="Cari nama atau no. rekod"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {(["all", "fistula", "graft", "kateter"] as const).map((item) => (
            <Button
              key={item}
              type="button"
              variant={access === item ? "default" : "outline"}
              onClick={() => setAccess(item)}
            >
              {item === "all" ? "Semua akses" : ACCESS_LABEL[item]}
            </Button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl bg-card p-6 ring-1 ring-foreground/10">
          <p className="font-heading text-2xl">Tiada pesakit dalam tapisan ini</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Tukar centre, kosongkan carian, atau tambah pesakit baharu.
          </p>
        </div>
      ) : (
        <>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pesakit</TableHead>
                  <TableHead>Centre</TableHead>
                  <TableHead>Berat kering</TableHead>
                  <TableHead>Akses</TableHead>
                  <TableHead>Sesi terkini</TableHead>
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
                        <Link href={`/pesakit/${patient.id}`} className="font-medium hover:underline">
                          {patient.fullName}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {patient.mrn}
                          {ageFromDob(patient.dateOfBirth) != null
                            ? ` · ${ageFromDob(patient.dateOfBirth)} tahun`
                            : ""}
                        </p>
                      </TableCell>
                      <TableCell>
                        {centre?.name}
                        <p className="text-xs text-muted-foreground">{centre?.city}</p>
                      </TableCell>
                      <TableCell>{formatKg(patient.dryWeightKg)}</TableCell>
                      <TableCell>
                        {ACCESS_LABEL[patient.accessType]}
                        <p className="text-xs text-muted-foreground">{patient.accessSite}</p>
                      </TableCell>
                      <TableCell>
                        {analysis ? (
                          <StatusBadge
                            tone={
                              attention?.level === "tinggi"
                                ? "danger"
                                : analysis.band === "baik"
                                  ? "good"
                                  : "warn"
                            }
                          >
                            {BAND_LABEL[analysis.band]}
                          </StatusBadge>
                        ) : (
                          <span className="text-muted-foreground">Belum ada sesi</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          <div className="grid gap-3 md:hidden">
            {rows.map((patient) => {
              const centre = centres.find((item) => item.id === patient.centreId)
              return (
                <Link
                  key={patient.id}
                  href={`/pesakit/${patient.id}`}
                  className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10"
                >
                  <p className="font-medium">{patient.fullName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {centre?.city} · {formatKg(patient.dryWeightKg)} · {ACCESS_LABEL[patient.accessType]}
                  </p>
                </Link>
              )
            })}
          </div>
        </>
      )}
      <PatientDialog open={open} onOpenChange={setOpen} />
    </div>
  )
}
