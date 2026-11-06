import { describe, expect, it } from "vitest"
import { CREATOR_ROLES } from "@pbgo/studio-kit/constants"
import { ART_SLOTS, BGG_SITE, RELATED_MAX, UNLISTED_SLUGS, bggIconUrl, bggUrl, buildCatalog, cardPicture, cardPictureUrl, compareGames, creditLines, expansionsOf, iconVersion, pickLocalized, pictureRatio, pictureUrl, publisherIconUrl, registryRow, releaseYear, sharePicture } from "./catalog"
import { catalogGame, cdn, registryGame } from "./testing"

const slugs = (entries: { slug: string }[]) => entries.map((entry) => entry.slug)

describe("registryRow", () => {
  it("is what the registry knows of a game and nothing else: a name, its players, its duration, no picture and no text", () => {
    const row = registryRow(registryGame("courtisans", { name: "Courtisans", live: true, players: { min: 2, max: 5 }, duration: { min: 30, max: 30 } }))
    expect(row).toEqual(catalogGame("courtisans", { name: "Courtisans", players: { min: 2, max: 5 }, duration: 30 }))
  })

  it("has no duration when the registry's is a range: no figure is invented", () => {
    expect(registryRow(registryGame("skyjo", { duration: { min: 20, max: 40 } })).duration).toBeNull()
    expect(registryRow(registryGame("skyjo", { duration: { min: 20, max: 20 } })).duration).toBe(20)
  })

  it("has no players and no duration for a game the registry knows neither of", () => {
    const row = registryRow(registryGame("skyjo"))
    expect([row.players, row.duration]).toEqual([null, null])
  })

  it("has no picture, so none is asked for: a plain frame, nothing else", () => {
    const row = registryRow(registryGame("courtisans"))
    expect(row.pictures).toEqual({ logo: null, icon: null, background: null, cover: null })
    expect(ART_SLOTS.map((slot) => pictureUrl(row, slot))).toEqual([null, null, null, null])
    expect(cardPictureUrl(row)).toBeNull()
    expect(cardPicture(row)).toBeNull()
    expect(sharePicture(row)).toBeNull()
  })

  it("has no game of the Studio to point to: no date of edit, no order, no link, nobody credited", () => {
    expect(registryRow(registryGame("courtisans"))).toMatchObject({ updatedAt: "", order: null, related: [], creators: [], publishers: [] })
  })
})

