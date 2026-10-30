import { describe, expect, it } from "vitest"
import type { CatalogGame } from "./catalog"
import { CATALOG_QUERY, PLATFORM_DATASET, PLATFORM_PROJECT_ID, SANITY_API_VERSION, SanityError, readSanityGames } from "./sanity"
import { cdn, fakeSanity, sanityFailure, sanityGame, type SanityAnswer } from "./testing"

/** What `readSanityGames` makes of the games a fake Sanity answers. */
const read = (answer: SanityAnswer) => readSanityGames({ fetch: fakeSanity(answer).fetch })

/** The one game a document makes. */
async function one(overrides: Record<string, unknown> = {}): Promise<CatalogGame> {
  const [game] = (await read([sanityGame("sample", { name: "Sample", ...overrides })])).games
  if (!game) throw new Error("The document was not read as a game")
  return game
}

/** The error a read ends with. */
async function failureOf(reading: Promise<unknown>): Promise<SanityError> {
  try {
    await reading
  } catch (error) {
    if (error instanceof SanityError) return error
    throw error
  }
  throw new Error("The read was expected to fail")
}

describe("the request", () => {
  it("is one GET of the public API of the platform's project, through its CDN, on the published documents, with the query", async () => {
    const sanity = fakeSanity([])
    await readSanityGames({ fetch: sanity.fetch })
    expect(sanity.calls).toHaveLength(1)
    const [call] = sanity.calls
    expect(call?.url.origin).toBe(`https://${PLATFORM_PROJECT_ID}.apicdn.sanity.io`)
    expect(call?.url.pathname).toBe(`/v${SANITY_API_VERSION}/data/query/${PLATFORM_DATASET}`)
    expect(call?.url.searchParams.get("perspective")).toBe("published")
    expect(call?.url.searchParams.get("query")).toBe(CATALOG_QUERY)
    expect(call?.init.method).toBe("GET")
    expect(call?.init.headers).toEqual({ Accept: "application/json" })
    expect(call?.init.signal).toBeInstanceOf(AbortSignal)
  })

  it("carries no token: the dataset is public", async () => {
    const sanity = fakeSanity([])
    await readSanityGames({ fetch: sanity.fetch })
    expect(JSON.stringify(sanity.calls[0]?.init.headers)).not.toMatch(/authorization|bearer/i)
  })

  it("adds the caller's options, but they cannot replace the method, the headers or the signal", async () => {
    const sanity = fakeSanity([])
    const init = { method: "POST", headers: { Authorization: "Bearer other" }, signal: new AbortController().signal, cache: "force-cache", next: { revalidate: 600, tags: ["catalog"] } } as RequestInit
    await readSanityGames({ fetch: sanity.fetch, init })
    expect(sanity.calls[0]?.init).toMatchObject({ method: "GET", headers: { Accept: "application/json" }, cache: "force-cache", next: { revalidate: 600, tags: ["catalog"] } })
    expect(sanity.calls[0]?.init.signal).not.toBe(init.signal)
  })

  it("reads the project and the dataset it is told to", async () => {
    const sanity = fakeSanity([])
    await readSanityGames({ fetch: sanity.fetch, projectId: "abc123", dataset: "staging" })
    expect(sanity.calls[0]?.url.origin).toBe("https://abc123.apicdn.sanity.io")
    expect(sanity.calls[0]?.url.pathname).toBe(`/v${SANITY_API_VERSION}/data/query/staging`)
  })

  it("asks for what the reader maps: the query names each field", () => {
    for (const field of ["kind", "playersMin", "playersMax", "duration", "minAge", "complexity", "releaseDate", "bggId", "order", "description", "rulesFr", "rulesEn", "rulesEs", "rulesDe", "categories", "creators", "publishers", "related", "baseGame", "logo", "icon", "background"]) {
      expect(CATALOG_QUERY, field).toContain(field)
    }
  })
})

