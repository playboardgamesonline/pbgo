import { describe, expect, it } from "vitest"
import type { GameEntry } from "@pbgo/core/lib/binding"
import { shareImagePath } from "@pbgo/core/lib/site-url"
import { pictureUrl } from "./catalog"
import { gameJsonLd, gameMetadata, isIndexable, liveSeo, metaDescription, plannedSeo, serializeJsonLd, sitemapItems, type GameSeo } from "./seo"
import { liveEntry, plannedEntry } from "./testing"

const SITE = "https://playboardgamesonline.app"
const site = { url: SITE, name: "PlayBoardGamesOnline" }

/** The SEO data of an indexable planned game with everything filled; `overrides` change a field. */
const seo = (overrides: Partial<GameSeo> = {}): GameSeo => ({
  slug: "the-mind",
  name: "The Mind",
  indexable: true,
  description: { text: "A cooperative game of silence.", language: "en" },
  image: { url: "/api/catalog/the-mind/background?v=abc", wide: true },
  players: { min: 2, max: 4 },
  minutes: 20,
  age: 8,
  authors: ["Wolfgang Warsch"],
  illustrators: ["Oliver Freudenreich"],
  publishers: [{ name: "Pandasaurus Games", url: "https://pandasaurus.example" }],
  credit: null,
  ...overrides,
})

/** The same game with nothing to say beyond its name. */
const bare = (overrides: Partial<GameSeo> = {}) =>
  seo({ description: null, image: null, players: null, minutes: null, age: null, authors: [], illustrators: [], publishers: [], credit: null, ...overrides })

describe("isIndexable", () => {
  it("follows the registry's flag for a live game", () => {
    expect(isIndexable(liveEntry("courtisans", { indexable: true }))).toBe(true)
    expect(isIndexable(liveEntry("courtisans", { indexable: false }))).toBe(false)
  })

  it("needs a description for a game to come, in whichever language it is", () => {
    expect(isIndexable(plannedEntry("the-mind", { descriptions: { en: "A game of silence." } }))).toBe(true)
    expect(isIndexable(plannedEntry("the-mind", { descriptions: { de: "Ein Spiel der Stille." } }))).toBe(true)
    expect(isIndexable(plannedEntry("the-mind", { descriptions: {} }))).toBe(false)
  })

  it("counts a blank description as none", () => {
    expect(isIndexable(plannedEntry("the-mind", { descriptions: { fr: "", en: "" } }))).toBe(false)
  })
})

describe("metaDescription", () => {
  it("keeps a short text, on one line", () => {
    expect(metaDescription("A game\nof silence.\n\n  Play it.")).toBe("A game of silence. Play it.")
  })

  it("leaves a text of exactly the limit as it is, and cuts one that is a character longer", () => {
    expect(metaDescription("a".repeat(160))).toBe("a".repeat(160))
    expect([...metaDescription("a".repeat(161))]).toHaveLength(160)
  })

  it("cuts a long text between two words and closes it with an ellipsis, within the limit", () => {
    const result = metaDescription("word ".repeat(100))
    expect([...result].length).toBeLessThanOrEqual(160)
    expect(result.endsWith(" word…")).toBe(true)
  })

  it("keeps the word that ends where the room ends, and drops the one the cut falls inside", () => {
    expect(metaDescription("aaaa bbbb cccc", 10)).toBe("aaaa bbbb…")
    expect(metaDescription("aaaa bbbbb cccc", 10)).toBe("aaaa…")
  })

  it("cuts a first word that is longer than the room as it stands", () => {
    expect(metaDescription("abcdefghijkl", 6)).toBe("abcde…")
  })

  it("leaves no punctuation hanging before the ellipsis", () => {
    expect(metaDescription("Play, wait, bid and win", 12)).toBe("Play, wait…")
    expect(metaDescription("Play, wait, bid. And win everything", 17)).toBe("Play, wait, bid…")
  })

  it("counts an emoji as one character, as the reader does", () => {
    expect([...metaDescription("🎲".repeat(200))]).toHaveLength(160)
  })
})

