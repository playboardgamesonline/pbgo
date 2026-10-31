import type { GameEntry } from "@pbgo/core/lib/binding"
import { GAMES } from "@pbgo/games/registry"
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest"
import { registryRow } from "./catalog"
import { fakeSanity, sanityFailure, sanityGame, type SanityAnswer } from "./testing"

// `server-only` throws outside a server bundle
vi.mock("server-only", () => ({}))

// The registry as the catalog reads it (its literal types would make `slug !== "template"` a comparison with no overlap)
const REGISTRY: readonly GameEntry[] = GAMES
const LIVE = REGISTRY.filter((game) => game.live && game.slug !== "template")
const LIVE_SLUGS = LIVE.map((game) => game.slug)
const NOT_LIVE = REGISTRY.find((game) => !game.live && game.slug !== "template")
if (!NOT_LIVE || LIVE.length === 0) throw new Error("The registry needs a live game and a game that is not live for this test")

/** A fresh copy of the module: the lines the previous test logged are forgotten with the old one. */
async function load() {
  vi.resetModules()
  return await import("./server")
}

/** The catalog a fake Sanity gives. */
async function catalogOf(answer: SanityAnswer) {
  const sanity = fakeSanity(answer)
  vi.stubGlobal("fetch", sanity.fetch)
  const { getCatalog } = await load()
  return { catalog: await getCatalog(), sanity }
}

let warn: MockInstance<typeof console.warn>

beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** Everything that was logged, as one text. */
const logged = () => warn.mock.calls.map((call) => call.join(" ")).join("\n")

describe("when the platform's Sanity project answers", () => {
  it("lists the live games, then the games of the Studio in their order", async () => {
    const { catalog } = await catalogOf([
      sanityGame("bang", { name: "Bang", order: 30 }),
      sanityGame("amen", { name: "Amen" }),
      sanityGame("hellapagos", { name: "Hellapagos", order: 10 }),
    ])
    expect(catalog.source).toBe("ok")
    expect(catalog.entries.map((entry) => [entry.slug, entry.live])).toEqual([...LIVE_SLUGS.map((slug) => [slug, true]), ["hellapagos", false], ["bang", false], ["amen", false]])
    expect(warn).not.toHaveBeenCalled()
  })

  it("lists a live game that the Studio has no game for with what the registry knows of it", async () => {
    const { catalog } = await catalogOf([sanityGame("bang", { name: "Bang" })])
    const live = catalog.entries.filter((entry) => entry.live)
    expect(live.map((entry) => entry.game)).toEqual(LIVE.map(registryRow))
    expect(catalog.entries.at(-1)?.slug).toBe("bang")
  })

  it("asks the platform's project once, and lets Next cache the answer for ten minutes under the catalog tag", async () => {
    const { sanity } = await catalogOf([])
    expect(sanity.calls).toHaveLength(1)
    expect(sanity.calls[0]?.init).toMatchObject({ method: "GET", next: { revalidate: 600, tags: ["catalog"] } })
    const { CATALOG_REVALIDATE_SECONDS, CATALOG_TAG } = await load()
    expect([CATALOG_REVALIDATE_SECONDS, CATALOG_TAG]).toEqual([600, "catalog"])
  })

  it("needs no key and sends none: the dataset is public", async () => {
    vi.stubEnv("NOTION_API_KEY", "ntn_testsecret123")
    const { sanity } = await catalogOf([sanityGame("bang", { name: "Bang" })])
    expect(JSON.stringify(sanity.calls[0]?.init.headers)).not.toMatch(/authorization|bearer/i)
    expect(sanity.calls[0]?.url.href).not.toContain("ntn_")
  })

  it("gives a live game its game of the Studio, and the Studio's name and figures with it", async () => {
    const live = LIVE[0]
    if (!live) throw new Error("no live game")
    const { catalog } = await catalogOf([sanityGame(live.slug, { name: "Live in the Studio", playersMin: 2, playersMax: 6, duration: 20 })])
    const entry = catalog.entries.find((candidate) => candidate.slug === live.slug)
    expect(entry).toMatchObject({ live: true, game: { name: "Live in the Studio", players: { min: 2, max: 6 }, duration: 20 } })
  })

  it("gives a game of the registry that is not live its game of the Studio, and the Studio's name with it", async () => {
    const { catalog } = await catalogOf([sanityGame(NOT_LIVE.slug, { name: "Planned in the Studio" })])
    expect(catalog.entries.find((entry) => entry.slug === NOT_LIVE.slug)).toMatchObject({ live: false, game: { name: "Planned in the Studio" } })
  })

  it("does not list a game of the registry that is not live and has no game in the Studio, nor the template", async () => {
    const { catalog } = await catalogOf([sanityGame("bang", { name: "Bang" }), sanityGame("template", { name: "Template" })])
    const slugs = catalog.entries.map((entry) => entry.slug)
    expect(slugs).not.toContain(NOT_LIVE.slug)
    expect(slugs).not.toContain("template")
  })

  it("gives a game its credits, its publishers, its categories and its pictures", async () => {
    const { catalog } = await catalogOf([
      sanityGame("bang", {
        name: "Bang",
        creators: [{ name: "Emiliano Sciarra", roles: ["designer"] }, { name: "Alex Randolph", roles: ["artist", "developer"] }],
        publishers: [{ name: "daVinci Games", url: "https://davinci.example" }],
        categories: ["Cards", "Party"],
        logo: "https://cdn.sanity.io/images/mhgqs6fe/production/logo-1x1.png",
      }),
    ])
    const bang = catalog.entries.find((entry) => entry.slug === "bang")?.game
    expect(bang?.creators).toEqual([
      { name: "Emiliano Sciarra", roles: ["designer"] },
      { name: "Alex Randolph", roles: ["developer", "artist"] },
    ])
    expect(bang?.publishers).toEqual([{ name: "daVinci Games", url: "https://davinci.example" }])
    expect(bang?.categories).toEqual(["Cards", "Party"])
    expect(bang?.pictures.logo).toBe("https://cdn.sanity.io/images/mhgqs6fe/production/logo-1x1.png")
  })

  it("gives every game the games it is linked to, whichever side of the link the Studio has, and a live game's game counts as well", async () => {
    const live = LIVE[0]
    if (!live) throw new Error("no live game")
    const { catalog } = await catalogOf([sanityGame(live.slug, { name: "Live", related: ["the-mind"] }), sanityGame("the-mind", { name: "The Mind" }), sanityGame("bang", { name: "Bang", related: [live.slug] })])
    const related = Object.fromEntries(catalog.entries.map((entry) => [entry.slug, entry.related]))
    expect(related[live.slug]).toEqual(["bang", "the-mind"])
    expect(related["the-mind"]).toEqual([live.slug])
    expect(related.bang).toEqual([live.slug])
  })

  it("links a reimplementation to its base game", async () => {
    const { catalog } = await catalogOf([sanityGame("flip-7", { name: "Flip 7" }), sanityGame("flip-7-vengeance", { name: "Flip 7 Vengeance", baseGame: "flip-7" })])
    const related = Object.fromEntries(catalog.entries.map((entry) => [entry.slug, entry.related]))
    expect(related["flip-7"]).toEqual(["flip-7-vengeance"])
    expect(related["flip-7-vengeance"]).toEqual(["flip-7"])
  })
})

