// The Notion reader: the Games database (with the Editors and Creators ones it points to, and the Games Development one that points
// to it) as `NotionGame`s, and the links of its pictures. A plain `fetch` against Notion's REST API, no SDK. No framework here
// either: the caller hands in the token, and `init` carries Next's cache options (`server.ts`). Notion is the source of a planned
// game's words and numbers, never of a live one's (those come from the game's Sanity project).

import type { Locale } from "@pbgo/core/lib/i18n"
import { cleanName, nameProblem, slugProblem } from "@pbgo/games/slug"
import { LANGUAGES } from "@pbgo/studio-kit/constants"
// A value import from a sibling file would need a `.ts` extension, which apps/web's tsc refuses: only types come from there
import type { ArtSlot, DevelopmentRank, NotionGame, Publisher, Rank } from "./catalog"

export const NOTION_API = "https://api.notion.com/v1"
/** The API version the parsing below is written for: a database is queried at `/databases/<id>/query`, its schema is at `/databases/<id>`. */
export const NOTION_VERSION = "2022-06-28"
export const GAMES_DATABASE_ID = "3ffd1ca3-468f-80e8-a371-ed666deecc9a"
export const EDITORS_DATABASE_ID = "3ffd1ca3-468f-80e0-ba62-fb466ca8a6c8"
export const CREATORS_DATABASE_ID = "5712daa0-497d-4fa7-9634-1c2320f4446d"
export const DEVELOPMENT_DATABASE_ID = "401d1ca3-468f-8159-a5c2-fbf706218640"

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
  players: "Players",
  duration: "Duration",
  age: "Age",
  /** Authors and illustrators are relations to the Creators database, editors a relation to the Editors one. */
  authors: "Authors",
  illustrators: "Illustrators",
  editors: "Editors",
  /** Filled for an expansion (it points to its base game): expansions are not part of the catalog, a standalone one apart (`type`). */
  parent: "Parent item",
  /** A select. A row with a `parent` whose type is `STANDALONE_EXPANSION` is a game of its own: it plays without its base game, so it is listed. */
  type: "Type",
  /** A relation to other rows of this database: the games this one is related to (a spin-off, a re-skin). Notion keeps it one way, by hand, so a game may be named by the other one only. */
  related: "Related Games",
  logo: "Logo",
  icon: "Icon",
  background: "Background",
} as const

/** The option of the `Type` select that marks an expansion which is a game of its own, as Notion spells it. */
const STANDALONE_EXPANSION = "Standalone expansion"

/** The columns of the Editors database. */
const EDITOR_COLUMNS = { name: "Name", url: "URL" } as const

/** The columns of the Creators database, the people. Its `Role` is not read: the relation of the game says what a person is to it. */
const CREATOR_COLUMNS = { name: "Name" } as const

/**
 * The columns of the Games Development database, one row per game, and the type each must have. `game` is the relation to the
 * game's row of the Games database; the three others are what orders the coming-soon games.
 */
const DEVELOPMENT_COLUMNS = {
  game: { name: "Game", type: "relation" },
  priority: { name: "Priority", type: "select" },
  status: { name: "Status", type: "status" },
  effort: { name: "Effort", type: "select" },
} as const

const RANKED_FIELDS = ["priority", "status", "effort"] as const satisfies readonly (keyof DevelopmentRank)[]

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

