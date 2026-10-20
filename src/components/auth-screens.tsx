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
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <p className="font-heading text-3xl leading-none text-primary">PPD</p>
          <CardTitle className="font-heading text-2xl">Pengurusan Pesakit Dialisis</CardTitle>
          <CardDescription>
            Pesakit daftar, super admin meluluskan, kemudian pesakit mengurus rekod sendiri.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {setupError ? <p className="text-sm leading-6 text-destructive">{setupError}</p> : null}
          {mode === "masuk" ? (
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault()
                void signIn(email, password).catch(() => undefined)
              }}
            >
              <Field label="Emel" id="emel">
                <Input id="emel" type="email" autoComplete="username" required className="h-11" value={email} onChange={(event) => setEmail(event.target.value)} />
              </Field>
              <PasswordField id="kata-laluan" value={password} onChange={setPassword} autoComplete="current-password" />
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button type="submit" className="h-11" disabled={busy}>
                {busy ? "Sedang masuk…" : "Log masuk"}
              </Button>
            </form>
          ) : null}
          {mode === "pesakit" ? (
            <PatientRegister centres={centres} centreError={centreError} onCancel={() => setMode("masuk")} />
          ) : null}
          {mode === "admin" ? <AdminRegister onCancel={() => setMode("masuk")} /> : null}
          {mode === "masuk" ? (
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11"
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
                <Button type="button" variant="outline" className="h-11" onClick={() => setMode("admin")}>
                  Daftar super admin
                </Button>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
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
          className="h-11"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          className="h-11"
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
