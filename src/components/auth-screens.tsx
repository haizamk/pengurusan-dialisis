"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useStore } from "@/lib/store"

export function LoginScreen() {
  const { signIn, busy, error } = useStore()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <p className="font-heading text-3xl leading-none text-primary">PPD</p>
          <CardTitle className="font-heading text-2xl">Pengurusan Pesakit Dialisis</CardTitle>
          <CardDescription>
            Log masuk staf centre. Akaun tidak didaftarkan sendiri; pentadbir menciptanya dalam Supabase.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              void signIn(email, password).catch(() => undefined)
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="emel">Emel</Label>
              <Input
                id="emel"
                type="email"
                autoComplete="username"
                required
                className="h-11"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="kata-laluan">Kata laluan</Label>
              <Input
                id="kata-laluan"
                type="password"
                autoComplete="current-password"
                required
                className="h-11"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="h-11" disabled={busy}>
              {busy ? "Sedang masuk…" : "Log masuk"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export function AccountGate() {
  const { accountEmail, error, signOut, busy } = useStore()
  const [copied, setCopied] = useState(false)
  const email = accountEmail ?? ""
  const sql = linkStaffSql(email)

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="font-heading text-2xl">Akaun belum dihubungkan</CardTitle>
          <CardDescription>
            {email} sudah log masuk, tetapi belum ada dalam jadual staf. Rekod pesakit tidak dipaparkan sehingga akaun ini
            dihubungkan dengan centre.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <p className="text-sm leading-6 text-muted-foreground">
            Jika jadual belum wujud, jalankan <span className="font-medium text-foreground">supabase/access.sql</span> dalam
            SQL Editor. Kemudian jalankan skrip ini untuk menjadikan akaun semasa pentadbir semua centre.
          </p>
          <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-5">{sql}</pre>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => {
                void navigator.clipboard.writeText(sql).then(() => {
                  setCopied(true)
                })
              }}
            >
              {copied ? "SQL disalin" : "Salin SQL"}
            </Button>
            <Button type="button" variant="outline" className="h-11" disabled={busy} onClick={() => void signOut()}>
              Keluar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function linkStaffSql(email: string) {
  const safe = email.replaceAll("'", "''")
  return `insert into public.staff (user_id, full_name, role)
select id, 'Pentadbir', 'pentadbir'
from auth.users
where lower(email) = lower('${safe}')
on conflict (user_id) do update set role = excluded.role;

insert into public.staff_centres (user_id, centre_id)
select u.id, c.id
from auth.users u
cross join public.centres c
where lower(u.email) = lower('${safe}')
on conflict do nothing;`
}
