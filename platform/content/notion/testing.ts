// What the tests of the Notion reader share: Notion's answers as the API writes them (a row of the Games database, a row of the Editors,
// Creators or Games Development one, and the schema of the last) and a fake Notion to read them from.
// The column names are written out here, not read from `reader.ts`: the fixture is the database as it is, the reader is what is tested.

import type { DevelopmentRank, Locale, Rank } from "./types.ts"
import { CREATORS_DATABASE_ID, DEVELOPMENT_DATABASE_ID, EDITORS_DATABASE_ID, GAMES_DATABASE_ID } from "./reader.ts"

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
  players?: string | null
  duration?: number | null
  /** The `Complexity` number: BoardGameGeek's weight of the game. */
  complexity?: number | null
  /** The `BGG ID` number: the game's id on BoardGameGeek. */
  bggId?: number | null
  /** The start of the `Release date`, as Notion writes it: a day (`2010-01-01`), or a day and a time. */
  releaseDate?: string | null
  age?: string | null
  /** The options of the `Tags` multi-select. */
  tags?: string[]
  /** The ids of the rows of the Creators database. */
  authors?: string[]
  illustrators?: string[]
  /** The ids of the rows of the Editors database. */
  editors?: string[]
  /** The ids of the base game: filled for an expansion, a standalone one included. */
  parent?: string[]
  /** The `Type` select: `Base game`, `Expansion` or `Standalone expansion`. */
  type?: string | null
  /** The ids of the rows of the Games database it is related to: kept by hand, on one side or on both. */
  related?: string[]
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
    Players: property("select", option(row.players ?? null)),
    Duration: property("number", row.duration ?? null),
    Complexity: property("number", row.complexity ?? null),
    "BGG ID": property("number", row.bggId ?? null),
    "Release date": property("date", row.releaseDate ? { start: row.releaseDate, end: null, time_zone: null } : null),
    Age: property("select", option(row.age ?? null)),
    Tags: property("multi_select", (row.tags ?? []).map(option)),
    Designers: property("relation", (row.authors ?? []).map((id) => ({ id }))),
    Artists: property("relation", (row.illustrators ?? []).map((id) => ({ id }))),
    Publishers: property("relation", (row.editors ?? []).map((id) => ({ id }))),
    "Parent item": property("relation", (row.parent ?? []).map((id) => ({ id }))),
    Type: property("select", option(row.type ?? null)),
    "Related Games": property("relation", (row.related ?? []).map((id) => ({ id }))),
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

/** A row of a database the Games one points to, or that points to it: nothing but its properties. */
const relatedPage = (id: string, properties: Record<string, unknown>, flags: { archived?: boolean; inTrash?: boolean } = {}): NotionPage => ({
  object: "page",
  id,
  created_time: "2026-01-01T00:00:00.000Z",
  last_edited_time: "2026-01-01T00:00:00.000Z",
  archived: flags.archived ?? false,
  in_trash: flags.inTrash ?? false,
  properties,
})

/** A row of the Editors database. The name is a title, the website and the logo may be empty. */
export const editorPage = (editor: { id: string; name: string; url?: string | null; logo?: NotionFile[]; archived?: boolean; inTrash?: boolean }): NotionPage =>
  relatedPage(editor.id, { Name: property("title", richText(editor.name)), URL: property("url", editor.url ?? null), Logo: property("files", editor.logo ?? []) }, editor)

/** A row of the Creators database, a person. The name is a title; `roles` is the multi-select Notion keeps beside it. */
export const creatorPage = (creator: { id: string; name: string; roles?: string[] }): NotionPage =>
  relatedPage(creator.id, { Name: property("title", richText(creator.name)), Role: property("multi_select", (creator.roles ?? []).map(option)) })

// ---------- The Games Development database ----------

/** The three columns that order the coming-soon games. */
export type DevelopmentField = "priority" | "status" | "effort"

/**
 * The options of those columns in the order Notion keeps them (the order it sorts by), as the real database has them. A status is
 * listed here flat, as `options` has it: its groups (To-do, In progress, Complete) order them differently inside a group.
 */
export const DEVELOPMENT_OPTIONS: Record<DevelopmentField, readonly string[]> = {
  priority: ["P1 · Now", "P2 · Next", "P3 · Later", "P4 · Someday"],
  status: ["Not started", "Rules", "Engine", "Content", "Table", "Playtest", "Paused", "Live"],
  effort: ["S", "M", "L", "XL", "XXL"],
}

const configured = (names: readonly string[]) => ({ options: names.map((name) => ({ id: `option-${name}`, name, color: "default" })) })

/**
 * The Games Development database as `GET /databases/<id>` writes it: its columns, the select and the status with the options they are
 * configured with (`options` overrides them). A test breaks a column by deleting or replacing its entry of `properties`.
 */
export const developmentDatabase = (options: Partial<Record<DevelopmentField, readonly string[]>> = {}) => ({
  object: "database",
  id: DEVELOPMENT_DATABASE_ID,
  properties: {
    Slug: { id: "title", name: "Slug", type: "title", title: {} },
    Game: {
      id: "frAv",
      name: "Game",
      type: "relation",
      relation: { database_id: GAMES_DATABASE_ID, type: "dual_property", dual_property: { synced_property_name: "Development", synced_property_id: "zgN^" } },
    },
    Priority: { id: ":ios", name: "Priority", type: "select", select: configured(options.priority ?? DEVELOPMENT_OPTIONS.priority) },
    Status: { id: "<[xq", name: "Status", type: "status", status: { ...configured(options.status ?? DEVELOPMENT_OPTIONS.status), groups: [] } },
    Effort: { id: "?iB~", name: "Effort", type: "select", select: configured(options.effort ?? DEVELOPMENT_OPTIONS.effort) },
  } as Record<string, unknown>,
})

