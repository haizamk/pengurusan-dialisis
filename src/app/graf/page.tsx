"use client"

import { LabArchivePanel } from "@/components/lab-archive-panel"
import { PageHeader } from "@/components/page-header"

export default function Page() {
  return (
    <div>
      <PageHeader
        eyebrow="Graf"
        title="Graf kesihatan"
        description="Satu carta untuk setiap parameter yang mempunyai bacaan sebenar dan unit yang sama. Tiada titik sampel."
      />
      <LabArchivePanel sections={["charts"]} />
    </div>
  )
}
