"use client"

import { ChartNoAxesCombined, Info } from "lucide-react"
import { LabArchivePanel } from "@/components/lab-archive-panel"
import { PageHeader } from "@/components/page-header"
import { useStore } from "@/lib/store"

export default function Page() {
  const { profile } = useStore()
  if (profile?.role === "super_admin") {
    return <PageHeader eyebrow="Kawalan akses" title="Graf klinikal" description="Graf kesihatan pesakit tidak dipaparkan dalam portal Master Admin." />
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        eyebrow="Pemantauan"
        title="Graf kesihatan"
        description="Setiap graf menggunakan bacaan sebenar dengan unit yang sama. Jika rekod belum ada, carta dibiarkan kosong."
      />
      <section className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
        <ChartNoAxesCombined className="mt-0.5 size-5 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-semibold">Lihat perubahan dari semasa ke semasa</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">Pilih parameter dan julat tarikh untuk meneliti rekod. Graf bukan diagnosis dan tidak menggantikan penilaian pasukan dialisis.</p>
        </div>
      </section>
      <LabArchivePanel sections={["charts"]} />
      <aside className="flex items-start gap-2 rounded-2xl border border-border/70 bg-secondary/30 p-4 text-xs leading-5 text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" />
        Graf hanya melukis nilai yang disimpan; data yang tiada tidak dianggarkan.
      </aside>
    </div>
  )
}