describe("buildCatalog", () => {
  it("lists the live games of the registry, in registry order, before the others", () => {
    const registry = [registryGame("skyjo"), registryGame("courtisans", { live: true }), registryGame("trio", { live: true })]
    const entries = buildCatalog(registry, [catalogGame("the-mind")])
    expect(entries.map((entry) => [entry.slug, entry.live])).toEqual([
      ["courtisans", true],
      ["trio", true],
      ["the-mind", false],
    ])
  })

  it("is the live games alone, from the registry, when the Studio gave nothing", () => {
    const registry = [registryGame("courtisans", { name: "Courtisans", live: true }), registryGame("hanabi"), registryGame("template", { live: true })]
    const entries = buildCatalog(registry, [])
    expect(slugs(entries)).toEqual(["courtisans"])
    expect(entries[0]?.game).toEqual(registryRow(registry[0]!))
  })

  it("lists the other games of the registry too, by name, when asked, after the others and in registry order", () => {
    const registry = [
      registryGame("hanabi", { name: "Hanabi", players: { min: 2, max: 5 } }),
      registryGame("courtisans", { name: "Courtisans", live: true }),
      registryGame("template", { live: true }),
      registryGame("skyjo", { name: "Skyjo" }),
      registryGame("template-two"),
    ]
    const entries = buildCatalog(registry, [catalogGame("skyjo"), catalogGame("bang")], { registryGames: true })
    expect(entries.map((entry) => [entry.slug, entry.live])).toEqual([
      ["courtisans", true],
      ["bang", false],
      ["skyjo", false],
      ["hanabi", false],
      ["template-two", false],
    ])
    // A game of the Studio keeps it, one without gets what the registry knows of it, and none of them can be played
    expect(entries.find((entry) => entry.slug === "skyjo")?.game).toEqual(catalogGame("skyjo"))
    expect(entries.find((entry) => entry.slug === "hanabi")?.game).toEqual(registryRow(registry[0]!))
    expect(entries.filter((entry) => entry.slug !== "courtisans").every((entry) => !entry.live)).toBe(true)
  })

  it("never lists those games unless it is asked to", () => {
    const registry = [registryGame("courtisans", { live: true }), registryGame("hanabi"), registryGame("skyjo")]
    expect(slugs(buildCatalog(registry, []))).toEqual(["courtisans"])
    expect(slugs(buildCatalog(registry, [], { registryGames: false }))).toEqual(["courtisans"])
    expect(slugs(buildCatalog(registry, [catalogGame("bang")]))).toEqual(["courtisans", "bang"])
  })

  it("gives a live game its game of the Studio, and the Studio's name with it", () => {
    const row = catalogGame("courtisans", { name: "Courtisans (Studio)", descriptions: { en: "A game of intrigue." }, pictures: { logo: cdn("a-1x1.png"), icon: null, background: cdn("b-1x1.png"), cover: cdn("c-1x1.png") } })
    const entries = buildCatalog([registryGame("courtisans", { name: "Courtisans", live: true, indexable: true })], [row])
    expect(entries).toEqual([{ slug: "courtisans", live: true, indexable: true, game: row, related: [] }])
  })

  it("gives a live game that the Studio has no game for what the registry knows of it, and still lists the others", () => {
    const courtisans = registryGame("courtisans", { name: "Courtisans", live: true, players: { min: 2, max: 5 } })
    const entries = buildCatalog([courtisans], [catalogGame("bang")])
    expect(slugs(entries)).toEqual(["courtisans", "bang"])
    expect(entries[0]).toEqual({ slug: "courtisans", live: true, indexable: false, game: registryRow(courtisans), related: [] })
  })

  it("takes live and indexable from the registry, whatever the game of the Studio says", () => {
    const registry = [registryGame("courtisans", { live: true, indexable: true }), registryGame("hanabi", { indexable: true }), registryGame("skyjo")]
    const entries = buildCatalog(registry, [catalogGame("courtisans"), catalogGame("hanabi"), catalogGame("skyjo"), catalogGame("bang")])
    expect(entries.map((entry) => [entry.slug, entry.live, entry.indexable])).toEqual([
      ["courtisans", true, true],
      ["bang", false, false],
      ["hanabi", false, true],
      ["skyjo", false, false],
    ])
  })

  it("gives a registry game that is not live its game of the Studio, and the Studio's name with it", () => {
    const hanabi = catalogGame("hanabi", { name: "Hanabi (Studio)" })
    const entries = buildCatalog([registryGame("hanabi", { name: "Hanabi" })], [hanabi])
    expect(entries).toEqual([{ slug: "hanabi", live: false, indexable: false, game: hanabi, related: [] }])
  })

  it("does not list a game that is not live and has no game in the Studio", () => {
    expect(buildCatalog([registryGame("hanabi"), registryGame("skyjo")], [catalogGame("skyjo")]).map((entry) => entry.slug)).toEqual(["skyjo"])
  })

  it("lists a game of the Studio the registry does not know", () => {
    const entries = buildCatalog([registryGame("courtisans", { live: true })], [catalogGame("bang"), catalogGame("hellapagos")])
    expect(slugs(entries)).toEqual(["courtisans", "bang", "hellapagos"])
    expect(entries.map((entry) => entry.live)).toEqual([true, false, false])
  })

  it("never lists the template, live or in the Studio", () => {
    expect(UNLISTED_SLUGS.has("template")).toBe(true)
    const registry = [registryGame("template", { live: true }), registryGame("courtisans", { live: true })]
    expect(slugs(buildCatalog(registry, [catalogGame("template"), catalogGame("bang")]))).toEqual(["courtisans", "bang"])
  })

  it("sorts the games to come by name, whatever the order the Studio gave them in", () => {
    const planned = [catalogGame("skyjo", { name: "Skyjo" }), catalogGame("bang", { name: "Bang" }), catalogGame("hanabi", { name: "Hanabi" })]
    expect(slugs(buildCatalog([], planned))).toEqual(["bang", "hanabi", "skyjo"])
  })

  it("keeps the live games in registry order, not by name", () => {
    const registry = [registryGame("trio", { live: true }), registryGame("courtisans", { live: true })]
    expect(slugs(buildCatalog(registry, [catalogGame("bang"), catalogGame("amen")]))).toEqual(["trio", "courtisans", "amen", "bang"])
  })

  it("sorts the games to come by their order in the Studio, lowest first, and by name where the order leaves them tied", () => {
    const planned = [
      catalogGame("skyjo", { name: "Skyjo", order: 20 }),
      catalogGame("bang", { name: "Bang" }),
      catalogGame("hanabi", { name: "Hanabi", order: 10 }),
      catalogGame("amen", { name: "Amen" }),
      catalogGame("zoo", { name: "Zoo", order: 20 }),
    ]
    expect(slugs(buildCatalog([], planned))).toEqual(["hanabi", "skyjo", "zoo", "amen", "bang"])
  })

  it("keeps a live game where the registry puts it, however high its order would send it: a live game needs none", () => {
    const registry = [registryGame("trio", { live: true }), registryGame("courtisans", { live: true })]
    const rows = [catalogGame("bang", { order: 20 }), catalogGame("trio", { order: 900 }), catalogGame("courtisans", { order: 1 })]
    const entries = buildCatalog(registry, rows)
    expect(slugs(entries)).toEqual(["trio", "courtisans", "bang"])
    expect(entries.map((entry) => entry.live)).toEqual([true, true, false])
    // The order still travels with the game, a live game's too
    expect(entries[1]?.game.order).toBe(1)
  })

  it("does not reorder or change the lists it is given", () => {
    const registry = [registryGame("courtisans", { live: true })]
    const planned = [catalogGame("b", { order: 20 }), catalogGame("a", { order: 10 })]
    buildCatalog(registry, planned)
    expect(slugs(planned)).toEqual(["b", "a"])
    expect(slugs(registry)).toEqual(["courtisans"])
  })
})

