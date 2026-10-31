import type { GameEntry } from "@pbgo/core/lib/binding"
import { GAMES } from "@pbgo/games/registry"
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest"
import { iconVersion } from "./catalog"
import { PLATFORM_PROJECT_ID } from "./sanity"
import { cdn, fakeWeb, htmlResponse, pictureBytes, pictureResponse, sanityGame, webPage, type HostHandler } from "./testing"

// `server-only` throws outside a server bundle
vi.mock("server-only", () => ({}))

// The registry as the catalog reads it (its literal types would make `slug !== "template"` a comparison with no overlap)
const REGISTRY: readonly GameEntry[] = GAMES
/** A live game of the registry: the hub shows the pictures of its game in the Studio, as it does any game's. */
const LIVE = REGISTRY.find((game) => game.live && game.slug !== "template")
/** A game of the registry that is not live: it takes its game of the Studio. */
const PLANNED = REGISTRY.find((game) => !game.live && game.slug !== "template")
/** A game that the registry does not know: only its game in the Studio makes it a game. */
const STUDIO_ONLY = "azul"
if (!LIVE || !PLANNED || REGISTRY.some((game) => game.slug === STUDIO_ONLY)) {
  throw new Error(`The registry needs a live game and a game that is not live, and no "${STUDIO_ONLY}", for this test`)
}

// What each answer may be kept for: the contract the CDN and the browser see (the constants of `route.ts` are not exported on purpose)
const SHORT = "public, max-age=60, s-maxage=60"
const REDIRECT = "public, max-age=0, s-maxage=10"
const PICTURE_REDIRECT = "public, max-age=300, s-maxage=3600"
const ICON = "public, max-age=86400, s-maxage=86400"
const NO_ICON = "public, max-age=3600, s-maxage=3600"
const SANDBOX = "default-src 'none'; style-src 'unsafe-inline'; sandbox"

const SANITY = `${PLATFORM_PROJECT_ID}.apicdn.sanity.io`
const NOW = new Date("2026-10-22T12:00:00.000Z")

/** The games of the Studio and the picture hosts as `World` describes them, and a picture route that has never been asked anything (and never logged anything). */
type World = {
  /** The published games, as the query returns them. */
  games?: Record<string, unknown>[]
  /** The hosts of the web by name (the publishers' websites): a host that is not here cannot be reached. */
  hosts?: Record<string, HostHandler>
  /** What Sanity answers instead of the games, to say it cannot be read. */
  sanity?: () => Response
}

