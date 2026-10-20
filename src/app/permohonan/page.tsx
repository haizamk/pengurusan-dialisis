import type { Metadata } from "next"
import { Suspense } from "react"
import { LoadingBlock } from "@/components/page-header"
import { ApplicationsScreen } from "@/components/screens/applications-screen"

export const metadata: Metadata = {
  title: "Permohonan",
}

export default function Page() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <ApplicationsScreen />
    </Suspense>
  )
}
