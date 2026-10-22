// What the tests of the package share: Notion's answers as the API writes them (a row of the Games database, a row of the Editors
// one), a fake Notion to read them from, and the two kinds of game the catalog joins. Not exported by the package.
// The column names are written out here, not read from `notion.ts`: the fixture is the database as it is, the reader is what is tested.

import type { GameEntry } from "@pbgo/core/lib/binding"
import type { Locale } from "@pbgo/core/lib/i18n"
import type { PlannedGame } from "./catalog"
import { EDITORS_DATABASE_ID, GAMES_DATABASE_ID } from "./notion"

// ---------- Notion's property values ----------

const richText = (text: string) => (text ? [{ type: "text", text: { content: text, link: null }, plain_text: text, href: null }] : [])
const property = (type: string, content: unknown) => ({ id: type, type, [type]: content })
const option = (name: string | null) => (name === null ? null : { id: name, name, color: "default" })

/** A file of a Files property that Notion hosts: its link expires. */
export const uploaded = (name = "picture.png") => ({
  name,
  type: "file",
  file: { url: `https://prod-files-secure.s3.us-west-2.amazonaws.com/test/${name}?X-Amz-Expires=3600`, expiry_time: "2026-10-22T12:00:00.000Z" },
})
/** A file of a Files property that is a link to somewhere else. */
export const external = (url = "https://example.com/picture.png") => ({ name: url, type: "external", external: { url } })
export type NotionFile = ReturnType<typeof uploaded> | ReturnType<typeof external>

// ---------- A row of the Games database ----------

export type GameRow = {
  id?: string
  name?: string
  slug?: string
  status?: string | null
  priority?: string | null
  effort?: string | null
  players?: string | null
  duration?: number | null
  age?: string | null
  authors?: string[]
  artwork?: string[]
  /** The ids of the rows of the Editors database. */
  editors?: string[]
  /** The ids of the base game: filled for an expansion. */
  parent?: string[]
  logo?: NotionFile[]
  icon?: NotionFile[]
  background?: NotionFile[]
  descriptions?: Partial<Record<Locale, string>>
  rules?: Partial<Record<Locale, string | null>>
  editedAt?: string
  archived?: boolean
  inTrash?: boolean
}

export type NotionPage = {
  object: "page"
  id: string
  created_time: string
  last_edited_time: string
  archived: boolean
  in_trash: boolean
  properties: Record<string, unknown>
}

const LOCALES = ["fr", "en", "es", "de"] as const

/** A row with every column of the Games database, empty unless the row says otherwise (an empty select is `null`, an empty text `[]`). */
export function gamePage(row: GameRow = {}): NotionPage {
  const name = row.name ?? "Sample"
  const slug = row.slug ?? "sample"
  const properties: Record<string, unknown> = {
    Name: property("title", richText(name)),
    Slug: property("rich_text", richText(slug)),
    Status: property("status", option(row.status ?? null)),
    Priority: property("select", option(row.priority ?? null)),
    Effort: property("select", option(row.effort ?? null)),
    Players: property("select", option(row.players ?? null)),
    Duration: property("number", row.duration ?? null),
    Age: property("select", option(row.age ?? null)),
    "Author(s)": property("multi_select", (row.authors ?? []).map(option)),
    Artwork: property("multi_select", (row.artwork ?? []).map(option)),
    Editor: property("relation", (row.editors ?? []).map((id) => ({ id }))),
    "Parent item": property("relation", (row.parent ?? []).map((id) => ({ id }))),
    Logo: property("files", row.logo ?? []),
    Icon: property("files", row.icon ?? []),
    Background: property("files", row.background ?? []),
  }
  for (const locale of LOCALES) {
    properties[`Description ${locale.toUpperCase()}`] = property("rich_text", richText(row.descriptions?.[locale] ?? ""))
    properties[`Rules ${locale.toUpperCase()}`] = property("url", row.rules?.[locale] ?? null)
  }
  return {
    object: "page",
    id: row.id ?? `game-${slug}`,
    created_time: "2026-01-01T00:00:00.000Z",
    last_edited_time: row.editedAt ?? "2026-10-01T00:00:00.000Z",
    archived: row.archived ?? false,
    in_trash: row.inTrash ?? false,
    properties,
  }
}

