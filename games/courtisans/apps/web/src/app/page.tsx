import { Home } from "@pbgo/core/components/home/home"
import { siteTitle } from "@pbgo/core/lib/settings"
import { OG_LOCALES, type Locale } from "@pbgo/core/lib/i18n"
import { getLocale } from "@pbgo/core/lib/locale-server"
import { loadSettings } from "@pbgo/core/lib/settings-server"
import { gameDict } from "@/lib/i18n"
import { AUTHOR, GAME_URL } from "@/lib/site"

function structuredData({ title, description, minPlayers, maxPlayers }: Awaited<ReturnType<typeof loadSettings>>, language: string, locale: Locale) {
  const { seo } = gameDict(locale)
  return {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", "@id": `${GAME_URL}/#site`, url: GAME_URL, name: siteTitle(title), inLanguage: language, description },
    {
      "@type": "VideoGame",
      name: siteTitle(title),
      url: GAME_URL,
      description,
      inLanguage: language,
      genre: seo.genres,
      gamePlatform: seo.platform,
      applicationCategory: "Game",
      playMode: "MultiPlayer",
      numberOfPlayers: { "@type": "QuantitativeValue", minValue: minPlayers, maxValue: maxPlayers },
      image: `${GAME_URL}/opengraph-image.jpg`,
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData(settings, language, locale)) }} />
      <h1 className="sr-only">{`${siteTitle(settings.title)} · ${gameDict(locale).homeHeading}`}</h1>
      <Home />
    </>
  )
}