describe("when Sanity cannot be read", () => {
  it("says the status and the reason Sanity gave", async () => {
    const error = await failureOf(read(sanityFailure(400, "unexpected token in query")))
    expect(error).toMatchObject({ name: "SanityError", status: 400, message: "Sanity answered 400: unexpected token in query" })
  })

  it("says the status alone when the answer has no reason, or is not JSON", async () => {
    expect((await failureOf(read({ status: 503, body: {} }))).message).toBe("Sanity answered 503")
    const notJson = (async () => new Response("<html>bad gateway</html>", { status: 502 })) as typeof fetch
    expect(await failureOf(readSanityGames({ fetch: notJson }))).toMatchObject({ status: 502, message: "Sanity answered 502" })
  })

  it("cuts a long reason", async () => {
    const error = await failureOf(read(sanityFailure(500, "x".repeat(500))))
    expect(error.message.length).toBeLessThan(260)
  })

  it("says only the kind of failure when Sanity cannot be reached, and nothing of the request", async () => {
    const down = (async () => {
      throw new TypeError("fetch failed for https://mhgqs6fe.apicdn.sanity.io/...")
    }) as typeof fetch
    const error = await failureOf(readSanityGames({ fetch: down }))
    expect(error).toMatchObject({ status: 0, message: "The platform's Sanity project could not be reached (TypeError)" })
    expect(error.message).not.toContain("apicdn")
  })

  it("gives up on a request that takes longer than the timeout", async () => {
    const slow = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason))
      })) as unknown as typeof fetch
    const error = await failureOf(readSanityGames({ fetch: slow, timeoutMs: 20 }))
    expect(error).toMatchObject({ status: 0, message: "The platform's Sanity project could not be reached (TimeoutError)" })
  })

  it("rejects an answer that is not a list of games", async () => {
    const odd = (async () => new Response(JSON.stringify({ result: { not: "a list" } }), { status: 200 })) as typeof fetch
    expect(await failureOf(readSanityGames({ fetch: odd }))).toMatchObject({ status: 200, message: "Sanity answered with something that is not a list of games" })
  })
})