describe("buildCatalog: the related games", () => {
  const relatedOf = (entries: { slug: string; related: string[] }[]) => Object.fromEntries(entries.map((entry) => [entry.slug, entry.related]))

  it("makes a link go both ways: a game that another one names names it back", () => {
    const planned = [catalogGame("skyjo", { name: "Skyjo", related: ["skyjo-action"] }), catalogGame("skyjo-action", { name: "Skyjo Action" })]
    expect(relatedOf(buildCatalog([], planned))).toEqual({ skyjo: ["skyjo-action"], "skyjo-action": ["skyjo"] })
  })

  it("lists the related games in the order of the catalog, not in the order the game lists them in", () => {
    const planned = [
      catalogGame("king-of-tokyo", { name: "King of Tokyo", related: ["power-up", "king-of-new-york"] }),
      catalogGame("power-up", { name: "Power Up" }),
      catalogGame("king-of-new-york", { name: "King of New York" }),
    ]
    expect(relatedOf(buildCatalog([], planned))["king-of-tokyo"]).toEqual(["king-of-new-york", "power-up"])
  })

  it("counts a live game like any other: another game can name it, and the links of its own game count", () => {
    const registry = [registryGame("courtisans", { live: true })]
    const rows = [catalogGame("courtisans", { related: ["the-mind"] }), catalogGame("the-mind", { name: "The Mind" }), catalogGame("bang", { name: "Bang", related: ["courtisans"] })]
    const entries = buildCatalog(registry, rows)
    expect(slugs(entries)).toEqual(["courtisans", "bang", "the-mind"])
    expect(relatedOf(entries)).toEqual({ courtisans: ["bang", "the-mind"], bang: ["courtisans"], "the-mind": ["courtisans"] })
  })

  it("links a live game that the Studio has no game for to the games that name it", () => {
    const entries = buildCatalog([registryGame("courtisans", { live: true })], [catalogGame("bang", { related: ["courtisans"] })])
    expect(relatedOf(entries)).toEqual({ courtisans: ["bang"], bang: ["courtisans"] })
  })

  it("only names games that are listed: not the template, a game of the registry with no game in the Studio, nor a slug nobody has", () => {
    const registry = [registryGame("courtisans", { live: true }), registryGame("template", { live: true }), registryGame("hanabi")]
    const planned = [catalogGame("bang", { related: ["template", "hanabi", "ghost", "courtisans"] }), catalogGame("template", { related: ["bang"] })]
    expect(relatedOf(buildCatalog(registry, planned))).toEqual({ courtisans: ["bang"], bang: ["courtisans"] })
  })

  it("never relates a game to itself, and names a game once whichever sides say so", () => {
    const planned = [catalogGame("a", { name: "A", related: ["a", "b", "b"] }), catalogGame("b", { name: "B", related: ["a"] })]
    expect(relatedOf(buildCatalog([], planned))).toEqual({ a: ["b"], b: ["a"] })
  })

  it("gives a game that nothing links an empty list", () => {
    expect(relatedOf(buildCatalog([registryGame("courtisans", { live: true })], [catalogGame("bang")]))).toEqual({ courtisans: [], bang: [] })
  })

  it("leaves the games it is given as they are: the link of a game stays on its own side", () => {
    const planned = [catalogGame("a", { name: "A", related: ["b"] }), catalogGame("b", { name: "B" })]
    const entries = buildCatalog([], planned)
    expect(planned.map((game) => game.related)).toEqual([["b"], []])
    expect(entries.map((entry) => entry.game)).toEqual(planned)
  })

  describe("after the family, the games that look like it", () => {
    const rows = [
      catalogGame("skyjo", { name: "Skyjo", categories: ["Cards", "Family"], related: ["skyjo-action"] }),
      catalogGame("skyjo-action", { name: "Skyjo Action" }),
      catalogGame("bang", { name: "Bang", categories: ["Cards", "Family"] }),
      catalogGame("the-mind", { name: "The Mind", categories: ["Cooperative", "Cards"] }),
      catalogGame("catan", { name: "Catan", categories: ["Strategy"] }),
    ]

    it("lists the games that share categories with it, the likeliest first, and leaves out the others", () => {
      expect(relatedOf(buildCatalog([], rows)).skyjo).toEqual(["skyjo-action", "bang", "the-mind"])
    })

    it("recommends too the games that its players also play, when that is known", () => {
      const alsoPlayed = new Map([["skyjo", new Map([["catan", 4]])]])
      expect(relatedOf(buildCatalog([], rows, { alsoPlayed })).skyjo).toEqual(["skyjo-action", "bang", "catan", "the-mind"])
    })

    it("recommends at most `RELATED_MAX` games, the family first", () => {
      const crowd = Array.from({ length: 20 }, (_, index) => catalogGame(`game-${String(index).padStart(2, "0")}`, { name: `Game ${String(index).padStart(2, "0")}`, categories: ["Cards"] }))
      const list = relatedOf(buildCatalog([], [catalogGame("home", { name: "Zzz", categories: ["Cards"], related: ["game-19"] }), ...crowd])).home ?? []
      expect(list).toHaveLength(RELATED_MAX)
      expect(list[0]).toBe("game-19")
    })
  })
})

