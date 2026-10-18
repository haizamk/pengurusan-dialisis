import type { Metadata } from "next"
import { Suspense } from "react"
import { LoadingBlock } from "@/components/page-header"
import { BloodScreen } from "@/components/screens/blood-screen"

export const metadata: Metadata = {
  title: "Rekod darah",
}

export default function Page() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <BloodScreen />
    </Suspense>
  )
}
