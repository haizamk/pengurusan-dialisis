"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Suspense, useState } from "react"
import {
  Activity,
  ChartColumn,
  ClipboardCheck,
  Droplets,
  LayoutDashboard,
  Leaf,
  NotebookPen,
  Sparkles,
  Users,
  Utensils,
} from "lucide-react"
import { toast } from "sonner"
import { AccountGate, LoginScreen, PendingScreen, RejectedScreen } from "@/components/auth-screens"
import { ChoiceSelect } from "@/components/choice-select"
import { CentreDialog } from "@/components/patient-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useStore } from "@/lib/store"

const NAV = [
  { href: "/", label: "Papan", icon: LayoutDashboard },
  { href: "/pesakit", label: "Pesakit", icon: Users },
  { href: "/dialisis", label: "Dialisis", icon: Activity },
  { href: "/darah", label: "Darah", icon: Droplets },
  { href: "/tip", label: "Tip", icon: Leaf },
]

const PATIENT_NAV = [
  { href: "/", label: "Papan", icon: LayoutDashboard },
  { href: "/dialisis", label: "Dialisis", icon: Activity },
  { href: "/darah", label: "Darah", icon: Droplets },
  { href: "/graf", label: "Graf", icon: ChartColumn },
  { href: "/analisis", label: "Analisis", icon: Sparkles },
  { href: "/pemakanan", label: "Diet", icon: Utensils },
  { href: "/catatan", label: "Catatan", icon: NotebookPen },
  { href: "/profil", label: "Profil", icon: Users },
  { href: "/tip", label: "Tip", icon: Leaf },
]

function useNavItems() {
  const { profile, applications } = useStore()
  const waiting = applications.filter((item) => item.status === "menunggu").length
  if (profile?.role === "super_admin") {
    return [{ href: "/permohonan", label: waiting > 0 ? `Permohonan (${waiting})` : "Permohonan", icon: ClipboardCheck }]
  }
  if (profile?.role === "pesakit") return PATIENT_NAV
  return NAV
}

function useActive() {
  const pathname = usePathname()
  return (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href))
}

function navLabel(label: string, role?: string) {
  if (label === "Papan") return "Papan pemuka"
  if (label === "Darah") return "Rekod darah"
  if (label === "Tip") return "Makanan & tapak"
  if (label === "Dialisis") return "Sesi dialisis"
  if (label === "Graf") return "Graf kesihatan"
  if (label === "Diet") return "Cadangan pemakanan"
  if (label === "Profil") return "Profil saya"
  if (label === "Pesakit" && role === "pesakit") return "Rekod saya"
  return label
}

function SideNav() {
  const active = useActive()
  const { profile } = useStore()
  const items = useNavItems()
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active(item.href) ? "page" : undefined}
            className={cn(
              "flex min-h-12 items-center gap-3 rounded-xl px-3 py-3 text-sm",
              active(item.href)
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/70",
            )}
          >
            <Icon className="size-4" />
            {navLabel(item.label, profile?.role)}
          </Link>
        )
      })}
    </nav>
  )
}

function MobileNav() {
  const active = useActive()
  const { profile } = useStore()
  const items = useNavItems()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-card/95 backdrop-blur md:hidden">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active(item.href) ? "page" : undefined}
            className={cn(
              "flex min-h-12 flex-col items-center justify-center gap-1 px-1 py-2 text-[0.68rem]",
              active(item.href) ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className="size-4" />
            {item.label === "Pesakit" && profile?.role === "pesakit" ? "Saya" : item.label}
          </Link>
        )
      })}
    </nav>
  )
}

