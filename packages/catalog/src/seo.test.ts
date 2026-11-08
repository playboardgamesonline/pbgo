import { describe, expect, it } from "vitest"
import { pictureUrl, registryRow } from "./catalog"
import { gameJsonLd, gameMetadata, gameSeo, isIndexable, metaDescription, playLead, playLine, playTitle, serializeJsonLd, sitemapItems, type GameSeo } from "./seo"
import { catalogEntry, cdn, registryGame } from "./testing"

const SITE = "https://playboardgamesonline.app"
const site = { url: SITE, name: "Play Board Games Online" }

/** The SEO data of an indexable game with everything filled; `overrides` change a field. */
const seo = (overrides: Partial<GameSeo> = {}): GameSeo => ({
  slug: "the-mind",
  name: "The Mind",
  indexable: true,
  live: true,
  description: { text: "A cooperative game of silence.", language: "en" },
  image: { url: "/api/catalog/the-mind/background?v=abc", wide: true },
  players: { min: 2, max: 4 },
  minutes: 20,
  age: 8,
  creators: [
    { name: "Wolfgang Warsch", roles: ["designer"] },
    { name: "Oliver Freudenreich", roles: ["artist"] },
  ],
  publishers: [{ name: "Pandasaurus Games", url: "https://pandasaurus.example" }],
  ...overrides,
})

/** The same game with nothing to say beyond its name. */
const bare = (overrides: Partial<GameSeo> = {}) =>
  seo({ description: null, image: null, players: null, minutes: null, age: null, creators: [], publishers: [], ...overrides })

describe("isIndexable", () => {
  it("follows the registry's flag for a live game, whatever its game in the Studio says", () => {
    expect(isIndexable(catalogEntry("courtisans", { live: true, indexable: true }))).toBe(true)
    expect(isIndexable(catalogEntry("courtisans", { live: true, indexable: false }))).toBe(false)
    // A live game is not turned into a `noindex` by a game with no text, nor into an indexable page by a game with one
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
        creators: [
          { name: "Wolfgang Warsch", roles: ["designer"] },
          { name: "Oliver Freudenreich", roles: ["artist"] },
        ],
        publishers: [{ name: "Pandasaurus Games", url: "https://pandasaurus.example" }],
        pictures: { logo: cdn("logo-1x1.png"), icon: null, background: cdn("background-1x1.png"), cover: cdn("cover-640x480.webp") },
        updatedAt: "2026-10-22T10:30:00.000Z",
      },
    })

    it("carries the facts and the credits of the game, and the picture of its background (its cover is its card's: it is not the one that is shared)", () => {
      expect(gameSeo(entry, description)).toEqual({
        slug: "the-mind",
        name: "The Mind",
        indexable: true,
        live: false,
        description,
        image: { url: pictureUrl(entry.game, "background"), wide: true },
        players: { min: 2, max: 4 },
        minutes: 20,
        age: 8,
        creators: [
          { name: "Wolfgang Warsch", roles: ["designer"] },
          { name: "Oliver Freudenreich", roles: ["artist"] },
        ],
        publishers: [{ name: "Pandasaurus Games", url: "https://pandasaurus.example" }],
      })
    })

    it("is not indexable without a description in the game, whichever one the page shows", () => {
      expect(gameSeo(catalogEntry("the-mind", { game: { descriptions: {} } }), null).indexable).toBe(false)
    })

    it("has no picture to share when the game has none", () => {
      expect(gameSeo(catalogEntry("the-mind"), null).image).toBeNull()
    })

    it("shares the logo when the game has no background, and says it is not wide", () => {
      const withLogo = catalogEntry("the-mind", { game: { pictures: { logo: cdn("logo-1x1.png"), icon: null, background: null, cover: null } } })
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
        creators: [
          { name: "A. Author", roles: ["designer"] },
          { name: "An Illustrator", roles: ["artist"] },
        ],
        publishers: [{ name: "Cour Éditions", url: "https://cour.example" }],
        pictures: { logo: cdn("logo-1x1.png"), icon: cdn("icon-1x1.png"), background: cdn("background-1x1.png"), cover: null },
        updatedAt: "2026-10-26T09:00:00.000Z",
      },
    })
    const french = { text: "Une intrigue de cour.", language: "fr" } as const

    it("takes everything from its game in the Studio, the credits and the picture too", () => {
      expect(gameSeo(entry, french)).toEqual({
        slug: "courtisans",
        name: "Courtisans",
        indexable: true,
        live: true,
        description: french,
        image: { url: pictureUrl(entry.game, "background"), wide: true },
        players: { min: 2, max: 5 },
        minutes: 30,
        age: 12,
        creators: [
          { name: "A. Author", roles: ["designer"] },
          { name: "An Illustrator", roles: ["artist"] },
        ],
        publishers: [{ name: "Cour Éditions", url: "https://cour.example" }],
      })
    })

    it("follows the registry's flag, not the row", () => {
      expect(gameSeo({ ...entry, indexable: false }, french).indexable).toBe(false)
      expect(gameSeo({ ...entry, game: { ...entry.game, descriptions: {} } }, null).indexable).toBe(true)
    })

    it("is what the registry knows when the Studio has no game for it: its figures, no text, no picture, no credit", () => {
      const registry = registryGame("courtisans", { name: "Courtisans", live: true, indexable: true, players: { min: 2, max: 5 }, duration: { min: 30, max: 30 } })
      const unknown = catalogEntry("courtisans", { live: true, indexable: true, game: registryRow(registry) })
      expect(gameSeo(unknown, null)).toEqual({
        slug: "courtisans",
        name: "Courtisans",
        indexable: true,
        live: true,
        description: null,
        image: null,
        players: { min: 2, max: 5 },
        minutes: 30,
        age: null,
        creators: [],
        publishers: [],
      })
    })

    it("leaves out a duration that is a range, which has no place in `timeRequired`", () => {
      const registry = registryGame("courtisans", { live: true, duration: { min: 30, max: 45 } })
      expect(gameSeo(catalogEntry("courtisans", { live: true, game: registryRow(registry) }), null).minutes).toBeNull()
    })
  })
})

