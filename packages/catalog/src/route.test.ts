import type { GameEntry } from "@pbgo/core/lib/binding"
import { GAMES } from "@pbgo/games/registry"
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest"
import { pictureVersion } from "./catalog"
import { external, fakeNotion, fakeWeb, gamePage, notionFailure, pictureBytes, pictureResponse, uploaded, webPage, type GameRow, type HostHandler, type PictureKind } from "./testing"

// `server-only` throws outside a server bundle
vi.mock("server-only", () => ({}))

const TOKEN = "ntn_testsecret123"
/** Where Notion keeps the files that are uploaded to it (`uploaded()` in `testing.ts`). */
const S3 = "prod-files-secure.s3.us-west-2.amazonaws.com"

// The registry as the catalog reads it (its literal types would make `slug !== "template"` a comparison with no overlap)
const REGISTRY: readonly GameEntry[] = GAMES
/** A live game of the registry: the hub shows the pictures of its Notion row, as it does any game's. */
const LIVE = REGISTRY.find((game) => game.live && game.slug !== "template")
/** A game of the registry that is not live: it takes its Notion row. */
const PLANNED = REGISTRY.find((game) => !game.live && game.slug !== "template")
/** A planned game that the registry does not know: only its Notion row makes it a game. */
const NOTION_ONLY = "azul"
if (!LIVE || !PLANNED || REGISTRY.some((game) => game.slug === NOTION_ONLY)) {
  throw new Error(`The registry needs a live game and a game that is not live, and no "${NOTION_ONLY}", for this test`)
}

// What each answer may be kept for: the contract the CDN and the browser see (the constants of `route.ts` are not exported on purpose)
const FRESH = "public, max-age=3600, s-maxage=86400"
const SHORT = "public, max-age=60, s-maxage=60"
const REDIRECT = "public, max-age=0, s-maxage=10"
const SANDBOX = "default-src 'none'; style-src 'unsafe-inline'; sandbox"

const NOW = new Date("2026-10-22T12:00:00.000Z")
const EDITED = "2026-10-05T10:20:30.000Z"
const VERSION = pictureVersion(EDITED)

/** A row of the Games database, edited at `EDITED` unless it says otherwise. */
const row = (slug: string, overrides: GameRow = {}): GameRow => ({ slug, name: slug, editedAt: EDITED, ...overrides })

const answer = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } })
/** What Notion says when it refuses (a 429 says how long to wait in `retry-after`). */
const failing = (status: number, headers: Record<string, string> = {}) => answer(status, notionFailure(status, "rate_limited", "No.").body, headers)
/** What the Games database says when it has these rows. */
const database = (rows: GameRow[]) => answer(200, { object: "list", results: rows.map(gamePage), has_more: false, next_cursor: null })

type World = {
  /** The rows of the Games database. */
  rows?: GameRow[]
  /** The picture hosts by name: a host that is not here cannot be reached. */
  hosts?: Record<string, HostHandler>
  /** The server's Notion key: the usual one unless the test says there is none. */
  token?: string | null
  /** Answers the reads of the catalog (the calls Next caches) instead of the database. */
  catalog?: () => Response
  /** Answers the reads of the links of the pictures (the calls made without a cache) instead of the database: `call` counts them from 0, `normal` is what the database says. */
  links?: (call: number, normal: () => Promise<Response>) => Response | Promise<Response>
}

/** Notion and the picture hosts as `World` describes them, and a picture route that has never been asked anything (and never logged anything). */
async function world({ rows = [], hosts = {}, token = TOKEN, catalog, links }: World = {}) {
  vi.stubEnv("NOTION_API_KEY", token ?? undefined)
  const notion = fakeNotion({ games: rows.map(gamePage), editors: [], creators: [], development: [] })
  let linkReads = 0
  const web = fakeWeb(
    {
      fetch: (async (input, init) => {
        const normal = () => notion.fetch(input, init)
        if (init?.cache === "no-store") return links ? links(linkReads++, normal) : normal()
        return catalog ? catalog() : normal()
      }) as typeof fetch,
    },
    hosts,
  )
  vi.stubGlobal("fetch", web.fetch)
  // A fresh copy of the module: the lines the previous test logged are forgotten with the old one
  vi.resetModules()
  const { pictureRoute } = await import("./route")
  const get = pictureRoute()

  const isNotion = (request: { url: string }) => new URL(request.url).host === "api.notion.com"
  return {
    web,
    /** The reads of the links of the pictures: the calls to Notion that were made without a cache. */
    reads: () => web.requests.filter((request) => isNotion(request) && request.init.cache === "no-store"),
    /** Everything that was asked of a picture host. */
    downloads: () => web.requests.filter((request) => !isNotion(request)),
    /** `GET /api/catalog/<slug>/<slot>?v=<version>`: the current version unless told otherwise, none with `null`. */
    ask: (slug: string, slot: string, version: string | null = VERSION) =>
      get(new Request(`https://pbgo.test/api/catalog/${slug}/${slot}${version === null ? "" : `?v=${version}`}`), { params: Promise.resolve({ slug, slot }) }),
  }
}

