import { slugProblem } from "@pbgo/games/slug"
import { describe, expect, it } from "vitest"
import type { PlannedGame } from "./catalog"
import { CREATORS_DATABASE_ID, DEVELOPMENT_DATABASE_ID, EDITORS_DATABASE_ID, GAMES_DATABASE_ID, NOTION_VERSION, NotionError, readPictureLinks, readPlannedGames } from "./notion"
import {
  creatorPage,
  developmentDatabase,
  developmentPage,
  developmentRank,
  editorPage,
  external,
  fakeNotion,
  gamePage,
  notionFailure,
  uploaded,
  type Answer,
  type GameRow,
  type SchemaAnswer,
} from "./testing"

const TOKEN = "ntn_testsecret123"
const EDITOR_1 = "9f1c2d3e-0000-4000-8000-00000000e001"
const EDITOR_2 = "9f1c2d3e-0000-4000-8000-00000000e002"
const CREATOR_1 = "9f1c2d3e-0000-4000-8000-00000000c001"
const CREATOR_2 = "9f1c2d3e-0000-4000-8000-00000000c002"
const CREATOR_3 = "9f1c2d3e-0000-4000-8000-00000000c003"

/** What `readPlannedGames` makes of the four databases, as a fake Notion answers them. */
const readGames = (games: Answer, editors: Answer = [], creators: Answer = [], development: Answer = []) =>
  readPlannedGames({ token: TOKEN, fetch: fakeNotion({ games, editors, creators, development }).fetch })

/** The one game a row makes. */
async function one(row: GameRow = {}): Promise<PlannedGame> {
  const [game] = (await readGames([gamePage({ name: "Sample", slug: "sample", ...row })])).games
  if (!game) throw new Error("The row was not read as a game")
  return game
}

/** The error a read ends with. */
async function failureOf(read: Promise<unknown>): Promise<NotionError> {
  try {
    await read
  } catch (error) {
    if (error instanceof NotionError) return error
    throw error
  }
  throw new Error("The read was expected to fail")
}

describe("the requests", () => {
  it("asks each database once, as JSON, with the token and the API version", async () => {
    const notion = fakeNotion({ games: [gamePage()], editors: [], creators: [], development: [] })
    await readPlannedGames({ token: TOKEN, fetch: notion.fetch })
    expect(notion.calls.map((call) => call.database).sort()).toEqual([CREATORS_DATABASE_ID, DEVELOPMENT_DATABASE_ID, EDITORS_DATABASE_ID, GAMES_DATABASE_ID].sort())
    for (const call of notion.calls) {
      expect(call.init.method).toBe("POST")
      expect(call.headers).toEqual({ Authorization: `Bearer ${TOKEN}`, "Notion-Version": NOTION_VERSION, "Content-Type": "application/json" })
      // The oldest row first: two rows with one slug are settled the same way every time
      expect(call.body).toEqual({ page_size: 100, sorts: [{ timestamp: "created_time", direction: "ascending" }] })
    }
  })

  it("reads the schema of the Games Development database once, for the order of its options: a GET with the token and the API version, and no body", async () => {
    const notion = fakeNotion({ games: [gamePage()], editors: [], creators: [], development: [] })
    await readPlannedGames({ token: TOKEN, fetch: notion.fetch })
    expect(notion.schemaCalls).toHaveLength(1)
    const [call] = notion.schemaCalls
    expect(call?.database).toBe(DEVELOPMENT_DATABASE_ID)
    expect(call?.init.method).toBe("GET")
    expect(call?.init.body).toBeUndefined()
    expect(call?.headers).toEqual({ Authorization: `Bearer ${TOKEN}`, "Notion-Version": NOTION_VERSION })
  })

  it("adds the caller's options to every request, but they cannot replace the method, the headers or the body", async () => {
    const notion = fakeNotion({ games: [gamePage()], editors: [], creators: [], development: [] })
    const init: RequestInit = { method: "PUT", headers: { Authorization: "Bearer other" }, body: "{}", cache: "force-cache", next: { revalidate: 600, tags: ["catalog"] } }
    await readPlannedGames({ token: TOKEN, fetch: notion.fetch, init })
    expect(notion.calls).toHaveLength(4)
    for (const call of notion.calls) {
      expect(call.init).toMatchObject({ method: "POST", cache: "force-cache", next: { revalidate: 600, tags: ["catalog"] } })
      expect(call.headers.Authorization).toBe(`Bearer ${TOKEN}`)
      expect(call.body.page_size).toBe(100)
    }
    // The read of the schema is no exception
    expect(notion.schemaCalls).toHaveLength(1)
    expect(notion.schemaCalls[0]?.init).toMatchObject({ method: "GET", cache: "force-cache", next: { revalidate: 600, tags: ["catalog"] } })
    expect(notion.schemaCalls[0]?.init.body).toBeUndefined()
    expect(notion.schemaCalls[0]?.headers).toEqual({ Authorization: `Bearer ${TOKEN}`, "Notion-Version": NOTION_VERSION })
  })

  it("follows the cursor to the last page and keeps the order of the rows", async () => {
    const rows = ["a", "b", "c", "d", "e"].map((slug) => gamePage({ slug, name: slug.toUpperCase() }))
    const notion = fakeNotion({ games: rows, editors: [], creators: [], development: [] }, 2)
    const { games } = await readPlannedGames({ token: TOKEN, fetch: notion.fetch })
    expect(games.map((game) => game.slug)).toEqual(["a", "b", "c", "d", "e"])
    expect(notion.calls.filter((call) => call.database === GAMES_DATABASE_ID).map((call) => call.body.start_cursor)).toEqual([undefined, "2", "4"])
  })

  it("gives up on a database that never ends instead of asking for ever", async () => {
    let asked = 0
    const endless = (async () => {
      asked++
      return Response.json({ object: "list", results: [], has_more: true, next_cursor: "again" })
    }) as typeof fetch
    const error = await failureOf(readPlannedGames({ token: TOKEN, fetch: endless }))
    expect(error.message).toBe("More than 1000 rows in a database: the reader stops there")
    // Ten requests for the Games database; the Editors, Creators and Games Development ones run next to it, under the same bound each,
    // and the read of the Development schema (answered with a list, so no schema) is one more
    expect(asked).toBeGreaterThanOrEqual(10)
    expect(asked).toBeLessThanOrEqual(41)
  })
})

