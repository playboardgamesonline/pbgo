import { Home } from "@pbgo/core/components/home/home"
import { loadRules } from "@pbgo/core/lib/rules-server"
import { siteTitle } from "@pbgo/core/lib/settings"
import { loadSettings } from "@pbgo/core/lib/settings-server"
import { AUTHOR, GENRES, SITE_URL } from "@/lib/site"

export const revalidate = 60

function structuredData({ title, description, minPlayers, maxPlayers }: Awaited<ReturnType<typeof loadSettings>>) {
  return {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", "@id": `${SITE_URL}/#site`, url: SITE_URL, name: siteTitle(title), inLanguage: "fr-FR", description },
    {
      "@type": "VideoGame",
      name: siteTitle(title),
      url: SITE_URL,
      description,
      inLanguage: "fr-FR",
      genre: GENRES,
      gamePlatform: "Navigateur web",
      applicationCategory: "Game",
      playMode: "MultiPlayer",
      numberOfPlayers: { "@type": "QuantitativeValue", minValue: minPlayers, maxValue: maxPlayers },
      image: `${SITE_URL}/opengraph-image.jpg`,
      offers: { "@type": "Offer", price: 0, priceCurrency: "EUR" },
      author: { "@type": "Person", name: AUTHOR.name, url: AUTHOR.url },
    },
  ],
  }
}

export default async function HomePage() {
  const settings = await loadSettings()
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData(settings)) }} />
      <h1 className="sr-only">{siteTitle(settings.title)} · Bienvenue au banquet de la Reine : jouez à Courtisans en ligne avec vos amis</h1>
      <Home rules={await loadRules()} />
    </>
  )
}
