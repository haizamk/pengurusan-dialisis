"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Check, Clock3, Search, ShieldCheck, UserRound, Users, X } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ACCESS_LABEL, formatKg } from "@/lib/format"
import { useStore } from "@/lib/store"

const STATUS_LABEL = {
  menunggu: "Menunggu semakan",
  lulus: "Diluluskan",
  tolak: "Ditolak",
} as const

type Filter = "semua" | "menunggu" | "lulus" | "tolak"

export function ApplicationsScreen() {
  const { profile, applications, centres, approve, reject, busy } = useStore()
  const [filter, setFilter] = useState<Filter>("menunggu")
  const [query, setQuery] = useState("")

  const counts = {
    menunggu: applications.filter((item) => item.status === "menunggu").length,
    lulus: applications.filter((item) => item.status === "lulus").length,
    tolak: applications.filter((item) => item.status === "tolak").length,
  }
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ms")
    return applications
      .filter((item) => filter === "semua" || item.status === filter)
      .filter((item) => !needle || item.fullName.toLocaleLowerCase("ms").includes(needle) || item.email.toLocaleLowerCase("ms").includes(needle))
      .sort((a, b) => (a.status === "menunggu" ? -1 : 0) - (b.status === "menunggu" ? -1 : 0))
  }, [applications, filter, query])

  if (profile?.role !== "super_admin") {
    return (
      <PageHeader
        eyebrow="Kawasan pentadbir"
        title="Akses terhad"
        description="Halaman ini hanya boleh digunakan oleh super admin. Pesakit tidak boleh meluluskan akaun."
      />
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-[#123b4a] via-[#124957] to-[#126b70] p-5 shadow-lg shadow-black/10 sm:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full border-[32px] border-white/[0.04]" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.2em] text-teal-200 uppercase">
              <ShieldCheck className="size-4" /> Portal master admin
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Pengurusan akaun</h1>
            <p className="mt-3 text-sm leading-6 text-teal-50/80 sm:text-base">
              Semak permohonan, sahkan kelayakan akses dan urus status akaun pesakit. Rekod kesihatan tidak dipaparkan dalam halaman kelulusan ini.
            </p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/[0.08] px-5 py-4 text-white backdrop-blur">
            <p className="text-xs font-medium text-teal-100">Menunggu tindakan</p>
            <p className="mt-1 text-4xl font-semibold tabular-nums">{counts.menunggu}</p>
            <p className="mt-1 text-xs text-white/65">permohonan baharu</p>
          </div>
        </div>
      </section>

      <PageHeader
        eyebrow="Kawalan akses"
        title="Permohonan pesakit"
        description="Semak butiran pendaftaran sebelum meluluskan akses portal."
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <Summary icon={Clock3} label="Menunggu" value={counts.menunggu} tone="amber" />
        <Summary icon={Check} label="Diluluskan" value={counts.lulus} tone="teal" />
        <Summary icon={X} label="Ditolak" value={counts.tolak} tone="slate" />
      </section>

      <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Senarai permohonan</h2>
            <p className="mt-1 text-sm text-muted-foreground">{visible.length} rekod mengikut tapisan</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-11 pl-9" placeholder="Cari nama atau emel" value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
            <div className="flex flex-wrap gap-2">
              {([
                ["menunggu", "Menunggu"],
                ["semua", "Semua"],
                ["lulus", "Diluluskan"],
                ["tolak", "Ditolak"],
              ] as const).map(([value, label]) => (
                <Button key={value} type="button" size="sm" variant={filter === value ? "default" : "outline"} className="h-10 rounded-xl" onClick={() => setFilter(value)}>
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {applications.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 px-5 py-12 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Users className="size-7" /></span>
          <h2 className="mt-4 text-lg font-semibold">Belum ada permohonan</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Permohonan akaun pesakit akan dipaparkan di sini selepas pesakit mendaftar dari halaman log masuk.</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 px-5 py-10 text-center">
          <p className="font-semibold">Tiada padanan ditemui</p>
          <p className="mt-1 text-sm text-muted-foreground">Cuba carian atau tapisan yang lain.</p>
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {visible.map((account) => {
            const centre = centres.find((item) => item.id === account.centreId)
            const pending = account.status === "menunggu"
            const approved = account.status === "lulus"
            return (
              <article key={account.userId} className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm transition hover:border-primary/35 sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><UserRound className="size-5" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="break-words text-lg font-semibold tracking-tight">{account.fullName}</h3>
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${pending ? "border-amber-400/30 bg-amber-400/10 text-amber-200" : approved ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-border bg-secondary text-muted-foreground"}`}>
                        {STATUS_LABEL[account.status]}
                      </span>
                    </div>
                    <p className="mt-1 break-all text-sm text-muted-foreground">{account.email}</p>
                    <p className="mt-3 text-sm leading-6">
                      {centre ? `${centre.name}, ${centre.city}` : "Centre belum dipilih"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {account.dryWeightKg ? <span className="rounded-lg bg-secondary px-2.5 py-1.5 text-xs text-secondary-foreground">Berat kering {formatKg(account.dryWeightKg)}</span> : null}
                      {account.accessType ? <span className="rounded-lg bg-secondary px-2.5 py-1.5 text-xs text-secondary-foreground">{ACCESS_LABEL[account.accessType]}</span> : null}
                    </div>
                  </div>
                </div>
                {pending ? (
                  <div className="mt-5 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
                    <Button className="h-11 rounded-xl" disabled={busy} onClick={() => {
                      void approve(account)
                        .then(() => toast.success(`${account.fullName} diluluskan.`))
                        .catch((reason: unknown) => toast.error(reason instanceof Error ? reason.message : "Gagal meluluskan."))
                    }}>
                      <Check className="mr-2 size-4" /> Luluskan akaun
                    </Button>
                    <Button variant="outline" className="h-11 rounded-xl" disabled={busy} onClick={() => {
                      void reject(account.userId)
                        .then(() => toast.success("Permohonan ditolak."))
                        .catch((reason: unknown) => toast.error(reason instanceof Error ? reason.message : "Gagal menolak."))
                    }}>
                      <X className="mr-2 size-4" /> Tolak
                    </Button>
                  </div>
                ) : (
                  <div className="mt-5 border-t border-border pt-4 text-sm text-muted-foreground">
                    {approved ? "Akses portal telah diluluskan." : "Permohonan ini ditolak."}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Summary({ icon: Icon, label, value, tone }: { icon: typeof Clock3; label: string; value: number; tone: "amber" | "teal" | "slate" }) {
  const toneClass = tone === "amber" ? "bg-amber-400/10 text-amber-200" : tone === "teal" ? "bg-emerald-400/10 text-emerald-200" : "bg-secondary text-muted-foreground"
  return (
    <article className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className={`flex size-10 items-center justify-center rounded-xl ${toneClass}`}><Icon className="size-5" /></span>
      </div>
      <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
    </article>
  )
}