describe("when Notion cannot be read", () => {
  it("says the status and the code Notion gave, never the token", async () => {
    const error = await failureOf(readGames(notionFailure(401, "unauthorized", "API token is invalid.")))
    expect(error).toMatchObject({ name: "NotionError", status: 401, code: "unauthorized", message: "Notion answered 401 unauthorized: API token is invalid." })
    expect(error.message).not.toContain(TOKEN)
  })

  it("says so when the integration is not connected to the Games database", async () => {
    const error = await failureOf(readPlannedGames({ token: TOKEN, fetch: fakeNotion({ editors: [] }).fetch }))
    expect(error.status).toBe(404)
    expect(error.code).toBe("object_not_found")
    expect(error.message).toContain("shared with your integration")
  })

  it("keeps the status of an answer that is not JSON", async () => {
    const badGateway = (async () => new Response("<html>Bad gateway</html>", { status: 502 })) as typeof fetch
    const error = await failureOf(readPlannedGames({ token: TOKEN, fetch: badGateway }))
    expect(error).toMatchObject({ status: 502, code: null, message: "Notion answered 502" })
  })

  describe("and Notion says to slow down (429)", () => {
    const rateLimited = (headers: Record<string, string> = {}, status = 429) =>
      (async () => new Response(JSON.stringify({ object: "error", status, code: "rate_limited", message: "Slow down." }), { status, headers })) as typeof fetch
    const askedFor = async (headers?: Record<string, string>, status?: number) =>
      (await failureOf(readPlannedGames({ token: TOKEN, fetch: rateLimited(headers, status) }))).retryAfter

    it("keeps the seconds Notion asks to wait, rounded up", async () => {
      expect(await askedFor({ "retry-after": "2" })).toBe(2)
      expect(await askedFor({ "retry-after": "0" })).toBe(0)
      expect(await askedFor({ "retry-after": "1.2" })).toBe(2)
    })

    it("cuts a wait that is too long to be believed", async () => {
      expect(await askedFor({ "retry-after": "120" })).toBe(120)
      expect(await askedFor({ "retry-after": "86400" })).toBe(120)
    })

    it.each(["soon", "Wed, 21 Oct 2026 07:28:00 GMT", "-5", "Infinity", "0x10", "1e3", "2 s"])("does not read a Retry-After of %j", async (header) => {
      expect(await askedFor({ "retry-after": header })).toBeNull()
    })

    it("has no wait to keep when Notion did not give one, and none for any other failure", async () => {
      expect(await askedFor()).toBeNull()
      expect(await askedFor({ "retry-after": "5" }, 503)).toBeNull()
      expect((await failureOf(readGames(notionFailure(401, "unauthorized", "No.")))).retryAfter).toBeNull()
    })
  })

  it("cuts a long message from Notion", async () => {
    const error = await failureOf(readGames(notionFailure(400, "validation_error", "x".repeat(500))))
    expect(error.message).toBe(`Notion answered 400 validation_error: ${"x".repeat(200)}`)
  })

  it("rejects an answer that is not a list of rows", async () => {
    const error = await failureOf(readGames({ status: 200, body: { object: "database" } }))
    expect(error).toMatchObject({ status: 200, message: "Notion answered with something that is not a list of rows" })
  })

  it("says only the kind of failure when Notion cannot be reached: the request holds the token", async () => {
    const refused = (async () => {
      throw new TypeError(`fetch failed for Bearer ${TOKEN}`)
    }) as typeof fetch
    const error = await failureOf(readPlannedGames({ token: TOKEN, fetch: refused }))
    expect(error).toMatchObject({ status: 0, code: null, message: "Notion could not be reached (TypeError)" })
    expect(error.message).not.toContain(TOKEN)
  })

  it("gives up on a request that takes longer than the timeout", async () => {
    const hanging = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(init.signal?.reason)))) as unknown as typeof fetch
    const error = await failureOf(readPlannedGames({ token: TOKEN, fetch: hanging, timeoutMs: 20 }))
    expect(error).toMatchObject({ status: 0, message: "Notion could not be reached (TimeoutError)" })
  })

  it("reads the games without publishers, and says why, when only the Editors database fails", async () => {
    const notion = fakeNotion({
      games: [gamePage({ slug: "hanabi", name: "Hanabi", authors: [CREATOR_1], editors: [EDITOR_1] })],
      creators: [creatorPage({ id: CREATOR_1, name: "Author One" })],
      development: [],
    })
    const read = await readPlannedGames({ token: TOKEN, fetch: notion.fetch })
    expect(read.games.map((game) => [game.slug, game.authors, game.publishers])).toEqual([["hanabi", ["Author One"], []]])
    expect(read.warnings).toHaveLength(1)
    expect(read.warnings[0]).toContain("The Editors database could not be read, so no game has a publisher")
    expect(read.warnings[0]).toContain("object_not_found")
  })

  it("reads the games without authors or illustrators, and says why, when only the Creators database fails", async () => {
    const notion = fakeNotion({
      games: [gamePage({ slug: "hanabi", name: "Hanabi", authors: [CREATOR_1], illustrators: [CREATOR_2], editors: [EDITOR_1] })],
      editors: [editorPage({ id: EDITOR_1, name: "Editor One" })],
      development: [],
    })
    const read = await readPlannedGames({ token: TOKEN, fetch: notion.fetch })
    expect(read.games.map((game) => [game.slug, game.authors, game.illustrators, game.publishers])).toEqual([["hanabi", [], [], [{ name: "Editor One", url: null }]]])
    expect(read.warnings).toHaveLength(1)
    expect(read.warnings[0]).toContain("The Creators database could not be read, so no game has an author or an illustrator")
    expect(read.warnings[0]).toContain("object_not_found")
  })

  it("says so for each of them when none can be read, the Editors database first, then the Creators one, then Games Development", async () => {
    const read = await readPlannedGames({ token: TOKEN, fetch: fakeNotion({ games: [gamePage()] }).fetch })
    expect(read.warnings).toHaveLength(3)
    expect(read.warnings[0]).toContain("The Editors database could not be read")
    expect(read.warnings[1]).toContain("The Creators database could not be read")
    expect(read.warnings[2]).toContain("The Games Development database could not be read")
  })

  it("lists the warnings in the same order whichever database answers first", async () => {
    const page = gamePage()
    delete page.properties["Rules DE"]
    const notion = fakeNotion({ games: [page] })
    // The Editors database answers last: its warning must not end up behind the ones of the Creators and Games Development databases
    const lateEditors = ((input: string | URL | Request, init?: RequestInit) =>
      String(input).includes(EDITORS_DATABASE_ID) ? new Promise<Response>((resolve) => setTimeout(() => resolve(notion.fetch(input, init)), 20)) : notion.fetch(input, init)) as typeof fetch
    const read = await readPlannedGames({ token: TOKEN, fetch: lateEditors })
    expect(read.warnings.map((warning) => warning.split(" database")[0])).toEqual(["The Editors", "The Creators", "The Games Development", "The Games"])
  })
})

