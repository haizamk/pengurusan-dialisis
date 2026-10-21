"use client"

import { HeartPulse, ShieldCheck } from "lucide-react"
import { Disclaimer, PageHeader } from "@/components/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ACCESS_LABEL } from "@/lib/format"
import { CARE_TIPS, FOOD_TIPS, type TipCard } from "@/lib/tips"

export function TipsScreen() {
  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        eyebrow="Pendidikan"
        title="Makanan dan penjagaan tapak"
        description="Panduan am untuk pesakit hemodialisis di Malaysia. Centre masih menentukan sukatan, had cecair, dan ubat setiap orang."
      />
      <Tabs defaultValue="makanan">
        <TabsList className="h-auto w-full flex-wrap rounded-2xl border border-border/80 bg-card p-1.5 sm:w-fit">
          <TabsTrigger value="makanan" className="h-11 rounded-xl px-4">
            Makanan
          </TabsTrigger>
          <TabsTrigger value="tapak" className="h-11 rounded-xl px-4">
            Tapak dialisis
          </TabsTrigger>
        </TabsList>
        <TabsContent value="makanan" className="mt-4">
          <div className="grid gap-3 lg:grid-cols-2">
            {FOOD_TIPS.map((tip) => (
              <TipArticle key={tip.title} tip={tip} warn={tip.title.includes("Belimbing") || tip.title.startsWith("Hadkan")} />
            ))}
          </div>
        </TabsContent>
        <TabsContent value="tapak" className="mt-5 grid gap-6">
          {(Object.keys(CARE_TIPS) as (keyof typeof CARE_TIPS)[]).map((key) => (
            <section key={key} className="space-y-3">
              <h2 className="font-heading text-2xl">
                {key === "kecemasan"
                  ? "Tanda kecemasan"
                  : ACCESS_LABEL[key]}
              </h2>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {CARE_TIPS[key].map((tip) => (
                  <TipArticle key={tip.title} tip={tip} warn={key === "kecemasan"} />
                ))}
              </div>
            </section>
          ))}
        </TabsContent>
      </Tabs>
      <div className="mt-6">
        <Disclaimer />
      </div>
    </div>
  )
}

function TipArticle({ tip, warn }: { tip: TipCard; warn?: boolean }) {
  return (
    <article className={`rounded-2xl border p-5 shadow-sm ${warn ? "border-destructive/30 bg-destructive/5" : "border-border/80 bg-card"}`}>
      <div className="flex items-start gap-3"><span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl ${warn ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>{warn ? <HeartPulse className="size-4" /> : <ShieldCheck className="size-4" />}</span><h3 className="font-heading text-xl">{tip.title}</h3></div>
      <p className="mt-2 text-sm leading-6">{tip.body}</p>
      {tip.items ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-muted-foreground">
          {tip.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </article>
  )
}
