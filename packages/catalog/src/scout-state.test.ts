import { describe, expect, it } from "vitest"
import { SanityError } from "./sanity"
import { SCOUT_STATE_QUERY, readScoutState } from "./scout-state"

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
          { _type: "game", slug: "flip-7-vengeance", name: "Flip 7 Vengeance", bggId: null, kind: "reimplementation" },
          { _type: "game", slug: "azul", name: "Azul" },
          { _type: "expansion", slug: "azul-stained-glass", name: "Azul: Stained Glass", bggId: 340000, baseGame: "azul" },
          { _type: "expansion", slug: "orphan-more", name: "Orphan: More", baseGame: null },
        ],
      }),
    })
    expect(read.games).toEqual([
      { slug: "flip-7", name: "Flip 7", bggId: 420087, kind: "game" },
      { slug: "flip-7-vengeance", name: "Flip 7 Vengeance", bggId: null, kind: "reimplementation" },
      { slug: "azul", name: "Azul", bggId: null, kind: "game" },
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
