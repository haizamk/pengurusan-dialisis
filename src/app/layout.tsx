import type { Metadata } from "next"
import { Figtree, Fraunces } from "next/font/google"
import { Toaster } from "@/components/ui/sonner"
import { Shell } from "@/components/shell"
import { StoreProvider } from "@/lib/store"
import "./globals.css"

const sans = Figtree({
  subsets: ["latin"],
  variable: "--font-sans",
})

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
})

export const metadata: Metadata = {
  title: {
    default: "Pengurusan Pesakit Dialisis",
    template: "%s · PPD",
  },
  description:
    "Pantau berat kering, sesi dialisis, UF seterusnya, dan rekod darah pesakit dari pelbagai centre.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ms" className={`${sans.variable} ${display.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground">
        <StoreProvider>
          <Shell>{children}</Shell>
          <Toaster />
        </StoreProvider>
      </body>
    </html>
  )
}
