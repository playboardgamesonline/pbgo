import type { GameEntry } from "@pbgo/core/lib/binding"
import { GAMES } from "@pbgo/games/registry"
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest"
import { creatorPage, developmentPage, editorPage, fakeNotion, gamePage, notionFailure } from "./testing"

// `server-only` throws outside a server bundle
vi.mock("server-only", () => ({}))

const TOKEN = "ntn_testsecret123"

/** A fake Notion whose Editors, Creators and Games Development databases are there and empty, unless the test fills them. */
const notionOf = (databases: Parameters<typeof fakeNotion>[0]) => fakeNotion({ editors: [], creators: [], development: [], ...databases })

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

describe("without a token", () => {
  it.each([
    ["unset", undefined],
    ["empty", ""],
    ["white space", "   "],
  ])("lists the live games of the registry and does not call Notion when the key is %s", async (_label, key) => {
    vi.stubEnv("NOTION_API_KEY", key)
    const notion = notionOf({ games: [gamePage({ slug: "bang", name: "Bang" })] })
    vi.stubGlobal("fetch", notion.fetch)
    const { getCatalog } = await load()
    const catalog = await getCatalog()
    expect(catalog.notion).toBe("off")
    expect(catalog.entries.map((entry) => [entry.slug, entry.live])).toEqual(LIVE_SLUGS.map((slug) => [slug, true]))
    expect(notion.calls).toEqual([])
    expect(warn).not.toHaveBeenCalled()
  })
})