describe("plannedSeo", () => {
  const entry = plannedEntry("the-mind", {
    name: "The Mind",
    descriptions: { en: "A cooperative game of silence." },
    players: { min: 2, max: 4 },
    duration: 20,
    age: 8,
    authors: ["Wolfgang Warsch"],
    illustrators: ["Oliver Freudenreich"],
    publishers: [{ name: "Pandasaurus Games", url: "https://pandasaurus.example" }],
    art: { logo: true, icon: false, background: true },
    editedAt: "2026-10-22T10:30:00.000Z",
  })
  const description = { text: "A cooperative game of silence.", language: "en" } as const

  it("carries the facts and the credits of the row, and the picture of its background", () => {
    expect(plannedSeo(entry, description)).toEqual({
      slug: "the-mind",
      name: "The Mind",
      indexable: true,
      description,
      image: { url: pictureUrl(entry.game, "background"), wide: true },
      players: { min: 2, max: 4 },
      minutes: 20,
      age: 8,
      authors: ["Wolfgang Warsch"],
      illustrators: ["Oliver Freudenreich"],
      publishers: [{ name: "Pandasaurus Games", url: "https://pandasaurus.example" }],
      credit: null,
    })
  })

  it("is not indexable without a description in the row, whichever one the page shows", () => {
    expect(plannedSeo(plannedEntry("the-mind", { descriptions: {} }), null).indexable).toBe(false)
  })

  it("has no picture to share when the row has none", () => {
    expect(plannedSeo(plannedEntry("the-mind"), null).image).toBeNull()
  })
})

describe("liveSeo", () => {
  const entry = (overrides: Partial<GameEntry> = {}) =>
    liveEntry("courtisans", { name: "Courtisans", tagline: "Win the court.", indexable: true, players: { min: 3, max: 6 }, duration: { min: 30, max: 30 }, ...overrides })
  const noCredits = { authors: null, publisher: null, publisherUrl: null }
  const description = { text: "Une intrigue de cour.", language: "fr" } as const

  it("takes the texts and the credits of the game's settings, the figures of the registry and the game's own share image", () => {
    const credits = { authors: "A. Author", publisher: "Cour Éditions", publisherUrl: "https://cour.example" }
    expect(liveSeo(entry(), { description, credits })).toEqual({
      slug: "courtisans",
      name: "Courtisans",
      indexable: true,
      description,
      image: { url: shareImagePath("courtisans"), wide: true },
      players: { min: 3, max: 6 },
      minutes: 30,
      age: null,
      authors: [],
      illustrators: [],
      publishers: [{ name: "Cour Éditions", url: "https://cour.example" }],
      credit: "A. Author",
    })
  })

  it("follows the registry's flag", () => {
    expect(liveSeo(entry({ indexable: false }), { description, credits: noCredits }).indexable).toBe(false)
  })

  it("falls back on the registry's English line when the settings have no description", () => {
    expect(liveSeo(entry(), { description: null, credits: noCredits }).description).toEqual({ text: "Win the court.", language: "en" })
    expect(liveSeo(entry({ tagline: "" }), { description: null, credits: noCredits }).description).toBeNull()
  })

  it("leaves out a duration that is a range, which has no place in `timeRequired`, and a figure the registry does not give", () => {
    expect(liveSeo(entry({ duration: { min: 30, max: 45 } }), { description, credits: noCredits }).minutes).toBeNull()
    const { players, duration, ...unknown } = entry().game
    const seoOfUnknown = liveSeo({ live: true, slug: "courtisans", game: unknown, related: [] }, { description, credits: noCredits })
    expect([players, duration]).toEqual([{ min: 3, max: 6 }, { min: 30, max: 30 }])
    expect([seoOfUnknown.players, seoOfUnknown.minutes]).toEqual([null, null])
  })

  it("has no publisher without one in the settings, and a publisher without a site has no address", () => {
    expect(liveSeo(entry(), { description, credits: noCredits }).publishers).toEqual([])
    expect(liveSeo(entry(), { description, credits: { ...noCredits, publisher: "Cour Éditions" } }).publishers).toEqual([{ name: "Cour Éditions", url: null }])
  })
})