describe("a row of the Games database", () => {
  it("is read column by column", async () => {
    const read = await readGames(
      [
        gamePage({
          id: "11111111-aaaa-4bbb-8ccc-000000000001",
          name: "Hanabi",
          slug: "hanabi",
          players: "2 - 5",
          duration: 25,
          age: "8+",
          authors: [CREATOR_1, CREATOR_2],
          illustrators: [CREATOR_3],
          editors: [EDITOR_1],
          logo: [uploaded("logo.png")],
          icon: [external("https://example.com/icon.png")],
          descriptions: { fr: "Description FR", en: "Description EN" },
          rules: { en: "https://example.com/rules-en.pdf" },
          editedAt: "2026-10-20T10:00:00.000Z",
        }),
      ],
      [editorPage({ id: EDITOR_1, name: "Editor One", url: "https://editor.example.com" })],
      [creatorPage({ id: CREATOR_1, name: "Author One" }), creatorPage({ id: CREATOR_2, name: "Author Two" }), creatorPage({ id: CREATOR_3, name: "Illustrator One" })],
    )
    expect(read).toEqual({
      games: [
        {
          slug: "hanabi",
          name: "Hanabi",
          descriptions: { fr: "Description FR", en: "Description EN" },
          players: { min: 2, max: 5 },
          duration: 25,
          age: 8,
          authors: ["Author One", "Author Two"],
          illustrators: ["Illustrator One"],
          publishers: [{ name: "Editor One", url: "https://editor.example.com" }],
          rules: { en: "https://example.com/rules-en.pdf" },
          art: { logo: true, icon: true, background: false },
          development: { priority: null, status: null, effort: null },
          related: [],
          editedAt: "2026-10-20T10:00:00.000Z",
          notionPageId: "11111111-aaaa-4bbb-8ccc-000000000001",
        },
      ],
      skipped: [],
      expansions: 0,
      warnings: [],
    })
    expect(JSON.stringify(read)).not.toContain(TOKEN)
  })

  it("is read as nothing but a name and a slug when every other cell is empty", async () => {
    expect(await one({ name: "Hanabi", slug: "hanabi" })).toEqual({
      slug: "hanabi",
      name: "Hanabi",
      descriptions: {},
      players: null,
      duration: null,
      age: null,
      authors: [],
      illustrators: [],
      publishers: [],
      rules: {},
      art: { logo: false, icon: false, background: false },
      development: { priority: null, status: null, effort: null },
      related: [],
      editedAt: "2026-10-01T00:00:00.000Z",
      notionPageId: "game-hanabi",
    })
  })

  it("takes the name and the slug as they are typed, white space around them cut", async () => {
    const game = await one({ name: "  Skull \t King  ", slug: "  skull-king " })
    expect(game).toMatchObject({ name: "Skull King", slug: "skull-king" })
  })

  it.each([
    ["4", { min: 4, max: 4 }],
    ["1", { min: 1, max: 1 }],
    ["2 - 5", { min: 2, max: 5 }],
    ["2-5", { min: 2, max: 5 }],
    ["2 – 5", { min: 2, max: 5 }],
    ["3+", { min: 3, max: null }],
    ["5 - 2", null],
    ["0", null],
    ["many", null],
  ])("reads the Players %j as %j", async (label, players) => {
    expect((await one({ players: label })).players).toEqual(players)
  })

  it.each([
    ["6+", 6],
    ["14+", 14],
    ["8", 8],
    ["adults", null],
  ])("reads the Age %j as %j", async (label, age) => {
    expect((await one({ age: label })).age).toBe(age)
  })

  it.each([
    [25, 25],
    [0, null],
    [-5, null],
    [null, null],
  ])("reads the Duration %j as %j", async (minutes, duration) => {
    expect((await one({ duration: minutes })).duration).toBe(duration)
  })

  it("joins a text Notion cut into parts, and drops a language whose text is empty", async () => {
    const page = gamePage({ name: "Sample", slug: "sample", descriptions: { de: "Beschreibung" } })
    page.properties["Description EN"] = { type: "rich_text", rich_text: [{ plain_text: "Two " }, { plain_text: "parts\n" }] }
    page.properties["Description FR"] = { type: "rich_text", rich_text: [{ plain_text: "   " }] }
    const [game] = (await readGames([page])).games
    expect(game?.descriptions).toEqual({ en: "Two parts", de: "Beschreibung" })
  })

  it("keeps a rulebook link only when it is an http or https address", async () => {
    const game = await one({ rules: { fr: "javascript:alert(1)", en: "  https://example.com/en.pdf  ", es: "ftp://example.com/es.pdf", de: "not a link" } })
    expect(game.rules).toEqual({ en: "https://example.com/en.pdf" })
    expect((await one({ rules: { fr: "http://example.com/fr.pdf" } })).rules).toEqual({ fr: "http://example.com/fr.pdf" })
  })

  it("flags a picture only when the cell holds a link, uploaded or external", async () => {
    const game = await one({ logo: [uploaded()], icon: [external("javascript:alert(1)")], background: [] })
    expect(game.art).toEqual({ logo: true, icon: false, background: false })
    const page = gamePage({ name: "Sample", slug: "sample" })
    page.properties.Logo = { type: "files", files: [{ name: "lost.png", type: "file", file: {} }] }
    page.properties.Icon = { type: "files", files: [{ name: "second", type: "file", file: {} }, external("https://example.com/icon.png")] }
    expect((await readGames([page])).games[0]?.art).toEqual({ logo: false, icon: true, background: false })
  })

  it("does not flag a picture that is an http link: the server only fetches pictures over https", async () => {
    const game = await one({ logo: [external("http://example.com/logo.png")], icon: [external("http://example.com/icon.png"), external("https://example.com/icon.png")] })
    expect(game.art).toEqual({ logo: false, icon: true, background: false })
  })

  it("reads a cell that is not of the type it should be as empty, without failing", async () => {
    const page = gamePage({ name: "Sample", slug: "sample", players: "2 - 4", duration: 30, descriptions: { en: "Text" } })
    page.properties.Players = { type: "number", number: 3 }
    page.properties.Duration = { type: "rich_text", rich_text: [{ plain_text: "30" }] }
    page.properties["Description EN"] = { type: "number", number: 12 }
    page.properties.Age = undefined
    const [game] = (await readGames([page])).games
    expect(game).toMatchObject({ name: "Sample", players: null, duration: null, age: null, descriptions: {} })
  })
})