async function world({ games = [], hosts = {}, sanity }: World = {}) {
  const answer = sanity ?? (() => new Response(JSON.stringify({ result: games }), { headers: { "content-type": "application/json" } }))
  const web = fakeWeb({ [SANITY]: answer, ...hosts })
  vi.stubGlobal("fetch", web.fetch)
  // A fresh copy of the module: the lines the previous test logged are forgotten with the old one
  vi.resetModules()
  const { pictureRoute } = await import("./route")
  const get = pictureRoute()

  return {
    web,
    /** The route itself, for a request that `ask` does not write. */
    get,
    /** Everything that was asked of a host that is not Sanity. */
    downloads: () => web.requests.filter((request) => new URL(request.url).host !== SANITY),
    /** `GET /api/catalog/<slug>/<slot>?v=<version>`: none unless told. */
    ask: (slug: string, slot: string, version: string | null = null) =>
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
const bytesOf = async (response: Response) => new Uint8Array(await response.arrayBuffer())

const pictures = { logo: cdn("logo-1600x476.webp"), icon: cdn("icon-512x512.png"), background: cdn("background-2400x1350.jpg") }
const withPictures = (slug: string) => sanityGame(slug, { name: slug, ...pictures })

describe("a picture of a game", () => {
  it.each([
    ["logo", `${pictures.logo}?w=800&fit=max&auto=format`],
    ["icon", `${pictures.icon}?w=512&fit=max&auto=format`],
    ["background", `${pictures.background}?w=1200&fit=max&auto=format`],
  ])("sends the address of its %s to the image CDN of the platform's project, and downloads nothing", async (slot, location) => {
    const w = await world({ games: [withPictures(PLANNED.slug)] })
    const response = await w.ask(PLANNED.slug, slot)
    expect(response.status).toBe(308)
    expect(response.headers.get("location")).toBe(location)
    expect(response.headers.get("cache-control")).toBe(PICTURE_REDIRECT)
    expect(w.downloads()).toEqual([])
  })

  it("sends a vector picture to its file as it is", async () => {
    const w = await world({ games: [sanityGame(PLANNED.slug, { name: "Vector", logo: cdn("logo-100x30.svg") })] })
    expect((await w.ask(PLANNED.slug, "logo")).headers.get("location")).toBe(cdn("logo-100x30.svg"))
  })

  it("is the same for a live game: the hub shows the pictures of its game in the Studio", async () => {
    const w = await world({ games: [withPictures(LIVE.slug)] })
    expect((await w.ask(LIVE.slug, "logo")).status).toBe(308)
  })

  it("is the same for a game that the registry does not know", async () => {
    const w = await world({ games: [withPictures(STUDIO_ONLY)] })
    expect((await w.ask(STUDIO_ONLY, "background")).status).toBe(308)
  })

  it("ignores the version in the address: the addresses that were shared with one still lead to the picture", async () => {
    const w = await world({ games: [withPictures(PLANNED.slug)] })
    const location = (await w.ask(PLANNED.slug, "logo")).headers.get("location")
    for (const version of ["abc", "0", "1zzz"]) expect((await w.ask(PLANNED.slug, "logo", version)).headers.get("location")).toBe(location)
  })

  it("never sends a visitor anywhere but to the image CDN of the project that was read", async () => {
    const w = await world({ games: [sanityGame(PLANNED.slug, { name: "Elsewhere", logo: "https://evil.example/logo.png" })] })
    expect((await w.ask(PLANNED.slug, "logo")).status).toBe(404)
  })
})

describe("a picture that is not there", () => {
  it.each(["banner", "Logo", "logo.png", "constructor", "__proto__", ""])("answers 404 for the slot %j, and asks nobody", async (slot) => {
    const w = await world({ games: [withPictures(PLANNED.slug)] })
    const response = await w.ask(PLANNED.slug, slot)
    expect(response.status).toBe(404)
    expect(response.headers.get("cache-control")).toBe(SHORT)
    expect(w.web.requests).toEqual([])
  })

  it.each([
    ["a game that is nowhere", "nope"],
    ["a live game that the Studio has no game for: its row of the registry has no picture", LIVE.slug],
    ["a game of the registry that is not live and has no game in the Studio", PLANNED.slug],
  ])("answers 404 for %s", async (_label, slug) => {
    const w = await world({ games: [withPictures(STUDIO_ONLY)] })
    expect((await w.ask(slug, "logo")).status).toBe(404)
  })

  it("answers 404 for a picture the game does not have, even when it has the others", async () => {
    const w = await world({ games: [sanityGame(PLANNED.slug, { name: "Half", logo: pictures.logo })] })
    const response = await w.ask(PLANNED.slug, "icon")
    expect(response.status).toBe(404)
    expect(response.headers.get("cache-control")).toBe(SHORT)
    expect((await w.ask(PLANNED.slug, "logo")).status).toBe(308)
  })

  it.each([
    ["the slug of the template", "template"],
    ["a slug with a path in it", "../etc"],
  ])("answers 404 for %s", async (_label, slug) => {
    const w = await world({ games: [withPictures(PLANNED.slug)] })
    expect((await w.ask(slug, "logo")).status).toBe(404)
  })
})

describe("when the catalog cannot be read", () => {
  it("answers 503: the game may well exist, it is not known to be missing", async () => {
    const w = await world({ games: [withPictures(PLANNED.slug)], sanity: () => new Response("{}", { status: 500 }) })
    const response = await w.ask(PLANNED.slug, "logo")
    expect(response.status).toBe(503)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(response.headers.get("retry-after")).toBe("5")
    expect(w.downloads()).toEqual([])
    expect(logged()).toContain("The platform's Sanity project is unavailable, only the live games are listed")
  })
})

describe("the icon of a publisher", () => {
  const SITE = "libellud.example"
  const publishers = [{ name: "Libellud", url: `https://${SITE}/` }]
  const games = [sanityGame(PLANNED.slug, { name: "Planned", publishers })]
  const VERSION = iconVersion(`https://${SITE}/`)
  /** The website of the publisher: a page that links to an icon of 32 pixels, and the icon. */
  const site: HostHandler = (url) => {
    if (url.pathname === "/") return htmlResponse('<link rel="icon" type="image/png" sizes="32x32" href="/icon-32.png">')
    return url.pathname === "/icon-32.png" ? pictureResponse("png") : new Response("Not found", { status: 404 })
  }
  const hosts = { [SITE]: site }

  it("is found on the website of the publisher and served from here: a day for the CDN, with the headers of a file that only an <img> shows", async () => {
    const w = await world({ games, hosts })
    const response = await w.ask(PLANNED.slug, "publisher-0", VERSION)
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("image/png")
    expect(response.headers.get("cache-control")).toBe(ICON)
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    expect(response.headers.get("content-security-policy")).toBe(SANDBOX)
    expect(await bytesOf(response)).toEqual(pictureBytes("png"))
    // Only the website of the publisher is asked
    expect(w.downloads().map((request) => request.url)).toEqual([`https://${SITE}/`, `https://${SITE}/icon-32.png`])
    expect(warn).not.toHaveBeenCalled()
  })

  it("is served for a live game too", async () => {
    const w = await world({ games: [sanityGame(LIVE.slug, { name: "Live", publishers })], hosts })
    expect((await w.ask(LIVE.slug, "publisher-0", VERSION)).status).toBe(200)
  })

  it("takes the website from the game and never from the request", async () => {
    const w = await world({ games, hosts: { ...hosts, "evil.example": () => pictureResponse("png") } })
    const address = `https://pbgo.test/api/catalog/${PLANNED.slug}/publisher-0?v=${VERSION}&url=https://evil.example/x.png&site=https://evil.example/&host=evil.example`
    const response = await w.get(new Request(address), { params: Promise.resolve({ slug: PLANNED.slug, slot: "publisher-0" }) })
    expect(response.status).toBe(200)
    expect(new Set(w.downloads().map((request) => new URL(request.url).host))).toEqual(new Set([SITE]))
  })

  it("is the one of the publisher in that place of the game, counted from 0, and a publisher with no website has none", async () => {
    const other = "https://other.example/"
    const w = await world({
      games: [sanityGame(PLANNED.slug, { name: "Planned", publishers: [...publishers, { name: "No website" }, { name: "Other", url: other }] })],
      hosts: { ...hosts, "other.example": (url) => (url.pathname === "/" ? htmlResponse('<link rel="icon" href="/o.jpg">') : pictureResponse("jpeg")) },
    })
    expect((await w.ask(PLANNED.slug, "publisher-1")).status).toBe(404)
    expect(w.downloads()).toEqual([])
    const response = await w.ask(PLANNED.slug, "publisher-2", iconVersion(other))
    expect(response.headers.get("content-type")).toBe("image/jpeg")
    expect(new Set(w.downloads().map((request) => new URL(request.url).host))).toEqual(new Set(["other.example"]))
  })

  it.each(["publisher", "publisher-", "publisher--1", "publisher-01", "publisher-100", "publisher-1.5", "publisher-0.png", "Publisher-0", "publishers-0", "publisher-0 ", "publisher-x"])(
    "answers 404 for the slot %j, and asks nobody",
    async (slot) => {
      const w = await world({ games, hosts })
      const response = await w.ask(PLANNED.slug, slot)
      expect(response.status).toBe(404)
      expect(response.headers.get("cache-control")).toBe(SHORT)
      expect(w.web.requests).toEqual([])
    },
  )

  it.each([
    ["a game that is nowhere", "nope", "publisher-0"],
    ["a place that its game has no publisher in", PLANNED.slug, "publisher-1"],
  ])("answers 404 for %s, and downloads nothing", async (_label, slug, slot) => {
    const w = await world({ games, hosts })
    expect((await w.ask(slug, slot)).status).toBe(404)
    expect(w.downloads()).toEqual([])
  })

  it("answers 404 for a publisher with no website, and downloads nothing", async () => {
    const w = await world({ games: [sanityGame(PLANNED.slug, { name: "Planned", publishers: [{ name: "Libellud" }] })], hosts })
    expect((await w.ask(PLANNED.slug, "publisher-0")).status).toBe(404)
    expect(w.downloads()).toEqual([])
  })

  it.each([
    ["none", null],
    ["an old one", "1abc"],
    ["one that is not a version", "<script>alert(1)</script>"],
  ])("sends an address with %s as a version to the right one, before anybody is asked", async (_label, version) => {
    const w = await world({ games, hosts })
    const response = await w.ask(PLANNED.slug, "publisher-0", version)
    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(`/api/catalog/${PLANNED.slug}/publisher-0?v=${VERSION}`)
    expect(response.headers.get("cache-control")).toBe(REDIRECT)
    expect(w.downloads()).toEqual([])
  })

  it("answers 404, for an hour, when the website has no icon the server can use, and says so once with the host and no address", async () => {
    const w = await world({ games, hosts: { [SITE]: () => new Response("Not found", { status: 404 }) } })
    const response = await w.ask(PLANNED.slug, "publisher-0", VERSION)
    expect(response.status).toBe(404)
    expect(response.headers.get("cache-control")).toBe(NO_ICON)
    await w.ask(PLANNED.slug, "publisher-0", VERSION)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(logged()).toContain(`[catalog] The icon of the publisher 1 of "${PLANNED.slug}" cannot be served: ${SITE} has no icon the server can use`)
    expect(logged()).not.toContain("https://")
  })

  it("answers 404 when the website only sends web pages where its icon should be", async () => {
    const w = await world({ games, hosts: { [SITE]: () => new Response(webPage(), { headers: { "content-type": "image/png" } }) } })
    expect((await w.ask(PLANNED.slug, "publisher-0", VERSION)).status).toBe(404)
  })

  it("answers 503, kept by nobody, when the website cannot be reached: the next try may find the icon", async () => {
    const w = await world({ games })
    const response = await w.ask(PLANNED.slug, "publisher-0", VERSION)
    expect(response.status).toBe(503)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(response.headers.get("retry-after")).toBe("300")
    expect(logged()).toContain(`${SITE} could not be reached`)
  })

  it("leaves a website that could not be reached alone for five minutes, whoever asks, then asks again and recovers", async () => {
    let up = false
    const w = await world({ games, hosts: { [SITE]: (url, init) => (up ? site(url, init) : Promise.reject(new TypeError("fetch failed"))) } })
    expect((await w.ask(PLANNED.slug, "publisher-0", VERSION)).status).toBe(503)
    const asked = w.downloads().length
    up = true
    later(4 * 60_000)
    const waiting = await w.ask(PLANNED.slug, "publisher-0", VERSION)
    expect(waiting.status).toBe(503)
    expect(waiting.headers.get("retry-after")).toBe("60")
    expect(w.downloads()).toHaveLength(asked)
    later(61_000)
    expect((await w.ask(PLANNED.slug, "publisher-0", VERSION)).status).toBe(200)
  })

  it("does not leave alone a website that answered and has no icon: it is the CDN that keeps that answer", async () => {
    const w = await world({ games, hosts: { [SITE]: () => new Response("Not found", { status: 404 }) } })
    await w.ask(PLANNED.slug, "publisher-0", VERSION)
    const asked = w.downloads().length
    await w.ask(PLANNED.slug, "publisher-0", VERSION)
    expect(w.downloads().length).toBeGreaterThan(asked)
  })

  it("answers 503 when the catalog cannot be read: the game may well have a publisher", async () => {
    const w = await world({ games, hosts, sanity: () => new Response("{}", { status: 500 }) })
    const response = await w.ask(PLANNED.slug, "publisher-0", VERSION)
    expect(response.status).toBe(503)
    expect(w.downloads()).toEqual([])
  })
})