describe("a published game", () => {
  it("is read field by field", async () => {
    const read = await readSanityGames({
      fetch: fakeSanity([
        sanityGame("hanabi", {
          _updatedAt: "2026-10-30T12:00:00Z",
          name: "Hanabi",
          order: 30,
          bggId: 98778,
          releaseDate: "2010-01-01",
          playersMin: 2,
          playersMax: 5,
          duration: 25,
          minAge: 8,
          complexity: 1.74,
          description: "A cooperative card game.",
          rulesFr: "https://example.com/hanabi-fr.pdf",
          rulesEn: "https://example.com/hanabi-en.pdf",
          categories: ["Cooperation", "Deduction"],
          creators: [
            { name: "Antoine Bauza", roles: ["artist", "designer"] },
            { name: "Laura Michaud", roles: ["artist"] },
          ],
          publishers: [{ name: "Cocktail Games", url: "https://www.cocktailgames.com" }],
          related: ["the-mind"],
          baseGame: null,
          logo: cdn("logo-1600x476.webp"),
          icon: null,
          background: cdn("background-2400x1200.svg"),
        }),
        sanityGame("the-mind", { name: "The Mind" }),
      ]).fetch,
    })
    expect(read.skipped).toEqual([])
    expect(read.warnings).toEqual([])
    expect(read.games[0]).toEqual({
      slug: "hanabi",
      name: "Hanabi",
      descriptions: { en: "A cooperative card game." },
      players: { min: 2, max: 5 },
      duration: 25,
      complexity: 1.74,
      bggId: 98778,
      releaseDate: "2010-01-01",
      age: 8,
      categories: ["Cooperation", "Deduction"],
      creators: [
        { name: "Antoine Bauza", roles: ["designer", "artist"] },
        { name: "Laura Michaud", roles: ["artist"] },
      ],
      publishers: [{ name: "Cocktail Games", url: "https://www.cocktailgames.com" }],
      rules: { fr: "https://example.com/hanabi-fr.pdf", en: "https://example.com/hanabi-en.pdf" },
      pictures: { logo: cdn("logo-1600x476.webp"), icon: null, background: cdn("background-2400x1200.svg") },
      related: ["the-mind"],
      order: 30,
      updatedAt: "2026-10-30T12:00:00Z",
    })
  })

  it("is read as nothing but a name and a slug when every other field is empty", async () => {
    expect(await one({ name: "Sample", categories: null, creators: null, publishers: null, related: null, logo: null })).toEqual({
      slug: "sample",
      name: "Sample",
      descriptions: {},
      players: null,
      duration: null,
      complexity: null,
      bggId: null,
      releaseDate: null,
      age: null,
      categories: [],
      creators: [],
      publishers: [],
      rules: {},
      pictures: { logo: null, icon: null, background: null },
      related: [],
      order: null,
      updatedAt: "2026-10-30T10:00:00Z",
    })
  })

  it("takes the name as it is typed, white space and control characters cut", async () => {
    expect((await one({ name: "  Skull \t King\u0007 " })).name).toBe("Skull King")
  })

  it("is plain data: it goes through the cache as JSON and comes back the same", async () => {
    const { games } = await read([sanityGame("a", { name: "A", playersMin: 2, creators: [{ name: "P", roles: ["designer"] }], logo: cdn("a.webp") })])
    expect(JSON.parse(JSON.stringify(games))).toEqual(games)
  })

  it.each([
    [{ playersMin: 2, playersMax: 5 }, { min: 2, max: 5 }],
    [{ playersMin: 3 }, { min: 3, max: null }],
    [{ playersMin: 3, playersMax: null }, { min: 3, max: null }],
    [{ playersMin: 4, playersMax: 4 }, { min: 4, max: 4 }],
    [{ playersMin: 5, playersMax: 2 }, { min: 5, max: null }],
    [{ playersMin: 0 }, null],
    [{ playersMin: 1.5 }, null],
    [{ playersMax: 4 }, null],
    [{}, null],
  ])("reads the players %j as %j", async (fields, players) => {
    expect((await one(fields)).players).toEqual(players)
  })

  it.each([
    [25, 25],
    [0, null],
    [-5, null],
    [1.5, null],
    ["25", null],
    [null, null],
  ])("reads the duration %j as %j", async (minutes, duration) => {
    expect((await one({ duration: minutes })).duration).toBe(duration)
  })

  it.each([
    [1, 1],
    [2.35, 2.35],
    [5, 5],
    [0, null],
    [0.9, null],
    [5.01, null],
    [null, null],
  ])("reads the complexity %j as %j", async (weight, complexity) => {
    expect((await one({ complexity: weight })).complexity).toBe(complexity)
  })

  it.each([
    [8, 8],
    [0, null],
    [8.5, null],
    [null, null],
  ])("reads the minimum age %j as %j", async (years, age) => {
    expect((await one({ minAge: years })).age).toBe(age)
  })

  it.each([
    [98778, 98778],
    [0, null],
    [-4, null],
    [1.5, null],
    [null, null],
  ])("reads the BGG id %j as %j", async (id, bggId) => {
    expect((await one({ bggId: id })).bggId).toBe(bggId)
  })

  it.each([
    ["2010-01-01", "2010-01-01"],
    ["2024-02-29", "2024-02-29"],
    ["2023-02-29", null],
    ["2010-13-01", null],
    ["2010", null],
    ["2010-01-01T10:00:00Z", null],
    [null, null],
  ])("reads the release date %j as %j", async (day, releaseDate) => {
    expect((await one({ releaseDate: day })).releaseDate).toBe(releaseDate)
  })

  it.each([
    [0, 0],
    [30, 30],
    [-1, null],
    [2.5, null],
    [null, null],
  ])("reads the order %j as %j", async (value, order) => {
    expect((await one({ order: value })).order).toBe(order)
  })

  it("takes the description as the English one, trimmed, its line breaks kept, and none for an empty text", async () => {
    expect((await one({ description: "  First.\n\nSecond.\u0007  " })).descriptions).toEqual({ en: "First.\n\nSecond." })
    expect((await one({ description: "   " })).descriptions).toEqual({})
    expect((await one({ description: 12 })).descriptions).toEqual({})
  })

  it("keeps a rulebook link only when it is an http or https address, per language", async () => {
    const game = await one({ rulesFr: "javascript:alert(1)", rulesEn: "  https://example.com/en.pdf  ", rulesEs: "ftp://example.com/es.pdf", rulesDe: "not a link" })
    expect(game.rules).toEqual({ en: "https://example.com/en.pdf" })
    expect((await one({ rulesFr: "http://example.com/fr.pdf" })).rules).toEqual({ fr: "http://example.com/fr.pdf" })
  })

  it("keeps the categories in order, each once, and drops what is not a name (a reference to a document that is not published)", async () => {
    expect((await one({ categories: ["Party", null, "Cards", "Party", "  Co-op \t", 7] })).categories).toEqual(["Party", "Cards", "Co-op"])
  })

  it("keeps a publisher that has a name, its address only when it is http(s), and drops a reference that was not published", async () => {
    const game = await one({
      publishers: [{ name: "First", url: "https://first.example.com" }, null, { name: "  ", url: "https://nameless.example.com" }, { name: "Second", url: "javascript:alert(1)" }, { name: "Third" }],
    })
    expect(game.publishers).toEqual([
      { name: "First", url: "https://first.example.com" },
      { name: "Second", url: null },
      { name: "Third", url: null },
    ])
  })

  describe("its creators", () => {
    it("are the people of its credits, each with the roles of the list in the order of the list", async () => {
      const game = await one({ creators: [{ name: "A", roles: ["insertDesigner", "designer", "sculptor"] }] })
      expect(game.creators).toEqual([{ name: "A", roles: ["designer", "sculptor", "insertDesigner"] }])
    })

    it("lose a role the list does not have, a line with no role left, a person with no name (a reference to a document that was not published), and an entry that is not a line", async () => {
      const game = await one({
        creators: [
          { name: "Kept", roles: ["artist", "composer"] },
          { name: "No known role", roles: ["composer"] },
          { name: "No roles", roles: [] },
          { name: null, roles: ["designer"] },
          { roles: ["designer"] },
          "Not a line",
          null,
          { name: "Roles that are not a list", roles: "designer" },
        ],
      })
      expect(game.creators).toEqual([{ name: "Kept", roles: ["artist"] }])
    })

    it("keep the order of the lines", async () => {
      const game = await one({
        creators: [
          { name: "Second in the alphabet", roles: ["artist"] },
          { name: "First", roles: ["designer"] },
        ],
      })
      expect(game.creators.map((creator) => creator.name)).toEqual(["Second in the alphabet", "First"])
    })
  })

  describe("its pictures", () => {
    it("are the files of the image CDN of the project that was read", async () => {
      const game = await one({ logo: cdn("a-100x100.png"), icon: cdn("b-10x10.svg"), background: cdn("c-1x1.webp") })
      expect(game.pictures).toEqual({ logo: cdn("a-100x100.png"), icon: cdn("b-10x10.svg"), background: cdn("c-1x1.webp") })
    })

    it.each([
      ["another project", cdn("a-1x1.png", "other", PLATFORM_DATASET)],
      ["another dataset", cdn("a-1x1.png", PLATFORM_PROJECT_ID, "staging")],
      ["another host", "https://example.com/a-1x1.png"],
      ["a link that is not https", `http://cdn.sanity.io/images/${PLATFORM_PROJECT_ID}/${PLATFORM_DATASET}/a-1x1.png`],
      ["a text that is not a link", "logo.png"],
      ["a value that is not a text", 12],
    ])("are none for %s", async (_label, value) => {
      expect((await one({ logo: value })).pictures.logo).toBeNull()
    })
  })
})