describe("the publishers of a row", () => {
  it("are matched by id however Notion writes the id, in the order of the relation", async () => {
    const { games } = await readGames(
      [gamePage({ editors: ["9F1C2D3E00004000800000000000E002", "unknown-id", EDITOR_1] })],
      [editorPage({ id: EDITOR_1, name: "First Editor", url: "https://first.example.com" }), editorPage({ id: EDITOR_2, name: "Second Editor" })],
    )
    expect(games[0]?.publishers).toEqual([{ name: "Second Editor", url: null }, { name: "First Editor", url: "https://first.example.com" }])
  })

  it("lose a stray tab in the name, an address that is not http(s), and a row with no name", async () => {
    const { games } = await readGames(
      [gamePage({ editors: [EDITOR_1, EDITOR_2] })],
      [editorPage({ id: EDITOR_1, name: "\tdaVinci Games", url: "javascript:alert(1)" }), editorPage({ id: EDITOR_2, name: "", url: "https://nameless.example.com" })],
    )
    expect(games[0]?.publishers).toEqual([{ name: "daVinci Games", url: null }])
  })
})

describe("the authors and the illustrators of a row", () => {
  const people = [
    creatorPage({ id: CREATOR_1, name: "Author One", roles: ["Author"] }),
    creatorPage({ id: CREATOR_2, name: "Author Two", roles: ["Author", "Illustrator"] }),
    creatorPage({ id: CREATOR_3, name: "Illustrator One", roles: ["Illustrator"] }),
  ]

  it("are matched by id however Notion writes the id, in the order of the relation, and a person can be both", async () => {
    const { games } = await readGames(
      [gamePage({ authors: ["9F1C2D3E00004000800000000000C002", "unknown-id", CREATOR_1], illustrators: [CREATOR_2, CREATOR_3] })],
      [],
      people,
    )
    expect(games[0]).toMatchObject({ authors: ["Author Two", "Author One"], illustrators: ["Author Two", "Illustrator One"] })
  })

  it("come from the column of the game, not from the Role of the person", async () => {
    const { games } = await readGames([gamePage({ authors: [CREATOR_3], illustrators: [CREATOR_1] })], [], people)
    expect(games[0]).toMatchObject({ authors: ["Illustrator One"], illustrators: ["Author One"] })
  })

  it("lose a person the Creators database does not have, one with no name, and the white space or the control characters of a name", async () => {
    const { games } = await readGames(
      [gamePage({ authors: [CREATOR_1, CREATOR_2, CREATOR_3, "unknown-id"] })],
      [],
      [creatorPage({ id: CREATOR_1, name: "  Author\tOne " }), creatorPage({ id: CREATOR_2, name: "" }), creatorPage({ id: CREATOR_3, name: "Ill \u001b Two" })],
    )
    expect(games[0]?.authors).toEqual(["Author One", "Ill Two"])
  })

  it("are found on any page of the Creators database", async () => {
    const ids = ["c100", "c101", "c102", "c103", "c104"].map((suffix) => `9f1c2d3e-0000-4000-8000-00000000${suffix}`)
    const creators = ids.map((id, index) => creatorPage({ id, name: `Person ${index}` }))
    const notion = fakeNotion({ games: [gamePage({ authors: ids.slice(4), illustrators: ids.slice(0, 1) })], editors: [], creators, development: [] }, 2)
    const { games } = await readPlannedGames({ token: TOKEN, fetch: notion.fetch })
    expect(games[0]).toMatchObject({ authors: ["Person 4"], illustrators: ["Person 0"] })
    expect(notion.calls.filter((call) => call.database === CREATORS_DATABASE_ID).map((call) => call.body.start_cursor)).toEqual([undefined, "2", "4"])
  })
})

