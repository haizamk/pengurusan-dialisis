"use client"

import { Apple, Info } from "lucide-react"
import { LabArchivePanel } from "@/components/lab-archive-panel"
import { PageHeader } from "@/components/page-header"
import { useStore } from "@/lib/store"

export default function Page() {
  const { profile } = useStore()
  if (profile?.role === "super_admin") {
    return <PageHeader eyebrow="Kawalan akses" title="Pemakanan pesakit" description="Analisis pemakanan berdasarkan rekod kesihatan tidak dipaparkan dalam portal Master Admin." />
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        eyebrow="Pemakanan"
        title="Panduan pemakanan"
        description="Pendidikan umum berdasarkan keputusan yang telah disahkan. Keperluan setiap pesakit berbeza dan perlu dibincangkan dengan pakar diet buah pinggang."
      />
      <section className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
        <Apple className="mt-0.5 size-5 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-semibold">Panduan untuk perbincangan</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">Gunakan cadangan sebagai bahan perbincangan bersama pasukan rawatan. Jangan ubah ubat, pengambilan cecair atau diet berdasarkan halaman ini sahaja.</p>
        </div>
      </section>
      <LabArchivePanel sections={["diet"]} />
      <aside className="flex items-start gap-2 rounded-2xl border border-border/70 bg-secondary/30 p-4 text-xs leading-5 text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" />
        Panduan di sini bukan pelan diet individu atau preskripsi perubatan.
      </aside>
    </div>
  )
}