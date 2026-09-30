import Image from "next/image"
import { gameJsonLd } from "@pbgo/site"
import { SITE } from "@/lib/site"

const STRUCTURED_DATA = gameJsonLd(SITE)

export default function Home() {
  return (
    <main className="home">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }} />
      <div className="sky" aria-hidden="true" />
      <div className="content">
        <h1 className="logo">
          <Image src="/LOGO.png" alt="Hanabi en ligne" width={1200} height={358} priority />
        </h1>
        <p className="status">
          <span className="dot" aria-hidden="true" />
          Jeu en cours de développement…
        </p>
        <p className="credits">{SITE.tagline} · Bientôt jouable en ligne</p>
      </div>
    </main>
  )
}