describe("the development rank of a game", () => {
  const HANABI = "11111111-aaaa-4bbb-8ccc-000000000001"
  const BANG = "11111111-aaaa-4bbb-8ccc-000000000002"
  const SKYJO = "11111111-aaaa-4bbb-8ccc-000000000003"
  const games = [gamePage({ id: HANABI, slug: "hanabi", name: "Hanabi" }), gamePage({ id: BANG, slug: "bang", name: "Bang" }), gamePage({ id: SKYJO, slug: "skyjo", name: "Skyjo" })]
  const unranked = { hanabi: developmentRank(), bang: developmentRank(), skyjo: developmentRank() }

  /** A read of the three games with the Games Development database as given (its schema is the real one unless `schema` says otherwise): what it made of them, and its warnings. */
  async function developmentOf(development: Answer, schema?: SchemaAnswer) {
    const notion = fakeNotion({ games, editors: [], creators: [], development, ...(schema ? { developmentSchema: schema } : {}) })
    const read = await readPlannedGames({ token: TOKEN, fetch: notion.fetch })
    return { ...read, development: Object.fromEntries(read.games.map((game) => [game.slug, game.development])) }
  }

  it("is the place of each option the row of the game chose, among the options of its column", async () => {
    const { development, warnings } = await developmentOf([developmentPage({ game: [HANABI], priority: "P2 · Next", status: "Engine", effort: "L" })])
    expect(development).toEqual({ ...unranked, hanabi: { priority: { position: 1, name: "P2 · Next" }, status: { position: 2, name: "Engine" }, effort: { position: 2, name: "L" } } })
    expect(warnings).toEqual([])
  })

  it("follows the order the schema lists the options in, not the alphabet nor the names", async () => {
    const schema = developmentDatabase({ priority: ["Zeta", "Alpha"], status: ["Done", "Idea"], effort: ["Huge", "Tiny"] })
    const { development } = await developmentOf([developmentPage({ game: [HANABI], priority: "Alpha", status: "Done", effort: "Tiny" })], schema)
    expect(development.hanabi).toEqual({ priority: { position: 1, name: "Alpha" }, status: { position: 0, name: "Done" }, effort: { position: 1, name: "Tiny" } })
  })

  it("finds the row of a game by the id of its page, however Notion writes the id", async () => {
    const { development } = await developmentOf([developmentPage({ game: [HANABI.replace(/-/g, "").toUpperCase()], priority: "P1 · Now" })])
    expect(development.hanabi).toEqual(developmentRank({ priority: "P1 · Now" }))
  })

  it("is empty for a game with no row, and a row of no game, or of a game that is not read, ranks nobody", async () => {
    const { development } = await developmentOf([
      developmentPage({ slug: "orphan", priority: "P1 · Now", status: "Live", effort: "S" }),
      developmentPage({ slug: "gone", game: ["99999999-aaaa-4bbb-8ccc-000000000009"], priority: "P1 · Now" }),
      developmentPage({ slug: "bang", game: [BANG], priority: "P3 · Later" }),
    ])
    expect(development).toEqual({ ...unranked, bang: developmentRank({ priority: "P3 · Later" }) })
  })

  it("goes to every game a row points to", async () => {
    const { development } = await developmentOf([developmentPage({ game: [HANABI, BANG], status: "Playtest" })])
    expect(development).toEqual({ ...unranked, hanabi: developmentRank({ status: "Playtest" }), bang: developmentRank({ status: "Playtest" }) })
  })

  it("is the whole row of the older one when a game has two", async () => {
    const { development } = await developmentOf([
      developmentPage({ slug: "hanabi", game: [HANABI], priority: "P2 · Next" }),
      developmentPage({ slug: "hanabi-copy", game: [HANABI], priority: "P1 · Now", status: "Live" }),
    ])
    expect(development.hanabi).toEqual(developmentRank({ priority: "P2 · Next" }))
  })

  it("leaves a column empty when the cell is empty, when its option is not one of the column's, or when the cell is not of the type it should be", async () => {
    const wrongType = developmentPage({ slug: "bang", game: [BANG], status: "Live", effort: "S" })
    wrongType.properties.Priority = { type: "number", number: 1 }
    const { development, warnings } = await developmentOf([developmentPage({ slug: "hanabi", game: [HANABI], priority: "P9 · Retired", status: null, effort: "M" }), wrongType])
    expect(development).toEqual({ ...unranked, hanabi: developmentRank({ effort: "M" }), bang: developmentRank({ status: "Live", effort: "S" }) })
    expect(warnings).toEqual([])
  })

  it("does not count a row that is archived or in the trash", async () => {
    const { development } = await developmentOf([
      developmentPage({ slug: "archived", game: [HANABI], priority: "P1 · Now", archived: true }),
      developmentPage({ slug: "trashed", game: [HANABI], priority: "P2 · Next", inTrash: true }),
      developmentPage({ slug: "kept", game: [HANABI], priority: "P3 · Later" }),
      developmentPage({ slug: "lone-archived", game: [BANG], priority: "P1 · Now", archived: true }),
    ])
    expect(development).toEqual({ ...unranked, hanabi: developmentRank({ priority: "P3 · Later" }) })
  })

  it("is found on any page of the Games Development database", async () => {
    const rows = ["S", "M", "L", "XL", "XXL"].map((effort, index) => ({ effort, id: `11111111-aaaa-4bbb-8ccc-00000000010${index}` }))
    const notion = fakeNotion(
      {
        games: rows.map(({ id, effort }) => gamePage({ id, slug: effort.toLowerCase(), name: effort })),
        editors: [],
        creators: [],
        development: rows.map(({ id, effort }) => developmentPage({ slug: effort.toLowerCase(), game: [id], effort })),
      },
      2,
    )
    const read = await readPlannedGames({ token: TOKEN, fetch: notion.fetch })
    expect(read.games.map((game) => game.development.effort?.name)).toEqual(["S", "M", "L", "XL", "XXL"])
    expect(notion.calls.filter((call) => call.database === DEVELOPMENT_DATABASE_ID).map((call) => call.body.start_cursor)).toEqual([undefined, "2", "4"])
  })

  it("is plain data: it goes through the cache as JSON and comes back the same", async () => {
    const { games: read } = await developmentOf([developmentPage({ game: [HANABI], priority: "P1 · Now", status: "Table", effort: "XL" })])
    expect(JSON.parse(JSON.stringify(read))).toStrictEqual(read)
  })

  describe("when the database cannot be read", () => {
    const cases: { name: string; development: Answer; schema?: SchemaAnswer; reason: string }[] = [
      { name: "its schema is refused", development: [], schema: notionFailure(403, "restricted_resource", "Not allowed."), reason: "Notion answered 403 restricted_resource: Not allowed." },
      { name: "its rows are refused", development: notionFailure(500, "internal_server_error", "Oops."), reason: "Notion answered 500 internal_server_error: Oops." },
      { name: "its schema is not the one of a database", development: [], schema: { status: 200, body: { object: "list", results: [] } }, reason: "Notion answered with something that is not the schema of a database" },
    ]

    it.each(cases)("lists the games with no rank, and says so once, when $name", async ({ development, schema, reason }) => {
      const read = await developmentOf(development, schema)
      expect(read.games.map((game) => game.slug)).toEqual(["hanabi", "bang", "skyjo"])
      expect(read.development).toEqual(unranked)
      expect(read.warnings).toEqual([`The Games Development database could not be read, so the coming-soon games are listed by name (connect the integration to it too): ${reason}`])
    })

    it("says so once when the integration is not connected to it, and keeps the rest of the read", async () => {
      const notion = fakeNotion({ games: [gamePage({ editors: [EDITOR_1] })], editors: [editorPage({ id: EDITOR_1, name: "Editor One" })], creators: [] })
      const read = await readPlannedGames({ token: TOKEN, fetch: notion.fetch })
      expect(read.games[0]).toMatchObject({ publishers: [{ name: "Editor One", url: null }], development: developmentRank() })
      expect(read.warnings).toHaveLength(1)
      expect(read.warnings[0]).toContain("The Games Development database could not be read, so the coming-soon games are listed by name (connect the integration to it too)")
      expect(read.warnings[0]).toContain("object_not_found")
    })
  })

  describe("when a column of the database is not what it should be", () => {
    const rows = [developmentPage({ game: [HANABI], priority: "P1 · Now", status: "Engine", effort: "M" })]
    /** The real schema, changed by `change` (a column is deleted or replaced in its `properties`). */
    const schemaWith = (change: (properties: Record<string, unknown>) => void) => {
      const schema = developmentDatabase()
      change(schema.properties)
      return schema
    }

    it("ranks no game when it has no Game column", async () => {
      const read = await developmentOf(rows, schemaWith((properties) => delete properties.Game))
      expect(read.development).toEqual(unranked)
      expect(read.warnings).toEqual(['The Games Development database has no "Game" column: no game is ranked, so the coming-soon games are listed by name'])
    })

    it("ranks no game when its Game column is not a relation", async () => {
      const read = await developmentOf(
        rows,
        schemaWith((properties) => {
          properties.Game = { id: "frAv", name: "Game", type: "rich_text", rich_text: {} }
        }),
      )
      expect(read.development).toEqual(unranked)
      expect(read.warnings).toEqual(['The Games Development database has a "Game" column that is a rich_text, not a relation: no game is ranked, so the coming-soon games are listed by name'])
    })

    it("leaves a column that is missing out of the order, and ranks by the others", async () => {
      const read = await developmentOf(rows, schemaWith((properties) => delete properties.Effort))
      expect(read.development.hanabi).toEqual(developmentRank({ priority: "P1 · Now", status: "Engine" }))
      expect(read.warnings).toEqual(['The Games Development database has no "Effort" column: it is left out of the order of the coming-soon games'])
    })

    it("leaves a column that is not of its type out of the order, and ranks by the others", async () => {
      const read = await developmentOf(
        rows,
        schemaWith((properties) => {
          properties.Status = { id: "<[xq", name: "Status", type: "select", select: { options: [{ id: "engine", name: "Engine", color: "default" }] } }
        }),
      )
      expect(read.development.hanabi).toEqual(developmentRank({ priority: "P1 · Now", effort: "M" }))
      expect(read.warnings).toEqual(['The Games Development database has a "Status" column that is a select, not a status: it is left out of the order of the coming-soon games'])
    })

    it("says so for each column, in the order Priority, Status, Effort", async () => {
      const read = await developmentOf(
        rows,
        schemaWith((properties) => {
          delete properties.Effort
          delete properties.Priority
        }),
      )
      expect(read.development.hanabi).toEqual(developmentRank({ status: "Engine" }))
      expect(read.warnings).toEqual([
        'The Games Development database has no "Priority" column: it is left out of the order of the coming-soon games',
        'The Games Development database has no "Effort" column: it is left out of the order of the coming-soon games',
      ])
    })

    it("says only that the Game column is missing when it is not the only one", async () => {
      const read = await developmentOf(
        rows,
        schemaWith((properties) => {
          delete properties.Game
          delete properties.Effort
        }),
      )
      expect(read.warnings).toHaveLength(1)
      expect(read.warnings[0]).toContain('has no "Game" column')
    })
  })
})

