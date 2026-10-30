import { describe, expect, it } from "vitest"
import { ART_SLOTS, RELATED_MAX, UNLISTED_SLUGS, buildCatalog, cardPictureUrl, comparePlanned, creditLines, pickLocalized, pictureUrl, pictureVersion, publisherIconUrl, registryRow, sharePicture } from "./catalog"
import { DEVELOPMENT_OPTIONS, developmentRank, notionGame, registryGame } from "./testing"

const slugs = (entries: { slug: string }[]) => entries.map((entry) => entry.slug)

describe("registryRow", () => {
  it("is what the registry knows of a game and nothing else: a name, its players, its duration, no picture and no text", () => {
    const row = registryRow(registryGame("courtisans", { name: "Courtisans", live: true, players: { min: 2, max: 5 }, duration: { min: 30, max: 30 } }))
    expect(row).toEqual(notionGame("courtisans", { name: "Courtisans", players: { min: 2, max: 5 }, duration: 30, notionPageId: "" }))
  })

  it("has no duration when the registry's is a range: no figure is invented", () => {
    expect(registryRow(registryGame("skyjo", { duration: { min: 20, max: 40 } })).duration).toBeNull()
    expect(registryRow(registryGame("skyjo", { duration: { min: 20, max: 20 } })).duration).toBe(20)
  })

  it("has no players and no duration for a game the registry knows neither of", () => {
    const row = registryRow(registryGame("skyjo"))
    expect([row.players, row.duration]).toEqual([null, null])
  })

  it("flags no picture, so none is asked for: a plain frame, nothing else", () => {
    const row = registryRow(registryGame("courtisans"))
    expect(row.art).toEqual({ logo: false, icon: false, background: false })
    expect(ART_SLOTS.map((slot) => pictureUrl(row, slot))).toEqual([null, null, null])
    expect(cardPictureUrl(row)).toBeNull()
    expect(sharePicture(row)).toBeNull()
  })

  it("has no row to point to: no page id, no date of edit, no link", () => {
    expect(registryRow(registryGame("courtisans"))).toMatchObject({ notionPageId: "", editedAt: "", related: [] })
  })
})