describe("with a token", () => {
  it("lists the live games, then the planned ones of Notion, sorted by name", async () => {
    vi.stubEnv("NOTION_API_KEY", TOKEN)
    vi.stubGlobal(
      "fetch",
      notionOf({
        games: [gamePage({ slug: "the-mind", name: "The Mind" }), gamePage({ slug: "the-game", name: "The Game" }), gamePage({ slug: "bang", name: "Bang" })],
      }).fetch,
    )
    const { getCatalog } = await load()
    const catalog = await getCatalog()
    expect(catalog.notion).toBe("ok")
    expect(catalog.entries.map((entry) => entry.slug)).toEqual([...LIVE_SLUGS, "bang", "the-game", "the-mind"])
    expect(catalog.entries.map((entry) => entry.live)).toEqual([...LIVE_SLUGS.map(() => true), false, false, false])
    expect(warn).not.toHaveBeenCalled()
  })

  it("asks Notion with the trimmed key, and lets Next cache the answers for ten minutes under the catalog tag", async () => {
    vi.stubEnv("NOTION_API_KEY", `  ${TOKEN}  `)
    const notion = notionOf({ games: [gamePage({ slug: "bang", name: "Bang" })] })
    vi.stubGlobal("fetch", notion.fetch)
    const { getCatalog, CATALOG_TAG, CATALOG_REVALIDATE_SECONDS } = await load()
    expect([CATALOG_TAG, CATALOG_REVALIDATE_SECONDS]).toEqual(["catalog", 600])
    await getCatalog()
    expect(notion.calls).toHaveLength(4)
    for (const call of notion.calls) {
      expect(call.headers.Authorization).toBe(`Bearer ${TOKEN}`)
      expect(call.init).toMatchObject({ method: "POST", next: { revalidate: 600, tags: ["catalog"] } })
    }
    // the schema of the Games Development database, which says in what order its options come, is read the same way
    expect(notion.schemaCalls).toHaveLength(1)
    expect(notion.schemaCalls[0]?.headers.Authorization).toBe(`Bearer ${TOKEN}`)
    expect(notion.schemaCalls[0]?.init).toMatchObject({ method: "GET", next: { revalidate: 600, tags: ["catalog"] } })
  })

  it("lists the planned games in the order of their Games Development rows: the nearest priority first, then the furthest along, then the lightest", async () => {
    vi.stubEnv("NOTION_API_KEY", TOKEN)
    vi.stubGlobal(
      "fetch",
      notionOf({
        games: ["Bang", "Skyjo", "The Game", "The Mind", "Zombie Dice"].map((name) => gamePage({ slug: name.toLowerCase().replace(/ /g, "-"), name })),
        development: [
          developmentPage({ slug: "the-mind", game: ["game-the-mind"], priority: "P1 · Now", status: "Engine", effort: "M" }),
          developmentPage({ slug: "skyjo", game: ["game-skyjo"], priority: "P1 · Now", status: "Playtest", effort: "XL" }),
          developmentPage({ slug: "the-game", game: ["game-the-game"], priority: "P1 · Now", status: "Engine", effort: "S" }),
          developmentPage({ slug: "zombie-dice", game: ["game-zombie-dice"], priority: "P2 · Next", status: "Live", effort: "S" }),
        ],
      }).fetch,
    )
    const { getCatalog } = await load()
    const { entries } = await getCatalog()
    // Bang has no row: after the games that have one
    expect(entries.map((entry) => entry.slug)).toEqual([...LIVE_SLUGS, "skyjo", "the-game", "the-mind", "zombie-dice", "bang"])
    expect(warn).not.toHaveBeenCalled()
  })

  it("keeps the live games first, in the order of the registry, whatever the Games Development rows say of them", async () => {
    const live = LIVE[0]
    if (!live) throw new Error("No live game")
    vi.stubEnv("NOTION_API_KEY", TOKEN)
    vi.stubGlobal(
      "fetch",
      notionOf({
        games: [gamePage({ slug: "bang", name: "Bang" }), gamePage({ slug: live.slug, name: "Name in Notion" })],
        development: [
          developmentPage({ slug: "bang", game: ["game-bang"], priority: "P1 · Now" }),
          developmentPage({ slug: live.slug, game: [`game-${live.slug}`], priority: "P4 · Someday", status: "Paused" }),
        ],
      }).fetch,
    )
    const { getCatalog } = await load()
    const { entries } = await getCatalog()
    expect(entries.map((entry) => entry.slug)).toEqual([...LIVE_SLUGS, "bang"])
    expect(entries.filter((entry) => entry.slug === live.slug)).toEqual([{ live: true, slug: live.slug, game: live }])
  })

  it("keeps the registry's entry for a live game and ignores its Notion row", async () => {
    const live = LIVE[0]
    if (!live) throw new Error("No live game")
    vi.stubEnv("NOTION_API_KEY", TOKEN)
    vi.stubGlobal("fetch", notionOf({ games: [gamePage({ slug: live.slug, name: "Name in Notion", players: "2 - 4" })] }).fetch)
    const { getCatalog } = await load()
    const { entries } = await getCatalog()
    expect(entries.filter((entry) => entry.slug === live.slug)).toEqual([{ live: true, slug: live.slug, game: live }])
  })

  it("gives a game of the registry that is not live its Notion row, and Notion's name with it", async () => {
    vi.stubEnv("NOTION_API_KEY", TOKEN)
    vi.stubGlobal("fetch", notionOf({ games: [gamePage({ slug: NOT_LIVE.slug, name: "Name in Notion", players: "2 - 4" })] }).fetch)
    const { getCatalog } = await load()
    const { entries } = await getCatalog()
    const entry = entries.find((candidate) => candidate.slug === NOT_LIVE.slug)
    expect(entry).toMatchObject({ live: false, slug: NOT_LIVE.slug, game: { name: "Name in Notion", players: { min: 2, max: 4 } } })
  })

  it("does not list a game of the registry that is not live and has no Notion row, nor the template", async () => {
    vi.stubEnv("NOTION_API_KEY", TOKEN)
    vi.stubGlobal("fetch", notionOf({ games: [gamePage({ slug: "template", name: "Template" }), gamePage({ slug: "bang", name: "Bang" })] }).fetch)
    const { getCatalog } = await load()
    const { entries } = await getCatalog()
    expect(entries.map((entry) => entry.slug)).toEqual([...LIVE_SLUGS, "bang"])
  })

  it("gives a planned game its publishers", async () => {
    vi.stubEnv("NOTION_API_KEY", TOKEN)
    const editor = "9f1c2d3e-0000-4000-8000-00000000e001"
    vi.stubGlobal(
      "fetch",
      notionOf({ games: [gamePage({ slug: "bang", name: "Bang", editors: [editor] })], editors: [editorPage({ id: editor, name: "Editor One", url: "https://editor.example.com" })] }).fetch,
    )
    const { getCatalog } = await load()
    const { entries } = await getCatalog()
    expect(entries.at(-1)).toMatchObject({ live: false, slug: "bang", game: { publishers: [{ name: "Editor One", url: "https://editor.example.com" }] } })
  })

  it("gives a planned game its authors and its illustrators", async () => {
    vi.stubEnv("NOTION_API_KEY", TOKEN)
    const author = "9f1c2d3e-0000-4000-8000-00000000c001"
    const illustrator = "9f1c2d3e-0000-4000-8000-00000000c002"
    vi.stubGlobal(
      "fetch",
      notionOf({
        games: [gamePage({ slug: "bang", name: "Bang", authors: [author], illustrators: [illustrator] })],
        creators: [creatorPage({ id: author, name: "Author One" }), creatorPage({ id: illustrator, name: "Illustrator One" })],
      }).fetch,
    )
    const { getCatalog } = await load()
    const { entries } = await getCatalog()
    expect(entries.at(-1)).toMatchObject({ live: false, slug: "bang", game: { authors: ["Author One"], illustrators: ["Illustrator One"] } })
  })
})

