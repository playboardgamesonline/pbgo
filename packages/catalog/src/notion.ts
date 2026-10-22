// The Notion reader: the Games database (and the Editors one it points to) as `PlannedGame`s, and the links of its pictures. A plain
// `fetch` against Notion's REST API, no SDK. No framework here either: the caller hands in the token, and `init` carries Next's cache
// options (`server.ts`). Notion is the source of a planned game's words and numbers, never of a live one's (those come from the
// game's Sanity project).

import type { Locale } from "@pbgo/core/lib/i18n"
import { cleanName, nameProblem, slugProblem } from "@pbgo/games/slug"
import { LANGUAGES } from "@pbgo/studio-kit/constants"
// A value import from a sibling file would need a `.ts` extension, which apps/web's tsc refuses: only types come from there
import type { ArtSlot, PlannedGame, Publisher } from "./catalog"

export const NOTION_API = "https://api.notion.com/v1"
/** The API version the parsing below is written for: a database is queried at `/databases/<id>/query`. */
export const NOTION_VERSION = "2022-06-28"
export const GAMES_DATABASE_ID = "3ffd1ca3-468f-80e8-a371-ed666deecc9a"
export const EDITORS_DATABASE_ID = "3ffd1ca3-468f-80e0-ba62-fb466ca8a6c8"

const PAGE_SIZE = 100
/** A guard against a runaway cursor: 1 000 rows are twenty times today's database. */
const MAX_REQUESTS = 10
const DEFAULT_TIMEOUT_MS = 5000
const MAX_MESSAGE_LENGTH = 200
/** Notion's `Retry-After` is believed up to this many seconds: a larger wait (or a mistake) would hold a picture back for good. */
const MAX_RETRY_AFTER_SECONDS = 120

/** The columns of the Games database, by the name Notion gives them. Everything else in the database is ignored. */
export const COLUMNS = {
  name: "Name",
  slug: "Slug",
  status: "Status",
  priority: "Priority",
  effort: "Effort",
  players: "Players",
  duration: "Duration",
  age: "Age",
  authors: "Author(s)",
  artists: "Artwork",
  editor: "Editor",
  /** Filled for an expansion (it points to its base game): expansions are not part of the catalog. */
  parent: "Parent item",
  logo: "Logo",
  icon: "Icon",
  background: "Background",
} as const

/** The columns of the Editors database. */
const EDITOR_COLUMNS = { name: "Name", url: "URL" } as const

const descriptionColumn = (locale: Locale) => `Description ${locale.toUpperCase()}`
const rulesColumn = (locale: Locale) => `Rules ${locale.toUpperCase()}`

/** The columns the reader cannot do without: a database that lacks one is not the Games database. */
const REQUIRED_COLUMNS: readonly string[] = [COLUMNS.name, COLUMNS.slug]
const OPTIONAL_COLUMNS: readonly string[] = [
  ...Object.values(COLUMNS).filter((column) => !REQUIRED_COLUMNS.includes(column)),
  ...LANGUAGES.flatMap((language) => [descriptionColumn(language.id), rulesColumn(language.id)]),
]

/**
 * A failed call to Notion. The message never holds the token. `status` is the HTTP status, 0 when Notion could not be reached.
 * `retryAfter` is what a 429 asks: the seconds to wait, null when it did not say (or not in seconds).
 */
export class NotionError extends Error {
  readonly status: number
  readonly code: string | null
  readonly retryAfter: number | null
  constructor(message: string, status: number, code: string | null = null, retryAfter: number | null = null) {
    super(message)
    this.name = "NotionError"
    this.status = status
    this.code = code
    this.retryAfter = retryAfter
  }
}

export type NotionReadOptions = {
  /** The secret of an internal integration connected to the databases. */
  token: string
  /** Defaults to the global `fetch` (Next's, which caches). */
  fetch?: typeof fetch
  /** Added to every request, e.g. Next's `{ next: { revalidate, tags } }`. The method, headers, body and signal are not overridable. */
  init?: RequestInit
  /** Per request, 5 seconds by default. */
  timeoutMs?: number
}

/** A row of the Games database that is not in the catalog, and why. */
export type SkippedRow = { id: string; name: string; reason: string }

export type PlannedRead = {
  games: PlannedGame[]
  skipped: SkippedRow[]
  /** The rows that are expansions of another game: left out on purpose, so not in `skipped`. */
  expansions: number
  /** Things worth fixing in Notion that do not stop the catalog (a missing column, an unreadable Editors database). */
  warnings: string[]
}

