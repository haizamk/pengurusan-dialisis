"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { LoadingBlock, PageHeader } from "@/components/page-header"
import { SessionEditor } from "@/components/session-editor"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDate, formatKg } from "@/lib/format"
import { analyseSession, sortSessions } from "@/lib/queries"
import { BAND_LABEL } from "@/lib/uf"
import { useStore } from "@/lib/store"

export function DialysisScreen() {
  const params = useSearchParams()
  const presetPatientId = params.get("pesakit") ?? undefined
  const presetSessionId = params.get("sesi") ?? undefined
  const { ready, patients, centres, sessions, centreFilter, removeSession } = useStore()
  const [editingId, setEditingId] = useState<string | undefined>(presetSessionId)

  const rows = useMemo(() => {
    const allowed = new Set(
      patients
        .filter((patient) => centreFilter === "all" || patient.centreId === centreFilter)
        .map((patient) => patient.id),
    )
    return sortSessions(sessions.filter((session) => allowed.has(session.patientId))).reverse()
  }, [patients, sessions, centreFilter])

  if (!ready) return <LoadingBlock />

  return (
    <div>
      <PageHeader
        eyebrow="Dialisis"
        title="Sesi, berat, dan UF"
        description="Berat semasa tiba dibandingkan dengan berat selepas sesi lepas, kemudian dengan berat kering untuk cadangan UF."
      />
      <SessionEditor
        key={`${presetPatientId ?? ""}-${editingId ?? presetSessionId ?? "baru"}`}
        presetPatientId={presetPatientId}
        presetSessionId={editingId ?? presetSessionId}
      />

      <section className="mt-8">
        <h2 className="font-heading text-2xl">Sejarah sesi</h2>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Tiada sesi dalam tapisan centre ini.</p>
        ) : (
          <Table className="mt-3">
            <TableHeader>
              <TableRow>
                <TableHead>Tarikh</TableHead>
                <TableHead>Pesakit</TableHead>
                <TableHead>Centre</TableHead>
                <TableHead>Tiba</TableHead>
                <TableHead>Selepas</TableHead>
                <TableHead>UF</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((session) => {
                const patient = patients.find((item) => item.id === session.patientId)
                const centre = centres.find((item) => item.id === session.centreId)
                const analysis = analyseSession(session, sessions)
                return (
                  <TableRow key={session.id}>
                    <TableCell>{formatDate(session.sessionDate)}</TableCell>
                    <TableCell>
                      <Link href={`/pesakit/${session.patientId}`} className="hover:underline">
                        {patient?.fullName}
                      </Link>
                    </TableCell>
                    <TableCell>{centre?.city}</TableCell>
                    <TableCell>{formatKg(session.arrivalWeightKg)}</TableCell>
                    <TableCell>{formatKg(session.postWeightKg)}</TableCell>
                    <TableCell>
                      <StatusBadge
                        tone={
                          analysis.band === "baik" ? "good" : analysis.band === "sederhana" ? "warn" : "danger"
                        }
                      >
                        {BAND_LABEL[analysis.band]}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="space-x-1 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setEditingId(session.id)}>
                        Ubah
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          removeSession(session.id)
                            .then(() => toast.success("Sesi dipadam."))
                            .catch((error: unknown) =>
                              toast.error(error instanceof Error ? error.message : "Gagal memadam."),
                            )
                        }}
                      >
                        Padam
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  )
}