describe("a row that is not a game", () => {
  it("is not read at all when it is archived or in the trash", async () => {
    const read = await readGames([gamePage({ slug: "kept", name: "Kept" }), gamePage({ slug: "old", name: "Old", archived: true }), gamePage({ slug: "bin", name: "Bin", inTrash: true })])
    expect(read.games.map((game) => game.slug)).toEqual(["kept"])
    expect(read.skipped).toEqual([])
    expect(read.expansions).toBe(0)
  })

  it("is an expansion when it points to a base game: left out and counted, not reported, even with no slug", async () => {
    const read = await readGames([gamePage({ slug: "base", name: "Base" }), gamePage({ slug: "", name: "Base Expansion", parent: ["game-base"] })])
    expect(read.games.map((game) => game.slug)).toEqual(["base"])
    expect(read.expansions).toBe(1)
    expect(read.skipped).toEqual([])
  })

  it("is a game of its own when it points to a base game and its Type is Standalone expansion", async () => {
    const read = await readGames([
      gamePage({ slug: "flip-7", name: "Flip 7", type: "Base game" }),
      gamePage({ slug: "flip-7-vengeance", name: "Flip 7 Vengeance", parent: ["game-flip-7"], type: "Standalone expansion" }),
      gamePage({ slug: "flip-7-pack", name: "Flip 7 Pack", parent: ["game-flip-7"], type: "Expansion" }),
    ])
    expect(read.games.map((game) => game.slug)).toEqual(["flip-7", "flip-7-vengeance"])
    expect(read.expansions).toBe(1)
    expect(read.skipped).toEqual([])
  })

  it.each([
    ["has no Type", null],
    ["is an Expansion", "Expansion"],
    ["is a Base game", "Base game"],
    ["has a Type this reader does not know", "Spin-off"],
  ])("stays an expansion when it points to a base game and it %s", async (_label, type) => {
    const read = await readGames([gamePage({ slug: "base", name: "Base" }), gamePage({ slug: "extra", name: "Extra", parent: ["game-base"], type })])
    expect(read.games.map((game) => game.slug)).toEqual(["base"])
    expect(read.expansions).toBe(1)
  })

  it("is a game whatever its Type when it points to no base game", async () => {
    const read = await readGames([gamePage({ slug: "alone", name: "Alone", type: "Standalone expansion" }), gamePage({ slug: "other", name: "Other", type: "Expansion" })])
    expect(read.games.map((game) => game.slug)).toEqual(["alone", "other"])
    expect(read.expansions).toBe(0)
  })

  it("is checked like any game when it is a standalone expansion: with no slug it is skipped with its reason, not counted", async () => {
    const read = await readGames([gamePage({ id: "row-1", slug: "", name: "Standalone", parent: ["game-base"], type: "Standalone expansion" })])
    expect(read.games).toEqual([])
    expect(read.expansions).toBe(0)
    expect(read.skipped).toEqual([{ id: "row-1", name: "Standalone", reason: "it has no slug (fill the Slug column)" }])
  })

  it.each([
    ["has no name", { name: "", slug: "sample" }, "it has no name"],
    ["has a name of white space", { name: " \t ", slug: "sample" }, "it has no name"],
    ["has no slug", { name: "Sample", slug: "" }, "it has no slug (fill the Slug column)"],
    ["has a slug that is not one", { name: "Sample", slug: "Hanabi!" }, slugProblem("Hanabi!")],
    ["has the slug of a route of the site", { name: "Sample", slug: "gamemaster" }, slugProblem("gamemaster")],
    ["has a slug that is too long", { name: "Sample", slug: "x".repeat(41) }, slugProblem("x".repeat(41))],
    ["has a name that is not a line of text", { name: "Han\u001b[31mabi", slug: "sample" }, "The name has a control character: it is one line of printable text"],
    ["has a name that is too long", { name: "x".repeat(61), slug: "sample" }, `"${"x".repeat(61)}" is 61 characters long, 60 at most`],
  ])("is skipped, with its reason, when it %s", async (_label, row, reason) => {
    const page = gamePage({ id: "row-1", ...row })
    const read = await readGames([page])
    expect(read.games).toEqual([])
    expect(read.skipped).toHaveLength(1)
    expect(read.skipped[0]).toMatchObject({ id: "row-1", reason })
  })

  it("never lets a control character reach the name or the reason of a skipped row", async () => {
    const read = await readGames([gamePage({ name: "Han\u001b[31mabi", slug: "bad\u001b[0m" })])
    expect(read.skipped[0]?.name).toBe("Han[31mabi")
    expect(read.skipped[0]?.reason).not.toMatch(/\p{Cc}/u)
    const slugRead = await readGames([gamePage({ name: "Hanabi", slug: "bad\u001b[0m" })])
    expect(slugRead.skipped[0]?.reason).toBe(`"bad[0m" is not a slug: lowercase letters and digits, words joined by single dashes (the-crew, 6-nimmt)`)
  })

  it("is skipped when its Slug cell is not a text", async () => {
    const page = gamePage({ name: "Sample", slug: "sample" })
    page.properties.Slug = { type: "number", number: 7 }
    const read = await readGames([page])
    expect(read.games).toEqual([])
    expect(read.skipped[0]?.reason).toBe("it has no slug (fill the Slug column)")
  })

  it("is skipped when an older row has its slug: the older row wins", async () => {
    const read = await readGames([gamePage({ id: "old", slug: "hanabi", name: "Hanabi" }), gamePage({ id: "new", slug: "hanabi", name: "Hanabi Copy" })])
    expect(read.games.map((game) => game.notionPageId)).toEqual(["old"])
    expect(read.skipped).toEqual([{ id: "new", name: "Hanabi Copy", reason: 'its slug "hanabi" is already the one of "Hanabi"' }])
  })

  it("does not stop the other rows", async () => {
    const read = await readGames([gamePage({ slug: "", name: "Nameless" }), gamePage({ slug: "bang", name: "Bang" }), gamePage({ slug: "gamemaster", name: "Route" })])
    expect(read.games.map((game) => game.slug)).toEqual(["bang"])
    expect(read.skipped.map((row) => row.name)).toEqual(["Nameless", "Route"])
  })
})

