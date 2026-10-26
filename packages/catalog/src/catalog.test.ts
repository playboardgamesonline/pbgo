import { describe, expect, it } from "vitest"
import { ART_SLOTS, UNLISTED_SLUGS, buildCatalog, cardPictureUrl, comparePlanned, pickLocalized, pictureUrl, pictureVersion } from "./catalog"
import { DEVELOPMENT_OPTIONS, developmentRank, plannedGame, registryGame } from "./testing"

const slugs = (entries: { slug: string }[]) => entries.map((entry) => entry.slug)

describe("buildCatalog", () => {
  it("lists the live games of the registry, in registry order, before the planned ones", () => {
    const registry = [registryGame("skyjo"), registryGame("courtisans", { live: true }), registryGame("trio", { live: true })]
    const entries = buildCatalog(registry, [plannedGame("the-mind")])
    expect(entries.map((entry) => [entry.slug, entry.live])).toEqual([
      ["courtisans", true],
      ["trio", true],
      ["the-mind", false],
    ])
  })

  it("is the live games alone when Notion gave nothing: what the hub showed before", () => {
    const registry = [registryGame("courtisans", { live: true }), registryGame("hanabi"), registryGame("template", { live: true })]
    expect(slugs(buildCatalog(registry, []))).toEqual(["courtisans"])
  })

  it("keeps the registry's entry for a live game and ignores its Notion row", () => {
    const courtisans = registryGame("courtisans", { name: "Courtisans", live: true })
    const [entry, ...others] = buildCatalog([courtisans], [plannedGame("courtisans", { name: "Courtisans (Notion)" })])
    expect(others).toEqual([])
    expect(entry).toEqual({ live: true, slug: "courtisans", game: courtisans })
  })

  it("gives a registry game that is not live its Notion row, and Notion's name with it", () => {
    const hanabi = plannedGame("hanabi", { name: "Hanabi (Notion)" })
    const entries = buildCatalog([registryGame("hanabi", { name: "Hanabi" })], [hanabi])
    expect(entries).toEqual([{ live: false, slug: "hanabi", game: hanabi }])
  })

  it("does not list a game that is not live and has no Notion row", () => {
    expect(buildCatalog([registryGame("hanabi"), registryGame("skyjo")], [plannedGame("skyjo")]).map((entry) => entry.slug)).toEqual(["skyjo"])
  })

  it("lists a Notion game the registry does not know", () => {
    const entries = buildCatalog([registryGame("courtisans", { live: true })], [plannedGame("bang"), plannedGame("hellapagos")])
    expect(slugs(entries)).toEqual(["courtisans", "bang", "hellapagos"])
    expect(entries.map((entry) => entry.live)).toEqual([true, false, false])
  })

  it("never lists the template, live or in Notion", () => {
    expect(UNLISTED_SLUGS.has("template")).toBe(true)
    const registry = [registryGame("template", { live: true }), registryGame("courtisans", { live: true })]
    expect(slugs(buildCatalog(registry, [plannedGame("template"), plannedGame("bang")]))).toEqual(["courtisans", "bang"])
  })

  it("sorts the planned games by name, whatever the order Notion gave them in", () => {
    const planned = [plannedGame("skyjo", { name: "Skyjo" }), plannedGame("bang", { name: "Bang" }), plannedGame("hanabi", { name: "Hanabi" })]
    expect(slugs(buildCatalog([], planned))).toEqual(["bang", "hanabi", "skyjo"])
  })

  it("keeps the live games in registry order, not by name", () => {
    const registry = [registryGame("trio", { live: true }), registryGame("courtisans", { live: true })]
    expect(slugs(buildCatalog(registry, [plannedGame("bang"), plannedGame("amen")]))).toEqual(["trio", "courtisans", "amen", "bang"])
  })

  it("sorts the planned games by their rank in the Games Development database, and by name where the rank leaves them tied", () => {
    const planned = [
      plannedGame("skyjo", { name: "Skyjo", development: developmentRank({ priority: "P2 · Next", status: "Live" }) }),
      plannedGame("bang", { name: "Bang" }),
      plannedGame("hanabi", { name: "Hanabi", development: developmentRank({ priority: "P1 · Now", status: "Rules" }) }),
      plannedGame("amen", { name: "Amen" }),
    ]
    expect(slugs(buildCatalog([], planned))).toEqual(["hanabi", "skyjo", "amen", "bang"])
  })

  it("keeps a live game where the registry puts it, however far its rank would send it: a live game needs none", () => {
    const registry = [registryGame("trio", { live: true }), registryGame("courtisans", { live: true })]
    const planned = [
      plannedGame("bang", { development: developmentRank({ priority: "P2 · Next" }) }),
      plannedGame("trio", { development: developmentRank({ priority: "P4 · Someday", status: "Paused" }) }),
      plannedGame("courtisans", { development: developmentRank({ priority: "P1 · Now", status: "Live" }) }),
    ]
    const entries = buildCatalog(registry, planned)
    expect(slugs(entries)).toEqual(["trio", "courtisans", "bang"])
    expect(entries.map((entry) => entry.live)).toEqual([true, true, false])
  })

  it("does not reorder or change the lists it is given", () => {
    const registry = [registryGame("courtisans", { live: true })]
    const planned = [plannedGame("b", { development: developmentRank({ priority: "P3 · Later" }) }), plannedGame("a", { development: developmentRank({ priority: "P1 · Now" }) })]
    buildCatalog(registry, planned)
    expect(slugs(planned)).toEqual(["b", "a"])
    expect(slugs(registry)).toEqual(["courtisans"])
  })
})

