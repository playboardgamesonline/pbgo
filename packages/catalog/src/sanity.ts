// The reader of the platform's Sanity project: its published games, with the people, publishers and categories they point at, as
// `CatalogGame`s, and its published expansions as `CatalogExpansion`s. A plain `fetch` of the project's public API, through its CDN: the dataset is public, so there is no token and nothing
// secret to read. No SDK and no framework here: the caller can hand in its own `fetch`, and `init` carries Next's cache options
// (`server.ts`). The model of the project is `docs/platform-sanity.md`; the Studio that edits it is `platform/apps/studio`.
// The texts and the pictures of a game are translated field by field there (PLT-104): the query takes the language and picks it, else English.

import type { Locale } from "@pbgo/core/lib/i18n"
import { cleanName, nameProblem, slugProblem } from "@pbgo/games/slug"
import { CREATOR_ROLES, GALLERY_MAX, HELPERS_MAX, LANGUAGES, type CreatorRole } from "@pbgo/studio-kit/constants"
// A value import from a sibling file would need a `.ts` extension, which apps/web's tsc refuses: only types come from there
import type { ArtSlot, CatalogExpansion, CatalogGame, Creator, GalleryItem, GameHelper, Publisher } from "./catalog"

/** The platform's own project (`playboardgamesonline`) and its dataset: the one the Studio of `platform/apps/studio` edits and the seed of `platform/content` fills. */
export const PLATFORM_PROJECT_ID = "mhgqs6fe"
export const PLATFORM_DATASET = "production"
/** The API version the query below is written for. */
export const SANITY_API_VERSION = "2025-02-19"

const DEFAULT_TIMEOUT_MS = 5000
const MAX_MESSAGE_LENGTH = 200

/**
 * What the hub reads: English, whatever the visitor's language, until the language pass (PLT-32). The language of the read is a parameter
 * of the query (`$language`) and of this module, so that it is a change of this one line.
 */
export const HUB_LANGUAGE = "en"

/**
 * The published games and the published expansions, each oldest first (so that two with one slug are settled the same way every time:
 * the older one wins). Two lists in one answer, one per document type, so that an expansion can never be read as a game: a game with
 * what the hub shows of it, an expansion with what its base game's lobby shows of it. A reference is followed to the document it points
 * at: the names of a game's categories, the people of its credits with their roles, its publishers with their websites, the slugs of its
 * related games, and of the base game of a game or of an expansion, and the address of the file of each picture. A reference to a
 * document that is not published is a `null`, which the reader drops.
 *
 * A text and a picture that a language can change are an array of rows `{ language, value }` (PLT-104): the row of `$language`, else the
 * one of English, else (a document that was not converted yet) the plain value the field used to hold, so that the same query reads a
 * dataset before and after the migration. `string(description)` is the old text and nothing for an array, and `logo.asset->url` the old
 * picture and nothing for an array; the `cover` of a game (PLT-114) and the `description`, the `cover` and the `boxFront` of an expansion are read the same way. The links to the rules are the
 * rows of `rules` as they are, and the four fields they replaced. The gallery of a game (PLT-56) is read as its items are stored: a picture is an
 * object with an `asset`, a clip an object with a `video` file and, when it has one, a `poster`; each gives the address of its file. The helpers of a game (PLT-56) are read as they are stored: a key and a title.
 */