describe("the related games of a row", () => {
  /** The slugs each game of a read points to, by game. */
  const relatedOf = (read: { games: PlannedGame[] }) => Object.fromEntries(read.games.map((game) => [game.slug, game.related]))

  it("are the slugs of the rows its Related Games column points to, in the order of the row, on its own side only", async () => {
    const read = await readGames([
      gamePage({ slug: "skyjo", name: "Skyjo", related: ["game-skyjo-junior", "game-skyjo-action"] }),
      gamePage({ slug: "skyjo-action", name: "Skyjo Action" }),
      gamePage({ slug: "skyjo-junior", name: "Skyjo Junior" }),
    ])
    // Notion keeps a link where it was typed: `buildCatalog` makes it go both ways
    expect(relatedOf(read)).toEqual({ skyjo: ["skyjo-junior", "skyjo-action"], "skyjo-action": [], "skyjo-junior": [] })
  })

  it("are none for a row that points to no game", async () => {
    expect((await one({ name: "Hanabi", slug: "hanabi" })).related).toEqual([])
  })

  it("include the base game of a standalone expansion, after its related games", async () => {
    const read = await readGames([
      gamePage({ slug: "flip-7", name: "Flip 7" }),
      gamePage({ slug: "flip-7-revenge", name: "Flip 7 Revenge" }),
      gamePage({ slug: "flip-7-vengeance", name: "Flip 7 Vengeance", parent: ["game-flip-7"], related: ["game-flip-7-revenge"], type: "Standalone expansion" }),
    ])
    expect(relatedOf(read)["flip-7-vengeance"]).toEqual(["flip-7-revenge", "flip-7"])
  })

  it("name a game once, whichever column says so", async () => {
    const read = await readGames([
      gamePage({ slug: "flip-7", name: "Flip 7" }),
      gamePage({ slug: "flip-7-vengeance", name: "Flip 7 Vengeance", parent: ["game-flip-7"], related: ["game-flip-7", "game-flip-7"], type: "Standalone expansion" }),
    ])
    expect(relatedOf(read)["flip-7-vengeance"]).toEqual(["flip-7"])
  })

  it("never include the row itself", async () => {
    const read = await readGames([gamePage({ slug: "skyjo", name: "Skyjo", related: ["game-skyjo"] })])
    expect(relatedOf(read)).toEqual({ skyjo: [] })
  })

  it("leave out a row that is not a game of the catalog: an expansion, a row with no slug, a row in the trash, a row the integration cannot see", async () => {
    const read = await readGames([
      gamePage({ slug: "7-wonders", name: "7 Wonders", related: ["game-7-wonders-cities", "row-nameless", "row-old", "row-elsewhere"] }),
      gamePage({ slug: "7-wonders-cities", name: "7 Wonders Cities", parent: ["game-7-wonders"], type: "Expansion" }),
      gamePage({ id: "row-nameless", slug: "", name: "Nameless" }),
      gamePage({ id: "row-old", slug: "old", name: "Old", archived: true }),
    ])
    expect(relatedOf(read)).toEqual({ "7-wonders": [] })
  })

  it("are read from an id with or without dashes, in any case", async () => {
    const read = await readGames([
      gamePage({ id: "11111111-aaaa-4bbb-8ccc-000000000001", slug: "king-of-tokyo", name: "King of Tokyo", related: ["11111111AAAA4BBB8CCC000000000002"] }),
      gamePage({ id: "11111111-aaaa-4bbb-8ccc-000000000002", slug: "king-of-new-york", name: "King of New York", related: ["11111111-aaaa-4bbb-8ccc-000000000001"] }),
    ])
    expect(relatedOf(read)).toEqual({ "king-of-tokyo": ["king-of-new-york"], "king-of-new-york": ["king-of-tokyo"] })
  })
})