describe("compareGames", () => {
  const order = (...games: ReturnType<typeof catalogGame>[]) => [...games].sort(compareGames).map((game) => game.slug)

  it("puts the lowest order first", () => {
    expect(order(catalogGame("c", { order: 30 }), catalogGame("a", { order: 10 }), catalogGame("b", { order: 20 }))).toEqual(["a", "b", "c"])
  })

  it("puts a game with no order after the games that have one, whatever its name", () => {
    expect(order(catalogGame("a", { name: "A" }), catalogGame("z", { name: "Z", order: 900 }))).toEqual(["z", "a"])
  })

  it("puts the order 0 first: it is an order like any other", () => {
    expect(order(catalogGame("b", { order: 1 }), catalogGame("a", { order: 0 }))).toEqual(["a", "b"])
  })

  it("sorts the games that tie by name, case and accents aside, numbers in their order", () => {
    expect(order(catalogGame("e", { name: "été" }), catalogGame("d", { name: "Zeta" }), catalogGame("a", { name: "Éclair" }), catalogGame("n", { name: "10 nimmt!" }), catalogGame("t", { name: "2 nimmt!" }))).toEqual(["t", "n", "a", "e", "d"])
    expect(order(catalogGame("b", { name: "Bang", order: 5 }), catalogGame("a", { name: "Amen", order: 5 }))).toEqual(["a", "b"])
  })

  it("keeps the names that differ only by case or accents in the order they came in", () => {
    expect(order(catalogGame("first", { name: "Echecs" }), catalogGame("second", { name: "échecs" }))).toEqual(["first", "second"])
  })
})

describe("bggUrl", () => {
  it("is the page of the game on BoardGameGeek, from its id", () => {
    expect(bggUrl(catalogGame("hanabi", { bggId: 98778 }))).toBe("https://boardgamegeek.com/boardgame/98778")
  })

  it("is null for a game that has no id there: no search is made up in its place", () => {
    expect(bggUrl(catalogGame("omens"))).toBeNull()
  })
})

describe("bggIconUrl", () => {
  it("is the address on this site of BoardGameGeek's icon, named by the game and carrying the version of BoardGameGeek's website", () => {
    expect(bggIconUrl(catalogGame("hanabi", { bggId: 98778 }))).toBe(`/api/catalog/hanabi/bgg?v=${iconVersion(BGG_SITE)}`)
  })

  it("is null for a game that has no page there to link to", () => {
    expect(bggIconUrl(catalogGame("omens"))).toBeNull()
  })
})

describe("releaseYear", () => {
  it.each([
    ["2024-03-15", "2024"],
    ["2010-01-01", "2010"],
    ["1999-12-31", "1999"],
  ])("is the year of %s: %s, whatever the day, which may only be the first of the month or of the year", (releaseDate, year) => {
    expect(releaseYear(catalogGame("a", { releaseDate }))).toBe(year)
  })

  it("is null for a game that has no date", () => {
    expect(releaseYear(catalogGame("a"))).toBeNull()
  })
})

