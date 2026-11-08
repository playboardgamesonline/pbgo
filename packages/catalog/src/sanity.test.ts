import { GALLERY_MAX, HELPERS_MAX } from "@pbgo/studio-kit/constants"
import { describe, expect, it } from "vitest"
import type { CatalogGame } from "./catalog"
import { CATALOG_QUERY, PLATFORM_DATASET, PLATFORM_PROJECT_ID, SANITY_API_VERSION, SanityError, readSanityGames } from "./sanity"
import { cdn, cdnFile, fakeSanity, sanityExpansion, sanityFailure, sanityGame, type SanityAnswer } from "./testing"

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

  it("carries the language of the read as a parameter of the query: English unless it is told another", async () => {
    const sanity = fakeSanity([])
    await readSanityGames({ fetch: sanity.fetch })
    await readSanityGames({ fetch: sanity.fetch, language: "fr" })
    expect(sanity.calls.map((call) => call.url.searchParams.get("$language"))).toEqual(['"en"', '"fr"'])
    expect(CATALOG_QUERY).toContain("$language")
  })

  it("asks for what the reader maps: the query names each field", () => {
    for (const field of ["_createdAt", "kind", "playersMin", "playersMax", "duration", "minAge", "complexity", "releaseDate", "bggId", "buyUrl", "order", "description", "rules", "rulesFr", "rulesEn", "rulesEs", "rulesDe", "categories", "creators", "publishers", "related", "baseGame", "logo", "icon", "background", "gallery", "video", "poster", "helpers", "cover", "boxFront"]) {
      expect(CATALOG_QUERY, field).toContain(field)
    }
  })

  it("asks for the games and the expansions as two lists, each of its own document type, so that neither can be read as the other", () => {
    expect(CATALOG_QUERY).toMatch(/"games": \*\[_type == "game" && /)
    expect(CATALOG_QUERY).toMatch(/"expansions": \*\[_type == "expansion" && /)
    // the credits and the placing of a game are not asked of an expansion, nor the pictures of a game: the lobby draws a cover or a box, and says what the expansion changes (its figures, the categories it brings)
    const expansions = CATALOG_QUERY.slice(CATALOG_QUERY.indexOf('"expansions"'))
    for (const field of ["kind", "related", "logo", "icon", "background"]) expect(expansions, field).not.toContain(field)
    for (const field of ["playersMin", "playersMax", "duration", "minAge", "complexity", "categories", "description"]) expect(expansions, field).toContain(field)
    // an expansion has no `order` field (`order(` is the sort of the list)
    expect(expansions).not.toMatch(/\border\b(?!\()/)
    expect(expansions).toContain('"baseGame": baseGame->slug.current')
  })

  it("asks for the cover of a game too, a translated picture picked like its logo: the language of the read, else English, else the plain image of the model before the translations", () => {
    const games = CATALOG_QUERY.slice(0, CATALOG_QUERY.indexOf('"expansions"'))
    expect(games).toContain('"cover": coalesce(cover[language == $language][0].value.asset->url, cover[language == "en"][0].value.asset->url, cover.asset->url)')
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

  it.each([
    ["an object that is no list", { not: "a list" }],
    ["one list, as the query answered before expansions were documents of their own", []],
    ["games alone", { games: [] }],
    ["expansions alone", { expansions: [] }],
    ["lists that are not lists", { games: "all", expansions: null }],
    ["nothing", null],
  ])("rejects an answer that is not a list of games and a list of expansions: %s", async (_label, result) => {
    const odd = (async () => new Response(JSON.stringify({ result }), { status: 200 })) as typeof fetch
    expect(await failureOf(readSanityGames({ fetch: odd }))).toMatchObject({ status: 200, message: "Sanity answered with something that is not a list of games and a list of expansions" })
  })
})

describe("a published game", () => {
  it("is read field by field", async () => {
    const read = await readSanityGames({
      fetch: fakeSanity([
        sanityGame("hanabi", {
          _createdAt: "2026-10-29T08:15:00Z",
          _updatedAt: "2026-10-30T12:00:00Z",
          name: "Hanabi",
          order: 30,
          bggId: 98778,
          buyUrl: "https://shop.example/hanabi",
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
          cover: cdn("cover-640x480.webp"),
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
      buyUrl: "https://shop.example/hanabi",
      releaseDate: "2010-01-01",
      age: 8,
      categories: ["Cooperation", "Deduction"],
      creators: [
        { name: "Antoine Bauza", roles: ["designer", "artist"] },
        { name: "Laura Michaud", roles: ["artist"] },
      ],
      publishers: [{ name: "Cocktail Games", url: "https://www.cocktailgames.com" }],
      rules: { fr: "https://example.com/hanabi-fr.pdf", en: "https://example.com/hanabi-en.pdf" },
      pictures: { logo: cdn("logo-1600x476.webp"), icon: null, background: cdn("background-2400x1200.svg"), cover: cdn("cover-640x480.webp") },
      gallery: [],
      helpers: [],
      related: ["the-mind"],
      order: 30,
      updatedAt: "2026-10-30T12:00:00Z",
      addedAt: "2026-10-29T08:15:00Z",
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
      buyUrl: null,
      releaseDate: null,
      age: null,
      categories: [],
      creators: [],
      publishers: [],
      rules: {},
      pictures: { logo: null, icon: null, background: null, cover: null },
      gallery: [],
      helpers: [],
      related: [],
      order: null,
      updatedAt: "2026-10-30T10:00:00Z",
      addedAt: "2026-10-30T09:00:00Z",
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
    ["https://shop.example/hanabi", "https://shop.example/hanabi"],
    ["  https://shop.example/hanabi?ref=pbgo  ", "https://shop.example/hanabi?ref=pbgo"],
    ["http://shop.example/hanabi", "http://shop.example/hanabi"],
    ["javascript:alert(1)", null],
    ["shop.example/hanabi", null],
    ["", null],
    [12, null],
    [null, null],
  ])("reads the link to buy the game %j as %j: only a web address is ever opened", async (link, buyUrl) => {
    expect((await one({ buyUrl: link })).buyUrl).toBe(buyUrl)
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
    ["2026-10-30T14:02:41Z", "2026-10-30T14:02:41Z"],
    ["2026-11-02T09:30:00.123Z", "2026-11-02T09:30:00.123Z"],
    ["2026-11-02T11:30:00+02:00", "2026-11-02T11:30:00+02:00"],
    ["2026-11-02", null],
    ["2026-13-45T10:00:00Z", null],
    ["yesterday", null],
    ["", null],
    [20261102, null],
    [null, null],
  ])("reads the day it was added, the _createdAt %j, as %j", async (value, addedAt) => {
    expect((await one({ _createdAt: value })).addedAt).toBe(addedAt)
  })

  it("reads no day for a game that comes without _createdAt", async () => {
    const document = sanityGame("sample", { name: "Sample" })
    delete document._createdAt
    expect((await read([document])).games[0]?.addedAt).toBeNull()
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

  it("reads the links to the rules from the rows of `rules`, a row over the old field of its language, and the old field where the game has no row", async () => {
    const rows = [{ language: "fr", link: "https://example.com/new-fr.pdf" }, { language: "es", link: "https://example.com/es.pdf" }, { language: "zh", link: "https://example.com/zh.pdf" }]
    expect((await one({ rules: rows })).rules).toEqual({ fr: "https://example.com/new-fr.pdf", es: "https://example.com/es.pdf" })
    expect((await one({ rules: rows, rulesFr: "https://example.com/old-fr.pdf", rulesDe: "https://example.com/old-de.pdf" })).rules).toEqual({
      fr: "https://example.com/new-fr.pdf",
      es: "https://example.com/es.pdf",
      de: "https://example.com/old-de.pdf",
    })
  })

  it("keeps a link of a row only when it is an http or https address, falling back on the old field of the language, and ignores a row that is not one", async () => {
    const rows = [{ language: "fr", link: "javascript:alert(1)" }, { language: "en", link: "  https://example.com/en.pdf  " }, "x", null, { language: "de" }, { link: "https://example.com/none.pdf" }]
    expect((await one({ rules: rows, rulesFr: "https://example.com/old-fr.pdf" })).rules).toEqual({ fr: "https://example.com/old-fr.pdf", en: "https://example.com/en.pdf" })
    expect((await one({ rules: "not a list" })).rules).toEqual({})
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
      const game = await one({ logo: cdn("a-100x100.png"), icon: cdn("b-10x10.svg"), background: cdn("c-1x1.webp"), cover: cdn("d-640x480.webp") })
      expect(game.pictures).toEqual({ logo: cdn("a-100x100.png"), icon: cdn("b-10x10.svg"), background: cdn("c-1x1.webp"), cover: cdn("d-640x480.webp") })
    })

    it("have a cover that is none when the game has none, whatever else it has", async () => {
      const game = await one({ logo: cdn("a-100x100.png"), background: cdn("c-1x1.webp") })
      expect(game.pictures.cover).toBeNull()
    })

    it.each([
      ["another project", cdn("a-1x1.png", "other", PLATFORM_DATASET)],
      ["another dataset", cdn("a-1x1.png", PLATFORM_PROJECT_ID, "staging")],
      ["another host", "https://example.com/a-1x1.png"],
      ["a link that is not https", `http://cdn.sanity.io/images/${PLATFORM_PROJECT_ID}/${PLATFORM_DATASET}/a-1x1.png`],
      ["a text that is not a link", "logo.png"],
      ["a value that is not a text", 12],
    ])("are none for %s", async (_label, value) => {
      const game = await one({ logo: value, cover: value })
      expect([game.pictures.logo, game.pictures.cover]).toEqual([null, null])
    })
  })
})

describe("its gallery", () => {
  const picture = (name: string, extra: Record<string, unknown> = {}) => ({ image: cdn(name), ...extra })
  const clip = (name: string, extra: Record<string, unknown> = {}) => ({ video: cdnFile(name), ...extra })

  it("is the pictures and the clips of the Studio's list, in its order, with what they show", async () => {
    const game = await one({
      gallery: [
        clip("table-1.mp4", { poster: cdn("poster-1.jpg"), caption: "  Playing a \t card  " }),
        picture("night.jpg", { caption: "The estate" }),
        clip("table-2.webm"),
      ],
    })
    expect(game.gallery).toEqual([
      { kind: "video", url: cdnFile("table-1.mp4"), poster: cdn("poster-1.jpg"), caption: "Playing a card" },
      { kind: "image", url: cdn("night.jpg"), caption: "The estate" },
      { kind: "video", url: cdnFile("table-2.webm"), poster: null, caption: null },
    ])
  })

  it.each([[undefined], [null], [[]], ["a list"], [{ not: "a list" }]])("is empty when the Studio's list is %j", async (gallery) => {
    expect((await one({ gallery })).gallery).toEqual([])
  })

  it("leaves out an item that is not an object or has no file", async () => {
    const game = await one({ gallery: ["picture.jpg", null, 12, {}, { caption: "Nothing to show" }, picture("kept.jpg")] })
    expect(game.gallery).toEqual([{ kind: "image", url: cdn("kept.jpg"), caption: null }])
  })

  it.each([
    ["a clip of another project", clip("a.mp4").video.replace(PLATFORM_PROJECT_ID, "other")],
    ["a clip of another dataset", clip("a.mp4").video.replace(PLATFORM_DATASET, "staging")],
    ["a clip on another host", "https://example.com/a.mp4"],
    ["a clip that is not https", `http://cdn.sanity.io/files/${PLATFORM_PROJECT_ID}/${PLATFORM_DATASET}/a.mp4`],
    ["a file that is not a clip a page plays", cdnFile("a.mov")],
    ["a clip in the image CDN", cdn("a.mp4")],
  ])("leaves out %s: the hub never points a visitor anywhere else", async (_label, video) => {
    expect((await one({ gallery: [{ video }, picture("kept.jpg")] })).gallery).toEqual([{ kind: "image", url: cdn("kept.jpg"), caption: null }])
  })

  it("keeps a clip's poster only when it is a picture of the project", async () => {
    const game = await one({ gallery: [clip("a.mp4", { poster: "https://example.com/poster.jpg" }), clip("b.mp4", { poster: cdn("p.jpg", "other", PLATFORM_DATASET) })] })
    expect(game.gallery.map((item) => (item.kind === "video" ? item.poster : "image"))).toEqual([null, null])
  })

  it("is cut to what the Studio lets in, after the items that were left out", async () => {
    const items = [{ video: "https://example.com/no.mp4" }, ...Array.from({ length: 8 }, (_, n) => picture(`p${n}.jpg`))]
    const game = await one({ gallery: items })
    expect(game.gallery).toHaveLength(GALLERY_MAX)
    expect(game.gallery.map((item) => item.url)).toEqual(Array.from({ length: GALLERY_MAX }, (_, n) => cdn(`p${n}.jpg`)))
  })

  it("has captions of a line, cut at a hundred and forty characters", async () => {
    const [item] = (await one({ gallery: [picture("a.jpg", { caption: `${"x".repeat(200)}\u0007` })] })).gallery
    expect(item?.caption).toBe("x".repeat(140))
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

describe("its helpers", () => {
  it("are the aids of the Studio's list, in its order: a key and a name each", async () => {
    const game = await one({
      helpers: [
        { key: "show-score", title: "  Show the score  calculation " },
        { key: "hints", title: "Hints" },
      ],
    })
    expect(game.helpers).toEqual([
      { key: "show-score", title: "Show the score calculation" },
      { key: "hints", title: "Hints" },
    ])
  })

  it("are none when the Studio has none, or when what it has is not a list", async () => {
    expect((await one({})).helpers).toEqual([])
    expect((await one({ helpers: null })).helpers).toEqual([])
    expect((await one({ helpers: "show-score" })).helpers).toEqual([])
  })

  it("leave out a helper that is no object, has no name or has no key the game could call it by, and a key that is already taken", async () => {
    const game = await one({
      helpers: [
        "show-score",
        { key: "no-title", title: "   " },
        { title: "No key" },
        { key: "Show Score", title: "A key in capitals" },
        { key: "x".repeat(41), title: "A key that is too long" },
        { key: "kept", title: "Kept" },
        { key: "kept", title: "The same key again" },
      ],
    })
    expect(game.helpers).toEqual([{ key: "kept", title: "Kept" }])
  })

  it("hold as many as the Studio allows, the first ones, and a name no longer than it allows", async () => {
    const many = Array.from({ length: HELPERS_MAX + 3 }, (_, index) => ({ key: `helper-${index}`, title: `Helper ${index}` }))
    expect((await one({ helpers: many })).helpers.map((helper) => helper.key)).toEqual(many.slice(0, HELPERS_MAX).map((helper) => helper.key))
    const [long] = (await one({ helpers: [{ key: "long", title: "t".repeat(120) }] })).helpers
    expect(long?.title).toHaveLength(80)
  })
})

describe("an expansion", () => {
  it("is no game of the hub, so it has no page: it is read apart, for the lobby of its base game to offer", async () => {
    const reading = await read([sanityGame("flip-7", { name: "Flip 7", kind: "game" }), sanityExpansion("flip-7-more", { name: "Flip 7: More", baseGame: "flip-7" })])
    expect(reading.games.map((game) => game.slug)).toEqual(["flip-7"])
    expect(reading.expansions).toEqual([{ slug: "flip-7-more", name: "Flip 7: More", base: "flip-7", descriptions: {}, playersMin: null, playersMax: null, duration: null, age: null, complexity: null, categories: [], pictures: { cover: null, boxFront: null } }])
    expect(reading.skipped).toEqual([])
    expect(reading.warnings).toEqual([])
  })

  it("is read field by field: its name, its slug, the slug of its base game, its cover and the front of its box", async () => {
    const reading = await read([
      sanityGame("courtisans", { name: "Courtisans" }),
      sanityExpansion("courtisans-diplomats-confidants", {
        _id: "expansion-courtisans-diplomats-confidants",
        name: "  Courtisans:  Diplomates & Confidants ",
        baseGame: "courtisans",
        cover: cdn("cover-1600x900.jpg"),
        boxFront: cdn("box-800x800.png"),
      }),
    ])
    expect(reading.expansions).toEqual([
      {
        slug: "courtisans-diplomats-confidants",
        name: "Courtisans: Diplomates & Confidants",
        base: "courtisans",
        descriptions: {},
        playersMin: null,
        playersMax: null,
        duration: null,
        age: null,
        complexity: null,
        categories: [],
        pictures: { cover: cdn("cover-1600x900.jpg"), boxFront: cdn("box-800x800.png") },
      },
    ])
  })

  it("has its description, its figures and its categories as the Studio gives them: the figures that it changes, and none of the base game's", async () => {
    const reading = await read([
      sanityGame("courtisans", { name: "Courtisans", playersMax: 5, minAge: 8 }),
      sanityExpansion("diplomats", {
        name: "Diplomats",
        baseGame: "courtisans",
        description: "  New characters take a seat.\n\nThey form alliances.  ",
        playersMin: 1,
        playersMax: 6,
        duration: 30,
        minAge: 10,
        complexity: 2.5,
        categories: ["Alliances", "  Bluff ", "Alliances"],
      }),
      sanityExpansion("silent", { name: "Silent", baseGame: "courtisans" }),
    ])
    const figures = ({ slug, descriptions, playersMin, playersMax, duration, age, complexity, categories }: (typeof reading.expansions)[number]) => ({ slug, descriptions, playersMin, playersMax, duration, age, complexity, categories })
    expect(reading.expansions.map(figures)).toEqual([
      { slug: "diplomats", descriptions: { en: "New characters take a seat.\n\nThey form alliances." }, playersMin: 1, playersMax: 6, duration: 30, age: 10, complexity: 2.5, categories: ["Alliances", "Bluff"] },
      { slug: "silent", descriptions: {}, playersMin: null, playersMax: null, duration: null, age: null, complexity: null, categories: [] },
    ])
  })

  it("reads the figures only as whole numbers from 1 (a weight from 1 to 5), and a description only as text", async () => {
    const reading = await read([
      sanityGame("flip-7", { name: "Flip 7" }),
      sanityExpansion("odd", { name: "Odd", baseGame: "flip-7", description: 12, playersMin: 0, playersMax: "6", duration: 2.5, minAge: 0, complexity: 7, categories: "Cooperation" }),
      sanityExpansion("also-odd", { name: "Also odd", baseGame: "flip-7", description: "   ", playersMax: 2.5, minAge: -3, complexity: "2" }),
    ])
    expect(reading.expansions.map(({ descriptions, playersMin, playersMax, duration, age, complexity, categories }) => ({ descriptions, playersMin, playersMax, duration, age, complexity, categories }))).toEqual([
      { descriptions: {}, playersMin: null, playersMax: null, duration: null, age: null, complexity: null, categories: [] },
      { descriptions: {}, playersMin: null, playersMax: null, duration: null, age: null, complexity: null, categories: [] },
    ])
  })

  it("keeps the pictures it has when they are in the image CDN of the project, and none that is elsewhere", async () => {
    const reading = await read([
      sanityGame("flip-7", { name: "Flip 7" }),
      sanityExpansion("more", { name: "More", baseGame: "flip-7", cover: cdn("cover-1200x800.jpg"), boxFront: "https://example.com/box.png" }),
      sanityExpansion("less", { name: "Less", baseGame: "flip-7", cover: cdn("cover.png", "other", PLATFORM_DATASET), boxFront: 12 }),
    ])
    expect(reading.expansions.map((expansion) => expansion.pictures)).toEqual([
      { cover: cdn("cover-1200x800.jpg"), boxFront: null },
      { cover: null, boxFront: null },
    ])
  })

  it("is plain data: it goes through the cache as JSON and comes back the same", async () => {
    const { expansions } = await read([sanityGame("flip-7", { name: "Flip 7" }), sanityExpansion("more", { name: "More", baseGame: "flip-7", cover: cdn("cover.jpg") })])
    expect(JSON.parse(JSON.stringify(expansions))).toEqual(expansions)
  })

  it("is left out, and reported, when it cannot be offered: no name, a slug the Studio would refuse, the slug of an older expansion, no base game, a base game the hub does not list", async () => {
    const reading = await read([
      sanityGame("flip-7", { name: "Flip 7" }),
      sanityExpansion("more", { name: "More", baseGame: "flip-7" }),
      sanityExpansion("nameless-more", { name: null, baseGame: "flip-7" }),
      sanityExpansion("more", { _id: "expansion-more-2", name: "More again", baseGame: "flip-7" }),
      sanityExpansion("Not A Slug", { name: "Wrong", baseGame: "flip-7" }),
      // the base game is a `null` when it is not published
      sanityExpansion("orphan", { name: "Orphan", baseGame: null }),
      sanityExpansion("lost", { name: "Lost", baseGame: "ghost" }),
    ])
    expect(reading.games.map((game) => game.slug)).toEqual(["flip-7"])
    expect(reading.expansions.map((expansion) => expansion.slug)).toEqual(["more"])
    expect(reading.skipped).toEqual([])
    expect(reading.warnings).toHaveLength(5)
    expect(reading.warnings).toEqual([
      'The expansion "expansion-nameless-more" of the Studio is left out: it has no name',
      'The expansion "More again" of the Studio is left out: its slug "more" is already the one of an older expansion',
      expect.stringContaining('The expansion "Wrong" of the Studio is left out: "Not A Slug" is not a slug'),
      'The expansion "Orphan" of the Studio is left out: it has no base game, or its base game is not published',
      'The expansion "Lost" of the Studio is left out: its base game "ghost" is not a game the hub lists',
    ])
  })

  it("may have a slug of 48 characters where a game's is 40 at most, since it starts with its base game's: one longer is left out, and reported", async () => {
    const base = "the-werewolves-of-millers-hollow"
    const reading = await read([
      sanityGame(base, { name: "The Werewolves of Millers Hollow" }),
      sanityExpansion(`${base}-the-village`, { name: "The Village", baseGame: base }),
      sanityExpansion("x".repeat(49), { name: "Too Long", baseGame: base }),
    ])
    expect(reading.expansions.map((expansion) => expansion.slug)).toEqual([`${base}-the-village`])
    expect(reading.warnings).toEqual([expect.stringContaining(`The expansion "Too Long" of the Studio is left out: "${"x".repeat(49)}" is 49 characters long, 48 at most`)])
  })

  it("may have the slug of a game: a slug is unique among the expansions of the Studio, not between them and its games", async () => {
    const reading = await read([sanityGame("flip-7", { name: "Flip 7" }), sanityExpansion("flip-7", { name: "Flip 7: The Expansion", baseGame: "flip-7" })])
    expect(reading.expansions.map((expansion) => expansion.slug)).toEqual(["flip-7"])
    expect(reading.warnings).toEqual([])
  })

  it("never lets a control character reach a line of a warning", async () => {
    const reading = await read([sanityGame("flip-7", { name: "Flip 7" }), sanityExpansion("more", { name: "More\u001b[31m", baseGame: "ghost\u001b[31m" })])
    expect(reading.warnings).toHaveLength(1)
    expect(JSON.stringify(reading.warnings)).not.toMatch(/\u001b/)
  })

  it("comes only from the list of expansions: a document in the list of games is a game, whatever it says it is", async () => {
    const answer = { result: { games: [{ _type: "expansion", _id: "x", name: "X", slug: "x", baseGame: "flip-7" }], expansions: [] } }
    const listed = await readSanityGames({ fetch: (async () => new Response(JSON.stringify(answer), { status: 200 })) as typeof fetch })
    expect(listed.expansions).toEqual([])
    expect(listed.games.map((game) => game.slug)).toEqual(["x"])
  })

  it("is not a reimplementation, a game of its own that rebuilds another one: that one is listed, linked to its base game", async () => {
    const reading = await read([sanityGame("flip-7", { name: "Flip 7" }), sanityGame("flip-7-vengeance", { name: "Flip 7 Vengeance", kind: "reimplementation", baseGame: "flip-7" })])
    expect(reading.games.map((game) => game.slug)).toEqual(["flip-7", "flip-7-vengeance"])
    expect(reading.games[1]?.related).toEqual(["flip-7"])
    expect(reading.expansions).toEqual([])
  })

  it("is not what a document with no kind is: it is a game", async () => {
    const reading = await read([sanityGame("sample", { name: "Sample", kind: undefined })])
    expect(reading.games.map((game) => game.slug)).toEqual(["sample"])
    expect(reading.expansions).toEqual([])
  })
})

describe("a game of the kind expansion, which a game had before expansions were documents of their own", () => {
  const OLD_KIND = "its kind is expansion, which a game no longer has: an expansion is a document of its own, to be moved to one"

  it("is skipped with its reason, is no expansion either, and a link to it is dropped", async () => {
    const reading = await read([
      sanityGame("flip-7", { name: "Flip 7", related: ["flip-7-old", "skyjo"] }),
      sanityGame("flip-7-old", { _id: "game-flip-7-old", name: "Flip 7: Old", kind: "expansion", baseGame: "flip-7" }),
      sanityGame("skyjo", { name: "Skyjo" }),
    ])
    expect(reading.games.map((game) => game.slug)).toEqual(["flip-7", "skyjo"])
    expect(reading.games[0]?.related).toEqual(["skyjo"])
    expect(reading.expansions).toEqual([])
    expect(reading.skipped).toEqual([{ id: "game-flip-7-old", name: "Flip 7: Old", reason: OLD_KIND }])
  })

  it("is skipped whatever else is wrong with it, and does not take the slug of a game", async () => {
    const reading = await read([
      sanityGame("flip-7", { name: "Flip 7", kind: "expansion" }),
      sanityGame("flip-7", { _id: "game-flip-7-2", name: "Flip 7 again" }),
      sanityGame("nameless", { _id: "game-nameless", name: null, kind: "expansion" }),
    ])
    expect(reading.games.map((game) => game.name)).toEqual(["Flip 7 again"])
    expect(reading.skipped.map((game) => [game.id, game.reason])).toEqual([
      ["game-flip-7", OLD_KIND],
      ["game-nameless", OLD_KIND],
    ])
  })
})

describe("an empty project", () => {
  it("has no game, and says so: the hub then lists the live games of the registry alone", async () => {
    expect(await read([])).toEqual({ games: [], skipped: [], expansions: [], warnings: ["The platform's Sanity project has no published game: the hub lists the live games of the registry alone"] })
  })
})