describe("buildCatalog", () => {
  it("lists the live games of the registry, in registry order, before the others", () => {
    const registry = [registryGame("skyjo"), registryGame("courtisans", { live: true }), registryGame("trio", { live: true })]
    const entries = buildCatalog(registry, [notionGame("the-mind")])
    expect(entries.map((entry) => [entry.slug, entry.live])).toEqual([
      ["courtisans", true],
      ["trio", true],
      ["the-mind", false],
    ])
  })

  it("is the live games alone, from the registry, when Notion gave nothing", () => {
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
    const entries = buildCatalog(registry, [notionGame("skyjo"), notionGame("bang")], { registryGames: true })
    expect(entries.map((entry) => [entry.slug, entry.live])).toEqual([
      ["courtisans", true],
      ["bang", false],
      ["skyjo", false],
      ["hanabi", false],
      ["template-two", false],
    ])
    // A game with a row keeps its row, one without gets what the registry knows of it, and none of them can be played
    expect(entries.find((entry) => entry.slug === "skyjo")?.game).toEqual(notionGame("skyjo"))
    expect(entries.find((entry) => entry.slug === "hanabi")?.game).toEqual(registryRow(registry[0]!))
    expect(entries.filter((entry) => entry.slug !== "courtisans").every((entry) => !entry.live)).toBe(true)
  })

  it("never lists those games unless it is asked to", () => {
    const registry = [registryGame("courtisans", { live: true }), registryGame("hanabi"), registryGame("skyjo")]
    expect(slugs(buildCatalog(registry, []))).toEqual(["courtisans"])
    expect(slugs(buildCatalog(registry, [], { registryGames: false }))).toEqual(["courtisans"])
    expect(slugs(buildCatalog(registry, [notionGame("bang")]))).toEqual(["courtisans", "bang"])
  })

  it("gives a live game its Notion row, and Notion's name with it", () => {
    const row = notionGame("courtisans", { name: "Courtisans (Notion)", descriptions: { en: "A game of intrigue." }, art: { logo: true, icon: false, background: true } })
    const entries = buildCatalog([registryGame("courtisans", { name: "Courtisans", live: true, indexable: true })], [row])
    expect(entries).toEqual([{ slug: "courtisans", live: true, indexable: true, game: row, related: [] }])
  })

  it("gives a live game that Notion has no row for what the registry knows of it, and still lists the others", () => {
    const courtisans = registryGame("courtisans", { name: "Courtisans", live: true, players: { min: 2, max: 5 } })
    const entries = buildCatalog([courtisans], [notionGame("bang")])
    expect(slugs(entries)).toEqual(["courtisans", "bang"])
    expect(entries[0]).toEqual({ slug: "courtisans", live: true, indexable: false, game: registryRow(courtisans), related: [] })
  })

  it("takes live and indexable from the registry, whatever the Notion row says", () => {
    const registry = [registryGame("courtisans", { live: true, indexable: true }), registryGame("hanabi", { indexable: true }), registryGame("skyjo")]
    const entries = buildCatalog(registry, [notionGame("courtisans"), notionGame("hanabi"), notionGame("skyjo"), notionGame("bang")])
    expect(entries.map((entry) => [entry.slug, entry.live, entry.indexable])).toEqual([
      ["courtisans", true, true],
      ["bang", false, false],
      ["hanabi", false, true],
      ["skyjo", false, false],
    ])
  })

  it("gives a registry game that is not live its Notion row, and Notion's name with it", () => {
    const hanabi = notionGame("hanabi", { name: "Hanabi (Notion)" })
    const entries = buildCatalog([registryGame("hanabi", { name: "Hanabi" })], [hanabi])
    expect(entries).toEqual([{ slug: "hanabi", live: false, indexable: false, game: hanabi, related: [] }])
  })

  it("does not list a game that is not live and has no Notion row", () => {
    expect(buildCatalog([registryGame("hanabi"), registryGame("skyjo")], [notionGame("skyjo")]).map((entry) => entry.slug)).toEqual(["skyjo"])
  })

  it("lists a Notion game the registry does not know", () => {
    const entries = buildCatalog([registryGame("courtisans", { live: true })], [notionGame("bang"), notionGame("hellapagos")])
    expect(slugs(entries)).toEqual(["courtisans", "bang", "hellapagos"])
    expect(entries.map((entry) => entry.live)).toEqual([true, false, false])
  })

  it("never lists the template, live or in Notion", () => {
    expect(UNLISTED_SLUGS.has("template")).toBe(true)
    const registry = [registryGame("template", { live: true }), registryGame("courtisans", { live: true })]
    expect(slugs(buildCatalog(registry, [notionGame("template"), notionGame("bang")]))).toEqual(["courtisans", "bang"])
  })

  it("sorts the games to come by name, whatever the order Notion gave them in", () => {
    const planned = [notionGame("skyjo", { name: "Skyjo" }), notionGame("bang", { name: "Bang" }), notionGame("hanabi", { name: "Hanabi" })]
    expect(slugs(buildCatalog([], planned))).toEqual(["bang", "hanabi", "skyjo"])
  })

  it("keeps the live games in registry order, not by name", () => {
    const registry = [registryGame("trio", { live: true }), registryGame("courtisans", { live: true })]
    expect(slugs(buildCatalog(registry, [notionGame("bang"), notionGame("amen")]))).toEqual(["trio", "courtisans", "amen", "bang"])
  })

  it("sorts the games to come by their rank in the Games Development database, and by name where the rank leaves them tied", () => {
    const planned = [
      notionGame("skyjo", { name: "Skyjo", development: developmentRank({ priority: "P2 · Next", status: "Live" }) }),
      notionGame("bang", { name: "Bang" }),
      notionGame("hanabi", { name: "Hanabi", development: developmentRank({ priority: "P1 · Now", status: "Rules" }) }),
      notionGame("amen", { name: "Amen" }),
    ]
    expect(slugs(buildCatalog([], planned))).toEqual(["hanabi", "skyjo", "amen", "bang"])
  })

  it("keeps a live game where the registry puts it, however far its rank would send it: a live game needs none", () => {
    const registry = [registryGame("trio", { live: true }), registryGame("courtisans", { live: true })]
    const rows = [
      notionGame("bang", { development: developmentRank({ priority: "P2 · Next" }) }),
      notionGame("trio", { development: developmentRank({ priority: "P4 · Someday", status: "Paused" }) }),
      notionGame("courtisans", { development: developmentRank({ priority: "P1 · Now", status: "Live" }) }),
    ]
    const entries = buildCatalog(registry, rows)
    expect(slugs(entries)).toEqual(["trio", "courtisans", "bang"])
    expect(entries.map((entry) => entry.live)).toEqual([true, true, false])
    // The rank still travels with the row, a live game's too
    expect(entries[1]?.game.development.priority?.name).toBe("P1 · Now")
  })

  it("does not reorder or change the lists it is given", () => {
    const registry = [registryGame("courtisans", { live: true })]
    const planned = [notionGame("b", { development: developmentRank({ priority: "P3 · Later" }) }), notionGame("a", { development: developmentRank({ priority: "P1 · Now" }) })]
    buildCatalog(registry, planned)
    expect(slugs(planned)).toEqual(["b", "a"])
    expect(slugs(registry)).toEqual(["courtisans"])
  })
})

