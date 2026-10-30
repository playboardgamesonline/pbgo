// The reader of the platform's Sanity project: its published games, with the people, publishers and categories they point at, as
// `CatalogGame`s. A plain `fetch` of the project's public API, through its CDN: the dataset is public, so there is no token and nothing
// secret to read. No SDK and no framework here: the caller can hand in its own `fetch`, and `init` carries Next's cache options
// (`server.ts`). The model of the project is `docs/platform-sanity.md`; the Studio that edits it is `platform/apps/studio`.

import type { Locale } from "@pbgo/core/lib/i18n"
import { cleanName, nameProblem, slugProblem } from "@pbgo/games/slug"
import { CREATOR_ROLES, LANGUAGES, type CreatorRole } from "@pbgo/studio-kit/constants"
// A value import from a sibling file would need a `.ts` extension, which apps/web's tsc refuses: only types come from there
import type { ArtSlot, CatalogGame, Creator, Publisher } from "./catalog"

/** The platform's own project (`playboardgamesonline`) and its dataset: the one the Studio of `platform/apps/studio` edits and the seed of `platform/content` fills. */
export const PLATFORM_PROJECT_ID = "mhgqs6fe"
export const PLATFORM_DATASET = "production"
/** The API version the query below is written for. */
export const SANITY_API_VERSION = "2025-02-19"

const DEFAULT_TIMEOUT_MS = 5000
const MAX_MESSAGE_LENGTH = 200

/**
 * The published games, oldest first (so that two games with one slug are settled the same way every time: the older one wins), each with
 * what the hub shows of it. A reference is followed to the document it points at: the names of its categories, the people of its credits
 * with their roles, its publishers with their websites, the slugs of its related games and of its base game, and the address of the
 * file of each picture. A reference to a document that is not published is a `null`, which the reader drops.
 */
export const CATALOG_QUERY = `*[_type == "game" && defined(slug.current)] | order(_createdAt asc) {
  _id, _updatedAt, name, "slug": slug.current, kind, order, bggId, releaseDate,
  playersMin, playersMax, duration, minAge, complexity, description,
  rulesFr, rulesEn, rulesEs, rulesDe,
  "categories": categories[]->name,
  "creators": creators[]{ "name": creator->name, roles },
  "publishers": publishers[]->{ name, "url": website },
  "related": related[]->slug.current,
  "baseGame": baseGame->slug.current,
  "logo": logo.asset->url, "icon": icon.asset->url, "background": background.asset->url
}`

/** A failed call to the platform's Sanity project. The message never holds an address of a request. `status` is the HTTP status, 0 when Sanity could not be reached. */
export class SanityError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = "SanityError"
    this.status = status
  }
}

export type SanityReadOptions = {
  /** Defaults to the global `fetch` (Next's, which caches). */
  fetch?: typeof fetch
  /** Added to the request, e.g. Next's `{ next: { revalidate, tags } }`. The method, headers and signal are not overridable. */
  init?: RequestInit
  /** 5 seconds by default. */
  timeoutMs?: number
  /** The project and the dataset to read: the platform's own, unless a test says otherwise. */
  projectId?: string
  dataset?: string
}

/** A game of the project that is not in the catalog, and why. */
export type SkippedGame = { id: string; name: string; reason: string }

export type SanityRead = {
  games: CatalogGame[]
  skipped: SkippedGame[]
  /** How many games of the project are expansions (`kind`): played with another game, so they have no page on the hub. Counted and left out, never reported. */
  expansions: number
  /** Things worth fixing in the Studio that do not stop the catalog. */
  warnings: string[]
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)

/** What a document says about itself goes to a terminal and to the logs: no control character, an escape included. */
const printable = (text: string): string => text.replace(/\p{Cc}/gu, "")

/** A name: one line of printable text, white space made one space. */
const nameOf = (raw: unknown): string => (typeof raw === "string" ? cleanName(printable(cleanName(raw))) : "")