export const CATALOG_QUERY = `{
  "games": *[_type == "game" && defined(slug.current)] | order(_createdAt asc) {
    _id, _updatedAt, name, "slug": slug.current, kind, order, bggId, buyUrl, releaseDate,
    playersMin, playersMax, duration, minAge, complexity,
    "description": coalesce(description[language == $language][0].value, description[language == "en"][0].value, string(description)),
    "rules": rules[]{ language, "link": value },
    rulesFr, rulesEn, rulesEs, rulesDe,
    "categories": categories[]->name,
    "creators": creators[]{ "name": creator->name, roles },
    "publishers": publishers[]->{ name, "url": website },
    "related": related[]->slug.current,
    "baseGame": baseGame->slug.current,
    "logo": coalesce(logo[language == $language][0].value.asset->url, logo[language == "en"][0].value.asset->url, logo.asset->url),
    "cover": coalesce(cover[language == $language][0].value.asset->url, cover[language == "en"][0].value.asset->url, cover.asset->url),
    "icon": icon.asset->url, "background": background.asset->url,
    "gallery": gallery[]{ caption, "image": asset->url, "video": video.asset->url, "poster": poster.asset->url },
    "helpers": helpers[]{ key, title }
  },
  "expansions": *[_type == "expansion" && defined(slug.current)] | order(_createdAt asc) {
    _id, name, "slug": slug.current,
    playersMin, playersMax, duration, minAge, complexity,
    "description": coalesce(description[language == $language][0].value, description[language == "en"][0].value, string(description)),
    "categories": categories[]->name,
    "baseGame": baseGame->slug.current,
    "cover": coalesce(cover[language == $language][0].value.asset->url, cover[language == "en"][0].value.asset->url, cover.asset->url),
    "boxFront": coalesce(boxFront[language == $language][0].value.asset->url, boxFront[language == "en"][0].value.asset->url, boxFront.asset->url)
  }
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
  /** The language of the texts and of the pictures, else English: `HUB_LANGUAGE` by default. One of `PLATFORM_LANGUAGES`, which the caller checks: it is part of the address the CDN keeps an answer under, so a language that comes from a visitor must not be passed as it is. */
  language?: string
}

/** A game of the project that is not in the catalog, and why. */
export type SkippedGame = { id: string; name: string; reason: string }

export type SanityRead = {
  games: CatalogGame[]
  skipped: SkippedGame[]
  /** The expansions of the project (`expansion` documents): played with another game, so they have no page on the hub; the lobby of their base game offers them. One that cannot be offered is left out and reported in `warnings`. */
  expansions: CatalogExpansion[]
  /** Things worth fixing in the Studio that do not stop the catalog. */
  warnings: string[]
}

export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)

/** What a document says about itself goes to a terminal and to the logs: no control character, an escape included. */
export const printable = (text: string): string => text.replace(/\p{Cc}/gu, "")

/** A name: one line of printable text, white space made one space. */
export const nameOf = (raw: unknown): string => (typeof raw === "string" ? cleanName(printable(cleanName(raw))) : "")

/** A text of several lines (a description): trimmed, its line breaks and tabs kept, any other control character removed. */
export const textOf = (raw: unknown): string => (typeof raw === "string" ? raw.replace(/[^\P{Cc}\n\t]/gu, "").trim() : "")

/** A whole number from `min` up, or null. */
const wholeOf = (raw: unknown, min: number): number | null => (typeof raw === "number" && Number.isInteger(raw) && raw >= min ? raw : null)

/** A weight on BoardGameGeek's scale: from 1 (light) to 5 (heavy). Anything else is no weight. */
const weightOf = (raw: unknown): number | null => (typeof raw === "number" && Number.isFinite(raw) && raw >= 1 && raw <= 5 ? raw : null)

/** A day, `YYYY-MM-DD`, that exists, or null. */
export function dayOf(raw: unknown): string | null {
  const match = typeof raw === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw) : null
  if (!match) return null
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? (raw as string) : null
}

/** A web link, or null: a rulebook or a website is only ever opened if it is http(s). */
export function linkOf(raw: unknown): string | null {
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
export const pictureOf = (raw: unknown, projectId: string, dataset: string): string | null =>
  typeof raw === "string" && raw.startsWith(`https://cdn.sanity.io/images/${projectId}/${dataset}/`) ? raw : null

/** The address of a clip's file, only when it is in the file CDN of the project that was read and is a format that a page plays: MP4 or WebM. Like a picture's, the hub never points a visitor anywhere else. */
const clipOf = (raw: unknown, projectId: string, dataset: string): string | null =>
  typeof raw === "string" && raw.startsWith(`https://cdn.sanity.io/files/${projectId}/${dataset}/`) && /\.(?:mp4|webm)$/i.test(raw) ? raw : null

/** What a caption of the gallery may be: a line, a hundred and forty characters at most. */
const MAX_CAPTION_LENGTH = 140

/**
 * The gallery of a game: its clips and its pictures whose files the hub may point a visitor at, in the order the Studio lists them, `GALLERY_MAX` at most. An item whose file is not
 * one (another project, another format, none) is left out, and so is one that is not an object; a clip keeps its poster only when that is a picture of the project.
 */
