"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Suspense, useState } from "react"
import {
  Activity,
  Droplets,
  LayoutDashboard,
  Leaf,
  Users,
} from "lucide-react"
import { toast } from "sonner"
import { AccountGate, LoginScreen } from "@/components/auth-screens"
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

function useActive() {
  const pathname = usePathname()
  return (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href))
}

function SideNav() {
  const active = useActive()
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
      {NAV.map((item) => {
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active(item.href) ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm",
              active(item.href)
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/70",
            )}
          >
            <Icon className="size-4" />
            {item.label === "Papan"
              ? "Papan pemuka"
              : item.label === "Darah"
                ? "Rekod darah"
                : item.label === "Tip"
                  ? "Makanan & tapak"
                  : item.label === "Dialisis"
                    ? "Sesi dialisis"
                    : "Pesakit"}
          </Link>
        )
      })}
    </nav>
  )
}

function MobileNav() {
  const active = useActive()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-card/95 backdrop-blur md:hidden">
      {NAV.map((item) => {
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active(item.href) ? "page" : undefined}
            className={cn(
              "flex flex-col items-center gap-1 px-1 py-2 text-[0.68rem]",
              active(item.href) ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className="size-4" />
            {item.label}
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
    patients,
    centreFilter,
    setCentreFilter,
    resetLocalDemo,
    seedRemoteDemo,
    busy,
    accountEmail,
    profile,
    signOut,
  } = useStore()
  const [centreOpen, setCentreOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const canManageCentres = source === "local" || profile?.role === "pentadbir"

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
        Memuatkan rekod…
      </div>
    )
  }

  if (source === "supabase" && !accountEmail) return <LoginScreen />
  if (source === "supabase" && !profile) return <AccountGate />

  return (
    <div className="min-h-dvh bg-background">
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
              <span className="block">{profile.role === "pentadbir" ? "Pentadbir" : "Staf"} · {accountEmail}</span>
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
              {canManageCentres ? (
                <Button variant="outline" className="h-11" onClick={() => setCentreOpen(true)}>
                  Centre baharu
                </Button>
              ) : null}
              {source === "local" ? (
                <Button variant="outline" className="h-11" onClick={() => setResetOpen(true)}>
                  Set semula contoh
                </Button>
              ) : null}
              {source === "supabase" && profile?.role === "pentadbir" && patients.length === 0 ? (
                <Button
                  className="h-11"
                  disabled={busy}
                  onClick={() => {
                    seedRemoteDemo()
                      .then(() => toast.success("Data contoh dimasukkan ke Supabase."))
                      .catch((reason: unknown) =>
                        toast.error(reason instanceof Error ? reason.message : "Gagal mengisi Supabase."),
                      )
                  }}
                >
                  Isi data contoh
                </Button>
              ) : null}
            </div>
          </div>
          {error ? (
            <p className="border-t border-destructive/20 bg-destructive/10 px-4 py-2 text-sm text-destructive md:px-8">
              {source === "supabase"
                ? `Supabase tidak dapat dibaca (${error}).`
                : `Supabase tidak dapat dibaca (${error}). Aplikasi menggunakan data tempatan.`}
            </p>
          ) : null}
        </header>
        <main className="px-4 py-6 pb-28 md:px-8 md:pb-12">{children}</main>
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
  )
}