describe("buildCatalog: the related games", () => {
  const relatedOf = (entries: { slug: string; related: string[] }[]) => Object.fromEntries(entries.map((entry) => [entry.slug, entry.related]))

  it("makes a link go both ways: a game that another one names names it back", () => {
    const planned = [notionGame("skyjo", { name: "Skyjo", related: ["skyjo-action"] }), notionGame("skyjo-action", { name: "Skyjo Action" })]
    expect(relatedOf(buildCatalog([], planned))).toEqual({ skyjo: ["skyjo-action"], "skyjo-action": ["skyjo"] })
  })

  it("lists the related games in the order of the catalog, not in the order of the row", () => {
    const planned = [
      notionGame("king-of-tokyo", { name: "King of Tokyo", related: ["power-up", "king-of-new-york"] }),
      notionGame("power-up", { name: "Power Up" }),
      notionGame("king-of-new-york", { name: "King of New York" }),
    ]
    expect(relatedOf(buildCatalog([], planned))["king-of-tokyo"]).toEqual(["king-of-new-york", "power-up"])
  })

  it("counts a live game like any other: another row can name it, and the links of its own Notion row count", () => {
    const registry = [registryGame("courtisans", { live: true })]
    const rows = [notionGame("courtisans", { related: ["the-mind"] }), notionGame("the-mind", { name: "The Mind" }), notionGame("bang", { name: "Bang", related: ["courtisans"] })]
    const entries = buildCatalog(registry, rows)
    expect(slugs(entries)).toEqual(["courtisans", "bang", "the-mind"])
    expect(relatedOf(entries)).toEqual({ courtisans: ["bang", "the-mind"], bang: ["courtisans"], "the-mind": ["courtisans"] })
  })

  it("links a live game that Notion has no row for to the games whose rows name it", () => {
    const entries = buildCatalog([registryGame("courtisans", { live: true })], [notionGame("bang", { related: ["courtisans"] })])
    expect(relatedOf(entries)).toEqual({ courtisans: ["bang"], bang: ["courtisans"] })
  })

  it("only names games that are listed: not the template, a game of the registry with no row, nor a slug nobody has", () => {
    const registry = [registryGame("courtisans", { live: true }), registryGame("template", { live: true }), registryGame("hanabi")]
    const planned = [notionGame("bang", { related: ["template", "hanabi", "ghost", "courtisans"] }), notionGame("template", { related: ["bang"] })]
    expect(relatedOf(buildCatalog(registry, planned))).toEqual({ courtisans: ["bang"], bang: ["courtisans"] })
  })

  it("never relates a game to itself, and names a game once whichever sides say so", () => {
    const planned = [notionGame("a", { name: "A", related: ["a", "b", "b"] }), notionGame("b", { name: "B", related: ["a"] })]
    expect(relatedOf(buildCatalog([], planned))).toEqual({ a: ["b"], b: ["a"] })
  })

  it("gives a game that nothing links an empty list", () => {
    expect(relatedOf(buildCatalog([registryGame("courtisans", { live: true })], [notionGame("bang")]))).toEqual({ courtisans: [], bang: [] })
  })

  it("leaves the rows it is given as they are: the link of a row stays on its own side", () => {
    const planned = [notionGame("a", { name: "A", related: ["b"] }), notionGame("b", { name: "B" })]
    const entries = buildCatalog([], planned)
    expect(planned.map((game) => game.related)).toEqual([["b"], []])
    expect(entries.map((entry) => entry.game)).toEqual(planned)
  })

  describe("after the family, the games that look like it", () => {
    const rows = [
      notionGame("skyjo", { name: "Skyjo", categories: ["Cards", "Family"], related: ["skyjo-action"] }),
      notionGame("skyjo-action", { name: "Skyjo Action" }),
      notionGame("bang", { name: "Bang", categories: ["Cards", "Family"] }),
      notionGame("the-mind", { name: "The Mind", categories: ["Cooperative", "Cards"] }),
      notionGame("catan", { name: "Catan", categories: ["Strategy"] }),
    ]

    it("lists the games that share categories with it, the likeliest first, and leaves out the others", () => {
      expect(relatedOf(buildCatalog([], rows)).skyjo).toEqual(["skyjo-action", "bang", "the-mind"])
    })

    it("recommends too the games that its players also play, when that is known", () => {
      const alsoPlayed = new Map([["skyjo", new Map([["catan", 4]])]])
      expect(relatedOf(buildCatalog([], rows, { alsoPlayed })).skyjo).toEqual(["skyjo-action", "bang", "catan", "the-mind"])
    })

    it("recommends at most `RELATED_MAX` games, the family first", () => {
      const crowd = Array.from({ length: 20 }, (_, index) => notionGame(`game-${String(index).padStart(2, "0")}`, { name: `Game ${String(index).padStart(2, "0")}`, categories: ["Cards"] }))
      const list = relatedOf(buildCatalog([], [notionGame("home", { name: "Zzz", categories: ["Cards"], related: ["game-19"] }), ...crowd])).home ?? []
      expect(list).toHaveLength(RELATED_MAX)
      expect(list[0]).toBe("game-19")
    })
  })
})

