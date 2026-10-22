import { slugProblem } from "@pbgo/games/slug"
import { describe, expect, it } from "vitest"
import type { PlannedGame } from "./catalog"
import { EDITORS_DATABASE_ID, GAMES_DATABASE_ID, NOTION_VERSION, NotionError, readPlannedGames } from "./notion"
import { editorPage, external, fakeNotion, gamePage, notionFailure, uploaded, type Answer, type GameRow } from "./testing"

const TOKEN = "ntn_testsecret123"
const EDITOR_1 = "9f1c2d3e-0000-4000-8000-00000000e001"
const EDITOR_2 = "9f1c2d3e-0000-4000-8000-00000000e002"

/** What `readPlannedGames` makes of the two databases, as a fake Notion answers them. */
const readGames = (games: Answer, editors: Answer = []) => readPlannedGames({ token: TOKEN, fetch: fakeNotion({ games, editors }).fetch })

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
    const notion = fakeNotion({ games: [gamePage()], editors: [] })
    await readPlannedGames({ token: TOKEN, fetch: notion.fetch })
    expect(notion.calls.map((call) => call.database).sort()).toEqual([EDITORS_DATABASE_ID, GAMES_DATABASE_ID].sort())
    for (const call of notion.calls) {
      expect(call.init.method).toBe("POST")
      expect(call.headers).toEqual({ Authorization: `Bearer ${TOKEN}`, "Notion-Version": NOTION_VERSION, "Content-Type": "application/json" })
      // The oldest row first: two rows with one slug are settled the same way every time
      expect(call.body).toEqual({ page_size: 100, sorts: [{ timestamp: "created_time", direction: "ascending" }] })
    }
  })

  it("adds the caller's options to every request, but they cannot replace the method, the headers or the body", async () => {
    const notion = fakeNotion({ games: [gamePage()], editors: [] })
    const init: RequestInit = { method: "GET", headers: { Authorization: "Bearer other" }, body: "{}", cache: "force-cache", next: { revalidate: 600, tags: ["catalog"] } }
    await readPlannedGames({ token: TOKEN, fetch: notion.fetch, init })
    expect(notion.calls).toHaveLength(2)
    for (const call of notion.calls) {
      expect(call.init).toMatchObject({ method: "POST", cache: "force-cache", next: { revalidate: 600, tags: ["catalog"] } })
      expect(call.headers.Authorization).toBe(`Bearer ${TOKEN}`)
      expect(call.body.page_size).toBe(100)
    }
  })

  it("follows the cursor to the last page and keeps the order of the rows", async () => {
    const rows = ["a", "b", "c", "d", "e"].map((slug) => gamePage({ slug, name: slug.toUpperCase() }))
    const notion = fakeNotion({ games: rows, editors: [] }, 2)
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
    // Ten requests for the Games database, and the Editors one runs next to it, under the same bound
    expect(asked).toBeGreaterThanOrEqual(10)
    expect(asked).toBeLessThanOrEqual(20)
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
    const notion = fakeNotion({ games: [gamePage({ slug: "hanabi", name: "Hanabi", editors: [EDITOR_1] })] })
    const read = await readPlannedGames({ token: TOKEN, fetch: notion.fetch })
    expect(read.games.map((game) => [game.slug, game.publishers])).toEqual([["hanabi", []]])
    expect(read.warnings).toHaveLength(1)
    expect(read.warnings[0]).toContain("The Editors database could not be read, so no game has a publisher")
    expect(read.warnings[0]).toContain("object_not_found")
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
          status: "Engine",
          priority: "P2 · Next",
          effort: "M",
          players: "2 - 5",
          duration: 25,
          age: "8+",
          authors: ["Author One", "Author Two"],
          artwork: ["Artist One"],
          editors: [EDITOR_1],
          logo: [uploaded("logo.png")],
          icon: [external("https://example.com/icon.png")],
          descriptions: { fr: "Description FR", en: "Description EN" },
          rules: { en: "https://example.com/rules-en.pdf" },
          editedAt: "2026-10-20T10:00:00.000Z",
        }),
      ],
      [editorPage({ id: EDITOR_1, name: "Editor One", url: "https://editor.example.com" })],
    )
    expect(read).toEqual({
      games: [
        {
          slug: "hanabi",
          name: "Hanabi",
          status: "Engine",
          priority: 2,
          effort: "M",
          descriptions: { fr: "Description FR", en: "Description EN" },
          players: { min: 2, max: 5 },
          duration: 25,
          age: 8,
          authors: ["Author One", "Author Two"],
          artists: ["Artist One"],
          publishers: [{ name: "Editor One", url: "https://editor.example.com" }],
          rules: { en: "https://example.com/rules-en.pdf" },
          art: { logo: true, icon: true, background: false },
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
      status: null,
      priority: null,
      effort: null,
      descriptions: {},
      players: null,
      duration: null,
      age: null,
      authors: [],
      artists: [],
      publishers: [],
      rules: {},
      art: { logo: false, icon: false, background: false },
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
    ["P1 · Now", 1],
    ["P4 · Someday", 4],
    ["urgent", null],
  ])("reads the Priority %j as %j", async (label, priority) => {
    expect((await one({ priority: label })).priority).toBe(priority)
  })

  it.each([
    [25, 25],
    [0, null],
    [-5, null],
    [null, null],
  ])("reads the Duration %j as %j", async (minutes, duration) => {
    expect((await one({ duration: minutes })).duration).toBe(duration)
  })

  it("keeps the status as Notion writes it, and nothing when there is none", async () => {
    expect((await one({ status: "Not started" })).status).toBe("Not started")
    expect((await one({ status: null })).status).toBeNull()
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

  it("cleans the names of the authors and the artists", async () => {
    const game = await one({ authors: ["  Author   One "], artwork: ["Artist\tOne"] })
    expect(game).toMatchObject({ authors: ["Author One"], artists: ["Artist One"] })
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

describe("the columns", () => {
  it("are reported when an optional one is missing, once each, and the games are still read", async () => {
    const pages = [gamePage({ slug: "hanabi", name: "Hanabi" }), gamePage({ slug: "bang", name: "Bang" })]
    for (const page of pages) {
      delete page.properties.Effort
      delete page.properties["Rules DE"]
    }
    const read = await readGames(pages)
    expect(read.games.map((game) => game.slug)).toEqual(["hanabi", "bang"])
    expect(read.warnings).toEqual([
      'The Games database has no "Effort" column: it is left empty for every game',
      'The Games database has no "Rules DE" column: it is left empty for every game',
    ])
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