describe("when the Studio has no published game", () => {
  it("lists the live games alone, from the registry, and says why", async () => {
    const { catalog } = await catalogOf([])
    expect(catalog.source).toBe("ok")
    expect(catalog.entries.map((entry) => entry.game)).toEqual(LIVE.map(registryRow))
    expect(logged()).toContain("The platform's Sanity project has no published game")
  })
})

describe("when the platform's Sanity project cannot be read", () => {
  it("falls back on the live games of the registry and says why, once", async () => {
    const { catalog } = await catalogOf(sanityFailure(500, "something broke"))
    expect(catalog.source).toBe("unavailable")
    expect(catalog.entries.map((entry) => [entry.slug, entry.live])).toEqual(LIVE_SLUGS.map((slug) => [slug, true]))
    expect(catalog.entries.map((entry) => entry.game)).toEqual(LIVE.map(registryRow))
    expect(warn).toHaveBeenCalledTimes(1)
    expect(logged()).toContain("[catalog] The platform's Sanity project is unavailable, only the live games are listed, from the registry: Sanity answered 500: something broke")
  })

  it("does the same, without an address in the log, when Sanity cannot be reached", async () => {
    vi.stubGlobal("fetch", (async () => {
      throw new TypeError("fetch failed")
    }) as typeof fetch)
    const { getCatalog } = await load()
    const catalog = await getCatalog()
    expect(catalog.source).toBe("unavailable")
    expect(logged()).toContain("could not be reached (TypeError)")
    expect(logged()).not.toContain("apicdn")
  })

  it("lists the other games of the registry too, by name, in development, so that the hub can be seen whole", async () => {
    vi.stubEnv("NODE_ENV", "development")
    const { catalog } = await catalogOf(sanityFailure(503, "down"))
    expect(catalog.source).toBe("unavailable")
    const slugs = catalog.entries.map((entry) => entry.slug)
    expect(slugs).toContain(NOT_LIVE.slug)
    expect(catalog.entries.filter((entry) => !entry.live).every((entry) => entry.game.pictures.logo === null)).toBe(true)
  })

  it("never does so in a deployment", async () => {
    vi.stubEnv("NODE_ENV", "production")
    const { catalog } = await catalogOf(sanityFailure(503, "down"))
    expect(catalog.entries.map((entry) => entry.slug)).toEqual(LIVE_SLUGS)
  })

  it("does not log the same failure twice, however often the catalog is read", async () => {
    vi.stubGlobal("fetch", fakeSanity(sanityFailure(500, "no")).fetch)
    const { getCatalog } = await load()
    await getCatalog()
    await getCatalog()
    // `getCatalog` is cached for one request by React: two reads in a test are one read of Sanity or two, and one line either way
    expect(warn.mock.calls.length).toBeLessThanOrEqual(1)
  })
})

describe("what is wrong in the Studio without stopping the catalog", () => {
  it("logs a game that is left out, once per distinct line, not once per read", async () => {
    vi.stubGlobal("fetch", fakeSanity([sanityGame("bang", { name: "Bang" }), sanityGame("api", { _id: "game-api", name: "Api" })]).fetch)
    const { getCatalog } = await load()
    await getCatalog()
    await getCatalog()
    const lines = warn.mock.calls.map((call) => call.join(" "))
    expect(lines.filter((line) => line.includes('The game "Api" of the Studio is left out'))).toHaveLength(1)
    expect(logged()).toContain("a route of the site")
  })

  it("lists the other games anyway", async () => {
    const { catalog } = await catalogOf([sanityGame("api", { _id: "game-api", name: "Api" }), sanityGame("bang", { name: "Bang" })])
    expect(catalog.entries.map((entry) => entry.slug)).toContain("bang")
    expect(catalog.entries.map((entry) => entry.slug)).not.toContain("api")
  })
})