function galleryOf(raw: unknown, projectId: string, dataset: string): GalleryItem[] {
  if (!Array.isArray(raw)) return []
  const items = raw.flatMap((entry): GalleryItem[] => {
    if (!isRecord(entry)) return []
    const caption = nameOf(entry.caption).slice(0, MAX_CAPTION_LENGTH) || null
    const clip = clipOf(entry.video, projectId, dataset)
    if (clip) return [{ kind: "video", url: clip, poster: pictureOf(entry.poster, projectId, dataset), caption }]
    const image = pictureOf(entry.image, projectId, dataset)
    return image ? [{ kind: "image", url: image, caption }] : []
  })
  return items.slice(0, GALLERY_MAX)
}

const MAX_HELPER_TITLE_LENGTH = 80
/** What a game calls a helper: lowercase letters and digits joined by single dashes, 40 characters at most. */
const HELPER_KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * The helpers of a game, in the order the Studio lists them, `HELPERS_MAX` at most: each with the key the game calls it by and a name for the lobby to say, one line cut at the length the Studio allows. One that is not an
 * object, has no name or has no key the game could call it by is left out, and so is a second one with a key that is already taken (the first keeps it).
 */
function helpersOf(raw: unknown): GameHelper[] {
  if (!Array.isArray(raw)) return []
  const keys = new Set<string>()
  const helpers = raw.flatMap((entry): GameHelper[] => {
    if (!isRecord(entry)) return []
    const key = typeof entry.key === "string" && entry.key.length <= 40 && HELPER_KEY.test(entry.key) ? entry.key : ""
    const title = nameOf(entry.title).slice(0, MAX_HELPER_TITLE_LENGTH)
    if (!key || !title || keys.has(key)) return []
    keys.add(key)
    return [{ key, title }]
  })
  return helpers.slice(0, HELPERS_MAX)
}

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

/**
 * The link to the rules in a language: the row of that language in `rules` (the query gives each as `{ language, link }`), else the
 * field of the old model that was named after it (`rulesFr`…), until the migration has run. Nothing when it is not an http(s) link.
 */
function rulesLinkOf(raw: Record<string, unknown>, language: Locale): string | null {
  const row = Array.isArray(raw.rules) ? raw.rules.find((entry) => isRecord(entry) && entry.language === language) : undefined
  return linkOf(isRecord(row) ? row.link : undefined) ?? linkOf(raw[`rules${capitalized(language)}`])
}

/**
 * Why a document cannot be a game of the site, or an expansion offered by one, in a few words, or undefined when it can: the rules of the
 * Studio for a name and a slug, which the hub does not trust it to have kept. `taken`: the slugs of the ones of its type kept so far.
 */
function problemOf(name: string, slug: string, taken: ReadonlySet<string>, type: "game" | "expansion" = "game"): string | undefined {
  if (!name) return "it has no name"
  const nameIssue = nameProblem(name)
  if (nameIssue) return nameIssue
  const slugIssue = slugProblem(slug, [], type)
  if (slugIssue) return slugIssue
  return taken.has(slug) ? `its slug "${slug}" is already the one of an older ${type}` : undefined
}

/**
 * The games of the platform's Sanity project that the site can serve: every published `game` with a name and a slug it can use. A game
 * that needs another one to be played is not a game but an `expansion`, a document of its own (PLT-102) with no page on the hub: it is
 * read apart, in `expansions`, for the lobby of its base game to offer (a reimplementation, which stands on its own, is a game and is
 * listed). One that cannot be served is reported in `skipped`, never guessed at: no name (or one that is not a line of text), a slug that
 * is not one or is a route of the site, the slug of an older game (the older wins), or the kind `expansion`, which a game had before
 * expansions were documents of their own. A value the Studio lets through and the hub cannot use (a maximum of players under the
 * minimum, a link that is not http, a role the list lacks) leaves its field empty. An expansion that cannot be offered is left out and
 * reported in `warnings`. Throws a `SanityError` when the project cannot be read.
 */
