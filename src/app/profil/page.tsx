"use client"

import { PageHeader } from "@/components/page-header"
import { useStore } from "@/lib/store"

export default function Page() {
  const { profile } = useStore()
  return (
    <div>
      <PageHeader
        eyebrow="Profil"
        title="Profil saya"
        description="Maklumat akaun yang didaftarkan. Sasaran rawatan dan diet peribadi tidak disimpan di sini."
      />
      {profile?.role === "pesakit" ? (
        <dl className="grid gap-3 text-sm leading-6">
          <div className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10"><dt className="text-muted-foreground">Nama</dt><dd>{profile.fullName}</dd></div>
          <div className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10"><dt className="text-muted-foreground">Emel</dt><dd>{profile.email}</dd></div>
          <div className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10"><dt className="text-muted-foreground">Telefon</dt><dd>{profile.phone || "Tidak diisi"}</dd></div>
          <div className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10"><dt className="text-muted-foreground">Jadual</dt><dd>{profile.schedule || "Tidak diisi"}</dd></div>
          <div className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10"><dt className="text-muted-foreground">Diagnosis</dt><dd>{profile.diagnosis || "Tidak diisi"}</dd></div>
        </dl>
      ) : profile?.role === "super_admin" ? (
        <p className="text-sm leading-6">{profile.fullName}. Akaun ini meluluskan permohonan dan tidak membuka rekod kesihatan pesakit.</p>
      ) : (
        <p className="text-sm leading-6 text-muted-foreground">Mod tempatan tidak mempunyai profil akaun. Log masuk selepas Supabase dipasang untuk melihat profil anda.</p>
      )}
    </div>
  )
}
