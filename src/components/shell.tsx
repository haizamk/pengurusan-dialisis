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
    return [
      { href: "/", label: "Papan", icon: LayoutDashboard },
      { href: "/permohonan", label: waiting > 0 ? `Permohonan (${waiting})` : "Permohonan", icon: ClipboardCheck },
    ]
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
    <nav className="flex flex-1 flex-col gap-1 px-3 py-5">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active(item.href) ? "page" : undefined}
            className={cn(
              "group flex min-h-12 items-center gap-3 rounded-xl border border-transparent px-3 py-3 text-sm font-medium transition-colors",
              active(item.href)
                ? "border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
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
  const [moreOpen, setMoreOpen] = useState(false)
  const showMore = items.length > 3 && profile?.role !== "super_admin"
  const primaryItems = showMore ? items.slice(0, 3) : items
  const extraItems = showMore ? items.slice(3) : []

  return (
    <nav
      aria-label="Navigasi utama"
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 grid gap-1 border-t border-border/80 bg-card/95 px-2 pt-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] shadow-[0_-12px_35px_rgba(0,0,0,0.18)] backdrop-blur-xl md:hidden",
        showMore ? "grid-cols-4" : "grid-cols-2",
      )}
    >
      {primaryItems.map((item) => {
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active(item.href) ? "page" : undefined}
            onClick={() => setMoreOpen(false)}
            className={cn(
              "flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-semibold transition-colors",
              active(item.href) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary/70",
            )}
          >
            <Icon className="size-5" />
            <span className="max-w-full truncate">{item.label === "Pesakit" && profile?.role === "pesakit" ? "Saya" : item.label}</span>
          </Link>
        )
      })}
      {showMore ? (
        <button
          type="button"
          aria-expanded={moreOpen}
          aria-label={moreOpen ? "Tutup menu tambahan" : "Buka menu tambahan"}
          onClick={() => setMoreOpen((open) => !open)}
          className={cn(
            "flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-semibold transition-colors",
            moreOpen ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary/70",
          )}
        >
          <span className="text-xl leading-none" aria-hidden="true">•••</span>
          Lagi
        </button>
      ) : null}
      {showMore && moreOpen ? (
        <div className="absolute inset-x-3 bottom-full mb-3 grid max-h-[60dvh] grid-cols-2 gap-2 overflow-y-auto rounded-2xl border border-border bg-card p-3 shadow-2xl shadow-black/30">
          {extraItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active(item.href) ? "page" : undefined}
                onClick={() => setMoreOpen(false)}
                className={cn(
                  "flex min-h-12 items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors",
                  active(item.href) ? "bg-primary/10 text-primary" : "text-foreground hover:bg-secondary/70",
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="min-w-0 truncate">{item.label}</span>
              </Link>
            )
          })}
        </div>
      ) : null}
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
    <div className={showApp ? "min-h-dvh bg-[radial-gradient(ellipse_at_top,rgba(25,113,125,0.10),transparent_42%),var(--background)]" : "hidden"} aria-hidden={showApp ? undefined : true}>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-sidebar-border/80 bg-sidebar text-sidebar-foreground shadow-xl shadow-black/10 md:flex">
        <div className="border-b border-sidebar-border/80 px-5 py-6">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-300 to-cyan-500 font-bold text-slate-950 shadow-lg shadow-teal-950/25">P</div>
            <div className="min-w-0"><p className="text-xs font-bold tracking-[0.2em] text-sidebar-primary uppercase">PPD · Portal</p><h1 className="mt-1 font-heading text-lg leading-tight">Pengurusan Dialisis</h1></div>
          </div>
          <p className="mt-4 text-xs leading-5 text-sidebar-foreground/65">
            {profile?.role === "super_admin" ? "Kawalan akses dan permohonan akaun." : profile?.role === "pesakit" ? "Rekod kesihatan peribadi anda." : "Pemantauan sesi, berat, dan rekod darah."}
          </p>
        </div>
        <Suspense fallback={<div className="flex-1" />}>
          <SideNav />
        </Suspense>
        <div className="space-y-3 border-t border-sidebar-border/80 px-4 py-4 text-xs leading-5 text-sidebar-foreground/70">
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

      <div className="min-w-0 md:pl-72">
        <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 backdrop-blur-xl">
          <div className="flex flex-col gap-3 px-4 py-3.5 sm:px-5 md:flex-row md:items-center md:justify-between md:px-8">
            <div className="md:hidden">
              <p className="font-heading text-lg font-semibold leading-tight tracking-tight">Pengurusan Pesakit Dialisis</p>
              <p className="mt-1 text-xs text-muted-foreground">{profile?.role === "super_admin" ? "Portal master admin" : profile?.role === "pesakit" ? "Portal pesakit" : "Ringkasan operasi"}</p>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
              {source === "local" ? (
                <>
                  <p className="hidden text-sm font-medium text-muted-foreground md:block">Tapis centre</p>
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
                </>
              ) : (
                <p className="hidden text-sm font-medium text-muted-foreground md:block">
                  {profile?.role === "super_admin" ? "Kawalan akses portal" : "Rekod kesihatan peribadi"}
                </p>
              )}
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
        <main id="main-content" className="mx-auto w-full max-w-[1680px] min-w-0 px-4 py-5 pb-28 sm:px-6 sm:py-7 md:px-8 md:pb-12 xl:px-10 2xl:px-12">{children}</main>
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
