import type { Metadata } from "next"
import { PatientsScreen } from "@/components/screens/patients-screen"

export const metadata: Metadata = {
  title: "Pesakit",
}

export default function Page() {
  return <PatientsScreen />
}