describe("when Notion cannot be read", () => {
  it("falls back on the live games and says why, once", async () => {
    vi.stubEnv("NOTION_API_KEY", TOKEN)
    vi.stubGlobal("fetch", notionOf({ games: notionFailure(401, "unauthorized", "API token is invalid.") }).fetch)
    const { getCatalog } = await load()
    const catalog = await getCatalog()
    expect(catalog.notion).toBe("unavailable")
    expect(catalog.entries.map((entry) => entry.slug)).toEqual(LIVE_SLUGS)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith("[catalog] Notion is unavailable, only the live games are listed: Notion answered 401 unauthorized: API token is invalid.")
  })

  it("does the same, without the token in the log, when Notion cannot be reached", async () => {
    vi.stubEnv("NOTION_API_KEY", TOKEN)
    vi.stubGlobal("fetch", async () => {
      throw new TypeError(`fetch failed for Bearer ${TOKEN}`)
    })
    const { getCatalog } = await load()
    const catalog = await getCatalog()
    expect(catalog.notion).toBe("unavailable")
    expect(catalog.entries.map((entry) => entry.slug)).toEqual(LIVE_SLUGS)
    expect(logged()).toBe("[catalog] Notion is unavailable, only the live games are listed: Notion could not be reached (TypeError)")
    expect(logged()).not.toContain(TOKEN)
  })

  it("does not log the same failure twice, however often the catalog is read", async () => {
    vi.stubEnv("NOTION_API_KEY", TOKEN)
    vi.stubGlobal("fetch", notionOf({ games: notionFailure(500, "internal_server_error", "Oops") }).fetch)
    const { getCatalog } = await load()
    await getCatalog()
    await getCatalog()
    expect(warn).toHaveBeenCalledTimes(1)
  })
})

describe("what is wrong in Notion without stopping the catalog", () => {
  it("is logged once per distinct line, not once per read", async () => {
    vi.stubEnv("NOTION_API_KEY", TOKEN)
    const rows = [gamePage({ slug: "bang", name: "Bang" }), gamePage({ slug: "", name: "Nameless" })]
    for (const row of rows) delete row.properties["Rules DE"]
    vi.stubGlobal("fetch", notionOf({ games: rows }).fetch)
    const { getCatalog } = await load()
    const first = await getCatalog()
    const second = await getCatalog()
    expect(first.notion).toBe("ok")
    expect(second.entries.map((entry) => entry.slug)).toEqual([...LIVE_SLUGS, "bang"])
    expect(warn.mock.calls.map((call) => call[0])).toEqual([
      '[catalog] The Games database has no "Rules DE" column: it is left empty for every game',
      '[catalog] The Notion row "Nameless" is left out: it has no slug (fill the Slug column)',
    ])
  })

  it("says the Editors database could not be read, and still lists the games", async () => {
    vi.stubEnv("NOTION_API_KEY", TOKEN)
    vi.stubGlobal("fetch", fakeNotion({ games: [gamePage({ slug: "bang", name: "Bang" })], creators: [], development: [] }).fetch)
    const { getCatalog } = await load()
    const { entries, notion } = await getCatalog()
    expect(notion).toBe("ok")
    expect(entries.at(-1)?.slug).toBe("bang")
    expect(logged()).toContain("[catalog] The Editors database could not be read, so no game has a publisher")
    expect(logged()).not.toContain(TOKEN)
  })

  it("says the Creators database could not be read, and still lists the games", async () => {
    vi.stubEnv("NOTION_API_KEY", TOKEN)
    vi.stubGlobal("fetch", fakeNotion({ games: [gamePage({ slug: "bang", name: "Bang" })], editors: [], development: [] }).fetch)
    const { getCatalog } = await load()
    const { entries, notion } = await getCatalog()
    expect(notion).toBe("ok")
    expect(entries.at(-1)?.slug).toBe("bang")
    expect(logged()).toContain("[catalog] The Creators database could not be read, so no game has an author or an illustrator")
    expect(logged()).not.toContain(TOKEN)
  })

  it("says the Games Development database could not be read, and lists the planned games by name", async () => {
    vi.stubEnv("NOTION_API_KEY", TOKEN)
    const games = ["The Mind", "Bang", "Skyjo"].map((name) => gamePage({ slug: name.toLowerCase().replace(/ /g, "-"), name }))
    vi.stubGlobal("fetch", fakeNotion({ games, editors: [], creators: [] }).fetch)
    const { getCatalog } = await load()
    const { entries, notion } = await getCatalog()
    expect(notion).toBe("ok")
    expect(entries.map((entry) => entry.slug)).toEqual([...LIVE_SLUGS, "bang", "skyjo", "the-mind"])
    expect(logged()).toContain("[catalog] The Games Development database could not be read, so the coming-soon games are listed by name (connect the integration to it too)")
    expect(logged()).not.toContain(TOKEN)
  })

  it("says it once, however often the catalog is read", async () => {
    vi.stubEnv("NOTION_API_KEY", TOKEN)
    vi.stubGlobal("fetch", fakeNotion({ games: [gamePage({ slug: "bang", name: "Bang" })], editors: [], creators: [] }).fetch)
    const { getCatalog } = await load()
    await getCatalog()
    await getCatalog()
    expect(warn).toHaveBeenCalledTimes(1)
  })
})