describe("comparePlanned", () => {
  const order = (...games: ReturnType<typeof notionGame>[]) => [...games].sort(comparePlanned).map((game) => game.slug)

  it("sorts names the way a reader expects: numbers by value, case and accents ignored", () => {
    const names = ["Skyjo", "7 Wonders", "10 Minutes", "6 nimmt!", "Échecs", "the Mind", "Bang"]
    expect(order(...names.map((name) => notionGame(name, { name })))).toEqual(["6 nimmt!", "7 Wonders", "10 Minutes", "Bang", "Échecs", "Skyjo", "the Mind"])
  })

  it("keeps Notion's order between names that differ only by case or accents", () => {
    const spellings = [notionGame("c", { name: "Bâng" }), notionGame("a", { name: "Bang" }), notionGame("b", { name: "bang" })]
    expect(order(...spellings)).toEqual(["c", "a", "b"])
    expect(order(...[...spellings].reverse())).toEqual(["b", "a", "c"])
  })

  describe("with the rank of the Games Development database", () => {
    /** A game that stands where `chosen` says (options by name), called `name` (its slug unless told otherwise). */
    const ranked = (slug: string, chosen: Parameters<typeof developmentRank>[0], name = slug) => notionGame(slug, { name, development: developmentRank(chosen) })

    it("puts the nearest priority first, whatever the other columns say", () => {
      const games = [
        ranked("c", { priority: "P3 · Later", status: "Live", effort: "S" }),
        ranked("a", { priority: "P1 · Now", status: "Not started", effort: "XXL" }),
        ranked("d", { priority: "P4 · Someday", status: "Live", effort: "S" }),
        ranked("b", { priority: "P2 · Next", status: "Not started", effort: "XXL" }),
      ]
      expect(order(...games)).toEqual(["a", "b", "c", "d"])
    })

    it("puts the game that is furthest along first within a priority: the last status first, as the view sorts it", () => {
      const games = DEVELOPMENT_OPTIONS.status.map((status) => ranked(status, { priority: "P1 · Now", status }))
      expect(order(...games)).toEqual([...DEVELOPMENT_OPTIONS.status].reverse())
    })

    it("puts the lightest effort first within a priority and a status", () => {
      const games = DEVELOPMENT_OPTIONS.effort.map((effort) => ranked(effort, { priority: "P2 · Next", status: "Engine", effort }))
      expect(order(...[...games].reverse())).toEqual(["S", "M", "L", "XL", "XXL"])
    })

    it("looks at a column only where the ones before it tie", () => {
      const games = [
        ranked("far-light", { priority: "P2 · Next", status: "Playtest", effort: "S" }),
        ranked("near-heavy", { priority: "P1 · Now", status: "Rules", effort: "XXL" }),
        ranked("far-heavy", { priority: "P2 · Next", status: "Playtest", effort: "XL" }),
        ranked("near-far", { priority: "P1 · Now", status: "Table", effort: "XXL" }),
        ranked("early-light", { priority: "P2 · Next", status: "Engine", effort: "S" }),
      ]
      expect(order(...games)).toEqual(["near-far", "near-heavy", "far-light", "far-heavy", "early-light"])
    })

    it("puts a game with no value after every game that has one, in each column, whichever way the column goes", () => {
      const p1 = { priority: "P1 · Now" } as const
      // Priority goes up, Status goes down, Effort goes up: the empty cell is last in all three
      expect(order(ranked("none", {}), ranked("someday", { priority: "P4 · Someday" }))).toEqual(["someday", "none"])
      expect(order(ranked("none", p1), ranked("not-started", { ...p1, status: "Not started" }))).toEqual(["not-started", "none"])
      expect(order(ranked("none", { ...p1, status: "Live" }), ranked("xxl", { ...p1, status: "Live", effort: "XXL" }))).toEqual(["xxl", "none"])
    })

    it("counts an option the column no longer has as an empty cell", () => {
      const games = [ranked("retired", { priority: "P0 · Retired" }), ranked("someday", { priority: "P4 · Someday" })]
      expect(order(...games)).toEqual(["someday", "retired"])
    })

    it("falls back on the name where every column ties, and on the names alone where no game has a rank", () => {
      expect(order(ranked("z", { priority: "P1 · Now", status: "Engine", effort: "M" }, "Zeta"), ranked("a", { priority: "P1 · Now", status: "Engine", effort: "M" }, "Alpha"))).toEqual(["a", "z"])
      expect(order(...["Skyjo", "7 Wonders", "Bang"].map((name) => ranked(name, {}, name)))).toEqual(["7 Wonders", "Bang", "Skyjo"])
    })

    it("is the same order whichever way the games come, with ties, empty cells and all", () => {
      const games = [
        ranked("a", { priority: "P1 · Now", status: "Live", effort: "L" }, "A"),
        ranked("b", { priority: "P1 · Now", status: "Live", effort: "L" }, "B"),
        ranked("c", { priority: "P1 · Now", status: "Rules" }, "C"),
        ranked("d", { status: "Live", effort: "S" }, "D"),
        ranked("e", { priority: "P3 · Later", effort: "M" }, "E"),
        ranked("f", {}, "F"),
      ]
      const permutations = <T>(items: T[]): T[][] => (items.length <= 1 ? [items] : items.flatMap((item, index) => permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [item, ...rest])))
      const expected = ["a", "b", "c", "e", "d", "f"]
      expect(order(...games)).toEqual(expected)
      for (const permutation of permutations(games)) expect(order(...permutation)).toEqual(expected)
    })
  })
})