/** A text of several lines (a description): trimmed, its line breaks and tabs kept, any other control character removed. */
const textOf = (raw: unknown): string => (typeof raw === "string" ? raw.replace(/[^\P{Cc}\n\t]/gu, "").trim() : "")

/** A whole number from `min` up, or null. */
const wholeOf = (raw: unknown, min: number): number | null => (typeof raw === "number" && Number.isInteger(raw) && raw >= min ? raw : null)

/** A weight on BoardGameGeek's scale: from 1 (light) to 5 (heavy). Anything else is no weight. */
const weightOf = (raw: unknown): number | null => (typeof raw === "number" && Number.isFinite(raw) && raw >= 1 && raw <= 5 ? raw : null)

/** A day, `YYYY-MM-DD`, that exists, or null. */
function dayOf(raw: unknown): string | null {
  const match = typeof raw === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw) : null
  if (!match) return null
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? (raw as string) : null
}

/** A web link, or null: a rulebook or a website is only ever opened if it is http(s). */
function linkOf(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const link = raw.trim()
  try {
    const { protocol } = new URL(link)
    return protocol === "https:" || protocol === "http:" ? link : null
  } catch {
    return null
  }
}

/** The address of a picture's file, only when it is in the image CDN of the project that was read: the hub never points a visitor anywhere else. */
const pictureOf = (raw: unknown, projectId: string, dataset: string): string | null =>
  typeof raw === "string" && raw.startsWith(`https://cdn.sanity.io/images/${projectId}/${dataset}/`) ? raw : null

const ROLES: readonly CreatorRole[] = CREATOR_ROLES.map((role) => role.value)

/** The people of the credits that have a name and at least one role the Studio lists, their roles in the order of the list. */
function creatorsOf(raw: unknown): Creator[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((line): Creator[] => {
    if (!isRecord(line)) return []
    const name = nameOf(line.name)
    const given: unknown[] = Array.isArray(line.roles) ? line.roles : []
    const roles = ROLES.filter((role) => given.includes(role))
    return name && roles.length > 0 ? [{ name, roles }] : []
  })
}

const publishersOf = (raw: unknown): Publisher[] =>
  Array.isArray(raw) ? raw.flatMap((entry): Publisher[] => (isRecord(entry) && nameOf(entry.name) ? [{ name: nameOf(entry.name), url: linkOf(entry.url) }] : [])) : []

/** The distinct names of a list, in order. */
const namesOf = (raw: unknown): string[] => (Array.isArray(raw) ? [...new Set(raw.flatMap((entry) => nameOf(entry) || []))] : [])

const byLanguage = (read: (language: Locale) => string | null): Partial<Record<Locale, string>> => {
  const values: Partial<Record<Locale, string>> = {}
  for (const { id } of LANGUAGES) {
    const value = read(id)
    if (value) values[id] = value
  }
  return values
}

const capitalized = (word: string) => word.charAt(0).toUpperCase() + word.slice(1)

/** Why a document cannot be a game of the site, in a few words, or undefined when it can. `taken`: the slugs of the games kept so far. */
function problemOf(name: string, slug: string, taken: ReadonlySet<string>): string | undefined {
  if (!name) return "it has no name"
  const nameIssue = nameProblem(name)
  if (nameIssue) return nameIssue
  const slugIssue = slugProblem(slug)
  if (slugIssue) return slugIssue
  return taken.has(slug) ? `its slug "${slug}" is already the one of an older game` : undefined
}

/**
 * The games of the platform's Sanity project that the site can serve: every published `game` with a name and a slug it can use, except
 * the expansions (`kind`: a game that needs another one to be played is no game of the hub, so it has no page; it is counted in
 * `expansions` and left out, a reimplementation, which stands on its own, is listed). One that cannot be served is reported in
 * `skipped`, never guessed at: no name (or one that is not a line of text), a slug that is not one or is a route of the site, or the slug
 * of an older game (the older wins). A value the Studio lets through and the hub cannot use (a maximum of players under the minimum, a
 * link that is not http, a role the list lacks) leaves its field empty. Throws a `SanityError` when the project cannot be read.
 */