describe("the games a game is related to", () => {
  const slugsOf = async (docs: Record<string, unknown>[]) => Object.fromEntries((await read(docs)).games.map((game) => [game.slug, game.related]))

  it("are the games its related list names, then its base game, each once, in the order given", async () => {
    const related = await slugsOf([sanityGame("a", { related: ["c", "b", "c"], baseGame: "d" }), sanityGame("b"), sanityGame("c"), sanityGame("d")])
    expect(related.a).toEqual(["c", "b", "d"])
  })

  it("never include the game itself", async () => {
    expect((await slugsOf([sanityGame("a", { related: ["a", "b"], baseGame: "a" }), sanityGame("b")])).a).toEqual(["b"])
  })

  it("leave out a game that is not in the catalog: not published (a null), left out by the reader, or unknown", async () => {
    const related = await slugsOf([sanityGame("a", { related: [null, "ghost", "api", "b"] }), sanityGame("b"), sanityGame("api")])
    expect(related.a).toEqual(["b"])
  })

  it("are one side of the link: the other game is not told", async () => {
    const related = await slugsOf([sanityGame("a", { related: ["b"] }), sanityGame("b")])
    expect(related.b).toEqual([])
  })
})

describe("a document that is not a game of the site", () => {
  it("is skipped with its reason, and the others are read", async () => {
    const reading = await read([
      sanityGame("kept", { name: "Kept" }),
      sanityGame("nameless", { _id: "game-nameless", name: null }),
      sanityGame("Bad Slug", { _id: "game-bad", name: "Bad" }),
      sanityGame("api", { _id: "game-api", name: "Api" }),
      sanityGame("x".repeat(41), { _id: "game-long", name: "Long" }),
    ])
    expect(reading.games.map((game) => game.slug)).toEqual(["kept"])
    expect(reading.skipped.map((game) => [game.id, game.name])).toEqual([
      ["game-nameless", ""],
      ["game-bad", "Bad"],
      ["game-api", "Api"],
      ["game-long", "Long"],
    ])
    expect(reading.skipped[0]?.reason).toBe("it has no name")
    expect(reading.skipped[1]?.reason).toContain("is not a slug")
    expect(reading.skipped[2]?.reason).toContain("a route of the site")
    expect(reading.skipped[3]?.reason).toContain("40 at most")
  })

  it("is skipped when an older game has its slug: the older game wins", async () => {
    const reading = await read([sanityGame("one", { _id: "older", name: "Older" }), sanityGame("one", { _id: "newer", name: "Newer" })])
    expect(reading.games.map((game) => game.name)).toEqual(["Older"])
    expect(reading.skipped).toEqual([{ id: "newer", name: "Newer", reason: 'its slug "one" is already the one of an older game' }])
  })

  it("is skipped when its name or its slug is not a text, without failing", async () => {
    const reading = await read([{ _id: "x", name: 12, slug: "x" }, { _id: "y", name: "Y", slug: 5 }, null, "text"])
    expect(reading.games).toEqual([])
    expect(reading.skipped.map((game) => game.id)).toEqual(["x", "y"])
  })

  it("never lets a control character reach the name or the reason of a skipped row", async () => {
    const reading = await read([sanityGame("Bad\u001b[31m", { name: "Name\u001b[31m" })])
    expect(JSON.stringify(reading.skipped)).not.toMatch(/\u001b/)
  })
})

