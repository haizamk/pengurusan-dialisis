"use client"

import { LabArchivePanel } from "@/components/lab-archive-panel"
import { PageHeader } from "@/components/page-header"

export default function Page() {
  return (
    <div>
      <PageHeader
        eyebrow="Pemakanan"
        title="Cadangan pemakanan"
        description="Pendidikan am berdasarkan keputusan yang sudah disahkan. Bawa soalan ini kepada pakar diet buah pinggang anda."
      />
      <LabArchivePanel sections={["diet"]} />
    </div>
  )
}
