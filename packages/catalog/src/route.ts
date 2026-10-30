// The pictures of the games: `GET /api/catalog/<slug>/<logo|icon|background>`, the handler `apps/web` mounts (docs/catalog.md).
// A game's pictures are files of its Notion row, a live game's as much as one to come, and Notion's own links expire after about an
// hour, so the catalog only flags them: this route asks Notion for a fresh link, downloads the picture (`picture.ts`) and serves it,
// and the CDN keeps it. The pictures in a game's Sanity project are the game's own and never come here. No picture is not an error
// page: the answer is a 404 and the page that asked draws a plain frame.
// The same address, `publisher-<n>` for a slot, is the icon of the n-th publisher of the game's row (from 0): its page has no picture
// of its own, so the server looks for the icon of its website (`favicon.ts`) and serves that, from this site, whose visitors then never
// meet the publisher's.

import { ART_SLOTS, pictureVersion, type ArtSlot, type NotionGame } from "./catalog"
import { fetchFavicon } from "./favicon"
import { NotionError, readPictureLinks, type PictureLinks } from "./notion"
import { PictureError, fetchPicture } from "./picture"
import { getCatalog, notionToken, reportOnce } from "./server"

/** How long the links read from Notion are believed: a cold page asks for every picture of every game at once, which Notion's rate limit (about 3 requests a second) would not take. */
export const LINKS_MEMO_MS = 30_000
/** How long a failed read is remembered, so that a Notion that is down is not asked again by every picture of the page. */
export const FAILURE_MEMO_MS = 5000
/** A 429 that asks to wait this many seconds at most is waited for, once, before the read is given up. */
export const MAX_RETRY_WAIT_SECONDS = 3
/** What a picture host is told to wait when it failed for a reason that may pass. */
const PICTURE_RETRY_SECONDS = 30

// The answers and what each one may be kept for, by the browser (`max-age`) and by the CDN (`s-maxage`)
const FRESH = "public, max-age=3600, s-maxage=86400"
// A picture whose URL does not carry the version of its row (the catalog and the read of the links are not of the same minute)
const SHORT = "public, max-age=60, s-maxage=60"
const REDIRECT = "public, max-age=0, s-maxage=10"
const NEVER = "no-store"
// The icon of a publisher's website changes once in years: a day. A site that has none is looked at again in an hour, not at every page
const ICON_FRESH = "public, max-age=86400, s-maxage=86400"
const ICON_ABSENT = "public, max-age=3600, s-maxage=3600"
/** How long a website that could not be reached is left alone: every visit to the page of its game would ask it again, and some would hold a function for the whole time limit. Per server instance. */
export const SITE_FAILURE_MEMO_MS = 5 * 60_000
const MAX_FAILED_SITES = 200

// What the media route sends too: the picture is shown by an <img>, and opened on its own it may not run anything
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
}

const isSlot = (value: string): value is ArtSlot => (ART_SLOTS as readonly string[]).includes(value)

/** `publisher-<n>`, n from 0, with no leading zero: one icon has one address, so the CDN keeps it once. */
const PUBLISHER_SLOT = /^publisher-(0|[1-9]\d?)$/

/** What an address asks for: one of the three pictures of the row, or the icon of one of its publishers. Null for anything else. */
function wantedOf(slot: string): { picture: ArtSlot } | { publisher: number } | null {
  if (isSlot(slot)) return { picture: slot }
  const place = PUBLISHER_SLOT.exec(slot)?.[1]
  return place === undefined ? null : { publisher: Number(place) }
}

const notFound = (cache = SHORT) => new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": cache } })

const unavailable = (retryAfterSeconds: number) =>
  new Response("Try again later", {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": NEVER, "Retry-After": String(Math.max(1, Math.ceil(retryAfterSeconds))) },
  })

/**
 * The redirect to the address that carries the version of the row the catalog read, or null when the address is that one already: so that
 * nobody can make the server fetch something under a `v` of their own, and nothing is read or downloaded before the address is right.
 */
function staleVersion(request: Request, game: NotionGame, slot: string): Response | null {
  const expected = pictureVersion(game.editedAt)
  if (new URL(request.url).searchParams.get("v") === expected) return null
  return new Response(null, { status: 307, headers: { Location: `/api/catalog/${game.slug}/${slot}?v=${expected}`, "Cache-Control": REDIRECT } })
}

/** What the last read of the links of the pictures came to, and until when it is believed. `links` is null when the read failed. */
type Reading = { links: PictureLinks | null; until: number }

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** One read of the links, or the reason it could not be had. Never throws: a failure is a `Reading` without links. */
async function load(token: string): Promise<Reading> {
  for (let attempt = 0; ; attempt++) {
    try {
      // No cache: the link of an uploaded file lives an hour, a kept one would be dead (`readPictureLinks`)
      return { links: await readPictureLinks({ token, init: { cache: "no-store" } }), until: Date.now() + LINKS_MEMO_MS }
    } catch (error) {
      const wait = error instanceof NotionError && error.status === 429 ? error.retryAfter : null
      if (attempt === 0 && wait !== null && wait <= MAX_RETRY_WAIT_SECONDS) {
        await sleep(wait * 1000)
        continue
      }
      reportOnce(`The pictures of the catalog cannot be read from Notion: ${error instanceof Error ? error.message : "unknown error"}`)
      return { links: null, until: Date.now() + Math.max(FAILURE_MEMO_MS, (wait ?? 0) * 1000) }
    }
  }
}

