import type { Metadata } from "next"
import { TipsScreen } from "@/components/screens/tips-screen"

export const metadata: Metadata = {
  title: "Tip makanan dan tapak",
}

export default function Page() {
  return <TipsScreen />
}
