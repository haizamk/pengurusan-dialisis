"use client"

import { toast } from "sonner"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { ACCESS_LABEL, formatKg } from "@/lib/format"
import { useStore } from "@/lib/store"

const STATUS_LABEL = {
  menunggu: "Menunggu",
  lulus: "Diluluskan",
  tolak: "Ditolak",
} as const

export function ApplicationsScreen() {
  const { profile, applications, centres, approve, reject, busy } = useStore()

  if (profile?.role !== "super_admin") {
    return (
      <PageHeader
        eyebrow="Permohonan"
        title="Hanya super admin"
        description="Pesakit tidak meluluskan akaun. Mereka mengurus rekod sendiri selepas diluluskan."
      />
    )
  }

  const waiting = applications.filter((item) => item.status === "menunggu")

  return (
    <div>
      <PageHeader
        eyebrow="Super admin"
        title="Permohonan pesakit"
        description={`${waiting.length} menunggu kelulusan. Selepas lulus, pesakit log masuk dan mengisi data sendiri.`}
      />
      {applications.length === 0 ? (
        <p className="text-sm leading-6 text-muted-foreground">Belum ada permohonan. Pesakit mendaftar dari skrin log masuk.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {applications.map((account) => {
            const centre = centres.find((item) => item.id === account.centreId)
            return (
              <article key={account.userId} className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="font-heading text-2xl">{account.fullName}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{account.email}</p>
                    <p className="mt-2 text-sm leading-6">
                      {centre ? `${centre.name}, ${centre.city}` : "Centre belum dipilih"}
                      {account.dryWeightKg ? ` · Berat kering ${formatKg(account.dryWeightKg)}` : ""}
                      {account.accessType ? ` · ${ACCESS_LABEL[account.accessType]}` : ""}
                    </p>
                    <p className="text-sm text-muted-foreground">{STATUS_LABEL[account.status]}</p>
                  </div>
                  {account.status !== "lulus" ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        className="h-11"
                        disabled={busy}
                        onClick={() => {
                          void approve(account)
                            .then(() => toast.success(`${account.fullName} diluluskan.`))
                            .catch((reason: unknown) =>
                              toast.error(reason instanceof Error ? reason.message : "Gagal meluluskan."),
                            )
                        }}
                      >
                        Lulus
                      </Button>
                      {account.status !== "tolak" ? (
                        <Button
                          variant="outline"
                          className="h-11"
                          disabled={busy}
                          onClick={() => {
                            void reject(account.userId)
                              .then(() => toast.success("Permohonan ditolak."))
                              .catch((reason: unknown) =>
                                toast.error(reason instanceof Error ? reason.message : "Gagal menolak."),
                              )
                          }}
                        >
                          Tolak
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
