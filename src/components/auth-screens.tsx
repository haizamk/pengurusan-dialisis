"use client"

import { useState, type ReactNode } from "react"
import { ChoiceSelect } from "@/components/choice-select"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { listCentres } from "@/lib/db"
import { generatePassword } from "@/lib/supabase"
import { useStore } from "@/lib/store"
import type { AccessType, Centre, Sex } from "@/lib/types"

type Mode = "masuk" | "pesakit" | "admin"

export function LoginScreen() {
  const { signIn, busy, error, hasSuperAdmin, setupError } = useStore()
  const [mode, setMode] = useState<Mode>("masuk")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [centres, setCentres] = useState<Centre[]>([])
  const [centreError, setCentreError] = useState<string | null>(null)

  return (
    <main className="relative isolate min-h-dvh overflow-hidden bg-[#f4f7fa] text-slate-900">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-cyan-200/40 blur-3xl" />
        <div className="absolute -bottom-48 -right-32 h-[30rem] w-[30rem] rounded-full bg-teal-200/40 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.22] [background-image:radial-gradient(#94a3b8_0.7px,transparent_0.7px)] [background-size:22px_22px]" />
      </div>

      <div className="relative mx-auto grid min-h-dvh w-full max-w-7xl items-center gap-8 px-4 py-6 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-12 lg:py-10">
        <section className="hidden flex-col justify-between self-stretch rounded-[2rem] bg-gradient-to-br from-[#082f49] via-[#0f4c5c] to-[#087e8b] p-10 text-white shadow-2xl shadow-cyan-950/15 lg:flex xl:p-14">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10 shadow-inner">
                <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" aria-hidden="true">
                  <path d="M12 2.8 20 6v5.2c0 5-3.4 8.2-8 10-4.6-1.8-8-5-8-10V6l8-3.2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                  <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold tracking-[0.18em] text-cyan-100">PORTAL PESAKIT</p>
                <p className="text-xs text-white/65">Pengurusan Dialisis</p>
              </div>
            </div>

            <div className="mt-20 max-w-xl">
              <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-cyan-50">
                <span className="h-2 w-2 rounded-full bg-emerald-300" />
                Rekod kesihatan, lebih teratur
              </p>
              <h1 className="text-4xl font-semibold leading-[1.12] tracking-tight xl:text-5xl">
                Kesihatan anda.
                <br />
                Dalam kawalan anda.
              </h1>
              <p className="mt-6 max-w-md text-base leading-7 text-cyan-50/80">
                Simpan dan pantau rekod dialisis, berat badan serta keputusan darah anda di satu tempat yang mudah diakses.
              </p>
            </div>

            <div className="mt-12 grid max-w-lg grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/15 bg-white/[0.08] p-4 backdrop-blur">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
                  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true"><path d="M4 19V5m0 14h16M7 15l4-4 3 2 5-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <p className="text-sm font-semibold">Pantau kemajuan</p>
                <p className="mt-1 text-xs leading-5 text-white/65">Lihat perubahan rekod dari semasa ke semasa.</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/[0.08] p-4 backdrop-blur">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
                  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.7" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
                </div>
                <p className="text-sm font-semibold">Akses peribadi</p>
                <p className="mt-1 text-xs leading-5 text-white/65">Masuk menggunakan akaun anda sendiri.</p>
              </div>
            </div>
          </div>

          <div className="mt-14 flex items-center justify-between gap-4 border-t border-white/15 pt-5 text-xs text-white/60">
            <span>Maklumat kesihatan anda, dijaga dengan teliti.</span>
            <span className="whitespace-nowrap">© {new Date().getFullYear()} Portal Dialisis</span>
          </div>
        </section>

        <section className="mx-auto w-full max-w-md">
          <div className="mb-7 flex items-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0f4c5c] to-[#087e8b] text-white shadow-lg shadow-teal-900/15">
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true"><path d="M12 2.8 20 6v5.2c0 5-3.4 8.2-8 10-4.6-1.8-8-5-8-10V6l8-3.2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            </div>
            <div>
              <p className="text-xs font-semibold tracking-[0.16em] text-teal-800">PORTAL PESAKIT</p>
              <p className="text-sm text-slate-500">Pengurusan Dialisis</p>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/80 bg-white/90 p-6 shadow-xl shadow-slate-900/[0.07] backdrop-blur-xl sm:p-9">
            <div className="mb-7">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-800 ring-1 ring-teal-100">
                <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true"><path d="M12 3v18M3 12h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" /></svg>
              </div>
              <p className="text-sm font-medium text-teal-800">Selamat kembali</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                {mode === "masuk" ? "Log masuk akaun" : mode === "pesakit" ? "Daftar sebagai pesakit" : "Daftar super admin"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {mode === "masuk"
                  ? "Masukkan maklumat akaun anda untuk meneruskan."
                  : mode === "pesakit"
                    ? "Hantar permohonan akaun pesakit untuk kelulusan."
                    : "Cipta akaun pentadbir utama jika belum wujud."}
              </p>
            </div>

            {setupError ? <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm leading-6 text-rose-800">{setupError}</p> : null}

            {mode === "masuk" ? (
              <form
                className="flex flex-col gap-5"
                onSubmit={(event) => {
                  event.preventDefault()
                  void signIn(email, password).catch(() => undefined)
                }}
              >
                <Field label="Alamat emel" id="emel">
                  <Input id="emel" type="email" autoComplete="username" required placeholder="nama@contoh.com" className="h-12 rounded-xl border-slate-200 bg-slate-50/70 px-4 text-base shadow-none transition focus-visible:bg-white" value={email} onChange={(event) => setEmail(event.target.value)} />
                </Field>
                <PasswordField id="kata-laluan" value={password} onChange={setPassword} autoComplete="current-password" />
                {error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}
                <Button type="submit" className="h-12 rounded-xl bg-[#0f6674] text-base font-semibold !text-white shadow-md shadow-teal-900/15 transition hover:bg-[#0b5360] hover:!text-white focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2" disabled={busy}>
                  {busy ? "Sedang masuk…" : "Log masuk ke portal"}
                  {!busy ? <svg viewBox="0 0 24 24" fill="none" className="ml-2 h-4 w-4" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
                </Button>
              </form>
            ) : null}

            {mode === "pesakit" ? (
              <PatientRegister centres={centres} centreError={centreError} onCancel={() => setMode("masuk")} />
            ) : null}
            {mode === "admin" ? <AdminRegister onCancel={() => setMode("masuk")} /> : null}

            {mode === "masuk" ? (
              <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-5">
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 rounded-xl border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    setMode("pesakit")
                    void listCentres()
                      .then(setCentres)
                      .catch((reason: unknown) => {
                        setCentreError(reason instanceof Error ? reason.message : "Gagal memuatkan centre.")
                      })
                  }}
                >
                  Daftar permohonan pesakit
                </Button>
                {hasSuperAdmin !== true ? (
                  <Button type="button" variant="ghost" className="h-10 rounded-xl text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-800" onClick={() => setMode("admin")}>
                    Daftar super admin
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="mt-5 flex items-start justify-center gap-2 px-2 text-center text-xs leading-5 text-slate-500">
            <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.6" /><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            <span>Jangan kongsi kata laluan anda. Gunakan akaun sendiri untuk menjaga privasi rekod kesihatan.</span>
          </div>
          <p className="mt-4 text-center text-xs text-slate-400 lg:hidden">© {new Date().getFullYear()} Portal Pengurusan Dialisis</p>
        </section>
      </div>
    </main>
  )
}

function PatientRegister({
  centres,
  centreError,
  onCancel,
}: {
  centres: Centre[]
  centreError: string | null
  onCancel: () => void
}) {
  const { signUpPatient, busy, error } = useStore()
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [phone, setPhone] = useState("")
  const [sex, setSex] = useState<Sex | "">("")
  const [dateOfBirth, setDateOfBirth] = useState("")
  const [centreId, setCentreId] = useState("")
  const [dryWeight, setDryWeight] = useState("")
  const [accessType, setAccessType] = useState<AccessType>("fistula")
  const [accessSite, setAccessSite] = useState("")
  const [schedule, setSchedule] = useState("")
  const [diagnosis, setDiagnosis] = useState("")

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        const dryWeightKg = Number(dryWeight)
        if (!sex || !centreId || !Number.isFinite(dryWeightKg) || dryWeightKg <= 0) return
        void signUpPatient({
          fullName,
          email,
          password,
          phone,
          sex,
          dateOfBirth,
          centreId,
          dryWeightKg,
          accessType,
          accessSite,
          schedule,
          diagnosis,
        }).catch(() => undefined)
      }}
    >
      <p className="text-sm leading-6 text-muted-foreground">
        Kata laluan ini milik anda. Selepas super admin meluluskan, anda log masuk dan mengisi sesi serta rekod darah sendiri.
      </p>
      <Field label="Nama penuh" id="nama">
        <Input id="nama" required className="h-11" value={fullName} onChange={(event) => setFullName(event.target.value)} />
      </Field>
      <Field label="Emel" id="emel-daftar">
        <Input id="emel-daftar" type="email" required className="h-11" value={email} onChange={(event) => setEmail(event.target.value)} />
      </Field>
      <PasswordField id="kata-laluan-daftar" value={password} onChange={setPassword} autoComplete="new-password" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Telefon" id="telefon">
          <Input id="telefon" className="h-11" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </Field>
        <Field label="Tarikh lahir" id="lahir">
          <Input id="lahir" type="date" required className="h-11" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} />
        </Field>
      </div>
      <Field label="Jantina" id="jantina">
        <ChoiceSelect
          id="jantina"
          value={sex}
          onChange={(value) => setSex(value as Sex)}
          placeholder="Pilih jantina"
          options={[
            { value: "lelaki", label: "Lelaki" },
            { value: "perempuan", label: "Perempuan" },
          ]}
        />
      </Field>
      <Field label="Centre dialisis" id="centre">
        <ChoiceSelect
          id="centre"
          value={centreId}
          onChange={setCentreId}
          placeholder="Pilih centre"
          options={centres.map((centre) => ({ value: centre.id, label: `${centre.name}, ${centre.city}` }))}
        />
      </Field>
      {centreError ? <p className="text-sm text-destructive">{centreError}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Berat kering (kg)" id="kering">
          <Input id="kering" type="number" inputMode="decimal" min={1} step="0.1" required className="h-11" value={dryWeight} onChange={(event) => setDryWeight(event.target.value)} />
        </Field>
        <Field label="Tapak" id="tapak-jenis">
          <ChoiceSelect
            id="tapak-jenis"
            value={accessType}
            onChange={(value) => setAccessType(value as AccessType)}
            placeholder="Jenis tapak"
            options={[
              { value: "fistula", label: "Fistula" },
              { value: "graft", label: "Graft" },
              { value: "kateter", label: "Kateter" },
            ]}
          />
        </Field>
      </div>
      <Field label="Lokasi tapak" id="lokasi">
        <Input id="lokasi" className="h-11" placeholder="Contoh: lengan kiri" value={accessSite} onChange={(event) => setAccessSite(event.target.value)} />
      </Field>
      <Field label="Jadual dialisis" id="jadual">
        <Input id="jadual" className="h-11" placeholder="Contoh: Isnin, Rabu, Jumaat" value={schedule} onChange={(event) => setSchedule(event.target.value)} />
      </Field>
      <Field label="Diagnosis" id="diagnosis">
        <Input id="diagnosis" className="h-11" value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} />
      </Field>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="h-11" disabled={busy || !sex || !centreId}>
          {busy ? "Sedang mendaftar…" : "Hantar permohonan"}
        </Button>
        <Button type="button" variant="outline" className="h-11" onClick={onCancel}>
          Kembali
        </Button>
      </div>
    </form>
  )
}

function AdminRegister({ onCancel }: { onCancel: () => void }) {
  const { signUpSuperAdmin, busy, error } = useStore()
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        void signUpSuperAdmin(fullName, email, password).catch(() => undefined)
      }}
    >
      <p className="text-sm leading-6 text-muted-foreground">
        Akaun ini hanya dicipta sekali. Super admin meluluskan permohonan. Pesakit mengurus rekod sendiri selepas lulus.
      </p>
      <Field label="Nama" id="nama-admin">
        <Input id="nama-admin" required className="h-11" value={fullName} onChange={(event) => setFullName(event.target.value)} />
      </Field>
      <Field label="Emel" id="emel-admin">
        <Input id="emel-admin" type="email" required className="h-11" value={email} onChange={(event) => setEmail(event.target.value)} />
      </Field>
      <PasswordField id="kata-laluan-admin" value={password} onChange={setPassword} autoComplete="new-password" />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="h-11" disabled={busy}>
          {busy ? "Sedang mencipta…" : "Cipta super admin"}
        </Button>
        <Button type="button" variant="outline" className="h-11" onClick={onCancel}>
          Kembali
        </Button>
      </div>
    </form>
  )
}

