import type { Metadata } from "next"
import { DashboardScreen } from "@/components/screens/dashboard-screen"

export const metadata: Metadata = {
  title: "Papan pemuka",
}

export default function Page() {
  return <DashboardScreen />
}