describe("expansionsOf", () => {
  const expansion = (slug: string, base: string, name: string) => ({ slug, name, base, descriptions: {}, playersMin: null, playersMax: null, duration: null, age: null, complexity: null, categories: [], pictures: { cover: null, boxFront: null } })

  it("picks the expansions whose base game it is, by name: an expansion has no order in the Studio", () => {
    const all = [expansion("b-more", "courtisans", "B"), expansion("flip-more", "flip-7", "More"), expansion("c-more", "courtisans", "C"), expansion("a-more", "courtisans", "A")]
    expect(expansionsOf(all, "courtisans").map((one) => one.slug)).toEqual(["a-more", "b-more", "c-more"])
  })

  it("puts the names in the order a reader expects: case and accents aside, numbers in their order", () => {
    const all = [expansion("ten", "g", "Extension 10"), expansion("two", "g", "Extension 2"), expansion("accent", "g", "Écho"), expansion("plain", "g", "Echo 2"), expansion("last", "g", "Zèbre")]
    expect(expansionsOf(all, "g").map((one) => one.slug)).toEqual(["accent", "plain", "two", "ten", "last"])
  })

  it("is none for a game that has none, and does not change what it is given", () => {
    const all = [expansion("flip-more", "flip-7", "More")]
    expect(expansionsOf(all, "courtisans")).toEqual([])
    expect(all.map((one) => one.slug)).toEqual(["flip-more"])
  })
})

