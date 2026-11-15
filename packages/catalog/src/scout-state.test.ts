import { describe, expect, it } from "vitest"
import { SanityError } from "./sanity"
import { SCOUT_STATE_QUERY, describeState, readScoutState } from "./scout-state"

// The published games and expansions of the platform's project, as `pnpm check:scout --online` compares a scouted game with them.

const answering = (body: unknown, status = 200) => async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

describe("readScoutState", () => {
  it("asks the API itself, not its CDN, for the published documents, with no token", async () => {
    const calls: { url: URL; init: RequestInit }[] = []
    const send = (async (input: string | URL | Request, init: RequestInit = {}) => {
      calls.push({ url: new URL(String(input)), init })
      return new Response(JSON.stringify({ result: [] }), { status: 200 })
    }) as typeof fetch
    await readScoutState({ fetch: send, projectId: "abc123", dataset: "staging" })
    const [call] = calls
    expect(call?.url.host).toBe("abc123.api.sanity.io")
    expect(call?.url.pathname).toMatch(/^\/v\d{4}-\d{2}-\d{2}\/data\/query\/staging$/)
    expect(call?.url.searchParams.get("perspective")).toBe("published")
    expect(call?.url.searchParams.get("query")).toBe(SCOUT_STATE_QUERY)
    expect(call?.init.method).toBe("GET")
    expect(JSON.stringify(call?.init.headers)).not.toMatch(/authorization/i)
  })

  it("reads the games with their kind and the expansions with their base game", async () => {
    const read = await readScoutState({
      fetch: answering({
        result: [
          { _type: "game", slug: "flip-7", name: "Flip 7", bggId: 420087, kind: "game" },
          { _type: "game", slug: "flip-7-vengeance", name: "Flip 7 Vengeance", bggId: null, kind: "reimplementation", baseGame: "flip-7" },
          { _type: "game", slug: "azul", name: "Azul" },
          { _type: "expansion", slug: "azul-stained-glass", name: "Azul: Stained Glass", bggId: 340000, baseGame: "azul" },
          { _type: "expansion", slug: "orphan-more", name: "Orphan: More", baseGame: null },
        ],
      }),
    })
    expect(read.games).toEqual([
      { slug: "flip-7", name: "Flip 7", bggId: 420087, kind: "game", baseGame: null },
      { slug: "flip-7-vengeance", name: "Flip 7 Vengeance", bggId: null, kind: "reimplementation", baseGame: "flip-7" },
      { slug: "azul", name: "Azul", bggId: null, kind: "game", baseGame: null },
    ])
    expect(read.expansions).toEqual([
      { slug: "azul-stained-glass", name: "Azul: Stained Glass", bggId: 340000, kind: null, baseGame: "azul" },
      { slug: "orphan-more", name: "Orphan: More", bggId: null, kind: null, baseGame: null },
    ])
  })

  it("leaves out a document with no slug or no name, and takes a BoardGameGeek id that is not a whole number for none", async () => {
    const read = await readScoutState({
      fetch: answering({
        result: [
          { _type: "game", slug: "", name: "No slug" },
          { _type: "game", slug: "no-name", name: "  " },
          { _type: "game", slug: "odd", name: "Odd", bggId: "123", kind: "expansion" },
          { _type: "game", slug: "odder", name: "Odder", bggId: 1.5 },
          { _type: "article", slug: "news", name: "News" },
          "not a document",
          null,
        ],
      }),
    })
    expect(read.games.map((game) => [game.slug, game.bggId, game.kind])).toEqual([
      ["odd", null, "game"],
      ["odder", null, "game"],
    ])
    expect(read.expansions).toEqual([])
  })

  it("says what Sanity answered when it refuses, and what it could not do when it cannot be reached, without the address", async () => {
    await expect(readScoutState({ fetch: answering({ error: { description: "nope" } }, 403) })).rejects.toMatchObject({ name: "SanityError", status: 403, message: "Sanity answered 403" })
    const failing = (async () => {
      throw new TypeError("fetch failed: https://mhgqs6fe.api.sanity.io/secret")
    }) as typeof fetch
    const error = await readScoutState({ fetch: failing }).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(SanityError)
    expect((error as SanityError).message).toBe("The platform's Sanity project could not be reached (TypeError)")
    expect((error as SanityError).message).not.toContain("secret")
  })

  it("refuses an answer that is not a list of documents", async () => {
    await expect(readScoutState({ fetch: answering({ result: { games: [] } }) })).rejects.toThrow("not a list of documents")
    await expect(readScoutState({ fetch: answering("<html>") })).rejects.toThrow("not a list of documents")
  })
})

describe("describeState", () => {
  const state = {
    games: [
      { slug: "flip-7", name: "Flip 7", bggId: 420087, kind: "game" as const, baseGame: null },
      { slug: "flip-7-vengeance", name: "Flip 7 Vengeance", bggId: null, kind: "reimplementation" as const, baseGame: "flip-7" },
    ],
    expansions: [{ slug: "bang-legends", name: "Legends", bggId: null, kind: null, baseGame: "bang" }],
  }
  const registry = [{ slug: "flip-7", name: "Flip 7" }, { slug: "template", name: "La Plus Haute" }]

  it("says how many there are, then lists each one a line: slug, type, BoardGameGeek id, base game, folder and name", () => {
    const lines = describeState(registry, state).split("\n")
    expect(lines[0]).toBe("2 games and 1 expansions published in the platform's catalog, 2 games with a folder in the repo")
    expect(lines[1]).toBe("")
    const rows = lines.slice(2).map((line) => line.split(/\s{2,}/))
    expect(rows[0]).toEqual(["slug", "type", "bgg", "base", "folder", "name"])
    expect(rows).toContainEqual(["bang-legends", "expansion", "-", "bang", "no", "Legends"])
    expect(rows).toContainEqual(["flip-7", "game", "420087", "-", "yes", "Flip 7"])
    expect(rows).toContainEqual(["flip-7-vengeance", "reimplementation", "-", "flip-7", "no", "Flip 7 Vengeance"])
  })

  it("adds the games of the registry that the catalog does not have, and sorts by slug", () => {
    const slugs = describeState(registry, state).split("\n").slice(3).map((line) => line.split(/\s{2,}/)[0])
    expect(slugs).toEqual(["bang-legends", "flip-7", "flip-7-vengeance", "template"])
    expect(describeState(registry, state)).toMatch(/template\s+folder only\s+-\s+-\s+yes\s+La Plus Haute/)
  })

  it("shows the characters that hide as their code point and keeps a name to a line", () => {
    const hostile = { games: [{ slug: "bad", name: `Bad${String.fromCodePoint(0x1b)}[2J${"x".repeat(500)}`, bggId: null, kind: "game" as const, baseGame: null }], expansions: [] }
    const text = describeState([], hostile)
    expect(text).not.toMatch(/[\u0000-\u0009\u000b-\u001f]/)
    expect(text).toContain("Bad\\u{1b}[2J")
    for (const line of text.split("\n")) expect(line.length).toBeLessThan(200)
  })
})
