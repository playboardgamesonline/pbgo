import { Home } from "@pbgo/core/components/home/home"
import { OG_LOCALES } from "@pbgo/core/lib/i18n"
import { getLocale } from "@pbgo/core/lib/locale-server"
import { loadSettings } from "@pbgo/core/lib/settings-server"
import { AUTHOR, GENRES, SITE_URL } from "@/lib/site"

function structuredData({ title, description, minPlayers, maxPlayers }: Awaited<ReturnType<typeof loadSettings>>, language: string) {
  return {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", "@id": `${SITE_URL}/#site`, url: SITE_URL, name: title, inLanguage: language, description },
    {
      "@type": "VideoGame",
      name: title,
      url: SITE_URL,
      description,
      inLanguage: language,
      genre: GENRES,
      gamePlatform: "Navigateur web",
      applicationCategory: "Game",
      playMode: "MultiPlayer",
      numberOfPlayers: { "@type": "QuantitativeValue", minValue: minPlayers, maxValue: maxPlayers },
      offers: { "@type": "Offer", price: 0, priceCurrency: "EUR" },
      author: { "@type": "Person", name: AUTHOR.name, url: AUTHOR.url },
    },
  ],
  }
}

export default async function HomePage() {
  const [settings, locale] = await Promise.all([loadSettings(), getLocale()])
  const language = OG_LOCALES[locale].replace("_", "-")
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData(settings, language)) }} />
      <h1 className="sr-only">{settings.title}</h1>
      <Home />
    </>
  )
}