export type NotionRead = {
  games: NotionGame[]
  skipped: SkippedRow[]
  /** The rows that are expansions of another game: left out on purpose, so not in `skipped`. A standalone expansion is a game of its own, not one of them. */
  expansions: number
  /** Things worth fixing in Notion that do not stop the catalog (a missing column, an unreadable Editors, Creators or Games Development database). */
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

/** One call to Notion's API: a POST carries `body` as JSON, a GET carries none. */
async function request(method: "GET" | "POST", path: string, options: NotionReadOptions, body?: unknown): Promise<unknown> {
  const doFetch = options.fetch ?? fetch
  const headers = { Authorization: `Bearer ${options.token}`, "Notion-Version": NOTION_VERSION }
  let response: Response
  try {
    response = await doFetch(`${NOTION_API}${path}`, {
      ...options.init,
      method,
      headers: method === "POST" ? { ...headers, "Content-Type": "application/json" } : headers,
      body: method === "POST" ? JSON.stringify(body) : undefined,
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
  for (let call = 0; call < MAX_REQUESTS; call++) {
    const body = { page_size: PAGE_SIZE, sorts: [{ timestamp: "created_time", direction: "ascending" }], ...(cursor ? { start_cursor: cursor } : {}) }
    const payload = await request("POST", `/databases/${databaseId}/query`, options, body)
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

/** What a row says about itself goes to a terminal (`pnpm catalog:list`) and to the logs: no control character, an escape included. */
const printable = (text: string): string => text.replace(/\p{Cc}/gu, "")

/** The name of a person or of a publisher: one line of printable text. White space becomes one space first, so a tab does not glue two words. */
const creditOf = (raw: unknown): string => cleanName(printable(cleanName(textOf(raw))))

/** The name of a select or a status, null when none is chosen. */
const optionOf = (raw: unknown): string | null => (isRecord(raw) && typeof raw.name === "string" ? cleanName(raw.name) || null : null)

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

/** Whether a files property holds a picture the server can fetch: the flag of `NotionGame.art`, never the link (it would expire in the cache). */
const hasPicture = (raw: unknown): boolean => pictureOf(raw) !== null

const editedAtOf = (page: NotionPage): string => (typeof page.last_edited_time === "string" ? page.last_edited_time : "")

/** "4", "2 - 5" or "3+" (a hyphen or a dash), as the Players select writes it. */
function playersOf(label: string | null): NotionGame["players"] {
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

// ---------- The databases ----------

/** The rows of a database that the Games database points to, by the id of the row, and what went wrong reading them (null: nothing). */
type Related<T> = { rows: Map<string, T>; warning: string | null }

/** The warning for a database the integration could not read: `loss` is what the games lose by it, `error` why the read failed. */
const unreadable = (label: string, loss: string, error: unknown): string =>
  `The ${label} database could not be read, so ${loss} (connect the integration to it too): ${error instanceof Error ? error.message : "unknown error"}`

/**
 * Reads such a database: `read` makes what is kept of a row, or null for a row that is of no use. Never throws: without the database
 * the games are listed with that field empty, and the warning says why (`loss` is what is lost). The warning is handed back, not
 * pushed, so that the warnings come in the same order whichever database answers first.
 */
async function readRelated<T>(databaseId: string, label: string, loss: string, read: (page: NotionPage) => T | null, options: NotionReadOptions): Promise<Related<T>> {
  const rows = new Map<string, T>()
  try {
    for (const page of await queryAll(databaseId, options)) {
      const row = read(page)
      if (row !== null) rows.set(normalizeId(page.id), row)
    }
    return { rows, warning: null }
  } catch (error) {
    return { rows: new Map(), warning: unreadable(label, loss, error) }
  }
}

/** A row of the Editors database: a publisher, null when the row has no name. */
function publisherOf(page: NotionPage): Publisher | null {
  const name = creditOf(value(page, EDITOR_COLUMNS.name))
  return name ? { name, url: linkOf(value(page, EDITOR_COLUMNS.url)) } : null
}

/** A row of the Creators database: the name of a person, null when the row has none. */
const creatorOf = (page: NotionPage): string | null => creditOf(value(page, CREATOR_COLUMNS.name)) || null

/**
 * What a relation points to, in the order of the relation. An id the other database does not have (a row it left out, one the
 * integration cannot see) is dropped. A query hands back 25 ids of a relation at most: a game has a few authors, not that many.
 */
const resolve = <T>(raw: unknown, rows: ReadonlyMap<string, T>): T[] => relationOf(raw).flatMap((id) => rows.get(id) ?? [])

/** The place of the option a row chose among the options its column is configured with: null when none is chosen or the column no longer has it. */
function rankOf(raw: unknown, order: readonly (string | null)[]): Rank | null {
  const name = optionOf(raw)
  if (name === null) return null
  const position = order.indexOf(name)
  return position < 0 ? null : { position, name }
}

/**
 * What the schema of the Games Development database says about one of its columns: the options of a select or a status in the order
 * Notion keeps them (the order it sorts by), or what is wrong with the column, as the end of "The Games Development database …".
 */
function developmentColumn(properties: Record<string, unknown>, { name, type }: { name: string; type: string }): { order: (string | null)[] } | { problem: string } {
  const property = properties[name]
  if (!isRecord(property)) return { problem: `has no "${name}" column` }
  if (property.type !== type) return { problem: `has a "${name}" column that is a ${String(property.type)}, not a ${type}` }
  const config = property[type]
  return { order: isRecord(config) && Array.isArray(config.options) ? config.options.map(optionOf) : [] }
}

/**
 * Reads the Games Development database: one row per game, with the Priority, Status and Effort that order the coming-soon games
 * (`comparePlanned`), by the id of the game's row in the Games database. A game is ranked by the place of its option among the
 * options the column is configured with, the way Notion sorts a select or a status, so the schema is read for that order. A game with
 * two rows takes the older one, the way a slug does. Never throws: when the database cannot be read (the integration is not connected
 * to it, say) the games are listed by name, and a column it lacks is left out of the order; the warnings say which, and come back
 * rather than pushed, as `readRelated`'s do.
 */
async function readDevelopment(options: NotionReadOptions): Promise<{ ranks: Map<string, DevelopmentRank>; warnings: string[] }> {
  const ranks = new Map<string, DevelopmentRank>()
  const warnings: string[] = []
  try {
    const [schema, pages] = await Promise.all([request("GET", `/databases/${DEVELOPMENT_DATABASE_ID}`, options), queryAll(DEVELOPMENT_DATABASE_ID, options)])
    if (!isRecord(schema) || !isRecord(schema.properties)) throw new NotionError("Notion answered with something that is not the schema of a database", 200)
    const game = developmentColumn(schema.properties, DEVELOPMENT_COLUMNS.game)
    if ("problem" in game) return { ranks, warnings: [`The Games Development database ${game.problem}: no game is ranked, so the coming-soon games are listed by name`] }
    const orders: Partial<Record<(typeof RANKED_FIELDS)[number], (string | null)[]>> = {}
    for (const field of RANKED_FIELDS) {
      const column = developmentColumn(schema.properties, DEVELOPMENT_COLUMNS[field])
      if ("problem" in column) warnings.push(`The Games Development database ${column.problem}: it is left out of the order of the coming-soon games`)
      else orders[field] = column.order
    }
    for (const page of pages) {
      if (page.archived === true || page.in_trash === true) continue
      const rank: DevelopmentRank = { priority: null, status: null, effort: null }
      for (const field of RANKED_FIELDS) {
        const order = orders[field]
        if (order) rank[field] = rankOf(value(page, DEVELOPMENT_COLUMNS[field].name), order)
      }
      for (const id of relationOf(value(page, DEVELOPMENT_COLUMNS.game.name))) if (!ranks.has(id)) ranks.set(id, rank)
    }
    return { ranks, warnings }
  } catch (error) {
    return { ranks: new Map(), warnings: [unreadable("Games Development", "the coming-soon games are listed by name", error)] }
  }
}

/** The columns a row should have and does not: a renamed or deleted column would otherwise empty a field without a word. */
function missingColumns(page: NotionPage, columns: readonly string[]): string[] {
  const properties = isRecord(page.properties) ? page.properties : {}
  return columns.filter((column) => !(column in properties))
}

function planned(
  page: NotionPage,
  name: string,
  slug: string,
  publishers: ReadonlyMap<string, Publisher>,
  creators: ReadonlyMap<string, string>,
  developments: ReadonlyMap<string, DevelopmentRank>,
): NotionGame {
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
    descriptions: byLanguage(descriptionColumn, (raw) => textOf(raw) || null),
    players: playersOf(optionOf(value(page, COLUMNS.players))),
    duration: minutesOf(value(page, COLUMNS.duration)),
    age: ageOf(optionOf(value(page, COLUMNS.age))),
    authors: resolve(value(page, COLUMNS.authors), creators),
    illustrators: resolve(value(page, COLUMNS.illustrators), creators),
    publishers: resolve(value(page, COLUMNS.editors), publishers),
    rules: byLanguage(rulesColumn, linkOf),
    art: {
      logo: hasPicture(value(page, COLUMNS.logo)),
      icon: hasPicture(value(page, COLUMNS.icon)),
      background: hasPicture(value(page, COLUMNS.background)),
    },
    development: developments.get(normalizeId(page.id)) ?? { priority: null, status: null, effort: null },
    // Settled by `readNotionGames`, once every row is known: a link is the id of a row, and the slug is the row's
    related: [],
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

/**
 * The planned games: every row of the Games database that is a game with a name and a slug the site can serve. A row that points to
 * a base game (`Parent item`) is an expansion, not a game, unless its `Type` says it is a standalone one. Whether a slug is
 * also a live game is for `buildCatalog` to settle. A row that cannot be a game is reported in `skipped`, never guessed at: no
 * name (or one that is not a line of text), no `Slug`, a slug that is not one (or is a route of the site), or the same slug as an
 * older row (the older row wins). Throws a `NotionError` when Notion cannot be read or the database has no `Name` or no `Slug` column.
 * The Editors and Creators databases are read alongside: without one, the games come with no publisher, or no author and no
 * illustrator, and a warning says so. So is Games Development, which orders the coming-soon games: without it they are in name order.
 * The games a row points to, through `Related Games` and through its `Parent item` (a standalone expansion's base game), come back as
 * slugs in `NotionGame.related`: only the rows that are games of the catalog have one.
 */
export async function readNotionGames(options: NotionReadOptions): Promise<NotionRead> {
  const [pages, editors, creators, development] = await Promise.all([
    queryAll(GAMES_DATABASE_ID, options),
    readRelated(EDITORS_DATABASE_ID, "Editors", "no game has a publisher", publisherOf, options),
    readRelated(CREATORS_DATABASE_ID, "Creators", "no game has an author or an illustrator", creatorOf, options),
    readDevelopment(options),
  ])
  const warnings = [editors.warning, creators.warning].flatMap((warning) => warning ?? [])
  warnings.push(...development.warnings)

  const first = pages[0]
  if (first) {
    const missing = missingColumns(first, REQUIRED_COLUMNS)
    if (missing.length > 0) throw new NotionError(`The Games database has no ${missing.map((column) => `"${column}"`).join(" or ")} column`, 200)
    for (const column of missingColumns(first, OPTIONAL_COLUMNS)) warnings.push(`The Games database has no "${column}" column: it is left empty for every game`)
  }

  // A game and the ids of the rows it points to: they become slugs once every row is known
  const kept: { game: NotionGame; links: string[] }[] = []
  const skipped: SkippedRow[] = []
  const slugs = new Map<string, string>()
  const slugOf = new Map<string, string>()
  let expansions = 0
  for (const page of pages) {
    if (page.archived === true || page.in_trash === true) continue
    const parent = relationOf(value(page, COLUMNS.parent))
    if (parent.length > 0 && optionOf(value(page, COLUMNS.type)) !== STANDALONE_EXPANSION) {
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
    slugOf.set(normalizeId(page.id), slug)
    kept.push({ game: planned(page, name, slug, editors.rows, creators.rows, development.ranks), links: [...relationOf(value(page, COLUMNS.related)), ...parent] })
  }
  // A link to a row that is not a game of the catalog (an expansion, a row left out) is dropped, like an author the Creators database lacks
  const games = kept.map(({ game, links }) => ({ ...game, related: [...new Set(links.flatMap((id) => slugOf.get(id) ?? []))].filter((slug) => slug !== game.slug) }))
  return { games, skipped, expansions, warnings }
}

/** What a row's pictures are right now: the date of its last edit and the link of each picture it has, null for one it has not. */
export type PictureLinks = Map<string, { editedAt: string; links: Record<ArtSlot, string | null> }>

/**
 * The links of the pictures of every row of the Games database, by the id of the row's Notion page (`NotionGame.notionPageId`): what
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
