"use client"

import { CalendarDays, FileText, Mail, Phone, ShieldCheck, UserRound } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { useStore } from "@/lib/store"

export default function Page() {
  const { profile, centres } = useStore()
  const centre = profile?.centreId ? centres.find((item) => item.id === profile.centreId) : null

  if (profile?.role === "super_admin") {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Akaun pentadbir"
          title="Profil Master Admin"
          description="Maklumat akaun kawalan akses. Halaman ini tidak mengandungi rekod klinikal pesakit."
        />
        <section className="rounded-3xl border border-primary/20 bg-gradient-to-br from-[#123b4a] via-[#124957] to-[#126b70] p-5 shadow-sm sm:p-7">
          <div className="flex items-center gap-4">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-white/10 text-teal-100"><ShieldCheck className="size-7" /></span>
            <div className="min-w-0">
              <h2 className="break-words text-xl font-semibold text-white">{profile.fullName}</h2>
              <p className="mt-1 break-all text-sm text-teal-50/80">{profile.email}</p>
              <p className="mt-2 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-teal-100">Master Admin</p>
            </div>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        eyebrow="Akaun peribadi"
        title="Profil saya"
        description="Semak butiran akaun yang didaftarkan. Untuk perubahan maklumat, hubungi pusat dialisis anda."
      />

      {profile?.role === "pesakit" ? (
        <>
          <section className="rounded-3xl border border-primary/20 bg-gradient-to-br from-[#123b4a] via-[#124957] to-[#126b70] p-5 shadow-sm sm:p-7">
            <div className="flex items-center gap-4">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-teal-100"><UserRound className="size-7" /></span>
              <div className="min-w-0">
                <h2 className="break-words text-xl font-semibold text-white sm:text-2xl">{profile.fullName}</h2>
                <p className="mt-1 break-all text-sm text-teal-50/80">{profile.email}</p>
                {centre ? <p className="mt-2 text-sm text-teal-100">{centre.name} · {centre.city}</p> : null}
              </div>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Info icon={UserRound} label="Nama penuh" value={profile.fullName} />
            <Info icon={Mail} label="Alamat emel" value={profile.email} />
            <Info icon={Phone} label="Telefon" value={profile.phone || "Belum diisi"} />
            <Info icon={CalendarDays} label="Jadual dialisis" value={profile.schedule || "Belum diisi"} />
            <Info icon={FileText} label="Diagnosis yang direkodkan" value={profile.diagnosis || "Belum diisi"} />
            <Info icon={ShieldCheck} label="Status akaun" value={profile.status === "lulus" ? "Diluluskan" : profile.status === "tolak" ? "Ditolak" : "Menunggu"} />
          </section>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-5 text-sm leading-6 text-muted-foreground">
          Mod tempatan tidak mempunyai profil akaun. Data contoh hanya digunakan untuk pembangunan dan bukan rekod pesakit sebenar.
        </div>
      )}

      <aside className="rounded-2xl border border-border/70 bg-secondary/30 p-4 text-sm leading-6 text-muted-foreground">
        Privasi akaun: jangan kongsi kata laluan anda. Maklumat ini dipaparkan daripada profil akaun, bukan arahan rawatan baharu.
      </aside>
    </div>
  )
}

function Info({ icon: Icon, label, value }: { icon: typeof UserRound; label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-2 text-muted-foreground"><Icon className="size-4 text-primary" /><p className="text-sm font-medium">{label}</p></div>
      <p className="mt-3 break-words text-base font-semibold leading-6">{value}</p>
    </article>
  )
}