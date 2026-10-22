import { describe, expect, it } from "vitest"
import { ART_SLOTS, STATUS_ORDER, UNLISTED_SLUGS, buildCatalog, comparePlanned, pickLocalized, pictureUrl, pictureVersion } from "./catalog"
import { plannedGame, registryGame } from "./testing"

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
    const [entry, ...others] = buildCatalog([courtisans], [plannedGame("courtisans", { name: "Courtisans (Notion)", status: "Live" })])
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

  it("sorts the planned games by status, then priority, then name", () => {
    const planned = [
      plannedGame("paused-p1", { name: "Paused P1", status: "Paused", priority: 1 }),
      plannedGame("rules-p3", { name: "Rules P3", status: "Rules", priority: 3 }),
      plannedGame("playtest-p4", { name: "Playtest P4", status: "PlayTest", priority: 4 }),
      plannedGame("rules-p1-b", { name: "B Rules P1", status: "Rules", priority: 1 }),
      plannedGame("rules-p1-a", { name: "A Rules P1", status: "Rules", priority: 1 }),
      plannedGame("engine-none", { name: "Engine none", status: "Engine" }),
      plannedGame("engine-p2", { name: "Engine P2", status: "Engine", priority: 2 }),
    ]
    expect(slugs(buildCatalog([], planned))).toEqual(["playtest-p4", "engine-p2", "engine-none", "rules-p1-a", "rules-p1-b", "rules-p3", "paused-p1"])
  })

  it("does not reorder or change the lists it is given", () => {
    const registry = [registryGame("courtisans", { live: true })]
    const planned = [plannedGame("b", { status: "Rules" }), plannedGame("a", { status: "Engine" })]
    buildCatalog(registry, planned)
    expect(slugs(planned)).toEqual(["b", "a"])
    expect(slugs(registry)).toEqual(["courtisans"])
  })
})

describe("comparePlanned", () => {
  const order = (...games: ReturnType<typeof plannedGame>[]) => [...games].sort(comparePlanned).map((game) => game.slug)

  it("puts the furthest along first and Paused last, in the order of STATUS_ORDER", () => {
    const games = STATUS_ORDER.map((status) => plannedGame(status, { status })).reverse()
    expect(order(...games)).toEqual([...STATUS_ORDER])
  })

  it("counts an empty or unknown status as Not started", () => {
    expect(order(plannedGame("rules", { status: "Rules" }), plannedGame("none"), plannedGame("odd", { status: "Someday" }), plannedGame("paused", { status: "Paused" }))).toEqual([
      "rules",
      "none",
      "odd",
      "paused",
    ])
  })

  it("puts a game with no priority after the ones that have one", () => {
    expect(order(plannedGame("none"), plannedGame("p4", { priority: 4 }), plannedGame("p1", { priority: 1 }))).toEqual(["p1", "p4", "none"])
  })

  it("sorts names the way a reader expects: numbers by value, case and accents ignored", () => {
    const names = ["Skyjo", "7 Wonders", "10 Minutes", "6 nimmt!", "Échecs", "the Mind", "Bang"]
    expect(order(...names.map((name) => plannedGame(name, { name })))).toEqual(["6 nimmt!", "7 Wonders", "10 Minutes", "Bang", "Échecs", "Skyjo", "the Mind"])
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

  it("is null for a picture the row does not have: no fallback, the page draws a black background", () => {
    expect(pictureUrl(edited, "icon")).toBeNull()
    expect(ART_SLOTS.map((slot) => pictureUrl(plannedGame("omens"), slot))).toEqual([null, null, null])
  })

  it("changes when the row is edited", () => {
    const later = { ...edited, editedAt: "2026-10-22T11:00:00.000Z" }
    expect(pictureUrl(later, "logo")).not.toBe(pictureUrl(edited, "logo"))
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