export async function readSanityGames(options: SanityReadOptions = {}): Promise<SanityRead> {
  const projectId = options.projectId ?? PLATFORM_PROJECT_ID
  const dataset = options.dataset ?? PLATFORM_DATASET
  const doFetch = options.fetch ?? fetch
  const url = `https://${projectId}.apicdn.sanity.io/v${SANITY_API_VERSION}/data/query/${dataset}?perspective=published&query=${encodeURIComponent(CATALOG_QUERY)}`

  let response: Response
  try {
    response = await doFetch(url, { ...options.init, method: "GET", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS) })
  } catch (error) {
    // Only the kind of failure (TimeoutError, TypeError…): nothing of the request is repeated
    throw new SanityError(`The platform's Sanity project could not be reached (${error instanceof Error ? error.name : "unknown error"})`, 0)
  }
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = isRecord(payload) && isRecord(payload.error) && typeof payload.error.description === "string" ? payload.error.description.slice(0, MAX_MESSAGE_LENGTH) : ""
    throw new SanityError(`Sanity answered ${response.status}${detail ? `: ${detail}` : ""}`, response.status)
  }
  if (!isRecord(payload) || !Array.isArray(payload.result)) throw new SanityError("Sanity answered with something that is not a list of games", 200)

  const kept: { game: CatalogGame; links: string[] }[] = []
  const skipped: SkippedGame[] = []
  const slugs = new Set<string>()
  let expansions = 0
  for (const raw of payload.result) {
    if (!isRecord(raw)) continue
    if (raw.kind === "expansion") {
      expansions += 1
      continue
    }
    const id = typeof raw._id === "string" ? raw._id : ""
    const name = nameOf(raw.name)
    const slug = typeof raw.slug === "string" ? raw.slug : ""
    const problem = problemOf(name, slug, slugs)
    if (problem) {
      skipped.push({ id, name: printable(name), reason: printable(problem) })
      continue
    }
    slugs.add(slug)

    const min = wholeOf(raw.playersMin, 1)
    const max = wholeOf(raw.playersMax, 1)
    const description = textOf(raw.description)
    const pictures: Record<ArtSlot, string | null> = {
      logo: pictureOf(raw.logo, projectId, dataset),
      icon: pictureOf(raw.icon, projectId, dataset),
      background: pictureOf(raw.background, projectId, dataset),
    }
    const family = [...(Array.isArray(raw.related) ? raw.related : []), raw.baseGame]
    kept.push({
      links: family.flatMap((entry) => (typeof entry === "string" ? entry : [])),
      game: {
        slug,
        name,
        descriptions: description ? { en: description } : {},
        players: min === null ? null : { min, max: max !== null && max >= min ? max : null },
        duration: wholeOf(raw.duration, 1),
        complexity: weightOf(raw.complexity),
        bggId: wholeOf(raw.bggId, 1),
        releaseDate: dayOf(raw.releaseDate),
        age: wholeOf(raw.minAge, 1),
        categories: namesOf(raw.categories),
        creators: creatorsOf(raw.creators),
        publishers: publishersOf(raw.publishers),
        rules: byLanguage((language) => linkOf(raw[`rules${capitalized(language)}`])),
        pictures,
        // Settled below, once every game is known: a link is the slug of a game the reader kept
        related: [],
        order: wholeOf(raw.order, 0),
        updatedAt: typeof raw._updatedAt === "string" ? raw._updatedAt : "",
      },
    })
  }

  // A link to a game that is not in the catalog (not published, left out above) is dropped, like a person with no name
  const games = kept.map(({ game, links }) => ({ ...game, related: [...new Set(links)].filter((slug) => slug !== game.slug && slugs.has(slug)) }))
  const warnings = games.length === 0 ? ["The platform's Sanity project has no published game: the hub lists the live games of the registry alone"] : []
  return { games, skipped, expansions, warnings }
}