type NotionPage = {
  id: string
  last_edited_time?: unknown
  archived?: unknown
  in_trash?: unknown
  properties?: unknown
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)

/** The `Retry-After` of a response in whole seconds (Notion writes seconds; an HTTP date is not read), cut to `MAX_RETRY_AFTER_SECONDS`, or null. */
function retryAfterOf(response: Response): number | null {
  const header = response.headers.get("retry-after")?.trim()
  return header && /^\d+(\.\d+)?$/.test(header) ? Math.min(Math.ceil(Number(header)), MAX_RETRY_AFTER_SECONDS) : null
}

async function post(path: string, body: unknown, options: NotionReadOptions): Promise<unknown> {
  const doFetch = options.fetch ?? fetch
  let response: Response
  try {
    response = await doFetch(`${NOTION_API}${path}`, {
      ...options.init,
      method: "POST",
      headers: { Authorization: `Bearer ${options.token}`, "Notion-Version": NOTION_VERSION, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    })
  } catch (error) {
    // Only the kind of failure (TimeoutError, TypeError…): the request holds the token, so nothing of it is repeated
    throw new NotionError(`Notion could not be reached (${error instanceof Error ? error.name : "unknown error"})`, 0)
  }
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const code = isRecord(payload) && typeof payload.code === "string" ? payload.code : null
    const message = isRecord(payload) && typeof payload.message === "string" ? payload.message.slice(0, MAX_MESSAGE_LENGTH) : ""
    const retryAfter = response.status === 429 ? retryAfterOf(response) : null
    throw new NotionError(`Notion answered ${response.status}${code ? ` ${code}` : ""}${message ? `: ${message}` : ""}`, response.status, code, retryAfter)
  }
  return payload
}

/** Every row of a database, the oldest first (so that two rows with one slug are settled the same way every time). */
async function queryAll(databaseId: string, options: NotionReadOptions): Promise<NotionPage[]> {
  const pages: NotionPage[] = []
  let cursor: string | undefined
  for (let request = 0; request < MAX_REQUESTS; request++) {
    const body = { page_size: PAGE_SIZE, sorts: [{ timestamp: "created_time", direction: "ascending" }], ...(cursor ? { start_cursor: cursor } : {}) }
    const payload = await post(`/databases/${databaseId}/query`, body, options)
    if (!isRecord(payload) || !Array.isArray(payload.results)) throw new NotionError("Notion answered with something that is not a list of rows", 200)
    for (const result of payload.results) if (isRecord(result) && typeof result.id === "string") pages.push({ ...result, id: result.id })
    if (payload.has_more !== true || typeof payload.next_cursor !== "string") return pages
    cursor = payload.next_cursor
  }
  throw new NotionError(`More than ${MAX_REQUESTS * PAGE_SIZE} rows in a database: the reader stops there`, 200)
}

// ---------- A property's value ----------

/** The value of a property: Notion nests it under the property's own type (`{ type: "select", select: {…} }`). */
function value(page: NotionPage, column: string): unknown {
  if (!isRecord(page.properties)) return undefined
  const property = page.properties[column]
  return isRecord(property) && typeof property.type === "string" ? property[property.type] : undefined
}

/** The text of a title or a rich text, as typed (white space inside kept, the ends trimmed). */
const textOf = (raw: unknown): string =>
  Array.isArray(raw) ? raw.map((part) => (isRecord(part) && typeof part.plain_text === "string" ? part.plain_text : "")).join("").trim() : ""

/** The name of a select or a status, null when none is chosen. */
const optionOf = (raw: unknown): string | null => (isRecord(raw) && typeof raw.name === "string" ? cleanName(raw.name) || null : null)

const optionsOf = (raw: unknown): string[] => (Array.isArray(raw) ? raw.flatMap((item) => optionOf(item) ?? []) : [])

/** A number of minutes: more than none. */
const minutesOf = (raw: unknown): number | null => (typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : null)

/** A web link, or null: a rulebook or a website is only ever opened if it is http(s). `secureOnly`: https alone, for what the server itself fetches. */
function linkOf(raw: unknown, secureOnly = false): string | null {
  if (typeof raw !== "string") return null
  const link = raw.trim()
  try {
    const { protocol } = new URL(link)
    return protocol === "https:" || (protocol === "http:" && !secureOnly) ? link : null
  } catch {
    return null
  }
}