describe("pictureUrl", () => {
  const game = catalogGame("love-letter", {
    pictures: { logo: cdn("logo-1600x476.webp"), icon: cdn("icon-512x512.png"), background: cdn("background-2400x1350.jpg"), cover: cdn("cover-640x480.webp") },
  })

  it("is the file in the image CDN, with the width the picture is drawn at and the format the browser takes", () => {
    expect(pictureUrl(game, "logo")).toBe(`${cdn("logo-1600x476.webp")}?w=800&fit=max&auto=format`)
    expect(pictureUrl(game, "icon")).toBe(`${cdn("icon-512x512.png")}?w=512&fit=max&auto=format`)
    expect(pictureUrl(game, "background")).toBe(`${cdn("background-2400x1350.jpg")}?w=1200&fit=max&auto=format`)
    expect(pictureUrl(game, "cover")).toBe(`${cdn("cover-640x480.webp")}?w=1200&fit=max&auto=format`)
  })

  it("has four pictures for a game: the logo, the icon, the background and the cover", () => {
    expect([...ART_SLOTS]).toEqual(["logo", "icon", "background", "cover"])
  })

  it("asks the CDN for the width it is given: a small tile asks for less than the page does", () => {
    expect(pictureUrl(game, "background", 480)).toBe(`${cdn("background-2400x1350.jpg")}?w=480&fit=max&auto=format`)
    expect(pictureUrl(catalogGame("hanabi", { pictures: { logo: cdn("logo-100x30.svg"), icon: null, background: null, cover: null } }), "logo", 320)).toBe(cdn("logo-100x30.svg"))
  })

  it("is the file as it is for a vector picture: the CDN does not resize an SVG", () => {
    const vector = catalogGame("hanabi", { pictures: { logo: cdn("logo-100x30.svg"), icon: null, background: null, cover: null } })
    expect(pictureUrl(vector, "logo")).toBe(cdn("logo-100x30.svg"))
  })

  it("is null for a picture the game does not have: no fallback, the page draws a plain frame", () => {
    expect(pictureUrl(catalogGame("omens"), "icon")).toBeNull()
    expect(ART_SLOTS.map((slot) => pictureUrl(catalogGame("omens"), slot))).toEqual([null, null, null, null])
  })

  it("sizes the cover and the box front of an expansion the same way: its cover across a frame, the box smaller, and null for the one it does not have", () => {
    const expansion = { pictures: { cover: cdn("cover-2400x1350.jpg"), boxFront: null } }
    expect(pictureUrl(expansion, "cover")).toBe(`${cdn("cover-2400x1350.jpg")}?w=1200&fit=max&auto=format`)
    expect(pictureUrl(expansion, "cover", 480)).toBe(`${cdn("cover-2400x1350.jpg")}?w=480&fit=max&auto=format`)
    expect(pictureUrl(expansion, "boxFront")).toBeNull()
    expect(pictureUrl({ pictures: { cover: null, boxFront: cdn("box-800x800.png") } }, "boxFront")).toBe(`${cdn("box-800x800.png")}?w=600&fit=max&auto=format`)
    expect(pictureUrl({ pictures: { cover: cdn("cover.svg"), boxFront: null } }, "cover")).toBe(cdn("cover.svg"))
  })

  it("never points anywhere but at the image CDN of a project", () => {
    for (const slot of ART_SLOTS) expect(pictureUrl(game, slot)).toMatch(/^https:\/\/cdn\.sanity\.io\/images\//)
  })
})

describe("pictureRatio", () => {
  it("is the width over the height that the CDN puts in the name of a file, so that a frame has the picture's shape before it arrives", () => {
    expect(pictureRatio(cdn("cover-1600x900.jpg"))).toBeCloseTo(16 / 9)
    expect(pictureRatio(cdn("box-800x800.png"))).toBe(1)
    expect(pictureRatio(cdn("box-600x800.webp"))).toBe(0.75)
  })

  it("reads the size of an address that was sized (`?w=…`) and of a vector picture as well", () => {
    expect(pictureRatio(`${cdn("cover-1600x900.jpg")}?w=480&fit=max&auto=format`)).toBeCloseTo(16 / 9)
    expect(pictureRatio(cdn("logo-100x30.svg"))).toBeCloseTo(10 / 3)
  })

  it("is null for no picture, for an address with no size and for a size that makes no shape", () => {
    expect(pictureRatio(null)).toBeNull()
    expect(pictureRatio(cdn("cover.jpg"))).toBeNull()
    expect(pictureRatio("https://example.com/box.png")).toBeNull()
    expect(pictureRatio(cdn("box-0x800.png"))).toBeNull()
    expect(pictureRatio(cdn("box-800x0.png"))).toBeNull()
  })
})

/** A game with the pictures it is told, and no other. */
const gameWith = (pictures: Partial<Record<(typeof ART_SLOTS)[number], string>>) =>
  catalogGame("skyjo", { pictures: { logo: pictures.logo ?? null, icon: pictures.icon ?? null, background: pictures.background ?? null, cover: pictures.cover ?? null } })

describe("cardPictureUrl", () => {
  const game = gameWith
  const [logo, icon, background, cover] = [cdn("logo-1x1.png"), cdn("icon-1x1.png"), cdn("background-1x1.png"), cdn("cover-640x480.webp")]

  it("is the logo when the game has one, whatever else it has", () => {
    expect(cardPictureUrl(game({ logo, icon, background, cover }))).toBe(pictureUrl(game({ logo }), "logo"))
  })

  it("is the icon when the game has no logo", () => {
    expect(cardPictureUrl(game({ icon, background, cover }))).toBe(pictureUrl(game({ icon }), "icon"))
  })

  it("is null with neither: a background or a cover is no mark of the game", () => {
    expect(cardPictureUrl(game({ background, cover }))).toBeNull()
    expect(cardPictureUrl(game({}))).toBeNull()
  })
})

describe("cardPicture", () => {
  const game = gameWith
  const [logo, icon, background, cover] = [cdn("logo-1x1.png"), cdn("icon-1x1.png"), cdn("background-1x1.png"), cdn("cover-640x480.webp")]

  it("is the cover, which fills the frame, when the game has one, whatever else it has", () => {
    expect(cardPicture(game({ logo, icon, background, cover }))).toEqual({ url: pictureUrl(game({ cover }), "cover"), fills: true })
  })

  it("is the background alone, which fills the frame too, when the game has no cover: its logo is not laid over it", () => {
    expect(cardPicture(game({ logo, icon, background }))).toEqual({ url: pictureUrl(game({ background }), "background"), fills: true })
  })

  it("is the cover of a game that has nothing else", () => {
    expect(cardPicture(game({ cover }))).toEqual({ url: pictureUrl(game({ cover }), "cover"), fills: true })
  })

  it("is the logo, which sits on the plain frame and does not fill it, when the game has neither a cover nor a background", () => {
    expect(cardPicture(game({ logo, icon }))).toEqual({ url: pictureUrl(game({ logo }), "logo"), fills: false })
  })

  it("is the icon, on the plain frame, with no logo either", () => {
    expect(cardPicture(game({ icon }))).toEqual({ url: pictureUrl(game({ icon }), "icon"), fills: false })
  })

  it("is null with no picture at all: the card is a plain frame, no placeholder", () => {
    expect(cardPicture(game({}))).toBeNull()
  })

  it("is an address sized for the page, in the image CDN, as every picture of a game is", () => {
    expect(cardPicture(game({ cover }))?.url).toBe(`${cover}?w=1200&fit=max&auto=format`)
    expect(cardPicture(game({ logo }))?.url).toBe(`${logo}?w=800&fit=max&auto=format`)
  })
})

describe("sharePicture", () => {
  const game = gameWith
  const [logo, icon, background] = [cdn("logo-1x1.png"), cdn("icon-1x1.png"), cdn("background-1x1.png")]

  it("is the background when the game has one, which is wide, whatever else it has", () => {
    expect(sharePicture(game({ logo, icon, background }))).toEqual({ url: pictureUrl(game({ background }), "background"), wide: true })
  })

  it("is the logo when the game has no background, which is small", () => {
    expect(sharePicture(game({ logo, icon }))).toEqual({ url: pictureUrl(game({ logo }), "logo"), wide: false })
  })

  it("is the icon with neither a background nor a logo", () => {
    expect(sharePicture(game({ icon }))).toEqual({ url: pictureUrl(game({ icon }), "icon"), wide: false })
  })

  it("is null with no picture at all", () => {
    expect(sharePicture(game({}))).toBeNull()
  })

  it("is an address a crawler can fetch as it is: the whole URL of the CDN", () => {
    expect(sharePicture(game({ background }))?.url).toMatch(/^https:\/\//)
  })
})

describe("pickLocalized", () => {
  const texts = { fr: "bonjour", en: "hello", es: "hola", de: "hallo" } as const

  it("takes the visitor's language", () => {
    expect(pickLocalized(texts, "es")).toEqual({ language: "es", text: "hola" })
    expect(pickLocalized(texts, "de")).toEqual({ language: "de", text: "hallo" })
  })

  it("falls back on English, then French, then any other language", () => {
    expect(pickLocalized({ fr: "bonjour", en: "hello" }, "de")).toEqual({ language: "en", text: "hello" })
    expect(pickLocalized({ fr: "bonjour", de: "hallo" }, "es")).toEqual({ language: "fr", text: "bonjour" })
    expect(pickLocalized({ de: "hallo", es: "hola" }, "fr")).toEqual({ language: "es", text: "hola" })
    expect(pickLocalized({ de: "hallo" }, "en")).toEqual({ language: "de", text: "hallo" })
  })

  it("counts an empty text as missing", () => {
    expect(pickLocalized({ es: "", en: "hello" }, "es")).toEqual({ language: "en", text: "hello" })
  })

  it("is null when no language has a text", () => {
    expect(pickLocalized({}, "en")).toBeNull()
    expect(pickLocalized({ fr: "", en: "" }, "fr")).toBeNull()
  })
})

describe("iconVersion", () => {
  it("is the same for the same address, and another for another", () => {
    expect(iconVersion("https://www.cocktailgames.com")).toBe(iconVersion("https://www.cocktailgames.com"))
    expect(iconVersion("https://www.cocktailgames.com")).not.toBe(iconVersion("https://cocktailgames.com"))
  })

  it("is a short word that is safe in a URL", () => {
    expect(iconVersion("https://www.cocktailgames.com")).toMatch(/^[0-9a-z]{1,8}$/)
    expect(iconVersion("")).toMatch(/^[0-9a-z]{1,8}$/)
  })
})

describe("publisherIconUrl", () => {
  const game = catalogGame("hanabi", {
    publishers: [
      { name: "Cocktail Games", url: "https://www.cocktailgames.com" },
      { name: "No website", url: null },
      { name: "Third", url: "https://third.example" },
    ],
  })

  it("is the address of the icon of the publisher in that place of the game (counted from 0), with the version of its website", () => {
    expect(publisherIconUrl(game, 0)).toBe(`/api/catalog/hanabi/publisher-0?v=${iconVersion("https://www.cocktailgames.com")}`)
    expect(publisherIconUrl(game, 2)).toBe(`/api/catalog/hanabi/publisher-2?v=${iconVersion("https://third.example")}`)
  })

  it("is null for a publisher with no website and for a place the game has none in: there is nothing to take an icon from", () => {
    expect(publisherIconUrl(game, 1)).toBeNull()
    expect(publisherIconUrl(game, 3)).toBeNull()
    expect(publisherIconUrl(game, -1)).toBeNull()
  })

  it("changes when the website does, so that the page goes to a new address", () => {
    const moved = { ...game, publishers: [{ name: "Cocktail Games", url: "https://cocktail.example" }] }
    expect(publisherIconUrl(moved, 0)).not.toBe(publisherIconUrl(game, 0))
  })

  it("never holds the website: the address names a place in the game, and the server finds the website there", () => {
    expect(publisherIconUrl(game, 0)).not.toContain("cocktailgames")
  })
})

describe("creditLines", () => {
  const person = (name: string, ...roles: (typeof CREATOR_ROLES)[number]["value"][]) => ({ name, roles })

  it("is the designers, the artists and the publishers, in that order", () => {
    const lines = creditLines(catalogGame("hanabi", { creators: [person("Antoine Bauza", "designer"), person("Laura Michaud", "artist")], publishers: [{ name: "Cocktail Games", url: null }] }))
    expect(lines.map((line) => line.label)).toEqual(["Designer", "Artist", "Publisher"])
    expect(lines.map((line) => line.values.map((value) => value.text))).toEqual([["Antoine Bauza"], ["Laura Michaud"], ["Cocktail Games"]])
  })

  it("credits everybody: a line for each role somebody has, in the order of the roles, the publishers last", () => {
    const lines = creditLines(
      catalogGame("wingspan", {
        creators: [
          person("A", "insertDesigner"),
          person("B", "developer"),
          person("C", "designer"),
          person("D", "soloDesigner"),
          person("E", "graphicDesigner"),
          person("F", "editor"),
          person("G", "sculptor"),
          person("H", "writer"),
          person("I", "artist"),
        ],
        publishers: [{ name: "P", url: null }],
      }),
    )
    expect(lines.map((line) => line.label)).toEqual(["Designer", "Solo designer", "Developer", "Artist", "Graphic designer", "Editor", "Sculptor", "Writer", "Insert designer", "Publisher"])
    expect(lines.map((line) => line.values[0]?.text)).toEqual(["C", "D", "B", "I", "E", "F", "G", "H", "A", "P"])
  })

  it("has a line for every role of the Studio's list, worded from its titles", () => {
    const everyone = CREATOR_ROLES.map((role) => person(`Person ${role.value}`, role.value))
    expect(creditLines(catalogGame("x", { creators: everyone })).map((line) => line.label)).toEqual(CREATOR_ROLES.map((role) => role.title))
  })

  it("lists a person on the line of each role they have", () => {
    const lines = creditLines(catalogGame("hanabi", { creators: [person("Antoine Bauza", "designer", "artist"), person("Laura Michaud", "artist")] }))
    expect(lines.map((line) => [line.label, line.values.map((value) => value.text)])).toEqual([
      ["Designer", ["Antoine Bauza"]],
      ["Artists", ["Antoine Bauza", "Laura Michaud"]],
    ])
  })

  it("has its label in the singular for one and in the plural for more", () => {
    const lines = creditLines(
      catalogGame("skull-king", {
        creators: [person("Brent Beck", "designer"), person("Jeffrey Beck", "designer"), person("Apryl Stott", "artist"), person("Someone Else", "artist"), person("Third Person", "artist")],
        publishers: [
          { name: "A", url: null },
          { name: "B", url: null },
        ],
      }),
    )
    expect(lines.map((line) => line.label)).toEqual(["Designers", "Artists", "Publishers"])
    expect(creditLines(catalogGame("x", { creators: [person("A", "graphicDesigner"), person("B", "graphicDesigner")] }))[0]?.label).toBe("Graphic designers")
  })

  it("leaves out a line that has nobody, and is empty for a game with no credit at all", () => {
    expect(creditLines(catalogGame("hanabi", { creators: [person("Laura Michaud", "artist")] })).map((line) => line.label)).toEqual(["Artist"])
    expect(creditLines(catalogGame("hanabi"))).toEqual([])
  })

  it("makes a link of a publisher that has a website, with its icon, and only a name of one that has none", () => {
    const game = catalogGame("hanabi", {
      publishers: [
        { name: "Cocktail Games", url: "https://www.cocktailgames.com" },
        { name: "Spiral Éditions", url: null },
        { name: "Oya", url: "https://www.oya.fr" },
      ],
    })
    const [publishers] = creditLines(game)
    expect(publishers?.values).toEqual([
      { text: "Cocktail Games", href: "https://www.cocktailgames.com", icon: publisherIconUrl(game, 0) },
      { text: "Spiral Éditions" },
      // The icon is the one of its place in the game, the third, whether or not the second has a website
      { text: "Oya", href: "https://www.oya.fr", icon: publisherIconUrl(game, 2) },
    ])
    expect(publishers?.values[2]?.icon).toContain("publisher-2")
  })

  it("makes no link of a person: a name", () => {
    const [designers] = creditLines(catalogGame("hanabi", { creators: [person("Antoine Bauza", "designer")] }))
    expect(designers?.values).toEqual([{ text: "Antoine Bauza" }])
  })
})
