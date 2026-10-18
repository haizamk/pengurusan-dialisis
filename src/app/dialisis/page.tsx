import type { Metadata } from "next"
import { Suspense } from "react"
import { LoadingBlock } from "@/components/page-header"
import { DialysisScreen } from "@/components/screens/dialysis-screen"

export const metadata: Metadata = {
  title: "Sesi dialisis",
}

export default function Page() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <DialysisScreen />
    </Suspense>
  )
}