/** Notion writes an id with dashes in one place and without in another. */
const normalizeId = (id: string): string => id.replace(/-/g, "").toLowerCase()

const relationOf = (raw: unknown): string[] =>
  Array.isArray(raw) ? raw.flatMap((item) => (isRecord(item) && typeof item.id === "string" ? normalizeId(item.id) : [])) : []

/**
 * The link of the first picture of a files property, or null: an uploaded file (a link that expires after about an hour) or an
 * external one (a link that stays). https only, because the server fetches it (`picture.ts` refuses the rest again).
 */
function pictureOf(raw: unknown): string | null {
  if (!Array.isArray(raw)) return null
  for (const file of raw) {
    if (!isRecord(file)) continue
    const source = file.type === "file" ? file.file : file.type === "external" ? file.external : null
    const link = isRecord(source) ? linkOf(source.url, true) : null
    if (link) return link
  }
  return null
}

/** Whether a files property holds a picture the server can fetch: the flag of `PlannedGame.art`, never the link (it would expire in the cache). */
const hasPicture = (raw: unknown): boolean => pictureOf(raw) !== null

const editedAtOf = (page: NotionPage): string => (typeof page.last_edited_time === "string" ? page.last_edited_time : "")

/** "4", "2 - 5" or "3+" (a hyphen or a dash), as the Players select writes it. */
function playersOf(label: string | null): PlannedGame["players"] {
  const match = label === null ? null : /^(\d+)(?:\s*[-–—]\s*(\d+)|\s*(\+))?$/.exec(label)
  if (!match?.[1]) return null
  const min = Number(match[1])
  const max = match[3] ? null : match[2] ? Number(match[2]) : min
  return min >= 1 && (max === null || max >= min) ? { min, max } : null
}

/** "8+" → 8 */
function ageOf(label: string | null): number | null {
  const match = label === null ? null : /^(\d+)\s*\+?$/.exec(label)
  return match?.[1] ? Number(match[1]) : null
}

/** "P2 · Next" → 2 */
function priorityOf(label: string | null): number | null {
  const match = label === null ? null : /^P(\d)/.exec(label)
  return match?.[1] ? Number(match[1]) : null
}

// ---------- The databases ----------