export async function readSanityGames(options: SanityReadOptions = {}): Promise<SanityRead> {
  const projectId = options.projectId ?? PLATFORM_PROJECT_ID
  const dataset = options.dataset ?? PLATFORM_DATASET
  const doFetch = options.fetch ?? fetch
  // a parameter of the query is written `$name=<its value in JSON>`
  const language = encodeURIComponent(JSON.stringify(options.language ?? HUB_LANGUAGE))
  const url = `https://${projectId}.apicdn.sanity.io/v${SANITY_API_VERSION}/data/query/${dataset}?perspective=published&query=${encodeURIComponent(CATALOG_QUERY)}&%24language=${language}`

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
  const result = isRecord(payload) ? payload.result : null
  if (!isRecord(result) || !Array.isArray(result.games) || !Array.isArray(result.expansions)) throw new SanityError("Sanity answered with something that is not a list of games and a list of expansions", 200)

  const kept: { game: CatalogGame; links: string[] }[] = []
  const skipped: SkippedGame[] = []
  const slugs = new Set<string>()
  for (const raw of result.games) {
    if (!isRecord(raw)) continue
    const id = typeof raw._id === "string" ? raw._id : ""
    const name = nameOf(raw.name)
    // The kind a game had before expansions were documents of their own: it is no game of the hub, and no expansion either until it is moved to one
    if (raw.kind === "expansion") {
      skipped.push({ id, name: printable(name), reason: "its kind is expansion, which a game no longer has: an expansion is a document of its own, to be moved to one" })
      continue
    }
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
      cover: pictureOf(raw.cover, projectId, dataset),
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
        buyUrl: linkOf(raw.buyUrl),
        releaseDate: dayOf(raw.releaseDate),
        age: wholeOf(raw.minAge, 1),
        categories: namesOf(raw.categories),
        creators: creatorsOf(raw.creators),
        publishers: publishersOf(raw.publishers),
        rules: byLanguage((language) => rulesLinkOf(raw, language)),
        pictures,
        gallery: galleryOf(raw.gallery, projectId, dataset),
        helpers: helpersOf(raw.helpers),
        // Settled below, once every game is known: a link is the slug of a game the reader kept
        related: [],
        order: wholeOf(raw.order, 0),
        updatedAt: typeof raw._updatedAt === "string" ? raw._updatedAt : "",
      },
    })
  }

  // A link to a game that is not in the catalog (not published, left out above) is dropped, like a person with no name
  const games = kept.map(({ game, links }) => ({ ...game, related: [...new Set(links)].filter((slug) => slug !== game.slug && slugs.has(slug)) }))
  // An expansion is offered by the lobby of its base game: it needs a name and a slug as a game does, and a base game that the hub lists. One that lacks any of them is left out, and reported, since the Studio is where it is put right
  const expansions: CatalogExpansion[] = []
  const warnings: string[] = []
  const expansionSlugs = new Set<string>()
  for (const raw of result.expansions) {
    if (!isRecord(raw)) continue
    const name = nameOf(raw.name)
    const slug = typeof raw.slug === "string" ? raw.slug : ""
    const base = typeof raw.baseGame === "string" ? raw.baseGame : ""
    const label = printable(name || (typeof raw._id === "string" ? raw._id : "")) || "without a name"
    // The reference is a `null` when the base game is not published: the Studio makes it required, so that is the one way it can be missing
    const problem = problemOf(name, slug, expansionSlugs, "expansion") ?? (!base ? "it has no base game, or its base game is not published" : !slugs.has(base) ? `its base game "${base}" is not a game the hub lists` : undefined)
    if (problem) {
      warnings.push(`The expansion "${label}" of the Studio is left out: ${printable(problem)}`)
      continue
    }
    expansionSlugs.add(slug)
    const description = textOf(raw.description)
    expansions.push({
      slug,
      name,
      base,
      descriptions: description ? { en: description } : {},
      playersMin: wholeOf(raw.playersMin, 1),
      playersMax: wholeOf(raw.playersMax, 1),
      duration: wholeOf(raw.duration, 1),
      age: wholeOf(raw.minAge, 1),
      complexity: weightOf(raw.complexity),
      categories: namesOf(raw.categories),
      pictures: { cover: pictureOf(raw.cover, projectId, dataset), boxFront: pictureOf(raw.boxFront, projectId, dataset) },
    })
  }
  if (games.length === 0) warnings.push("The platform's Sanity project has no published game: the hub lists the live games of the registry alone")
  return { games, skipped, expansions, warnings }
}