describe("gameMetadata", () => {
  it("is the page's title, description, canonical, robots, Open Graph and Twitter card", () => {
    expect(gameMetadata(seo(), site)).toEqual({
      title: "The Mind",
      description: "A cooperative game of silence.",
      alternates: { canonical: `${SITE}/game/the-mind` },
      robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
      openGraph: {
        type: "website",
        siteName: "PlayBoardGamesOnline",
        url: `${SITE}/game/the-mind`,
        title: "The Mind · PlayBoardGamesOnline",
        description: "A cooperative game of silence.",
        locale: "en_US",
        images: [{ url: `${SITE}/api/catalog/the-mind/background?v=abc` }],
      },
      twitter: {
        card: "summary_large_image",
        title: "The Mind · PlayBoardGamesOnline",
        description: "A cooperative game of silence.",
        images: [`${SITE}/api/catalog/the-mind/background?v=abc`],
      },
    })
  })

  it("puts the description on one line and cuts it where a search result would", () => {
    expect(gameMetadata(seo({ description: { text: "One.\n\nTwo.", language: "en" } }), site).description).toBe("One. Two.")
    const long = gameMetadata(seo({ description: { text: "word ".repeat(100), language: "en" } }), site)
    expect([...String(long.description)].length).toBeLessThanOrEqual(160)
    expect(long.openGraph?.description).toBe(long.description)
  })

  it("lets crawlers index a page that may be, and follow the links of one that may not", () => {
    expect(gameMetadata(seo({ indexable: false }), site).robots).toEqual({ index: false, follow: true })
  })

  it("gives the Open Graph the locale of the language the description was found in", () => {
    const locale = (language: "fr" | "en" | "es" | "de") => gameMetadata(seo({ description: { text: "…", language } }), site).openGraph
    expect(locale("fr")).toMatchObject({ locale: "fr_FR" })
    expect(locale("es")).toMatchObject({ locale: "es_ES" })
    expect(locale("de")).toMatchObject({ locale: "de_DE" })
  })

  it("makes the picture's address whole, as a crawler cannot read a path of the site", () => {
    const metadata = gameMetadata(seo({ image: { url: "/api/catalog/the-mind/logo?v=abc", wide: false } }), site)
    expect(metadata.openGraph).toMatchObject({ images: [{ url: `${SITE}/api/catalog/the-mind/logo?v=abc` }] })
    expect(metadata.twitter).toMatchObject({ images: [`${SITE}/api/catalog/the-mind/logo?v=abc`] })
  })

  it("asks for the large card with a wide picture only", () => {
    expect(gameMetadata(seo(), site).twitter).toMatchObject({ card: "summary_large_image" })
    expect(gameMetadata(seo({ image: { url: "/api/catalog/the-mind/logo?v=abc", wide: false } }), site).twitter).toMatchObject({ card: "summary" })
    expect(gameMetadata(seo({ image: null }), site).twitter).toMatchObject({ card: "summary" })
  })

  it("has no description, locale or picture key when the game has none: they would wipe the layout's ones", () => {
    const metadata = gameMetadata(bare(), site)
    expect(metadata).not.toHaveProperty("description")
    expect(metadata.openGraph).not.toHaveProperty("description")
    expect(metadata.openGraph).not.toHaveProperty("locale")
    expect(metadata.openGraph).not.toHaveProperty("images")
    expect(metadata.twitter).not.toHaveProperty("description")
    expect(metadata.twitter).not.toHaveProperty("images")
  })

  // Next reads a key that is present as an override, even set to `undefined`
  const undefinedPaths = (value: unknown, path = "$"): string[] =>
    value === undefined ? [path] : value && typeof value === "object" ? Object.entries(value).flatMap(([key, child]) => undefinedPaths(child, `${path}.${key}`)) : []

  it.each([
    ["a full game", seo()],
    ["a game with nothing to say", bare()],
    ["a game that is not indexable", seo({ indexable: false })],
    ["a game with no picture", seo({ image: null })],
    ["a game with no description", seo({ description: null })],
  ])("never sets a key to undefined: %s", (_name, game) => {
    expect(undefinedPaths(gameMetadata(game, site))).toEqual([])
  })
})