describe("pictureVersion", () => {
  it("is the same for the whole minute of an edit and changes with the next", () => {
    expect(pictureVersion("2026-10-22T10:30:00.000Z")).toBe(pictureVersion("2026-10-22T10:30:59.999Z"))
    expect(pictureVersion("2026-10-22T10:30:00.000Z")).not.toBe(pictureVersion("2026-10-22T10:31:00.000Z"))
  })

  it("reads the same instant whatever the way it is written", () => {
    expect(pictureVersion("2026-10-22T10:30:00.000Z")).toBe(pictureVersion("2026-10-22T12:30:00.000+02:00"))
  })

  it("is a short word that is safe in a URL", () => {
    expect(pictureVersion("2026-10-22T10:30:00.000Z")).toMatch(/^[0-9a-z]{1,10}$/)
  })

  it.each(["", "not a date", "2026-13-45"])("is 0 for %j: a row without a usable date", (editedAt) => {
    expect(pictureVersion(editedAt)).toBe("0")
  })
})

describe("pictureUrl", () => {
  const edited = notionGame("love-letter", { editedAt: "2026-10-22T10:30:00.000Z", art: { logo: true, icon: false, background: true } })

  it("is the route of the picture with the version of the row", () => {
    const version = pictureVersion(edited.editedAt)
    expect(pictureUrl(edited, "logo")).toBe(`/api/catalog/love-letter/logo?v=${version}`)
    expect(pictureUrl(edited, "background")).toBe(`/api/catalog/love-letter/background?v=${version}`)
  })

  it("is null for a picture the row does not have: no fallback, the page draws a plain frame", () => {
    expect(pictureUrl(edited, "icon")).toBeNull()
    expect(ART_SLOTS.map((slot) => pictureUrl(notionGame("omens"), slot))).toEqual([null, null, null])
  })

  it("changes when the row is edited", () => {
    const later = { ...edited, editedAt: "2026-10-22T11:00:00.000Z" }
    expect(pictureUrl(later, "logo")).not.toBe(pictureUrl(edited, "logo"))
  })
})