describe("the columns", () => {
  it("are reported when an optional one is missing, once each, and the games are still read", async () => {
    const pages = [gamePage({ slug: "hanabi", name: "Hanabi" }), gamePage({ slug: "bang", name: "Bang" })]
    for (const page of pages) {
      delete page.properties.Illustrators
      delete page.properties["Rules DE"]
    }
    const read = await readGames(pages)
    expect(read.games.map((game) => game.slug)).toEqual(["hanabi", "bang"])
    expect(read.warnings).toEqual([
      'The Games database has no "Illustrators" column: it is left empty for every game',
      'The Games database has no "Rules DE" column: it is left empty for every game',
    ])
  })

  it("report a missing Type column, and then every row that points to a base game is an expansion again", async () => {
    const pages = [
      gamePage({ slug: "flip-7", name: "Flip 7" }),
      gamePage({ slug: "flip-7-vengeance", name: "Flip 7 Vengeance", parent: ["game-flip-7"], type: "Standalone expansion" }),
    ]
    for (const page of pages) delete page.properties.Type
    const read = await readGames(pages)
    expect(read.games.map((game) => game.slug)).toEqual(["flip-7"])
    expect(read.expansions).toBe(1)
    expect(read.warnings).toEqual(['The Games database has no "Type" column: it is left empty for every game'])
  })

  it("report a missing Related Games column, and the games are read with no related game but their base game", async () => {
    const pages = [
      gamePage({ slug: "flip-7", name: "Flip 7" }),
      gamePage({ slug: "flip-7-vengeance", name: "Flip 7 Vengeance", parent: ["game-flip-7"], type: "Standalone expansion" }),
    ]
    for (const page of pages) delete page.properties["Related Games"]
    const read = await readGames(pages)
    expect(read.games.map((game) => game.related)).toEqual([[], ["flip-7"]])
    expect(read.warnings).toEqual(['The Games database has no "Related Games" column: it is left empty for every game'])
  })

  it("make the read fail when Name or Slug is missing: that database is not the Games one", async () => {
    const noSlug = gamePage()
    delete noSlug.properties.Slug
    expect((await failureOf(readGames([noSlug]))).message).toBe('The Games database has no "Slug" column')
    const neither = gamePage()
    delete neither.properties.Name
    delete neither.properties.Slug
    expect((await failureOf(readGames([neither]))).message).toBe('The Games database has no "Name" or "Slug" column')
  })

  it("have nothing to check in an empty database", async () => {
    expect(await readGames([])).toEqual({ games: [], skipped: [], expansions: 0, warnings: [] })
  })
})

describe("the links of the pictures", () => {
  const linksOf = (games: Answer) => readPictureLinks({ token: TOKEN, fetch: fakeNotion({ games }).fetch })

  it("are read by the id of the row, with its last edit and one link per picture", async () => {
    const links = await linksOf([
      gamePage({ id: "row-hanabi", slug: "hanabi", name: "Hanabi", logo: [uploaded("logo.png")], icon: [external("https://example.com/icon.png")], editedAt: "2026-10-20T10:00:00.000Z" }),
      gamePage({ id: "row-bang", slug: "bang", name: "Bang" }),
    ])
    expect([...links.keys()]).toEqual(["row-hanabi", "row-bang"])
    expect(links.get("row-hanabi")).toEqual({
      editedAt: "2026-10-20T10:00:00.000Z",
      links: { logo: uploaded("logo.png").file.url, icon: "https://example.com/icon.png", background: null },
    })
    expect(links.get("row-bang")?.links).toEqual({ logo: null, icon: null, background: null })
  })

  it("take the first file of a cell that has a link the server can fetch", async () => {
    const page = gamePage({ id: "row", slug: "sample", name: "Sample", background: [external("http://example.com/plain.png"), external("https://example.com/second.png"), external("https://example.com/third.png")] })
    page.properties.Logo = { type: "files", files: [{ name: "lost.png", type: "file", file: {} }, uploaded("logo.png")] }
    const links = await linksOf([page])
    expect(links.get("row")?.links).toEqual({ logo: uploaded("logo.png").file.url, icon: null, background: "https://example.com/second.png" })
  })

  it("agree with the flags of the planned game: a picture is flagged exactly when it has a link", async () => {
    const row: GameRow = { id: "row", slug: "sample", name: "Sample", logo: [uploaded()], icon: [external("javascript:alert(1)")], background: [external("http://example.com/background.png")] }
    const links = await linksOf([gamePage(row)])
    const { art } = await one(row)
    expect(Object.entries(links.get("row")?.links ?? {}).map(([slot, link]) => [slot, link !== null])).toEqual(Object.entries(art))
  })

  it("leave out a row that is archived or in the trash", async () => {
    const links = await linksOf([gamePage({ id: "kept" }), gamePage({ id: "old", archived: true }), gamePage({ id: "bin", inTrash: true })])
    expect([...links.keys()]).toEqual(["kept"])
  })

  it("have the date of the edit empty when the row gives none", async () => {
    const page = gamePage({ id: "row" })
    page.last_edited_time = undefined as unknown as string
    expect((await linksOf([page])).get("row")?.editedAt).toBe("")
  })

  it("ask the Games database alone, once, with the options of the caller", async () => {
    const notion = fakeNotion({ games: [gamePage()] })
    await readPictureLinks({ token: TOKEN, fetch: notion.fetch, init: { cache: "no-store" } })
    expect(notion.calls.map((call) => call.database)).toEqual([GAMES_DATABASE_ID])
    expect(notion.calls[0]?.init).toMatchObject({ method: "POST", cache: "no-store" })
    expect(notion.calls[0]?.headers.Authorization).toBe(`Bearer ${TOKEN}`)
  })

  it("fail with the error of Notion, never with the token", async () => {
    const error = await failureOf(linksOf(notionFailure(401, "unauthorized", "API token is invalid.")))
    expect(error).toMatchObject({ status: 401, code: "unauthorized" })
    expect(error.message).not.toContain(TOKEN)
  })
})
