import { ComingSoon } from "../components/home/coming-soon"
import { Home } from "../components/home/home"
import { type GameModule, type HomeSeo, isPlayable } from "../lib/binding"
import { type Locale, OG_LOCALES } from "../lib/i18n"
import { getLocale } from "../lib/locale-server"
import { type SiteSettings, siteTitle } from "../lib/settings"
import { loadSettings } from "../lib/settings-server"
import { gameUrl, shareImageUrl } from "../lib/site-url"
import { sanityClient } from "../sanity/client"

/** Platform of the structured data when the game gives none. */
const PLATFORM: Record<Locale, string> = { fr: "Navigateur web", en: "Web browser", es: "Navegador web", de: "Webbrowser" }

function structuredData(game: GameModule, { title, description, minPlayers, maxPlayers }: SiteSettings, locale: Locale, seo: HomeSeo | undefined) {
  const url = gameUrl(game.slug)
  const language = OG_LOCALES[locale].replace("_", "-")
  const { AUTHOR } = game.binding
  // A game with no description in Sanity has none here either
  const summary = description ? { description } : {}
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", "@id": `${url}/#site`, url, name: siteTitle(title), inLanguage: language, ...summary },
      {
        "@type": "VideoGame",
        name: siteTitle(title),
        url,
        ...summary,
        inLanguage: language,
        ...(seo?.genres?.length ? { genre: seo.genres } : {}),
        gamePlatform: seo?.platform ?? PLATFORM[locale],
        applicationCategory: "Game",
        playMode: "MultiPlayer",
        numberOfPlayers: { "@type": "QuantitativeValue", minValue: minPlayers, maxValue: maxPlayers },
        image: shareImageUrl(game.slug),
        offers: { "@type": "Offer", price: 0, priceCurrency: "EUR" },
        author: { "@type": "Person", name: AUTHOR.name, url: AUTHOR.url },
      },
    ],
  }
}

/** Home of a game, `/<slug>`: create or join a table; "coming soon" while the game cannot be played. */
export async function HomePage({ game }: { game: GameModule }) {
  const [settings, locale] = await Promise.all([loadSettings(game), getLocale()])
  if (!isPlayable(game))
    return (
      <>
        <h1 className="sr-only">{siteTitle(settings.title)}</h1>
        <ComingSoon />
      </>
    )
  const seo = await game.binding.SEO?.({ game, locale, sanity: sanityClient(game) })
  const heading = seo?.heading
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData(game, settings, locale, seo)).replace(/</g, "\\u003c") }} />
      <h1 className="sr-only">{heading ? `${siteTitle(settings.title)} · ${heading}` : siteTitle(settings.title)}</h1>
      <Home />
    </>
  )
}