describe("playTitle, playLead and playLine", () => {
  const lead = "Play The Mind online with friends or rivals."

  it("name the page by the phrase \"Play <name> Online\"", () => {
    expect(playTitle("The Mind")).toBe("Play The Mind Online")
    expect(playTitle("6 nimmt!")).toBe("Play 6 nimmt! Online")
  })

  it("open the description with a sentence that starts with the phrase, for a game that can be played", () => {
    expect(playLead({ name: "The Mind", live: true })).toBe(lead)
  })

  it("say in the description that a game that cannot be played yet is coming soon, rather than promise a table", () => {
    expect(playLead({ name: "The Mind", live: false })).toBe("Play The Mind online, coming soon.")
  })

  it("end every page with one line that starts with the phrase and says with whom, for how many players and where", () => {
    expect(playLine({ name: "The Mind", players: { min: 2, max: 4 } })).toBe("Play The Mind online with friends or rivals, for 2 to 4 players, in your browser.")
  })

  it("says how many play the way a sentence does: a range, a minimum, one number", () => {
    const line = (players: GameSeo["players"]) => playLine({ name: "The Mind", players })
    expect(line({ min: 3, max: null })).toBe("Play The Mind online with friends or rivals, for 3 or more players, in your browser.")
    expect(line({ min: 2, max: 2 })).toBe("Play The Mind online with friends or rivals, for 2 players, in your browser.")
    expect(line({ min: 1, max: 1 })).toBe("Play The Mind online with friends or rivals, for 1 player, in your browser.")
  })

  it("is shorter, never wrong, when the game's players are not known", () => {
    expect(playLine({ name: "The Mind", players: null })).toBe("Play The Mind online with friends or rivals, in your browser.")
  })

  it.each(["Courtisans", "Flip 7", "Welcome to ...", "It's a Wonderful World", "6 nimmt! 30 Jahre-Edition"])("start with the phrase, whatever the name: %s", (name) => {
    expect(playTitle(name)).toBe(`Play ${name} Online`)
    expect(playLine({ name, players: { min: 2, max: 5 } }).startsWith(`Play ${name} online`)).toBe(true)
    for (const live of [true, false]) expect(playLead({ name, live }).startsWith(`Play ${name} online`)).toBe(true)
  })
})