/**
 * The reader of the links: the answer of the last read for `LINKS_MEMO_MS` (a failure for `FAILURE_MEMO_MS`, or as long as Notion
 * asked), and one read at a time, however many pictures are asked for while it runs. Never rejects.
 */
function linkReader() {
  let settled: Reading | null = null
  let pending: Promise<Reading> | null = null
  return function read(token: string): Promise<Reading> {
    if (settled && Date.now() < settled.until) return Promise.resolve(settled)
    pending ??= load(token).then((reading) => {
      settled = reading
      pending = null
      return reading
    })
    return pending
  }
}

/**
 * The icon of a publisher's website, found there (`fetchFavicon`): a day for the CDN, a 404 for a site that has none, a 503 for one that cannot be reached now, and that
 * site is then left alone for `SITE_FAILURE_MEMO_MS` (`failed`: website → until when), so that a website that is down, or that has a broken certificate, is not asked again
 * by every visit to its game's page.
 */
async function publisherIcon(failed: Map<string, number>, slug: string, place: number, website: string): Promise<Response> {
  const until = failed.get(website)
  if (until !== undefined && Date.now() < until) return unavailable((until - Date.now()) / 1000)
  try {
    const icon = await fetchFavicon(website)
    return new Response(icon.bytes, { headers: { ...SECURITY_HEADERS, "Content-Type": icon.type, "Cache-Control": ICON_FRESH } })
  } catch (error) {
    if (!(error instanceof PictureError)) throw error
    reportOnce(`The icon of the publisher ${place + 1} of "${slug}" cannot be served: ${error.message}`)
    if (!error.retryable) return notFound(ICON_ABSENT)
    if (failed.size >= MAX_FAILED_SITES) failed.clear()
    failed.set(website, Date.now() + SITE_FAILURE_MEMO_MS)
    return unavailable(SITE_FAILURE_MEMO_MS / 1000)
  }
}

/**
 * `GET /api/catalog/<slug>/<slot>?v=<version>` for `apps/web`. In this order, so that nothing costs more than it has to:
 * 1. The slot is one of the three, and the slug is a game of the catalog whose Notion row has that picture: else 404. A live game
 *    that has no Notion row has no picture either (its `registryRow` flags none).
 * 2. `v` is the version of the row the catalog read (`pictureVersion`): a URL without it, or with an old one, is sent to the right
 *    one (307) before anything is read or downloaded, so that nobody can make the server fetch a picture under a `v` of their own.
 * 3. The link comes from a fresh read of the Games database, one for all the pictures (`linkReader`), and the picture is downloaded
 *    from it. It is kept for a day when the row is still the one `v` names, for a minute when it is not (the read and the catalog
 *    are never of the same minute), and not at all when Notion or the picture host cannot answer now (503).
 * `publisher-<n>` is the icon of a publisher: the same first two steps (the game's row must name an n-th publisher and give it a
 * website), then the icon is looked for on that website, whose address is the row's and never the request's. No Notion read is needed.
 */
export function pictureRoute() {
  const readLinks = linkReader()
  const failedSites = new Map<string, number>()

  return async function GET(request: Request, { params }: { params: Promise<{ slug: string; slot: string }> }): Promise<Response> {
    const { slug, slot } = await params
    const wanted = wantedOf(slot)
    if (!wanted) return notFound()

    const catalog = await getCatalog()
    // Notion did not answer: the game may well exist, it is not known to be missing
    if (catalog.notion === "unavailable") return unavailable(FAILURE_MEMO_MS / 1000)
    const entry = catalog.entries.find((candidate) => candidate.slug === slug)
    if (!entry) return notFound()
    const game = entry.game

    if ("publisher" in wanted) {
      const website = game.publishers[wanted.publisher]?.url
      if (!website) return notFound()
      return staleVersion(request, game, slot) ?? (await publisherIcon(failedSites, game.slug, wanted.publisher, website))
    }

    const picture = wanted.picture
    if (!game.art[picture]) return notFound()
    const stale = staleVersion(request, game, slot)
    if (stale) return stale
    const expected = pictureVersion(game.editedAt)

    const token = notionToken()
    if (!token) return notFound()
    const reading = await readLinks(token)
    if (!reading.links) return unavailable((reading.until - Date.now()) / 1000)
    const row = reading.links.get(game.notionPageId)
    const link = row?.links[picture]
    if (!row || !link) return notFound()

    try {
      const bytes = await fetchPicture(link)
      return new Response(bytes.bytes, {
        headers: { ...SECURITY_HEADERS, "Content-Type": bytes.type, "Cache-Control": pictureVersion(row.editedAt) === expected ? FRESH : SHORT },
      })
    } catch (error) {
      if (!(error instanceof PictureError)) throw error
      reportOnce(`The ${picture} of "${game.slug}" cannot be served: ${error.message}`)
      return error.retryable ? unavailable(PICTURE_RETRY_SECONDS) : notFound()
    }
  }
}
