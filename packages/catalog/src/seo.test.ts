import { describe, expect, it } from "vitest"
import { pictureUrl, registryRow } from "./catalog"
import { gameJsonLd, gameMetadata, gameSeo, isIndexable, metaDescription, serializeJsonLd, sitemapItems, type GameSeo } from "./seo"
import { catalogEntry, registryGame } from "./testing"

const SITE = "https://playboardgamesonline.app"
const site = { url: SITE, name: "PlayBoardGamesOnline" }

/** The SEO data of an indexable game with everything filled; `overrides` change a field. */
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
  ...overrides,
})

/** The same game with nothing to say beyond its name. */
const bare = (overrides: Partial<GameSeo> = {}) =>
  seo({ description: null, image: null, players: null, minutes: null, age: null, authors: [], illustrators: [], publishers: [], ...overrides })

describe("isIndexable", () => {
  it("follows the registry's flag for a live game, whatever its Notion row says", () => {
    expect(isIndexable(catalogEntry("courtisans", { live: true, indexable: true }))).toBe(true)
    expect(isIndexable(catalogEntry("courtisans", { live: true, indexable: false }))).toBe(false)
    // A live game is not turned into a `noindex` by a row with no text, nor into an indexable page by a row with one
    expect(isIndexable(catalogEntry("courtisans", { live: true, indexable: true, game: { descriptions: {} } }))).toBe(true)
    expect(isIndexable(catalogEntry("courtisans", { live: true, indexable: false, game: { descriptions: { en: "A court intrigue." } } }))).toBe(false)
  })

  it("needs a description for a game to come, in whichever language it is", () => {
    expect(isIndexable(catalogEntry("the-mind", { game: { descriptions: { en: "A game of silence." } } }))).toBe(true)
    expect(isIndexable(catalogEntry("the-mind", { game: { descriptions: { de: "Ein Spiel der Stille." } } }))).toBe(true)
    expect(isIndexable(catalogEntry("the-mind", { game: { descriptions: {} } }))).toBe(false)
  })

  it("does not ask the registry about a game to come", () => {
    expect(isIndexable(catalogEntry("the-mind", { indexable: true, game: { descriptions: {} } }))).toBe(false)
    expect(isIndexable(catalogEntry("the-mind", { indexable: false, game: { descriptions: { fr: "Un jeu de silence." } } }))).toBe(true)
  })

  it("counts a blank description as none", () => {
    expect(isIndexable(catalogEntry("the-mind", { game: { descriptions: { fr: "", en: "" } } }))).toBe(false)
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

describe("gameSeo", () => {
  const description = { text: "A cooperative game of silence.", language: "en" } as const

  describe("a game to come", () => {
    const entry = catalogEntry("the-mind", {
      game: {
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
      },
    })

    it("carries the facts and the credits of the row, and the picture of its background", () => {
      expect(gameSeo(entry, description)).toEqual({
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
      })
    })

    it("is not indexable without a description in the row, whichever one the page shows", () => {
      expect(gameSeo(catalogEntry("the-mind", { game: { descriptions: {} } }), null).indexable).toBe(false)
    })

    it("has no picture to share when the row has none", () => {
      expect(gameSeo(catalogEntry("the-mind"), null).image).toBeNull()
    })

    it("shares the logo when the row has no background, and says it is not wide", () => {
      const withLogo = catalogEntry("the-mind", { game: { art: { logo: true, icon: false, background: false } } })
      expect(gameSeo(withLogo, null).image).toEqual({ url: pictureUrl(withLogo.game, "logo"), wide: false })
    })
  })

  describe("a live game", () => {
    const entry = catalogEntry("courtisans", {
      live: true,
      indexable: true,
      game: {
        name: "Courtisans",
        descriptions: { fr: "Une intrigue de cour." },
        players: { min: 2, max: 5 },
        duration: 30,
        age: 12,
        authors: ["A. Author"],
        illustrators: ["An Illustrator"],
        publishers: [{ name: "Cour Éditions", url: "https://cour.example" }],
        art: { logo: true, icon: true, background: true },
        editedAt: "2026-10-26T09:00:00.000Z",
      },
    })
    const french = { text: "Une intrigue de cour.", language: "fr" } as const

    it("takes everything from its Notion row, the credits and the picture too", () => {
      expect(gameSeo(entry, french)).toEqual({
        slug: "courtisans",
        name: "Courtisans",
        indexable: true,
        description: french,
        image: { url: pictureUrl(entry.game, "background"), wide: true },
        players: { min: 2, max: 5 },
        minutes: 30,
        age: 12,
        authors: ["A. Author"],
        illustrators: ["An Illustrator"],
        publishers: [{ name: "Cour Éditions", url: "https://cour.example" }],
      })
    })

    it("follows the registry's flag, not the row", () => {
      expect(gameSeo({ ...entry, indexable: false }, french).indexable).toBe(false)
      expect(gameSeo({ ...entry, game: { ...entry.game, descriptions: {} } }, null).indexable).toBe(true)
    })

    it("is what the registry knows when Notion has no row for it: its figures, no text, no picture, no credit", () => {
      const registry = registryGame("courtisans", { name: "Courtisans", live: true, indexable: true, players: { min: 2, max: 5 }, duration: { min: 30, max: 30 } })
      const unknown = catalogEntry("courtisans", { live: true, indexable: true, game: registryRow(registry) })
      expect(gameSeo(unknown, null)).toEqual({
        slug: "courtisans",
        name: "Courtisans",
        indexable: true,
        description: null,
        image: null,
        players: { min: 2, max: 5 },
        minutes: 30,
        age: null,
        authors: [],
        illustrators: [],
        publishers: [],
      })
    })

    it("leaves out a duration that is a range, which has no place in `timeRequired`", () => {
      const registry = registryGame("courtisans", { live: true, duration: { min: 30, max: 45 } })
      expect(gameSeo(catalogEntry("courtisans", { live: true, game: registryRow(registry) }), null).minutes).toBeNull()
    })
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
    catalogEntry("courtisans", { live: true, indexable: true, game: { editedAt: "2026-10-26T09:00:00.000Z" } }),
    catalogEntry("flip-7", { live: true, indexable: false }),
    catalogEntry("the-mind", { game: { descriptions: { fr: "Un jeu de silence." }, editedAt: "2026-10-22T10:30:00.000Z" } }),
    catalogEntry("bang", { game: { descriptions: {} } }),
  ]
  const urls = (items: ReturnType<typeof sitemapItems>) => items.map((item) => item.url)

  it("lists the hub and its list of games, then the home of every indexable game, then the hub page of every indexable game of the catalog", () => {
    expect(urls(sitemapItems(SITE, registry, entries))).toEqual([
      SITE,
      `${SITE}/games`,
      `${SITE}/courtisans`,
      `${SITE}/game/courtisans`,
      `${SITE}/game/the-mind`,
    ])
  })

  it("lists exactly the hub pages that do not say `noindex`", () => {
    const listed = urls(sitemapItems(SITE, registry, entries))
    for (const entry of entries) expect(listed.includes(`${SITE}/game/${entry.slug}`)).toBe(isIndexable(entry))
  })

  it("lists no home for a game of the registry that is not indexable", () => {
    expect(urls(sitemapItems(SITE, registry, entries))).not.toContain(`${SITE}/hanabi`)
  })

  it("is the hub, its list of games and the indexable homes alone when the catalog has nothing", () => {
    expect(urls(sitemapItems(SITE, registry, []))).toEqual([SITE, `${SITE}/games`, `${SITE}/courtisans`])
  })

  it("dates the page of a game with the last edit of its Notion row, a game to come's and a live game's", () => {
    const items = sitemapItems(SITE, registry, entries)
    expect(items.find((candidate) => candidate.url === `${SITE}/game/the-mind`)).toStrictEqual({
      url: `${SITE}/game/the-mind`,
      lastModified: new Date("2026-10-22T10:30:00.000Z"),
      changeFrequency: "monthly",
      priority: 0.6,
    })
    expect(items.find((candidate) => candidate.url === `${SITE}/game/courtisans`)).toStrictEqual({
      url: `${SITE}/game/courtisans`,
      lastModified: new Date("2026-10-26T09:00:00.000Z"),
      changeFrequency: "weekly",
      priority: 0.8,
    })
  })

  it("leaves the date out when the last edit does not read as one, and for a live game with no Notion row, which has none", () => {
    const registered = registryRow(registryGame("courtisans", { live: true, indexable: true }))
    const undated = sitemapItems(SITE, registry, [
      catalogEntry("the-mind", { game: { descriptions: { fr: "Un jeu." }, editedAt: "not a date" } }),
      catalogEntry("courtisans", { live: true, indexable: true, game: registered }),
    ]).slice(3) // the hub, its list of games and the home of Courtisans come first
    expect(undated).toStrictEqual([
      { url: `${SITE}/game/the-mind`, changeFrequency: "monthly", priority: 0.6 },
      { url: `${SITE}/game/courtisans`, changeFrequency: "weekly", priority: 0.8 },
    ])
  })
})