let warn: MockInstance<typeof console.warn>

beforeEach(() => {
  // A frozen clock, moved by `later`: the memos of the route are told in seconds
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(NOW)
  warn = vi.spyOn(console, "warn").mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** Everything that was logged, as one text. */
const logged = () => warn.mock.calls.map((call) => call.join(" ")).join("\n")
const later = (ms: number) => vi.setSystemTime(Date.now() + ms)
/** Lets everything that is not waiting for something else run. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 10))
const bytesOf = async (response: Response) => new Uint8Array(await response.arrayBuffer())

const png: Record<string, HostHandler> = { [S3]: () => pictureResponse("png") }

describe("a picture of a game", () => {
  it("is served as the file it is, kept a day by the CDN, with the headers of a file that only an <img> shows", async () => {
    // The host says it sends a web page: the route believes the bytes, not the host
    const w = await world({
      rows: [row(PLANNED.slug, { logo: [uploaded("logo.png")] })],
      hosts: { [S3]: () => pictureResponse("png", { headers: { "content-type": "text/html" } }) },
    })
    const response = await w.ask(PLANNED.slug, "logo")
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("image/png")
    expect(response.headers.get("cache-control")).toBe(FRESH)
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    expect(response.headers.get("content-security-policy")).toBe(SANDBOX)
    expect(await bytesOf(response)).toEqual(pictureBytes("png"))
    expect(warn).not.toHaveBeenCalled()
  })

  it("comes from the link Notion gives now, and Notion's token never reaches the host of the picture", async () => {
    const file = uploaded("logo.png")
    const w = await world({ rows: [row(PLANNED.slug, { logo: [file] })], hosts: png })
    await w.ask(PLANNED.slug, "logo")
    const [read] = w.reads()
    expect((read?.init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`)
    expect(w.downloads().map((request) => request.url)).toEqual([file.file.url])
    const headers = Object.keys((w.downloads()[0]?.init.headers ?? {}) as Record<string, string>).map((name) => name.toLowerCase())
    expect(headers).toEqual(["accept"])
  })

  it("is the one of the fresh read of Notion, not of the catalog's", async () => {
    const w = await world({
      rows: [row(PLANNED.slug, { logo: [uploaded("old.png")] })],
      hosts: png,
      // The same row, a link that has been renewed
      links: () => database([row(PLANNED.slug, { logo: [uploaded("renewed.png")] })]),
    })
    expect((await w.ask(PLANNED.slug, "logo")).status).toBe(200)
    expect(w.downloads().map((request) => new URL(request.url).pathname)).toEqual(["/test/renewed.png"])
  })

  it.each([
    ["logo", "image/png"],
    ["icon", "image/jpeg"],
    ["background", "image/webp"],
  ] as const)("serves the %s from its own file", async (slot, type) => {
    const kinds: Record<string, PictureKind> = { "/test/logo.png": "png", "/test/icon.jpg": "jpeg", "/test/background.webp": "webp" }
    const w = await world({
      rows: [row(PLANNED.slug, { logo: [uploaded("logo.png")], icon: [uploaded("icon.jpg")], background: [uploaded("background.webp")] })],
      hosts: { [S3]: (url) => pictureResponse(kinds[url.pathname] ?? "gif") },
    })
    const response = await w.ask(PLANNED.slug, slot)
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe(type)
  })

  it("is served for a game the registry does not know, from a link to another site", async () => {
    const w = await world({
      rows: [row(NOTION_ONLY, { background: [external("https://cdn.example.org/azul/background.avif")] })],
      hosts: { "cdn.example.org": () => pictureResponse("avif") },
    })
    const response = await w.ask(NOTION_ONLY, "background")
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("image/avif")
  })

  it("is served for a live game too: the hub shows the pictures of its Notion row, not those of its Sanity project", async () => {
    const w = await world({ rows: [row(LIVE.slug, { logo: [uploaded("logo.png")] })], hosts: png })
    const response = await w.ask(LIVE.slug, "logo")
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("image/png")
    expect(response.headers.get("cache-control")).toBe(FRESH)
    expect(await bytesOf(response)).toEqual(pictureBytes("png"))
  })

  it("is kept a minute only when the row was edited after the catalog read it", async () => {
    const w = await world({
      rows: [row(PLANNED.slug, { logo: [uploaded("logo.png")] })],
      hosts: png,
      // The same row, edited a minute later than the version of the URL
      links: () => database([row(PLANNED.slug, { logo: [uploaded("logo.png")], editedAt: "2026-10-05T10:21:30.000Z" })]),
    })
    const response = await w.ask(PLANNED.slug, "logo")
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe(SHORT)
  })
})

describe("a picture that is not there", () => {
  it.each(["banner", "Logo", "logo.png", "constructor", "__proto__", ""])("answers 404 for the slot %j, and asks nobody", async (slot) => {
    const w = await world({ rows: [row(PLANNED.slug, { logo: [uploaded("logo.png")] })], hosts: png })
    const response = await w.ask(PLANNED.slug, slot)
    expect(response.status).toBe(404)
    expect(response.headers.get("cache-control")).toBe(SHORT)
    expect(await response.text()).toBe("Not found")
    expect(w.web.requests).toEqual([])
  })

  it.each([
    ["a slug that is nowhere", "nope"],
    ["a game of the registry that has no row in Notion", PLANNED.slug],
    ["a live game that has no row in Notion: the registry knows no picture of it", LIVE.slug],
  ])("answers 404 for %s, without reading the links or downloading anything", async (_label, slug) => {
    const w = await world({ rows: [row(NOTION_ONLY, { logo: [uploaded("logo.png")] })], hosts: png })
    const response = await w.ask(slug, "logo")
    expect(response.status).toBe(404)
    expect(response.headers.get("cache-control")).toBe(SHORT)
    expect(w.reads()).toEqual([])
    expect(w.downloads()).toEqual([])
  })

  it("answers 404 for a picture the row does not have, without reading the links or downloading anything", async () => {
    const w = await world({ rows: [row(PLANNED.slug, { logo: [uploaded("logo.png")] })], hosts: png })
    const response = await w.ask(PLANNED.slug, "icon")
    expect(response.status).toBe(404)
    expect(w.reads()).toEqual([])
    expect(w.downloads()).toEqual([])
  })

  it("answers 404 when the server has no Notion key, and calls nobody", async () => {
    const w = await world({ token: null, rows: [row(PLANNED.slug, { logo: [uploaded("logo.png")] })], hosts: png })
    const response = await w.ask(PLANNED.slug, "logo")
    expect(response.status).toBe(404)
    expect(w.web.requests).toEqual([])
    expect(warn).not.toHaveBeenCalled()
  })

  it.each([
    ["the row was archived", () => database([row(PLANNED.slug, { logo: [uploaded("logo.png")], archived: true })])],
    ["the row was deleted", () => database([])],
    ["the picture was taken off the row", () => database([row(PLANNED.slug)])],
    ["the picture became a link that is not a picture the server follows", () => database([row(PLANNED.slug, { logo: [external("http://example.com/logo.png")] })])],
  ])("answers 404 when %s since the catalog read the row", async (_label, links) => {
    const w = await world({ rows: [row(PLANNED.slug, { logo: [uploaded("logo.png")] })], hosts: png, links })
    const response = await w.ask(PLANNED.slug, "logo")
    expect(response.status).toBe(404)
    expect(response.headers.get("cache-control")).toBe(SHORT)
    expect(w.downloads()).toEqual([])
  })
})

describe("the version in the URL", () => {
  it.each([
    ["none", null],
    ["an old one", "1abc"],
    ["an empty one", ""],
    ["one that is not a version", "<script>alert(1)</script>"],
  ])("is corrected when it is %s: a redirect that costs nothing, kept ten seconds", async (_label, version) => {
    const w = await world({ rows: [row(PLANNED.slug, { logo: [uploaded("logo.png")] })], hosts: png })
    const response = await w.ask(PLANNED.slug, "logo", version)
    expect(response.status).toBe(307)
    // Only what the route knows is in the address: a version that was sent is never repeated
    expect(response.headers.get("location")).toBe(`/api/catalog/${PLANNED.slug}/logo?v=${VERSION}`)
    expect(response.headers.get("cache-control")).toBe(REDIRECT)
    expect(w.reads()).toEqual([])
    expect(w.downloads()).toEqual([])
  })
})

describe("when Notion cannot give the links", () => {
  const rows = [row(PLANNED.slug, { logo: [uploaded("logo.png")], icon: [uploaded("icon.png")] })]

  it("answers 503, not 404: the picture is there, it is only not known to be", async () => {
    const w = await world({ rows, hosts: png, links: () => failing(500) })
    const response = await w.ask(PLANNED.slug, "logo")
    expect(response.status).toBe(503)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(response.headers.get("retry-after")).toBe("5")
    expect(w.downloads()).toEqual([])
    expect(logged()).toContain("[catalog] The pictures of the catalog cannot be read from Notion: Notion answered 500")
    expect(logged()).not.toContain(TOKEN)
  })

  it("answers 503 when Notion cannot be reached at all", async () => {
    const w = await world({
      rows,
      hosts: png,
      links: () => {
        throw new TypeError("fetch failed")
      },
    })
    const response = await w.ask(PLANNED.slug, "logo")
    expect(response.status).toBe(503)
    expect(logged()).toContain("Notion could not be reached (TypeError)")
  })

  it("says it once, however many pictures were asked for", async () => {
    const w = await world({ rows, hosts: png, links: () => failing(500) })
    await w.ask(PLANNED.slug, "logo")
    await w.ask(PLANNED.slug, "icon")
    later(60_000)
    await w.ask(PLANNED.slug, "logo")
    expect(w.reads()).toHaveLength(2)
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it("does not ask again for five seconds, then asks and recovers", async () => {
    const w = await world({ rows, hosts: png, links: (call, normal) => (call === 0 ? failing(500) : normal()) })
    expect((await w.ask(PLANNED.slug, "logo")).status).toBe(503)
    later(4000)
    const waiting = await w.ask(PLANNED.slug, "icon")
    expect(waiting.status).toBe(503)
    expect(waiting.headers.get("retry-after")).toBe("1")
    expect(w.reads()).toHaveLength(1)
    later(1001)
    expect((await w.ask(PLANNED.slug, "logo")).status).toBe(200)
    expect(w.reads()).toHaveLength(2)
  })

  it.each([
    ["wait two minutes", { "retry-after": "120" }, "120"],
    ["wait four seconds", { "retry-after": "4" }, "5"],
    ["say nothing about the wait", {}, "5"],
  ])("does not wait for a rate limit that asks it to %s, and is told as long as it asks before the next read", async (_label, headers, wait) => {
    const w = await world({ rows, hosts: png, links: (call, normal) => (call === 0 ? failing(429, headers) : normal()) })
    const response = await w.ask(PLANNED.slug, "logo")
    expect(response.status).toBe(503)
    expect(response.headers.get("retry-after")).toBe(wait)
    expect(w.reads()).toHaveLength(1)
    // Still inside the wait: nobody is asked
    later(Number(wait) * 1000 - 1000)
    expect((await w.ask(PLANNED.slug, "icon")).status).toBe(503)
    expect(w.reads()).toHaveLength(1)
    later(1001)
    expect((await w.ask(PLANNED.slug, "icon")).status).toBe(200)
    expect(w.reads()).toHaveLength(2)
  })

  it("waits once for a rate limit that is short, and then serves the picture", async () => {
    const w = await world({ rows, hosts: png, links: (call, normal) => (call === 0 ? failing(429, { "retry-after": "0" }) : normal()) })
    const response = await w.ask(PLANNED.slug, "logo")
    expect(response.status).toBe(200)
    expect(w.reads()).toHaveLength(2)
    expect(warn).not.toHaveBeenCalled()
  })

  it("waits only once", async () => {
    const w = await world({ rows, hosts: png, links: () => failing(429, { "retry-after": "0" }) })
    const response = await w.ask(PLANNED.slug, "logo")
    expect(response.status).toBe(503)
    expect(w.reads()).toHaveLength(2)
  })
})

describe("every picture of a page asked at once", () => {
  const rows = [
    row(PLANNED.slug, { logo: [uploaded("logo.png")], icon: [uploaded("icon.png")], background: [uploaded("background.png")] }),
    row(NOTION_ONLY, { logo: [uploaded("azul.png")] }),
  ]
  const asks = (w: Awaited<ReturnType<typeof world>>) =>
    Array.from({ length: 5 }, () => [w.ask(PLANNED.slug, "logo"), w.ask(PLANNED.slug, "icon"), w.ask(PLANNED.slug, "background"), w.ask(NOTION_ONLY, "logo")]).flat()

  it("share one read of the links, whatever the number of pictures", async () => {
    let open = () => {}
    const gate = new Promise<void>((resolve) => {
      open = resolve
    })
    const w = await world({
      rows,
      hosts: png,
      links: async (_call, normal) => {
        await gate
        return normal()
      },
    })
    const pending = asks(w)
    await settle()
    // The read is still open: whoever came meanwhile waits for it, nobody starts another
    expect(w.reads()).toHaveLength(1)
    open()
    const responses = await Promise.all(pending)
    expect(responses.map((response) => response.status)).toEqual(pending.map(() => 200))
    expect(w.reads()).toHaveLength(1)
  })

  it("share one failure too: a Notion that is down is asked once, not by every picture", async () => {
    const w = await world({ rows, hosts: png, links: () => failing(500) })
    const responses = await Promise.all(asks(w))
    expect(responses.map((response) => response.status)).toEqual(responses.map(() => 503))
    expect(w.reads()).toHaveLength(1)
  })

  it("believe the links for thirty seconds, then ask again", async () => {
    const w = await world({ rows, hosts: png })
    await w.ask(PLANNED.slug, "logo")
    later(29_000)
    await w.ask(PLANNED.slug, "icon")
    expect(w.reads()).toHaveLength(1)
    later(2000)
    await w.ask(PLANNED.slug, "background")
    expect(w.reads()).toHaveLength(2)
  })
})

describe("when the host of the picture fails", () => {
  const rows = [row(PLANNED.slug, { logo: [uploaded("logo.png")] })]

  it("answers 404 for a picture that is gone, and says so once, without the link that was signed", async () => {
    const w = await world({ rows, hosts: { [S3]: () => new Response("gone", { status: 404 }) } })
    expect((await w.ask(PLANNED.slug, "logo")).status).toBe(404)
    expect((await w.ask(PLANNED.slug, "logo")).status).toBe(404)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(logged()).toContain(`[catalog] The logo of "${PLANNED.slug}" cannot be served: ${S3} answered 404`)
    expect(logged()).not.toContain("X-Amz")
    expect(logged()).not.toContain(TOKEN)
  })

  it("answers 404 when the link leads to a web page, not a picture", async () => {
    const w = await world({ rows, hosts: { [S3]: () => new Response(webPage(), { headers: { "content-type": "image/png" } }) } })
    const response = await w.ask(PLANNED.slug, "logo")
    expect(response.status).toBe(404)
    expect(logged()).toContain("sent something that is not a picture")
  })

  it.each([500, 503, 429])("answers 503, kept by nobody, when it answers %i: the next try may find the picture", async (status) => {
    const w = await world({ rows, hosts: { [S3]: () => new Response("later", { status }) } })
    const response = await w.ask(PLANNED.slug, "logo")
    expect(response.status).toBe(503)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(response.headers.get("retry-after")).toBe("30")
  })

  it("answers 503 when it cannot be reached", async () => {
    // No handler for the host: the network fails
    const w = await world({ rows })
    const response = await w.ask(PLANNED.slug, "logo")
    expect(response.status).toBe(503)
    expect(logged()).toContain(`${S3} could not be reached`)
  })

  it.each([
    ["an address", "https://192.168.1.10/logo.png"],
    ["the address of a cloud's metadata", "https://169.254.169.254/latest/meta-data/"],
    ["localhost", "https://localhost/logo.png"],
    ["a name of a local network", "https://nas.local/logo.png"],
    ["a port of its own", "https://example.com:8443/logo.png"],
  ])("never follows a link to %s: 404, and nothing is asked of it", async (_label, link) => {
    const w = await world({ rows: [row(PLANNED.slug, { logo: [external(link)] })], hosts: { "example.com": () => pictureResponse("png") } })
    const response = await w.ask(PLANNED.slug, "logo")
    expect(response.status).toBe(404)
    expect(w.downloads()).toEqual([])
    expect(logged()).toContain("is not one the server follows")
  })
})

describe("when the catalog cannot be read", () => {
  it("answers 503: the game may well exist, it is not known to be missing", async () => {
    const w = await world({ rows: [row(PLANNED.slug, { logo: [uploaded("logo.png")] })], hosts: png, catalog: () => failing(500) })
    const response = await w.ask(PLANNED.slug, "logo")
    expect(response.status).toBe(503)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(response.headers.get("retry-after")).toBe("5")
    expect(w.reads()).toEqual([])
    expect(w.downloads()).toEqual([])
    expect(logged()).toContain("Notion is unavailable, only the live games are listed")
    expect(logged()).not.toContain(TOKEN)
  })
})