export type DevelopmentRow = {
  id?: string
  slug?: string
  /** The ids of the rows of the Games database it is the task of: none for a task that is not a game's. */
  game?: string[]
  priority?: string | null
  status?: string | null
  effort?: string | null
  archived?: boolean
  inTrash?: boolean
}

/** A row of the Games Development database, the task of a game: a title (the slug), the relation to the game and the three options. */
export const developmentPage = (row: DevelopmentRow = {}): NotionPage => {
  const slug = row.slug ?? "sample"
  return relatedPage(
    row.id ?? `development-${slug}`,
    {
      Slug: property("title", richText(slug)),
      Game: { ...property("relation", (row.game ?? []).map((id) => ({ id }))), has_more: false },
      Priority: property("select", option(row.priority ?? null)),
      Status: property("status", option(row.status ?? null)),
      Effort: property("select", option(row.effort ?? null)),
    },
    row,
  )
}

/**
 * Where a game stands as the catalog keeps it (`NotionGame.development`): each option by name, at its place in `DEVELOPMENT_OPTIONS`;
 * a column left out, or an option the column does not list, is null.
 */
export function developmentRank(chosen: Partial<Record<DevelopmentField, string | null>> = {}): DevelopmentRank {
  const rank = (field: DevelopmentField): Rank | null => {
    const name = chosen[field]
    const position = name ? DEVELOPMENT_OPTIONS[field].indexOf(name) : -1
    return name && position >= 0 ? { position, name } : null
  }
  return { priority: rank("priority"), status: rank("status"), effort: rank("effort") }
}

// ---------- A fake Notion ----------

/** What a database answers: its rows, or a failure (status and body as Notion writes them). */
export type Answer = NotionPage[] | { status: number; body: unknown }

export type NotionCall = { database: string; headers: Record<string, string>; body: Record<string, unknown>; init: RequestInit }

/** What `GET /databases/<id>` answers: the database (its `properties`), or a failure. */
export type SchemaAnswer = ReturnType<typeof developmentDatabase> | { status: number; body: unknown }

/** A read of a database's schema: no body. */
export type SchemaCall = { database: string; headers: Record<string, string>; init: RequestInit }

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

/** The error Notion answers with. */
export const notionFailure = (status: number, code: string, message: string) => ({ status, body: { object: "error", status, code, message } })

/** What Notion answers for a database the integration is not connected to. */
const notShared = (database: string) =>
  reply(404, notionFailure(404, "object_not_found", `Could not find database with ID: ${database}. Make sure the relevant pages and databases are shared with your integration.`).body)

/**
 * A `fetch` that answers like Notion: `POST /databases/<id>/query` with the rows of the database it is given, `pageSize` at a time
 * (Notion's own limit is 100), with the cursor, and `GET /databases/<id>` with the schema of the Games Development database (the
 * real one unless `developmentSchema` says otherwise, and only when `development` or `developmentSchema` is given). Any other database
 * is "not shared with the integration". `calls` is every query it was asked, `schemaCalls` every read of a schema.
 */
export function fakeNotion(
  databases: { games?: Answer; editors?: Answer; creators?: Answer; development?: Answer; developmentSchema?: SchemaAnswer },
  pageSize = 100,
) {
  const answers: Record<string, Answer | undefined> = {
    [GAMES_DATABASE_ID]: databases.games,
    [EDITORS_DATABASE_ID]: databases.editors,
    [CREATORS_DATABASE_ID]: databases.creators,
    [DEVELOPMENT_DATABASE_ID]: databases.development,
  }
  const schemas: Record<string, SchemaAnswer | undefined> = {
    [DEVELOPMENT_DATABASE_ID]: databases.developmentSchema ?? (databases.development ? developmentDatabase() : undefined),
  }
  const calls: NotionCall[] = []
  const schemaCalls: SchemaCall[] = []
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>
    const schemaOf = /^https:\/\/api\.notion\.com\/v1\/databases\/([^/]+)$/.exec(String(input))?.[1]
    if (schemaOf) {
      schemaCalls.push({ database: schemaOf, headers, init: init ?? {} })
      const schema = schemas[schemaOf]
      if (!schema) return notShared(schemaOf)
      return "properties" in schema ? reply(200, schema) : reply(schema.status, schema.body)
    }
    const database = /^https:\/\/api\.notion\.com\/v1\/databases\/([^/]+)\/query$/.exec(String(input))?.[1]
    if (!database) return reply(404, { object: "error", status: 404, code: "invalid_request_url", message: "Invalid request URL." })
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>
    calls.push({ database, headers, body, init: init ?? {} })
    const answer = answers[database]
    if (!answer) return notShared(database)
    if (!Array.isArray(answer)) return reply(answer.status, answer.body)
    const size = Math.min(Number(body.page_size) || pageSize, pageSize)
    const start = typeof body.start_cursor === "string" ? Number(body.start_cursor) : 0
    const end = start + size
    return reply(200, { object: "list", results: answer.slice(start, end), has_more: end < answer.length, next_cursor: end < answer.length ? String(end) : null })
  }) as typeof fetch
  return { fetch: fetcher, calls, schemaCalls }
}