/** The publishers by id. Never throws: without them the games are listed with no publisher, and the warning says why. */
async function readPublishers(options: NotionReadOptions, warnings: string[]): Promise<Map<string, Publisher>> {
  const publishers = new Map<string, Publisher>()
  try {
    for (const page of await queryAll(EDITORS_DATABASE_ID, options)) {
      const name = cleanName(textOf(value(page, EDITOR_COLUMNS.name)))
      if (name) publishers.set(normalizeId(page.id), { name, url: linkOf(value(page, EDITOR_COLUMNS.url)) })
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error"
    warnings.push(`The Editors database could not be read, so no game has a publisher (connect the integration to it too): ${reason}`)
  }
  return publishers
}

/** The columns a row should have and does not: a renamed or deleted column would otherwise empty a field without a word. */
function missingColumns(page: NotionPage, columns: readonly string[]): string[] {
  const properties = isRecord(page.properties) ? page.properties : {}
  return columns.filter((column) => !(column in properties))
}

function planned(page: NotionPage, name: string, slug: string, publishers: Map<string, Publisher>): PlannedGame {
  const byLanguage = (column: (locale: Locale) => string, read: (raw: unknown) => string | null): Partial<Record<Locale, string>> => {
    const values: Partial<Record<Locale, string>> = {}
    for (const { id } of LANGUAGES) {
      const text = read(value(page, column(id)))
      if (text) values[id] = text
    }
    return values
  }
  return {
    slug,
    name,
    status: optionOf(value(page, COLUMNS.status)),
    priority: priorityOf(optionOf(value(page, COLUMNS.priority))),
    effort: optionOf(value(page, COLUMNS.effort)),
    descriptions: byLanguage(descriptionColumn, (raw) => textOf(raw) || null),
    players: playersOf(optionOf(value(page, COLUMNS.players))),
    duration: minutesOf(value(page, COLUMNS.duration)),
    age: ageOf(optionOf(value(page, COLUMNS.age))),
    authors: optionsOf(value(page, COLUMNS.authors)),
    artists: optionsOf(value(page, COLUMNS.artists)),
    publishers: relationOf(value(page, COLUMNS.editor)).flatMap((id) => publishers.get(id) ?? []),
    rules: byLanguage(rulesColumn, linkOf),
    art: {
      logo: hasPicture(value(page, COLUMNS.logo)),
      icon: hasPicture(value(page, COLUMNS.icon)),
      background: hasPicture(value(page, COLUMNS.background)),
    },
    editedAt: editedAtOf(page),
    notionPageId: page.id,
  }
}

/** Why a row cannot be a game of the site, in a few words, or undefined when it can. `taken`: the slug → name of the rows kept so far. */
function rowProblem(name: string, slug: string, taken: ReadonlyMap<string, string>): string | undefined {
  if (!name) return "it has no name"
  const nameIssue = nameProblem(name)
  if (nameIssue) return nameIssue
  if (!slug) return "it has no slug (fill the Slug column)"
  const slugIssue = slugProblem(slug)
  if (slugIssue) return slugIssue
  const owner = taken.get(slug)
  return owner === undefined ? undefined : `its slug "${slug}" is already the one of "${owner}"`
}

/** What a row says about itself goes to a terminal (`pnpm catalog:list`) and to the logs: no control character, an escape included. */
const printable = (text: string): string => text.replace(/\p{Cc}/gu, "")

/**
 * The planned games: every row of the Games database that is a game with a name and a slug the site can serve. Whether a slug is
 * also a live game is for `buildCatalog` to settle. A row that cannot be a game is reported in `skipped`, never guessed at: no
 * name (or one that is not a line of text), no `Slug`, a slug that is not one (or is a route of the site), or the same slug as an
 * older row (the older row wins). Throws a `NotionError` when Notion cannot be read or the database has no `Name` or no `Slug` column.
 */
export async function readPlannedGames(options: NotionReadOptions): Promise<PlannedRead> {
  const warnings: string[] = []
  const [pages, publishers] = await Promise.all([queryAll(GAMES_DATABASE_ID, options), readPublishers(options, warnings)])

  const first = pages[0]
  if (first) {
    const missing = missingColumns(first, REQUIRED_COLUMNS)
    if (missing.length > 0) throw new NotionError(`The Games database has no ${missing.map((column) => `"${column}"`).join(" or ")} column`, 200)
    for (const column of missingColumns(first, OPTIONAL_COLUMNS)) warnings.push(`The Games database has no "${column}" column: it is left empty for every game`)
  }

  const games: PlannedGame[] = []
  const skipped: SkippedRow[] = []
  const slugs = new Map<string, string>()
  let expansions = 0
  for (const page of pages) {
    if (page.archived === true || page.in_trash === true) continue
    if (relationOf(value(page, COLUMNS.parent)).length > 0) {
      expansions++
      continue
    }
    const name = cleanName(textOf(value(page, COLUMNS.name)))
    const slug = textOf(value(page, COLUMNS.slug))
    const problem = rowProblem(name, slug, slugs)
    if (problem) {
      skipped.push({ id: page.id, name: printable(name), reason: printable(problem) })
      continue
    }
    slugs.set(slug, name)
    games.push(planned(page, name, slug, publishers))
  }
  return { games, skipped, expansions, warnings }
}

/** What a row's pictures are right now: the date of its last edit and the link of each picture it has, null for one it has not. */
export type PictureLinks = Map<string, { editedAt: string; links: Record<ArtSlot, string | null> }>

/**
 * The links of the pictures of every row of the Games database, by the id of the row's Notion page (`PlannedGame.notionPageId`): what
 * the picture route fetches. One query serves every picture of every game. Read it without a cache (`init: { cache: "no-store" }`): the
 * link of an uploaded file expires after about an hour, so a link that was kept would be dead. Throws a `NotionError`.
 */
export async function readPictureLinks(options: NotionReadOptions): Promise<PictureLinks> {
  const pictures: PictureLinks = new Map()
  for (const page of await queryAll(GAMES_DATABASE_ID, options)) {
    if (page.archived === true || page.in_trash === true) continue
    pictures.set(page.id, {
      editedAt: editedAtOf(page),
      links: {
        logo: pictureOf(value(page, COLUMNS.logo)),
        icon: pictureOf(value(page, COLUMNS.icon)),
        background: pictureOf(value(page, COLUMNS.background)),
      },
    })
  }
  return pictures
}
