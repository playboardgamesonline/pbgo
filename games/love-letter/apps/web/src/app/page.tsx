import { Logo } from "@/components/logo"
import { gameJsonLd } from "@pgo/site"
import { ACCROCHE, LOGO, SITE, TITRE } from "@/lib/site"

const DONNEES_STRUCTUREES = gameJsonLd(SITE)

export default function Home() {
  return (
    <main className="fond relative grid min-h-dvh flex-1 place-items-center overflow-hidden px-4 py-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(DONNEES_STRUCTUREES) }} />
      <h1 className="sr-only">{TITRE} · {ACCROCHE}</h1>
      <div className="flex w-full max-w-3xl flex-col items-center gap-7 text-center">
        <Logo src={LOGO ?? undefined} className={LOGO ? "max-h-[45vh] w-[min(88vw,640px)] object-contain" : "w-auto"} />
        <p className="inline-flex items-center gap-2.5 whitespace-nowrap rounded-full border border-foreground/15 bg-foreground/8 px-[18px] py-2.5 text-[clamp(0.875rem,3.6vw,1rem)] font-semibold backdrop-blur-sm">
          <span aria-hidden="true" className="pastille size-2 rounded-full bg-accent" />
          Jeu en cours de développement…
        </p>
        <p className="text-sm text-foreground/65">{ACCROCHE} · Bientôt jouable</p>
      </div>
    </main>
  )
}