/** A row of the Editors database. The name is a title, the website may be empty. */
export function editorPage(editor: { id: string; name: string; url?: string | null }): NotionPage {
  return {
    object: "page",
    id: editor.id,
    created_time: "2026-01-01T00:00:00.000Z",
    last_edited_time: "2026-01-01T00:00:00.000Z",
    archived: false,
    in_trash: false,
    properties: { Name: property("title", richText(editor.name)), URL: property("url", editor.url ?? null) },
  }
}

// ---------- A fake Notion ----------

/** What a database answers: its rows, or a failure (status and body as Notion writes them). */
export type Answer = NotionPage[] | { status: number; body: unknown }

export type NotionCall = { database: string; headers: Record<string, string>; body: Record<string, unknown>; init: RequestInit }

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

/** The error Notion answers with. */
export const notionFailure = (status: number, code: string, message: string) => ({ status, body: { object: "error", status, code, message } })

/**
 * A `fetch` that answers like Notion's `POST /databases/<id>/query`: the rows of the database it is given, `pageSize` at a time
 * (Notion's own limit is 100), with the cursor; any other database is "not shared with the integration". `calls` is what it was asked.
 */
export function fakeNotion(databases: { games?: Answer; editors?: Answer }, pageSize = 100) {
  const answers: Record<string, Answer | undefined> = { [GAMES_DATABASE_ID]: databases.games, [EDITORS_DATABASE_ID]: databases.editors }
  const calls: NotionCall[] = []
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    const database = /^https:\/\/api\.notion\.com\/v1\/databases\/([^/]+)\/query$/.exec(String(input))?.[1]
    if (!database) return reply(404, { object: "error", status: 404, code: "invalid_request_url", message: "Invalid request URL." })
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>
    calls.push({ database, headers: (init?.headers ?? {}) as Record<string, string>, body, init: init ?? {} })
    const answer = answers[database]
    if (!answer) {
      const message = `Could not find database with ID: ${database}. Make sure the relevant pages and databases are shared with your integration.`
      return reply(404, notionFailure(404, "object_not_found", message).body)
    }
    if (!Array.isArray(answer)) return reply(answer.status, answer.body)
    const size = Math.min(Number(body.page_size) || pageSize, pageSize)
    const start = typeof body.start_cursor === "string" ? Number(body.start_cursor) : 0
    const end = start + size
    return reply(200, { object: "list", results: answer.slice(start, end), has_more: end < answer.length, next_cursor: end < answer.length ? String(end) : null })
  }) as typeof fetch
  return { fetch: fetcher, calls }
}

// ---------- A fake web ----------

/** What a host answers to a request for one of its URLs. */
export type HostHandler = (url: URL, init: RequestInit) => Response | Promise<Response>

/**
 * A `fetch` for a whole network: Notion's calls go to `notion` (a `fakeNotion`), any other host to the handler of its name in
 * `hosts`, and a host nobody serves is a network failure. `requests` is everything it was asked, in order, Notion's included.
 */
export function fakeWeb(notion: { fetch: typeof fetch }, hosts: Record<string, HostHandler> = {}) {
  const requests: { url: string; init: RequestInit }[] = []
  const fetcher = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input))
    requests.push({ url: url.href, init })
    if (url.host === "api.notion.com") return notion.fetch(url.href, init)
    const handler = hosts[url.host]
    if (!handler) throw new TypeError("fetch failed")
    return handler(url, init)
  }) as typeof fetch
  return { fetch: fetcher, requests }
}

// ---------- Pictures ----------

export type PictureKind = "png" | "jpeg" | "gif" | "webp" | "avif" | "svg"

const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0))
// The first bytes of each kind of file: all a sniffer looks at
const HEADS: Record<PictureKind, number[]> = {
  png: [0x89, ...ascii("PNG"), 0x0d, 0x0a, 0x1a, 0x0a],
  jpeg: [0xff, 0xd8, 0xff, 0xe0],
  gif: ascii("GIF89a"),
  webp: [...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP")],
  avif: [0, 0, 0, 0x1c, ...ascii("ftypavif")],
  svg: ascii('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1">'),
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

/** A planned game with nothing filled but its slug and name. */
export const plannedGame = (slug: string, overrides: Partial<PlannedGame> = {}): PlannedGame => ({
  slug,
  name: slug,
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
  editedAt: "",
  notionPageId: `game-${slug}`,
  ...overrides,
})