describe("an expansion", () => {
  it("is counted and left out, never reported: it is played with another game, so it has no page", async () => {
    const reading = await read([
      sanityGame("flip-7", { name: "Flip 7", kind: "game" }),
      sanityGame("flip-7-more", { name: "Flip 7: More", kind: "expansion", baseGame: "flip-7" }),
      // a name that is no name does not make it a skipped game: it is an expansion first
      sanityGame("nameless-more", { _id: "game-nameless-more", name: null, kind: "expansion" }),
    ])
    expect(reading.games.map((game) => game.slug)).toEqual(["flip-7"])
    expect(reading.expansions).toBe(2)
    expect(reading.skipped).toEqual([])
    expect(reading.warnings).toEqual([])
  })

  it("is no link of its base game or of any game: a link to it is dropped", async () => {
    const reading = await read([
      sanityGame("flip-7", { name: "Flip 7", related: ["flip-7-more", "skyjo"] }),
      sanityGame("flip-7-more", { name: "Flip 7: More", kind: "expansion", baseGame: "flip-7" }),
      sanityGame("skyjo", { name: "Skyjo" }),
    ])
    expect(reading.games.find((game) => game.slug === "flip-7")?.related).toEqual(["skyjo"])
  })

  it("is not a reimplementation, a game of its own that rebuilds another one: that one is listed, linked to its base game", async () => {
    const reading = await read([sanityGame("flip-7", { name: "Flip 7" }), sanityGame("flip-7-vengeance", { name: "Flip 7 Vengeance", kind: "reimplementation", baseGame: "flip-7" })])
    expect(reading.games.map((game) => game.slug)).toEqual(["flip-7", "flip-7-vengeance"])
    expect(reading.games[1]?.related).toEqual(["flip-7"])
    expect(reading.expansions).toBe(0)
  })

  it("is not what a document with no kind is: it is a game", async () => {
    const reading = await read([sanityGame("sample", { name: "Sample", kind: undefined })])
    expect(reading.games.map((game) => game.slug)).toEqual(["sample"])
    expect(reading.expansions).toBe(0)
  })
})

describe("an empty project", () => {
  it("has no game, and says so: the hub then lists the live games of the registry alone", async () => {
    expect(await read([])).toEqual({ games: [], skipped: [], expansions: 0, warnings: ["The platform's Sanity project has no published game: the hub lists the live games of the registry alone"] })
  })
})
