// The reader of the platform's editorial for the signed-in home: the announcements and the changelog entries of the platform's Sanity project (docs/platform-sanity.md), as `Announcement`s and `ChangelogEntry`s.
// Like `sanity.ts` it is a plain `fetch` of the project's public API, through its CDN: the dataset is public, so there is no token and nothing secret to read. What a document says is cleaned before the hub
// uses it (one line of printable text, a link that is http(s), a picture that is in the project's image CDN), and a document that cannot be used is left out: the editorial never breaks a page.

import { PLATFORM_DATASET, PLATFORM_PROJECT_ID, SANITY_API_VERSION, SanityError, dayOf, isRecord, linkOf, nameOf, pictureOf, textOf, type SanityReadOptions } from "./sanity"

/** The tones of an announcement and the kinds of a changelog entry, as the Studio stores them (`platform/apps/studio/schemaTypes/constants.ts`). */
export const ANNOUNCEMENT_TONES = ["info", "success", "alert"] as const
export type AnnouncementTone = (typeof ANNOUNCEMENT_TONES)[number]
export const CHANGELOG_KINDS = ["newGame", "feature", "improvement", "fix"] as const
export type ChangelogKind = (typeof CHANGELOG_KINDS)[number]

/** What a kind is called on the hub. */
export const KIND_LABELS: Record<ChangelogKind, string> = { newGame: "New game", feature: "New feature", improvement: "Improvement", fix: "Fix" }

/** A message the hub shows for a while: a new game, a maintenance, a contest. */
export type Announcement = {
  id: string
  title: string
  message: string
  tone: AnnouncementTone
  /** Where "Read more" leads: an http(s) address with its label, or null. */
  link: { url: string; label: string } | null
  /** The slug of the game it is about, or null. */
  game: string | null
  dismissible: boolean
  /** When it is shown from and until (ISO), null when the Studio sets none. */
  startsAt: string | null
  endsAt: string | null
}

/** One line of "What's new". */
export type ChangelogEntry = {
  id: string
  title: string
  /** The day, `YYYY-MM-DD`. */
  date: string
  kind: ChangelogKind
  /** The start of its text, plain, `TEXT_MAX` characters at most; empty when it has none. */
  text: string
  /** The address of its picture in the project's image CDN, or null. */
  image: string | null
  /** The slugs of the games it is about, in the order of the Studio. */
  games: string[]
}

export type Editorial = { announcements: Announcement[]; entries: ChangelogEntry[] }

/** How many of each the query asks for: the newest announcements (the active ones are picked among them) and the newest entries. */
const ANNOUNCEMENTS_ASKED = 20
const ENTRIES_ASKED = 12

/**
 * The published announcements (the newest first) and changelog entries (the newest first), with the slugs of the games they point at and the address of the picture of an entry. `pt::text` is the plain text of a
 * rich text. Which announcements are shown now is decided by `activeAnnouncements` when the page is served, so that the answer of the CDN does not depend on the time.
 */
export const EDITORIAL_QUERY = `{
  "announcements": *[_type == "announcement"] | order(coalesce(startsAt, _createdAt) desc) [0...${ANNOUNCEMENTS_ASKED}] {
    _id, title, message, tone, startsAt, endsAt, dismissible,
    "link": link{ "url": url, label },
    "game": game->slug.current
  },
  "entries": *[_type == "changelogEntry" && defined(date)] | order(date desc, _createdAt desc) [0...${ENTRIES_ASKED}] {
    _id, title, date, kind,
    "text": pt::text(body),
    "image": image.asset->url,
    "games": games[]->slug.current
  }
}`

/** The longest start of a text kept for an entry. */
export const TEXT_MAX = 180

/** The start of a text, plain: white space made single spaces, cut at a word with an ellipsis when it is longer than `max`. */
export function excerptOf(raw: unknown, max = TEXT_MAX): string {
  const text = textOf(raw).replace(/\s+/g, " ").trim()
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const space = cut.lastIndexOf(" ")
  return `${(space > max / 2 ? cut.slice(0, space) : cut).trimEnd()}…`
}

/** A date and time (ISO) that exists, or null. */
const momentOf = (raw: unknown): string | null => (typeof raw === "string" && Number.isFinite(Date.parse(raw)) ? raw : null)

