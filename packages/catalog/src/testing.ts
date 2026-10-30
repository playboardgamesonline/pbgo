// What the tests of the package share: the platform's Sanity project as it answers (a game as the query returns it, a fake Sanity to read it
// from), a fake web of picture hosts, the bytes of pictures, and the two things the catalog joins (an entry of the registry, a game of the
// Studio) with the line it makes. Not exported by the package.

import type { GameEntry } from "@pbgo/core/lib/binding"
import type { CatalogEntry, CatalogGame } from "./catalog"
import { CATALOG_QUERY, PLATFORM_DATASET, PLATFORM_PROJECT_ID } from "./sanity"

// ---------- A fake Sanity ----------

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

/** The address of a picture's file in the image CDN of the platform's project, as the query returns it. */
export const cdn = (file: string, project = PLATFORM_PROJECT_ID, dataset = PLATFORM_DATASET) => `https://cdn.sanity.io/images/${project}/${dataset}/${file}`

/** A published game as the query returns it: nothing but what it needs to be a game (a name and a slug), unless the test says more. */
export const sanityGame = (slug: string, overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  _id: `game-${slug}`,
  _updatedAt: "2026-10-30T10:00:00Z",
  name: slug,
  slug,
  ...overrides,
})

/** What Sanity answers: the result of the query, or a failure (status and body as Sanity writes them). */
export type SanityAnswer = unknown[] | { status: number; body: unknown }

export type SanityCall = { url: URL; init: RequestInit }

/** The error Sanity answers with. */
export const sanityFailure = (status: number, description: string) => ({ status, body: { error: { statusCode: status, description, type: "queryParseError" } } })

/** A `fetch` that answers like the project's API: the result it is given, or a failure. `calls` is every request it was asked. */
export function fakeSanity(answer: SanityAnswer) {
  const calls: SanityCall[] = []
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: new URL(String(input)), init: init ?? {} })
    return Array.isArray(answer) ? reply(200, { ms: 3, query: CATALOG_QUERY, result: answer }) : reply(answer.status, answer.body)
  }) as typeof fetch
  return { fetch: fetcher, calls }
}

// ---------- A fake web ----------

/** What a host answers to a request for one of its URLs. */
export type HostHandler = (url: URL, init: RequestInit) => Response | Promise<Response>

/**
 * A `fetch` for a whole network: a request goes to the handler of its host's name in `hosts`, and a host nobody serves is a network
 * failure. `requests` is everything it was asked, in order.
 */
export function fakeWeb(hosts: Record<string, HostHandler> = {}) {
  const requests: { url: string; init: RequestInit }[] = []
  const fetcher = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input))
    requests.push({ url: url.href, init })
    const handler = hosts[url.host]
    if (!handler) throw new TypeError("fetch failed")
    return handler(url, init)
  }) as typeof fetch
  return { fetch: fetcher, requests }
}

// ---------- Pictures ----------

export type PictureKind = "png" | "jpeg" | "gif" | "webp" | "avif" | "svg" | "ico"

const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0))
// The first bytes of each kind of file: all a sniffer looks at
const HEADS: Record<PictureKind, number[]> = {
  png: [0x89, ...ascii("PNG"), 0x0d, 0x0a, 0x1a, 0x0a],
  jpeg: [0xff, 0xd8, 0xff, 0xe0],
  gif: ascii("GIF89a"),
  webp: [...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP")],
  avif: [0, 0, 0, 0x1c, ...ascii("ftypavif")],
  svg: ascii('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1">'),
  // An icon file: its header says it holds one image
  ico: [0, 0, 1, 0, 1, 0],
}

/** The bytes of a picture of that kind, `size` of them (its first bytes at least, then zeros): enough for a sniffer, not for a viewer. */
export function pictureBytes(kind: PictureKind, size = 64): Uint8Array<ArrayBuffer> {
  const head = HEADS[kind]
  const bytes = new Uint8Array(Math.max(size, head.length))
  bytes.set(head)
  return bytes
}

/** A host's answer with a picture in it. */
export const pictureResponse = (kind: PictureKind = "png", init: ResponseInit = {}) => new Response(pictureBytes(kind), { status: 200, ...init })

/** A web page, what a host sends when the link no longer leads to a picture (a sign-in page, an error page). */
export const webPage = () => new TextEncoder().encode("<!doctype html><html><body>Sign in</body></html>")

/** A web page with this in its head: what a host answers to the page of a publisher's website. */
export const htmlResponse = (head: string, init: ResponseInit = {}) =>
  new Response(`<!doctype html><html><head><title>A publisher</title>${head}</head><body>Games</body></html>`, { status: 200, headers: { "content-type": "text/html; charset=utf-8" }, ...init })

// ---------- The games the catalog joins ----------

/** An entry of the registry. Not live unless the test says so. */
export const registryGame = (slug: string, overrides: Partial<GameEntry> = {}): GameEntry => ({
  slug,
  name: slug,
  tagline: "",
  sanityProjectId: "abcd1234",
  live: false,
  indexable: false,
  ...overrides,
})

/** A game of the Studio with nothing filled but its slug and name. */
export const catalogGame = (slug: string, overrides: Partial<CatalogGame> = {}): CatalogGame => ({
  slug,
  name: slug,
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
  updatedAt: "",
  ...overrides,
})

/** What `catalogEntry` is told: the flags of the registry, the values of the game of the Studio (`game`) and the games it is linked to. */
type EntryOptions = { live?: boolean; indexable?: boolean; game?: Partial<CatalogGame>; related?: string[] }

/** A line of the catalog. Not live and not indexable unless the test says so; `game` are the values of its game of the Studio. */
export const catalogEntry = (slug: string, { live = false, indexable = false, game = {}, related = [] }: EntryOptions = {}): CatalogEntry => ({
  slug,
  live,
  indexable,
  game: catalogGame(slug, game),
  related,
})