describe("gameMetadata", () => {
  it("is the page's title, description, canonical, robots, Open Graph and Twitter card", () => {
    expect(gameMetadata(seo(), site)).toEqual({
      title: "Play The Mind Online",
      description: "Play The Mind online with friends or rivals. A cooperative game of silence.",
      alternates: { canonical: `${SITE}/game/the-mind` },
      robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
      openGraph: {
        type: "website",
        siteName: "Play Board Games Online",
        url: `${SITE}/game/the-mind`,
        title: "Play The Mind Online · Play Board Games Online",
        description: "Play The Mind online with friends or rivals. A cooperative game of silence.",
        locale: "en_US",
        images: [{ url: `${SITE}/api/catalog/the-mind/background?v=abc` }],
      },
      twitter: {
        card: "summary_large_image",
        title: "Play The Mind Online · Play Board Games Online",
        description: "Play The Mind online with friends or rivals. A cooperative game of silence.",
        images: [`${SITE}/api/catalog/the-mind/background?v=abc`],
      },
    })
  })

  it("is found by the phrase: the title is \"Play <name> Online\" and the description starts with the lead", () => {
    const metadata = gameMetadata(seo(), site)
    expect(metadata.title).toBe("Play The Mind Online")
    expect(String(metadata.description).startsWith("Play The Mind online with friends or rivals. ")).toBe(true)
  })

  it("says that a game that is not live is coming soon, and promises no table", () => {
    const metadata = gameMetadata(seo({ live: false }), site)
    expect(metadata.title).toBe("Play The Mind Online")
    expect(metadata.description).toBe("Play The Mind online, coming soon. A cooperative game of silence.")
    expect(metadata.openGraph?.description).toBe(metadata.description)
  })

  it("describes a game with no text of its own by the lead alone, so that every page has a description", () => {
    const metadata = gameMetadata(bare(), site)
    expect(metadata.description).toBe("Play The Mind online with friends or rivals.")
    expect(metadata.openGraph?.description).toBe(metadata.description)
    expect(metadata.twitter?.description).toBe(metadata.description)
    expect(gameMetadata(bare({ live: false }), site).description).toBe("Play The Mind online, coming soon.")
  })

  it("puts the description on one line and cuts it where a search result would, the lead staying at its start", () => {
    expect(gameMetadata(seo({ description: { text: "One.\n\nTwo.", language: "en" } }), site).description).toBe("Play The Mind online with friends or rivals. One. Two.")
    const long = gameMetadata(seo({ description: { text: "word ".repeat(100), language: "en" } }), site)
    expect([...String(long.description)].length).toBeLessThanOrEqual(160)
    expect(String(long.description).startsWith("Play The Mind online with friends or rivals. word")).toBe(true)
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

  it("has no locale or picture key when the game has none: they would wipe the layout's ones", () => {
    const metadata = gameMetadata(bare(), site)
    expect(metadata.openGraph).not.toHaveProperty("locale")
    expect(metadata.openGraph).not.toHaveProperty("images")
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

  it("makes the designers and the solo designers its authors, and everyone else credited a contributor", () => {
    const creators = [
      { name: "Designer", roles: ["designer"] },
      { name: "Solo", roles: ["soloDesigner"] },
      { name: "Both", roles: ["designer", "artist"] },
      { name: "Artist", roles: ["artist"] },
      { name: "Developer", roles: ["developer"] },
    ] satisfies GameSeo["creators"]
    const data = gameJsonLd(seo({ creators }), SITE)
    expect(data.author).toEqual(["Designer", "Solo", "Both"].map((name) => ({ "@type": "Person", name })))
    expect(data.contributor).toEqual(["Artist", "Developer"].map((name) => ({ "@type": "Person", name })))
  })

  it("has no contributor when everybody credited designed the game, and no author when nobody did", () => {
    expect(gameJsonLd(seo({ creators: [{ name: "A", roles: ["designer", "artist"] }] }), SITE)).not.toHaveProperty("contributor")
    expect(gameJsonLd(seo({ creators: [{ name: "B", roles: ["artist"] }] }), SITE)).not.toHaveProperty("author")
  })

  it("keeps an address that is already whole, a picture of the image CDN, as it is", () => {
    expect(gameJsonLd(seo({ image: { url: cdn("background-1x1.png"), wide: true } }), SITE).image).toBe(cdn("background-1x1.png"))
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
  const entries = [
    catalogEntry("courtisans", { live: true, indexable: true, game: { updatedAt: "2026-10-26T09:00:00.000Z" } }),
    catalogEntry("flip-7", { live: true, indexable: false }),
    catalogEntry("the-mind", { game: { descriptions: { fr: "Un jeu de silence." }, updatedAt: "2026-10-22T10:30:00.000Z" } }),
    catalogEntry("bang", { game: { descriptions: {} } }),
  ]
  const urls = (items: ReturnType<typeof sitemapItems>) => items.map((item) => item.url)

  it("lists the hub and its list of games, then the hub page of every indexable game of the catalog", () => {
    expect(urls(sitemapItems(SITE, entries))).toEqual([SITE, `${SITE}/games`, `${SITE}/game/courtisans`, `${SITE}/game/the-mind`])
  })

  it("lists exactly the hub pages that do not say `noindex`", () => {
    const listed = urls(sitemapItems(SITE, entries))
    for (const entry of entries) expect(listed.includes(`${SITE}/game/${entry.slug}`)).toBe(isIndexable(entry))
  })

  it("lists no address of a game of its own: `/<slug>` shows the hub page, whose canonical is `/game/<slug>`", () => {
    const listed = urls(sitemapItems(SITE, entries))
    for (const entry of entries) expect(listed).not.toContain(`${SITE}/${entry.slug}`)
  })

  it("is the hub and its list of games alone when the catalog has nothing", () => {
    expect(urls(sitemapItems(SITE, []))).toEqual([SITE, `${SITE}/games`])
  })

  it("dates the page of a game with the last edit of its game in the Studio, a game to come's and a live game's", () => {
    const items = sitemapItems(SITE, entries)
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

  it("leaves the date out when the last edit does not read as one, and for a live game with no game in the Studio, which has none", () => {
    const registered = registryRow(registryGame("courtisans", { live: true, indexable: true }))
    const undated = sitemapItems(SITE, [
      catalogEntry("the-mind", { game: { descriptions: { fr: "Un jeu." }, updatedAt: "not a date" } }),
      catalogEntry("courtisans", { live: true, indexable: true, game: registered }),
    ]).slice(2) // the hub and its list of games come first
    expect(undated).toStrictEqual([
      { url: `${SITE}/game/the-mind`, changeFrequency: "monthly", priority: 0.6 },
      { url: `${SITE}/game/courtisans`, changeFrequency: "weekly", priority: 0.8 },
    ])
  })
})