function announcementOf(raw: unknown): Announcement | null {
  if (!isRecord(raw)) return null
  const id = typeof raw._id === "string" ? raw._id : ""
  const title = nameOf(raw.title)
  const message = textOf(raw.message)
  if (!id || !title || !message) return null
  const url = isRecord(raw.link) ? linkOf(raw.link.url) : null
  const label = isRecord(raw.link) ? nameOf(raw.link.label) : ""
  return {
    id,
    title,
    message,
    tone: ANNOUNCEMENT_TONES.find((tone) => tone === raw.tone) ?? "info",
    link: url ? { url, label: label || "Read more" } : null,
    game: typeof raw.game === "string" && raw.game ? raw.game : null,
    dismissible: raw.dismissible !== false,
    startsAt: momentOf(raw.startsAt),
    endsAt: momentOf(raw.endsAt),
  }
}

function entryOf(raw: unknown, projectId: string, dataset: string): ChangelogEntry | null {
  if (!isRecord(raw)) return null
  const id = typeof raw._id === "string" ? raw._id : ""
  const title = nameOf(raw.title)
  const date = dayOf(raw.date)
  const kind = CHANGELOG_KINDS.find((candidate) => candidate === raw.kind)
  if (!id || !title || !date || !kind) return null
  return {
    id,
    title,
    date,
    kind,
    text: excerptOf(raw.text),
    image: pictureOf(raw.image, projectId, dataset),
    games: Array.isArray(raw.games) ? raw.games.flatMap((slug) => (typeof slug === "string" && slug ? [slug] : [])) : [],
  }
}

/** What a read makes of the answer's `result`: the announcements and the entries that can be used, in the order the query gave them. */
export function parseEditorial(result: unknown, projectId = PLATFORM_PROJECT_ID, dataset = PLATFORM_DATASET): Editorial {
  if (!isRecord(result) || !Array.isArray(result.announcements) || !Array.isArray(result.entries)) {
    throw new SanityError("Sanity answered with something that is not a list of announcements and a list of entries", 200)
  }
  return {
    announcements: result.announcements.flatMap((raw) => announcementOf(raw) ?? []),
    entries: result.entries.flatMap((raw) => entryOf(raw, projectId, dataset) ?? []),
  }
}

const DEFAULT_TIMEOUT_MS = 5000
const MAX_MESSAGE_LENGTH = 200

/** One GET of the project's public API, through its CDN, on the published documents. Throws a `SanityError` when Sanity cannot be reached, refuses or answers with something else. */
export async function readEditorial(options: Pick<SanityReadOptions, "fetch" | "init" | "timeoutMs" | "projectId" | "dataset"> = {}): Promise<Editorial> {
  const projectId = options.projectId ?? PLATFORM_PROJECT_ID
  const dataset = options.dataset ?? PLATFORM_DATASET
  const doFetch = options.fetch ?? fetch
  const url = `https://${projectId}.apicdn.sanity.io/v${SANITY_API_VERSION}/data/query/${dataset}?perspective=published&query=${encodeURIComponent(EDITORIAL_QUERY)}`

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
  return parseEditorial(isRecord(payload) ? payload.result : null, projectId, dataset)
}

/** The announcements to show at `now`: those whose time has come and not gone, in the order given (the newest first). One with no time is always shown. */
export function activeAnnouncements(announcements: readonly Announcement[], now: Date): Announcement[] {
  const moment = now.getTime()
  return announcements.filter((announcement) => (announcement.startsAt === null || Date.parse(announcement.startsAt) <= moment) && (announcement.endsAt === null || moment <= Date.parse(announcement.endsAt)))
}

/** How many banners and how many lines of news the signed-in home shows. */
export const BANNERS_MAX = 3
export const NEWS_MAX = 4

/** The banners: the newest entries that have a picture. */
export const bannersOf = (entries: readonly ChangelogEntry[]): ChangelogEntry[] => entries.filter((entry) => entry.image !== null).slice(0, BANNERS_MAX)

/** The news: the newest entries, with or without a picture. */
export const newsOf = (entries: readonly ChangelogEntry[]): ChangelogEntry[] => entries.slice(0, NEWS_MAX)

/** The page of "What's new". */
export const WHATS_NEW_HREF = "/about#whats-new"

/** Where an entry leads: the page of the first game it is about that the hub lists (`known`: the slugs of the catalog), else the page of what's new. */
export function entryHref(entry: Pick<ChangelogEntry, "games">, known: ReadonlySet<string>): string {
  const slug = entry.games.find((candidate) => known.has(candidate))
  return slug ? `/game/${slug}` : WHATS_NEW_HREF
}