describe("comparePlanned", () => {
  const order = (...games: ReturnType<typeof plannedGame>[]) => [...games].sort(comparePlanned).map((game) => game.slug)

  it("sorts names the way a reader expects: numbers by value, case and accents ignored", () => {
    const names = ["Skyjo", "7 Wonders", "10 Minutes", "6 nimmt!", "Échecs", "the Mind", "Bang"]
    expect(order(...names.map((name) => plannedGame(name, { name })))).toEqual(["6 nimmt!", "7 Wonders", "10 Minutes", "Bang", "Échecs", "Skyjo", "the Mind"])
  })

  it("keeps Notion's order between names that differ only by case or accents", () => {
    const spellings = [plannedGame("c", { name: "Bâng" }), plannedGame("a", { name: "Bang" }), plannedGame("b", { name: "bang" })]
    expect(order(...spellings)).toEqual(["c", "a", "b"])
    expect(order(...[...spellings].reverse())).toEqual(["b", "a", "c"])
  })

  describe("with the rank of the Games Development database", () => {
    /** A game that stands where `chosen` says (options by name), called `name` (its slug unless told otherwise). */
    const ranked = (slug: string, chosen: Parameters<typeof developmentRank>[0], name = slug) => plannedGame(slug, { name, development: developmentRank(chosen) })

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
  const edited = plannedGame("love-letter", { editedAt: "2026-10-22T10:30:00.000Z", art: { logo: true, icon: false, background: true } })

  it("is the route of the picture with the version of the row", () => {
    const version = pictureVersion(edited.editedAt)
    expect(pictureUrl(edited, "logo")).toBe(`/api/catalog/love-letter/logo?v=${version}`)
    expect(pictureUrl(edited, "background")).toBe(`/api/catalog/love-letter/background?v=${version}`)
  })

  it("is null for a picture the row does not have: no fallback, the page draws a plain frame", () => {
    expect(pictureUrl(edited, "icon")).toBeNull()
    expect(ART_SLOTS.map((slot) => pictureUrl(plannedGame("omens"), slot))).toEqual([null, null, null])
  })

  it("changes when the row is edited", () => {
    const later = { ...edited, editedAt: "2026-10-22T11:00:00.000Z" }
    expect(pictureUrl(later, "logo")).not.toBe(pictureUrl(edited, "logo"))
  })
})

describe("cardPictureUrl", () => {
  const game = (art: { logo?: boolean; icon?: boolean; background?: boolean }) =>
    plannedGame("skyjo", { editedAt: "2026-10-22T10:30:00.000Z", art: { logo: false, icon: false, background: false, ...art } })

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