export function Shell({ children }: { children: React.ReactNode }) {
  const {
    ready,
    source,
    error,
    centres,
    centreFilter,
    setCentreFilter,
    resetLocalDemo,
    busy,
    accountEmail,
    profile,
    applications,
    signOut,
  } = useStore()
  const [centreOpen, setCentreOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const canManageCentres = source === "local"
  const needsLogin = source === "supabase" && ready && !accountEmail
  const needsLink = source === "supabase" && ready && Boolean(accountEmail) && !profile
  const pending = profile?.role === "pesakit" && profile.status === "menunggu"
  const rejected = profile?.role === "pesakit" && profile.status === "tolak"
  const showApp = ready && !needsLogin && !needsLink && !pending && !rejected
  const waiting = applications.filter((item) => item.status === "menunggu").length

  return (
    <>
      {!ready ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background text-sm text-muted-foreground">
          Memuatkan rekod…
        </div>
      ) : null}
      {needsLogin ? (
        <div className="fixed inset-0 z-50 overflow-auto bg-background">
          <LoginScreen />
        </div>
      ) : null}
      {needsLink ? (
        <div className="fixed inset-0 z-50 overflow-auto bg-background">
          <AccountGate />
        </div>
      ) : null}
      {pending ? (
        <div className="fixed inset-0 z-50 overflow-auto bg-background">
          <PendingScreen />
        </div>
      ) : null}
      {rejected ? (
        <div className="fixed inset-0 z-50 overflow-auto bg-background">
          <RejectedScreen />
        </div>
      ) : null}
    <div className={showApp ? "min-h-dvh bg-background" : "hidden"} aria-hidden={showApp ? undefined : true}>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="border-b border-sidebar-border px-5 py-6">
          <p className="font-heading text-[1.65rem] leading-none text-sidebar-primary">PPD</p>
          <h1 className="mt-3 font-heading text-xl leading-tight">Pengurusan Pesakit Dialisis</h1>
          <p className="mt-2 text-xs leading-5 text-sidebar-foreground/70">
            Berat kering, rekod darah, dan UF untuk pelbagai centre.
          </p>
        </div>
        <Suspense fallback={<div className="flex-1" />}>
          <SideNav />
        </Suspense>
        <div className="space-y-3 border-t border-sidebar-border px-4 py-4 text-xs leading-5 text-sidebar-foreground/70">
          <p>{source === "supabase" ? "Disambung ke Supabase." : "Data contoh disimpan pada pelayar ini."}</p>
          {profile ? (
            <p>
              {profile.fullName}
              <span className="block">{profile.role === "super_admin" ? "Super admin" : "Pesakit"} · {accountEmail}</span>
            </p>
          ) : null}
          {source === "supabase" ? (
            <Button
              variant="outline"
              className="h-9 w-full border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              disabled={busy}
              onClick={() => void signOut()}
            >
              Keluar
            </Button>
          ) : (
            <p>Next.js · Supabase · Netlify</p>
          )}
        </div>
      </aside>

      <div className="md:pl-64">
        <header className="sticky top-0 z-20 border-b border-border/80 bg-background/90 backdrop-blur">
          <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-8">
            <div className="md:hidden">
              <p className="font-heading text-xl leading-none">Pengurusan Pesakit Dialisis</p>
            </div>
            <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
              <p className="hidden text-sm text-muted-foreground md:block">Tapis centre</p>
              <div className="w-full sm:max-w-sm">
                <ChoiceSelect
                  value={centreFilter}
                  onChange={setCentreFilter}
                  placeholder="Semua centre"
                  options={[
                    { value: "all", label: "Semua centre" },
                    ...centres.map((centre) => ({
                      value: centre.id,
                      label: `${centre.name}, ${centre.city}`,
                    })),
                  ]}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {source === "supabase" ? (
                <Button variant="outline" className="h-11 md:hidden" disabled={busy} onClick={() => void signOut()}>
                  Keluar
                </Button>
              ) : null}
              {profile?.role === "super_admin" ? (
                <Link href="/permohonan" className="inline-flex h-11 items-center rounded-lg border border-border px-3 text-sm md:hidden">
                  Permohonan{waiting > 0 ? ` (${waiting})` : ""}
                </Link>
              ) : null}
              {canManageCentres ? (
                <Button variant="outline" className="h-11" onClick={() => setCentreOpen(true)}>
                  Centre baharu
                </Button>
              ) : null}
              {source === "local" ? (
                <Button variant="outline" className="h-12" onClick={() => setResetOpen(true)}>
                  Set semula contoh
                </Button>
              ) : null}
            </div>
          </div>
          {source === "local" ? (
            <p className="border-t border-border px-4 py-2 text-sm leading-6 text-muted-foreground md:px-8">
              Mod pengembangan: data contoh pada pelayar ini, bukan rekod pesakit sebenar.
            </p>
          ) : null}
          {error ? (
            <p className="border-t border-destructive/20 bg-destructive/10 px-4 py-2 text-sm text-destructive md:px-8">
              {source === "supabase"
                ? `Supabase tidak dapat dibaca (${error}).`
                : `Supabase tidak dapat dibaca (${error}). Aplikasi menggunakan data tempatan.`}
            </p>
          ) : null}
        </header>
        <main className="px-4 py-6 pb-44 md:px-8 md:pb-12">{children}</main>
      </div>

      <Suspense fallback={null}>
        <MobileNav />
      </Suspense>

      <CentreDialog open={centreOpen} onOpenChange={setCentreOpen} />
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set semula data contoh?</DialogTitle>
            <DialogDescription>
              Rekod yang ditambah pada pelayar ini akan diganti dengan sepuluh pesakit rekaan dari lima centre.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                resetLocalDemo()
                setResetOpen(false)
                toast.success("Data contoh dipulihkan.")
              }}
            >
              Set semula
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </>
  )
}
