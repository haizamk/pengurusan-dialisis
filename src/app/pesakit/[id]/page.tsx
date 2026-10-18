import type { Metadata } from "next"
import { Suspense } from "react"
import { LoadingBlock } from "@/components/page-header"
import { PatientDetailScreen } from "@/components/screens/patient-detail-screen"

export const metadata: Metadata = {
  title: "Rekod pesakit",
}

export default function Page() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <PatientDetailScreen />
    </Suspense>
  )
}