export function AccountGate() {
  const { accountEmail, error, signOut, busy } = useStore()
  return (
    <StatusCard
      title="Akaun belum siap"
      body={`${accountEmail ?? "Akaun ini"} sudah log masuk, tetapi tiada permohonan yang dijumpai. Jalankan supabase/access.sql jika jadual akaun belum wujud, kemudian daftar semula.`}
      error={error}
      busy={busy}
      onSignOut={() => void signOut()}
    />
  )
}

export function PendingScreen() {
  const { profile, signOut, busy } = useStore()
  return (
    <StatusCard
      title="Permohonan sedang menunggu"
      body={`${profile?.fullName ?? "Permohonan anda"} sudah dihantar. Super admin perlu meluluskan sebelum rekod dialisis dibuka. Anda akan urus data sendiri selepas kelulusan.`}
      busy={busy}
      onSignOut={() => void signOut()}
    />
  )
}

export function RejectedScreen() {
  const { signOut, busy } = useStore()
  return (
    <StatusCard
      title="Permohonan ditolak"
      body="Super admin menolak permohonan ini. Hubungi centre anda jika ini satu kesilapan."
      busy={busy}
      onSignOut={() => void signOut()}
    />
  )
}

function StatusCard({
  title,
  body,
  error,
  busy,
  onSignOut,
}: {
  title: string
  body: string
  error?: string | null
  busy: boolean
  onSignOut: () => void
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="font-heading text-2xl">{title}</CardTitle>
          <CardDescription>{body}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="button" variant="outline" className="h-11" disabled={busy} onClick={onSignOut}>
            Keluar
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}

function PasswordField({
  id,
  value,
  onChange,
  autoComplete,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  autoComplete: string
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>Kata laluan</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          minLength={8}
          className="h-12 min-w-0 flex-1 rounded-xl border-slate-300 bg-white px-4 text-base text-slate-900 shadow-none placeholder:text-slate-400 focus-visible:border-teal-700 focus-visible:ring-2 focus-visible:ring-teal-700/20"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          className="h-12 shrink-0 rounded-xl border-slate-300 bg-white px-4 text-sm font-semibold !text-slate-800 hover:bg-slate-100 hover:!text-slate-900 focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
          onClick={() => {
            const next = generatePassword()
            onChange(next)
            setVisible(true)
          }}
        >
          Jana
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Sekurang-kurangnya 8 aksara. Simpan kata laluan yang dijana.</p>
    </div>
  )
}