describe("gameJsonLd", () => {
  it("is a schema.org Game with everything the page knows", () => {
    expect(gameJsonLd(seo(), SITE)).toEqual({
      "@context": "https://schema.org",
      "@type": "Game",
      name: "The Mind",
      url: `${SITE}/game/the-mind`,
      description: "A cooperative game of silence.",
      image: `${SITE}/api/catalog/the-mind/background?v=abc`,
      numberOfPlayers: { "@type": "QuantitativeValue", minValue: 2, maxValue: 4 },
      timeRequired: "PT20M",
      typicalAgeRange: "8-",
      author: [{ "@type": "Person", name: "Wolfgang Warsch" }],
      contributor: [{ "@type": "Person", name: "Oliver Freudenreich" }],
      publisher: [{ "@type": "Organization", name: "Pandasaurus Games", url: "https://pandasaurus.example" }],
    })
  })

  it("has only what the game has: a field with no value is absent, not empty", () => {
    expect(Object.keys(gameJsonLd(bare(), SITE))).toEqual(["@context", "@type", "name", "url"])
  })

  it("has no upper bound for a game with no maximum of players", () => {
    expect(gameJsonLd(seo({ players: { min: 5, max: null } }), SITE).numberOfPlayers).toStrictEqual({ "@type": "QuantitativeValue", minValue: 5 })
  })

  it.each([
    [20, "PT20M"],
    [45, "PT45M"],
    [60, "PT1H"],
    [90, "PT1H30M"],
    [120, "PT2H"],
  ])("writes %i minutes as %s", (minutes, expected) => {
    expect(gameJsonLd(seo({ minutes }), SITE).timeRequired).toBe(expected)
  })

  it("names a publisher without a site by its name alone", () => {
    expect(gameJsonLd(seo({ publishers: [{ name: "Pandasaurus Games", url: null }] }), SITE).publisher).toStrictEqual([{ "@type": "Organization", name: "Pandasaurus Games" }])
  })

  it("carries a live game's free credit line as `creditText`", () => {
    expect(gameJsonLd(seo({ authors: [], credit: "Une création de A. Author" }), SITE)).toMatchObject({ creditText: "Une création de A. Author" })
    expect(gameJsonLd(seo(), SITE)).not.toHaveProperty("creditText")
  })

  it("puts the description on one line but does not cut it: a search result does not read it", () => {
    expect(gameJsonLd(seo({ description: { text: "One.\n\nTwo.", language: "en" } }), SITE).description).toBe("One. Two.")
    expect(gameJsonLd(seo({ description: { text: "a".repeat(300), language: "en" } }), SITE).description).toBe("a".repeat(300))
  })
})

describe("serializeJsonLd", () => {
  it("escapes `<`, so that a name can never close the script tag it is written in", () => {
    const text = serializeJsonLd(gameJsonLd(seo({ name: "</script><script>alert(1)</script>" }), SITE))
    expect(text).not.toContain("<")
    expect(text).toContain("\\u003c/script>")
  })

  it("is JSON that reads back as the data", () => {
    const data = gameJsonLd(seo({ name: 'A <b> & "quoted" game' }), SITE)
    expect(JSON.parse(serializeJsonLd(data))).toEqual(data)
  })
})

describe("sitemapItems", () => {
  const registry = [
    { slug: "courtisans", indexable: true },
    { slug: "hanabi", indexable: false },
  ]
  const entries = [
    liveEntry("courtisans", { indexable: true }),
    liveEntry("flip-7", { indexable: false }),
    plannedEntry("the-mind", { descriptions: { fr: "Un jeu de silence." }, editedAt: "2026-10-22T10:30:00.000Z" }),
    plannedEntry("bang", { descriptions: {} }),
  ]
  const urls = (items: ReturnType<typeof sitemapItems>) => items.map((item) => item.url)

  it("lists the hub, then the home of every indexable game, then the hub page of every indexable game of the catalog", () => {
    expect(urls(sitemapItems(SITE, registry, entries))).toEqual([SITE, `${SITE}/courtisans`, `${SITE}/game/courtisans`, `${SITE}/game/the-mind`])
  })

  it("lists exactly the hub pages that do not say `noindex`", () => {
    const listed = urls(sitemapItems(SITE, registry, entries))
    for (const entry of entries) expect(listed.includes(`${SITE}/game/${entry.slug}`)).toBe(isIndexable(entry))
  })

  it("lists no home for a game of the registry that is not indexable", () => {
    expect(urls(sitemapItems(SITE, registry, entries))).not.toContain(`${SITE}/hanabi`)
  })

  it("is the hub and the indexable homes alone when the catalog has nothing: Notion down, no live game", () => {
    expect(urls(sitemapItems(SITE, registry, []))).toEqual([SITE, `${SITE}/courtisans`])
  })

  it("dates the page of a game to come with the last edit of its Notion row", () => {
    const item = sitemapItems(SITE, registry, entries).find((candidate) => candidate.url === `${SITE}/game/the-mind`)
    expect(item).toStrictEqual({ url: `${SITE}/game/the-mind`, lastModified: new Date("2026-10-22T10:30:00.000Z"), changeFrequency: "monthly", priority: 0.6 })
  })

  it("leaves the date out when the last edit does not read as one, and for a live game, which has none", () => {
    const undated = sitemapItems(SITE, registry, [plannedEntry("the-mind", { descriptions: { fr: "Un jeu." }, editedAt: "not a date" }), liveEntry("courtisans", { indexable: true })]).slice(2)
    expect(undated).toStrictEqual([
      { url: `${SITE}/game/the-mind`, changeFrequency: "monthly", priority: 0.6 },
      { url: `${SITE}/game/courtisans`, changeFrequency: "weekly", priority: 0.8 },
    ])
  })
})