describe("cardPictureUrl", () => {
  const game = (art: { logo?: boolean; icon?: boolean; background?: boolean }) =>
    notionGame("skyjo", { editedAt: "2026-10-22T10:30:00.000Z", art: { logo: false, icon: false, background: false, ...art } })

  it("is the logo when the row has one, whatever else it has", () => {
    expect(cardPictureUrl(game({ logo: true, icon: true, background: true }))).toBe(pictureUrl(game({ logo: true }), "logo"))
  })

  it("is the icon when the row has no logo", () => {
    expect(cardPictureUrl(game({ icon: true, background: true }))).toBe(pictureUrl(game({ icon: true }), "icon"))
  })

  it("is null with neither: the background is the game page's, the card stays a plain frame", () => {
    expect(cardPictureUrl(game({ background: true }))).toBeNull()
    expect(cardPictureUrl(game({}))).toBeNull()
  })
})

describe("sharePicture", () => {
  const game = (art: { logo?: boolean; icon?: boolean; background?: boolean }, editedAt = "2026-10-22T10:30:00.000Z") =>
    notionGame("skyjo", { editedAt, art: { logo: false, icon: false, background: false, ...art } })

  it("is the background when the row has one, which is wide, whatever else it has", () => {
    expect(sharePicture(game({ logo: true, icon: true, background: true }))).toEqual({ url: pictureUrl(game({ background: true }), "background"), wide: true })
  })

  it("is the logo when the row has no background, which is small", () => {
    expect(sharePicture(game({ logo: true, icon: true }))).toEqual({ url: pictureUrl(game({ logo: true }), "logo"), wide: false })
  })

  it("is the icon with neither a background nor a logo", () => {
    expect(sharePicture(game({ icon: true }))).toEqual({ url: pictureUrl(game({ icon: true }), "icon"), wide: false })
  })

  it("is null with no picture at all", () => {
    expect(sharePicture(game({}))).toBeNull()
  })

  it("changes when the row is edited, like the picture's own URL", () => {
    expect(sharePicture(game({ background: true }, "2026-10-22T11:00:00.000Z"))?.url).not.toBe(sharePicture(game({ background: true }))?.url)
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

describe("publisherIconUrl", () => {
  const EDITED = "2026-10-22T10:00:00.000Z"
  const game = notionGame("hanabi", {
    editedAt: EDITED,
    publishers: [
      { name: "Cocktail Games", url: "https://www.cocktailgames.com" },
      { name: "No website", url: null },
      { name: "Third", url: "https://third.example" },
    ],
  })

  it("is the address of the icon of the publisher in that place of the row (counted from 0), with the version of the row like a picture's", () => {
    expect(publisherIconUrl(game, 0)).toBe(`/api/catalog/hanabi/publisher-0?v=${pictureVersion(EDITED)}`)
    expect(publisherIconUrl(game, 2)).toBe(`/api/catalog/hanabi/publisher-2?v=${pictureVersion(EDITED)}`)
  })

  it("is null for a publisher with no website and for a place the row has none in: there is nothing to take an icon from", () => {
    expect(publisherIconUrl(game, 1)).toBeNull()
    expect(publisherIconUrl(game, 3)).toBeNull()
    expect(publisherIconUrl(game, -1)).toBeNull()
  })

  it("changes when the row is edited, so that the page goes to a new address", () => {
    expect(publisherIconUrl({ ...game, editedAt: "2026-10-22T11:00:00.000Z" }, 0)).not.toBe(publisherIconUrl(game, 0))
  })

  it("never holds the website: the address names a place in the row, and the server finds the website there", () => {
    expect(publisherIconUrl(game, 0)).not.toContain("cocktailgames")
  })
})

describe("creditLines", () => {
  it("is the designers, the artists and the publishers, in that order", () => {
    const lines = creditLines(notionGame("hanabi", { authors: ["Antoine Bauza"], illustrators: ["Laura Michaud"], publishers: [{ name: "Cocktail Games", url: null }] }))
    expect(lines.map((line) => line.label)).toEqual(["Designer", "Artist", "Publisher"])
    expect(lines.map((line) => line.values.map((value) => value.text))).toEqual([["Antoine Bauza"], ["Laura Michaud"], ["Cocktail Games"]])
  })

  it("has its label in the singular for one and in the plural for more", () => {
    const lines = creditLines(
      notionGame("skull-king", {
        authors: ["Brent Beck", "Jeffrey Beck"],
        illustrators: ["Apryl Stott", "Someone Else", "Third Person"],
        publishers: [
          { name: "A", url: null },
          { name: "B", url: null },
        ],
      }),
    )
    expect(lines.map((line) => line.label)).toEqual(["Designers", "Artists", "Publishers"])
  })

  it("leaves out a line that has nobody, and is empty for a game with no credit at all", () => {
    expect(creditLines(notionGame("hanabi", { illustrators: ["Laura Michaud"] })).map((line) => line.label)).toEqual(["Artist"])
    expect(creditLines(notionGame("hanabi"))).toEqual([])
  })

  it("makes a link of a publisher that has a website, with its icon, and only a name of one that has none", () => {
    const game = notionGame("hanabi", {
      editedAt: "2026-10-22T10:00:00.000Z",
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
      // The icon is the one of its place in the row, the third, whether or not the second has a website
      { text: "Oya", href: "https://www.oya.fr", icon: publisherIconUrl(game, 2) },
    ])
    expect(publishers?.values[2]?.icon).toContain("publisher-2")
  })

  it("makes no link of a designer or an artist: a name", () => {
    const [designers] = creditLines(notionGame("hanabi", { authors: ["Antoine Bauza"] }))
    expect(designers?.values).toEqual([{ text: "Antoine Bauza" }])
  })
})
